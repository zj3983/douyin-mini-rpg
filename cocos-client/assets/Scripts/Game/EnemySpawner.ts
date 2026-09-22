import { _decorator, Color, Component, Node, Sprite, UITransform, Vec3 } from 'cc'
import {
  BattleLayout,
  computeBattleLayout,
  computeBossVisualPlacement,
  computeOrdinaryEnemySpawn,
  ORDINARY_ENEMY_FRAME_HEIGHT,
  ORDINARY_ENEMY_FRAME_WIDTH,
} from '../Combat/BattleLayout'
import type { BattleRect } from '../Combat/CombatTypes'
import type { OrdinaryEnemyKind } from '../Combat/EnemyBrain'
import type { AnimationAtlasManifest } from '../Core/AnimationAtlas'
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
  groundY = -60

  @property
  flyingY = 70

  private ordinaryControllers = new Set<EnemyController>()
  private neighborSnapshot: readonly EnemyNeighborSnapshot[] = Object.freeze([])
  private neighborSnapshotScratch: EnemyNeighborSnapshot[] = []
  private neighborSnapshotDirty = true
  private battleLayout: BattleLayout = computeBattleLayout({
    designWidth: 750,
    cssWidth: 750,
    cssHeight: 1334,
    topInsetPx: 0,
    bottomInsetPx: 0,
  })
  private activeBoss: { node: Node; enemy: BattleEnemy } | null = null
  private defaultVisualSizes = new WeakMap<Node, {
    root: { width: number; height: number }
    visual: { width: number; height: number }
  }>()

  configureBattleLayout(layout: BattleLayout) {
    this.battleLayout = layout
    if (this.activeBoss) this.applyBossVisualPlacement(this.activeBoss.node, this.activeBoss.enemy)
  }

  spawnEnemy(enemy: BattleEnemy) {
    if (!this.enemyPool) return null
    const node = this.enemyPool.spawn(false)
    if (!node) return null

    const isBoss = enemy.profile.role === 'boss'
    const laneY = enemy.profile.role === 'flying' ? this.flyingY : this.groundY
    node.setPosition(Vec3.ZERO)
    node.setScale(Vec3.ONE)
    node.setRotationFromEuler(Vec3.ZERO)
    const rootSprite = node.getComponent(Sprite)
    if (rootSprite) rootSprite.color = Color.WHITE
    const visual = node.getComponent(EnemyVisualController)
    node.off('enemy-visual-frame-ready', this.onEnemyVisualFrameReady, this)
    node.on('enemy-visual-frame-ready', this.onEnemyVisualFrameReady, this)
    const visualSize = this.captureAndRestoreVisualSize(node, visual).root
    visual?.resetForSpawn(enemy.profile)
    const spawn = isBoss
      ? this.battleLayout.bossSpawn
      : computeOrdinaryEnemySpawn(this.battleLayout, visualSize, laneY)
    node.setPosition(new Vec3(spawn.x, spawn.y, 0))
    enemy.position = { x: spawn.x, y: spawn.y }
    if (isBoss) {
      this.activeBoss = { node, enemy }
      this.applyBossVisualPlacement(node, enemy)
    }
    const controller = node.getComponent(EnemyController)
    if (controller) {
      const kind = this.ordinaryKind(enemy)
      if (kind || isBoss) {
        if (kind) {
          this.ordinaryControllers.add(controller)
          this.neighborSnapshotDirty = true
        }
        controller.bindRuntimeEnemy(enemy, {
          kind: isBoss ? 'bamboo-warden' : kind as OrdinaryEnemyKind,
          seed: Math.imul(enemy.id, 2654435761) >>> 0,
          battleBounds: () => this.currentBattleBounds(),
          neighbors: () => this.livingNeighbors(),
        })
      } else controller.bindRuntimeEnemy(enemy)
      if (this.playerTarget) controller.setTargetNode(this.playerTarget, enemy.profile.role === 'ground')
      else controller.setTarget(new Vec3(-180, spawn.y, 0))
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

  lateUpdate() {
    this.rebuildNeighborSnapshot()
  }

  despawnEnemy(node: Node) {
    const visual = node.getComponent(EnemyVisualController)
    const controller = node.getComponent(EnemyController)
    if (controller) {
      this.ordinaryControllers.delete(controller)
      this.neighborSnapshotDirty = true
    }
    if (this.activeBoss?.node === node) this.activeBoss = null
    node.off('enemy-visual-frame-ready', this.onEnemyVisualFrameReady, this)
    visual?.prepareForPool()
    controller?.prepareForPool()
    this.enemyPool?.despawn(node)
  }

  private ordinaryKind(enemy: BattleEnemy): OrdinaryEnemyKind | null {
    if (
      enemy.profile.id === 'moss-wolf'
      || enemy.profile.id === 'fog-spider'
      || enemy.profile.id === 'mist-deer-king'
    ) return 'moss-wolf'
    if (enemy.profile.id === 'green-wing-moth' || enemy.profile.id === 'lantern-wraith') {
      return 'green-wing-moth'
    }
    return null
  }

  private livingNeighbors(): readonly EnemyNeighborSnapshot[] {
    if (this.neighborSnapshotDirty) this.rebuildNeighborSnapshot()
    return this.neighborSnapshot
  }

  private rebuildNeighborSnapshot() {
    const neighbors = this.neighborSnapshotScratch
    neighbors.length = 0
    for (const controller of this.ordinaryControllers) {
      const snapshot = controller.enemyNeighborSnapshot()
      if (snapshot?.alive) neighbors.push(snapshot)
    }
    const changed = this.neighborSnapshotDirty
      || neighbors.length !== this.neighborSnapshot.length
      || neighbors.some((snapshot, index) => snapshot !== this.neighborSnapshot[index])
    if (changed) this.neighborSnapshot = Object.freeze(neighbors.slice())
    this.neighborSnapshotDirty = false
  }

  private currentBattleBounds(): Readonly<BattleRect> {
    return this.battleLayout.actorSafeRect
  }

  private captureAndRestoreVisualSize(node: Node, visual: EnemyVisualController | null) {
    const rootTransform = node.getComponent(UITransform)
    const visualTransform = visual?.animator?.targetSprite?.node.getComponent(UITransform) ?? null
    let defaults = this.defaultVisualSizes.get(node)
    if (!defaults) {
      defaults = {
        root: {
          width: rootTransform?.contentSize.width ?? ORDINARY_ENEMY_FRAME_WIDTH,
          height: rootTransform?.contentSize.height ?? ORDINARY_ENEMY_FRAME_HEIGHT,
        },
        visual: {
          width: visualTransform?.contentSize.width ?? ORDINARY_ENEMY_FRAME_WIDTH,
          height: visualTransform?.contentSize.height ?? ORDINARY_ENEMY_FRAME_HEIGHT,
        },
      }
      this.defaultVisualSizes.set(node, defaults)
    }
    rootTransform?.setContentSize(defaults.root.width, defaults.root.height)
    visualTransform?.setContentSize(defaults.visual.width, defaults.visual.height)
    return defaults
  }

  private applyBossVisualPlacement(node: Node, enemy: BattleEnemy) {
    const visual = node.getComponent(EnemyVisualController)
    const sprite = visual?.animator?.targetSprite ?? null
    const visualTransform = sprite?.node.getComponent(UITransform) ?? null
    const fallback = this.defaultVisualSizes.get(node)?.visual ?? {
      width: ORDINARY_ENEMY_FRAME_WIDTH,
      height: ORDINARY_ENEMY_FRAME_HEIGHT,
    }
    const runtimeFrameSize = visual?.animator?.currentFrameSize()
    const manifest = visual?.animator?.animationManifest?.json as AnimationAtlasManifest | undefined
    const declaredFrame = manifest?.actors.find((actor) => actor.id === enemy.profile.id)?.frameSize
    const frameRect = sprite?.spriteFrame?.rect
    const frameSize = runtimeFrameSize
      ? runtimeFrameSize
      : declaredFrame && declaredFrame.w > 0 && declaredFrame.h > 0
      ? { width: declaredFrame.w, height: declaredFrame.h }
      : frameRect && frameRect.width > 0 && frameRect.height > 0
        ? { width: frameRect.width, height: frameRect.height }
        : fallback
    const placement = computeBossVisualPlacement(this.battleLayout, frameSize)
    node.setPosition(placement.position.x, placement.position.y, 0)
    node.getComponent(UITransform)?.setContentSize(placement.visualSize.width, placement.visualSize.height)
    visualTransform?.setContentSize(placement.visualSize.width, placement.visualSize.height)
    enemy.position = { x: placement.position.x, y: placement.position.y }
    node.getComponent(EnemyController)?.syncBossBattleSpace()
  }

  private onEnemyVisualFrameReady(node: Node) {
    const activeBoss = this.activeBoss
    if (activeBoss?.node === node) this.applyBossVisualPlacement(node, activeBoss.enemy)
  }
}
