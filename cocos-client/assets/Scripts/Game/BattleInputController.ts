import { _decorator, Component, EventTouch, Node, UITransform, Vec3 } from 'cc'
import { clampBattleTarget } from '../Core/MovementRuntime'
import { PlayerController } from './PlayerController'

const { ccclass, property } = _decorator

@ccclass('BattleInputController')
export class BattleInputController extends Component {
  @property(PlayerController)
  public player: PlayerController | null = null

  @property(UITransform)
  public inputArea: UITransform | null = null

  @property
  public minX = -300

  @property
  public maxX = 50

  @property
  public minY = -430

  @property
  public maxY = 410

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

  public bindInputArea(inputArea: UITransform | null) {
    this.unsubscribeInputNode()
    this.inputArea = inputArea
    if (this.inputEnabled) this.subscribeInputNode()
  }

  private subscribeInputNode() {
    const node = this.inputArea?.node ?? null
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
    const { player, inputArea } = this
    if (!player || !inputArea) return

    const location = event.getUILocation()
    const local = inputArea.convertToNodeSpaceAR(new Vec3(location.x, location.y, 0))
    const clamped = clampBattleTarget(local, {
      minX: this.minX,
      maxX: this.maxX,
      minY: this.minY,
      maxY: this.maxY,
    })
    const worldTarget = inputArea.convertToWorldSpaceAR(new Vec3(clamped.x, clamped.y, 0))
    player.moveTo(worldTarget)
  }
}
