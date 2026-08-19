import {
  validateDungeonCheckpointShape,
  type DungeonRunCheckpoint,
} from '../Dungeon/DungeonSession.ts'
import type { DungeonExtractionEvent, RunLoot } from '../Dungeon/DungeonTypes.ts'
import { consumeDungeonEntry, refundDungeonEntry } from '../Dungeon/DungeonEntryRules.ts'
import {
  applyExtractionLoot,
  migratePlayerSave,
  type PlayerSaveV4,
} from './PlayerSave.ts'
import type { SaveRepository } from './SaveRepository.ts'
import { applyWorldBossClear } from '../World/WorldRewards.ts'

const MAX_UINT32 = 4294967295
const UINT32_RANGE = 4294967296

export type DualMode = 'world' | 'dungeon'

export interface DungeonSessionPort {
  isReady(): boolean
  hasRun(): boolean
  currentRunId(): string | null
  previewRunId(seed: number): string | null
  begin(seed: number): boolean
  restore(checkpoint: DungeonRunCheckpoint): boolean
  checkpoint(): DungeonRunCheckpoint | null
  cancelRun(): boolean
  isExtractedRun(runId: string): boolean
  extractedLoot(runId: string): RunLoot[] | null
}

export interface DualModeRuntimeOptions {
  initialSave: PlayerSaveV4
  repository: SaveRepository
  dungeon: DungeonSessionPort
  seedSource?: () => number
  dayKeySource?: () => string
}

type RejectedTransition = { ok: false; reason: string }
type DungeonEntryAccepted = { ok: true; seed: number; runId: string; saveChanged: true }
type ExtractionAccepted = { ok: true; runId: string; duplicate: boolean; saveChanged: boolean }
type TerminalAccepted = { ok: true; runId: string; saveChanged: true }
type SaveAccepted = { ok: true; saveChanged: true }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function canonicalId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const id = value.trim()
  return id === '' ? null : id
}

function isUint32(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= MAX_UINT32
}

function cloneCheckpoint(value: unknown): DungeonRunCheckpoint | null {
  try {
    validateDungeonCheckpointShape(value)
    const checkpoint = JSON.parse(JSON.stringify(value)) as DungeonRunCheckpoint
    validateDungeonCheckpointShape(checkpoint)
    return checkpoint
  } catch {
    return null
  }
}

function parseWorldClearEvent(value: unknown): { stage: number; rewardId: string } | null {
  try {
    if (!isRecord(value)) return null
    if (typeof value.stage !== 'number' || !Number.isFinite(value.stage) || typeof value.rewardId !== 'string') return null
    return { stage: value.stage, rewardId: value.rewardId }
  } catch {
    return null
  }
}

function parseLoot(value: unknown): RunLoot[] | null {
  if (!Array.isArray(value)) return null
  const loot: RunLoot[] = []
  for (const entry of value) {
    if (!isRecord(entry)) return null
    const itemId = canonicalId(entry.itemId)
    const amount = entry.amount
    if (itemId === null || typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0) return null
    loot.push({ itemId, amount })
  }
  return loot
}

function parseDungeonExtractionEvent(value: unknown): DungeonExtractionEvent | null {
  try {
    if (!isRecord(value)) return null
    const runId = canonicalId(value.runId)
    const loot = parseLoot(value.loot)
    return runId === null || loot === null ? null : { runId, loot }
  } catch {
    return null
  }
}

function parseTerminalEvent(
  value: unknown,
  expectedType: 'dungeon-defeated' | 'dungeon-abandoned',
): { retainedLoot: RunLoot[] } | null {
  try {
    if (!isRecord(value)) return null
    const retainedLoot = parseLoot(value.retainedLoot)
    return value.type !== expectedType || retainedLoot === null ? null : { retainedLoot }
  } catch {
    return null
  }
}

export function isDungeonExtractionEvent(value: unknown): value is DungeonExtractionEvent {
  return parseDungeonExtractionEvent(value) !== null
}

function sameLoot(left: readonly RunLoot[], right: readonly RunLoot[]): boolean {
  return left.length === right.length && left.every((item, index) => (
    item.itemId === right[index].itemId && item.amount === right[index].amount
  ))
}

function defaultSeedSource(): number {
  return Math.floor(Math.random() * UINT32_RANGE)
}

function defaultDayKeySource(): string {
  return new Date().toISOString().slice(0, 10)
}

export function createDualModeRuntime(options: DualModeRuntimeOptions) {
  let save = migratePlayerSave(options.initialSave)
  let activeRunId: string | null = null
  let mode: DualMode = 'world'
  let restoreFailed = false
  const seedSource = options.seedSource ?? defaultSeedSource
  const dayKeySource = options.dayKeySource ?? defaultDayKeySource

  const savedActiveRun = save.dungeon.activeRun
  if (savedActiveRun !== null) {
    try {
      const restored = options.dungeon.isReady() && options.dungeon.restore(savedActiveRun.checkpoint)
      const restoredId = restored ? canonicalId(options.dungeon.currentRunId()) : null
      if (restoredId === savedActiveRun.checkpoint.runId) {
        activeRunId = restoredId
        mode = 'dungeon'
      } else {
        restoreFailed = true
      }
    } catch {
      restoreFailed = true
    }
  } else {
    try {
      if (options.dungeon.hasRun()) {
        activeRunId = canonicalId(options.dungeon.currentRunId())
        if (activeRunId) mode = 'dungeon'
      }
    } catch {
      activeRunId = null
    }
  }

  function hasReward(rewardId: string): boolean {
    return save.rewardLedger.some((entry) => entry.trim() === rewardId)
  }

  function didAcceptReward(previous: PlayerSaveV4, next: PlayerSaveV4): boolean {
    return next.rewardLedger.length > previous.rewardLedger.length
  }

  function persist(next: PlayerSaveV4): boolean {
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

  function cancelBegunRun(candidateRunId: string, reason: string): RejectedTransition {
    let cancelled = false
    try {
      cancelled = options.dungeon.cancelRun()
    } catch {
      cancelled = false
    }
    if (cancelled) return { ok: false, reason }
    activeRunId = candidateRunId
    mode = 'dungeon'
    return { ok: false, reason: 'save-persist-rollback-failed' }
  }

  function enterDungeon(seed?: number): DungeonEntryAccepted | RejectedTransition {
    try {
      if (!options.dungeon.isReady()) return { ok: false, reason: 'dungeon-not-ready' }
      if (activeRunId !== null || options.dungeon.hasRun()) return { ok: false, reason: 'run-active' }
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

    let began = false
    try {
      began = options.dungeon.begin(candidate.seed)
    } catch {
      began = false
    }
    if (!began) return { ok: false, reason: 'dungeon-begin-failed' }

    let checkpoint: DungeonRunCheckpoint | null = null
    try {
      checkpoint = cloneCheckpoint(options.dungeon.checkpoint())
    } catch {
      checkpoint = null
    }
    if (checkpoint === null || checkpoint.runId !== candidate.runId) {
      return cancelBegunRun(candidate.runId, 'dungeon-checkpoint-failed')
    }

    let dayKey: string
    try {
      dayKey = dayKeySource()
    } catch {
      return cancelBegunRun(candidate.runId, 'invalid-day-key')
    }
    const entry = consumeDungeonEntry(save, dayKey)
    if (!entry.ok) return cancelBegunRun(candidate.runId, entry.reason)
    entry.save.dungeon.activeRun = { payment: entry.payment, checkpoint }
    if (!persist(entry.save)) return cancelBegunRun(candidate.runId, 'save-persist-failed')

    save = entry.save
    activeRunId = candidate.runId
    mode = 'dungeon'
    restoreFailed = false
    return { ok: true, seed: candidate.seed, runId: candidate.runId, saveChanged: true }
  }

  function handleWorldCleared(payload: unknown): SaveAccepted | RejectedTransition {
    const event = parseWorldClearEvent(payload)
    if (!event) return { ok: false, reason: 'invalid-world-event' }
    const next = applyWorldBossClear(save, event).save
    if (!didAcceptReward(save, next)) return { ok: false, reason: 'world-reward-rejected' }
    if (!persist(next)) return { ok: false, reason: 'save-persist-failed' }
    save = next
    return { ok: true, saveChanged: true }
  }

  function handleDungeonCheckpoint(value: unknown): SaveAccepted | RejectedTransition {
    const checkpoint = cloneCheckpoint(value)
    if (checkpoint === null) return { ok: false, reason: 'invalid-dungeon-checkpoint' }
    const active = save.dungeon.activeRun
    if (active === null || activeRunId === null) return { ok: false, reason: 'no-active-run' }
    if (checkpoint.runId !== activeRunId || checkpoint.profileId !== active.checkpoint.profileId) {
      return { ok: false, reason: 'run-id-mismatch' }
    }
    const next = migratePlayerSave(save)
    next.dungeon.activeRun = { payment: active.payment, checkpoint }
    if (!persist(next)) return { ok: false, reason: 'save-persist-failed' }
    save = next
    return { ok: true, saveChanged: true }
  }

  function settleTerminal(
    expectedType: 'dungeon-defeated' | 'dungeon-abandoned',
    payload: unknown,
  ): TerminalAccepted | RejectedTransition {
    const event = parseTerminalEvent(payload, expectedType)
    if (!event) return { ok: false, reason: 'invalid-terminal-event' }
    if (activeRunId === null || save.dungeon.activeRun === null) return { ok: false, reason: 'no-active-run' }
    const runId = activeRunId
    const next = applyExtractionLoot(save, runId, event.retainedLoot)
    next.dungeon.activeRun = null
    if (!persist(next)) return { ok: false, reason: 'save-persist-failed' }
    save = next
    activeRunId = null
    mode = 'world'
    return { ok: true, runId, saveChanged: true }
  }

  function handleDungeonExtracted(payload: unknown): ExtractionAccepted | RejectedTransition {
    const event = parseDungeonExtractionEvent(payload)
    if (!event) return { ok: false, reason: 'invalid-extraction-event' }
    if (activeRunId === null) return { ok: false, reason: 'no-active-run' }
    if (event.runId !== activeRunId) return { ok: false, reason: 'run-id-mismatch' }

    let authoritativeLoot: RunLoot[] | null
    try {
      if (!options.dungeon.isExtractedRun(event.runId)) return { ok: false, reason: 'run-not-extracted' }
      authoritativeLoot = options.dungeon.extractedLoot(event.runId)
    } catch {
      return { ok: false, reason: 'dungeon-unavailable' }
    }
    if (authoritativeLoot === null || !sameLoot(event.loot, authoritativeLoot)) {
      return { ok: false, reason: 'loot-mismatch' }
    }

    const duplicate = hasReward(event.runId)
    const next = duplicate ? migratePlayerSave(save) : applyExtractionLoot(save, event.runId, authoritativeLoot)
    if (!duplicate && !didAcceptReward(save, next)) return { ok: false, reason: 'extraction-reward-rejected' }
    if (next.dungeon.activeRun !== null) next.dungeon.activeRun = null
    const saveChanged = !duplicate || save.dungeon.activeRun !== null
    if (saveChanged && !persist(next)) return { ok: false, reason: 'save-persist-failed' }
    if (saveChanged) save = next
    activeRunId = null
    mode = 'world'
    return { ok: true, runId: event.runId, duplicate, saveChanged }
  }

  function recoverDungeonRestoreFailure(): SaveAccepted | RejectedTransition {
    const active = save.dungeon.activeRun
    if (!restoreFailed || active === null) return { ok: false, reason: 'no-restore-failure' }
    const refunded = refundDungeonEntry(save, active.payment)
    if (!refunded.ok) return { ok: false, reason: refunded.reason }
    refunded.save.dungeon.activeRun = null
    if (!persist(refunded.save)) return { ok: false, reason: 'save-persist-failed' }
    save = refunded.save
    restoreFailed = false
    activeRunId = null
    mode = 'world'
    return { ok: true, saveChanged: true }
  }

  return {
    enterDungeon,
    handleWorldCleared,
    handleDungeonCheckpoint,
    handleDungeonDefeated: (payload: unknown) => settleTerminal('dungeon-defeated', payload),
    handleDungeonAbandoned: (payload: unknown) => settleTerminal('dungeon-abandoned', payload),
    handleDungeonExtracted,
    recoverDungeonRestoreFailure,
    getMode: () => mode,
    getActiveRunId: () => activeRunId,
    getSaveSnapshot: () => migratePlayerSave(save),
  }
}

export type DualModeRuntime = ReturnType<typeof createDualModeRuntime>
