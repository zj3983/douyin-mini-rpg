import type { DungeonRun, RunLoot } from './DungeonTypes.ts'
import { enterRoom, searchRoom } from './DungeonSession.ts'

export type DungeonInteractionResult =
  | { type: 'searched'; roomId: string; loot: RunLoot[]; doorCurrencyGranted: number }
  | { type: 'moved'; fromRoomId: string; roomId: string }
  | { type: 'extraction-requested'; runId: string }
  | {
      type: 'blocked'
      reason: 'inactive' | 'missing-room' | 'already-searched' | 'invalid-currency' | 'not-connected' | 'door-cost'
    }

export function interactDungeonRun(run: DungeonRun): DungeonInteractionResult {
  if (run.phase !== 'exploring') return { type: 'blocked', reason: 'inactive' }
  const room = run.profile.rooms.find((candidate) => candidate.id === run.currentRoomId)
  if (!room) return { type: 'blocked', reason: 'missing-room' }
  if (room.id === run.profile.extractionRoomId) {
    return { type: 'extraction-requested', runId: run.id }
  }

  if (run.searchedRoomIds.indexOf(room.id) < 0) {
    const result = searchRoom(run)
    if (result.ok === false) return { type: 'blocked', reason: result.reason }
    return {
      type: 'searched',
      roomId: room.id,
      loot: result.loot,
      doorCurrencyGranted: result.doorCurrencyGranted,
    }
  }

  if (!Number.isSafeInteger(run.doorCurrency) || run.doorCurrency < 0) {
    return { type: 'blocked', reason: 'invalid-currency' }
  }
  const exit = room.exits.find((candidate) => candidate.cost <= run.doorCurrency)
  if (!exit) return { type: 'blocked', reason: 'door-cost' }
  const fromRoomId = room.id
  const entered = enterRoom(run, exit.to)
  if (entered.ok === false) return { type: 'blocked', reason: entered.reason }
  return { type: 'moved', fromRoomId, roomId: run.currentRoomId }
}
