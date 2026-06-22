export type VfxBudgetTier = 'normal' | 'reduced' | 'minimal'

export interface VfxLoad {
  frameMs: number
  effects: number
  particles: number
  enemySkills: number
}

export interface VfxBudget {
  tier: VfxBudgetTier
  maxEffects: number
  maxParticles: number
  drawEffects: number
  drawParticles: number
  particleScale: number
  maxBurstParticles: number
}

export function vfxBudgetForLoad(load: VfxLoad): VfxBudget {
  const frameMs = finiteAtLeast(load.frameMs, 0)
  const effects = finiteAtLeast(load.effects, 0)
  const particles = finiteAtLeast(load.particles, 0)
  const enemySkills = finiteAtLeast(load.enemySkills, 0)

  if (frameMs >= 30 || effects >= 58 || particles >= 150 || enemySkills >= 6) {
    return {
      tier: 'minimal',
      maxEffects: 22,
      maxParticles: 48,
      drawEffects: 16,
      drawParticles: 32,
      particleScale: 0.32,
      maxBurstParticles: 8,
    }
  }

  if (frameMs >= 18 || effects >= 30 || particles >= 86 || enemySkills >= 4) {
    return {
      tier: 'reduced',
      maxEffects: 34,
      maxParticles: 82,
      drawEffects: 24,
      drawParticles: 54,
      particleScale: 0.42,
      maxBurstParticles: 14,
    }
  }

  return {
    tier: 'normal',
    maxEffects: 52,
    maxParticles: 118,
    drawEffects: 44,
    drawParticles: 96,
    particleScale: 0.82,
    maxBurstParticles: 28,
  }
}

export function scaledParticleCount(count: number, budget: VfxBudget) {
  const safeCount = Math.max(0, Math.floor(Number(count) || 0))
  if (safeCount === 0) return 0
  const scaled = Math.floor(safeCount * budget.particleScale)
  return Math.max(1, Math.min(budget.maxBurstParticles, scaled))
}

function finiteAtLeast(value: number, min: number) {
  const safeValue = Number(value)
  return Number.isFinite(safeValue) ? Math.max(min, safeValue) : min
}
