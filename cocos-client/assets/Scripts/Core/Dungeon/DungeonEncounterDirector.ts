import type { EnemyProfile } from '../CultivationTypes.ts'

export type DungeonBattleCompletion = 'clear-room' | 'repel' | 'kill'

export interface DungeonBattleRequest {
  id: string
  seed: number
  enemies: EnemyProfile[]
  defeatTarget: number
  maxAlive: number
  boss: EnemyProfile | null
  completion: DungeonBattleCompletion
}

export interface DungeonBattleResult {
  requestId: string
  completion: DungeonBattleCompletion
  defeatedEnemyIds: number[]
}

export interface DungeonEncounterLoot {
  itemId: string
  amount: number
}

export interface DungeonEncounterEntry {
  id: string
  roomId: string
  seedSalt: number
  enemies: EnemyProfile[]
  defeatTarget: number
  maxAlive: number
  completion: 'clear-room' | 'kill'
  loot: DungeonEncounterLoot[]
}

export interface DungeonPursuitEntry {
  id: string
  seed: number
  boss: EnemyProfile
  maxAlive: number
  loot: DungeonEncounterLoot[]
}

export interface DungeonEncounterCatalog {
  id: string
  encounters: DungeonEncounterEntry[]
  pursuit: DungeonPursuitEntry
}

const UINT32_MAX = 0xffffffff
const ENEMY_ROLES = new Set(['ground', 'flying', 'boss'])

function canonicalId(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
    throw new TypeError(`${label} must be a canonical ID.`)
  }
}

function positiveSafeInteger(value: unknown, label: string, maximum = Number.MAX_SAFE_INTEGER): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0 || (value as number) > maximum) {
    throw new RangeError(`${label} must be a positive safe integer no greater than ${maximum}.`)
  }
}

function uint32(value: unknown, label: string): asserts value is number {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > UINT32_MAX) {
    throw new RangeError(`${label} must be a uint32.`)
  }
}

function validateEnemy(enemy: unknown, label: string): asserts enemy is EnemyProfile {
  if (!enemy || typeof enemy !== 'object') throw new TypeError(`${label} must be an enemy profile.`)
  const profile = enemy as Partial<EnemyProfile>
  canonicalId(profile.id, `${label}.id`)
  if (typeof profile.name !== 'string' || profile.name.trim().length === 0) {
    throw new TypeError(`${label}.name must not be blank.`)
  }
  if (!ENEMY_ROLES.has(profile.role as string)) throw new TypeError(`${label}.role is invalid.`)
  if (typeof profile.theme !== 'string' || profile.theme.trim().length === 0) {
    throw new TypeError(`${label}.theme must not be blank.`)
  }
}

function validateLoot(loot: unknown, label: string): asserts loot is DungeonEncounterLoot[] {
  if (!Array.isArray(loot) || loot.length === 0) throw new TypeError(`${label} must contain loot.`)
  const ids = new Set<string>()
  for (const [index, item] of loot.entries()) {
    if (!item || typeof item !== 'object') throw new TypeError(`${label}[${index}] must be loot.`)
    const entry = item as Partial<DungeonEncounterLoot>
    canonicalId(entry.itemId, `${label}[${index}].itemId`)
    if (ids.has(entry.itemId)) throw new Error(`${label} contains duplicate item ID ${entry.itemId}.`)
    ids.add(entry.itemId)
    positiveSafeInteger(entry.amount, `${label}[${index}].amount`, 999)
  }
}

export function validateDungeonEncounterCatalog(catalog: unknown): asserts catalog is DungeonEncounterCatalog {
  if (!catalog || typeof catalog !== 'object') throw new TypeError('Encounter catalog is required.')
  const value = catalog as Partial<DungeonEncounterCatalog>
  canonicalId(value.id, 'catalog.id')
  if (!Array.isArray(value.encounters) || value.encounters.length === 0) {
    throw new TypeError('catalog.encounters must not be empty.')
  }

  const roomIds = new Set<string>()
  const encounterIds = new Set<string>()
  for (const [index, encounter] of value.encounters.entries()) {
    if (!encounter || typeof encounter !== 'object') throw new TypeError(`encounters[${index}] is invalid.`)
    canonicalId(encounter.id, `encounters[${index}].id`)
    canonicalId(encounter.roomId, `encounters[${index}].roomId`)
    if (roomIds.has(encounter.roomId)) throw new Error(`Duplicate room ${encounter.roomId}.`)
    if (encounterIds.has(encounter.id)) throw new Error(`Duplicate encounter ${encounter.id}.`)
    roomIds.add(encounter.roomId)
    encounterIds.add(encounter.id)
    uint32(encounter.seedSalt, `encounters[${index}].seedSalt`)
    positiveSafeInteger(encounter.defeatTarget, `encounters[${index}].defeatTarget`)
    positiveSafeInteger(encounter.maxAlive, `encounters[${index}].maxAlive`, 18)
    if (encounter.completion !== 'clear-room' && encounter.completion !== 'kill') {
      throw new TypeError(`encounters[${index}].completion is invalid.`)
    }
    if (!Array.isArray(encounter.enemies) || encounter.enemies.length === 0) {
      throw new TypeError(`encounters[${index}].enemies must not be empty.`)
    }
    encounter.enemies.forEach((enemy, enemyIndex) => validateEnemy(enemy, `encounters[${index}].enemies[${enemyIndex}]`))
    const bossCount = encounter.enemies.filter((enemy) => enemy.role === 'boss').length
    if (encounter.completion === 'kill' ? bossCount !== 1 || encounter.enemies.length !== 1 : bossCount !== 0) {
      throw new Error(`encounters[${index}] actor roles do not match completion.`)
    }
    validateLoot(encounter.loot, `encounters[${index}].loot`)
  }

  if (!value.pursuit || typeof value.pursuit !== 'object') throw new TypeError('catalog.pursuit is required.')
  canonicalId(value.pursuit.id, 'catalog.pursuit.id')
  uint32(value.pursuit.seed, 'catalog.pursuit.seed')
  validateEnemy(value.pursuit.boss, 'catalog.pursuit.boss')
  if (value.pursuit.boss.role !== 'boss' || value.pursuit.boss.id !== 'mist-bamboo-emperor') {
    throw new Error('Pursuit boss actor must be mist-bamboo-emperor.')
  }
  positiveSafeInteger(value.pursuit.maxAlive, 'catalog.pursuit.maxAlive', 18)
  validateLoot(value.pursuit.loot, 'catalog.pursuit.loot')
}

function cloneEnemy(enemy: EnemyProfile): EnemyProfile {
  return { id: enemy.id, name: enemy.name, role: enemy.role, theme: enemy.theme }
}

function mixSeed(seed: number): number {
  let value = seed >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d)
  value ^= value >>> 15
  value = Math.imul(value, 0x846ca68b)
  value ^= value >>> 16
  return value >>> 0
}

function rotatedEnemies(enemies: EnemyProfile[], seed: number): EnemyProfile[] {
  if (enemies.length <= 1) return enemies.map(cloneEnemy)
  const offset = mixSeed(seed) % enemies.length
  return enemies.map((_, index) => cloneEnemy(enemies[(index + offset) % enemies.length]))
}

export function planDungeonEncounter(
  catalog: DungeonEncounterCatalog,
  roomId: string,
  seed: number,
): DungeonBattleRequest {
  validateDungeonEncounterCatalog(catalog)
  canonicalId(roomId, 'roomId')
  uint32(seed, 'seed')
  const encounter = catalog.encounters.find((entry) => entry.roomId === roomId)
  if (!encounter) throw new Error(`Unknown room ${roomId}.`)
  const mixedSeed = mixSeed((seed ^ encounter.seedSalt) >>> 0)
  const boss = encounter.completion === 'kill' ? cloneEnemy(encounter.enemies[0]) : null
  return {
    id: `${encounter.id}:${seed}`,
    seed,
    enemies: boss ? [] : rotatedEnemies(encounter.enemies, mixedSeed),
    defeatTarget: encounter.defeatTarget,
    maxAlive: encounter.maxAlive,
    boss,
    completion: encounter.completion,
  }
}

export function planPursuitEncounter(catalog: DungeonEncounterCatalog, hunt: 1 | 2 | 3): DungeonBattleRequest {
  validateDungeonEncounterCatalog(catalog)
  if (hunt !== 1 && hunt !== 2 && hunt !== 3) throw new RangeError('hunt must be 1, 2, or 3.')
  return {
    id: `${catalog.pursuit.id}:${hunt}`,
    seed: mixSeed((catalog.pursuit.seed ^ hunt) >>> 0),
    enemies: [],
    defeatTarget: 1,
    maxAlive: catalog.pursuit.maxAlive,
    boss: cloneEnemy(catalog.pursuit.boss),
    completion: hunt === 3 ? 'kill' : 'repel',
  }
}
