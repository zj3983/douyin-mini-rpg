import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  cancelEnemyCombatActorAttacks,
  consumeEnemyCombatCommand,
  createEnemyCombatResolverAdapter,
  drainEnemyCombatDamage,
  drainEnemyTelegraphs,
  enemyCombatAdapterSnapshot,
  pauseEnemyCombatResolverAdapter,
  removeEnemyCombatActor,
  resetEnemyCombatResolverAdapter,
  stepEnemyCombatResolverAdapter,
  upsertEnemyCombatActor,
  upsertPlayerCombatActor,
} from '../assets/Scripts/Game/EnemyCombatResolverAdapter.ts'
import {
  createEnemyBrain,
  hurtEnemyBrain,
  mapEnemyAnimationAction,
  stepEnemyBrain,
} from '../assets/Scripts/Combat/EnemyBrain.ts'

const bounds = Object.freeze({ minX: -360, maxX: 360, minY: -140, maxY: 240 })

function player(adapter, generation, position = { x: 0, y: -80 }) {
  return upsertPlayerCombatActor(adapter, { generation, position, radius: 22, alive: true })
}

function enemy(adapter, generation, enemyId = 1, position = { x: 0, y: -80 }, alive = true) {
  return upsertEnemyCombatActor(adapter, { generation, enemyId, position, radius: 28, alive })
}

function hitboxCommand(overrides = {}) {
  return Object.freeze({
    type: 'activate-hitbox',
    attackId: 'wolf-pounce:1:1',
    area: Object.freeze({ minX: -30, maxX: 30, minY: -110, maxY: -50 }),
    damage: 3,
    duration: 0.12,
    ...overrides,
  })
}

function projectileCommand(overrides = {}) {
  return Object.freeze({
    type: 'spawn-projectile',
    attackId: 'moth-spirit-orb:2:1',
    origin: Object.freeze({ x: -120, y: -80 }),
    velocity: Object.freeze({ x: 960, y: 0 }),
    radius: 8,
    damage: 3,
    duration: 1,
    ...overrides,
  })
}

function assertDeepFrozen(value) {
  if (value === null || typeof value !== 'object') return
  assert.equal(Object.isFrozen(value), true)
  for (const nested of Object.values(value)) assertDeepFrozen(nested)
}

test('idle actor overlap causes zero damage while telegraphs are delivered immutably', () => {
  const adapter = createEnemyCombatResolverAdapter(1)
  player(adapter, 1)
  enemy(adapter, 1)
  stepEnemyCombatResolverAdapter(adapter, 0.25)
  assert.deepEqual(drainEnemyCombatDamage(adapter), [])

  assert.equal(consumeEnemyCombatCommand(adapter, 1, 1, Object.freeze({
    type: 'show-telegraph',
    attackId: 'wolf-pounce:1:1',
    area: Object.freeze({ minX: -30, maxX: 30, minY: -110, maxY: -50 }),
    duration: 0.45,
  })), true)
  const telegraphs = drainEnemyTelegraphs(adapter)
  assert.deepEqual(telegraphs, [{
    enemyId: 1,
    attackId: 'wolf-pounce:1:1',
    area: { minX: -30, maxX: 30, minY: -110, maxY: -50 },
    duration: 0.45,
    visibleAt: 0.25,
    activationNotBefore: 0.7,
    generation: 1,
  }])
  assertDeepFrozen(telegraphs)
  assert.deepEqual(drainEnemyCombatDamage(adapter), [])
})

test('active command opens one timed attack instance and damages the player once', () => {
  const adapter = createEnemyCombatResolverAdapter(3)
  player(adapter, 3)
  enemy(adapter, 3)
  assert.equal(consumeEnemyCombatCommand(adapter, 3, 1, hitboxCommand()), true)

  stepEnemyCombatResolverAdapter(adapter, 1 / 60)
  const first = drainEnemyCombatDamage(adapter)
  assert.equal(first.length, 1)
  assert.deepEqual(first[0], {
    enemyId: 1,
    sourceId: 'enemy:1',
    attackId: 'wolf-pounce:1:1',
    attackInstanceId: 1,
    amount: 3,
    at: 0,
    generation: 3,
    delivery: 'hitbox',
  })
  assertDeepFrozen(first)

  stepEnemyCombatResolverAdapter(adapter, 0.25)
  assert.deepEqual(drainEnemyCombatDamage(adapter), [])
})

test('projectile commands use swept resolution and source removal despawns them', () => {
  const adapter = createEnemyCombatResolverAdapter(4)
  player(adapter, 4)
  enemy(adapter, 4, 2, { x: -120, y: 40 })
  consumeEnemyCombatCommand(adapter, 4, 2, projectileCommand())
  stepEnemyCombatResolverAdapter(adapter, 0.25)
  const damage = drainEnemyCombatDamage(adapter)
  assert.equal(damage.length, 1)
  assert.equal(damage[0].delivery, 'projectile')

  consumeEnemyCombatCommand(adapter, 4, 2, projectileCommand({ attackId: 'moth-spirit-orb:2:2' }))
  assert.equal(enemyCombatAdapterSnapshot(adapter).projectileCount, 2)
  assert.equal(removeEnemyCombatActor(adapter, 4, 2), true)
  assert.equal(enemyCombatAdapterSnapshot(adapter).projectileCount, 0)
  stepEnemyCombatResolverAdapter(adapter, 0.25)
  assert.deepEqual(drainEnemyCombatDamage(adapter), [])
})

test('generation reset clears attacks and rejects stale actor updates and commands', () => {
  const adapter = createEnemyCombatResolverAdapter(7)
  player(adapter, 7)
  enemy(adapter, 7)
  consumeEnemyCombatCommand(adapter, 7, 1, hitboxCommand({ duration: 1 }))
  assert.equal(enemyCombatAdapterSnapshot(adapter).hitboxCount, 1)

  assert.equal(resetEnemyCombatResolverAdapter(adapter, 8), 8)
  assert.equal(enemyCombatAdapterSnapshot(adapter).hitboxCount, 0)
  assert.equal(player(adapter, 7), false)
  assert.equal(enemy(adapter, 7), false)
  assert.equal(consumeEnemyCombatCommand(adapter, 7, 1, hitboxCommand()), false)
  stepEnemyCombatResolverAdapter(adapter, 0.25)
  assert.deepEqual(drainEnemyCombatDamage(adapter), [])

  player(adapter, 8)
  enemy(adapter, 8)
  consumeEnemyCombatCommand(adapter, 8, 1, hitboxCommand())
  stepEnemyCombatResolverAdapter(adapter, 1 / 60)
  assert.equal(drainEnemyCombatDamage(adapter).length, 1)
})

test('unregistered enemy ids cannot create telegraphs hitboxes or projectiles', () => {
  const adapter = createEnemyCombatResolverAdapter(10)
  player(adapter, 10)

  assert.equal(consumeEnemyCombatCommand(adapter, 10, 999, hitboxCommand()), false)
  assert.equal(consumeEnemyCombatCommand(adapter, 10, 999, projectileCommand()), false)
  assert.equal(consumeEnemyCombatCommand(adapter, 10, 999, Object.freeze({
    type: 'show-telegraph',
    attackId: 'unknown:999:1',
    area: Object.freeze({ minX: -10, maxX: 10, minY: -10, maxY: 10 }),
    duration: 0.4,
  })), false)
  stepEnemyCombatResolverAdapter(adapter, 0.25)

  assert.deepEqual(drainEnemyCombatDamage(adapter), [])
  assert.deepEqual(drainEnemyTelegraphs(adapter), [])
  assert.equal(enemyCombatAdapterSnapshot(adapter).hitboxCount, 0)
  assert.equal(enemyCombatAdapterSnapshot(adapter).projectileCount, 0)
})

test('hurt cancels old source attacks before the player enters their former area', () => {
  const adapter = createEnemyCombatResolverAdapter(11)
  const brain = createEnemyBrain('moss-wolf', 4, { x: 0, y: -80 }, 4)
  player(adapter, 11, { x: 180, y: -80 })
  enemy(adapter, 11, 4, brain.position)
  assert.equal(consumeEnemyCombatCommand(adapter, 11, 4, hitboxCommand({
    attackId: 'wolf-pounce:4:1',
    duration: 2,
  })), true)
  assert.equal(consumeEnemyCombatCommand(adapter, 11, 4, projectileCommand({
    attackId: 'moth-orb:4:1',
    origin: { x: -100, y: -80 },
    velocity: { x: 100, y: 0 },
    duration: 2,
  })), true)

  assert.equal(cancelEnemyCombatActorAttacks(adapter, 11, 4), true)
  assert.equal(hurtEnemyBrain(brain, brain.elapsed).some((command) => command.type === 'animate'), true)
  assert.equal(brain.phase, 'hurt')
  player(adapter, 11, { x: 0, y: -80 })
  stepEnemyCombatResolverAdapter(adapter, 0.25)

  assert.deepEqual(drainEnemyCombatDamage(adapter), [])
  assert.equal(enemyCombatAdapterSnapshot(adapter).hitboxCount, 0)
  assert.equal(enemyCombatAdapterSnapshot(adapter).projectileCount, 0)
})

test('18 enemies remain bounded during a long freeze and resume without queued attacks', () => {
  const adapter = createEnemyCombatResolverAdapter(12)
  player(adapter, 12)
  for (let enemyId = 1; enemyId <= 18; enemyId += 1) enemy(adapter, 12, enemyId)

  assert.equal(pauseEnemyCombatResolverAdapter(adapter, 12, true), true)
  for (let tick = 0; tick < 1000; tick += 1) {
    for (let enemyId = 1; enemyId <= 18; enemyId += 1) {
      assert.equal(consumeEnemyCombatCommand(adapter, 12, enemyId, hitboxCommand({
        attackId: `frozen:${enemyId}:${tick}`,
        duration: 1,
      })), false)
    }
    stepEnemyCombatResolverAdapter(adapter, 0.25)
  }
  assert.equal(enemyCombatAdapterSnapshot(adapter).hitboxCount, 0)
  assert.deepEqual(drainEnemyCombatDamage(adapter), [])

  assert.equal(pauseEnemyCombatResolverAdapter(adapter, 12, false), true)
  for (let enemyId = 1; enemyId <= 18; enemyId += 1) {
    enemy(adapter, 12, enemyId)
    assert.equal(consumeEnemyCombatCommand(adapter, 12, enemyId, hitboxCommand({
      attackId: `resumed:${enemyId}`,
    })), true)
  }
  stepEnemyCombatResolverAdapter(adapter, 1 / 60)
  assert.equal(drainEnemyCombatDamage(adapter).length, 18)
})

test('pool reuse and generation reset cancel old authority before an id can attack again', () => {
  const adapter = createEnemyCombatResolverAdapter(20)
  player(adapter, 20)
  enemy(adapter, 20, 7)
  consumeEnemyCombatCommand(adapter, 20, 7, hitboxCommand({ attackId: 'old-pool', duration: 3 }))
  consumeEnemyCombatCommand(adapter, 20, 7, projectileCommand({ attackId: 'old-orb', duration: 3 }))
  assert.equal(removeEnemyCombatActor(adapter, 20, 7), true)
  assert.equal(consumeEnemyCombatCommand(adapter, 20, 7, hitboxCommand({ attackId: 'removed' })), false)
  assert.equal(enemyCombatAdapterSnapshot(adapter).hitboxCount, 0)
  assert.equal(enemyCombatAdapterSnapshot(adapter).projectileCount, 0)

  enemy(adapter, 20, 7)
  assert.equal(consumeEnemyCombatCommand(adapter, 20, 7, hitboxCommand({ attackId: 'reused' })), true)
  assert.equal(resetEnemyCombatResolverAdapter(adapter, 21), 21)
  assert.equal(consumeEnemyCombatCommand(adapter, 20, 7, hitboxCommand({ attackId: 'stale-generation' })), false)
  player(adapter, 21)
  enemy(adapter, 21, 7)
  stepEnemyCombatResolverAdapter(adapter, 0.25)
  assert.deepEqual(drainEnemyCombatDamage(adapter), [])
})

test('freeze, death cancellation, pool removal, and generation reset discard delayed telegraph hitboxes', () => {
  const setup = (generation) => {
    const adapter = createEnemyCombatResolverAdapter(generation)
    player(adapter, generation)
    enemy(adapter, generation)
    consumeEnemyCombatCommand(adapter, generation, 1, {
      type: 'show-telegraph',
      attackId: 'bamboo-sweep:1:pending',
      area: { minX: -30, maxX: 30, minY: -110, maxY: -50 },
      duration: 0.8,
    })
    consumeEnemyCombatCommand(adapter, generation, 1, hitboxCommand({
      attackId: 'bamboo-sweep:1:pending',
      duration: 0.18,
    }))
    assert.equal(enemyCombatAdapterSnapshot(adapter).hitboxCount, 0)
    return adapter
  }
  const assertSilent = (adapter) => {
    for (let index = 0; index < 5; index += 1) stepEnemyCombatResolverAdapter(adapter, 0.25)
    assert.deepEqual(drainEnemyCombatDamage(adapter), [])
    assert.equal(enemyCombatAdapterSnapshot(adapter).hitboxCount, 0)
  }

  const frozen = setup(31)
  assert.equal(pauseEnemyCombatResolverAdapter(frozen, 31, true), true)
  assertSilent(frozen)

  const defeated = setup(32)
  assert.equal(cancelEnemyCombatActorAttacks(defeated, 32, 1), true)
  assertSilent(defeated)

  const pooled = setup(33)
  assert.equal(removeEnemyCombatActor(pooled, 33, 1), true)
  assertSilent(pooled)

  const rebuilt = setup(34)
  assert.equal(resetEnemyCombatResolverAdapter(rebuilt, 35), 35)
  assertSilent(rebuilt)
})

test('real brain commands map to the current atlas and live damage begins only at the active frame', () => {
  const manifest = JSON.parse(readFileSync(new URL('../assets/resources/Data/animation-atlas.json', import.meta.url), 'utf8'))
  const available = manifest.actors.find((actor) => actor.id === 'moss-wolf').actions.map((action) => action.name)
  const adapter = createEnemyCombatResolverAdapter(9)
  const brain = createEnemyBrain('moss-wolf', 1, { x: 260, y: -80 }, 19)
  player(adapter, 9)
  enemy(adapter, 9, 1, brain.position)
  let now = 0
  let activeSeen = false
  let damageBeforeActive = 0
  let damageAfterActive = 0

  while (now < 4 && damageAfterActive === 0) {
    now += 1 / 60
    const commands = stepEnemyBrain(brain, {
      now,
      player: { id: 'player', position: { x: 0, y: -80 }, alive: true },
      neighbors: [],
      battleBounds: bounds,
    }, 1 / 60)
    enemy(adapter, 9, 1, brain.position)
    for (const command of commands) {
      if (command.type === 'animate') assert.ok(available.includes(mapEnemyAnimationAction('moss-wolf', command.action)))
      if (command.type === 'activate-hitbox') activeSeen = true
      consumeEnemyCombatCommand(adapter, 9, 1, command)
    }
    stepEnemyCombatResolverAdapter(adapter, 1 / 60)
    const damage = drainEnemyCombatDamage(adapter).length
    if (activeSeen) damageAfterActive += damage
    else damageBeforeActive += damage
  }

  assert.equal(damageBeforeActive, 0)
  assert.equal(activeSeen, true)
  assert.equal(damageAfterActive, 1)
  assert.equal(drainEnemyTelegraphs(adapter).length >= 1, true)
})
