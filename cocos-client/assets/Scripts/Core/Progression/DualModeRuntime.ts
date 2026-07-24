import type { DungeonExtractionEvent, RunLoot } from '../Dungeon/DungeonTypes.ts'
import {
  applyExtractionLoot,
  consumeDungeonPass,
  migratePlayerSave,
} from './PlayerSave.ts'
import type { PlayerSaveV3 } from './PlayerSave.ts'
import type { SaveRepository } from './SaveRepository.ts'
import { applyWorldBossClear } from '../World/WorldRewards.ts'

const MAX_UINT32 = 4294967295
const UINT32_RANGE = 4294967296

export type DualMode = 'world' | 'dungeon'

export interface DungeonSessionPort {
  hasRun(): boolean
  currentRunId(): string | null
  previewRunId(seed: number): string | null
  begin(seed: number): boolean
  cancelRun(): boolean
  isExtractedRun(runId: string): boolean
  extractedLoot(runId: string): RunLoot[] | null
}

export interface DualModeRuntimeOptions {
  initialSave: PlayerSaveV3
  repository: SaveRepository
  dungeon: DungeonSessionPort
  seedSource?: () => number
}

type RejectedTransition = { ok: false; reason: string }
type DungeonEntryAccepted = {
  ok: true
  seed: number
  runId: string
  saveChanged: true
}
type ExtractionAccepted = {
  ok: true
  runId: string
  duplicate: boolean
  saveChanged: boolean
}
type WorldClearAccepted = { ok: true; saveChanged: true }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function canonicalId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const id = value.trim()
  return id === '' ? null : id
}

function isUint32(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
    && value <= MAX_UINT32
}

function parseWorldClearEvent(value: unknown): { stage: number; rewardId: string } | null {
  try {
    if (!isRecord(value)) return null
    const stage = value.stage
    const rewardId = value.rewardId
    if (typeof stage !== 'number' || !Number.isFinite(stage) || typeof rewardId !== 'string') return null
    return { stage, rewardId }
  } catch {
    return null
  }
}

function parseLoot(value: unknown): RunLoot[] | null {
  if (!Array.isArray(value)) return null
  const loot: RunLoot[] = []
  for (const entry of value) {
    if (!isRecord(entry)) return null
    const itemId = entry.itemId
    const amount = entry.amount
    if (canonicalId(itemId) === null
      || typeof itemId !== 'string'
      || typeof amount !== 'number'
      || !Number.isFinite(amount)
      || !Number.isInteger(amount)
      || amount <= 0) return null
    loot.push({ itemId, amount })
  }
  return loot
}

export function isDungeonExtractionEvent(value: unknown): value is DungeonExtractionEvent {
  return parseDungeonExtractionEvent(value) !== null
}

function parseDungeonExtractionEvent(value: unknown): DungeonExtractionEvent | null {
  try {
    if (!isRecord(value)) return null
    const runId = canonicalId(value.runId)
    const loot = parseLoot(value.loot)
    if (runId === null || loot === null) return null
    return { runId, loot }
  } catch {
    return null
  }
}

function sameLoot(left: readonly RunLoot[], right: readonly RunLoot[]): boolean {
  if (left.length !== right.length) return false
  return left.every((item, index) => (
    item.itemId === right[index].itemId && item.amount === right[index].amount
  ))
}

function defaultSeedSource(): number {
  return Math.floor(Math.random() * UINT32_RANGE)
}

export function createDualModeRuntime(options: DualModeRuntimeOptions) {
  let save = migratePlayerSave(options.initialSave)
  let activeRunId: string | null = null
  let mode: DualMode = 'world'
  const seedSource = options.seedSource ?? defaultSeedSource

  try {
    if (options.dungeon.hasRun()) {
      activeRunId = canonicalId(options.dungeon.currentRunId())
      if (activeRunId) mode = 'dungeon'
    }
  } catch {
    activeRunId = null
    mode = 'world'
  }

  function hasReward(rewardId: string): boolean {
    return save.rewardLedger.some((entry) => entry.trim() === rewardId)
  }

  function didAcceptReward(previous: PlayerSaveV3, next: PlayerSaveV3): boolean {
    return next.rewardLedger.length > previous.rewardLedger.length
  }

  function persist(next: PlayerSaveV3): boolean {
    try {
      options.repository.save(next)
      return true
    } catch {
      return false
    }
  }

  function previewRunId(seed: number): string | null {
    try {
      return canonicalId(options.dungeon.previewRunId(seed))
    } catch {
      return null
    }
  }

  function allocateRun(): { seed: number; runId: string } | null {
    const initialSeed = seedSource()
    if (!isUint32(initialSeed)) return null
    const attempts = save.rewardLedger.length + 1
    for (let offset = 0; offset < attempts; offset += 1) {
      const seed = (initialSeed + offset) % UINT32_RANGE
      const runId = previewRunId(seed)
      if (runId && !hasReward(runId)) return { seed, runId }
    }
    return null
  }

  function enterDungeon(seed?: number): DungeonEntryAccepted | RejectedTransition {
    try {
      if (activeRunId !== null || options.dungeon.hasRun()) {
        return { ok: false, reason: 'run-active' }
      }
    } catch {
      return { ok: false, reason: 'dungeon-unavailable' }
    }

    let candidate: { seed: number; runId: string } | null
    if (seed === undefined) {
      candidate = allocateRun()
      if (!candidate) return { ok: false, reason: 'seed-allocation-failed' }
    } else {
      if (!isUint32(seed)) return { ok: false, reason: 'invalid-seed' }
      const runId = previewRunId(seed)
      if (!runId) return { ok: false, reason: 'dungeon-preview-failed' }
      if (hasReward(runId)) return { ok: false, reason: 'duplicate-run-id' }
      candidate = { seed, runId }
    }

    const passResult = consumeDungeonPass(save)
    if (!passResult.ok) return { ok: false, reason: 'missing-pass' }

    let began = false
    try {
      began = options.dungeon.begin(candidate.seed)
    } catch {
      began = false
    }
    if (!began) return { ok: false, reason: 'dungeon-begin-failed' }

    if (!persist(passResult.save)) {
      let didRollback = false
      try {
        didRollback = options.dungeon.cancelRun()
      } catch {
        didRollback = false
      }
      if (!didRollback) {
        activeRunId = candidate.runId
        mode = 'dungeon'
        return { ok: false, reason: 'save-persist-rollback-failed' }
      }
      return { ok: false, reason: 'save-persist-failed' }
    }

    save = passResult.save
    activeRunId = candidate.runId
    mode = 'dungeon'
    return { ok: true, seed: candidate.seed, runId: candidate.runId, saveChanged: true }
  }

  function handleWorldCleared(payload: unknown): WorldClearAccepted | RejectedTransition {
    const event = parseWorldClearEvent(payload)
    if (!event) return { ok: false, reason: 'invalid-world-event' }

    const next = applyWorldBossClear(save, event).save
    if (!didAcceptReward(save, next)) return { ok: false, reason: 'world-reward-rejected' }
    if (!persist(next)) return { ok: false, reason: 'save-persist-failed' }

    save = next
    return { ok: true, saveChanged: true }
  }

  function handleDungeonExtracted(payload: unknown): ExtractionAccepted | RejectedTransition {
    const event = parseDungeonExtractionEvent(payload)
    if (!event) {
      return { ok: false, reason: 'invalid-extraction-event' }
    }
    const runId = event.runId
    if (activeRunId === null) return { ok: false, reason: 'no-active-run' }
    if (runId !== activeRunId) return { ok: false, reason: 'run-id-mismatch' }

    let authoritativeLoot: RunLoot[] | null
    try {
      if (!options.dungeon.isExtractedRun(runId)) {
        return { ok: false, reason: 'run-not-extracted' }
      }
      authoritativeLoot = options.dungeon.extractedLoot(runId)
    } catch {
      return { ok: false, reason: 'dungeon-unavailable' }
    }
    if (authoritativeLoot === null || !sameLoot(event.loot, authoritativeLoot)) {
      return { ok: false, reason: 'loot-mismatch' }
    }

    if (hasReward(runId)) {
      activeRunId = null
      mode = 'world'
      return { ok: true, runId, duplicate: true, saveChanged: false }
    }

    const next = applyExtractionLoot(save, runId, authoritativeLoot)
    if (!didAcceptReward(save, next)) {
      return { ok: false, reason: 'extraction-reward-rejected' }
    }
    if (!persist(next)) return { ok: false, reason: 'save-persist-failed' }

    save = next
    activeRunId = null
    mode = 'world'
    return { ok: true, runId, duplicate: false, saveChanged: true }
  }

  return {
    enterDungeon,
    handleWorldCleared,
    handleDungeonExtracted,
    getMode: () => mode,
    getActiveRunId: () => activeRunId,
    getSaveSnapshot: () => migratePlayerSave(save),
  }
}

export type DualModeRuntime = ReturnType<typeof createDualModeRuntime>
