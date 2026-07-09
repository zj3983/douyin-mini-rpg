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

  @property
  bossSpawnX = 610

  @property
  bossY = -38

  @property
  bossScale = 1.45

  spawnEnemy(enemy: BattleEnemy) {
    if (!this.enemyPool) return null
    const node = this.enemyPool.spawn()
    if (!node) return null

    const isBoss = enemy.profile.role === 'boss'
    const spawnX = isBoss ? this.bossSpawnX : this.spawnX
    const spawnY = isBoss ? this.bossY : enemy.profile.role === 'flying' ? this.flyingY : this.groundY
    node.setPosition(new Vec3(spawnX, spawnY, 0))
    node.setScale(new Vec3(isBoss ? this.bossScale : 1, isBoss ? this.bossScale : 1, 1))
    enemy.position = { x: spawnX, y: spawnY }
    const controller = node.getComponent(EnemyController)
    if (controller) controller.setTarget(new Vec3(-180, spawnY, 0))
    node.emit('enemy-runtime-spawned', enemy.id, enemy.profile)
    return node
  }
}
