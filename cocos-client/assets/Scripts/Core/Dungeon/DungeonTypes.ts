export type DungeonRoomKind = 'entry' | 'combat' | 'treasure' | 'alchemy' | 'mechanism' | 'elite' | 'boss' | 'extraction'

export type DungeonPressurePhase = 'calm' | 'restless' | 'frenzy'

export type DungeonRunPhase = 'exploring' | 'extracting' | 'extracted' | 'defeated' | 'abandoned'

export type PursuitBossPhase =
  | 'dormant'
  | 'first-hunt'
  | 'first-repelled'
  | 'second-hunt'
  | 'second-repelled'
  | 'true-form-locked'
  | 'final-fight'
  | 'defeated'

export interface RunLoot {
  itemId: string
  amount: number
}

export interface DungeonExit {
  id: string
  to: string
  cost: number
  unlock?: 'boss-defeat'
}

export interface DungeonRoom {
  id: string
  floor: 1 | 2 | 3
  kind: DungeonRoomKind
  sceneId: string
  risk: 'low' | 'medium' | 'high' | 'extreme'
  encounterId?: string
  exits: DungeonExit[]
  loot?: RunLoot[]
  doorCurrency?: number
  searchPressureSeconds?: 12 | 20
}

export interface DungeonProfile {
  id: string
  entryRoomId: string
  extractionRoomIds: string[]
  finalExtractionRoomId: string
  bossAltarRoomId: string
  /** @deprecated Runtime compatibility alias for finalExtractionRoomId. */
  extractionRoomId?: string
  rooms: DungeonRoom[]
}

export interface DungeonRun {
  id: string
  profile: DungeonProfile
  phase: DungeonRunPhase
  currentRoomId: string
  doorCurrency: number
  searchedRoomIds: string[]
  carriedLoot: RunLoot[]
}

export interface DungeonExtractionEvent {
  runId: string
  loot: RunLoot[]
}
