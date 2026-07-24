export type DungeonRoomKind = 'entry' | 'combat' | 'treasure' | 'alchemy' | 'elite' | 'boss' | 'extraction'

export type DungeonRunPhase = 'exploring' | 'extracted' | 'defeated'

export interface RunLoot {
  itemId: string
  amount: number
}

export interface DungeonExit {
  to: string
  cost: number
}

export interface DungeonRoom {
  id: string
  floor: number
  kind: DungeonRoomKind
  exits: DungeonExit[]
  loot?: RunLoot[]
}

export interface DungeonProfile {
  id: string
  entryRoomId: string
  extractionRoomId: string
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
  acknowledged: boolean
}
