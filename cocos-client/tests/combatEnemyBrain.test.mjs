import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createEnemy,
  enemyBodyHitsPlayer,
  interruptEnemy,
  killEnemy,
  tickEnemy,
} from '../assets/Scripts/Core/Battle/EnemyBrain.ts'
import { createSeededRandom } from '../assets/Scripts/Core/Battle/Random.ts'

const wolf = {
  kind: 'wolf', maxHp: 110, radius: 26, moveSpeed: 130, flankOffsetY: 90, postOffsetX: 130,
  pounceRange: 210, telegraphSeconds: 0.6, pounceSpeed: 540, pounceSeconds: 0.45,
  recoverySeconds: 0.5, whiffRecoverySeconds: 0.9, touchDamage: 16, decisionHz: 8, spawnSeconds: 0.5,
}
const moth = {
  kind: 'moth', maxHp: 80, radius: 22, moveSpeed: 150, altitudeMin: 60, altitudeMax: 240,
  postOffsetX: 140, attackRange: 280, minSeparation: 90, telegraphSeconds: 0.55,
  diveSpeed: 580, diveSeconds: 0.5, projectileSpeed: 320, projectileRadius: 12,
  projectileDamage: 14, touchDamage: 12, recoverySeconds: 0.6, decisionHz: 9, spawnSeconds: 0.6,
}
const bounds = { minX: -330, maxX: 330, minY: -420, maxY: 460 }
const ctxFor = (enemy, extras = {}) => ({
  playerPosition: { x: 0, y: 0 },
  playerAlive: true,
  enemies: [enemy],
  bounds,
  random: createSeededRandom(3),
  deltaTime: 1 / 60,
  ...extras,
})

function run(enemy, seconds, extras = {}) {
  const events = []
  for (let tick = 0; tick < seconds * 60; tick += 1) events.push(...tickEnemy(enemy, ctxFor(enemy, extras)))
  return events
}

test('wolf follows spawn -> select-position -> telegraph -> attack -> recovery', () => {
  const enemy = createEnemy(1, wolf, { x: 150, y: 0 }, createSeededRandom(3))
  const seen = []
  for (let tick = 0; tick < 600; tick += 1) {
    tickEnemy(enemy, ctxFor(enemy))
    if (seen[seen.length - 1] !== enemy.state) seen.push(enemy.state)
  }
  assert.deepEqual(seen.slice(0, 5), ['spawn', 'select-position', 'telegraph', 'attack', 'recovery'])
})

test('telegraph and recovery deal no body damage, only attack frames do', () => {
  const enemy = createEnemy(1, wolf, { x: 100, y: 0 }, createSeededRandom(3))
  enemy.state = 'telegraph'
  assert.equal(enemyBodyHitsPlayer(enemy, { x: 0, y: 0 }, 24), false)
  enemy.state = 'attack'
  enemy.position = { x: 30, y: 0 }
  assert.equal(enemyBodyHitsPlayer(enemy, { x: 0, y: 0 }, 24), true)
  enemy.state = 'recovery'
  assert.equal(enemyBodyHitsPlayer(enemy, { x: 0, y: 0 }, 24), false)
})

test('whiffed pounce uses the longer whiff recovery', () => {
  const enemy = createEnemy(1, wolf, { x: 150, y: 0 }, createSeededRandom(3))
  enemy.state = 'attack'
  enemy.stateElapsed = 99
  enemy.attackDidHit = false
  tickEnemy(enemy, ctxFor(enemy))
  assert.equal(enemy.state, 'recovery')
  assert.equal(enemy.recoveryDuration, wolf.whiffRecoverySeconds)
})

test('hurt interrupts telegraph, death is terminal, spawn is not interruptible', () => {
  const enemy = createEnemy(1, wolf, { x: 150, y: 0 }, createSeededRandom(3))
  assert.equal(interruptEnemy(enemy), false)
  enemy.state = 'telegraph'
  assert.equal(interruptEnemy(enemy), true)
  assert.equal(enemy.state, 'hurt')
  assert.equal(killEnemy(enemy), true)
  assert.equal(enemy.alive, false)
  assert.equal(enemy.state, 'death')
  assert.equal(interruptEnemy(enemy), false)
})

test('moth alternates bolt and dive and emits a projectile event on bolt', () => {
  const enemy = createEnemy(2, moth, { x: 200, y: 120 }, createSeededRandom(5))
  enemy.state = 'select-position'
  enemy.position = { x: 200, y: 120 }
  const events = run(enemy, 4)
  const bolt = events.find((event) => event.type === 'moth-bolt')
  assert.ok(bolt, 'bolt volley should fire')
  assert.equal(bolt.speed, 320)
  assert.equal(enemy.nextMothAttack, 'dive')
})

test('decisions are staggered so not every enemy decides on the same frame', () => {
  const a = createEnemy(1, wolf, { x: 150, y: 0 }, createSeededRandom(11))
  const b = createEnemy(2, wolf, { x: 150, y: 0 }, createSeededRandom(99))
  assert.notEqual(a.decisionRemaining, b.decisionRemaining)
})
