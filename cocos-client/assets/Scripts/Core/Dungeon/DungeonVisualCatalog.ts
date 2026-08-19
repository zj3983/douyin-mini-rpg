export type MistVaultFloor = 1 | 2 | 3

export interface DungeonFloorVisual {
  readonly dungeonId: 'mist-vault'
  readonly floor: MistVaultFloor
  readonly farPath: string
  readonly midPath: string
  readonly monsterActorIds: readonly string[]
}

const ACTOR_ATLAS_PATHS: Readonly<Record<string, readonly string[]>> = deepFreeze({
  'moss-wolf': [
    'Assets/ActorAtlases/MossWolf/idle/texture',
    'Assets/ActorAtlases/MossWolf/move/texture',
    'Assets/ActorAtlases/MossWolf/telegraph/texture',
    'Assets/ActorAtlases/MossWolf/attack/texture',
    'Assets/ActorAtlases/MossWolf/hurt/texture',
    'Assets/ActorAtlases/MossWolf/death/texture',
  ],
  'green-wing-moth': [
    'Assets/ActorAtlases/GreenWingMoth/idle/texture',
    'Assets/ActorAtlases/GreenWingMoth/move/texture',
    'Assets/ActorAtlases/GreenWingMoth/dive/texture',
    'Assets/ActorAtlases/GreenWingMoth/cast/texture',
    'Assets/ActorAtlases/GreenWingMoth/hurt/texture',
    'Assets/ActorAtlases/GreenWingMoth/death/texture',
  ],
  'fog-spider': ['Assets/ActorAtlases/FogSpider/atlas/texture'],
  'lantern-wraith': ['Assets/ActorAtlases/LanternWraith/atlas/texture'],
  'mist-deer-king': ['Assets/ActorAtlases/MistDeerKing/atlas/texture'],
  'mist-bamboo-emperor': ['Assets/ActorAtlases/MistBambooEmperor/atlas/texture'],
})

export const DUNGEON_EFFECT_PATHS = deepFreeze([
  'Assets/Dungeon/MistBamboo/Effects/pursuit_edge/spriteFrame',
  'Assets/Dungeon/MistBamboo/Effects/extraction_array/spriteFrame',
] as const)

export const DUNGEON_AUDIO_PATHS = deepFreeze([
  'Assets/Audio/Bgm/mist-bamboo',
  'Assets/Audio/Cues/pursuit-warning',
  'Assets/Audio/Cues/extraction-start',
  'Assets/Audio/Cues/extraction-complete',
] as const)

const FLOOR_VISUALS: Readonly<Record<MistVaultFloor, DungeonFloorVisual>> = createCatalog([
  {
    dungeonId: 'mist-vault',
    floor: 1,
    farPath: 'Assets/Dungeon/MistBamboo/Floor1/far/spriteFrame',
    midPath: 'Assets/Dungeon/MistBamboo/Floor1/mid/spriteFrame',
    monsterActorIds: ['moss-wolf', 'green-wing-moth'],
  },
  {
    dungeonId: 'mist-vault',
    floor: 2,
    farPath: 'Assets/Dungeon/MistBamboo/Floor2/far/spriteFrame',
    midPath: 'Assets/Dungeon/MistBamboo/Floor2/mid/spriteFrame',
    monsterActorIds: ['fog-spider', 'lantern-wraith', 'moss-wolf'],
  },
  {
    dungeonId: 'mist-vault',
    floor: 3,
    farPath: 'Assets/Dungeon/MistBamboo/Floor3/far/spriteFrame',
    midPath: 'Assets/Dungeon/MistBamboo/Floor3/mid/spriteFrame',
    monsterActorIds: ['fog-spider', 'lantern-wraith', 'mist-deer-king', 'mist-bamboo-emperor'],
  },
])

export function dungeonFloorVisualFor(dungeonId: string, floor: number): DungeonFloorVisual {
  if (dungeonId !== 'mist-vault') throw new Error(`Unknown dungeon visual: ${dungeonId}`)
  if (floor !== 1 && floor !== 2 && floor !== 3) throw new RangeError(`Unknown dungeon floor: ${floor}`)
  return FLOOR_VISUALS[floor]
}

export function dungeonActorAtlasPaths(actorId: string): readonly string[] {
  const paths = ACTOR_ATLAS_PATHS[actorId]
  if (!paths) throw new Error(`Unknown dungeon actor: ${actorId}`)
  return paths
}

function createCatalog(entries: DungeonFloorVisual[]): Readonly<Record<MistVaultFloor, DungeonFloorVisual>> {
  if (entries.length !== 3) throw new Error('Mist vault requires exactly three floor visuals.')
  const floors = new Set<number>()
  const farPaths = new Set<string>()
  const midPaths = new Set<string>()
  const output = {} as Record<MistVaultFloor, DungeonFloorVisual>

  for (const entry of entries) {
    if (entry.dungeonId !== 'mist-vault') throw new Error('Dungeon visual ID must be mist-vault.')
    if (entry.floor !== 1 && entry.floor !== 2 && entry.floor !== 3) throw new RangeError('Dungeon floor must be 1, 2, or 3.')
    if (floors.has(entry.floor)) throw new Error(`Duplicate dungeon floor: ${entry.floor}`)
    if (!/^Assets\/Dungeon\/MistBamboo\/Floor[123]\/far\/spriteFrame$/.test(entry.farPath)) {
      throw new Error(`Invalid far path for floor ${entry.floor}.`)
    }
    if (!/^Assets\/Dungeon\/MistBamboo\/Floor[123]\/mid\/spriteFrame$/.test(entry.midPath)) {
      throw new Error(`Invalid mid path for floor ${entry.floor}.`)
    }
    if (farPaths.has(entry.farPath) || midPaths.has(entry.midPath)) throw new Error('Dungeon background paths must be distinct.')
    if (entry.monsterActorIds.length === 0 || new Set(entry.monsterActorIds).size !== entry.monsterActorIds.length) {
      throw new Error(`Floor ${entry.floor} requires a unique monster roster.`)
    }
    entry.monsterActorIds.forEach(dungeonActorAtlasPaths)
    floors.add(entry.floor)
    farPaths.add(entry.farPath)
    midPaths.add(entry.midPath)
    output[entry.floor] = deepFreeze({ ...entry, monsterActorIds: [...entry.monsterActorIds] })
  }

  return deepFreeze(output)
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested)
  }
  return value
}
