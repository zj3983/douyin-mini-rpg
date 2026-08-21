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
    layout: layout(
      'fixed',
      layerSize(1.2, 2.4, 300, 144),
      layerSize(1.28, 2.8, 320, 168),
      layerSize(0.9, 1.8, 200, 120),
      layerSize(0.75, 1.5, 180, 100),
    ),
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
    layout: layout(
      'fixed',
      layerSize(2.3, 2.7, 128, 152),
      layerSize(2.5, 1.3, 140, 72),
      layerSize(1.8, 2.4, 104, 136),
      layerSize(1.6, 2.7, 96, 152),
    ),
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
    layout: layout(
      'sector',
      layerSize(1.3, 2.4, 180, 140),
      layerSize(1.4, 2.1, 190, 128),
      layerSize(1.2, 1.9, 160, 112),
      layerSize(1.05, 1.7, 150, 104),
      verticalLayout(0.74, 0),
    ),
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
  result.intensity = round3(critical ? 0.75 + (progress - 0.7) * (5 / 6) : 0.58 + progress * 0.24)
  result.travel = round3(critical ? (progress - 0.7) / 0.3 : 0)
  return result
}

function round3(value) {
  return Math.round(value * 1000) / 1000
}

function resources(main, accent, particle) {
  return Object.freeze({ main, accent, particle })
}

function layerSize(widthScale, heightScale, minWidth, minHeight) {
  return Object.freeze({ widthScale, heightScale, minWidth, minHeight })
}

function layout(axis, mainShape, accent, particleNear, particleFar, vertical) {
  return Object.freeze({
    axis,
    layers: Object.freeze({ mainShape, accent, particleNear, particleFar }),
    ...(vertical ? { vertical } : {}),
  })
}

function verticalLayout(maxLongAxisRatio, rotationFactor) {
  return Object.freeze({ maxLongAxisRatio, rotationFactor })
}

function rgba(red, green, blue, alpha) {
  return Object.freeze([red, green, blue, alpha])
}
