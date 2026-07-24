export type ArtifactId =
  | 'flying-sword'
  | 'thunder-seal'
  | 'soul-bell'
  | 'flame-ruler'

export type RelicId = 'soul-magnet' | 'jade-guard' | 'spirit-vessel'

export type ItemRarity = 'common' | 'spirit' | 'mystic' | 'epic' | 'legendary'

export interface PlayerLoadout {
  active: ArtifactId[]
  relics: RelicId[]
}
