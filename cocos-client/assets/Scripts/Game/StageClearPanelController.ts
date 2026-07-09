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

  private result: StageClearResult | null = null

  onLoad() {
    this.hide()
  }

  showResult(result: StageClearResult) {
    this.result = result
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
      ].join('\n')
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
}
