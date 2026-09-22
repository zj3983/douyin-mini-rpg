import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import ts from 'typescript'

async function loadRuntime() {
  const source = readFileSync(resolve('assets/Scripts/Core/Dungeon/DungeonEncounterStart.ts'), 'utf8')
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`)
}

test('successful dungeon encounter start does not invoke recovery', async () => {
  const { createDungeonEncounterRetryState, retryDungeonEncounterStart } = await loadRuntime()
  let recoveries = 0

  assert.deepEqual(retryDungeonEncounterStart(createDungeonEncounterRetryState(), {
    key: 'room:success',
    nowMs: 0,
    retryDelayMs: 50,
    start: () => true,
    recover: () => { recoveries += 1 },
  }), { attempted: true, started: true })
  assert.equal(recoveries, 0)
})

test('false dungeon encounter start recovers and stays retryable', async () => {
  const { createDungeonEncounterRetryState, retryDungeonEncounterStart } = await loadRuntime()
  let recoveries = 0

  assert.deepEqual(retryDungeonEncounterStart(createDungeonEncounterRetryState(), {
    key: 'room:false',
    nowMs: 0,
    retryDelayMs: 50,
    start: () => false,
    recover: () => { recoveries += 1 },
  }), { attempted: true, started: false })
  assert.equal(recoveries, 1)
})

test('throwing dungeon encounter start recovers instead of escaping', async () => {
  const { createDungeonEncounterRetryState, retryDungeonEncounterStart } = await loadRuntime()
  let recoveries = 0

  assert.deepEqual(retryDungeonEncounterStart(createDungeonEncounterRetryState(), {
    key: 'room:throw',
    nowMs: 0,
    retryDelayMs: 50,
    start: () => { throw new Error('pool unavailable') },
    recover: () => { recoveries += 1 },
  }), { attempted: true, started: false })
  assert.equal(recoveries, 1)
})

test('consecutive failed frames recover once, preserve later player movement, and eventually start', async () => {
  const {
    createDungeonEncounterRetryState,
    retryDungeonEncounterStart,
  } = await loadRuntime()
  const state = createDungeonEncounterRetryState()
  let attempts = 0
  let recoveries = 0
  let playerX = 120
  const start = () => {
    attempts += 1
    return attempts === 3
  }
  const recover = () => {
    recoveries += 1
    playerX = 0
  }
  const frame = (nowMs) => retryDungeonEncounterStart(state, {
    key: 'room:f1-entry',
    nowMs,
    retryDelayMs: 50,
    start,
    recover,
  })

  assert.deepEqual(frame(0), { attempted: true, started: false })
  assert.equal(playerX, 0)
  playerX = 36

  assert.deepEqual(frame(16), { attempted: false, started: false })
  assert.deepEqual(frame(32), { attempted: false, started: false })
  assert.deepEqual(frame(48), { attempted: false, started: false })
  assert.equal(playerX, 36)
  assert.equal(recoveries, 1)

  assert.deepEqual(frame(50), { attempted: true, started: false })
  assert.equal(playerX, 36)
  assert.equal(recoveries, 1)
  assert.deepEqual(frame(100), { attempted: true, started: true })
  assert.equal(attempts, 3)
  assert.equal(recoveries, 1)
})

test('a new encounter key starts a fresh one-time recovery cycle', async () => {
  const {
    createDungeonEncounterRetryState,
    retryDungeonEncounterStart,
  } = await loadRuntime()
  const state = createDungeonEncounterRetryState()
  let recoveries = 0
  const fail = (key, nowMs) => retryDungeonEncounterStart(state, {
    key,
    nowMs,
    retryDelayMs: 100,
    start: () => false,
    recover: () => { recoveries += 1 },
  })

  assert.deepEqual(fail('room:a', 0), { attempted: true, started: false })
  assert.deepEqual(fail('room:a', 100), { attempted: true, started: false })
  assert.equal(recoveries, 1)
  assert.deepEqual(fail('room:b', 101), { attempted: true, started: false })
  assert.equal(recoveries, 2)
})
