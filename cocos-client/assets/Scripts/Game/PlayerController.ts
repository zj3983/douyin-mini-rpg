import { _decorator, Component, Node, Vec3 } from 'cc'
import {
  createPlayerMovementState,
  PlayerMovementState,
  requestPlayerMovement,
  resetPlayerMovement,
  stepTowardTarget,
  stopPlayerMovement,
} from '../Core/MovementRuntime'

const { ccclass, property } = _decorator

@ccclass('PlayerController')
export class PlayerController extends Component {
  @property(Node)
  public swordMount: Node | null = null

  @property
  public moveSpeed = 220

  private target: Vec3 | null = null
  private movementState: PlayerMovementState = createPlayerMovementState({ x: 0, y: 0 })
  private moving = false
  private hoverElapsed = 0
  private swordMountBasePosition = new Vec3()

  onLoad() {
    const spawnPosition = this.node.worldPosition
    this.movementState = createPlayerMovementState({ x: spawnPosition.x, y: spawnPosition.y })
    if (this.swordMount) this.swordMountBasePosition.set(this.swordMount.position)
  }

  start() {
    this.node.emit('player-action-requested', 'sword_ride')
  }

  public moveTo(worldPosition: Vec3) {
    if (!requestPlayerMovement(this.movementState, worldPosition)) return false
    const current = this.node.worldPosition
    this.target = new Vec3(worldPosition.x, worldPosition.y, current.z)
    this.setMoving(current.x !== this.target.x || current.y !== this.target.y)
    return true
  }

  public stop() {
    stopPlayerMovement(this.movementState)
    this.target = null
    this.setMoving(false, false)
  }

  public reset() {
    const spawnPosition = resetPlayerMovement(this.movementState)
    this.node.setWorldPosition(spawnPosition.x, spawnPosition.y, this.node.worldPosition.z)
    this.target = null
    this.setMoving(false, false)
    this.node.emit('player-action-requested', 'sword_ride')
  }

  update(deltaTime: number) {
    this.hoverElapsed += deltaTime
    this.animateSword()
    const target = this.target
    if (!this.movementState.target || !target) return

    const current = this.node.worldPosition
    const step = stepTowardTarget(current, target, this.moveSpeed, deltaTime)
    this.node.setWorldPosition(step.position.x, step.position.y, current.z)
    if (step.arrived) {
      this.movementState.target = null
      this.target = null
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

  private setMoving(moving: boolean, requestIdleAction = true) {
    if (this.moving === moving) return
    this.moving = moving
    this.node.emit('player-motion-changed', moving)
    if (requestIdleAction) this.node.emit('player-action-requested', 'sword_ride')
  }
}
