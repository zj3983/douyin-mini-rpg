import { _decorator, Component, JsonAsset, Node } from 'cc'
import {
  advanceBattleSession,
  BattleSession,
  createBattleSession,
  drainCombatEvents,
  settleBattleSession,
} from '../Combat/BattleSession.ts'
import type { CombatEvent, Point2 } from '../Combat/CombatTypes.ts'
import { parseStageOneConfig, StageOneCombatConfig } from '../Combat/StageOneConfig.ts'

const { ccclass, property } = _decorator

export interface VerticalSliceTargetSnapshot {
  readonly id: string
  readonly position: Point2
  readonly alive: boolean
}

@ccclass('VerticalSliceBattleController')
export class VerticalSliceBattleController extends Component {
  @property(JsonAsset)
  public stageConfig: JsonAsset | null = null

  @property(Node)
  public playerNode: Node | null = null

  private session: BattleSession | null = null
  private config: StageOneCombatConfig | null = null
  private generation = 0
  private targets: VerticalSliceTargetSnapshot[] = []

  public initialize(seed = 19) {
    if (!this.stageConfig) return false
    this.config = parseStageOneConfig(this.stageConfig.json)
    this.session = createBattleSession({ stageId: this.config.stageId, seed, config: this.config })
    this.generation = this.session.generation
    this.node.emit('vertical-slice-session-started', {
      stageId: this.session.stageId,
      generation: this.generation,
    })
    return true
  }

  public update(deltaTime: number) {
    if (!this.session) return
    advanceBattleSession(this.session, deltaTime)
    for (const event of drainCombatEvents(this.session)) this.presentCombatEvent(event)
  }

  public bindTargets(targets: readonly VerticalSliceTargetSnapshot[]) {
    this.targets = targets.map((target) => ({
      id: target.id,
      alive: target.alive,
      position: { x: target.position.x, y: target.position.y },
    }))
  }

  public livingTargets(): readonly VerticalSliceTargetSnapshot[] {
    return this.targets.filter((target) => target.alive)
  }

  public playerPosition(): Point2 {
    const position = this.playerNode?.position
    return { x: position?.x ?? 0, y: position?.y ?? 0 }
  }

  public settle(generation: number, reason: 'boss-defeated' | 'timeout' | 'button') {
    if (!this.session || generation !== this.generation) return false
    return settleBattleSession(this.session, reason)
  }

  private presentCombatEvent(event: CombatEvent) {
    this.node.emit('vertical-slice-combat-event', event)
    if (event.type === 'stage-settled') {
      this.node.emit('vertical-slice-stage-settled', {
        stageId: event.stageId,
        generation: this.generation,
        at: event.at,
      })
    }
  }
}
