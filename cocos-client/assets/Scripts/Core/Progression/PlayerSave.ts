import type { ArtifactId, PlayerLoadout, RelicId } from '../GameContent.ts'
import type { RunLoot } from '../Dungeon/DungeonTypes.ts'
import { validateLoadout } from '../Loadout/LoadoutRules.ts'

export interface PlayerSaveV3 {
  version: 3
  spiritStones: number
  character: {
    id: 'qinglan'
    realm: 'qi-refining'
    innateSkillId: 'flying-sword-art'
  }
  world: {
    highestClearedStage: number
    claimedFirstClears: number[]
  }
  inventory: {
    dungeonPasses: number
    artifacts: Partial<Record<ArtifactId, number>>
    relics: Partial<Record<RelicId, number>>
    materials: Record<string, number>
  }
  loadout: PlayerLoadout
  rewardLedger: string[]
}

const ARTIFACT_IDS = new Set<ArtifactId>([
  'flying-sword',
  'thunder-seal',
  'soul-bell',
  'flame-ruler',
])

const RELIC_IDS = new Set<RelicId>(['soul-magnet', 'jade-guard', 'spirit-vessel'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonnegativeFinite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback
}

function nonnegativeInteger(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
  const integer = Math.floor(value)
  return Number.isSafeInteger(integer) ? integer : null
}

function numberRecord(
  value: unknown,
  allowedKeys?: ReadonlySet<string>,
): Record<string, number> {
  if (!isRecord(value)) return {}

  const result: Record<string, number> = {}
  for (const key of Object.keys(value)) {
    const count = value[key]
    if (
      (!allowedKeys || allowedKeys.has(key))
      && typeof count === 'number'
      && Number.isFinite(count)
      && count >= 0
    ) {
      result[key] = Math.floor(count)
    }
  }
  return result
}

function contentIds<T extends string>(value: unknown, allowedIds: ReadonlySet<T>): T[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is T => typeof entry === 'string' && allowedIds.has(entry as T))
}

function legalLoadout(value: Record<string, unknown>): PlayerLoadout {
  const result: PlayerLoadout = { active: [], relics: [] }

  for (const artifactId of contentIds(value.active, ARTIFACT_IDS)) {
    const candidate = { active: [...result.active, artifactId], relics: result.relics }
    if (validateLoadout(candidate).ok) result.active.push(artifactId)
  }

  for (const relicId of contentIds(value.relics, RELIC_IDS)) {
    const candidate = { active: result.active, relics: [...result.relics, relicId] }
    if (validateLoadout(candidate).ok) result.relics.push(relicId)
  }

  return result
}

export function createDefaultSave(): PlayerSaveV3 {
  return {
    version: 3,
    spiritStones: 0,
    character: {
      id: 'qinglan',
      realm: 'qi-refining',
      innateSkillId: 'flying-sword-art',
    },
    world: {
      highestClearedStage: 0,
      claimedFirstClears: [],
    },
    inventory: {
      dungeonPasses: 0,
      artifacts: {},
      relics: {},
      materials: {},
    },
    loadout: {
      active: [],
      relics: [],
    },
    rewardLedger: [],
  }
}

export function migratePlayerSave(input: unknown): PlayerSaveV3 {
  const defaults = createDefaultSave()
  if (!isRecord(input)) return defaults

  const world = isRecord(input.world) ? input.world : {}
  const inventory = isRecord(input.inventory) ? input.inventory : {}
  const loadout = isRecord(input.loadout) ? input.loadout : {}
  const highestClearedStage = nonnegativeInteger(world.highestClearedStage)
    ?? nonnegativeInteger(input.stage)
    ?? 0

  return {
    ...defaults,
    spiritStones: nonnegativeFinite(input.spiritStones),
    world: {
      highestClearedStage,
      claimedFirstClears: Array.isArray(world.claimedFirstClears)
        ? world.claimedFirstClears.filter((entry): entry is number =>
          typeof entry === 'number' && Number.isFinite(entry) && entry >= 0).map(Math.floor)
        : [],
    },
    inventory: {
      dungeonPasses: nonnegativeInteger(inventory.dungeonPasses) ?? 0,
      artifacts: numberRecord(inventory.artifacts, ARTIFACT_IDS),
      relics: numberRecord(inventory.relics, RELIC_IDS),
      materials: numberRecord(inventory.materials),
    },
    loadout: legalLoadout(loadout),
    rewardLedger: Array.isArray(input.rewardLedger)
      ? input.rewardLedger.filter((entry): entry is string => typeof entry === 'string')
      : [],
  }
}

export function consumeDungeonPass(
  current: PlayerSaveV3,
): { ok: true; save: PlayerSaveV3 } | { ok: false; save: PlayerSaveV3 } {
  const save = migratePlayerSave(current)
  if (
    !Number.isSafeInteger(current.inventory.dungeonPasses)
    || current.inventory.dungeonPasses <= 0
  ) {
    return { ok: false, save }
  }

  save.inventory.dungeonPasses -= 1
  return { ok: true, save }
}

interface CanonicalLoot {
  itemId: string
  amount: number
}

function canonicalRewardId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const rewardId = value.trim()
  return rewardId === '' ? null : rewardId
}

function canonicalLoot(value: unknown): CanonicalLoot[] | null {
  if (!Array.isArray(value)) return null

  const result: CanonicalLoot[] = []
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.itemId !== 'string') return null

    const itemId = entry.itemId.trim()
    const amount = entry.amount
    if (
      itemId === ''
      || typeof amount !== 'number'
      || !Number.isFinite(amount)
      || !Number.isInteger(amount)
      || amount <= 0
    ) {
      return null
    }
    result.push({ itemId, amount })
  }
  return result
}

function addLootCount(counts: Record<string, number>, item: CanonicalLoot): boolean {
  const next = (counts[item.itemId] ?? 0) + item.amount
  if (!Number.isSafeInteger(next)) return false
  counts[item.itemId] = next
  return true
}

function canApplyCounts(
  current: Record<string, number>,
  additions: Record<string, number>,
): boolean {
  return Object.keys(additions).every((itemId) =>
    Number.isSafeInteger((current[itemId] ?? 0) + additions[itemId]))
}

function applyCounts(current: Record<string, number>, additions: Record<string, number>): void {
  for (const itemId of Object.keys(additions)) {
    current[itemId] = (current[itemId] ?? 0) + additions[itemId]
  }
}

export function applyExtractionLoot(
  current: PlayerSaveV3,
  rewardId: string,
  loot: RunLoot[],
): PlayerSaveV3 {
  const save = migratePlayerSave(current)
  const canonicalId = canonicalRewardId(rewardId)
  const canonicalItems = canonicalLoot(loot)
  if (canonicalId === null || canonicalItems === null) return save
  if (save.rewardLedger.some((entry) => entry.trim() === canonicalId)) return save

  const artifacts: Record<string, number> = {}
  const relics: Record<string, number> = {}
  const materials: Record<string, number> = {}

  for (const item of canonicalItems) {
    const additions = ARTIFACT_IDS.has(item.itemId as ArtifactId)
      ? artifacts
      : RELIC_IDS.has(item.itemId as RelicId)
        ? relics
        : materials
    if (!addLootCount(additions, item)) return save
  }

  if (
    !canApplyCounts(save.inventory.artifacts, artifacts)
    || !canApplyCounts(save.inventory.relics, relics)
    || !canApplyCounts(save.inventory.materials, materials)
  ) {
    return save
  }

  applyCounts(save.inventory.artifacts, artifacts)
  applyCounts(save.inventory.relics, relics)
  applyCounts(save.inventory.materials, materials)
  save.rewardLedger.push(canonicalId)
  return save
}
