import { _decorator, Component, JsonAsset, Label } from 'cc'
import {
  createDungeonSession,
  enterRoom,
  extractRun,
  searchRoom,
} from '../Core/Dungeon/DungeonSession.ts'
import type { DungeonProfile, DungeonRun } from '../Core/Dungeon/DungeonTypes.ts'

const { ccclass, property } = _decorator

function cloneRun(run: DungeonRun): DungeonRun {
  return {
    id: run.id,
    profile: {
      id: run.profile.id,
      entryRoomId: run.profile.entryRoomId,
      extractionRoomId: run.profile.extractionRoomId,
      rooms: run.profile.rooms.map((room) => ({
        id: room.id,
        floor: room.floor,
        kind: room.kind,
        exits: room.exits.map((exit) => ({ ...exit })),
        ...(room.loot ? { loot: room.loot.map((item) => ({ ...item })) } : {}),
      })),
    },
    phase: run.phase,
    currentRoomId: run.currentRoomId,
    doorCurrency: run.doorCurrency,
    searchedRoomIds: [...run.searchedRoomIds],
    carriedLoot: run.carriedLoot.map((item) => ({ ...item })),
  }
}

@ccclass('DungeonRunController')
export class DungeonRunController extends Component {
  @property(JsonAsset)
  profileData: JsonAsset | null = null

  @property(Label)
  roomLabel: Label | null = null

  private run: DungeonRun | null = null

  begin(seed: number) {
    this.run = null
    this.refreshRoomLabel()
    if (!this.profileData) return false

    try {
      const nextRun = createDungeonSession(this.profileData.json as DungeonProfile, seed)
      this.run = nextRun
      this.refreshRoomLabel()
      this.node.emit('dungeon-run-began', {
        runId: nextRun.id,
        roomId: nextRun.currentRoomId,
      })
      return true
    } catch {
      return false
    }
  }

  grantDoorCurrency(amount: number) {
    if (!this.run || !Number.isSafeInteger(amount) || amount <= 0) return false
    const nextTotal = this.run.doorCurrency + amount
    if (!Number.isSafeInteger(nextTotal)) return false
    this.run.doorCurrency = nextTotal
    return true
  }

  moveTo(roomId: string) {
    if (!this.run) return false
    const result = enterRoom(this.run, roomId)
    if (!result.ok) return false
    this.refreshRoomLabel()
    this.node.emit('dungeon-room-changed', { roomId: this.run.currentRoomId })
    return true
  }

  searchCurrentRoom() {
    if (!this.run) return []
    const result = searchRoom(this.run)
    if (result.loot.length > 0) {
      this.node.emit('dungeon-loot-found', result.loot.map((item) => ({ ...item })))
    }
    return result.loot
  }

  extract() {
    if (!this.run) return false
    const result = extractRun(this.run)
    if (!result.ok) return false
    this.node.emit('dungeon-extracted', {
      runId: this.run.id,
      loot: result.loot.map((item) => ({ ...item })),
    })
    return true
  }

  getRunSnapshot() {
    return this.run ? cloneRun(this.run) : null
  }

  private refreshRoomLabel() {
    if (this.roomLabel) this.roomLabel.string = this.run?.currentRoomId ?? ''
  }
}
