import { interruptEnemy, killEnemy } from './EnemyBrain.ts'
import type { EnemyEntity } from './EnemyBrain.ts'
import type { PlayerMotor } from './PlayerMotor.ts'

export interface EnemyDamageResult {
  amount: number
  remainingHp: number
  killed: boolean
  interrupted: boolean
}

export function applyEnemyDamage(enemy: EnemyEntity, amount: number): EnemyDamageResult {
  if (!enemy.alive) return { amount: 0, remainingHp: 0, killed: false, interrupted: false }
  const applied = Math.max(0, Math.round(amount))
  enemy.hp = Math.max(0, enemy.hp - applied)
  if (enemy.hp === 0) {
    killEnemy(enemy)
    return { amount: applied, remainingHp: 0, killed: true, interrupted: false }
  }
  const interrupted = interruptEnemy(enemy)
  return { amount: applied, remainingHp: enemy.hp, killed: false, interrupted }
}

export function tickPlayerCombat(motor: PlayerMotor, deltaTime: number) {
  if (!Number.isFinite(deltaTime) || deltaTime <= 0) return
  motor.hurtCooldownRemaining = Math.max(0, motor.hurtCooldownRemaining - deltaTime)
}

export function applyPlayerDamage(motor: PlayerMotor, amount: number, invincibleSeconds: number): boolean {
  if (!motor.alive || motor.hurtCooldownRemaining > 0) return false
  motor.hp = Math.max(0, motor.hp - Math.max(0, Math.round(amount)))
  motor.hurtCooldownRemaining = Math.max(0, invincibleSeconds)
  if (motor.hp === 0) motor.alive = false
  return true
}
