const spirit = rgba(141, 232, 218, 190)
const impact = rgba(255, 240, 189, 245)

const PROFILES = Object.freeze({
  sweep: Object.freeze({
    id: 'sweep-seal',
    glyph: '斩',
    talismanPath: 'Assets/Skills/BossDomain/talisman_sweep/spriteFrame',
    warning: rgba(232, 190, 88, 220),
    spirit,
    impact,
  }),
  spike: Object.freeze({
    id: 'spike-seal',
    glyph: '突',
    talismanPath: 'Assets/Skills/BossDomain/talisman_spike/spriteFrame',
    warning: rgba(164, 58, 44, 220),
    spirit,
    impact,
  }),
  'roar-sector': Object.freeze({
    id: 'roar-seal',
    glyph: '镇',
    talismanPath: 'Assets/Skills/BossDomain/talisman_roar/spriteFrame',
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

export function talismanPulse(duration, remaining, out) {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 1
  const finiteRemaining = Number.isFinite(remaining) ? remaining : safeDuration
  const safeRemaining = Math.min(safeDuration, Math.max(0, finiteRemaining))
  const progress = round3(1 - safeRemaining / safeDuration)
  const hot = safeRemaining <= 0.15
  const alpha = hot
    ? 0.72 + 0.2 * Math.sin(progress * Math.PI * 18)
    : 0.54 + progress * 0.24
  const result = out ?? { progress: 0, alpha: 0, hot: false }
  result.progress = progress
  result.alpha = round3(alpha)
  result.hot = hot
  return result
}

function round3(value) {
  return Math.round(value * 1000) / 1000
}

function rgba(red, green, blue, alpha) {
  return Object.freeze([red, green, blue, alpha])
}
