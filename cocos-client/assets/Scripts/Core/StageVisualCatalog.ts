export interface StageVisual {
  stageId: number
  backgroundId: string
  theme: string
  farPath: string
  midPath: string | null
}

const STAGE_VISUALS: Readonly<Record<number, StageVisual>> = Object.freeze({
  1: {
    stageId: 1,
    backgroundId: 'green-hill-bamboo-rain',
    theme: 'mist-bamboo',
    farPath: 'Assets/World/MistBamboo/far/spriteFrame',
    midPath: 'Assets/World/MistBamboo/mid/spriteFrame',
  },
  2: {
    stageId: 2,
    backgroundId: 'mist-lantern-forest',
    theme: 'mist-bamboo',
    farPath: 'Assets/World/MistLantern/far/spriteFrame',
    midPath: null,
  },
  3: {
    stageId: 3,
    backgroundId: 'red-flame-ravine',
    theme: 'flame-cave',
    farPath: 'Assets/World/FlameRavine/far/spriteFrame',
    midPath: null,
  },
  4: {
    stageId: 4,
    backgroundId: 'fallen-star-ancient-road',
    theme: 'starlight-ruin',
    farPath: 'Assets/World/StarRoad/far/spriteFrame',
    midPath: null,
  },
})

export function stageVisualFor(stageId: number): StageVisual {
  const visual = STAGE_VISUALS[stageId]
  if (!visual) throw new Error(`Unknown stage visual: ${stageId}`)
  return visual
}
