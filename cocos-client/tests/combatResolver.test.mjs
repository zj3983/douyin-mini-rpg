import assert from 'node:assert/strict'
import test from 'node:test'

import {
  closeHitbox,
  CombatResolver,
  createCombatResolver,
  drainDamageEvents,
  openHitbox,
  registerHurtbox,
  removeHurtbox,
  resetCombatResolverGeneration,
  spawnProjectile,
  stepCombatResolver,
  updateHurtbox,
} from '../assets/Scripts/Combat/CombatResolver.ts'

const box = (x, y, half = 10) => ({ minX: x - half, maxX: x + half, minY: y - half, maxY: y + half })

function hitbox(resolver, overrides = {}) {
  return openHitbox(resolver, {
    sourceId: 'wolf:1',
    attackId: 'wolf-pounce:1:1',
    area: box(0, 0, 20),
    damage: 3,
    duration: 0.1,
    generation: resolver.generation,
    ...overrides,
  })
}

function projectile(resolver, overrides = {}) {
  return spawnProjectile(resolver, {
    sourceId: 'moth:1',
    attackId: 'moth-spirit-orb:1:1',
    origin: { x: -100, y: 0 },
    velocity: { x: 800, y: 0 },
    radius: 5,
    damage: 3,
    duration: 1,
    generation: resolver.generation,
    ...overrides,
  })
}

function assertDeepFrozen(value) {
  if (value === null || typeof value !== 'object') return
  assert.equal(Object.isFrozen(value), true)
  for (const nested of Object.values(value)) assertDeepFrozen(nested)
}

test('overlapping hurtboxes are passive and resolve no contact damage', () => {
  const resolver = createCombatResolver()
  registerHurtbox(resolver, { actorId: 'player', area: box(0, 0), generation: resolver.generation })
  registerHurtbox(resolver, { actorId: 'wolf:1', area: box(0, 0), generation: resolver.generation })

  stepCombatResolver(resolver, 0.25)
  assert.deepEqual(drainDamageEvents(resolver), [])
})

test('an active hitbox damages each target once per attack instance and expires', () => {
  const resolver = createCombatResolver()
  registerHurtbox(resolver, { actorId: 'player', area: box(0, 0), generation: resolver.generation })
  const attackInstanceId = hitbox(resolver)
  assert.equal(typeof attackInstanceId, 'number')

  stepCombatResolver(resolver, 0.04)
  const first = drainDamageEvents(resolver)
  assert.equal(first.length, 1)
  assert.deepEqual(first[0], {
    type: 'damage',
    sourceId: 'wolf:1',
    targetId: 'player',
    attackId: 'wolf-pounce:1:1',
    attackInstanceId,
    amount: 3,
    at: 0,
    generation: 1,
    delivery: 'hitbox',
  })

  stepCombatResolver(resolver, 0.04)
  stepCombatResolver(resolver, 0.04)
  assert.deepEqual(drainDamageEvents(resolver), [])
  assert.equal(closeHitbox(resolver, attackInstanceId, resolver.generation), false)
})

test('closing an active hitbox is immediate and idempotent', () => {
  const resolver = createCombatResolver()
  registerHurtbox(resolver, { actorId: 'player', area: box(0, 0), generation: resolver.generation })
  const attackInstanceId = hitbox(resolver, { duration: 1 })

  assert.equal(closeHitbox(resolver, attackInstanceId, resolver.generation), true)
  assert.equal(closeHitbox(resolver, attackInstanceId, resolver.generation), false)
  stepCombatResolver(resolver, 0.25)
  assert.deepEqual(drainDamageEvents(resolver), [])
})

test('closing a hitbox releases its bounded per-attack hit records', () => {
  const resolver = createCombatResolver({ maxHitRecords: 1 })
  registerHurtbox(resolver, { actorId: 'player', area: box(0, 0), generation: resolver.generation })
  const first = hitbox(resolver, { duration: 1 })
  stepCombatResolver(resolver, 1 / 60)
  assert.equal(drainDamageEvents(resolver).length, 1)
  assert.equal(closeHitbox(resolver, first, resolver.generation), true)

  hitbox(resolver, { duration: 1 })
  stepCombatResolver(resolver, 1 / 60)
  assert.equal(drainDamageEvents(resolver).length, 1)
})

test('swept projectiles hit deterministically without tunneling and only once per target', () => {
  const resolver = createCombatResolver()
  registerHurtbox(resolver, { actorId: 'later', area: box(40, 0), generation: resolver.generation })
  registerHurtbox(resolver, { actorId: 'first-b', area: box(-20, 0), generation: resolver.generation })
  registerHurtbox(resolver, { actorId: 'first-a', area: box(-20, 0), generation: resolver.generation })
  const attackInstanceId = projectile(resolver)

  stepCombatResolver(resolver, 0.25)
  const events = drainDamageEvents(resolver)
  assert.deepEqual(events.map((event) => event.targetId), ['first-a', 'first-b', 'later'])
  assert.equal(events.every((event) => event.attackInstanceId === attackInstanceId), true)
  assert.equal(events.every((event) => event.delivery === 'projectile'), true)
  assert.equal(events.every((event) => Number.isFinite(event.at)), true)

  stepCombatResolver(resolver, 0.25)
  assert.deepEqual(drainDamageEvents(resolver), [])
})

test('parallel spirit orbs preserve a traversable gap', () => {
  const resolver = createCombatResolver()
  registerHurtbox(resolver, { actorId: 'player', area: box(0, 0), generation: resolver.generation })
  projectile(resolver, { origin: { x: -100, y: -55 } })
  projectile(resolver, { origin: { x: -100, y: 55 } })

  stepCombatResolver(resolver, 0.25)
  assert.deepEqual(drainDamageEvents(resolver), [])
})

test('dead targets and removed hurtboxes are excluded idempotently', () => {
  const resolver = createCombatResolver()
  registerHurtbox(resolver, { actorId: 'player', area: box(0, 0), alive: false, generation: resolver.generation })
  hitbox(resolver)
  stepCombatResolver(resolver, 0.05)
  assert.deepEqual(drainDamageEvents(resolver), [])

  assert.equal(updateHurtbox(resolver, 'player', { alive: true, generation: resolver.generation }), true)
  const nextAttack = hitbox(resolver)
  assert.equal(removeHurtbox(resolver, 'player', resolver.generation), true)
  assert.equal(removeHurtbox(resolver, 'player', resolver.generation), false)
  stepCombatResolver(resolver, 0.05)
  assert.deepEqual(drainDamageEvents(resolver), [])
  assert.equal(closeHitbox(resolver, nextAttack, resolver.generation), true)
})

test('dead sources close hitboxes and despawn source-owned ordinary projectiles', () => {
  const resolver = createCombatResolver()
  registerHurtbox(resolver, { actorId: 'wolf:1', area: box(-80, 0), generation: resolver.generation })
  registerHurtbox(resolver, { actorId: 'player', area: box(0, 0), generation: resolver.generation })
  hitbox(resolver, { area: box(0, 0), duration: 1 })
  projectile(resolver, {
    sourceId: 'wolf:1',
    attackId: 'wolf-projectile-test',
    origin: { x: -100, y: 0 },
    duration: 1,
  })
  assert.deepEqual({ hitboxes: resolver.snapshot().hitboxCount, projectiles: resolver.snapshot().projectileCount }, {
    hitboxes: 1,
    projectiles: 1,
  })

  assert.equal(updateHurtbox(resolver, 'wolf:1', { alive: false, generation: resolver.generation }), true)
  assert.deepEqual({ hitboxes: resolver.snapshot().hitboxCount, projectiles: resolver.snapshot().projectileCount }, {
    hitboxes: 0,
    projectiles: 0,
  })
  stepCombatResolver(resolver, 0.25)
  assert.deepEqual(drainDamageEvents(resolver), [])

  hitbox(resolver, { duration: 1 })
  stepCombatResolver(resolver, 1 / 60)
  assert.deepEqual(drainDamageEvents(resolver), [])
  assert.equal(updateHurtbox(resolver, 'wolf:1', { alive: true, generation: resolver.generation }), true)
  hitbox(resolver, { duration: 1 })
  stepCombatResolver(resolver, 1 / 60)
  assert.equal(drainDamageEvents(resolver).length, 1)
})

test('removing a source is idempotent and suppresses all attacks it already owns', () => {
  const resolver = createCombatResolver()
  registerHurtbox(resolver, { actorId: 'moth:1', area: box(-80, 0), generation: resolver.generation })
  registerHurtbox(resolver, { actorId: 'player', area: box(0, 0), generation: resolver.generation })
  projectile(resolver, { sourceId: 'moth:1', duration: 1 })

  assert.equal(removeHurtbox(resolver, 'moth:1', resolver.generation), true)
  assert.equal(removeHurtbox(resolver, 'moth:1', resolver.generation), false)
  assert.equal(resolver.snapshot().projectileCount, 0)
  stepCombatResolver(resolver, 0.25)
  assert.deepEqual(drainDamageEvents(resolver), [])
})

test('generation reset clears authority and rejects stale registrations and attacks', () => {
  const resolver = createCombatResolver()
  const stale = resolver.generation
  registerHurtbox(resolver, { actorId: 'player', area: box(0, 0), generation: stale })
  hitbox(resolver)
  projectile(resolver)

  assert.equal(resetCombatResolverGeneration(resolver), 2)
  assert.equal(resolver.generation, 2)
  assert.equal(registerHurtbox(resolver, { actorId: 'stale', area: box(0, 0), generation: stale }), false)
  assert.equal(openHitbox(resolver, {
    sourceId: 'wolf:1', attackId: 'stale', area: box(0, 0), damage: 1, duration: 1, generation: stale,
  }), null)
  assert.equal(projectile(resolver, { generation: stale }), null)
  stepCombatResolver(resolver, 0.25)
  assert.deepEqual(drainDamageEvents(resolver), [])

  registerHurtbox(resolver, { actorId: 'player', area: box(0, 0), generation: resolver.generation })
  hitbox(resolver)
  stepCombatResolver(resolver, 1 / 60)
  assert.equal(drainDamageEvents(resolver).length, 1)
  assert.equal(resetCombatResolverGeneration(resolver, 7), 7)
  registerHurtbox(resolver, { actorId: 'survivor', area: box(0, 0), generation: 7 })
  const beforeIdempotentReset = resolver.snapshot()
  assert.equal(resetCombatResolverGeneration(resolver, 7), 7)
  assert.deepEqual(resolver.snapshot(), beforeIdempotentReset)
})

test('capacities reject overflow without evicting live authority', () => {
  const hurtboxes = createCombatResolver({ maxHurtboxes: 1 })
  registerHurtbox(hurtboxes, { actorId: 'one', area: box(0, 0), generation: 1 })
  assert.throws(
    () => registerHurtbox(hurtboxes, { actorId: 'two', area: box(0, 0), generation: 1 }),
    /hurtbox capacity/,
  )
  assert.equal(updateHurtbox(hurtboxes, 'one', { area: box(5, 0), generation: 1 }), true)

  const hitboxes = createCombatResolver({ maxHitboxes: 1 })
  hitbox(hitboxes)
  assert.throws(() => hitbox(hitboxes), /hitbox capacity/)

  const projectiles = createCombatResolver({ maxProjectiles: 1 })
  projectile(projectiles)
  assert.throws(() => projectile(projectiles), /projectile capacity/)

  const events = createCombatResolver({ maxDamageEvents: 1 })
  registerHurtbox(events, { actorId: 'a', area: box(0, 0), generation: 1 })
  registerHurtbox(events, { actorId: 'b', area: box(0, 0), generation: 1 })
  hitbox(events)
  assert.throws(() => stepCombatResolver(events, 1 / 60), /damage event capacity/)
})

test('invalid geometry, lifetime, damage, generation, and delta are rejected or inert', () => {
  assert.throws(() => createCombatResolver({ maxHurtboxes: 0 }), /positive safe integer/)
  const resolver = createCombatResolver()
  for (const area of [
    { minX: NaN, maxX: 1, minY: 0, maxY: 1 },
    { minX: 2, maxX: 1, minY: 0, maxY: 1 },
  ]) {
    assert.throws(() => registerHurtbox(resolver, { actorId: 'bad', area, generation: 1 }), /area/)
  }
  assert.throws(() => hitbox(resolver, { damage: Infinity }), /damage/)
  assert.throws(() => hitbox(resolver, { duration: 0 }), /duration/)
  assert.throws(() => projectile(resolver, { velocity: { x: NaN, y: 0 } }), /velocity/)
  assert.throws(() => projectile(resolver, { radius: -1 }), /radius/)
  assert.throws(() => resetCombatResolverGeneration(resolver, 0), /generation/)

  const snapshot = resolver.snapshot()
  for (const delta of [0, -1, NaN, -Infinity]) {
    stepCombatResolver(resolver, delta)
    assert.deepEqual(resolver.snapshot(), snapshot)
  }
})

test('resolver authority cannot be forged and drained events are recursively immutable', () => {
  const resolver = createCombatResolver()
  assert.ok(resolver instanceof CombatResolver)
  assert.deepEqual(Object.keys(resolver), [])
  assert.throws(() => registerHurtbox({ ...resolver }, { actorId: 'x', area: box(0, 0), generation: 1 }), /CombatResolver/)
  registerHurtbox(resolver, { actorId: 'player', area: box(0, 0), generation: 1 })
  hitbox(resolver)
  stepCombatResolver(resolver, 1 / 60)
  const events = drainDamageEvents(resolver)
  assertDeepFrozen(events)
  assert.throws(() => events.push(events[0]), TypeError)
  assert.throws(() => { events[0].amount = 99 }, TypeError)
  assert.deepEqual(drainDamageEvents(resolver), [])
})
