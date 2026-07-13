const monsterAtlasPaths = Object.freeze({
  'moss-wolf': 'Assets/ActorAtlases/MossWolf/atlas/texture',
  'green-wing-moth': 'Assets/ActorAtlases/GreenWingMoth/atlas/texture',
  'bamboo-warden': 'Assets/ActorAtlases/BambooWarden/atlas/texture',
  'fog-spider': 'Assets/ActorAtlases/FogSpider/atlas/texture',
  'lantern-wraith': 'Assets/ActorAtlases/LanternWraith/atlas/texture',
  'mist-deer-king': 'Assets/ActorAtlases/MistDeerKing/atlas/texture',
  'lava-lizard': 'Assets/ActorAtlases/LavaLizard/atlas/texture',
  'ember-crow': 'Assets/ActorAtlases/EmberCrow/atlas/texture',
  'flame-ogre': 'Assets/ActorAtlases/FlameOgre/atlas/texture',
  'star-armored-beast': 'Assets/ActorAtlases/StarArmoredBeast/atlas/texture',
  'void-wing-spirit': 'Assets/ActorAtlases/VoidWingSpirit/atlas/texture',
  'meteor-guardian': 'Assets/ActorAtlases/MeteorGuardian/atlas/texture',
})

const stageVisuals = Object.freeze({
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

export function stageVisualFor(stageId) {
  const visual = stageVisuals[stageId]
  if (!visual) throw new Error(`Unknown stage visual: ${stageId}`)
  return visual
}

export function stageResourcePlanFor(stageId) {
  const visual = stageVisualFor(stageId)
  return Object.freeze({
    stageId,
    assets: Object.freeze([
      Object.freeze({ path: visual.farPath, kind: 'spriteFrame' }),
      ...(visual.midPath ? [Object.freeze({ path: visual.midPath, kind: 'spriteFrame' })] : []),
      ...visual.monsterActorIds.map((actorId) => Object.freeze({
        path: monsterAtlasPaths[actorId],
        kind: 'texture',
      })),
    ]),
  })
}

export function planBackgroundRelease(previous, current) {
  if (!previous) return []
  const currentPaths = new Set(current ? [current.farPath, current.midPath].filter(Boolean) : [])
  return [...new Set([previous.farPath, previous.midPath].filter(Boolean))]
    .filter((path) => !currentPaths.has(path))
}

function isSameVisual(left, right) {
  return Boolean(left && right && left.farPath === right.farPath && left.midPath === right.midPath)
}

export function planBackgroundRequest(active, requested, next) {
  if (isSameVisual(requested, next)) return 'ignore'
  if (isSameVisual(active, next)) return 'cancel'
  return 'load'
}
