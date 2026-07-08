import { _decorator, Component, JsonAsset, Label } from 'cc'
import { stageProfileFromDesign } from '../Core/CultivationRuntime'
import { StageProfile } from '../Core/CultivationTypes'

const { ccclass, property } = _decorator

@ccclass('StageDirector')
export class StageDirector extends Component {
  @property(JsonAsset)
  designData: JsonAsset | null = null

  @property(Label)
  stageLabel: Label | null = null

  stageNumber = 1
  currentStage: StageProfile | null = null

  start() {
    this.loadStage(this.stageNumber)
  }

  loadStage(stageNumber: number) {
    if (!this.designData) return

    this.stageNumber = Math.max(1, Math.floor(stageNumber))
    this.currentStage = stageProfileFromDesign(this.designData.json as any, this.stageNumber)

    if (this.stageLabel && this.currentStage) {
      this.stageLabel.string = `第${this.stageNumber}关 ${this.currentStage.name}`
    }
  }

  nextStageAfterBoss() {
    this.loadStage(this.stageNumber + 1)
  }
}
