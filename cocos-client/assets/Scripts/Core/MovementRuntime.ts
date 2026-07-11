export interface Point2 {
  x: number
  y: number
}

export interface BattleBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export interface PlayerMovementState {
  spawnPosition: Point2
  target: Point2 | null
  movementEnabled: boolean
}

export function createPlayerMovementState(spawnPosition: Point2): PlayerMovementState {
  return {
    spawnPosition: { ...spawnPosition },
    target: null,
    movementEnabled: true,
  }
}

export function requestPlayerMovement(state: PlayerMovementState, target: Point2) {
  if (!state.movementEnabled || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return false
  state.target = { ...target }
  return true
}

export function stopPlayerMovement(state: PlayerMovementState) {
  state.target = null
  state.movementEnabled = false
}

export function resetPlayerMovement(state: PlayerMovementState) {
  state.target = null
  state.movementEnabled = true
  return { ...state.spawnPosition }
}

export function clampBattleTarget(point: Point2, bounds: BattleBounds): Point2 {
  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, point.x)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY, point.y)),
  }
}

export function stepTowardTarget(current: Point2, target: Point2, speed: number, deltaTime: number) {
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

export interface PlayerPresentationState {
  moving: boolean
  hoverElapsed: number
  hoverBaseY: number
}

export const MAX_MOVEMENT_SUBSTEP = 1 / 60

export function advancePlayerMovement(
  state: PlayerMovementState,
  current: Point2,
  speed: number,
  deltaTime: number,
) {
  const finiteCurrent = {
    x: Number.isFinite(current.x) ? current.x : 0,
    y: Number.isFinite(current.y) ? current.y : 0,
  }
  const stationary = { position: finiteCurrent, distanceMoved: 0, arrived: false, substeps: 0 }
  if (!state.movementEnabled || !state.target) return stationary
  if (!Number.isFinite(deltaTime) || deltaTime <= 0) return stationary
  if (!Number.isFinite(current.x) || !Number.isFinite(current.y)) return stationary

  const substeps = Math.max(1, Math.ceil(deltaTime / MAX_MOVEMENT_SUBSTEP - 1e-12))
  const substepDelta = deltaTime / substeps
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

export function createPlayerPresentationState(hoverBaseY = 0): PlayerPresentationState {
  return { moving: false, hoverElapsed: 0, hoverBaseY }
}

export function advancePlayerControllerFrame(
  movementState: PlayerMovementState,
  presentationState: PlayerPresentationState,
  current: Point2,
  speed: number,
  deltaTime: number,
) {
  const validDelta = Number.isFinite(deltaTime) && deltaTime > 0 ? deltaTime : 0
  presentationState.hoverElapsed += validDelta
  const movement = advancePlayerMovement(movementState, current, speed, deltaTime)
  const emitMove = movement.distanceMoved > 0
  const motionChanges: boolean[] = []

  if (emitMove && !presentationState.moving) {
    presentationState.moving = true
    motionChanges.push(true)
  }
  if (movement.arrived && presentationState.moving) {
    presentationState.moving = false
    motionChanges.push(false)
  }

  return {
    ...movement,
    emitMove,
    motionChanges,
    action: movement.arrived ? 'sword_ride' : null,
    hoverY: presentationState.hoverBaseY + Math.sin(presentationState.hoverElapsed * 4) * 2,
  }
}

export function applyPlayerActionEvent(
  movementState: PlayerMovementState,
  presentationState: PlayerPresentationState,
  current: Point2,
  action: string,
) {
  return {
    action,
    position: { ...current },
    target: movementState.target ? { ...movementState.target } : null,
    moving: presentationState.moving,
    emitMove: false,
  }
}
