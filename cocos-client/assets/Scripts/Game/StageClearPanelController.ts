import { _decorator, Button, Component, Label, Node } from 'cc'
import { StageClearResult } from '../Core/BattleRuntime'

const { ccclass, property } = _decorator

@ccclass('StageClearPanelController')
export class StageClearPanelController extends Component {
  @property(Node)
  panelRoot: Node | null = null

  @property(Label)
  titleLabel: Label | null = null

  @property(Label)
  rewardLabel: Label | null = null

  @property(Label)
  nextStageLabel: Label | null = null

  @property(Button)
  nextStageButton: Button | null = null

  nextStageTarget = 1

  private result: StageClearResult | null = null
  onContinue: ((nextStageId: number) => void) | null = null

  onLoad() {
    this.hide()
    this.nextStageButton?.node.on(Button.EventType.CLICK, this.handleContinue, this)
  }

  onDestroy() {
    this.nextStageButton?.node.off(Button.EventType.CLICK, this.handleContinue, this)
  }

  bindContinueButton(button: Button) {
    this.nextStageButton?.node.off(Button.EventType.CLICK, this.handleContinue, this)
    this.nextStageButton = button
    button.node.on(Button.EventType.CLICK, this.handleContinue, this)
  }

  showResult(result: StageClearResult) {
    this.result = result
    this.nextStageTarget = result.nextStageId
    const root = this.panelRoot ?? this.node
    root.active = true

    if (this.titleLabel) {
      this.titleLabel.string = result.title
    }
    if (this.rewardLabel) {
      this.rewardLabel.string = [
        `灵石 +${result.reward.spiritStones}`,
        `法宝精华 +${result.reward.artifactEssence}`,
        `副本卷 ${result.reward.dungeonPass.name} x1`,
      ].join('   ')
    }
    if (this.nextStageLabel) {
      this.nextStageLabel.string = `前往第${result.nextStageId}关`
    }
    if (this.nextStageButton) {
      this.nextStageButton.interactable = true
    }
  }

  hide() {
    const root = this.panelRoot ?? this.node
    root.active = false
  }

  takeResult() {
    return this.result
  }

  private handleContinue() {
    if (!this.result) return
    this.nextStageButton && (this.nextStageButton.interactable = false)
    this.onContinue?.(this.result.nextStageId)
  }
}
