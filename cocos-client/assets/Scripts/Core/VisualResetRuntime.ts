export interface VisualResetState {
  localPosition: { x: number; y: number; z: number }
  localScale: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  opacity: number
  color: { r: number; g: number; b: number; a: number }
  facing: -1 | 1
  actorId: string | null
  action: string
  frameIndex: number
  defeated: boolean
  hit: boolean
  attacking: boolean
  playing: boolean
  listenersBound: boolean
  loadGeneration: number
}

export interface AnimationLoadToken {
  generation: number
  actorId: string
  action: string
}

export function createVisualResetState(): VisualResetState {
  return resetVisualForSpawn({
    localPosition: { x: 0, y: 0, z: 0 },
    localScale: { x: 1, y: 1, z: 1 },
    rotation: { x: 0, y: 0, z: 0 },
    opacity: 255,
    color: { r: 255, g: 255, b: 255, a: 255 },
    facing: -1,
    actorId: null,
    action: 'move',
    frameIndex: 0,
    defeated: false,
    hit: false,
    attacking: false,
    playing: false,
    listenersBound: false,
    loadGeneration: 0,
  }, { actorId: null, facing: -1 })
}

export function resetVisualForSpawn(
  state: VisualResetState,
  identity: { actorId: string | null; facing: -1 | 1 },
): VisualResetState {
  return {
    ...state,
    localPosition: { x: 0, y: 0, z: 0 },
    localScale: { x: 1, y: 1, z: 1 },
    rotation: { x: 0, y: 0, z: 0 },
    opacity: 255,
    color: { r: 255, g: 255, b: 255, a: 255 },
    facing: identity.facing,
    actorId: identity.actorId,
    action: 'move',
    frameIndex: 0,
    defeated: false,
    hit: false,
    attacking: false,
    playing: false,
    loadGeneration: state.loadGeneration + 1,
  }
}

export function prepareVisualForPool(state: VisualResetState): VisualResetState {
  return {
    ...resetVisualForSpawn(state, { actorId: null, facing: -1 }),
    listenersBound: false,
  }
}

export function beginAnimationLoad(state: VisualResetState, actorId: string, action: string) {
  const next = {
    ...state,
    actorId,
    action,
    frameIndex: 0,
    playing: false,
    loadGeneration: state.loadGeneration + 1,
  }
  return {
    state: next,
    token: { generation: next.loadGeneration, actorId, action },
  }
}

export function acceptAnimationLoad(state: VisualResetState, token: AnimationLoadToken) {
  return state.loadGeneration === token.generation
    && state.actorId === token.actorId
    && state.action === token.action
}

export function bindVisualListeners(state: VisualResetState) {
  if (state.listenersBound) return { state, bound: false }
  return { state: { ...state, listenersBound: true }, bound: true }
}
