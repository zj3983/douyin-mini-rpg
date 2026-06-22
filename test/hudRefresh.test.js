import test from 'node:test'
import assert from 'node:assert/strict'

import { nextHudRefresh } from '../src/hudRefresh.ts'

test('hud refresh waits until the interval has elapsed', () => {
  assert.deepEqual(nextHudRefresh(0.1, 0.03, 0.1), {
    refresh: false,
    timer: 0.07,
  })
})

test('hud refresh fires and resets when the timer runs out', () => {
  assert.deepEqual(nextHudRefresh(0.02, 0.03, 0.1), {
    refresh: true,
    timer: 0.1,
  })
})

test('hud refresh handles invalid timers by refreshing immediately', () => {
  assert.deepEqual(nextHudRefresh(Number.NaN, 0.016, 0.1), {
    refresh: true,
    timer: 0.1,
  })
})
