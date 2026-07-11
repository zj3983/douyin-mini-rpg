export function clampBattleTarget(point, bounds) {
  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, point.x)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY, point.y)),
  }
}

export function createPlayerMovementState(spawnPosition) {
  return {
    spawnPosition: { ...spawnPosition },
    target: null,
    movementEnabled: true,
  }
}

export function requestPlayerMovement(state, target) {
  if (!state.movementEnabled || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return false
  state.target = { ...target }
  return true
}

export function stopPlayerMovement(state) {
  state.target = null
  state.movementEnabled = false
}

export function resetPlayerMovement(state) {
  state.target = null
  state.movementEnabled = true
  return { ...state.spawnPosition }
}

export function stepTowardTarget(current, target, speed, deltaTime) {
  if (
    !Number.isFinite(current.x) || !Number.isFinite(current.y) ||
    !Number.isFinite(target.x) || !Number.isFinite(target.y) ||
    !Number.isFinite(speed) || speed <= 0 ||
    !Number.isFinite(deltaTime) || deltaTime <= 0
  ) return { position: { ...current }, distanceMoved: 0, arrived: false }
  const dx = target.x - current.x
  const dy = target.y - current.y
  const distance = Math.hypot(dx, dy)
  if (distance === 0) return { position: { ...current }, distanceMoved: 0, arrived: true }
  const step = Math.min(distance, Math.max(0, speed * deltaTime))
  return {
    position: { x: current.x + dx / distance * step, y: current.y + dy / distance * step },
    distanceMoved: step,
    arrived: step >= distance,
  }
}

export const MAX_MOVEMENT_SUBSTEP = 1 / 60
export const MAX_MOVEMENT_FRAME_DELTA = 0.25

export function advancePlayerMovement(state, current, speed, deltaTime) {
  const finiteCurrent = {
    x: Number.isFinite(current.x) ? current.x : 0,
    y: Number.isFinite(current.y) ? current.y : 0,
  }
  const stationary = { position: finiteCurrent, distanceMoved: 0, arrived: false, substeps: 0 }
  if (!state.movementEnabled || !state.target) return stationary
  if (!Number.isFinite(deltaTime) || deltaTime <= 0) return stationary
  if (!Number.isFinite(current.x) || !Number.isFinite(current.y)) return stationary

  const acceptedDelta = Math.min(deltaTime, MAX_MOVEMENT_FRAME_DELTA)
  const substeps = Math.max(1, Math.ceil(acceptedDelta / MAX_MOVEMENT_SUBSTEP - 1e-12))
  const substepDelta = acceptedDelta / substeps
  let position = { ...current }
  let distanceMoved = 0

  for (let index = 0; index < substeps; index += 1) {
    const step = stepTowardTarget(position, state.target, speed, substepDelta)
    position = step.position
    distanceMoved += step.distanceMoved
    if (step.arrived) {
      state.target = null
      return { position, distanceMoved, arrived: true, substeps: index + 1 }
    }
  }

  return { position, distanceMoved, arrived: false, substeps }
}

export function createPlayerPresentationState(hoverBaseY = 0) {
  return {
    moving: false,
    hoverElapsed: 0,
    hoverBaseY,
    activeAction: null,
    actionLockRemaining: 0,
    actionJustAccepted: false,
    pendingSwordRide: false,
  }
}

export function resetPlayerPresentationState(state) {
  state.moving = false
  state.hoverElapsed = 0
  state.activeAction = null
  state.actionLockRemaining = 0
  state.actionJustAccepted = false
  state.pendingSwordRide = false
}

const ACTION_PRIORITY = { sword_ride: 0, hand_seal: 2, flying_sword_cast: 2, hurt: 3, death: 4 }
const ACTION_LOCK = { sword_ride: 0, hand_seal: 0.22, flying_sword_cast: 0.25, hurt: 0.2, death: Infinity }

export function advancePlayerControllerFrame(movementState, presentationState, current, speed, deltaTime) {
  const validDelta = Number.isFinite(deltaTime) && deltaTime > 0
    ? Math.min(deltaTime, MAX_MOVEMENT_FRAME_DELTA)
    : 0
  presentationState.hoverElapsed += validDelta
  if (!presentationState.actionJustAccepted && Number.isFinite(presentationState.actionLockRemaining)) {
    presentationState.actionLockRemaining = Math.max(0, presentationState.actionLockRemaining - validDelta)
    if (presentationState.actionLockRemaining === 0) presentationState.activeAction = null
  }
  const movement = advancePlayerMovement(movementState, current, speed, deltaTime)
  const emitMove = movement.distanceMoved > 0
  const motionChanges = []

  if (emitMove && !presentationState.moving) {
    presentationState.moving = true
    motionChanges.push(true)
  }
  if (movement.arrived && presentationState.moving) {
    presentationState.moving = false
    motionChanges.push(false)
  }
  if (movement.arrived) presentationState.pendingSwordRide = true

  let action = null
  if (presentationState.pendingSwordRide && presentationState.actionLockRemaining === 0) {
    presentationState.pendingSwordRide = false
    presentationState.activeAction = 'sword_ride'
    action = 'sword_ride'
  }
  presentationState.actionJustAccepted = false

  return {
    ...movement,
    emitMove,
    motionChanges,
    action,
    hoverY: presentationState.hoverBaseY + Math.sin(presentationState.hoverElapsed * 4) * 2,
  }
}

export function applyPlayerActionEvent(movementState, presentationState, current, action) {
  const priority = ACTION_PRIORITY[action] ?? 1
  const activePriority = ACTION_PRIORITY[presentationState.activeAction] ?? -1
  const locked = presentationState.actionLockRemaining > 0
  const accepted = !locked || priority >= activePriority
  if (accepted) {
    presentationState.activeAction = action
    presentationState.actionLockRemaining = ACTION_LOCK[action] ?? 0.1
    presentationState.actionJustAccepted = true
  }
  return {
    action: accepted ? action : presentationState.activeAction,
    position: { ...current },
    target: movementState.target ? { ...movementState.target } : null,
    moving: presentationState.moving,
    emitMove: false,
    emitAction: accepted,
  }
}
