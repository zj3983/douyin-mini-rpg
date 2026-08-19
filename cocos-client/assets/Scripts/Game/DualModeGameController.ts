import { _decorator, Component, Node, sys } from 'cc'
import {
  createDualModeRuntime,
  type DualMode,
  type DualModeRuntime,
  type DungeonSessionPort,
} from '../Core/Progression/DualModeRuntime.ts'
import { createDefaultSave, type PlayerSaveV4 } from '../Core/Progression/PlayerSave.ts'
import { createJsonSaveRepository } from '../Core/Progression/SaveRepository.ts'
import type { SaveRepository } from '../Core/Progression/SaveRepository.ts'
import { notifyBestEffort } from '../Core/Progression/BestEffortNotification.ts'
import { DungeonRunController } from './DungeonRunController'
import type { DungeonTerminalResult } from './DungeonRunController'

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
  private initialSave: PlayerSaveV4 = createDefaultSave()
  private callbacksBoundTo: DungeonRunController | null = null

  onLoad() {
    this.repository = createJsonSaveRepository(sys.localStorage, 'cultivation-save-v4')
    try {
      const current = this.repository.load()
      if (current) {
        this.initialSave = current
      } else {
        const legacy = createJsonSaveRepository(sys.localStorage, 'cultivation-save-v3').load()
        if (legacy) {
          this.initialSave = legacy
          this.repository.save(legacy)
        }
      }
    } catch {
      this.notifyAll([{ eventName: 'save-load-failed' }])
    }
    this.bindDungeonCallbacks()
    this.initializeRuntimeWhenReady()
  }

  update() {
    this.initializeRuntimeWhenReady()
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
    this.initializeRuntimeWhenReady()
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

  handleDungeonDefeated(payload: unknown) {
    return this.handleDungeonTerminal('defeated', payload)
  }

  handleDungeonAbandoned(payload: unknown) {
    return this.handleDungeonTerminal('abandoned', payload)
  }

  getSaveSnapshot() {
    return this.runtime?.getSaveSnapshot() ?? createDefaultSave()
  }

  getHighestClearedWorldStage(): number {
    const save = this.runtime?.getSaveSnapshot() ?? createDefaultSave()
    return save.world.highestClearedStage
  }

  private createDungeonPort(): DungeonSessionPort {
    return {
      isReady: () => this.dungeonRun?.isReady() ?? false,
      hasRun: () => this.dungeonRun?.hasRun() ?? false,
      currentRunId: () => this.dungeonRun?.currentRunId() ?? null,
      previewRunId: (seed) => this.dungeonRun?.previewRunId(seed) ?? null,
      begin: (seed) => this.dungeonRun?.begin(seed) ?? false,
      restore: (checkpoint) => this.dungeonRun?.restore(checkpoint) ?? false,
      checkpoint: () => this.dungeonRun?.checkpoint() ?? null,
      cancelRun: () => this.dungeonRun?.cancelRun() ?? false,
      isExtractedRun: (runId) => this.dungeonRun?.isExtractedRun(runId) ?? false,
      extractedLoot: (runId) => this.dungeonRun?.extractedLoot(runId) ?? null,
    }
  }

  onDestroy() {
    if (this.dungeonRun) {
      this.dungeonRun.onCheckpoint = null
      this.dungeonRun.onTerminalResult = null
    }
    this.runtime = null
    this.repository = null
    this.callbacksBoundTo = null
  }

  private bindDungeonCallbacks() {
    if (!this.dungeonRun || this.callbacksBoundTo === this.dungeonRun) return
    this.callbacksBoundTo = this.dungeonRun
    this.dungeonRun.onCheckpoint = (checkpoint) => {
      const result = this.runtime?.handleDungeonCheckpoint(checkpoint)
      if (!result?.ok) return false
      this.notifyAll([{ eventName: 'player-save-changed', payload: this.getSaveSnapshot() }])
      return true
    }
    this.dungeonRun.onTerminalResult = (result) => this.handleTerminalResult(result)
  }

  private initializeRuntimeWhenReady() {
    this.bindDungeonCallbacks()
    if (this.runtime || !this.repository || !this.dungeonRun?.isReady()) return
    const hadActiveRun = this.initialSave.dungeon.activeRun !== null
    this.runtime = createDualModeRuntime({
      initialSave: this.initialSave,
      repository: this.repository,
      dungeon: this.createDungeonPort(),
    })
    if (hadActiveRun && this.runtime.getMode() === 'world') {
      const repaired = this.runtime.recoverDungeonRestoreFailure()
      if (repaired.ok) {
        this.notifyAll([{ eventName: 'player-save-changed', payload: this.getSaveSnapshot() }])
      } else {
        this.reject('dungeon-restore-rejected', 'reason' in repaired ? repaired.reason : 'transition-rejected')
      }
    }
    this.applyMode(this.runtime.getMode())
  }

  private handleTerminalResult(result: DungeonTerminalResult): boolean {
    if (result.type === 'dungeon-extracted') {
      return this.handleDungeonExtracted({ runId: result.runId, loot: result.loot })
    }
    if (result.type === 'dungeon-defeated') return this.handleDungeonDefeated(result)
    return this.handleDungeonAbandoned(result)
  }

  private handleDungeonTerminal(kind: 'defeated' | 'abandoned', payload: unknown): boolean {
    const method = kind === 'defeated' ? 'handleDungeonDefeated' : 'handleDungeonAbandoned'
    const result = this.runtime?.[method](payload)
    const eventPrefix = kind === 'defeated' ? 'dungeon-defeat' : 'dungeon-abandon'
    if (!result) return this.reject(`${eventPrefix}-rejected`, 'controller-not-ready')
    if (!result.ok) return this.reject(`${eventPrefix}-rejected`, 'reason' in result ? result.reason : 'transition-rejected')
    this.applyMode('world')
    this.notifyAll([
      { eventName: 'player-save-changed', payload: this.getSaveSnapshot() },
      { eventName: `${eventPrefix}-accepted`, payload: { runId: result.runId } },
    ])
    return true
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
