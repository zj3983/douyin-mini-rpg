import { _decorator, Component, Node, Vec3 } from 'cc'
import {
  advancePlayerMovement,
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
    return true
  }

  public stop() {
    stopPlayerMovement(this.movementState)
    this.setMoving(false, false)
  }

  public reset() {
    const spawnPosition = resetPlayerMovement(this.movementState)
    this.node.setWorldPosition(spawnPosition.x, spawnPosition.y, this.node.worldPosition.z)
    this.setMoving(false, false)
    this.node.emit('player-action-requested', 'sword_ride')
  }

  update(deltaTime: number) {
    if (Number.isFinite(deltaTime) && deltaTime > 0) this.hoverElapsed += deltaTime
    this.animateSword()
    if (!this.movementState.target) return

    const current = this.node.worldPosition
    // Runtime applies bounded stepTowardTarget(...) substeps before returning one frame result.
    const frame = advancePlayerMovement(this.movementState, current, this.moveSpeed, deltaTime)
    if (frame.distanceMoved > 0) {
      this.node.setWorldPosition(frame.position.x, frame.position.y, current.z)
      this.setMoving(true, false)
    }
    if (frame.arrived) {
      this.setMoving(false)
    }
  }

  private animateSword() {
    if (!this.swordMount) return
    const yOffset = Math.sin(this.hoverElapsed * 4) * 2
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
