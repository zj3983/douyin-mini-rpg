import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import {
  advanceBattleSession,
  BattleSession,
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

function createSession(seed = 12345, sessionConfig = config) {
  return createBattleSession({ stageId: sessionConfig.stageId, seed, config: sessionConfig })
}

function advanceFor(session, seconds, step = 1 / 60) {
  const iterations = Math.round(seconds / step)
  for (let index = 0; index < iterations; index += 1) advanceBattleSession(session, step)
}

function advanceTo(session, target, partition) {
  let index = 0
  while (session.elapsed + 1e-12 < target && !session.settled) {
    const delta = Math.min(partition[index % partition.length], target - session.elapsed)
    assert.equal(delta > 0, true)
    advanceBattleSession(session, delta)
    index += 1
    assert.equal(index < 100000, true, 'advance partition must terminate')
  }
}

function snapshots(session) {
  return session.enemySnapshots()
}

function aliveEnemies(session) {
  return snapshots(session).filter((enemy) => enemy.alive)
}

function ordinaryTrace(session) {
  return snapshots(session)
    .filter((enemy) => enemy.kind !== 'bamboo-warden')
    .map(({ id, kind, position, spawnedAt }) => ({ id, kind, position, spawnedAt }))
}

function assertDeepFrozen(value) {
  if (value === null || typeof value !== 'object') return
  assert.equal(Object.isFrozen(value), true)
  for (const nested of Object.values(value)) assertDeepFrozen(nested)
}

test('source config parses and resource JSON is byte-identical', () => {
  assert.deepEqual(config, sourceValue)
  assert.deepEqual(readFileSync(resourceUrl), sourceBytes)
  assertDeepFrozen(config)
})

test('parseStageOneConfig rejects malformed and unsafe numeric values', () => {
  const cases = [
    [null, /config must be an object/],
    [{ ...sourceValue, bossId: 'other-boss' }, /bossId must be bamboo-warden/],
    [{ ...sourceValue, stageId: 0 }, /stageId must be a positive safe integer/],
    [{ ...sourceValue, stageId: Number.NaN }, /stageId must be a positive safe integer/],
    [{ ...sourceValue, durationSeconds: Number.POSITIVE_INFINITY }, /durationSeconds must be a positive safe integer/],
    [{ ...sourceValue, durationSeconds: Number.MAX_SAFE_INTEGER + 1 }, /durationSeconds must be a positive safe integer/],
    [{ ...sourceValue, activeEnemyCap: 3.5 }, /activeEnemyCap must be a positive safe integer/],
    [{ ...sourceValue, activeEnemyCap: 19 }, /activeEnemyCap must be at most 18/],
    [{ ...sourceValue, phaseStarts: { mowing: 15, pressure: Number.NaN, boss: 60 } }, /phaseStarts.pressure must be finite/],
    [{ ...sourceValue, phaseStarts: { mowing: 40, pressure: 15, boss: 60 } }, /phaseStarts must satisfy/],
    [{ ...sourceValue, spawnCadenceSeconds: { ...sourceValue.spawnCadenceSeconds, mowing: 0 } }, /spawnCadenceSeconds.mowing must be at least 1\/120 second/],
    [{ ...sourceValue, settlementAutoContinueSeconds: 0 }, /settlementAutoContinueSeconds must be positive and finite/],
  ]

  for (const [value, expected] of cases) assert.throws(() => parseStageOneConfig(value), expected)
})

test('parseStageOneConfig returns a defensive immutable copy', () => {
  const input = structuredClone(sourceValue)
  const parsed = parseStageOneConfig(input)
  input.phaseStarts.mowing = 1
  input.spawnCadenceSeconds.intro = 99

  assert.equal(parsed.phaseStarts.mowing, 15)
  assert.equal(parsed.spawnCadenceSeconds.intro, 1.4)
  assert.throws(() => { parsed.phaseStarts.mowing = 2 }, TypeError)
})

test('minimum cadence is enforced and accepted cadence remains bounded', () => {
  for (const cadence of [Number.MIN_VALUE, 1 / 120 - Number.EPSILON]) {
    assert.throws(
      () => parseStageOneConfig({
        ...sourceValue,
        spawnCadenceSeconds: { ...sourceValue.spawnCadenceSeconds, intro: cadence },
      }),
      /spawnCadenceSeconds.intro must be at least 1\/120 second/,
    )
  }

  const minimumConfig = parseStageOneConfig({
    ...sourceValue,
    spawnCadenceSeconds: { intro: 1 / 120, mowing: 1 / 120, pressure: 1 / 120 },
  })
  const session = createSession(1, minimumConfig)
  assert.equal(advanceBattleSession(session, 0.25), undefined)
  assert.equal(aliveEnemies(session).length, 18)
})

test('create requires matching stage and a finite uint32 seed', () => {
  assert.throws(
    () => createBattleSession({ stageId: 2, seed: 1, config }),
    /stageId must match config.stageId/,
  )

  for (const seed of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, 0x100000000]) {
    assert.throws(
      () => createBattleSession({ stageId: config.stageId, seed, config }),
      /seed must be a finite uint32 integer/,
    )
  }

  for (const seed of [0, 0xffffffff]) assert.ok(createSession(seed) instanceof BattleSession)
})

test('zero and max uint32 seeds are valid, reproducible, and distinct', () => {
  const zeroA = createSession(0)
  const zeroB = createSession(0)
  const max = createSession(0xffffffff)
  advanceFor(zeroA, 20)
  advanceFor(zeroB, 20)
  advanceFor(max, 20)

  assert.deepEqual(ordinaryTrace(zeroA), ordinaryTrace(zeroB))
  assert.notDeepEqual(ordinaryTrace(zeroA), ordinaryTrace(max))
})

test('BattleSession exposes readonly scalars and no mutable authority', () => {
  const session = createSession()
  assert.equal(session.stageId, 1)
  assert.equal(session.generation, 1)
  assert.equal(session.elapsed, 0)
  assert.equal(session.phase, 'intro')
  assert.equal(session.settled, false)
  assert.equal(session.terminalReason, null)
  assert.deepEqual(Object.keys(session), [])
  assert.equal('enemies' in session, false)
  assert.equal('events' in session, false)
  assert.equal('config' in session, false)

  for (const property of ['stageId', 'generation', 'elapsed', 'phase', 'settled', 'terminalReason']) {
    const descriptor = Object.getOwnPropertyDescriptor(BattleSession.prototype, property)
    assert.equal(typeof descriptor?.get, 'function')
    assert.equal(descriptor?.set, undefined)
    assert.throws(() => { session[property] = 'tampered' }, TypeError)
  }
})

test('enemySnapshots returns deeply frozen defensive copies', () => {
  const session = createSession()
  advanceFor(session, 2)
  const first = snapshots(session)
  const enemy = first[0]
  assert.ok(enemy)
  assertDeepFrozen(first)
  assert.notEqual(first, snapshots(session))
  assert.notEqual(enemy, snapshots(session)[0])
  assert.notEqual(enemy.position, snapshots(session)[0].position)

  assert.throws(() => first.push(enemy), TypeError)
  assert.throws(() => { enemy.alive = false }, TypeError)
  assert.throws(() => { enemy.position.x = 999 }, TypeError)
  assert.equal(snapshots(session)[0].alive, true)
  assert.notEqual(snapshots(session)[0].position.x, 999)
})

test('spread clones are rejected by every session command', () => {
  const clone = { ...createSession() }
  assert.throws(() => advanceBattleSession(clone, 1 / 60), /session must be a BattleSession/)
  assert.throws(() => registerEnemyDefeat(clone, 1), /session must be a BattleSession/)
  assert.throws(() => settleBattleSession(clone, 'button'), /session must be a BattleSession/)
  assert.throws(() => drainCombatEvents(clone), /session must be a BattleSession/)
})

test('events are consumed once only through an immutable drain', () => {
  const session = createSession()
  const entered = drainCombatEvents(session)
  assertDeepFrozen(entered)
  assert.deepEqual(entered, [{ type: 'stage-entered', stageId: 1, at: 0 }])
  assert.throws(() => entered.push({ type: 'stage-entered', stageId: 2, at: 0 }), TypeError)
  assert.throws(() => { entered[0].stageId = 2 }, TypeError)
  assert.equal(session.stageId, 1)
  assert.deepEqual(drainCombatEvents(session), [])

  advanceFor(session, 2)
  const enemy = aliveEnemies(session)[0]
  assert.ok(enemy)
  assert.equal(registerEnemyDefeat(session, enemy.id), true)
  assert.deepEqual(drainCombatEvents(session), [
    { type: 'enemy-defeated', enemyId: enemy.id, at: session.elapsed },
  ])
  assert.equal(registerEnemyDefeat(session, enemy.id), false)
  assert.deepEqual(drainCombatEvents(session), [])
})

test('drained event types are recursively readonly under strict TypeScript', async () => {
  const imported = await import('../../node_modules/typescript/lib/typescript.js')
  const ts = imported.default ?? imported
  const fixturePath = resolve('tests/battleSession-readonly.fixture.ts').replaceAll('\\', '/')
  const fixtureSource = `
    import { drainCombatEvents } from '../assets/Scripts/Combat/BattleSession.ts'
    import type { BattleSession, ReadonlyCombatEvent } from '../assets/Scripts/Combat/BattleSession.ts'

    declare const session: BattleSession
    const drained = drainCombatEvents(session)
    declare const telegraph: Extract<ReadonlyCombatEvent, { readonly type: 'attack-telegraphed' }>

    // @ts-expect-error drained arrays are readonly
    drained.push(drained[0])
    // @ts-expect-error event fields are readonly
    drained[0].at = 1
    // @ts-expect-error nested event fields are readonly
    telegraph.area.minX = 1
  `
  const options = {
    allowImportingTsExtensions: true,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    skipLibCheck: true,
    strict: true,
    target: ts.ScriptTarget.ES2022,
  }
  const host = ts.createCompilerHost(options)
  const readFile = host.readFile.bind(host)
  const fileExists = host.fileExists.bind(host)
  const getSourceFile = host.getSourceFile.bind(host)
  const isFixture = (path) => path.replaceAll('\\', '/') === fixturePath
  host.fileExists = (path) => isFixture(path) || fileExists(path)
  host.readFile = (path) => isFixture(path) ? fixtureSource : readFile(path)
  host.getSourceFile = (path, languageVersion, onError, shouldCreateNewSourceFile) => isFixture(path)
    ? ts.createSourceFile(path, fixtureSource, languageVersion, true)
    : getSourceFile(path, languageVersion, onError, shouldCreateNewSourceFile)

  const program = ts.createProgram([fixturePath], options, host)
  const diagnostics = ts.getPreEmitDiagnostics(program).map((diagnostic) => ts.flattenDiagnosticMessageText(
    diagnostic.messageText,
    '\n',
  ))
  assert.deepEqual(diagnostics, [])
})

test('settlement stores one terminal reason and terminal commands are no-ops', () => {
  const session = createSession()
  advanceFor(session, 2)
  const enemy = aliveEnemies(session)[0]
  drainCombatEvents(session)
  const elapsed = session.elapsed

  assert.equal(settleBattleSession(session, 'button'), true)
  assert.equal(settleBattleSession(session, 'timeout'), false)
  assert.equal(settleBattleSession(session, 'boss-defeated'), false)
  assert.equal(session.phase, 'settled')
  assert.equal(session.settled, true)
  assert.equal(session.terminalReason, 'button')
  assert.deepEqual(drainCombatEvents(session), [{ type: 'stage-settled', stageId: 1, at: elapsed }])

  assert.equal(advanceBattleSession(session, 0.25), undefined)
  assert.equal(registerEnemyDefeat(session, enemy.id), false)
  assert.equal(session.elapsed, elapsed)
  assert.equal(snapshots(session).find((snapshot) => snapshot.id === enemy.id).alive, true)
  assert.deepEqual(drainCombatEvents(session), [])
})

test('unknown settlement reasons are rejected without mutating or emitting', () => {
  const session = createSession()
  drainCombatEvents(session)

  assert.equal(settleBattleSession(session, 'not-a-terminal-reason'), false)
  assert.equal(session.phase, 'intro')
  assert.equal(session.settled, false)
  assert.equal(session.terminalReason, null)
  assert.deepEqual(drainCombatEvents(session), [])
})

test('advance clamps external delta, ignores invalid deltas, and preserves substep determinism', () => {
  const single = createSession(9876)
  const stepped = createSession(9876)
  drainCombatEvents(single)
  drainCombatEvents(stepped)

  assert.equal(advanceBattleSession(single, Number.NaN), undefined)
  assert.equal(advanceBattleSession(single, 0), undefined)
  assert.equal(advanceBattleSession(single, -1), undefined)
  assert.equal(advanceBattleSession(single, 10), undefined)
  advanceFor(stepped, 0.25)

  assert.equal(single.elapsed, 0.25)
  assert.equal(single.elapsed, stepped.elapsed)
  assert.equal(single.phase, stepped.phase)
  assert.deepEqual(snapshots(single), snapshots(stepped))
  assert.deepEqual(drainCombatEvents(single), drainCombatEvents(stepped))
})

test('15, 40, 60, and 90 boundaries are exact across partition patterns', () => {
  const partitions = [[1 / 60], [0.25], [0.07, 0.13, 0.05]]
  const boundaries = [
    { at: 15, before: 'intro', after: 'mowing' },
    { at: 40, before: 'mowing', after: 'pressure' },
    { at: 60, before: 'pressure', after: 'boss', event: 'boss-entered' },
    { at: 90, before: 'boss', after: 'settled', event: 'stage-settled' },
  ]

  for (const partition of partitions) {
    for (const boundary of boundaries) {
      const session = createSession(77)
      drainCombatEvents(session)
      advanceTo(session, boundary.at - 1 / 120, partition)
      assert.equal(session.phase, boundary.before)
      assert.equal(session.settled, false)
      drainCombatEvents(session)

      advanceBattleSession(session, boundary.at - session.elapsed)
      assert.equal(session.elapsed, boundary.at)
      assert.equal(session.phase, boundary.after)
      const events = drainCombatEvents(session)
      if (boundary.event) {
        const event = events.find((candidate) => candidate.type === boundary.event)
        assert.ok(event)
        assert.equal(event.at, boundary.at)
      } else {
        assert.deepEqual(events, [])
      }
      if (boundary.at === 90) assert.equal(session.terminalReason, 'timeout')
    }
  }
})

test('epsilon-close ordered phases all transition and remain partition-equivalent', () => {
  const closeConfig = parseStageOneConfig({
    ...sourceValue,
    durationSeconds: 2,
    phaseStarts: { mowing: 1, pressure: 1.00000000005, boss: 1.00000000009 },
  })
  const quarter = createSession(88, closeConfig)
  const mixed = createSession(88, closeConfig)
  drainCombatEvents(quarter)
  drainCombatEvents(mixed)

  advanceTo(quarter, 1.25, [0.25])
  advanceTo(mixed, 1.25, [0.07, 0.13, 0.05])
  const quarterEvents = drainCombatEvents(quarter)
  const mixedEvents = drainCombatEvents(mixed)

  assert.equal(quarter.phase, 'boss')
  assert.equal(mixed.phase, 'boss')
  assert.deepEqual(snapshots(quarter), snapshots(mixed))
  assert.equal(snapshots(quarter).filter((enemy) => enemy.kind === 'bamboo-warden').length, 1)
  assert.deepEqual(quarterEvents, mixedEvents)
  assert.deepEqual(quarterEvents.filter((event) => event.type === 'boss-entered'), [
    { type: 'boss-entered', enemyId: snapshots(quarter).find((enemy) => enemy.kind === 'bamboo-warden').id, at: 1.00000000009 },
  ])
})

test('one external step processes every ordered phase transition it crosses', () => {
  const compactConfig = parseStageOneConfig({
    ...sourceValue,
    durationSeconds: 2,
    phaseStarts: { mowing: 0.05, pressure: 0.1, boss: 0.15 },
  })
  const session = createSession(99, compactConfig)
  drainCombatEvents(session)

  advanceBattleSession(session, 0.25)

  const boss = snapshots(session).filter((enemy) => enemy.kind === 'bamboo-warden')
  assert.equal(session.phase, 'boss')
  assert.equal(boss.length, 1)
  assert.deepEqual(drainCombatEvents(session), [
    { type: 'boss-entered', enemyId: boss[0].id, at: 0.15 },
  ])
})

test('same seeds reproduce finite enemy snapshots while different seeds diverge', () => {
  const first = createSession(42)
  const second = createSession(42)
  const different = createSession(43)
  advanceFor(first, 20)
  advanceFor(second, 20)
  advanceFor(different, 20)

  assert.deepEqual(ordinaryTrace(first), ordinaryTrace(second))
  assert.notDeepEqual(ordinaryTrace(first), ordinaryTrace(different))
  for (const enemy of snapshots(first)) {
    assert.equal(Number.isFinite(enemy.position.x), true)
    assert.equal(Number.isFinite(enemy.position.y), true)
    assert.equal(Number.isFinite(enemy.spawnedAt), true)
  }
})

test('alive count never exceeds 18 and Boss enters exactly once at 60', () => {
  const session = createSession()
  drainCombatEvents(session)
  let maxAlive = 0
  const trace = []
  for (let frame = 0; frame < 62 * 60; frame += 1) {
    advanceBattleSession(session, 1 / 60)
    trace.push(...drainCombatEvents(session))
    maxAlive = Math.max(maxAlive, aliveEnemies(session).length)
  }

  const bosses = snapshots(session).filter((enemy) => enemy.kind === 'bamboo-warden')
  const bossEvents = trace.filter((event) => event.type === 'boss-entered')
  assert.equal(maxAlive <= 18, true)
  assert.equal(bosses.length, 1)
  assert.equal(bosses[0].alive, true)
  assert.deepEqual(bossEvents, [{ type: 'boss-entered', enemyId: bosses[0].id, at: 60 }])
  assert.equal(aliveEnemies(session).length, 1)
})

function runDeterministicSimulation(seed) {
  const session = createSession(seed)
  const trace = [...drainCombatEvents(session)]
  const ordinaryLifetime = 2.5
  let bossEnteredAt = null
  let maxAlive = 0

  for (let frame = 0; frame < 90 * 60 && !session.settled; frame += 1) {
    advanceBattleSession(session, 1 / 60)
    const advancedEvents = drainCombatEvents(session)
    trace.push(...advancedEvents)
    const bossEvent = advancedEvents.find((event) => event.type === 'boss-entered')
    if (bossEvent) bossEnteredAt = bossEvent.at

    for (const enemy of aliveEnemies(session)) {
      const lifetime = enemy.kind === 'bamboo-warden' && bossEnteredAt !== null
        ? session.elapsed - bossEnteredAt
        : session.elapsed - enemy.spawnedAt
      const requiredLifetime = enemy.kind === 'bamboo-warden' ? 24 : ordinaryLifetime
      if (lifetime + 1e-9 >= requiredLifetime) {
        assert.equal(registerEnemyDefeat(session, enemy.id), true)
        trace.push(...drainCombatEvents(session))
      }
    }
    maxAlive = Math.max(maxAlive, aliveEnemies(session).length)
  }

  return { elapsed: session.elapsed, terminalReason: session.terminalReason, maxAlive, trace }
}

test('90-second simulation is bounded, reproducible, and settles 24 seconds after Boss entry', () => {
  const first = runDeterministicSimulation(2026)
  const second = runDeterministicSimulation(2026)
  assert.deepEqual(first, second)

  const bossEvent = first.trace.find((event) => event.type === 'boss-entered')
  const settlementEvent = first.trace.find((event) => event.type === 'stage-settled')
  assert.equal(bossEvent.at, 60)
  assert.equal(settlementEvent.at, 84)
  assert.equal(first.elapsed, 84)
  assert.equal(first.terminalReason, 'boss-defeated')
  assert.equal(first.maxAlive <= 18, true)
  assert.equal(first.trace.filter((event) => event.type === 'boss-entered').length, 1)
  assert.equal(first.trace.filter((event) => event.type === 'stage-settled').length, 1)
})
