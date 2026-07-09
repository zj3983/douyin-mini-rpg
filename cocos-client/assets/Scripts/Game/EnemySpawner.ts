import { _decorator, Component, Vec3 } from 'cc'
import { BattleEnemy } from '../Core/BattleRuntime'
import { EnemyController } from './EnemyController'
import { NodePoolController } from './NodePoolController'

const { ccclass, property } = _decorator

@ccclass('EnemySpawner')
export class EnemySpawner extends Component {
  @property(NodePoolController)
  enemyPool: NodePoolController | null = null

  @property
  spawnX = 520

  @property
  groundY = -60

  @property
  flyingY = 70

  spawnEnemy(enemy: BattleEnemy) {
    if (!this.enemyPool) return null
    const node = this.enemyPool.spawn()
    if (!node) return null

    const spawnY = enemy.profile.role === 'flying' ? this.flyingY : this.groundY
    node.setPosition(new Vec3(this.spawnX, spawnY, 0))
    enemy.position = { x: this.spawnX, y: spawnY }
    const controller = node.getComponent(EnemyController)
    if (controller) controller.setTarget(new Vec3(-180, spawnY, 0))
    node.emit('enemy-runtime-spawned', enemy.id, enemy.profile)
    return node
  }
}
