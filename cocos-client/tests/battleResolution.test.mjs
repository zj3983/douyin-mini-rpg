import test from 'node:test'
import assert from 'node:assert/strict'
import * as battleLayout from '../assets/Scripts/Combat/BattleLayout.ts'

const selectBattleResolution = battleLayout.selectBattleResolution

test('portrait viewports keep the fixed-width dynamic-height policy', () => {
  assert.equal(typeof selectBattleResolution, 'function')

  const first = selectBattleResolution({ cssWidth: 390, cssHeight: 844 })
  const second = selectBattleResolution({ cssWidth: 430, cssHeight: 932 })

  assert.deepEqual(first, {
    designWidth: 750,
    designHeight: 1334,
    mode: 'fixed-width',
  })
  assert.strictEqual(second, first)
})

test('landscape viewports show the complete portrait battle canvas', () => {
  assert.equal(typeof selectBattleResolution, 'function')

  const resolution = selectBattleResolution({ cssWidth: 844, cssHeight: 390 })

  assert.deepEqual(resolution, {
    designWidth: 750,
    designHeight: 1334,
    mode: 'show-all',
  })
  assert.equal(Object.isFrozen(resolution), true)
})

test('transient invalid resize dimensions retain the previous valid mode', () => {
  assert.equal(typeof selectBattleResolution, 'function')

  const resolution = selectBattleResolution({
    cssWidth: 0,
    cssHeight: Number.NaN,
    previousMode: 'show-all',
  })

  assert.deepEqual(resolution, {
    designWidth: 750,
    designHeight: 1334,
    mode: 'show-all',
  })
  assert.ok(resolution.designWidth > 0)
  assert.ok(resolution.designHeight > 0)
})
