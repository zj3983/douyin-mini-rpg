export type BossTelegraphVisualId = 'sweep-seal' | 'spike-seal' | 'roar-seal'

type Rgba = readonly [number, number, number, number]

export interface BossTelegraphVisualProfile {
  readonly id: BossTelegraphVisualId
  readonly glyph: '斩' | '突' | '镇'
  readonly talismanPath: string
  readonly warning: Rgba
  readonly spirit: Rgba
  readonly impact: Rgba
}

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
} as const satisfies Record<string, BossTelegraphVisualProfile>)

export function resolveBossTelegraphVisual(danger: { readonly kind: string }): BossTelegraphVisualProfile {
  if (danger.kind === 'spike' || danger.kind === 'roar-sector') {
    return PROFILES[danger.kind]
  }
  return PROFILES.sweep
}

export function talismanPulse(duration: number, remaining: number): {
  readonly progress: number
  readonly alpha: number
  readonly hot: boolean
} {
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

function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}

function rgba(red: number, green: number, blue: number, alpha: number): Rgba {
  return Object.freeze([red, green, blue, alpha] as const)
}
