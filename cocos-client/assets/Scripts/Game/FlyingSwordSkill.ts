import { _decorator, Component, Node, Vec3 } from 'cc'
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
  public flightDuration = 0.62

  @property
  public arcHeight = 38

  private timer = 0
  private castTime = 0

  update(deltaTime: number) {
    this.timer -= deltaTime
    if (this.timer <= 0) this.cast()
    this.animateFlight(deltaTime)
  }

  private cast() {
    this.timer = this.cooldown
    this.castTime = this.flightDuration
    const result = this.battleRuntime?.castFlyingSword()
    this.node.emit('sword-cast-started', result)
  }

  private animateFlight(deltaTime: number) {
    if (!this.sword || this.castTime <= 0) return
    this.castTime -= deltaTime
    const t = 1 - Math.max(0, this.castTime / this.flightDuration)
    const startX = this.battleRuntime?.swordStartX ?? -180
    const endX = this.battleRuntime?.swordEndX ?? 300
    const baseY = this.battleRuntime?.swordY ?? -30
    const x = startX + (endX - startX) * t
    const y = baseY + Math.sin(t * Math.PI) * this.arcHeight
    this.sword.setPosition(new Vec3(x, y, 0))
  }
}
