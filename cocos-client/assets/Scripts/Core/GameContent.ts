export const ARTIFACT_IDS = [
  'flying-sword',
  'thunder-seal',
  'soul-bell',
  'flame-ruler',
] as const

export type ArtifactId = typeof ARTIFACT_IDS[number]

export const RELIC_IDS = [
  'soul-magnet',
  'jade-guard',
  'spirit-vessel',
] as const

export type RelicId = typeof RELIC_IDS[number]

export type ItemRarity = 'common' | 'spirit' | 'mystic' | 'epic' | 'legendary'

export interface PlayerLoadout {
  active: ArtifactId[]
  relics: RelicId[]
}
