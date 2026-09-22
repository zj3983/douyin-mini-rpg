import { _decorator, Component, JsonAsset, Label } from 'cc'
import {
  advanceDungeonRun,
  applyDungeonCommand,
  applyPursuerDamage,
  checkpointDungeonRun,
  createDungeonSession,
  defeatDungeonRun,
  interruptDungeonRun,
  restoreDungeonSession,
  type DungeonCommandResult,
  type DungeonRunCheckpoint,
} from '../Core/Dungeon/DungeonSession.ts'
import type {
  DungeonCommand,
  DungeonProfile,
  DungeonRun,
  DungeonRunEvent,
  RunLoot,
} from '../Core/Dungeon/DungeonTypes.ts'
import { notifyBestEffort } from '../Core/Progression/BestEffortNotification.ts'

const { ccclass, property } = _decorator
const CHECKPOINT_INTERVAL_SECONDS = 0.5
const MAX_FRAME_DELTA_SECONDS = 0.1
const CHECKPOINT_EPSILON = 0.000000001

type ControllerRejected = { accepted: false; reason: string; events: [] }

export type DungeonBattleCompletion =
  | { type: 'pursuer-damage'; effectiveDamage: number }
  | { type: 'player-defeated' }

export type DungeonTerminalResult =
  | { type: 'dungeon-extracted'; runId: string; loot: RunLoot[]; exitKind: 'damaged' | 'full'; explorationRate: number; bossDefeated: boolean }
  | { type: 'dungeon-defeated'; runId: string; retainedLoot: RunLoot[] }
  | { type: 'dungeon-abandoned'; runId: string; retainedLoot: RunLoot[] }

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function rejected(reason: string): ControllerRejected {
  return { accepted: false, reason, events: [] }
}

@ccclass('DungeonRunController')
export class DungeonRunController extends Component {
  @property(JsonAsset) profileData: JsonAsset | null = null
  @property(Label) roomLabel: Label | null = null

  onCheckpoint: ((checkpoint: DungeonRunCheckpoint) => boolean) | null = null
  onRunEvent: ((event: DungeonRunEvent) => void) | null = null
  onTerminalResult: ((result: DungeonTerminalResult) => boolean) | null = null

  private run: DungeonRun | null = null
  private componentPaused = false
  private mapOverlayOpen = false
  private choiceOverlayOpen = false
  private pendingTerminalResult: DungeonTerminalResult | null = null
  private checkpointElapsedSeconds = 0

  isReady(): boolean {
    if (!this.profileData) return false
    try {
      createDungeonSession(this.profileData.json as DungeonProfile, 0)
      return true
    } catch {
      return false
    }
  }

  hasRun(): boolean {
    return this.run !== null
  }

  currentRunId(): string | null {
    return this.run?.id ?? null
  }

  previewRunId(seed: number): string | null {
    if (!this.isReady()) return null
    try {
      return createDungeonSession(this.profileData?.json as DungeonProfile, seed).id
    } catch {
      return null
    }
  }

  begin(seed: number): boolean {
    if (this.run || !this.isReady()) return false
    try {
      this.run = createDungeonSession(this.profileData?.json as DungeonProfile, seed)
      this.resetTransientState()
      this.refreshRoomLabel()
      return true
    } catch {
      return false
    }
  }

  restore(checkpoint: DungeonRunCheckpoint): boolean {
    if (this.run || !this.isReady()) return false
    try {
      this.run = restoreDungeonSession(this.profileData?.json as DungeonProfile, checkpoint)
      this.resetTransientState()
      this.refreshRoomLabel()
      this.captureTerminalResult([])
      return true
    } catch {
      this.run = null
      return false
    }
  }

  checkpoint(): DungeonRunCheckpoint | null {
    if (!this.run) return null
    try {
      return checkpointDungeonRun(this.run)
    } catch {
      return null
    }
  }

  cancelRun(): boolean {
    if (!this.run) return false
    this.run = null
    this.resetTransientState()
    this.refreshRoomLabel()
    return true
  }

  isExtractedRun(runId: string): boolean {
    return this.run?.id === runId && this.run.phase === 'extracted'
  }

  extractedLoot(runId: string): RunLoot[] | null {
    if (!this.isExtractedRun(runId) || !this.run) return null
    return cloneValue(this.run.carriedLoot)
  }

  applyCommand(command: DungeonCommand): DungeonCommandResult | ControllerRejected {
    if (this.pendingTerminalResult) return rejected('terminal-pending')
    if (this.isPaused()) return rejected('paused')
    return this.mutate((candidate) => applyDungeonCommand(candidate, command))
  }

  handleEffectiveDamage(hit: { sourceRole: 'ordinary' | 'elite' | 'boss'; effectiveDamage: number }): DungeonCommandResult | ControllerRejected {
    if (this.pendingTerminalResult) return rejected('terminal-pending')
    if (this.isPaused()) return rejected('paused')
    if (!Number.isFinite(hit?.effectiveDamage) || hit.effectiveDamage <= 0) return rejected('ineffective-damage')
    return this.mutate((candidate) => interruptDungeonRun(candidate, hit))
  }

  handleBattleCompleted(result: DungeonBattleCompletion): DungeonCommandResult | ControllerRejected {
    if (this.pendingTerminalResult) return rejected('terminal-pending')
    if (this.isPaused()) return rejected('paused')
    if (result?.type === 'pursuer-damage') {
      if (!Number.isFinite(result.effectiveDamage) || result.effectiveDamage <= 0) return rejected('ineffective-damage')
      return this.mutate((candidate) => applyPursuerDamage(candidate, result.effectiveDamage))
    }
    if (result?.type === 'player-defeated') {
      if (!this.run) return rejected('no-active-run')
      const candidate = this.cloneAuthoritativeRun()
      if (!candidate) return rejected('candidate-restore-failed')
      const terminal = defeatDungeonRun(candidate)
      const event: DungeonRunEvent = { type: 'dungeon-defeated', retainedLoot: terminal.retainedLoot }
      if (!this.commitCandidate(candidate)) return rejected('checkpoint-rejected')
      this.deliverEvents([event])
      this.captureTerminalResult([event])
      return { accepted: true, events: [cloneValue(event)], retainedLoot: cloneValue(terminal.retainedLoot) }
    }
    return rejected('invalid-battle-completion')
  }

  update(deltaSeconds: number): void {
    if (!this.run || this.isPaused() || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return
    if (this.pendingTerminalResult) return
    const candidate = this.cloneAuthoritativeRun()
    if (!candidate) return
    const previousPhase = this.run.phase
    let result: { events: DungeonRunEvent[] }
    try {
      result = advanceDungeonRun(candidate, deltaSeconds, { paused: false })
    } catch {
      return
    }
    const elapsed = Math.min(deltaSeconds, MAX_FRAME_DELTA_SECONDS)
    const nextCheckpointElapsed = this.checkpointElapsedSeconds + elapsed
    const requiresImmediateCheckpoint = result.events.length > 0 || candidate.phase !== previousPhase
    const cadenceReached = nextCheckpointElapsed + CHECKPOINT_EPSILON >= CHECKPOINT_INTERVAL_SECONDS
    if (requiresImmediateCheckpoint || cadenceReached) {
      this.checkpointElapsedSeconds = nextCheckpointElapsed
      if (!this.commitCandidate(candidate)) return
    } else {
      this.run = candidate
      this.checkpointElapsedSeconds = nextCheckpointElapsed
      this.refreshRoomLabel()
    }
    this.deliverEvents(result.events)
    this.captureTerminalResult(result.events)
  }

  setPaused(paused: boolean): void {
    this.componentPaused = paused
  }

  setMapOverlayOpen(open: boolean): void {
    this.mapOverlayOpen = open
  }

  setChoiceOverlayOpen(open: boolean): void {
    this.choiceOverlayOpen = open
  }

  acknowledgeTerminalResult(): boolean {
    return this.tryDeliverTerminal()
  }

  getRunSnapshot(): DungeonRunCheckpoint | null {
    return this.checkpoint()
  }

  onDestroy(): void {
    this.onCheckpoint = null
    this.onRunEvent = null
    this.onTerminalResult = null
    this.run = null
    this.resetTransientState()
  }

  private mutate(mutation: (candidate: DungeonRun) => DungeonCommandResult): DungeonCommandResult | ControllerRejected {
    if (!this.run) return rejected('no-active-run')
    const candidate = this.cloneAuthoritativeRun()
    if (!candidate) return rejected('candidate-restore-failed')
    let result: DungeonCommandResult
    try {
      result = mutation(candidate)
    } catch {
      return rejected('mutation-failed')
    }
    if (!result.accepted) return cloneValue(result)
    if (!this.commitCandidate(candidate)) return rejected('checkpoint-rejected')
    this.deliverEvents(result.events)
    this.captureTerminalResult(result.events)
    return cloneValue(result)
  }

  private cloneAuthoritativeRun(): DungeonRun | null {
    if (!this.run) return null
    try {
      return restoreDungeonSession(this.run.profile, checkpointDungeonRun(this.run))
    } catch {
      return null
    }
  }

  private commitCandidate(candidate: DungeonRun): boolean {
    const callback = this.onCheckpoint
    if (!callback) return false
    const checkpoint = checkpointDungeonRun(candidate)
    let accepted = false
    try {
      accepted = callback(cloneValue(checkpoint))
    } catch {
      accepted = false
    }
    if (!accepted) return false
    this.run = candidate
    this.checkpointElapsedSeconds = 0
    this.refreshRoomLabel()
    return true
  }

  private deliverEvents(events: readonly DungeonRunEvent[]): void {
    const callback = this.onRunEvent
    if (!callback) return
    notifyBestEffort(events.map((event) => cloneValue(event)), (event) => callback(cloneValue(event)))
  }

  private captureTerminalResult(events: readonly DungeonRunEvent[]): void {
    if (!this.run) return
    const event = [...events].reverse().find((candidate) => (
      candidate.type === 'extraction-completed' ||
      candidate.type === 'dungeon-defeated' ||
      candidate.type === 'dungeon-abandoned'
    ))
    if (event?.type === 'extraction-completed' || (!event && this.run.phase === 'extracted')) {
      const settlement = event?.type === 'extraction-completed' ? event : null
      this.pendingTerminalResult = {
        type: 'dungeon-extracted',
        runId: this.run.id,
        loot: cloneValue(this.run.carriedLoot),
        exitKind: settlement?.exitKind ?? (this.run.extraction.roomId === this.run.profile.finalExtractionRoomId ? 'full' : 'damaged'),
        explorationRate: settlement?.explorationRate ?? this.explorationRate(this.run),
        bossDefeated: settlement?.bossDefeated ?? this.run.pursuer.phase === 'defeated',
      }
    } else if (event?.type === 'dungeon-defeated' || (!event && this.run.phase === 'defeated')) {
      this.pendingTerminalResult = { type: 'dungeon-defeated', runId: this.run.id, retainedLoot: cloneValue(this.run.boundLoot) }
    } else if (event?.type === 'dungeon-abandoned' || (!event && this.run.phase === 'abandoned')) {
      this.pendingTerminalResult = { type: 'dungeon-abandoned', runId: this.run.id, retainedLoot: cloneValue(this.run.boundLoot) }
    }
  }

  private tryDeliverTerminal(): boolean {
    if (!this.pendingTerminalResult || !this.run) return false
    const callback = this.onTerminalResult
    if (!callback) return false
    let accepted = false
    try {
      accepted = callback(cloneValue(this.pendingTerminalResult))
    } catch {
      accepted = false
    }
    if (!accepted) return false
    this.run = null
    this.pendingTerminalResult = null
    this.checkpointElapsedSeconds = 0
    this.refreshRoomLabel()
    return true
  }

  private explorationRate(run: DungeonRun): number {
    return Number(Math.min(1, new Set(run.map.revealedRoomIds).size / run.profile.rooms.length).toFixed(6))
  }

  private isPaused(): boolean {
    return this.componentPaused || this.mapOverlayOpen || this.choiceOverlayOpen
  }

  private resetTransientState(): void {
    this.componentPaused = false
    this.mapOverlayOpen = false
    this.choiceOverlayOpen = false
    this.pendingTerminalResult = null
    this.checkpointElapsedSeconds = 0
  }

  private refreshRoomLabel(): void {
    if (this.roomLabel) this.roomLabel.string = this.run?.map.currentRoomId ?? ''
  }
}
