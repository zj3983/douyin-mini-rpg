export interface AtlasFrameRect {
  x: number
  y: number
  w: number
  h: number
}

export interface AtlasAction {
  name: string
  atlas: string
  fps: number
  loop: boolean
  order: number[]
  frames: AtlasFrameRect[]
}

export interface ActorAtlas {
  id: string
  type: 'character' | 'monster'
  atlas: string
  frameSize: {
    w: number
    h: number
  }
  actions: AtlasAction[]
}

export interface AnimationAtlasManifest {
  version: number
  framePacking: 'single-atlas-per-actor'
  actors: ActorAtlas[]
}

export function findActorAtlas(manifest: AnimationAtlasManifest, actorId: string): ActorAtlas {
  const actor = manifest.actors.find((entry) => entry.id === actorId)
  if (!actor) {
    throw new Error(`Unknown actor atlas: ${actorId}`)
  }
  return actor
}

export function findAtlasAction(actor: ActorAtlas, actionName: string): AtlasAction {
  const action = actor.actions.find((entry) => entry.name === actionName)
  if (!action) {
    throw new Error(`Unknown atlas action: ${actor.id}.${actionName}`)
  }
  return action
}
