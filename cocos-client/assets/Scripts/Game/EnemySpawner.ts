import { _decorator, Component, JsonAsset, Vec3 } from 'cc'
import { BattleRuntime, createBattleRuntime, nextSpawn } from '../Core/BattleRuntime'
import { CultivationDesignData, stageProfileFromDesign } from '../Core/CultivationRuntime'
import { EnemyController } from './EnemyController'
import { NodePoolController } from './NodePoolController'

const { ccclass, property } = _decorator

@ccclass('EnemySpawner')
export class EnemySpawner extends Component {
  @property(JsonAsset)
  designData: JsonAsset | null = null

  @property(NodePoolController)
  enemyPool: NodePoolController | null = null

  @property
  stageNumber = 1

  @property
  heroAttack = 40

  @property
  spawnX = 520

  @property
  groundY = -60

  private runtime: BattleRuntime | null = null

  start() {
    if (!this.designData) return
    const stage = stageProfileFromDesign(this.designData.json as CultivationDesignData, this.stageNumber)
    this.runtime = createBattleRuntime(stage, this.heroAttack)
  }

  update(deltaTime: number) {
    if (!this.enemyPool || !this.runtime) return
    const spawn = nextSpawn(this.runtime, deltaTime)
    if (!spawn.ok || !spawn.enemy) return

    const node = this.enemyPool.spawn()
    if (!node) return

    node.setPosition(new Vec3(this.spawnX, this.groundY, 0))
    const controller = node.getComponent(EnemyController)
    if (controller) controller.setTarget(new Vec3(-180, this.groundY, 0))
    node.emit('enemy-runtime-spawned', spawn.enemy.id, spawn.enemy.profile)
  }
}
