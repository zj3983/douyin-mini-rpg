import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createPerformanceBudget,
  updateVfxQuality,
  vfxFeaturePolicy,
} from '../assets/Scripts/Combat/PerformanceBudget.ts'

function feedWindow(state, frameMs, count = 300) {
  let quality = state.quality
  for (let index = 0; index < count; index += 1) {
    quality = updateVfxQuality(state, frameMs)
  }
  return quality
}

test('slow p95 frame time degrades effects before it touches core combat reads', () => {
  const budget = createPerformanceBudget()

  assert.equal(feedWindow(budget, 24), 'reduced')
  assert.deepEqual(vfxFeaturePolicy('reduced'), {
    particles: false,
    debris: false,
    longTrails: false,
    swordBody: true,
    actorSilhouette: true,
    telegraph: true,
  })

  assert.equal(feedWindow(budget, 26), 'minimal')
  assert.deepEqual(vfxFeaturePolicy('minimal'), {
    particles: false,
    debris: false,
    longTrails: false,
    swordBody: true,
    actorSilhouette: true,
    telegraph: true,
  })
})

test('quality only recovers after sustained healthy windows', () => {
  const budget = createPerformanceBudget()
  feedWindow(budget, 24)
  feedWindow(budget, 26)

  assert.equal(budget.quality, 'minimal')
  assert.equal(feedWindow(budget, 15), 'minimal')
  assert.equal(feedWindow(budget, 15), 'reduced')
  assert.equal(feedWindow(budget, 15), 'reduced')
  assert.equal(feedWindow(budget, 15), 'full')
})

test('mixed window uses p95, not a single bad frame spike', () => {
  const budget = createPerformanceBudget()

  for (let index = 0; index < 285; index += 1) {
    updateVfxQuality(budget, 16)
  }
  for (let index = 0; index < 14; index += 1) {
    updateVfxQuality(budget, 40)
  }

  assert.equal(updateVfxQuality(budget, 16), 'full')
})
