import { _decorator, Component, JsonAsset, Label } from 'cc'
import { dungeonRunPlanFromDesign, resolveDungeonFloor } from '../Core/CultivationRuntime'
import { DungeonProfile } from '../Core/CultivationTypes'

const { ccclass, property } = _decorator

@ccclass('DungeonRunController')
export class DungeonRunController extends Component {
  @property(JsonAsset)
  designData: JsonAsset | null = null

  @property(Label)
  floorLabel: Label | null = null

  dungeonId = 'star-gate-ruins'
  currentFloor = 1
  dungeon: DungeonProfile | null = null

  start() {
    this.enterDungeon(this.dungeonId)
  }

  enterDungeon(dungeonId: string) {
    if (!this.designData) return

    this.dungeonId = dungeonId
    this.currentFloor = 1
    this.dungeon = dungeonRunPlanFromDesign(this.designData.json as any, dungeonId)
    this.updateLabel()
  }

  evacuate() {
    if (!this.dungeon) return null
    return resolveDungeonFloor(this.dungeon, this.currentFloor, { extracted: true, bossKilled: false })
  }

  clearFloor(bossKilled: boolean) {
    if (!this.dungeon) return null

    const result = resolveDungeonFloor(this.dungeon, this.currentFloor, { extracted: false, bossKilled })
    if (result.status !== 'cleared') {
      this.currentFloor = Math.min(this.currentFloor + 1, this.dungeon.floors.length)
    }
    this.updateLabel()
    return result
  }

  private updateLabel() {
    if (this.floorLabel && this.dungeon) {
      this.floorLabel.string = `${this.dungeon.name} 第${this.currentFloor}层`
    }
  }
}
