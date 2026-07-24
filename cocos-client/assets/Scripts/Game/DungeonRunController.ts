import { _decorator, Component, JsonAsset, Label } from 'cc'
import {
  createDungeonSession,
  extractRun,
} from '../Core/Dungeon/DungeonSession.ts'
import { interactDungeonRun } from '../Core/Dungeon/DungeonInteraction.ts'
import type { DungeonInteractionResult } from '../Core/Dungeon/DungeonInteraction.ts'
import type {
  DungeonExtractionEvent,
  DungeonProfile,
  DungeonRun,
} from '../Core/Dungeon/DungeonTypes.ts'
import { notifyBestEffort } from '../Core/Progression/BestEffortNotification.ts'

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
        ...(room.doorCurrency !== undefined ? { doorCurrency: room.doorCurrency } : {}),
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

  onExtractionRequested: ((payload: DungeonExtractionEvent) => boolean) | null = null

  hasRun() {
    return this.run !== null
  }

  currentRunId() {
    return this.run?.id ?? null
  }

  previewRunId(seed: number) {
    if (!this.profileData) return null
    try {
      return createDungeonSession(this.profileData.json as DungeonProfile, seed).id
    } catch {
      return null
    }
  }

  begin(seed: number) {
    if (this.run) return false
    if (!this.profileData) return false

    let nextRun: DungeonRun
    try {
      nextRun = createDungeonSession(this.profileData.json as DungeonProfile, seed)
    } catch {
      return false
    }

    this.run = nextRun
    this.refreshRoomLabel()
    this.emitBestEffort('dungeon-run-began', {
      runId: nextRun.id,
      roomId: nextRun.currentRoomId,
    })
    return true
  }

  cancelRun() {
    if (!this.run) return false
    this.run = null
    this.refreshRoomLabel()
    return true
  }

  isExtractedRun(runId: string) {
    return this.run?.id === runId && this.run.phase === 'extracted'
  }

  interact(): DungeonInteractionResult | null {
    if (!this.run) return null
    const result = interactDungeonRun(this.run)
    if (result.type === 'searched') {
      if (result.loot.length > 0) {
        this.emitBestEffort('dungeon-loot-found', result.loot.map((item) => ({ ...item })))
      }
    } else if (result.type === 'moved') {
      this.refreshRoomLabel()
      this.emitBestEffort('dungeon-room-changed', { roomId: result.roomId })
    } else if (result.type === 'extraction-requested') {
      this.extract()
    }
    return result
  }

  extract() {
    if (!this.run) return false
    const run = this.run
    const result = extractRun(run)
    if (!result.ok) return false
    const request: DungeonExtractionEvent = {
      runId: run.id,
      loot: result.loot.map((item) => ({ ...item })),
    }
    const onExtractionRequested = this.onExtractionRequested
    if (!onExtractionRequested) {
      this.restoreExtraction(run)
      return false
    }
    let accepted = false
    try {
      accepted = onExtractionRequested(request)
    } catch {
      this.restoreExtraction(run)
      return false
    }
    if (!accepted) {
      this.restoreExtraction(run)
      return false
    }
    if (this.run !== run) return false
    this.run = null
    this.refreshRoomLabel()
    const notification: DungeonExtractionEvent = {
      runId: request.runId,
      loot: request.loot.map((item) => ({ ...item })),
    }
    this.emitBestEffort('dungeon-extracted', notification)
    return true
  }

  getRunSnapshot() {
    return this.run ? cloneRun(this.run) : null
  }

  private refreshRoomLabel() {
    if (this.roomLabel) this.roomLabel.string = this.run?.currentRoomId ?? ''
  }

  private emitBestEffort(eventName: string, ...args: unknown[]) {
    notifyBestEffort([{ eventName, args }], (notification) => {
      this.node.emit(notification.eventName, ...notification.args)
    })
  }

  private restoreExtraction(run: DungeonRun) {
    if (this.run === run && run.phase === 'extracted') run.phase = 'exploring'
  }
}
