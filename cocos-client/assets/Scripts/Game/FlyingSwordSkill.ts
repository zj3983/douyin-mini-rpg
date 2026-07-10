import { _decorator, Component, Node, Vec3 } from 'cc'
import {
  advanceFlyingSwordTimeline,
  createFlyingSwordTimeline,
  FlyingSwordPhase,
  FlyingSwordTimeline,
  FlyingSwordTimelineEvent,
  resetFlyingSwordTimeline,
} from '../Core/FlyingSwordRuntime'
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
  public flightDuration = 0.62

  @property
  public arcHeight = 64

  private timeline: FlyingSwordTimeline | null = null

  onLoad() {
    this.timeline = this.createTimeline()
    this.resetSwordPresentation()
  }

  onDisable() {
    if (this.timeline) resetFlyingSwordTimeline(this.timeline)
    this.resetSwordPresentation()
  }

  update(deltaTime: number) {
    if (!this.battleRuntime) return
    if (this.battleRuntime.isBattleFrozen()) {
      this.resetSwordPresentation()
      return
    }
    if (!this.timeline) this.timeline = this.createTimeline()

    const events = advanceFlyingSwordTimeline(this.timeline, deltaTime)
    for (const event of events) this.handleTimelineEvent(event)
    this.syncSwordPresentation()
  }

  private createTimeline() {
    return createFlyingSwordTimeline({
      cooldown: this.cooldown,
      handSealDuration: this.handSealDuration,
      flightDuration: this.flightDuration,
    })
  }

  private handleTimelineEvent(event: FlyingSwordTimelineEvent) {
    if (event.type === 'castStarted') {
      this.node.emit('sword-cast-started', { phase: 'handSeal' })
      return
    }
    if (event.type === 'action') {
      this.node.emit('player-action-requested', event.action)
      return
    }
    if (event.type === 'pass') {
      const path = this.getPath(event.phase)
      const result = this.battleRuntime?.castFlyingSwordPass(path.from, path.to)
      this.node.emit('sword-pass-resolved', { phase: event.phase, result })
      return
    }
    this.resetSwordPresentation()
  }

  private syncSwordPresentation() {
    if (!this.sword || !this.timeline) return
    if (this.timeline.state !== 'outbound' && this.timeline.state !== 'returning') {
      this.sword.active = false
      return
    }

    this.sword.active = true
    const path = this.getPath(this.timeline.state)
    this.applySwordPose(path.from, path.to, this.timeline.progress)
  }

  private getPath(phase: FlyingSwordPhase) {
    const start = new Vec3(
      this.battleRuntime?.swordStartX ?? -180,
      this.battleRuntime?.swordY ?? -30,
      0,
    )
    const end = new Vec3(
      this.battleRuntime?.swordEndX ?? 300,
      this.battleRuntime?.swordY ?? -30,
      0,
    )
    return phase === 'outbound' ? { from: start, to: end } : { from: end, to: start }
  }

  private applySwordPose(from: Vec3, to: Vec3, progress: number) {
    if (!this.sword) return
    const x = from.x + (to.x - from.x) * progress
    const y = from.y + (to.y - from.y) * progress + Math.sin(progress * Math.PI) * this.arcHeight
    const tangentX = to.x - from.x
    const tangentY = to.y - from.y + Math.cos(progress * Math.PI) * Math.PI * this.arcHeight
    const angle = Math.atan2(tangentY, tangentX) * 180 / Math.PI
    this.sword.setPosition(x, y, from.z)
    this.sword.setRotationFromEuler(0, 0, angle)
  }

  private resetSwordPresentation() {
    if (!this.sword) return
    const start = this.getPath('outbound').from
    this.sword.setPosition(start)
    this.sword.setRotationFromEuler(0, 0, 0)
    this.sword.active = false
  }
}
