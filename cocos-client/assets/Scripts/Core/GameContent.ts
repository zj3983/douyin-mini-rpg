export type ArtifactId =
  | 'flying-sword'
  | 'thunder-seal'
  | 'soul-bell'
  | 'flame-ruler'

export type RelicId = 'soul-magnet' | 'jade-guard' | 'spirit-vessel'

export const ARTIFACT_IDS: readonly ArtifactId[] = [
  'flying-sword',
  'thunder-seal',
  'soul-bell',
  'flame-ruler',
]

export const RELIC_IDS: readonly RelicId[] = [
  'soul-magnet',
  'jade-guard',
  'spirit-vessel',
]

export type ItemRarity = 'common' | 'spirit' | 'mystic' | 'epic' | 'legendary'

export interface PlayerLoadout {
  active: ArtifactId[]
  relics: RelicId[]
}
