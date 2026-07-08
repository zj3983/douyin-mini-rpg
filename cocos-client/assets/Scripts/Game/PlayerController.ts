import { _decorator, Component, Node, Vec3 } from 'cc'

const { ccclass, property } = _decorator

@ccclass('PlayerController')
export class PlayerController extends Component {
  @property(Node)
  public swordMount: Node | null = null

  @property
  public moveSpeed = 220

  private target = new Vec3()
  private hasTarget = false

  public moveTo(worldPosition: Vec3) {
    this.target.set(worldPosition)
    this.hasTarget = true
  }

  update(deltaTime: number) {
    this.animateSword(deltaTime)
    if (!this.hasTarget) return
    const current = this.node.worldPosition
    const next = new Vec3()
    Vec3.lerp(next, current, this.target, Math.min(1, deltaTime * 4))
    this.node.setWorldPosition(next)
    if (Vec3.distance(next, this.target) < 4) this.hasTarget = false
  }

  private animateSword(deltaTime: number) {
    if (!this.swordMount) return
    const y = Math.sin(Date.now() * 0.004) * 4
    this.swordMount.setPosition(this.swordMount.position.x, y - 36, this.swordMount.position.z)
  }
}
