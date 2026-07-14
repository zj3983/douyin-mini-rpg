import { _decorator, Color, Component, Node, Sprite, UITransform, Vec3 } from 'cc'
import type { BattleRect } from '../Combat/CombatTypes'
import type { OrdinaryEnemyKind } from '../Combat/EnemyBrain'
import { BattleEnemy } from '../Core/BattleRuntime'
import { EnemyController } from './EnemyController'
import type { EnemyNeighborSnapshot } from './EnemyController'
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

  private ordinaryControllers = new Set<EnemyController>()

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
      const kind = this.ordinaryKind(enemy)
      if (kind) {
        this.ordinaryControllers.add(controller)
        controller.bindRuntimeEnemy(enemy, {
          kind,
          seed: Math.imul(enemy.id, 2654435761) >>> 0,
          battleBounds: () => this.currentBattleBounds(),
          neighbors: () => this.livingNeighbors(enemy.id),
        })
      } else controller.bindRuntimeEnemy(enemy)
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
    if (controller) this.ordinaryControllers.delete(controller)
    visual?.prepareForPool()
    controller?.prepareForPool()
    this.enemyPool?.despawn(node)
  }

  private ordinaryKind(enemy: BattleEnemy): OrdinaryEnemyKind | null {
    if (enemy.profile.id === 'moss-wolf') return 'moss-wolf'
    if (enemy.profile.id === 'green-wing-moth') return 'green-wing-moth'
    return null
  }

  private livingNeighbors(excludedId: number): readonly EnemyNeighborSnapshot[] {
    const neighbors: EnemyNeighborSnapshot[] = []
    for (const controller of this.ordinaryControllers) {
      const snapshot = controller.enemyNeighborSnapshot()
      if (snapshot && snapshot.id !== excludedId && snapshot.alive) neighbors.push(snapshot)
    }
    neighbors.sort((left, right) => left.id - right.id)
    return Object.freeze(neighbors)
  }

  private currentBattleBounds(): Readonly<BattleRect> {
    const coordinateSpace = this.node.parent?.getComponent(UITransform)
    const halfWidth = Math.max(375, (coordinateSpace?.contentSize.width ?? 750) / 2)
    const halfHeight = Math.max(667, (coordinateSpace?.contentSize.height ?? 1334) / 2)
    return Object.freeze({
      minX: -halfWidth,
      maxX: Math.max(halfWidth, this.spawnX),
      minY: Math.min(-halfHeight, this.groundY),
      maxY: Math.max(halfHeight, this.flyingY),
    })
  }
}
