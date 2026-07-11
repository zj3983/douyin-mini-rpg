export function createVisualResetState() {
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

export function resetVisualForSpawn(state, identity) {
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

export function prepareVisualForPool(state) {
  return {
    ...resetVisualForSpawn(state, { actorId: null, facing: -1 }),
    listenersBound: false,
  }
}

export function beginAnimationLoad(state, actorId, action) {
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

export function acceptAnimationLoad(state, token) {
  return state.loadGeneration === token.generation
    && state.actorId === token.actorId
    && state.action === token.action
}

export function bindVisualListeners(state) {
  if (state.listenersBound) return { state, bound: false }
  return { state: { ...state, listenersBound: true }, bound: true }
}
