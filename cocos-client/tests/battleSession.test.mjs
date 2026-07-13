import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  advanceBattleSession,
  createBattleSession,
  drainCombatEvents,
  registerEnemyDefeat,
  settleBattleSession,
} from '../assets/Scripts/Combat/BattleSession.ts'
import { parseStageOneConfig } from '../assets/Scripts/Combat/StageOneConfig.ts'

const sourceUrl = new URL('../assets/Data/stage-one-combat.json', import.meta.url)
const resourceUrl = new URL('../assets/resources/Data/stage-one-combat.json', import.meta.url)
const sourceBytes = readFileSync(sourceUrl)
const sourceValue = JSON.parse(sourceBytes.toString('utf8'))
const config = parseStageOneConfig(sourceValue)

function createSession(seed = 12345) {
  return createBattleSession({ stageId: config.stageId, seed, config })
}

function advanceFor(session, seconds, step = 1 / 60) {
  const iterations = Math.round(seconds / step)
  for (let index = 0; index < iterations; index += 1) {
    advanceBattleSession(session, step)
  }
}

function aliveEnemies(session) {
  return [...session.enemies.values()].filter((enemy) => enemy.alive)
}

function ordinaryTrace(session) {
  return [...session.enemies.values()]
    .filter((enemy) => enemy.kind !== 'bamboo-warden')
    .map(({ id, kind, position, spawnedAt }) => ({ id, kind, position, spawnedAt }))
}

test('source config parses and resource JSON is byte-identical', () => {
  assert.deepEqual(config, sourceValue)
  assert.deepEqual(readFileSync(resourceUrl), sourceBytes)
  assert.equal(Object.isFrozen(config), true)
  assert.equal(Object.isFrozen(config.phaseStarts), true)
  assert.equal(Object.isFrozen(config.spawnCadenceSeconds), true)
})

test('parseStageOneConfig rejects malformed stage configuration', () => {
  const cases = [
    [null, /config must be an object/],
    [{ ...sourceValue, bossId: 'other-boss' }, /bossId must be bamboo-warden/],
    [{ ...sourceValue, stageId: Number.NaN }, /stageId must be a finite integer/],
    [{ ...sourceValue, durationSeconds: Number.POSITIVE_INFINITY }, /durationSeconds must be a positive finite integer/],
    [{ ...sourceValue, activeEnemyCap: 3.5 }, /activeEnemyCap must be a positive finite integer/],
    [{ ...sourceValue, phaseStarts: { mowing: 15, pressure: Number.NaN, boss: 60 } }, /phaseStarts.pressure must be finite/],
    [{ ...sourceValue, phaseStarts: { mowing: 40, pressure: 15, boss: 60 } }, /phaseStarts must satisfy/],
    [{ ...sourceValue, spawnCadenceSeconds: { ...sourceValue.spawnCadenceSeconds, mowing: 0 } }, /spawnCadenceSeconds.mowing must be positive and finite/],
    [{ ...sourceValue, settlementAutoContinueSeconds: 0 }, /settlementAutoContinueSeconds must be positive and finite/],
    [{ ...sourceValue, activeEnemyCap: 19 }, /activeEnemyCap must be at most 18/],
  ]

  for (const [value, expected] of cases) {
    assert.throws(() => parseStageOneConfig(value), expected)
  }
})

test('parseStageOneConfig returns a defensive immutable copy', () => {
  const input = structuredClone(sourceValue)
  const parsed = parseStageOneConfig(input)
  input.phaseStarts.mowing = 1
  input.spawnCadenceSeconds.intro = 99

  assert.equal(parsed.phaseStarts.mowing, 15)
  assert.equal(parsed.spawnCadenceSeconds.intro, 1.4)
  assert.throws(() => {
    parsed.phaseStarts.mowing = 2
  }, TypeError)
})

test('create validates the stage and emits stage-entered once', () => {
  assert.throws(
    () => createBattleSession({ stageId: 2, seed: 1, config }),
    /stageId must match config.stageId/,
  )

  const session = createSession()
  assert.equal(session.generation, 1)
  assert.deepEqual(drainCombatEvents(session), [{ type: 'stage-entered', stageId: 1, at: 0 }])
  assert.deepEqual(drainCombatEvents(session), [])
})

test('phase boundaries occur at 15, 40, and 60 seconds', () => {
  const session = createSession()
  advanceFor(session, 15)
  assert.equal(session.phase, 'mowing')
  advanceFor(session, 25)
  assert.equal(session.phase, 'pressure')
  advanceFor(session, 20)
  assert.equal(session.phase, 'boss')
  assert.equal(session.elapsed >= 60, true)
})

test('settlement is accepted exactly once across competing reasons', () => {
  const session = createSession()
  drainCombatEvents(session)

  assert.equal(settleBattleSession(session, 'button'), true)
  assert.equal(settleBattleSession(session, 'timeout'), false)
  assert.equal(settleBattleSession(session, 'boss-defeated'), false)
  assert.equal(session.phase, 'settled')
  assert.deepEqual(drainCombatEvents(session), [{ type: 'stage-settled', stageId: 1, at: 0 }])
})

test('advance clamps external delta and ignores invalid deltas', () => {
  const session = createSession()
  assert.deepEqual(advanceBattleSession(session, Number.NaN), [])
  assert.deepEqual(advanceBattleSession(session, 0), [])
  assert.deepEqual(advanceBattleSession(session, -1), [])
  advanceBattleSession(session, 10)
  assert.equal(session.elapsed, 0.25)
})

test('one 0.25 advance equals fifteen 1/60 advances', () => {
  const single = createSession(9876)
  const stepped = createSession(9876)
  advanceBattleSession(single, 0.25)
  advanceFor(stepped, 0.25)

  assert.equal(single.elapsed, stepped.elapsed)
  assert.equal(single.phase, stepped.phase)
  assert.deepEqual([...single.enemies], [...stepped.enemies])
  assert.deepEqual(drainCombatEvents(single), drainCombatEvents(stepped))
})

test('same seeds reproduce enemy kinds and positions while different seeds diverge', () => {
  const first = createSession(42)
  const second = createSession(42)
  const different = createSession(43)
  advanceFor(first, 20)
  advanceFor(second, 20)
  advanceFor(different, 20)

  assert.deepEqual(ordinaryTrace(first), ordinaryTrace(second))
  assert.notDeepEqual(ordinaryTrace(first), ordinaryTrace(different))
  for (const enemy of first.enemies.values()) {
    assert.equal(Number.isFinite(enemy.position.x), true)
    assert.equal(Number.isFinite(enemy.position.y), true)
    assert.equal(Number.isFinite(enemy.spawnedAt), true)
  }
})

test('alive enemy count is capped and the boss enters exactly once near 60 seconds', () => {
  const session = createSession()
  let maxAlive = 0
  let bossEvents = []
  for (let frame = 0; frame < 62 * 60; frame += 1) {
    bossEvents = bossEvents.concat(advanceBattleSession(session, 1 / 60).filter((event) => event.type === 'boss-entered'))
    maxAlive = Math.max(maxAlive, aliveEnemies(session).length)
  }

  const bosses = [...session.enemies.values()].filter((enemy) => enemy.kind === 'bamboo-warden')
  assert.equal(maxAlive <= 18, true)
  assert.equal(bosses.length, 1)
  assert.equal(bosses[0].alive, true)
  assert.equal(bossEvents.length, 1)
  assert.equal(bossEvents[0].at >= 59 && bossEvents[0].at <= 62, true)
  assert.equal(aliveEnemies(session).length, 1)
})

test('enemy defeat and event draining are idempotent', () => {
  const session = createSession()
  advanceFor(session, 2)
  drainCombatEvents(session)
  const enemy = aliveEnemies(session)[0]

  assert.ok(enemy)
  assert.deepEqual(registerEnemyDefeat(session, 999999), [])
  assert.deepEqual(registerEnemyDefeat(session, enemy.id), [
    { type: 'enemy-defeated', enemyId: enemy.id, at: session.elapsed },
  ])
  assert.deepEqual(registerEnemyDefeat(session, enemy.id), [])
  assert.deepEqual(drainCombatEvents(session), [
    { type: 'enemy-defeated', enemyId: enemy.id, at: session.elapsed },
  ])
  assert.deepEqual(drainCombatEvents(session), [])
})

function runDeterministicSimulation(seed) {
  const session = createSession(seed)
  const trace = []
  const ordinaryLifetime = 2.5
  let bossEnteredAt = null
  let settlementAt = null
  let maxAlive = 0

  for (let frame = 0; frame < 90 * 60 && !session.settled; frame += 1) {
    const events = advanceBattleSession(session, 1 / 60)
    for (const event of events) {
      trace.push(event)
      if (event.type === 'boss-entered') bossEnteredAt = event.at
      if (event.type === 'stage-settled') settlementAt = event.at
    }

    for (const enemy of aliveEnemies(session)) {
      const lifetime = enemy.kind === 'bamboo-warden' && bossEnteredAt !== null
        ? session.elapsed - bossEnteredAt
        : session.elapsed - enemy.spawnedAt
      const requiredLifetime = enemy.kind === 'bamboo-warden' ? 24 : ordinaryLifetime
      if (lifetime + 1e-9 >= requiredLifetime) {
        trace.push(...registerEnemyDefeat(session, enemy.id))
      }
    }
    maxAlive = Math.max(maxAlive, aliveEnemies(session).length)
  }

  return {
    bossEnteredAt,
    settlementAt: settlementAt ?? trace.find((event) => event.type === 'stage-settled')?.at ?? null,
    maxAlive,
    trace,
  }
}

test('90-second combat simulation is bounded, reproducible, and settles after boss defeat', () => {
  const first = runDeterministicSimulation(2026)
  const second = runDeterministicSimulation(2026)

  assert.deepEqual(first, second)
  assert.equal(first.bossEnteredAt >= 59 && first.bossEnteredAt <= 62, true)
  assert.equal(first.settlementAt >= 84 && first.settlementAt <= 90, true)
  assert.equal(first.maxAlive <= 18, true)
  assert.equal(first.trace.filter((event) => event.type === 'boss-entered').length, 1)
  assert.equal(first.trace.filter((event) => event.type === 'stage-settled').length, 1)
})
