import { _decorator, Color, Component, Graphics, Sprite, SpriteFrame, UITransform } from 'cc'

const { ccclass, property } = _decorator

@ccclass('BossHazardVisualController')
export class BossHazardVisualController extends Component {
  @property(Graphics)
  graphics: Graphics | null = null

  @property(Sprite)
  talisman: Sprite | null = null

  resetVisual() {
    this.graphics?.clear()
    if (!this.talisman) return

    this.talisman.spriteFrame = null
    this.talisman.color = new Color(255, 255, 255, 0)
    this.talisman.node.setScale(1, 1, 1)
    this.talisman.node.setRotationFromEuler(0, 0, 0)
  }

  setTalisman(frame: SpriteFrame | null, color: Color, width: number, height: number) {
    if (!this.talisman) return

    this.talisman.spriteFrame = frame
    this.talisman.color = color
    this.talisman.node.getComponent(UITransform)?.setContentSize(
      Math.min(width, 112),
      Math.min(height, 112),
    )
  }
}
