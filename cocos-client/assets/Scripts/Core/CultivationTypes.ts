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

export type EnemyRole = 'ground' | 'flying' | 'boss'

export interface EnemyProfile {
  id: string
  name: string
  role: EnemyRole
  theme: string
}

export interface StageProfile {
  id: number
  name: string
  theme: string
  background: string
  enemies: EnemyProfile[]
  boss: EnemyProfile
}

export interface DungeonFloorProfile {
  floor: number
  scene: string
  material: string
  boss: boolean
}

export interface DungeonProfile {
  id: string
  name: string
  theme: string
  entryTicket: string
  bossArtifact: string
  floors: DungeonFloorProfile[]
  rewards: {
    gachaTickets: boolean
    artifactEssence: boolean
    artifact: boolean
  }
}

export interface DungeonFloorOutcome {
  extracted: boolean
  bossKilled: boolean
}

export interface DungeonFloorResult {
  status: 'fighting' | 'extracted' | 'cleared'
  floor: DungeonFloorProfile
  reward: {
    material: string
    gachaTickets: number
    spiritStones: number
    artifactEssence: number
    artifact?: string
  }
}
