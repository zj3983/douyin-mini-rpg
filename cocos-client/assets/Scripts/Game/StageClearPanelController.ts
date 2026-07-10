import { _decorator, Button, Component, Label, Node } from 'cc'
import { StageClearResult } from '../Core/BattleRuntime'

const { ccclass, property } = _decorator

type ResultPanelMode = 'hidden' | 'clear' | 'defeat'

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
  private mode: ResultPanelMode = 'hidden'
  onContinue: ((nextStageId: number) => void) | null = null
  onRetry: (() => void) | null = null

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
    this.mode = 'clear'
    this.nextStageTarget = result.nextStageId
    const root = this.panelRoot ?? this.node
    root.active = true

    if (this.titleLabel) this.titleLabel.string = result.title
    if (this.rewardLabel) {
      this.rewardLabel.string = [
        `灵石 +${result.reward.spiritStones}`,
        `法宝精华 +${result.reward.artifactEssence}`,
        `${result.reward.dungeonPass.name} x1`,
      ].join('   ')
    }
    if (this.nextStageLabel) this.nextStageLabel.string = `前往第${result.nextStageId}关`
    if (this.nextStageButton) this.nextStageButton.interactable = true
  }

  showDefeat(stageNumber: number) {
    this.result = null
    this.mode = 'defeat'
    this.nextStageTarget = stageNumber
    const root = this.panelRoot ?? this.node
    root.active = true
    if (this.titleLabel) this.titleLabel.string = '试炼失败'
    if (this.rewardLabel) this.rewardLabel.string = '道心未损，调息后可再入此境'
    if (this.nextStageLabel) this.nextStageLabel.string = '重新挑战'
    if (this.nextStageButton) this.nextStageButton.interactable = true
  }

  hide() {
    this.result = null
    this.mode = 'hidden'
    const root = this.panelRoot ?? this.node
    root.active = false
  }

  takeResult() {
    return this.result
  }

  private handleContinue() {
    if (this.mode === 'defeat') {
      if (this.nextStageButton) this.nextStageButton.interactable = false
      this.onRetry?.()
      return
    }
    if (this.mode !== 'clear' || !this.result) return
    if (this.nextStageButton) this.nextStageButton.interactable = false
    this.onContinue?.(this.result.nextStageId)
  }
}
