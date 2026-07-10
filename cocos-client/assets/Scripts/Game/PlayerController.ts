import { _decorator, Component, Node, Vec3 } from 'cc'
import { stepTowardTarget } from '../Core/MovementRuntime'

const { ccclass, property } = _decorator

@ccclass('PlayerController')
export class PlayerController extends Component {
  @property(Node)
  public swordMount: Node | null = null

  @property
  public moveSpeed = 220

  private target = new Vec3()
  private hasTarget = false
  private moving = false
  private hoverElapsed = 0
  private swordMountBasePosition = new Vec3()

  onLoad() {
    if (this.swordMount) this.swordMountBasePosition.set(this.swordMount.position)
  }

  start() {
    this.node.emit('player-action-requested', 'sword_ride')
  }

  public moveTo(worldPosition: Vec3) {
    const current = this.node.worldPosition
    this.target.set(worldPosition.x, worldPosition.y, current.z)
    this.hasTarget = true
    this.setMoving(current.x !== this.target.x || current.y !== this.target.y)
  }

  update(deltaTime: number) {
    this.hoverElapsed += deltaTime
    this.animateSword()
    if (!this.hasTarget) return

    const current = this.node.worldPosition
    const step = stepTowardTarget(current, this.target, this.moveSpeed, deltaTime)
    this.node.setWorldPosition(step.position.x, step.position.y, current.z)
    if (step.arrived) {
      this.hasTarget = false
      this.setMoving(false)
    }
  }

  private animateSword() {
    if (!this.swordMount) return
    const yOffset = Math.sin(this.hoverElapsed * 4) * 4
    this.swordMount.setPosition(
      this.swordMountBasePosition.x,
      this.swordMountBasePosition.y + yOffset,
      this.swordMountBasePosition.z,
    )
  }

  private setMoving(moving: boolean) {
    if (this.moving === moving) return
    this.moving = moving
    this.node.emit('player-motion-changed', moving)
    this.node.emit('player-action-requested', 'sword_ride')
  }
}
