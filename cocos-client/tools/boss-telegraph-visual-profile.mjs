const spirit = rgba(141, 232, 218, 190)
const impact = rgba(255, 240, 189, 245)
const quality = Object.freeze({
  reducedAccent: true,
  minimalParticles: false,
})

const PROFILES = Object.freeze({
  sweep: Object.freeze({
    id: 'sweep-arc',
    resources: resources(
      'Assets/Skills/BossDomain/sweep_arc/spriteFrame',
      'Assets/Skills/BossDomain/sweep_trail/spriteFrame',
      'Assets/Skills/BossDomain/leaf_particle/spriteFrame',
    ),
    quality,
    warning: rgba(232, 190, 88, 220),
    spirit,
    impact,
  }),
  spike: Object.freeze({
    id: 'spike-eruption',
    resources: resources(
      'Assets/Skills/BossDomain/spike_cluster/spriteFrame',
      'Assets/Skills/BossDomain/ground_dust/spriteFrame',
      'Assets/Skills/BossDomain/impact_spark/spriteFrame',
    ),
    quality,
    warning: rgba(164, 58, 44, 220),
    spirit,
    impact,
  }),
  'roar-sector': Object.freeze({
    id: 'roar-wave',
    resources: resources(
      'Assets/Skills/BossDomain/roar_wave/spriteFrame',
      'Assets/Skills/BossDomain/ground_dust/spriteFrame',
      'Assets/Skills/BossDomain/leaf_particle/spriteFrame',
    ),
    quality,
    warning: rgba(232, 190, 88, 220),
    spirit,
    impact,
  }),
})

export function resolveBossTelegraphVisual(danger) {
  if (danger.kind === 'spike' || danger.kind === 'roar-sector') {
    return PROFILES[danger.kind]
  }
  return PROFILES.sweep
}

export function bossVfxPhase(duration, remaining, out) {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 1
  const finiteRemaining = Number.isFinite(remaining) ? remaining : safeDuration
  const safeRemaining = Math.min(safeDuration, Math.max(0, finiteRemaining))
  const progress = round3(1 - safeRemaining / safeDuration)
  const critical = progress >= 0.7
  const result = out ?? { progress: 0, phase: 'warning', intensity: 0, travel: 0 }
  result.progress = progress
  result.phase = critical ? 'critical' : 'warning'
  result.intensity = round3(critical ? 0.7 + (progress - 0.7) : 0.32 + progress * 0.48)
  result.travel = round3(critical ? (progress - 0.7) / 0.3 : 0)
  return result
}

function round3(value) {
  return Math.round(value * 1000) / 1000
}

function resources(main, accent, particle) {
  return Object.freeze({ main, accent, particle })
}

function rgba(red, green, blue, alpha) {
  return Object.freeze([red, green, blue, alpha])
}
