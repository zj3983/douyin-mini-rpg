import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FRENZY_AT_SECONDS,
  MAX_ELAPSED_SECONDS,
  MAX_FRAME_DELTA_SECONDS,
  RESTLESS_AT_SECONDS,
  advanceDungeonPressure,
  applySearchPressure,
  createDungeonPressure,
  pressurePhaseAt,
  snapshotDungeonPressure,
} from '../assets/Scripts/Core/Dungeon/DungeonPressureRuntime.ts'

test('frame advancement crosses exact pressure boundaries without floating-point drift', () => {
  const pressure = { elapsedSeconds: 119.9, phase: 'calm' }

  assert.deepEqual(advanceDungeonPressure(pressure, 0.1, false), {
    events: [{ type: 'pressure-phase-changed', phase: 'restless' }],
  })
  assert.deepEqual(pressure, { elapsedSeconds: 120, phase: 'restless' })

  pressure.elapsedSeconds = 239.9
  assert.deepEqual(advanceDungeonPressure(pressure, 0.1, false), {
    events: [{ type: 'pressure-phase-changed', phase: 'frenzy' }],
  })
  assert.deepEqual(pressure, { elapsedSeconds: 240, phase: 'frenzy' })
})

test('paused time does not advance and oversized frames are capped', () => {
  const pressure = createDungeonPressure()

  assert.deepEqual(advanceDungeonPressure(pressure, 30, true), { events: [] })
  assert.deepEqual(pressure, { elapsedSeconds: 0, phase: 'calm' })

  assert.deepEqual(advanceDungeonPressure(pressure, 4, false), { events: [] })
  assert.equal(pressure.elapsedSeconds, MAX_FRAME_DELTA_SECONDS)
})

test('search pressure applies immediately and emits a crossed restless phase', () => {
  const pressure = { elapsedSeconds: 112, phase: 'calm' }

  assert.deepEqual(applySearchPressure(pressure, 12), {
    events: [{ type: 'pressure-phase-changed', phase: 'restless' }],
  })
  assert.deepEqual(pressure, { elapsedSeconds: 124, phase: 'restless' })
})

test('successive searches emit crossed phases in chronological order', () => {
  const pressure = { elapsedSeconds: 112, phase: 'calm' }
  const events = [...applySearchPressure(pressure, 20).events]

  pressure.elapsedSeconds = 232
  pressure.phase = 'restless'
  events.push(...applySearchPressure(pressure, 20).events)

  assert.deepEqual(events, [
    { type: 'pressure-phase-changed', phase: 'restless' },
    { type: 'pressure-phase-changed', phase: 'frenzy' },
  ])
  assert.deepEqual(pressure, { elapsedSeconds: 252, phase: 'frenzy' })
})

test('invalid frame deltas and search costs are rejected atomically', () => {
  const invalidDeltas = [-1, Number.NaN, Number.POSITIVE_INFINITY]
  for (const delta of invalidDeltas) {
    const pressure = { elapsedSeconds: 119.9, phase: 'calm' }
    const before = structuredClone(pressure)
    assert.throws(() => advanceDungeonPressure(pressure, delta, false), TypeError)
    assert.deepEqual(pressure, before)
  }

  for (const seconds of [0, 13, -12, Number.NaN, Number.POSITIVE_INFINITY]) {
    const pressure = { elapsedSeconds: 112, phase: 'calm' }
    const before = structuredClone(pressure)
    assert.throws(() => applySearchPressure(pressure, seconds), TypeError)
    assert.deepEqual(pressure, before)
  }
})

test('phase lookup defines exact thresholds and rejects invalid seconds', () => {
  assert.equal(RESTLESS_AT_SECONDS, 120)
  assert.equal(FRENZY_AT_SECONDS, 240)
  assert.equal(pressurePhaseAt(0), 'calm')
  assert.equal(pressurePhaseAt(119.999), 'calm')
  assert.equal(pressurePhaseAt(120), 'restless')
  assert.equal(pressurePhaseAt(239.999), 'restless')
  assert.equal(pressurePhaseAt(240), 'frenzy')

  for (const seconds of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => pressurePhaseAt(seconds), TypeError)
  }
})

test('snapshots are isolated from their source state', () => {
  const pressure = createDungeonPressure()
  const snapshot = snapshotDungeonPressure(pressure)

  snapshot.elapsedSeconds = 120
  snapshot.phase = 'restless'

  assert.deepEqual(pressure, { elapsedSeconds: 0, phase: 'calm' })
  assert.notEqual(snapshot, pressure)
})

test('unsafe elapsed states are rejected atomically even while paused', () => {
  for (const elapsedSeconds of [Number.MAX_VALUE, Number.MAX_SAFE_INTEGER]) {
    const pressure = { elapsedSeconds, phase: 'frenzy' }
    const before = structuredClone(pressure)

    assert.throws(() => advanceDungeonPressure(pressure, 0, true), TypeError)
    assert.deepEqual(pressure, before)
  }
})

test('zero delta preserves sub-threshold elapsed time exactly', () => {
  const pressure = { elapsedSeconds: 119.9999999996, phase: 'calm' }
  const before = structuredClone(pressure)

  assert.deepEqual(advanceDungeonPressure(pressure, 0, false), { events: [] })
  assert.deepEqual(pressure, before)
})

test('advancement and search reject elapsed overflow atomically', () => {
  const cases = [
    {
      pressure: { elapsedSeconds: MAX_ELAPSED_SECONDS - 0.05, phase: 'frenzy' },
      run: (pressure) => advanceDungeonPressure(pressure, 0.1, false),
    },
    {
      pressure: { elapsedSeconds: MAX_ELAPSED_SECONDS - 11, phase: 'frenzy' },
      run: (pressure) => applySearchPressure(pressure, 12),
    },
  ]

  for (const { pressure, run } of cases) {
    const before = structuredClone(pressure)
    assert.throws(() => run(pressure), TypeError)
    assert.deepEqual(pressure, before)
  }
})
