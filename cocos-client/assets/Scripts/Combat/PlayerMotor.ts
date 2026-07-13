import type { BattleRect, Point2 } from './CombatTypes.ts'

export type PlayerActionLock = 'cast' | 'hurt' | 'death'

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
  readonly action: PlayerActionLock | null
}

const MOTOR_TOKEN = Symbol('PlayerMotor')
const MAX_EXTERNAL_DELTA_SECONDS = 0.25
const MAX_SUBSTEP_SECONDS = 1 / 60
const SUBSTEP_EPSILON = 1e-12

let constructMotor: (spawn: Point2, speed: number) => PlayerMotor
let updateBounds: (motor: PlayerMotor, bounds: BattleRect) => void
let updateTarget: (motor: PlayerMotor, target: Point2) => boolean
let advanceMotor: (motor: PlayerMotor, deltaSeconds: number) => PlayerMotorFrame
let updateActionLock: (motor: PlayerMotor, action: PlayerActionLock, locked: boolean) => void

function isFinitePoint(value: unknown): value is Point2 {
  if (value === null || typeof value !== 'object') return false
  const point = value as Point2
  return Number.isFinite(point.x) && Number.isFinite(point.y)
}

function isFiniteBounds(value: unknown): value is BattleRect {
  if (value === null || typeof value !== 'object') return false
  const bounds = value as BattleRect
  return Number.isFinite(bounds.minX)
    && Number.isFinite(bounds.maxX)
    && Number.isFinite(bounds.minY)
    && Number.isFinite(bounds.maxY)
    && bounds.minX <= bounds.maxX
    && bounds.minY <= bounds.maxY
}

function isPlayerActionLock(value: unknown): value is PlayerActionLock {
  return value === 'cast' || value === 'hurt' || value === 'death'
}

function freezePoint(point: Point2): Readonly<Point2> {
  return Object.freeze({ x: point.x, y: point.y })
}

function freezeBounds(bounds: BattleRect): Readonly<BattleRect> {
  return Object.freeze({ ...bounds })
}

function clampPoint(point: Point2, bounds: BattleRect | null): Point2 {
  if (!bounds) return { x: point.x, y: point.y }
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, point.x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, point.y)),
  }
}

function movementVector(from: Point2, to: Point2): { distance: number; unitX: number; unitY: number } {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const distance = Math.hypot(dx, dy)
  if (Number.isFinite(distance)) {
    if (distance === 0) return { distance: 0, unitX: 0, unitY: 0 }
    return { distance, unitX: dx / distance, unitY: dy / distance }
  }

  const coordinateScale = Math.max(Math.abs(from.x), Math.abs(from.y), Math.abs(to.x), Math.abs(to.y))
  const scaledDx = to.x / coordinateScale - from.x / coordinateScale
  const scaledDy = to.y / coordinateScale - from.y / coordinateScale
  const scaledDistance = Math.hypot(scaledDx, scaledDy)
  return {
    distance: Number.POSITIVE_INFINITY,
    unitX: scaledDx / scaledDistance,
    unitY: scaledDy / scaledDistance,
  }
}

function requireMotor(value: PlayerMotor): PlayerMotor {
  if (!(value instanceof PlayerMotor)) throw new TypeError('state must be a PlayerMotor')
  return value
}

export class PlayerMotor {
  #position: Point2
  #target: Point2 | null = null
  #speed: number
  #bounds: BattleRect | null = null
  #actionLocks = new Set<PlayerActionLock>()

  private constructor(token: symbol, spawn: Point2, speed: number) {
    if (token !== MOTOR_TOKEN) throw new TypeError('PlayerMotor must be created by createPlayerMotor')
    this.#position = { x: spawn.x, y: spawn.y }
    this.#speed = speed
  }

  static {
    constructMotor = (spawn, speed) => new PlayerMotor(MOTOR_TOKEN, spawn, speed)
    updateBounds = (motor, bounds) => motor.#setBounds(bounds)
    updateTarget = (motor, target) => motor.#requestMove(target)
    advanceMotor = (motor, deltaSeconds) => motor.#step(deltaSeconds)
    updateActionLock = (motor, action, locked) => motor.#setActionLock(action, locked)
  }

  get position(): Readonly<Point2> { return freezePoint(this.#position) }
  get target(): Readonly<Point2> | null { return this.#target ? freezePoint(this.#target) : null }
  get speed(): number { return this.#speed }
  get bounds(): Readonly<BattleRect> | null { return this.#bounds ? freezeBounds(this.#bounds) : null }
  get action(): PlayerActionLock | null {
    if (this.#actionLocks.has('death')) return 'death'
    if (this.#actionLocks.has('hurt')) return 'hurt'
    if (this.#actionLocks.has('cast')) return 'cast'
    return null
  }

  snapshot(): Readonly<PlayerMotorSnapshot> {
    return Object.freeze({
      position: this.position,
      target: this.target,
      speed: this.#speed,
      bounds: this.bounds,
      action: this.action,
    })
  }

  #setBounds(bounds: BattleRect): void {
    this.#bounds = { ...bounds }
    this.#position = clampPoint(this.#position, this.#bounds)
    if (this.#target) this.#target = clampPoint(this.#target, this.#bounds)
  }

  #requestMove(target: Point2): boolean {
    this.#target = clampPoint(target, this.#bounds)
    return true
  }

  #step(deltaSeconds: number): PlayerMotorFrame {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0 || !this.#target) {
      return Object.freeze({ position: this.position, distanceMoved: 0, arrived: false })
    }

    const clampedDelta = Math.min(deltaSeconds, MAX_EXTERNAL_DELTA_SECONDS)
    const substepCount = Math.max(1, Math.ceil(clampedDelta / MAX_SUBSTEP_SECONDS - SUBSTEP_EPSILON))
    const substepSeconds = clampedDelta / substepCount
    let distanceMoved = 0
    let arrived = false

    for (let index = 0; index < substepCount && this.#target; index += 1) {
      const vector = movementVector(this.#position, this.#target)
      const maxDistance = this.#speed * substepSeconds

      if (vector.distance <= maxDistance) {
        this.#position = { ...this.#target }
        distanceMoved += vector.distance
        this.#target = null
        arrived = true
        break
      }

      const nextPosition = {
        x: this.#position.x + vector.unitX * maxDistance,
        y: this.#position.y + vector.unitY * maxDistance,
      }
      if (nextPosition.x === this.#position.x && nextPosition.y === this.#position.y) break
      this.#position = nextPosition
      distanceMoved += maxDistance
    }

    return Object.freeze({ position: this.position, distanceMoved, arrived })
  }

  #setActionLock(action: PlayerActionLock, locked: boolean): void {
    if (locked) this.#actionLocks.add(action)
    else this.#actionLocks.delete(action)
  }
}

export function createPlayerMotor(spawn: Point2, speed: number): PlayerMotor {
  if (!isFinitePoint(spawn)) throw new TypeError('spawn must contain finite coordinates')
  if (!Number.isFinite(speed) || speed <= 0) throw new TypeError('speed must be finite and positive')
  return constructMotor(spawn, speed)
}

export function setPlayerBounds(state: PlayerMotor, bounds: BattleRect): void {
  const motor = requireMotor(state)
  if (!isFiniteBounds(bounds)) throw new TypeError('bounds must be finite and ordered')
  updateBounds(motor, bounds)
}

export function requestMove(state: PlayerMotor, target: Point2): boolean {
  const motor = requireMotor(state)
  if (!isFinitePoint(target)) return false
  return updateTarget(motor, target)
}

export function stepPlayerMotor(state: PlayerMotor, deltaSeconds: number): PlayerMotorFrame {
  return advanceMotor(requireMotor(state), deltaSeconds)
}

export function lockPlayerAction(state: PlayerMotor, action: PlayerActionLock): void {
  const motor = requireMotor(state)
  if (!isPlayerActionLock(action)) throw new TypeError('action must be cast, hurt, or death')
  updateActionLock(motor, action, true)
}

export function unlockPlayerAction(state: PlayerMotor, action: PlayerActionLock): void {
  const motor = requireMotor(state)
  if (!isPlayerActionLock(action)) throw new TypeError('action must be cast, hurt, or death')
  updateActionLock(motor, action, false)
}
