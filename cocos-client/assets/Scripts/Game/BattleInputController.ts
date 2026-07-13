import { _decorator, Component, EventTouch, Node, UITransform, Vec3 } from 'cc'
import type { BattleRect } from '../Combat/CombatTypes.ts'
import { PlayerController } from './PlayerController'

const { ccclass, property } = _decorator

@ccclass('BattleInputController')
export class BattleInputController extends Component {
  @property(PlayerController)
  public player: PlayerController | null = null

  @property(UITransform)
  public inputArea: UITransform | null = null

  private bounds: Readonly<BattleRect> | null = null
  private coordinateSpace: UITransform | null = null
  private subscribedNode: Node | null = null
  private inputEnabled = false

  onEnable() {
    this.inputEnabled = true
    this.subscribeInputNode()
  }

  onDisable() {
    this.inputEnabled = false
    this.unsubscribeInputNode()
  }

  public configure(bounds: BattleRect, coordinateSpace: UITransform) {
    this.bounds = Object.freeze({ ...bounds })
    this.coordinateSpace = coordinateSpace
    if (this.inputEnabled) this.subscribeInputNode()
  }

  public bindInputArea(inputArea: UITransform | null) {
    this.unsubscribeInputNode()
    this.inputArea = inputArea
    if (this.inputEnabled) this.subscribeInputNode()
  }

  public setInputEnabled(enabled: boolean) {
    this.inputEnabled = enabled
    if (enabled) this.subscribeInputNode()
    else this.unsubscribeInputNode()
  }

  private subscribeInputNode() {
    const node = this.bounds && this.player && this.coordinateSpace ? this.inputArea?.node ?? null : null
    if (!node || this.subscribedNode === node) return
    this.unsubscribeInputNode()
    node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this)
    this.subscribedNode = node
  }

  private unsubscribeInputNode() {
    if (!this.subscribedNode) return
    this.subscribedNode.off(Node.EventType.TOUCH_END, this.onTouchEnd, this)
    this.subscribedNode = null
  }

  private onTouchEnd(event: EventTouch) {
    if (!this.inputEnabled) return false
    const { player, inputArea, bounds, coordinateSpace } = this
    if (!player || !inputArea || !bounds || !coordinateSpace) return false

    const location = event.getUILocation()
    return player.requestMovementInCoordinateSpace(location, (point) => {
      const converted = coordinateSpace.convertToNodeSpaceAR(new Vec3(point.x, point.y, 0))
      return { x: converted.x, y: converted.y }
    })
  }
}
