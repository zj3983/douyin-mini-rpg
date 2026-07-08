export interface CharacterAsset {
  id: string
  name: string
  portrait: string
  combatSprite: string
  motions: Record<'idle' | 'move' | 'cast' | 'hurt', string>
  innateSkill: string
  startingArtifact: string
}

export interface MonsterAsset {
  id: string
  name: string
  theme: string
  sprite: string
  motions: Record<'idle' | 'move' | 'attack' | 'hurt' | 'death', string>
  skillCue: string
}

export interface SkillAsset {
  id: string
  name: string
  icon: string
  projectile: string
  impact: string
  fullScreen: string
}

export interface ArtifactAsset {
  id: string
  name: string
  rarity: string
  color: string
  icon: string
  sourceDungeon: string
}

export interface AssetCatalogData {
  characters: CharacterAsset[]
  monsters: MonsterAsset[]
  skills: SkillAsset[]
  artifacts: ArtifactAsset[]
}

function findById<T extends { id: string }>(list: T[], id: string, label: string): T {
  const item = list.find((entry) => entry.id === id)
  if (!item) {
    throw new Error(`Unknown ${label}: ${id}`)
  }
  return item
}

export function findCharacter(catalog: AssetCatalogData, id: string): CharacterAsset {
  return findById(catalog.characters, id, 'character')
}

export function findArtifact(catalog: AssetCatalogData, id: string): ArtifactAsset {
  return findById(catalog.artifacts, id, 'artifact')
}

export function findSkill(catalog: AssetCatalogData, id: string): SkillAsset {
  return findById(catalog.skills, id, 'skill')
}

export function monstersForTheme(catalog: AssetCatalogData, theme: string): MonsterAsset[] {
  return catalog.monsters.filter((monster) => monster.theme === theme)
}

export function skillsForCharacter(catalog: AssetCatalogData, characterId: string): SkillAsset[] {
  const character = findCharacter(catalog, characterId)
  return [findSkill(catalog, character.innateSkill)]
}
