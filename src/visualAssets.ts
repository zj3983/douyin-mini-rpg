export type VisualCharacterId = 'sword' | 'thunder' | 'flame' | 'wood'
export type VisualEnemyKind = 'slime' | 'bat' | 'wolf' | 'crystal' | 'warden'

export interface CharacterVisualSpec {
  portrait: string
  battle: string
  actions?: Partial<Record<'sheet' | 'idle' | 'fly' | 'slash', string>>
  role: 'sword' | 'thunder' | 'flame' | 'wood'
  motion: 'sword-rider' | 'seal-caster' | 'talisman-caster' | 'healer'
  palette: string[]
}

export interface MonsterVisualSpec {
  image: string
  family: 'spirit' | 'flying' | 'beast' | 'crystal' | 'guardian'
  motion: 'ground' | 'flying' | 'heavy'
}

export interface WorldMonsterVisualSpec extends MonsterVisualSpec {
  stage: string
  layout: {
    width: number
    height: number
    lift: number
    barWidth: number
    barY: number
    motion: 'ground' | 'flying' | 'heavy'
  }
}

export const characterVisuals: Record<VisualCharacterId, CharacterVisualSpec> = {
  sword: {
    portrait: '/assets/generated/portrait-sword.webp',
    battle: '/assets/generated/action-sword-idle.png',
    actions: {
      sheet: '/assets/generated/action-sword-sheet-ai.webp',
      idle: '/assets/generated/action-sword-idle.png',
      fly: '/assets/generated/action-sword-fly.png',
      slash: '/assets/generated/action-sword-slash.png',
    },
    role: 'sword',
    motion: 'sword-rider',
    palette: ['#67e8f9', '#bae6fd', '#0f172a'],
  },
  thunder: {
    portrait: '/assets/generated/portrait-thunder.webp',
    battle: '/assets/generated/character-thunder.png',
    role: 'thunder',
    motion: 'seal-caster',
    palette: ['#38bdf8', '#e0f2fe', '#172554'],
  },
  flame: {
    portrait: '/assets/generated/portrait-flame.webp',
    battle: '/assets/generated/character-flame.png',
    role: 'flame',
    motion: 'talisman-caster',
    palette: ['#fb923c', '#fed7aa', '#431407'],
  },
  wood: {
    portrait: '/assets/generated/portrait-wood.webp',
    battle: '/assets/generated/character-wood.png',
    role: 'wood',
    motion: 'healer',
    palette: ['#86efac', '#bbf7d0', '#052e16'],
  },
}

export const dungeonMonsterVisuals: Record<VisualEnemyKind, MonsterVisualSpec> = {
  slime: { image: '/assets/generated/monster-spirit-fox.png', family: 'spirit', motion: 'ground' },
  bat: { image: '/assets/generated/monster-bone-bat.png', family: 'flying', motion: 'flying' },
  wolf: { image: '/assets/generated/monster-crystal-beast.png', family: 'beast', motion: 'ground' },
  crystal: { image: '/assets/generated/monster-crystal-beast.png', family: 'crystal', motion: 'heavy' },
  warden: { image: '/assets/generated/monster-gatekeeper.png', family: 'guardian', motion: 'heavy' },
}

export const worldMonsterVisuals: WorldMonsterVisualSpec[] = [
  {
    stage: 'moss-hills',
    image: '/assets/generated/monster-world-moss.webp',
    family: 'spirit',
    motion: 'ground',
    layout: { width: 138, height: 164, lift: 0, barWidth: 86, barY: 146, motion: 'ground' },
  },
  {
    stage: 'star-outpost',
    image: '/assets/generated/monster-world-star-outpost.webp',
    family: 'guardian',
    motion: 'heavy',
    layout: { width: 146, height: 142, lift: 4, barWidth: 88, barY: 126, motion: 'heavy' },
  },
  {
    stage: 'mist-forest',
    image: '/assets/generated/monster-world-mist-forest.webp',
    family: 'flying',
    motion: 'flying',
    layout: { width: 168, height: 124, lift: 58, barWidth: 86, barY: 110, motion: 'flying' },
  },
  {
    stage: 'crystal-mine',
    image: '/assets/generated/monster-world-crystal-mine.webp',
    family: 'crystal',
    motion: 'heavy',
    layout: { width: 178, height: 108, lift: 2, barWidth: 94, barY: 98, motion: 'heavy' },
  },
  {
    stage: 'blood-rift',
    image: '/assets/generated/monster-world-blood-rift.webp',
    family: 'beast',
    motion: 'ground',
    layout: { width: 176, height: 106, lift: 2, barWidth: 94, barY: 98, motion: 'ground' },
  },
  {
    stage: 'royal-ruins',
    image: '/assets/generated/monster-world-royal-ruins.webp',
    family: 'guardian',
    motion: 'heavy',
    layout: { width: 168, height: 126, lift: 2, barWidth: 96, barY: 114, motion: 'heavy' },
  },
  {
    stage: 'star-sea',
    image: '/assets/generated/monster-world-star-sea.webp',
    family: 'flying',
    motion: 'flying',
    layout: { width: 190, height: 130, lift: 50, barWidth: 98, barY: 112, motion: 'flying' },
  },
]

export const skillVfxVisuals = {
  swordWave: '/assets/generated/vfx-sword-qi.webp',
  impact: '/assets/generated/vfx-impact-burst.png',
  thunder: '/assets/generated/vfx-thunder-seal.png',
  lotus: '/assets/generated/vfx-lotus-fire.png',
  heal: '/assets/generated/vfx-heal-aura.png',
} as const

export const techniqueVisualArts = {
  'tech-sword-pierce': '/assets/generated/evolution-tech-sword-pierce.png',
  'tech-sword-return': '/assets/generated/evolution-tech-sword-return.png',
  'tech-sword-shadow': '/assets/generated/evolution-tech-sword-shadow.png',
  'tech-thunder-mark': '/assets/generated/evolution-tech-thunder-mark.svg',
  'tech-thunder-echo': '/assets/generated/evolution-tech-thunder-echo.svg',
  'tech-thunder-cloud': '/assets/generated/evolution-tech-thunder-cloud.svg',
  'tech-flame-focus': '/assets/generated/evolution-tech-flame-focus.svg',
  'tech-flame-spread': '/assets/generated/evolution-tech-flame-spread.svg',
  'tech-flame-sea': '/assets/generated/evolution-tech-flame-sea.svg',
  'tech-wood-heal': '/assets/generated/evolution-tech-wood-heal.svg',
  'tech-wood-ward': '/assets/generated/evolution-tech-wood-ward.svg',
  'tech-wood-bloom': '/assets/generated/evolution-tech-wood-bloom.svg',
} as const

export const visualAssetPaths = [
  ...Object.values(characterVisuals).flatMap((character) => [
    character.portrait,
    character.battle,
    ...Object.values(character.actions ?? {}),
  ]),
  ...Object.values(dungeonMonsterVisuals).map((monster) => monster.image),
  ...worldMonsterVisuals.map((monster) => monster.image),
  ...Object.values(skillVfxVisuals),
  ...Object.values(techniqueVisualArts),
]
