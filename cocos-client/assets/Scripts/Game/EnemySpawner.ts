import { _decorator, Color, Component, Node, Sprite, Vec3 } from 'cc'
import { BattleEnemy } from '../Core/BattleRuntime'
import { EnemyController } from './EnemyController'
import { NodePoolController } from './NodePoolController'
import { EnemyVisualController } from './EnemyVisualController'

const { ccclass, property } = _decorator

@ccclass('EnemySpawner')
export class EnemySpawner extends Component {
  @property(NodePoolController)
  enemyPool: NodePoolController | null = null

  @property(Node)
  playerTarget: Node | null = null

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
    const node = this.enemyPool.spawn(false)
    if (!node) return null

    const isBoss = enemy.profile.role === 'boss'
    const spawnX = isBoss ? this.bossSpawnX : this.spawnX
    const spawnY = isBoss ? this.bossY : enemy.profile.role === 'flying' ? this.flyingY : this.groundY
    node.setPosition(Vec3.ZERO)
    node.setScale(Vec3.ONE)
    node.setRotationFromEuler(Vec3.ZERO)
    const rootSprite = node.getComponent(Sprite)
    if (rootSprite) rootSprite.color = Color.WHITE
    const visual = node.getComponent(EnemyVisualController)
    visual?.resetForSpawn(enemy.profile)
    node.setPosition(new Vec3(spawnX, spawnY, 0))
    const scale = isBoss ? this.bossScale : 1
    node.setScale(new Vec3(scale, scale, 1))
    enemy.position = { x: spawnX, y: spawnY }
    const controller = node.getComponent(EnemyController)
    if (controller) {
      controller.bindRuntimeEnemy(enemy)
      if (this.playerTarget) controller.setTargetNode(this.playerTarget, enemy.profile.role === 'ground')
      else controller.setTarget(new Vec3(-180, spawnY, 0))
    }
    this.enemyPool.activateNode(node)
    node.emit('enemy-motion', 'move')
    node.emit('enemy-runtime-spawned', enemy.id, enemy.profile)
    return node
  }

  bindEnemy(enemy: BattleEnemy) {
    return this.spawnEnemy(enemy)
  }

  canSpawn() {
    return this.enemyPool?.hasAvailableSlot() ?? false
  }

  despawnEnemy(node: Node) {
    const visual = node.getComponent(EnemyVisualController)
    const controller = node.getComponent(EnemyController)
    visual?.prepareForPool()
    controller?.prepareForPool()
    this.enemyPool?.despawn(node)
  }
}
