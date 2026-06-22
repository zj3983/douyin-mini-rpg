import test from 'node:test'
import assert from 'node:assert/strict'

import { scaledParticleCount, vfxBudgetForLoad } from '../src/vfxBudget.ts'

test('vfx budget keeps full feedback when the scene is light', () => {
  const budget = vfxBudgetForLoad({ frameMs: 12, effects: 8, particles: 24, enemySkills: 1 })

  assert.deepEqual(budget, {
    tier: 'normal',
    maxEffects: 52,
    maxParticles: 118,
    drawEffects: 44,
    drawParticles: 96,
    particleScale: 0.82,
    maxBurstParticles: 28,
  })
  assert.equal(scaledParticleCount(20, budget), 16)
})

test('vfx budget reduces generated particles before frame pressure becomes visible', () => {
  const budget = vfxBudgetForLoad({ frameMs: 21, effects: 36, particles: 110, enemySkills: 4 })

  assert.equal(budget.tier, 'reduced')
  assert.equal(budget.maxParticles, 82)
  assert.equal(budget.drawParticles, 54)
  assert.equal(scaledParticleCount(34, budget), 14)
})

test('vfx budget clamps heavy skill storms to a minimal update workload', () => {
  const budget = vfxBudgetForLoad({ frameMs: 34, effects: 72, particles: 180, enemySkills: 7 })

  assert.equal(budget.tier, 'minimal')
  assert.equal(budget.maxEffects, 22)
  assert.equal(budget.maxParticles, 48)
  assert.equal(budget.drawEffects, 16)
  assert.equal(budget.drawParticles, 32)
  assert.equal(scaledParticleCount(42, budget), 8)
})
