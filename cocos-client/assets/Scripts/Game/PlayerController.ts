import { _decorator, Component, Node, Vec3 } from 'cc'
import {
  advancePlayerControllerFrame,
  applyPlayerActionEvent,
  createPlayerMovementState,
  createPlayerPresentationState,
  PlayerMovementState,
  PlayerPresentationState,
  requestPlayerMovement,
  resetPlayerMovement,
  resetPlayerPresentationState,
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
  private presentationState: PlayerPresentationState = createPlayerPresentationState()
  private swordMountBasePosition = new Vec3()

  onLoad() {
    const spawnPosition = this.node.worldPosition
    this.movementState = createPlayerMovementState({ x: spawnPosition.x, y: spawnPosition.y })
    if (this.swordMount) {
      this.swordMountBasePosition.set(this.swordMount.position)
      this.presentationState = createPlayerPresentationState(this.swordMountBasePosition.y)
    }
  }

  start() {
    this.requestAction('sword_ride')
  }

  public moveTo(worldPosition: Vec3) {
    if (!requestPlayerMovement(this.movementState, worldPosition)) return false
    return true
  }

  public stop() {
    stopPlayerMovement(this.movementState)
    this.setMoving(false)
  }

  public reset() {
    const spawnPosition = resetPlayerMovement(this.movementState)
    resetPlayerPresentationState(this.presentationState)
    this.node.setWorldPosition(spawnPosition.x, spawnPosition.y, this.node.worldPosition.z)
    this.setMoving(false)
    this.requestAction('sword_ride')
  }

  update(deltaTime: number) {
    const current = this.node.worldPosition
    // Presentation helper validates deltaTime before hoverElapsed += deltaTime.
    // Runtime applies bounded stepTowardTarget(...) substeps before returning one frame result.
    const frame = advancePlayerControllerFrame(
      this.movementState,
      this.presentationState,
      current,
      this.moveSpeed,
      deltaTime,
    )
    this.animateSword(frame.hoverY)
    if (frame.emitMove) {
      this.node.setWorldPosition(frame.position.x, frame.position.y, current.z)
    }
    for (const moving of frame.motionChanges) this.node.emit('player-motion-changed', moving)
    if (frame.action) this.requestAction(frame.action, frame.position)
  }

  private animateSword(hoverY: number) {
    if (!this.swordMount) return
    this.swordMount.setPosition(
      this.swordMountBasePosition.x,
      hoverY,
      this.swordMountBasePosition.z,
    )
  }

  private setMoving(moving: boolean) {
    if (this.presentationState.moving === moving) return
    this.presentationState.moving = moving
    this.node.emit('player-motion-changed', moving)
  }

  private requestAction(action: string, position = this.node.worldPosition) {
    const decision = applyPlayerActionEvent(this.movementState, this.presentationState, position, action)
    // Arrival resolves to emit('player-action-requested', 'sword_ride') through the runtime decision.
    if (decision.emitAction) this.node.emit('player-action-requested', decision.action)
  }
}
