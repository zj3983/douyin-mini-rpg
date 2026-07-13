import { _decorator, Component, Node, UITransform, Vec3 } from 'cc'
import type { BattleRect, Point2 } from '../Combat/CombatTypes.ts'
import type { PlayerActionLock, PlayerMotor } from '../Combat/PlayerMotor.ts'
import {
  createPlayerMotor,
  lockPlayerAction,
  requestMove,
  setPlayerBounds,
  stepPlayerMotor,
  unlockPlayerAction,
} from '../Combat/PlayerMotor.ts'

const { ccclass, property } = _decorator

@ccclass('PlayerController')
export class PlayerController extends Component {
  @property(Node)
  public swordMount: Node | null = null

  @property
  public moveSpeed = 220

  private motor: PlayerMotor | null = null
  private movementSpawn: Point2 = { x: 0, y: 0 }
  private movementEnabled = true
  private moving = false
  private hoverElapsed = 0
  private swordMountBasePosition = new Vec3()

  onLoad() {
    const spawn = this.node.position
    this.movementSpawn = { x: spawn.x, y: spawn.y }
    this.motor = createPlayerMotor(this.movementSpawn, this.moveSpeed)
    if (this.swordMount) this.swordMountBasePosition.set(this.swordMount.position)
  }

  start() {
    this.requestAction('sword_ride')
  }

  public configureMovement(spawn: Point2, speed: number, bounds: BattleRect) {
    const motor = createPlayerMotor(spawn, speed)
    setPlayerBounds(motor, bounds)
    this.movementSpawn = { x: spawn.x, y: spawn.y }
    this.moveSpeed = speed
    this.motor = motor
    this.movementEnabled = true
    this.setMoving(false)
  }

  public requestMovement(target: Point2) {
    if (!this.movementEnabled || !this.motor) return false
    return requestMove(this.motor, target)
  }

  public configureBounds(bounds: BattleRect) {
    if (!this.motor) {
      const position = this.node.position
      this.motor = createPlayerMotor({ x: position.x, y: position.y }, this.moveSpeed)
    }
    setPlayerBounds(this.motor, bounds)
  }

  public lockAction(action: PlayerActionLock) {
    if (this.motor) lockPlayerAction(this.motor, action)
  }

  public unlockAction(action: PlayerActionLock) {
    if (this.motor) unlockPlayerAction(this.motor, action)
  }

  public moveTo(worldPosition: Vec3) {
    const parentTransform = this.node.parent?.getComponent(UITransform)
    const local = parentTransform?.convertToNodeSpaceAR(worldPosition) ?? worldPosition
    return this.requestMovement({ x: local.x, y: local.y })
  }

  public stop() {
    if (this.motor) {
      const bounds = this.motor.bounds
      const stopped = createPlayerMotor(this.motor.position, this.motor.speed)
      if (bounds) setPlayerBounds(stopped, bounds)
      this.motor = stopped
    }
    this.movementEnabled = false
    this.setMoving(false)
  }

  public reset() {
    const speed = this.motor?.speed ?? this.moveSpeed
    const bounds = this.motor?.bounds ?? null
    const resetMotor = createPlayerMotor(this.movementSpawn, speed)
    if (bounds) setPlayerBounds(resetMotor, bounds)
    this.motor = resetMotor
    this.movementEnabled = true
    this.hoverElapsed = 0
    this.setMoving(false)
    this.requestAction('sword_ride')
  }

  update(deltaTime: number) {
    if (!this.motor) return
    const frame = stepPlayerMotor(this.motor, deltaTime)
    this.node.setPosition(frame.position.x, frame.position.y, this.node.position.z)
    this.animateSword(deltaTime)
    this.setMoving(frame.distanceMoved > 0)
    if (frame.arrived && this.motor.action === null) this.requestAction('sword_ride')
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
    this.node.emit('player-motion-changed', moving)
  }

  private requestAction(action: string) {
    this.node.emit('player-action-requested', action)
  }
}
