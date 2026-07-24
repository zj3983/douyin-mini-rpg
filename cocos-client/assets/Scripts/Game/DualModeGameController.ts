import { _decorator, Component, Node, sys } from 'cc'
import {
  createDualModeRuntime,
  type DualMode,
  type DualModeRuntime,
  type DungeonSessionPort,
} from '../Core/Progression/DualModeRuntime.ts'
import { createDefaultSave } from '../Core/Progression/PlayerSave.ts'
import { createJsonSaveRepository } from '../Core/Progression/SaveRepository.ts'
import type { SaveRepository } from '../Core/Progression/SaveRepository.ts'
import { notifyBestEffort } from '../Core/Progression/BestEffortNotification.ts'
import { DungeonRunController } from './DungeonRunController'

const { ccclass, property } = _decorator

interface GameNotification {
  eventName: string
  payload?: unknown
}

@ccclass('DualModeGameController')
export class DualModeGameController extends Component {
  @property(Node)
  worldRoot: Node | null = null

  @property(Node)
  dungeonRoot: Node | null = null

  @property(DungeonRunController)
  dungeonRun: DungeonRunController | null = null

  private repository: SaveRepository | null = null
  private runtime: DualModeRuntime | null = null

  onLoad() {
    this.repository = createJsonSaveRepository(sys.localStorage, 'cultivation-save-v3')
    let initialSave = createDefaultSave()
    try {
      initialSave = this.repository.load() ?? initialSave
    } catch {
      this.notifyAll([{ eventName: 'save-load-failed' }])
    }
    this.runtime = createDualModeRuntime({
      initialSave,
      repository: this.repository,
      dungeon: this.createDungeonPort(),
    })
    this.applyMode(this.runtime.getMode())
  }

  handleWorldCleared(payload: unknown) {
    const result = this.runtime?.handleWorldCleared(payload)
    if (!result) return this.reject('world-clear-rejected', 'controller-not-ready')
    if (!result.ok) return this.reject('world-clear-rejected', 'reason' in result ? result.reason : 'transition-rejected')
    this.notifyAll([{
      eventName: 'player-save-changed',
      payload: this.getSaveSnapshot(),
    }])
    return true
  }

  enterDungeon(seed?: number) {
    if (!this.runtime) return this.reject('dungeon-entry-rejected', 'controller-not-ready')
    const result = this.runtime.enterDungeon(seed)
    if (!result.ok) {
      this.applyMode(this.runtime.getMode())
      return this.reject('dungeon-entry-rejected', 'reason' in result ? result.reason : 'transition-rejected')
    }
    this.applyMode('dungeon')
    const notifications: GameNotification[] = [
      { eventName: 'player-save-changed', payload: this.getSaveSnapshot() },
      { eventName: 'dungeon-entry-accepted', payload: { seed: result.seed, runId: result.runId } },
    ]
    this.notifyAll(notifications)
    return true
  }

  handleDungeonExtracted(payload: unknown) {
    const result = this.runtime?.handleDungeonExtracted(payload)
    if (!result) return this.reject('dungeon-extraction-rejected', 'controller-not-ready')
    if (!result.ok) {
      return this.reject('dungeon-extraction-rejected', 'reason' in result ? result.reason : 'transition-rejected')
    }
    this.applyMode('world')
    const notifications: GameNotification[] = []
    if (result.saveChanged) {
      notifications.push({
        eventName: 'player-save-changed',
        payload: this.getSaveSnapshot(),
      })
    }
    notifications.push({
      eventName: 'dungeon-extraction-accepted',
      payload: {
        runId: result.runId,
        duplicate: result.duplicate,
      },
    })
    this.notifyAll(notifications)
    return true
  }

  getSaveSnapshot() {
    return this.runtime?.getSaveSnapshot() ?? createDefaultSave()
  }

  private createDungeonPort(): DungeonSessionPort {
    return {
      hasRun: () => this.dungeonRun?.hasRun() ?? false,
      currentRunId: () => this.dungeonRun?.currentRunId() ?? null,
      previewRunId: (seed) => this.dungeonRun?.previewRunId(seed) ?? null,
      begin: (seed) => this.dungeonRun?.begin(seed) ?? false,
      cancelRun: () => this.dungeonRun?.cancelRun() ?? false,
      isExtractedRun: (runId) => this.dungeonRun?.isExtractedRun(runId) ?? false,
      extractedLoot: (runId) => this.dungeonRun?.extractedLoot(runId) ?? null,
    }
  }

  private applyMode(mode: DualMode) {
    if (this.worldRoot) this.worldRoot.active = mode === 'world'
    if (this.dungeonRoot) this.dungeonRoot.active = mode === 'dungeon'
  }

  private reject(eventName: string, reason: string) {
    const notifications: GameNotification[] = []
    if (reason === 'save-persist-failed' || reason === 'save-persist-rollback-failed') {
      notifications.push({
        eventName: 'save-persist-failed',
        payload: { operation: eventName, reason },
      })
    }
    notifications.push({ eventName, payload: { reason } })
    this.notifyAll(notifications)
    return false
  }

  private notifyAll(notifications: readonly GameNotification[]) {
    notifyBestEffort(notifications, (notification) => {
      this.node.emit(notification.eventName, notification.payload)
    })
  }
}
