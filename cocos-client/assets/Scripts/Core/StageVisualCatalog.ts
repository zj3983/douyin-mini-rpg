export interface StageVisual {
  readonly stageId: number
  readonly backgroundId: string
  readonly theme: string
  readonly farPath: string
  readonly midPath: string | null
}

const STAGE_VISUALS: Readonly<Record<number, StageVisual>> = Object.freeze({
  1: Object.freeze({
    stageId: 1,
    backgroundId: 'green-hill-bamboo-rain',
    theme: 'mist-bamboo',
    farPath: 'Assets/World/MistBamboo/far/spriteFrame',
    midPath: 'Assets/World/MistBamboo/mid/spriteFrame',
  }),
  2: Object.freeze({
    stageId: 2,
    backgroundId: 'mist-lantern-forest',
    theme: 'mist-bamboo',
    farPath: 'Assets/World/MistLantern/far/spriteFrame',
    midPath: null,
  }),
  3: Object.freeze({
    stageId: 3,
    backgroundId: 'red-flame-ravine',
    theme: 'flame-cave',
    farPath: 'Assets/World/FlameRavine/far/spriteFrame',
    midPath: null,
  }),
  4: Object.freeze({
    stageId: 4,
    backgroundId: 'fallen-star-ancient-road',
    theme: 'starlight-ruin',
    farPath: 'Assets/World/StarRoad/far/spriteFrame',
    midPath: null,
  }),
})

export function stageVisualFor(stageId: number): StageVisual {
  const visual = STAGE_VISUALS[stageId]
  if (!visual) throw new Error(`Unknown stage visual: ${stageId}`)
  return visual
}

export function planBackgroundRelease(previous: StageVisual | null, current: StageVisual | null): string[] {
  if (!previous) return []
  const currentPaths = new Set(current ? [current.farPath, current.midPath].filter(Boolean) : [])
  return [...new Set([previous.farPath, previous.midPath].filter(Boolean) as string[])]
    .filter((path) => !currentPaths.has(path))
}

function isSameVisual(left: StageVisual | null, right: StageVisual | null) {
  return Boolean(left && right && left.farPath === right.farPath && left.midPath === right.midPath)
}

export function planBackgroundRequest(
  active: StageVisual | null,
  requested: StageVisual | null,
  next: StageVisual,
): 'ignore' | 'cancel' | 'load' {
  if (isSameVisual(requested, next)) return 'ignore'
  if (isSameVisual(active, next)) return 'cancel'
  return 'load'
}
