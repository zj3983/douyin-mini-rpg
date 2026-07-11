import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  completeDrain,
  createStageFlow,
  markPlayerDefeated,
  recordBossDefeat,
  recordOrdinaryDefeat,
} from '../tools/stage-flow-runtime.mjs'

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

test('TypeScript runtime exposes the same engine-independent API and commands', () => {
  const source = readFileSync(new URL('../assets/Scripts/Core/StageFlowRuntime.ts', import.meta.url), 'utf8')

  assert.doesNotMatch(source, /from ['"]cc['"]|require\(['"]cc['"]\)/)
  for (const name of [
    'createStageFlow',
    'recordOrdinaryDefeat',
    'completeDrain',
    'recordBossDefeat',
    'markPlayerDefeated',
  ]) {
    assert.match(source, new RegExp(`export function ${name}\\b`))
  }
  for (const value of ['clearing', 'draining', 'boss', 'settled', 'defeated', 'beginDrain', 'spawnBoss', 'settle']) {
    assert.match(source, new RegExp(`['"]${value}['"]`))
  }
})
