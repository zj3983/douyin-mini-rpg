import { _decorator, Component, Node, Vec3 } from 'cc'
import { BattleEnemy } from '../Core/BattleRuntime'

const { ccclass, property } = _decorator

@ccclass('EnemyController')
export class EnemyController extends Component {
  @property moveSpeed = 90
  @property attackRange = 70
  @property attackCooldown = 1.8

  private target: Vec3 | null = null
  private targetNode: Node | null = null
  private lockTargetY = false
  private cooldownLeft = 0
  private runtimeEnemy: BattleEnemy | null = null
  private moving = false

  bindRuntimeEnemy(enemy: BattleEnemy) {
    this.runtimeEnemy = enemy
    this.cooldownLeft = 0
    this.moving = false
    this.syncRuntimePosition()
  }

  setTarget(worldPosition: Vec3) {
    this.target = worldPosition.clone()
    this.targetNode = null
  }

  setTargetNode(targetNode: Node, lockY: boolean) {
    this.targetNode = targetNode
    this.lockTargetY = lockY
    this.target = targetNode.worldPosition.clone()
  }

  update(deltaTime: number) {
    if (!this.target || !this.runtimeEnemy?.alive) return
    this.cooldownLeft = Math.max(0, this.cooldownLeft - deltaTime)

    const current = this.node.worldPosition
    const liveTarget = this.targetNode?.worldPosition ?? this.target
    const desiredTarget = liveTarget.clone()
    if (this.lockTargetY) desiredTarget.y = current.y
    const moveDistance = Vec3.distance(current, desiredTarget)
    const attackDistance = Vec3.distance(current, liveTarget)

    if (moveDistance > this.attackRange) {
      const direction = desiredTarget.subtract(current).normalize()
      const step = Math.min(moveDistance, this.moveSpeed * Math.max(0, deltaTime))
      this.node.setWorldPosition(current.clone().add(direction.multiplyScalar(step)))
      if (!this.moving) this.node.emit('enemy-motion', 'move')
      this.moving = true
      this.syncRuntimePosition()
      return
    }

    if (attackDistance <= this.attackRange && this.cooldownLeft <= 0) {
      this.cooldownLeft = this.attackCooldown
      this.moving = false
      this.node.emit('enemy-motion', 'attack')
      this.node.emit('enemy-skill-cast', this.runtimeEnemy)
      this.node.emit('enemy-attack-player', this.runtimeEnemy.profile.role === 'boss' ? 10 : 3)
    }
    this.syncRuntimePosition()
  }

  private syncRuntimePosition() {
    if (!this.runtimeEnemy) return
    const local = this.node.position
    this.runtimeEnemy.position = { x: local.x, y: local.y }
  }
}
