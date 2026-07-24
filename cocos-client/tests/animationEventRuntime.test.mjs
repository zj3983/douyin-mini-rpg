import test from 'node:test'
import assert from 'node:assert/strict'

import {
  actionCompleted,
  actionDuration,
  markersCrossed,
} from '../tools/animation-event-runtime.mjs'

const markers = [
  { name: 'prepare', at: 0.25 },
  { name: 'release', at: 0.6 },
]

test('actionDuration derives seconds from frame count and fps', () => {
  assert.equal(actionDuration(12, 8), 1.5)
  assert.equal(actionDuration(0, 8), 0)
  assert.equal(actionDuration(12, 0), 0)
})

test('markersCrossed reports a marker crossed during normal advancement', () => {
  assert.deepEqual(
    markersCrossed({ markers, previousElapsed: 0.1, elapsed: 0.3, duration: 1, loop: false }),
    [markers[0]],
  )
})

test('markersCrossed reports every marker crossed when frames are skipped', () => {
  assert.deepEqual(
    markersCrossed({ markers, previousElapsed: 0.1, elapsed: 0.65, duration: 1, loop: false }),
    markers,
  )
})

test('markersCrossed handles loop wrap and every crossed loop in marker order', () => {
  assert.deepEqual(
    markersCrossed({ markers, previousElapsed: 0.8, elapsed: 2.3, duration: 1, loop: true }),
    [markers[0], markers[1], markers[0]],
  )
})

test('markersCrossed returns none without forward advancement or valid duration', () => {
  assert.deepEqual(
    markersCrossed({ markers, previousElapsed: 0.5, elapsed: 0.5, duration: 1, loop: true }),
    [],
  )
  assert.deepEqual(
    markersCrossed({ markers, previousElapsed: 0.5, elapsed: 0.4, duration: 1, loop: true }),
    [],
  )
  assert.deepEqual(
    markersCrossed({ markers, previousElapsed: 0, elapsed: 1, duration: 0, loop: true }),
    [],
  )
})

test('actionCompleted reports only the first non-loop duration crossing', () => {
  assert.equal(actionCompleted({ previousElapsed: 0.9, elapsed: 1, duration: 1, loop: false }), true)
  assert.equal(actionCompleted({ previousElapsed: 0.9, elapsed: 1.1, duration: 1, loop: false }), true)
  assert.equal(actionCompleted({ previousElapsed: 1, elapsed: 1.4, duration: 1, loop: false }), false)
  assert.equal(actionCompleted({ previousElapsed: 0.9, elapsed: 1.1, duration: 1, loop: true }), false)
  assert.equal(actionCompleted({ previousElapsed: 0, elapsed: 1, duration: 0, loop: false }), false)
})
