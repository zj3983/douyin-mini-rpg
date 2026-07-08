export type CharacterStat = 'attack' | 'health' | 'mana'
export type ArtifactKey = 'flyingSword' | 'thunderSeal' | 'fireRuler' | 'soulBell'

export interface HeroStats {
  level: number
  realm: string
  attack: number
  health: number
  mana: number
}

export interface ArtifactState {
  key: ArtifactKey
  level: number
  owned: boolean
}

export interface SkillMutation {
  id: string
  artifact: ArtifactKey
  unlockLevel: number
  title: string
  description: string
}

export interface DungeonReward {
  gachaTickets: number
  spiritStones: number
  artifactEssence: number
  materials: number
  artifact?: ArtifactKey
}
