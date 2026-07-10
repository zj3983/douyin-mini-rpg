import test from 'node:test'
import assert from 'node:assert/strict'

test('soul HUD count is finite and clamped between zero and the requirement', async () => {
  let runtime = null
  try {
    runtime = await import('../tools/battle-runtime.mjs')
  } catch {
    // RED until the shared HUD normalization exists.
  }

  assert.ok(runtime, 'soul HUD normalization module should exist')
  assert.deepEqual(runtime.normalizeSoulHudCount(27, 12), { current: 12, required: 12 })
  assert.deepEqual(runtime.normalizeSoulHudCount(-4, 12), { current: 0, required: 12 })
  assert.deepEqual(runtime.normalizeSoulHudCount(Number.NaN, 12), { current: 0, required: 12 })
  assert.deepEqual(runtime.normalizeSoulHudCount(5, Number.POSITIVE_INFINITY), { current: 0, required: 0 })
})
