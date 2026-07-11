export const HOMING_SWORD_RUNTIME_VERSION = '1'

const EPSILON = 1e-9

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback
}

function nonnegative(value) {
  return Number.isFinite(value) && value > 0 ? value : 0
}

function point(value) {
  return { x: finite(value?.x), y: finite(value?.y) }
}

function unit(value) {
  const x = finite(value?.x)
  const y = finite(value?.y)
  const length = Math.hypot(x, y)
  return length > EPSILON ? { x: x / length, y: y / length } : { x: 1, y: 0 }
}

function validTarget(target) {
  return target && typeof target.id === 'string' && target.id.trim() !== '' && target.alive === true
    && Number.isFinite(target.position?.x) && Number.isFinite(target.position?.y)
}

function validPosition(value) {
  return Number.isFinite(value?.x) && Number.isFinite(value?.y)
}

function copyPosition(value) {
  return { x: value.x, y: value.y }
}

function steer(velocity, destination, position, maxRadians, speed) {
  const current = unit(velocity)
  const dx = destination.x - position.x
  const dy = destination.y - position.y
  if (Math.hypot(dx, dy) <= EPSILON) return { x: current.x * speed, y: current.y * speed }
  const desiredAngle = Math.atan2(dy, dx)
  const currentAngle = Math.atan2(current.y, current.x)
  const difference = Math.atan2(Math.sin(desiredAngle - currentAngle), Math.cos(desiredAngle - currentAngle))
  const turn = Math.max(-maxRadians, Math.min(maxRadians, difference))
  const angle = currentAngle + turn
  return { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed }
}

export function createHomingSword(start, initialDirection, input) {
  const direction = unit(initialDirection)
  const config = {
    speed: nonnegative(input?.speed),
    maxTurnRadians: nonnegative(input?.maxTurnRadians),
    maxOutboundDistance: nonnegative(input?.maxOutboundDistance),
    returnRadius: nonnegative(input?.returnRadius),
  }
  return {
    position: point(start),
    velocity: { x: direction.x * config.speed, y: direction.y * config.speed },
    phase: 'outbound',
    targetId: null,
    distanceTravelled: 0,
    hitIds: [],
    config,
  }
}

export function selectNearestTarget(position, targets, excluded = undefined) {
  if (!validPosition(position) || !Array.isArray(targets)) return null
  let nearest = null
  let nearestDistance = Infinity
  for (const candidate of targets) {
    if (!validTarget(candidate) || excluded?.has(candidate.id)) continue
    const distance = (candidate.position.x - position.x) ** 2 + (candidate.position.y - position.y) ** 2
    if (distance < nearestDistance - EPSILON || (Math.abs(distance - nearestDistance) <= EPSILON && candidate.id < nearest.id)) {
      nearest = candidate
      nearestDistance = distance
    }
  }
  return nearest
}

export function beginSwordReturn(state) {
  if (!state || state.phase !== 'outbound') return false
  state.phase = 'returning'
  state.targetId = null
  return true
}

export function recordSwordHit(state, id) {
  if (!state || typeof id !== 'string' || id.trim() === '' || !Array.isArray(state.hitIds) || state.hitIds.includes(id)) return false
  state.hitIds.push(id)
  return true
}

export function stepHomingSword(state, deltaTime, targets, playerPosition) {
  const previousPosition = copyPosition(state.position)
  const previousPhase = state.phase
  const previousTargetId = state.targetId
  const result = () => ({
    previousPosition,
    nextPosition: copyPosition(state.position),
    previousPhase,
    nextPhase: state.phase,
    previousTargetId,
    nextTargetId: state.targetId,
    targetChanged: previousTargetId !== state.targetId,
  })
  if (!Number.isFinite(deltaTime) || deltaTime <= 0 || state.phase === 'finished') return result()

  const speed = nonnegative(state.config?.speed)
  const turnLimit = nonnegative(state.config?.maxTurnRadians) * deltaTime
  if (state.phase === 'outbound') {
    const current = Array.isArray(targets) ? targets.find((candidate) => validTarget(candidate) && candidate.id === state.targetId) : null
    const selected = current ?? selectNearestTarget(state.position, targets)
    state.targetId = selected?.id ?? null
    if (selected) state.velocity = steer(state.velocity, selected.position, state.position, turnLimit, speed)

    const remaining = Math.max(0, nonnegative(state.config?.maxOutboundDistance) - state.distanceTravelled)
    const distance = Math.min(speed * deltaTime, remaining)
    const direction = unit(state.velocity)
    state.position.x += direction.x * distance
    state.position.y += direction.y * distance
    state.distanceTravelled += distance
    if (remaining - distance <= EPSILON) beginSwordReturn(state)
    return result()
  }

  const player = validPosition(playerPosition) ? playerPosition : state.position
  state.targetId = null
  const distanceToPlayer = Math.hypot(player.x - state.position.x, player.y - state.position.y)
  const returnRadius = nonnegative(state.config?.returnRadius)
  if (distanceToPlayer <= returnRadius + EPSILON) {
    state.phase = 'finished'
    return result()
  }
  state.velocity = steer(state.velocity, player, state.position, turnLimit, speed)
  const distance = Math.min(speed * deltaTime, Math.max(0, distanceToPlayer - returnRadius))
  const direction = unit(state.velocity)
  state.position.x += direction.x * distance
  state.position.y += direction.y * distance
  if (Math.hypot(player.x - state.position.x, player.y - state.position.y) <= returnRadius + EPSILON) state.phase = 'finished'
  return result()
}
