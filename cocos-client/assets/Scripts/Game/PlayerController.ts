import { _decorator, Component, Node, UITransform, Vec3 } from 'cc'
import type { BattleRect, Point2 } from '../Combat/CombatTypes.ts'
import type { PlayerActionToken, PlayerMotor } from '../Combat/PlayerMotor.ts'
import {
  completePlayerAction,
  createPlayerMotor,
  requestMove,
  requestMoveInCoordinateSpace,
  requestPlayerAction,
  resetPlayerMotor,
  setPlayerBounds,
  setPlayerFallbackAction,
  stepPlayerMotor,
  stopPlayerMotor,
} from '../Combat/PlayerMotor.ts'

const { ccclass, property } = _decorator

@ccclass('PlayerController')
export class PlayerController extends Component {
  @property(Node)
  public swordMount: Node | null = null

  @property
  public moveSpeed = 220

  private motor: PlayerMotor | null = null
  private moving = false
  private hoverElapsed = 0
  private swordMountBasePosition = new Vec3()

  onLoad() {
    const spawn = this.node.position
    this.motor = createPlayerMotor({ x: spawn.x, y: spawn.y }, this.moveSpeed)
    if (this.swordMount) this.swordMountBasePosition.set(this.swordMount.position)
  }

  start() {
    this.emitPresentationAction(true)
  }

  public configureMovement(spawn: Point2, speed: number, bounds: BattleRect) {
    const motor = createPlayerMotor(spawn, speed)
    setPlayerBounds(motor, bounds)
    this.moveSpeed = speed
    this.motor = motor
    this.syncNodePosition(motor.position)
    this.setMoving(false)
  }

  public requestMovement(target: Point2) {
    return this.motor ? requestMove(this.motor, target) : false
  }

  public requestMovementInCoordinateSpace(
    point: Point2,
    convert: (point: Readonly<Point2>) => Point2,
  ) {
    return this.motor ? requestMoveInCoordinateSpace(this.motor, point, convert) : false
  }

  public configureBounds(bounds: BattleRect) {
    if (!this.motor) {
      const position = this.node.position
      this.motor = createPlayerMotor({ x: position.x, y: position.y }, this.moveSpeed)
    }
    const before = this.motor.position
    setPlayerBounds(this.motor, bounds)
    const after = this.motor.position
    if (after.x !== before.x || after.y !== before.y) this.syncNodePosition(after)
  }

  public requestPresentationAction(action: string, owner: string): Readonly<PlayerActionToken> | null {
    if (!this.motor) return null
    const frame = requestPlayerAction(this.motor, action, owner)
    if (frame.changed) this.node.emit('player-animation-requested', frame.action)
    return frame.token
  }

  public completePresentationAction(token: PlayerActionToken) {
    if (!this.motor) return false
    const frame = completePlayerAction(this.motor, token)
    if (frame.changed) this.node.emit('player-animation-requested', frame.action)
    return frame.unlocked
  }

  public replayPresentationAction() {
    this.emitPresentationAction(true)
  }

  public moveTo(worldPosition: Vec3) {
    const parentTransform = this.node.parent?.getComponent(UITransform)
    const local = parentTransform?.convertToNodeSpaceAR(worldPosition) ?? worldPosition
    return this.requestMovement({ x: local.x, y: local.y })
  }

  public stop() {
    if (this.motor) stopPlayerMotor(this.motor)
    this.setMoving(false)
  }

  public reset() {
    if (!this.motor) return
    resetPlayerMotor(this.motor)
    this.hoverElapsed = 0
    this.syncNodePosition(this.motor.position)
    this.setMoving(false)
    this.emitPresentationAction(true)
  }

  update(deltaTime: number) {
    if (!this.motor) return
    const frame = stepPlayerMotor(this.motor, deltaTime)
    if (frame.distanceMoved > 0) {
      this.syncNodePosition(frame.position)
      this.setMoving(true)
    }
    if (frame.arrived) this.setMoving(false)
    this.animateSword(deltaTime)
  }

  private syncNodePosition(position: Readonly<Point2>) {
    this.node.setPosition(position.x, position.y, this.node.position.z)
  }

  private animateSword(deltaTime: number) {
    if (!this.swordMount) return
    if (Number.isFinite(deltaTime) && deltaTime > 0) this.hoverElapsed += Math.min(deltaTime, 0.25)
    this.swordMount.setPosition(
      this.swordMountBasePosition.x,
      this.swordMountBasePosition.y + Math.sin(this.hoverElapsed * 4) * 2,
      this.swordMountBasePosition.z,
    )
  }

  private setMoving(moving: boolean) {
    if (this.moving === moving) return
    this.moving = moving
    if (this.motor) {
      const frame = setPlayerFallbackAction(this.motor, moving ? 'move' : 'sword_ride')
      if (frame.changed) this.node.emit('player-animation-requested', frame.action)
    }
    this.node.emit('player-motion-changed', moving)
  }

  private emitPresentationAction(force = false) {
    if (!this.motor || !force) return
    this.node.emit('player-animation-requested', this.motor.presentationAction)
  }
}
