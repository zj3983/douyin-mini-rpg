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
    active: false,
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
    active: true,
    loadGeneration: state.loadGeneration + 1,
  }
}

export function prepareVisualForPool(state) {
  return {
    ...resetVisualForSpawn(state, { actorId: null, facing: -1 }),
    listenersBound: false,
    active: false,
  }
}

export function beginManifestLoad(state) {
  return { generation: state.loadGeneration, actorId: state.actorId }
}

export function acceptManifestLoad(state, token) {
  return state.active
    && state.loadGeneration === token.generation
    && state.actorId === token.actorId
}

export function setVisualActionState(state, action) {
  return {
    ...state,
    action,
    frameIndex: 0,
    defeated: action === 'death' ? true : state.defeated,
    hit: action === 'hurt',
    attacking: action === 'attack',
  }
}

export function setVisualFacing(state, facing) {
  return { ...state, facing }
}

export function visualResetCommands(state) {
  return {
    position: { ...state.localPosition },
    scale: { x: state.localScale.x * -state.facing, y: state.localScale.y, z: state.localScale.z },
    rotation: { ...state.rotation },
    color: { ...state.color, a: Math.min(state.color.a, state.opacity) },
    actorId: state.actorId,
    action: state.action,
    frameIndex: state.frameIndex,
    defeated: state.defeated,
    hit: state.hit,
    attacking: state.attacking,
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
