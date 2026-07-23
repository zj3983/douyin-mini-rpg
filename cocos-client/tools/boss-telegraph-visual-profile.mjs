const spirit = [141, 232, 218, 190]
const impact = [255, 240, 189, 245]

const profiles = {
  sweep: {
    id: 'sweep-seal',
    glyph: '斩',
    talismanPath: 'Assets/Skills/BossDomain/talisman_sweep/spriteFrame',
    warning: [232, 190, 88, 220],
    spirit,
    impact,
  },
  spike: {
    id: 'spike-seal',
    glyph: '突',
    talismanPath: 'Assets/Skills/BossDomain/talisman_spike/spriteFrame',
    warning: [164, 58, 44, 220],
    spirit,
    impact,
  },
  'roar-sector': {
    id: 'roar-seal',
    glyph: '镇',
    talismanPath: 'Assets/Skills/BossDomain/talisman_roar/spriteFrame',
    warning: [232, 190, 88, 220],
    spirit,
    impact,
  },
}

export function resolveBossTelegraphVisual(danger) {
  if (danger.kind === 'spike' || danger.kind === 'roar-sector') {
    return profiles[danger.kind]
  }
  return profiles.sweep
}

export function talismanPulse(duration, remaining) {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 1
  const finiteRemaining = Number.isFinite(remaining) ? remaining : safeDuration
  const safeRemaining = Math.min(safeDuration, Math.max(0, finiteRemaining))
  const progress = round3(1 - safeRemaining / safeDuration)
  const hot = safeRemaining <= 0.15
  const alpha = hot
    ? 0.72 + 0.2 * Math.sin(progress * Math.PI * 18)
    : 0.54 + progress * 0.24
  return { progress, alpha: round3(alpha), hot }
}

function round3(value) {
  return Math.round(value * 1000) / 1000
}
