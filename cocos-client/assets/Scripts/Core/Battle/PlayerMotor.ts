import { clampVecToBounds, isFiniteVec } from './Geometry.ts'
import type { BattleBounds, Vec2 } from './Geometry.ts'

export interface PlayerMotorConfig {
  bounds: BattleBounds
  speed: number
  spawn: Vec2
  maxHp: number
  radius: number
}

export interface PlayerMotor {
  position: Vec2
  target: Vec2 | null
  readonly speed: number
  readonly bounds: BattleBounds
  readonly radius: number
  hp: number
  readonly maxHp: number
  alive: boolean
  hurtCooldownRemaining: number
}

export const MOTOR_MAX_FRAME_DELTA = 0.25
export const MOTOR_SUBSTEP = 1 / 60

export function createPlayerMotor(config: PlayerMotorConfig): PlayerMotor {
  return {
    position: { ...config.spawn },
    target: null,
    speed: config.speed,
    bounds: { ...config.bounds },
    radius: config.radius,
    hp: Math.max(1, Math.floor(config.maxHp)),
    maxHp: Math.max(1, Math.floor(config.maxHp)),
    alive: true,
    hurtCooldownRemaining: 0,
  }
}

export function setMoveTarget(motor: PlayerMotor, point: Vec2): boolean {
  if (!motor.alive || !isFiniteVec(point)) return false
  motor.target = clampVecToBounds(point, motor.bounds)
  return true
}

export function tickPlayerMotor(motor: PlayerMotor, deltaTime: number): { distanceMoved: number; arrived: boolean } {
  const idle = { distanceMoved: 0, arrived: false }
  if (!motor.alive || !motor.target) return idle
  if (!Number.isFinite(deltaTime) || deltaTime <= 0) return idle
  if (!isFiniteVec(motor.position) || !isFiniteVec(motor.target)) return idle

  const acceptedDelta = Math.min(deltaTime, MOTOR_MAX_FRAME_DELTA)
  const substeps = Math.max(1, Math.ceil(acceptedDelta / MOTOR_SUBSTEP - 1e-12))
  const substepDelta = acceptedDelta / substeps
  let distanceMoved = 0

  for (let index = 0; index < substeps; index += 1) {
    const dx = motor.target.x - motor.position.x
    const dy = motor.target.y - motor.position.y
    const distance = Math.hypot(dx, dy)
    if (distance === 0) {
      motor.target = null
      return { distanceMoved, arrived: true }
    }
    const step = Math.min(distance, motor.speed * substepDelta)
    motor.position = { x: motor.position.x + (dx / distance) * step, y: motor.position.y + (dy / distance) * step }
    distanceMoved += step
    if (step >= distance) {
      motor.target = null
      return { distanceMoved, arrived: true }
    }
  }

  return { distanceMoved, arrived: false }
}
