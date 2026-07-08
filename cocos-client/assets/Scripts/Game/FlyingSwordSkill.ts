import { _decorator, Component, Node, Vec3 } from 'cc'

const { ccclass, property } = _decorator

@ccclass('FlyingSwordSkill')
export class FlyingSwordSkill extends Component {
  @property(Node)
  public sword: Node | null = null

  @property
  public cooldown = 1.2

  private timer = 0
  private castTime = 0

  update(deltaTime: number) {
    this.timer -= deltaTime
    if (this.timer <= 0) this.cast()
    this.animateFlight(deltaTime)
  }

  private cast() {
    this.timer = this.cooldown
    this.castTime = 0.62
  }

  private animateFlight(deltaTime: number) {
    if (!this.sword || this.castTime <= 0) return
    this.castTime -= deltaTime
    const t = 1 - Math.max(0, this.castTime / 0.62)
    const x = Math.sin(t * Math.PI) * 260
    const y = Math.sin(t * Math.PI * 2) * 38
    this.sword.setPosition(new Vec3(x, y, 0))
  }
}
