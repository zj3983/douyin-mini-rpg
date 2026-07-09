import { _decorator, Component, JsonAsset, Label } from 'cc'
import { applyFlyingSwordHit, BattleRuntime, createBattleRuntime, nextSpawn, runtimeStats } from '../Core/BattleRuntime'
import { CultivationDesignData, stageProfileFromDesign } from '../Core/CultivationRuntime'
import { NodePoolController } from './NodePoolController'

const { ccclass, property } = _decorator

@ccclass('BattleRuntimeController')
export class BattleRuntimeController extends Component {
  @property(JsonAsset)
  designData: JsonAsset | null = null

  @property(NodePoolController)
  soulOrbPool: NodePoolController | null = null

  @property(Label)
  statusLabel: Label | null = null

  @property
  stageNumber = 1

  @property
  heroAttack = 40

  private runtime: BattleRuntime | null = null

  start() {
    if (!this.designData) return
    const stage = stageProfileFromDesign(this.designData.json as CultivationDesignData, this.stageNumber)
    this.runtime = createBattleRuntime(stage, this.heroAttack)
    this.refresh()
  }

  tickSpawn(deltaTime: number) {
    if (!this.runtime) return { ok: false, enemy: null }
    return nextSpawn(this.runtime, deltaTime)
  }

  castFlyingSword() {
    if (!this.runtime) return { hitCount: 0 }
    const result = applyFlyingSwordHit(this.runtime, 3, 1)
    for (let index = 0; index < result.hitCount; index += 1) {
      this.soulOrbPool?.spawn()
    }
    this.refresh()
    return result
  }

  private refresh() {
    if (!this.statusLabel || !this.runtime) return
    const stats = runtimeStats(this.runtime)
    this.statusLabel.string = `敌 ${stats.aliveEnemies} | 魂球 ${stats.soulDrops}`
  }
}
