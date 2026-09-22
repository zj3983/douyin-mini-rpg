import test from 'node:test'
import assert from 'node:assert/strict'
import {
  beginFinalFight,
  beginFirstHunt,
  beginSecondHunt,
  createPursuitBoss,
  damagePursuer,
  snapshotPursuitBoss,
  unlockTrueForm,
} from '../assets/Scripts/Core/Dungeon/PursuitBossRuntime.ts'

const createBoss = () => createPursuitBoss({ firstShield: 180, secondShield: 260, finalHealth: 1200 })

test('the pursuer is repelled twice before its true form can take final damage', () => {
  const boss = createBoss()

  assert.equal(beginFirstHunt(boss), true)
  assert.equal(damagePursuer(boss, 999).event.type, 'pursuer-repelled')
  assert.deepEqual(beginSecondHunt(boss), {
    ok: true,
    event: { type: 'route-seal-requested', reason: 'second-hunt-started', hunt: 2 },
  })
  assert.equal(damagePursuer(boss, 999).event.type, 'pursuer-repelled')
  assert.deepEqual(beginFinalFight(boss), { ok: false, reason: 'altar-locked' })
  assert.equal(unlockTrueForm(boss, 'f3-altar'), true)
  assert.deepEqual(beginFinalFight(boss), { ok: true })
  assert.equal(damagePursuer(boss, 1200).event.type, 'pursuer-defeated')
  assert.deepEqual(boss, {
    phase: 'defeated',
    shield: 0,
    finalHealth: 0,
    altarUnlocked: true,
    firstShieldMax: 180,
    secondShieldMax: 260,
    finalHealthMax: 1200,
  })
})

test('partial shield and health damage report the remaining pool', () => {
  const boss = createBoss()

  beginFirstHunt(boss)
  assert.deepEqual(damagePursuer(boss, 60), {
    ok: true,
    event: { type: 'pursuer-shield-damaged', remaining: 120 },
  })
  damagePursuer(boss, 120)
  beginSecondHunt(boss)
  assert.deepEqual(damagePursuer(boss, 10), {
    ok: true,
    event: { type: 'pursuer-shield-damaged', remaining: 250 },
  })
  damagePursuer(boss, 250)
  unlockTrueForm(boss, 'f3-altar')
  beginFinalFight(boss)
  assert.deepEqual(damagePursuer(boss, 200), {
    ok: true,
    event: { type: 'pursuer-health-damaged', remaining: 1000 },
  })
})

test('excess hunt damage cannot spill into final health', () => {
  const boss = createBoss()

  beginFirstHunt(boss)
  assert.deepEqual(damagePursuer(boss, Number.MAX_SAFE_INTEGER), {
    ok: true,
    event: { type: 'pursuer-repelled', phase: 'first-repelled' },
  })
  assert.equal(boss.shield, 0)
  assert.equal(boss.finalHealth, 1200)

  beginSecondHunt(boss)
  assert.equal(boss.shield, 260)
  assert.deepEqual(damagePursuer(boss, Number.MAX_SAFE_INTEGER), {
    ok: true,
    event: { type: 'pursuer-repelled', phase: 'second-repelled' },
  })
  assert.equal(boss.finalHealth, 1200)
})

test('invalid configuration is rejected', () => {
  for (const value of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_VALUE]) {
    assert.throws(() => createPursuitBoss({ firstShield: value, secondShield: 260, finalHealth: 1200 }), TypeError)
    assert.throws(() => createPursuitBoss({ firstShield: 180, secondShield: value, finalHealth: 1200 }), TypeError)
    assert.throws(() => createPursuitBoss({ firstShield: 180, secondShield: 260, finalHealth: value }), TypeError)
  }
})

test('invalid damage is atomic in every damageable phase', () => {
  for (const amount of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_VALUE]) {
    const boss = createBoss()
    beginFirstHunt(boss)
    const before = structuredClone(boss)
    assert.deepEqual(damagePursuer(boss, amount), { ok: false, reason: 'invalid-damage' })
    assert.deepEqual(boss, before)
  }
})

test('wrong and repeated transitions cannot skip or reset the state machine', () => {
  const boss = createBoss()

  assert.deepEqual(beginSecondHunt(boss), { ok: false, reason: 'invalid-phase' })
  assert.deepEqual(beginFinalFight(boss), { ok: false, reason: 'invalid-phase' })
  assert.equal(unlockTrueForm(boss, 'f3-altar'), false)
  assert.equal(beginFirstHunt(boss), true)
  assert.equal(beginFirstHunt(boss), false)
  damagePursuer(boss, 180)
  assert.deepEqual(beginSecondHunt(boss).event, {
    type: 'route-seal-requested',
    reason: 'second-hunt-started',
    hunt: 2,
  })
  const secondHunt = structuredClone(boss)
  assert.deepEqual(beginSecondHunt(boss), { ok: false, reason: 'invalid-phase' })
  assert.deepEqual(boss, secondHunt)
})

test('repelled and defeated phases cannot emit duplicate reward events', () => {
  const boss = createBoss()

  beginFirstHunt(boss)
  damagePursuer(boss, 180)
  assert.deepEqual(damagePursuer(boss, 1), { ok: false, reason: 'not-damageable' })
  beginSecondHunt(boss)
  damagePursuer(boss, 260)
  assert.deepEqual(damagePursuer(boss, 1), { ok: false, reason: 'not-damageable' })
  unlockTrueForm(boss, 'f3-altar')
  beginFinalFight(boss)
  damagePursuer(boss, 1200)
  assert.deepEqual(damagePursuer(boss, 1), { ok: false, reason: 'not-damageable' })
})

test('only the floor-three altar unlocks the true form after the second repel', () => {
  const boss = createBoss()

  assert.equal(unlockTrueForm(boss, 'f3-altar'), false)
  beginFirstHunt(boss)
  damagePursuer(boss, 180)
  beginSecondHunt(boss)
  damagePursuer(boss, 260)

  const before = structuredClone(boss)
  assert.equal(unlockTrueForm(boss, 'f2-gate-elite'), false)
  assert.deepEqual(boss, before)
  assert.equal(unlockTrueForm(boss, 'f3-altar'), true)
  const unlocked = structuredClone(boss)
  assert.equal(unlockTrueForm(boss, 'f3-altar'), false)
  assert.deepEqual(boss, unlocked)
})

test('beginning the final fight cannot reset health', () => {
  const boss = createBoss()
  beginFirstHunt(boss)
  damagePursuer(boss, 180)
  beginSecondHunt(boss)
  damagePursuer(boss, 260)
  unlockTrueForm(boss, 'f3-altar')

  assert.deepEqual(beginFinalFight(boss), { ok: true })
  damagePursuer(boss, 200)
  assert.deepEqual(beginFinalFight(boss), { ok: false, reason: 'invalid-phase' })
  assert.equal(boss.finalHealth, 1000)
})

test('snapshots are isolated, serializable, and can resume the next transition', () => {
  const boss = createBoss()
  beginFirstHunt(boss)
  damagePursuer(boss, 180)

  const snapshot = snapshotPursuitBoss(JSON.parse(JSON.stringify(boss)))
  assert.notEqual(snapshot, boss)
  assert.deepEqual(beginSecondHunt(snapshot), {
    ok: true,
    event: { type: 'route-seal-requested', reason: 'second-hunt-started', hunt: 2 },
  })
  assert.equal(boss.phase, 'first-repelled')

  snapshot.shield = 1
  assert.equal(boss.shield, 0)
})

test('snapshot validation rejects impossible restored states without mutating them', () => {
  const invalidStates = [
    { ...createBoss(), phase: 'first-hunt', shield: 0 },
    { ...createBoss(), phase: 'second-hunt', shield: 999 },
    { ...createBoss(), phase: 'true-form-locked', altarUnlocked: false },
    { ...createBoss(), phase: 'defeated', finalHealth: 1, altarUnlocked: true },
  ]

  for (const state of invalidStates) {
    const before = structuredClone(state)
    assert.throws(() => snapshotPursuitBoss(state), TypeError)
    assert.deepEqual(state, before)
  }
})
