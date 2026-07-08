import { _decorator, Component, Vec3 } from 'cc'

const { ccclass, property } = _decorator

@ccclass('EnemyController')
export class EnemyController extends Component {
  @property
  moveSpeed = 90

  @property
  attackRange = 70

  @property
  attackCooldown = 1.8

  private target: Vec3 | null = null
  private cooldownLeft = 0

  setTarget(worldPosition: Vec3) {
    this.target = worldPosition.clone()
  }

  update(deltaTime: number) {
    if (!this.target) return

    this.cooldownLeft = Math.max(0, this.cooldownLeft - deltaTime)

    const current = this.node.worldPosition
    const distance = Vec3.distance(current, this.target)
    if (distance > this.attackRange) {
      const next = current.clone()
      const direction = this.target.clone().subtract(current).normalize()
      next.add(direction.multiplyScalar(this.moveSpeed * deltaTime))
      this.node.setWorldPosition(next)
      return
    }

    if (this.cooldownLeft <= 0) {
      this.cooldownLeft = this.attackCooldown
      this.node.emit('enemy-skill-cast')
    }
  }
}
