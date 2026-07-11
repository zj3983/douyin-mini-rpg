import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as esmRuntime from '../tools/stage-flow-runtime.mjs'

const {
  completeDrain,
  createStageFlow,
  markPlayerDefeated,
  recordBossDefeat,
  recordOrdinaryDefeat,
} = esmRuntime

const unchanged = { changed: false, command: null }

test('stage flow clears ordinary enemies, drains, spawns a boss, and settles once', () => {
  const state = createStageFlow(2, 7)

  assert.deepEqual(state, {
    phase: 'clearing',
    generation: 7,
    defeatTarget: 2,
    ordinaryDefeats: 0,
  })
  assert.deepEqual(recordOrdinaryDefeat(state), { changed: true, command: null })
  assert.deepEqual(recordOrdinaryDefeat(state), { changed: true, command: 'beginDrain' })
  assert.equal(state.phase, 'draining')
  assert.equal(state.ordinaryDefeats, 2)
  assert.deepEqual(recordOrdinaryDefeat(state), unchanged)

  assert.deepEqual(completeDrain(state, 6), unchanged)
  assert.deepEqual(completeDrain(state, 7), { changed: true, command: 'spawnBoss' })
  assert.equal(state.phase, 'boss')
  assert.deepEqual(completeDrain(state, 7), unchanged)

  assert.deepEqual(recordBossDefeat(state), { changed: true, command: 'settle' })
  assert.equal(state.phase, 'settled')
  assert.deepEqual(recordBossDefeat(state), unchanged)
})

test('invalid and duplicate transitions do not change state', () => {
  const state = createStageFlow(1)

  assert.equal(state.generation, 0)
  assert.deepEqual(completeDrain(state, 0), unchanged)
  assert.deepEqual(recordBossDefeat(state), unchanged)
  assert.deepEqual(state, {
    phase: 'clearing',
    generation: 0,
    defeatTarget: 1,
    ordinaryDefeats: 0,
  })
})

test('player defeat terminates any active phase and terminal phases are idempotent', () => {
  const clearing = createStageFlow(2, 1)
  assert.deepEqual(markPlayerDefeated(clearing), { changed: true, command: null })
  assert.equal(clearing.phase, 'defeated')
  assert.deepEqual(markPlayerDefeated(clearing), unchanged)
  assert.deepEqual(recordOrdinaryDefeat(clearing), unchanged)

  const draining = createStageFlow(1, 2)
  recordOrdinaryDefeat(draining)
  assert.deepEqual(markPlayerDefeated(draining), { changed: true, command: null })
  assert.equal(draining.phase, 'defeated')
  assert.deepEqual(completeDrain(draining, 2), unchanged)

  const boss = createStageFlow(1, 3)
  recordOrdinaryDefeat(boss)
  completeDrain(boss, 3)
  assert.deepEqual(markPlayerDefeated(boss), { changed: true, command: null })
  assert.equal(boss.phase, 'defeated')
  assert.deepEqual(recordBossDefeat(boss), unchanged)

  const settled = createStageFlow(1, 4)
  recordOrdinaryDefeat(settled)
  completeDrain(settled, 4)
  recordBossDefeat(settled)
  assert.deepEqual(markPlayerDefeated(settled), unchanged)
  assert.equal(settled.phase, 'settled')
})

async function loadTypeScriptRuntime() {
  const source = readFileSync(new URL('../assets/Scripts/Core/StageFlowRuntime.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /from ['"]cc['"]|require\(['"]cc['"]\)/)

  const executable = source
    .replace(/^export type .*$/gm, '')
    .replace(/^export interface \w+ \{[\s\S]*?^\}$/gm, '')
    .replace(/:\s*(?:StageFlowState|StageFlowTransition|number)(?=\s*(?:=>|[,)={]))/g, '')
  return import(`data:text/javascript;base64,${Buffer.from(executable).toString('base64')}`)
}

function runScenario(runtime, { defeatTarget, generation, steps }) {
  const state = runtime.createStageFlow(defeatTarget, generation)
  const trace = [{ state: { ...state } }]
  for (const [operation, ...args] of steps) {
    trace.push({
      operation,
      result: runtime[operation](state, ...args),
      state: { ...state },
    })
  }
  return trace
}

test('TypeScript and ESM runtimes execute every transition identically', async () => {
  const tsRuntime = await loadTypeScriptRuntime()
  const scenarios = [
    {
      defeatTarget: 2.9,
      generation: 7.8,
      steps: [
        ['completeDrain', 7],
        ['recordBossDefeat'],
        ['recordOrdinaryDefeat'],
        ['recordOrdinaryDefeat'],
        ['recordOrdinaryDefeat'],
        ['completeDrain', 6],
        ['completeDrain', 7],
        ['completeDrain', 7],
        ['recordBossDefeat'],
        ['recordBossDefeat'],
        ['markPlayerDefeated'],
      ],
    },
    { defeatTarget: 1, generation: 1, steps: [['markPlayerDefeated'], ['markPlayerDefeated'], ['recordOrdinaryDefeat']] },
    { defeatTarget: 1, generation: 2, steps: [['recordOrdinaryDefeat'], ['markPlayerDefeated'], ['completeDrain', 2]] },
    {
      defeatTarget: 1,
      generation: 3,
      steps: [['recordOrdinaryDefeat'], ['completeDrain', 3], ['markPlayerDefeated'], ['recordBossDefeat']],
    },
  ]

  for (const scenario of scenarios) {
    assert.deepEqual(runScenario(tsRuntime, scenario), runScenario(esmRuntime, scenario))
  }
})
