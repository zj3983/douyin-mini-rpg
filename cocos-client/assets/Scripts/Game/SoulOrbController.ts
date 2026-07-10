import { _decorator, Component, Node, Vec3 } from 'cc'
import { PoolableActor } from './PoolableActor'

const { ccclass, property } = _decorator

@ccclass('SoulOrbController')
export class SoulOrbController extends Component {
  @property
  pickupRadius = 44

  @property
  magnetRadius = 220

  @property
  magnetSpeed = 420

  private target: Node | null = null
  private amount = 1
  onPicked: ((amount: number) => void) | null = null

  follow(target: Node, amount = 1) {
    this.target = target
    this.amount = Math.max(1, Math.floor(amount))
  }

  update(deltaTime: number) {
    if (!this.target) return

    const current = this.node.worldPosition
    const targetPosition = this.target.worldPosition
    const distance = Vec3.distance(current, targetPosition)

    if (distance <= this.pickupRadius) {
      this.node.emit('soul-orb-picked', this.amount)
      this.onPicked?.(this.amount)
      this.onPicked = null
      const poolable = this.node.getComponent(PoolableActor)
      if (poolable) poolable.despawn()
      else this.node.active = false
      return
    }

    if (distance <= this.magnetRadius) {
      const next = current.clone()
      const direction = targetPosition.clone().subtract(current).normalize()
      next.add(direction.multiplyScalar(Math.min(distance, this.magnetSpeed * deltaTime)))
      this.node.setWorldPosition(next)
    }
  }
}
