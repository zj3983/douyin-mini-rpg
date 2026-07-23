import type { BattleRect, Point2 } from './CombatTypes.ts'

export const PLAYER_COORDINATE_LIMIT = 10_000_000

export type PlayerActionLock = 'cast' | 'hurt' | 'death'
export type PlayerFallbackAction = 'move' | 'sword_ride'

export interface PlayerActionToken {
  readonly id: number
  readonly owner: string
  readonly action: PlayerActionLock
}

export interface PlayerActionFrame {
  readonly action: string
  readonly changed: boolean
  readonly token: Readonly<PlayerActionToken> | null
  readonly unlocked: boolean
}

export interface PlayerMotorFrame {
  readonly position: Readonly<Point2>
  readonly distanceMoved: number
  readonly arrived: boolean
}

export interface PlayerMotorSnapshot {
  readonly position: Readonly<Point2>
  readonly target: Readonly<Point2> | null
  readonly speed: number
  readonly bounds: Readonly<BattleRect> | null
  readonly enabled: boolean
  readonly action: PlayerActionLock | null
  readonly presentationAction: string
}

interface MutableActionLock {
  token: Readonly<PlayerActionToken>
  requestedAction: string
  priority: number
  sequence: number
}

const MOTOR_TOKEN = Symbol('PlayerMotor')
const MAX_EXTERNAL_DELTA_SECONDS = 0.25
const MAX_SUBSTEP_SECONDS = 1 / 60
const SUBSTEP_EPSILON = 1e-12
const ACTION_PRIORITY: Readonly<Record<PlayerActionLock, number>> = Object.freeze({
  cast: 1,
  hurt: 2,
  death: 3,
})

let constructMotor: (spawn: Point2, speed: number) => PlayerMotor
let updateBounds: (motor: PlayerMotor, bounds: BattleRect) => void
let updateTarget: (motor: PlayerMotor, target: Point2) => boolean
let advanceMotor: (motor: PlayerMotor, deltaSeconds: number) => PlayerMotorFrame
let stopMotor: (motor: PlayerMotor) => void
let resetMotor: (motor: PlayerMotor) => void
let requestAction: (motor: PlayerMotor, action: string, owner: string) => PlayerActionFrame
let updateFallback: (motor: PlayerMotor, action: PlayerFallbackAction) => PlayerActionFrame
let releaseAction: (motor: PlayerMotor, token: PlayerActionToken) => PlayerActionFrame

function isFinitePoint(value: unknown): value is Point2 {
  if (value === null || typeof value !== 'object') return false
  const point = value as Point2
  return Number.isFinite(point.x) && Number.isFinite(point.y)
}

function isSupportedCoordinate(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value) <= PLAYER_COORDINATE_LIMIT
}

function isSupportedPoint(value: unknown): value is Point2 {
  return isFinitePoint(value)
    && isSupportedCoordinate(value.x)
    && isSupportedCoordinate(value.y)
}

function isFiniteBounds(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false
  const bounds = value as BattleRect
  return isSupportedCoordinate(bounds.minX)
    && isSupportedCoordinate(bounds.maxX)
    && isSupportedCoordinate(bounds.minY)
    && isSupportedCoordinate(bounds.maxY)
    && bounds.minX <= bounds.maxX
    && bounds.minY <= bounds.maxY
}

function isPlayerActionLock(value: unknown): value is PlayerActionLock {
  return value === 'cast' || value === 'hurt' || value === 'death'
}

function actionLockFor(requestedAction: string): PlayerActionLock | null {
  if (requestedAction === 'death') return 'death'
  if (requestedAction === 'hurt') return 'hurt'
  if (requestedAction === 'cast' || requestedAction === 'hand_seal' || requestedAction === 'flying_sword_cast') {
    return 'cast'
  }
  return null
}

function isFallbackAction(value: unknown): value is PlayerFallbackAction {
  return value === 'move' || value === 'sword_ride'
}

function freezePoint(point: Point2): Readonly<Point2> {
  return Object.freeze({ x: point.x, y: point.y })
}

function freezeBounds(bounds: BattleRect): Readonly<BattleRect> {
  return Object.freeze({ ...bounds })
}

function freezeActionFrame(
  action: string,
  changed: boolean,
  token: Readonly<PlayerActionToken> | null,
  unlocked: boolean,
): PlayerActionFrame {
  return Object.freeze({ action, changed, token, unlocked })
}

function clampCoordinate(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function requireMotor(value: PlayerMotor): PlayerMotor {
  if (!(value instanceof PlayerMotor)) throw new TypeError('state must be a PlayerMotor')
  return value
}

export class PlayerMotor {
  #spawn: Point2
  #position: Point2
  #target: Point2 | null = null
  #speed: number
  #bounds: BattleRect | null = null
  #enabled = true
  #fallbackAction: PlayerFallbackAction = 'sword_ride'
  #actionLocks = new Map<number, MutableActionLock>()
  #ownerTokens = new Map<string, number>()
  #nextActionToken = 1
  #cachedSnapshot: Readonly<PlayerMotorSnapshot> | null = null
  #cachedStationaryFrame: PlayerMotorFrame | null = null

  private constructor(token: symbol, spawn: Point2, speed: number) {
    if (token !== MOTOR_TOKEN) throw new TypeError('PlayerMotor must be created by createPlayerMotor')
    this.#spawn = { x: spawn.x, y: spawn.y }
    this.#position = { x: spawn.x, y: spawn.y }
    this.#speed = speed
  }

  static {
    constructMotor = (spawn, speed) => new PlayerMotor(MOTOR_TOKEN, spawn, speed)
    updateBounds = (motor, bounds) => motor.#setBounds(bounds)
    updateTarget = (motor, target) => motor.#requestMove(target)
    advanceMotor = (motor, deltaSeconds) => motor.#step(deltaSeconds)
    stopMotor = (motor) => motor.#stop()
    resetMotor = (motor) => motor.#reset()
    requestAction = (motor, action, owner) => motor.#requestPlayerAction(action, owner)
    updateFallback = (motor, action) => motor.#setFallbackAction(action)
    releaseAction = (motor, token) => motor.#unlockPlayerAction(token)
  }

  get position(): Readonly<Point2> { return freezePoint(this.#position) }
  get target(): Readonly<Point2> | null { return this.#target ? freezePoint(this.#target) : null }
  get speed(): number { return this.#speed }
  get bounds(): Readonly<BattleRect> | null { return this.#bounds ? freezeBounds(this.#bounds) : null }
  get enabled(): boolean { return this.#enabled }
  get action(): PlayerActionLock | null { return this.#activeActionLock()?.token.action ?? null }
  get presentationAction(): string { return this.#activeActionLock()?.requestedAction ?? this.#fallbackAction }

  snapshot(): Readonly<PlayerMotorSnapshot> {
    if (this.#cachedSnapshot) return this.#cachedSnapshot
    this.#cachedSnapshot = Object.freeze({
      position: this.position,
      target: this.target,
      speed: this.#speed,
      bounds: this.bounds,
      enabled: this.#enabled,
      action: this.action,
      presentationAction: this.presentationAction,
    })
    return this.#cachedSnapshot
  }

  #invalidateCaches(): void {
    this.#cachedSnapshot = null
    this.#cachedStationaryFrame = null
  }

  #stationaryFrame(): PlayerMotorFrame {
    if (!this.#cachedStationaryFrame) {
      this.#cachedStationaryFrame = Object.freeze({
        position: this.position,
        distanceMoved: 0,
        arrived: false,
      })
    }
    return this.#cachedStationaryFrame
  }

  #activeActionLock(): MutableActionLock | null {
    let winner: MutableActionLock | null = null
    for (const lock of this.#actionLocks.values()) {
      if (!winner || lock.priority > winner.priority || (
        lock.priority === winner.priority && lock.sequence > winner.sequence
      )) winner = lock
    }
    return winner
  }

  #setBounds(bounds: BattleRect): void {
    this.#bounds = { ...bounds }
    this.#position.x = clampCoordinate(this.#position.x, bounds.minX, bounds.maxX)
    this.#position.y = clampCoordinate(this.#position.y, bounds.minY, bounds.maxY)
    if (this.#target) {
      this.#target.x = clampCoordinate(this.#target.x, bounds.minX, bounds.maxX)
      this.#target.y = clampCoordinate(this.#target.y, bounds.minY, bounds.maxY)
    }
    this.#invalidateCaches()
  }

  #requestMove(target: Point2): boolean {
    if (!this.#enabled) return false
    if (!this.#target) this.#target = { x: target.x, y: target.y }
    const bounds = this.#bounds
    this.#target.x = bounds ? clampCoordinate(target.x, bounds.minX, bounds.maxX) : target.x
    this.#target.y = bounds ? clampCoordinate(target.y, bounds.minY, bounds.maxY) : target.y
    this.#invalidateCaches()
    return true
  }

  #step(deltaSeconds: number): PlayerMotorFrame {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0 || !this.#enabled || !this.#target) {
      return this.#stationaryFrame()
    }

    const clampedDelta = Math.min(deltaSeconds, MAX_EXTERNAL_DELTA_SECONDS)
    const substepCount = Math.max(1, Math.ceil(clampedDelta / MAX_SUBSTEP_SECONDS - SUBSTEP_EPSILON))
    const substepSeconds = clampedDelta / substepCount
    const maxDistance = this.#speed * substepSeconds
    let distanceMoved = 0
    let arrived = false

    for (let index = 0; index < substepCount && this.#target; index += 1) {
      const dx = this.#target.x - this.#position.x
      const dy = this.#target.y - this.#position.y
      const distance = Math.hypot(dx, dy)
      if (distance <= maxDistance) {
        this.#position.x = this.#target.x
        this.#position.y = this.#target.y
        distanceMoved += distance
        this.#target = null
        arrived = true
        break
      }

      const scale = maxDistance / distance
      this.#position.x += dx * scale
      this.#position.y += dy * scale
      distanceMoved += maxDistance
    }

    this.#invalidateCaches()
    return Object.freeze({ position: this.position, distanceMoved, arrived })
  }

  #stop(): void {
    if (!this.#enabled && !this.#target) return
    this.#enabled = false
    this.#target = null
    this.#invalidateCaches()
  }

  #reset(): void {
    this.#enabled = true
    this.#target = null
    this.#position.x = this.#bounds
      ? clampCoordinate(this.#spawn.x, this.#bounds.minX, this.#bounds.maxX)
      : this.#spawn.x
    this.#position.y = this.#bounds
      ? clampCoordinate(this.#spawn.y, this.#bounds.minY, this.#bounds.maxY)
      : this.#spawn.y
    this.#fallbackAction = 'sword_ride'
    this.#actionLocks.clear()
    this.#ownerTokens.clear()
    this.#invalidateCaches()
  }

  #requestPlayerAction(requestedAction: string, owner: string): PlayerActionFrame {
    const before = this.presentationAction
    const action = actionLockFor(requestedAction)
    if (!action) throw new TypeError('unsupported player presentation action')
    const previousToken = this.#ownerTokens.get(owner)
    const previousLock = previousToken === undefined ? null : this.#actionLocks.get(previousToken) ?? null
    if (previousLock?.token.action === 'death') {
      return freezeActionFrame(this.presentationAction, false, previousLock.token, false)
    }
    if (previousLock) this.#actionLocks.delete(previousLock.token.id)

    const token = Object.freeze({ id: this.#nextActionToken, owner, action })
    this.#nextActionToken += 1
    this.#ownerTokens.set(owner, token.id)
    this.#actionLocks.set(token.id, {
      token,
      requestedAction,
      priority: ACTION_PRIORITY[action],
      sequence: token.id,
    })
    this.#invalidateCaches()
    const after = this.presentationAction
    return freezeActionFrame(after, after !== before, token, false)
  }

  #setFallbackAction(action: PlayerFallbackAction): PlayerActionFrame {
    const before = this.presentationAction
    if (this.#fallbackAction === action) return freezeActionFrame(before, false, null, false)
    this.#fallbackAction = action
    this.#invalidateCaches()
    const after = this.presentationAction
    return freezeActionFrame(after, after !== before, null, false)
  }

  #unlockPlayerAction(token: PlayerActionToken): PlayerActionFrame {
    const before = this.presentationAction
    const lock = this.#actionLocks.get(token?.id)
    if (!lock || lock.token !== token || lock.token.action === 'death') {
      return freezeActionFrame(before, false, null, false)
    }
    this.#actionLocks.delete(lock.token.id)
    if (this.#ownerTokens.get(lock.token.owner) === lock.token.id) this.#ownerTokens.delete(lock.token.owner)
    this.#invalidateCaches()
    const after = this.presentationAction
    return freezeActionFrame(after, after !== before, null, true)
  }
}

export function createPlayerMotor(spawn: Point2, speed: number): PlayerMotor {
  if (!isFinitePoint(spawn)) throw new TypeError('spawn must contain finite coordinates')
  if (!isSupportedPoint(spawn)) throw new RangeError('spawn exceeds supported coordinate magnitude')
  if (!Number.isFinite(speed) || speed <= 0) throw new TypeError('speed must be finite and positive')
  return constructMotor(spawn, speed)
}

export function setPlayerBounds(state: PlayerMotor, bounds: BattleRect): void {
  const motor = requireMotor(state)
  if (!isFiniteBounds(bounds)) {
    const finite = bounds
      && Number.isFinite(bounds.minX)
      && Number.isFinite(bounds.maxX)
      && Number.isFinite(bounds.minY)
      && Number.isFinite(bounds.maxY)
    if (finite && [bounds.minX, bounds.maxX, bounds.minY, bounds.maxY].some(
      (value) => Math.abs(value) > PLAYER_COORDINATE_LIMIT,
    )) throw new RangeError('bounds exceed supported coordinate magnitude')
    throw new TypeError('bounds must be finite and ordered')
  }
  updateBounds(motor, bounds)
}

export function requestMove(state: PlayerMotor, target: Point2): boolean {
  const motor = requireMotor(state)
  if (!isSupportedPoint(target)) return false
  return updateTarget(motor, target)
}

export function requestMoveInCoordinateSpace(
  state: PlayerMotor,
  point: Point2,
  convert: (point: Readonly<Point2>) => Point2,
): boolean {
  const motor = requireMotor(state)
  if (!isFinitePoint(point) || typeof convert !== 'function') return false
  let converted: Point2
  try {
    converted = convert(Object.freeze({ x: point.x, y: point.y }))
  } catch {
    return false
  }
  return requestMove(motor, converted)
}

export function stepPlayerMotor(state: PlayerMotor, deltaSeconds: number): PlayerMotorFrame {
  return advanceMotor(requireMotor(state), deltaSeconds)
}

export function stopPlayerMotor(state: PlayerMotor): void {
  stopMotor(requireMotor(state))
}

export function resetPlayerMotor(state: PlayerMotor): void {
  resetMotor(requireMotor(state))
}

export function requestPlayerAction(state: PlayerMotor, action: string, owner: string): PlayerActionFrame {
  const motor = requireMotor(state)
  if (typeof owner !== 'string' || owner.length === 0) throw new TypeError('action owner must be non-empty')
  return requestAction(motor, action, owner)
}

export function setPlayerFallbackAction(state: PlayerMotor, action: PlayerFallbackAction): PlayerActionFrame {
  const motor = requireMotor(state)
  if (!isFallbackAction(action)) throw new TypeError('fallback action must be move or sword_ride')
  return updateFallback(motor, action)
}

export function setPlayerMotionPresentation(state: PlayerMotor, moving: boolean): PlayerActionFrame {
  if (typeof moving !== 'boolean') throw new TypeError('moving must be boolean')
  return setPlayerFallbackAction(state, 'sword_ride')
}

export function lockPlayerAction(
  state: PlayerMotor,
  action: PlayerActionLock,
  owner = 'legacy',
): Readonly<PlayerActionToken> {
  if (!isPlayerActionLock(action)) throw new TypeError('action must be cast, hurt, or death')
  const frame = requestPlayerAction(state, action, owner)
  if (!frame.token) throw new Error('action lock token unavailable')
  return frame.token
}

export function unlockPlayerAction(state: PlayerMotor, token: PlayerActionToken): PlayerActionFrame {
  return completePlayerAction(state, token)
}

export function completePlayerAction(state: PlayerMotor, token: PlayerActionToken): PlayerActionFrame {
  return releaseAction(requireMotor(state), token)
}
