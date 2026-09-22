import type { DungeonExtractionState } from './DungeonExtractionRuntime.ts'
import type { DungeonMapState } from './DungeonMapRuntime.ts'
import type { DungeonPressureState } from './DungeonPressureRuntime.ts'
import type { PursuitBossState } from './PursuitBossRuntime.ts'

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
  rooms: DungeonRoom[]
}

export interface DungeonRun {
  id: string
  seed: number
  profile: DungeonProfile
  phase: DungeonRunPhase
  map: DungeonMapState
  pressure: DungeonPressureState
  pursuer: PursuitBossState
  extraction: DungeonExtractionState
  doorCurrency: number
  searchedRoomIds: string[]
  carriedLoot: RunLoot[]
  boundLoot: RunLoot[]
  eventSequence: number
}

export interface DungeonExtractionEvent {
  runId: string
  loot: RunLoot[]
}

export type DungeonCommand =
  | { type: 'search' }
  | { type: 'choose-exit'; exitId: string }
  | { type: 'activate-altar' }
  | { type: 'begin-extraction' }
  | { type: 'abandon' }

export type DungeonRunEvent =
  | { type: 'room-searched'; roomId: string; loot: RunLoot[]; doorCurrencyGranted: number }
  | { type: 'room-entered'; fromRoomId: string; roomId: string; exitId: string; cost: number }
  | { type: 'pressure-phase-changed'; phase: DungeonPressurePhase }
  | { type: 'pursuer-hunt-started'; hunt: 1 | 2 }
  | { type: 'route-sealed'; exitId: string }
  | { type: 'route-unsealed'; exitId: string }
  | { type: 'altar-activated'; roomId: string }
  | { type: 'extraction-started'; roomId: string }
  | { type: 'extraction-interrupted'; reason: 'elite-damage' | 'boss-damage' }
  | { type: 'pursuer-shield-damaged'; remaining: number }
  | { type: 'pursuer-health-damaged'; remaining: number }
  | { type: 'pursuer-repelled'; phase: 'first-repelled' | 'second-repelled' }
  | { type: 'pursuer-defeated' }
  | {
      type: 'extraction-completed'
      exitKind: 'damaged' | 'full'
      explorationRate: number
      bossDefeated: boolean
      loot: RunLoot[]
      retainedLoot: RunLoot[]
    }
  | { type: 'dungeon-defeated'; retainedLoot: RunLoot[] }
  | { type: 'dungeon-abandoned'; retainedLoot: RunLoot[] }
