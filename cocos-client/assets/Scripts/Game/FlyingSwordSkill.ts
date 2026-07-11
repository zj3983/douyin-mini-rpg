import { _decorator, Component, Node } from 'cc'
import {
  advanceFlyingSwordTimeline,
  createFlyingSwordTimeline,
  FlyingSwordTimeline,
  FlyingSwordTimelineEvent,
  resetFlyingSwordTimeline,
} from '../Core/FlyingSwordRuntime'
import {
  createHomingSword,
  HomingSwordState,
  selectNearestTarget,
  stepHomingSword,
  SwordPoint,
} from '../Core/HomingSwordRuntime'
import { BattleRuntimeController } from './BattleRuntimeController'

const { ccclass, property } = _decorator

@ccclass('FlyingSwordSkill')
export class FlyingSwordSkill extends Component {
  @property(BattleRuntimeController)
  public battleRuntime: BattleRuntimeController | null = null

  @property(Node)
  public sword: Node | null = null

  @property
  public cooldown = 1.2

  @property
  public handSealDuration = 0.22

  @property
  public swordSpeed = 760

  @property
  public maxTurnRadians = 7

  @property
  public maxOutboundDistance = 760

  @property
  public returnRadius = 24

  // Kept until the scene bootstrap stops assigning the former arc setting.
  public arcHeight = 0

  private timeline: FlyingSwordTimeline | null = null
  private homingState: HomingSwordState | null = null

  onLoad() {
    this.timeline = this.createTimeline()
    this.resetSwordPresentation()
  }

  onDisable() {
    this.cancelCast()
  }

  update(deltaTime: number) {
    if (!this.battleRuntime) return
    if (this.battleRuntime.isBattleFrozen()) {
      this.cancelCast()
      return
    }
    if (!this.timeline) this.timeline = this.createTimeline()
    if (this.homingState) {
      this.updateHomingSword(deltaTime)
      return
    }

    const events = advanceFlyingSwordTimeline(this.timeline, deltaTime)
    for (const event of events) this.handleTimelineEvent(event)
    if (this.timeline.state === 'outbound') this.beginHomingSword()
  }

  private createTimeline() {
    return createFlyingSwordTimeline({
      cooldown: this.cooldown,
      handSealDuration: this.handSealDuration,
      flightDuration: Number.MAX_VALUE,
    })
  }

  private handleTimelineEvent(event: FlyingSwordTimelineEvent) {
    if (event.type === 'castStarted') {
      this.node.emit('sword-cast-started', { phase: 'handSeal' })
      return
    }
    if (event.type === 'action') {
      this.node.emit('player-action-requested', event.action)
    }
  }

  private beginHomingSword() {
    if (!this.battleRuntime) return
    const start = this.battleRuntime.getCurrentPlayerPosition()
    const targets = this.battleRuntime.getLivingSwordTargets()
    const target = selectNearestTarget(start, targets)
    const direction = target
      ? { x: target.position.x - start.x, y: target.position.y - start.y }
      : { x: 1, y: 0 }
    this.homingState = createHomingSword(start, direction, {
      speed: this.swordSpeed,
      maxTurnRadians: this.maxTurnRadians,
      maxOutboundDistance: this.maxOutboundDistance,
      returnRadius: this.returnRadius,
    })
    this.homingState.targetId = target?.id ?? null
    if (this.sword) {
      this.sword.setPosition(start.x, start.y, 0)
      this.sword.active = true
    }
  }

  private updateHomingSword(deltaTime: number) {
    if (!this.battleRuntime || !this.homingState) return
    const targets = this.battleRuntime.getLivingSwordTargets()
    const playerPosition = this.battleRuntime.getCurrentPlayerPosition()
    const step = stepHomingSword(this.homingState, deltaTime, targets, playerPosition)
    this.applySwordPose(step.previousPosition, step.nextPosition)
    const result = this.battleRuntime.resolveHomingSwordSegment(this.homingState, step.previousPosition, step.nextPosition)
    this.node.emit('sword-pass-resolved', { phase: step.previousPhase, result })
    if (this.timeline && step.nextPhase === 'returning') this.timeline.state = 'returning'
    if (step.nextPhase === 'finished') this.finishCast()
  }

  private applySwordPose(from: SwordPoint, to: SwordPoint) {
    if (!this.sword) return
    const angle = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI
    this.sword.setPosition(to.x, to.y, 0)
    this.sword.setRotationFromEuler(0, 0, angle)
  }

  private finishCast() {
    this.node.emit('player-action-requested', 'sword_ride')
    if (this.timeline) resetFlyingSwordTimeline(this.timeline)
    this.homingState = null
    this.hideSword()
  }

  private cancelCast() {
    if (this.timeline) resetFlyingSwordTimeline(this.timeline)
    this.homingState = null
    this.hideSword()
  }

  private hideSword() {
    if (!this.sword) return
    this.sword.setRotationFromEuler(0, 0, 0)
    this.sword.active = false
  }
}
