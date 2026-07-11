export const HOMING_SWORD_RUNTIME_VERSION = '1'

export interface SwordPoint { x: number; y: number }
export type SwordVector = SwordPoint
export interface HomingSwordTarget { id: string; position: SwordPoint; alive: boolean }
export interface HomingSwordConfig { speed: number; maxTurnRadians: number; maxOutboundDistance: number; returnRadius: number }
export type HomingSwordPhase = 'outbound' | 'returning' | 'finished'
export interface HomingSwordState {
  position: SwordPoint
  velocity: SwordVector
  phase: HomingSwordPhase
  targetId: string | null
  distanceTravelled: number
  hitIds: string[]
  config: HomingSwordConfig
}
export interface HomingSwordStepResult {
  previousPosition: SwordPoint
  nextPosition: SwordPoint
  previousPhase: HomingSwordPhase
  nextPhase: HomingSwordPhase
  previousTargetId: string | null
  nextTargetId: string | null
  targetChanged: boolean
}

const EPSILON = 1e-9
const finite = (value: number, fallback = 0) => Number.isFinite(value) ? value : fallback
const nonnegative = (value: number) => Number.isFinite(value) && value > 0 ? value : 0
const point = (value?: Partial<SwordPoint> | null): SwordPoint => ({ x: finite(value?.x ?? 0), y: finite(value?.y ?? 0) })

function unit(value?: Partial<SwordVector> | null): SwordVector {
  const x = finite(value?.x ?? 0)
  const y = finite(value?.y ?? 0)
  const length = Math.hypot(x, y)
  return length > EPSILON ? { x: x / length, y: y / length } : { x: 1, y: 0 }
}

function validTarget(target: HomingSwordTarget | null | undefined) {
  return Boolean(target && typeof target.id === 'string' && target.id.trim() !== '' && target.alive === true
    && Number.isFinite(target.position?.x) && Number.isFinite(target.position?.y))
}

function validPosition(value: SwordPoint | null | undefined) {
  return Boolean(value && Number.isFinite(value.x) && Number.isFinite(value.y))
}

function steer(velocity: SwordVector, destination: SwordPoint, position: SwordPoint, maxRadians: number, speed: number) {
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

export function createHomingSword(start: SwordPoint, initialDirection: SwordVector, input: HomingSwordConfig): HomingSwordState {
  const direction = unit(initialDirection)
  const config = {
    speed: nonnegative(input?.speed), maxTurnRadians: nonnegative(input?.maxTurnRadians),
    maxOutboundDistance: nonnegative(input?.maxOutboundDistance), returnRadius: nonnegative(input?.returnRadius),
  }
  return { position: point(start), velocity: { x: direction.x * config.speed, y: direction.y * config.speed }, phase: 'outbound', targetId: null, distanceTravelled: 0, hitIds: [], config }
}

export function selectNearestTarget(position: SwordPoint, targets: HomingSwordTarget[], excluded?: ReadonlySet<string>) {
  if (!validPosition(position) || !Array.isArray(targets)) return null
  let nearest: HomingSwordTarget | null = null
  let nearestDistance = Infinity
  for (const candidate of targets) {
    if (!validTarget(candidate) || excluded?.has(candidate.id)) continue
    const distance = (candidate.position.x - position.x) ** 2 + (candidate.position.y - position.y) ** 2
    if (distance < nearestDistance || (distance === nearestDistance && candidate.id < (nearest?.id ?? ''))) {
      nearest = candidate; nearestDistance = distance
    }
  }
  return nearest
}

export function beginSwordReturn(state: HomingSwordState) {
  if (!state || state.phase !== 'outbound') return false
  state.phase = 'returning'; state.targetId = null; return true
}

export function recordSwordHit(state: HomingSwordState, id: unknown) {
  if (!state || typeof id !== 'string' || id.trim() === '' || !Array.isArray(state.hitIds) || state.hitIds.includes(id)) return false
  state.hitIds.push(id); return true
}

export function stepHomingSword(state: HomingSwordState, deltaTime: number, targets: HomingSwordTarget[], playerPosition: SwordPoint): HomingSwordStepResult {
  const previousPosition = { ...state.position }
  const previousPhase = state.phase
  const previousTargetId = state.targetId
  const result = (): HomingSwordStepResult => ({ previousPosition, nextPosition: { ...state.position }, previousPhase, nextPhase: state.phase, previousTargetId, nextTargetId: state.targetId, targetChanged: previousTargetId !== state.targetId })
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
    state.position.x += direction.x * distance; state.position.y += direction.y * distance; state.distanceTravelled += distance
    if (remaining - distance <= EPSILON) beginSwordReturn(state)
    return result()
  }
  const player = validPosition(playerPosition) ? playerPosition : state.position
  state.targetId = null
  const distanceToPlayer = Math.hypot(player.x - state.position.x, player.y - state.position.y)
  const returnRadius = nonnegative(state.config?.returnRadius)
  if (distanceToPlayer <= returnRadius + EPSILON) { state.phase = 'finished'; return result() }
  state.velocity = steer(state.velocity, player, state.position, turnLimit, speed)
  const distance = Math.min(speed * deltaTime, Math.max(0, distanceToPlayer - returnRadius))
  const direction = unit(state.velocity)
  state.position.x += direction.x * distance; state.position.y += direction.y * distance
  if (Math.hypot(player.x - state.position.x, player.y - state.position.y) <= returnRadius + EPSILON) state.phase = 'finished'
  return result()
}
