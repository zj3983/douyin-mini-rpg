import type { ArtifactId, PlayerLoadout, RelicId } from '../GameContent.ts'
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
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : null
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
