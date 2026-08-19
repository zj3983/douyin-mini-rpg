import test from 'node:test'
import assert from 'node:assert/strict'
import {
  advanceExtraction,
  createDungeonExtraction,
  interruptExtraction,
  restoreDungeonExtraction,
  snapshotDungeonExtraction,
  startExtraction,
} from '../assets/Scripts/Core/Dungeon/DungeonExtractionRuntime.ts'

test('extraction completes after exactly three valid seconds', () => {
  const extraction = createDungeonExtraction()

  assert.equal(startExtraction(extraction, 'f2-damaged-exit'), true)
  assert.deepEqual(advanceExtraction(extraction, 2.9), {
    type: 'progressed',
    progressSeconds: 2.9,
  })
  assert.deepEqual(advanceExtraction(extraction, 0.1), {
    type: 'extraction-completed',
    roomId: 'f2-damaged-exit',
  })
  assert.equal(extraction.progressSeconds, 3)
  assert.deepEqual(advanceExtraction(extraction, 1), { type: 'inactive' })
})

test('only effective elite or Boss damage interrupts channeling', () => {
  for (const sourceRole of ['elite', 'boss']) {
    const extraction = createDungeonExtraction()
    startExtraction(extraction, 'f3-full-exit')
    advanceExtraction(extraction, 1.25)

    assert.deepEqual(interruptExtraction(extraction, { sourceRole, effectiveDamage: 1 }), {
      type: 'extraction-interrupted',
      reason: `${sourceRole}-damage`,
    })
    assert.deepEqual(extraction, { phase: 'idle', roomId: null, progressSeconds: 0 })
  }

  for (const hit of [
    { sourceRole: 'ordinary', effectiveDamage: 10 },
    { sourceRole: 'elite', effectiveDamage: 0 },
    { sourceRole: 'boss', effectiveDamage: -1 },
  ]) {
    const extraction = createDungeonExtraction()
    startExtraction(extraction, 'f2-damaged-exit')
    assert.deepEqual(interruptExtraction(extraction, hit), { type: 'ignored' })
    assert.equal(extraction.phase, 'channeling')
  }
})

test('invalid extraction inputs are rejected atomically', () => {
  for (const roomId of ['', ' ', ' f2-damaged-exit ']) {
    const extraction = createDungeonExtraction()
    const before = structuredClone(extraction)
    assert.throws(() => startExtraction(extraction, roomId), TypeError)
    assert.deepEqual(extraction, before)
  }

  for (const deltaSeconds of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const extraction = createDungeonExtraction()
    startExtraction(extraction, 'f2-damaged-exit')
    const before = structuredClone(extraction)
    assert.throws(() => advanceExtraction(extraction, deltaSeconds), TypeError)
    assert.deepEqual(extraction, before)
  }

  for (const hit of [
    { sourceRole: 'elite', effectiveDamage: Number.NaN },
    { sourceRole: 'boss', effectiveDamage: Number.POSITIVE_INFINITY },
    { sourceRole: 'minion', effectiveDamage: 1 },
  ]) {
    const extraction = createDungeonExtraction()
    startExtraction(extraction, 'f2-damaged-exit')
    const before = structuredClone(extraction)
    assert.throws(() => interruptExtraction(extraction, hit), TypeError)
    assert.deepEqual(extraction, before)
  }
})

test('start is single-use while active and completed', () => {
  const extraction = createDungeonExtraction()
  assert.equal(startExtraction(extraction, 'f2-damaged-exit'), true)
  assert.equal(startExtraction(extraction, 'f3-full-exit'), false)
  assert.equal(extraction.roomId, 'f2-damaged-exit')
  advanceExtraction(extraction, 3)
  assert.equal(startExtraction(extraction, 'f3-full-exit'), false)
})

test('extraction snapshots restore with deep isolation and strict state validation', () => {
  const extraction = createDungeonExtraction()
  startExtraction(extraction, 'f3-full-exit')
  advanceExtraction(extraction, 1.2)

  const snapshot = snapshotDungeonExtraction(extraction)
  const restored = restoreDungeonExtraction(JSON.parse(JSON.stringify(snapshot)))
  assert.deepEqual(restored, extraction)
  assert.notEqual(restored, extraction)

  restored.progressSeconds = 2
  assert.equal(extraction.progressSeconds, 1.2)

  const invalidStates = [
    null,
    { phase: 'idle', roomId: 'f2-damaged-exit', progressSeconds: 0 },
    { phase: 'channeling', roomId: null, progressSeconds: 1 },
    { phase: 'channeling', roomId: 'f2-damaged-exit', progressSeconds: 3 },
    { phase: 'completed', roomId: 'f2-damaged-exit', progressSeconds: 2.9 },
  ]
  for (const invalid of invalidStates) assert.throws(() => restoreDungeonExtraction(invalid), TypeError)
})
