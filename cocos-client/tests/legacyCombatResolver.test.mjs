import test from 'node:test'
import assert from 'node:assert/strict'

import { applyEnemyDamage, applyPlayerDamage, tickPlayerCombat } from '../assets/Scripts/Core/Battle/CombatResolver.ts'
import { createEnemy } from '../assets/Scripts/Core/Battle/EnemyBrain.ts'
import { createPlayerMotor } from '../assets/Scripts/Core/Battle/PlayerMotor.ts'
import { createSeededRandom } from '../assets/Scripts/Core/Battle/Random.ts'

const wolf = {
  kind: 'wolf', maxHp: 110, radius: 26, moveSpeed: 130, flankOffsetY: 90, postOffsetX: 130,
  pounceRange: 210, telegraphSeconds: 0.6, pounceSpeed: 540, pounceSeconds: 0.45,
  recoverySeconds: 0.5, whiffRecoverySeconds: 0.9, touchDamage: 16, decisionHz: 8, spawnSeconds: 0.5,
}

const motorConfig = {
  bounds: { minX: -330, maxX: 330, minY: -420, maxY: 460 },
  speed: 280, spawn: { x: -260, y: -80 }, maxHp: 260, radius: 24,
}

test('legacy enemy damage interrupts survivors and kills at zero', () => {
  const enemy = createEnemy(1, wolf, { x: 150, y: 0 }, createSeededRandom(3))
  enemy.state = 'telegraph'
  const first = applyEnemyDamage(enemy, 55)
  assert.equal(first.killed, false)
  assert.equal(first.interrupted, true)
  assert.equal(enemy.state, 'hurt')
  const second = applyEnemyDamage(enemy, 55)
  assert.equal(second.killed, true)
  assert.equal(enemy.alive, false)
  assert.equal(applyEnemyDamage(enemy, 55).killed, false)
})

test('legacy player damage respects invincibility and preserves the move target on death', () => {
  const motor = createPlayerMotor(motorConfig)
  motor.target = { x: 100, y: 100 }
  assert.equal(applyPlayerDamage(motor, 40, 0.5), true)
  assert.equal(motor.hp, 220)
  assert.equal(applyPlayerDamage(motor, 40, 0.5), false)
  tickPlayerCombat(motor, 0.5)
  assert.equal(applyPlayerDamage(motor, 220, 0.5), true)
  assert.equal(motor.alive, false)
  assert.deepEqual(motor.target, { x: 100, y: 100 })
})
