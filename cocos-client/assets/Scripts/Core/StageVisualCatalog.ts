import type { StageResourcePlan } from './StageResourceRuntime'

export interface StageVisual {
  readonly stageId: number
  readonly backgroundId: string
  readonly theme: string
  readonly farPath: string
  readonly midPath: string | null
  readonly monsterActorIds: readonly string[]
}

const MONSTER_ATLAS_PATHS: Readonly<Record<string, string>> = Object.freeze({
  'moss-wolf': 'Assets/ActorAtlases/MossWolf/atlas',
  'green-wing-moth': 'Assets/ActorAtlases/GreenWingMoth/atlas',
  'bamboo-warden': 'Assets/ActorAtlases/BambooWarden/atlas',
  'fog-spider': 'Assets/ActorAtlases/FogSpider/atlas',
  'lantern-wraith': 'Assets/ActorAtlases/LanternWraith/atlas',
  'mist-deer-king': 'Assets/ActorAtlases/MistDeerKing/atlas',
  'lava-lizard': 'Assets/ActorAtlases/LavaLizard/atlas',
  'ember-crow': 'Assets/ActorAtlases/EmberCrow/atlas',
  'flame-ogre': 'Assets/ActorAtlases/FlameOgre/atlas',
  'star-armored-beast': 'Assets/ActorAtlases/StarArmoredBeast/atlas',
  'void-wing-spirit': 'Assets/ActorAtlases/VoidWingSpirit/atlas',
  'meteor-guardian': 'Assets/ActorAtlases/MeteorGuardian/atlas',
})

const STAGE_VISUALS: Readonly<Record<number, StageVisual>> = Object.freeze({
  1: Object.freeze({
    stageId: 1,
    backgroundId: 'green-hill-bamboo-rain',
    theme: 'mist-bamboo',
    farPath: 'Assets/World/MistBamboo/far/spriteFrame',
    midPath: 'Assets/World/MistBamboo/mid/spriteFrame',
    monsterActorIds: Object.freeze(['moss-wolf', 'green-wing-moth', 'bamboo-warden']),
  }),
  2: Object.freeze({
    stageId: 2,
    backgroundId: 'mist-lantern-forest',
    theme: 'mist-bamboo',
    farPath: 'Assets/World/MistLantern/far/spriteFrame',
    midPath: null,
    monsterActorIds: Object.freeze(['fog-spider', 'lantern-wraith', 'mist-deer-king']),
  }),
  3: Object.freeze({
    stageId: 3,
    backgroundId: 'red-flame-ravine',
    theme: 'flame-cave',
    farPath: 'Assets/World/FlameRavine/far/spriteFrame',
    midPath: null,
    monsterActorIds: Object.freeze(['lava-lizard', 'ember-crow', 'flame-ogre']),
  }),
  4: Object.freeze({
    stageId: 4,
    backgroundId: 'fallen-star-ancient-road',
    theme: 'starlight-ruin',
    farPath: 'Assets/World/StarRoad/far/spriteFrame',
    midPath: null,
    monsterActorIds: Object.freeze(['star-armored-beast', 'void-wing-spirit', 'meteor-guardian']),
  }),
})

export function stageVisualFor(stageId: number): StageVisual {
  const visual = STAGE_VISUALS[stageId]
  if (!visual) throw new Error(`Unknown stage visual: ${stageId}`)
  return visual
}

export function stageResourcePlanFor(stageId: number): StageResourcePlan {
  const visual = stageVisualFor(stageId)
  return Object.freeze({
    stageId,
    assets: Object.freeze([
      Object.freeze({ path: visual.farPath, kind: 'spriteFrame' as const }),
      ...(visual.midPath ? [Object.freeze({ path: visual.midPath, kind: 'spriteFrame' as const })] : []),
      ...visual.monsterActorIds.map((actorId) => Object.freeze({
        path: MONSTER_ATLAS_PATHS[actorId],
        kind: 'texture' as const,
      })),
    ]),
  })
}

export function planBackgroundRelease(previous: StageVisual | null, current: StageVisual | null): string[] {
  if (!previous) return []
  const currentPaths = new Set(current ? [current.farPath, current.midPath].filter(Boolean) : [])
  return [...new Set([previous.farPath, previous.midPath].filter(Boolean) as string[])]
    .filter((path) => !currentPaths.has(path))
}

function isSameVisual(left: StageVisual | null, right: StageVisual | null) {
  return Boolean(left && right && left.farPath === right.farPath && left.midPath === right.midPath)
}

export function planBackgroundRequest(
  active: StageVisual | null,
  requested: StageVisual | null,
  next: StageVisual,
): 'ignore' | 'cancel' | 'load' {
  if (isSameVisual(requested, next)) return 'ignore'
  if (isSameVisual(active, next)) return 'cancel'
  return 'load'
}
