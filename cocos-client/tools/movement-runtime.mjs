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
  if (!state.movementEnabled) return false
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
