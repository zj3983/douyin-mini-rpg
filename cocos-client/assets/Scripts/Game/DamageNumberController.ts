import { _decorator, Color, Component, Label, Vec3 } from 'cc'
import { PoolableActor } from './PoolableActor'

const { ccclass, property } = _decorator

@ccclass('DamageNumberController')
export class DamageNumberController extends Component {
  @property(Label)
  label: Label | null = null

  @property
  lifetime = 0.55

  @property
  riseDistance = 48

  private elapsed = 0
  private startPosition = new Vec3()
  private active = false

  show(damage: number) {
    this.elapsed = 0
    this.active = true
    const position = this.node.position
    this.startPosition.set(position.x, position.y, position.z)
    if (this.label) {
      this.label.string = `-${damage}`
      this.label.color = new Color(255, 232, 118, 255)
    }
  }

  update(deltaTime: number) {
    if (!this.active) return

    this.elapsed += deltaTime
    const progress = Math.min(1, this.elapsed / this.lifetime)
    this.node.setPosition(this.startPosition.x, this.startPosition.y + this.riseDistance * progress, this.startPosition.z)
    if (this.label) {
      this.label.color = new Color(255, 232, 118, Math.round(255 * (1 - progress)))
    }

    if (progress >= 1) {
      this.active = false
      const poolable = this.getComponent(PoolableActor)
      if (poolable) poolable.despawn()
      else this.node.active = false
    }
  }
}
