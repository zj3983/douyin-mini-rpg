import { _decorator, Component, JsonAsset, Node, Vec3 } from 'cc'
import {
  applyFlyingSwordPathHit,
  BattleEnemy,
  BattleRuntime,
  claimStageClear as claimStageClearRuntime,
  createBattleRuntime,
  nextSpawn,
  runtimeStats,
  spawnBoss,
  tickBossSkill as tickBossSkillRuntime,
} from '../Core/BattleRuntime'
import { CultivationDesignData, stageProfileFromDesign } from '../Core/CultivationRuntime'
import { BattleHudController } from './BattleHudController'
import { DamageNumberController } from './DamageNumberController'
import { EnemySpawner } from './EnemySpawner'
import { NodePoolController } from './NodePoolController'
import { SoulOrbController } from './SoulOrbController'
import { StageClearPanelController } from './StageClearPanelController'

const { ccclass, property } = _decorator

@ccclass('BattleRuntimeController')
export class BattleRuntimeController extends Component {
  @property(JsonAsset) designData: JsonAsset | null = null
  @property(NodePoolController) soulOrbPool: NodePoolController | null = null
  @property(NodePoolController) damageNumberPool: NodePoolController | null = null
  @property(NodePoolController) bossSkillEffectPool: NodePoolController | null = null
  @property(StageClearPanelController) stageClearPanel: StageClearPanelController | null = null
  @property(EnemySpawner) enemySpawner: EnemySpawner | null = null
  @property(BattleHudController) hud: BattleHudController | null = null
  @property(Node) playerNode: Node | null = null
  @property stageNumber = 1
  @property heroAttack = 44
  @property swordStartX = -210
  @property swordEndX = 330
  @property swordY = -30
  @property swordHitWidth = 20
  @property swordArcHeight = 104
  @property deathRecycleDelay = 0.45

  private runtime: BattleRuntime | null = null
  private enemyNodes = new Map<number, Node>()
  private enemyByNode = new Map<Node, BattleEnemy>()
  private pendingEnemyRecycles = 0
  private playerHealth = 160
  private readonly playerMaxHealth = 160
  private soulCollected = 0
  private initialized = false
  private battleFrozen = false

  start() {
    this.initialize()
  }

  initialize() {
    if (this.initialized || !this.designData) return false
    this.initialized = true
    this.rebuildRuntime(this.stageNumber)
    return true
  }

  advanceToStage(stageNumber: number) {
    this.recycleAllEnemies()
    this.rebuildRuntime(stageNumber)
    this.stageClearPanel?.hide()
    return { ok: Boolean(this.runtime), stageNumber: this.stageNumber }
  }

  advanceToNextStageFromPanel() {
    const result = this.stageClearPanel?.takeResult()
    if (!result) return { ok: false, stageNumber: this.stageNumber }
    return this.advanceToStage(result.nextStageId)
  }

  update(deltaTime: number) {
    if (!this.runtime || this.battleFrozen) return
    if (this.enemySpawner?.canSpawn() !== false) {
      const spawn = nextSpawn(this.runtime, deltaTime)
      if (spawn.ok && spawn.enemy) this.spawnRuntimeEnemy(spawn.enemy)
    }
    this.trySpawnBoss()
    this.tickBossSkill(deltaTime)
  }

  castFlyingSwordPass(from: Vec3, to: Vec3) {
    return this.resolveFlyingSwordHit(from, to, 6)
  }

  castFlyingSword() {
    return this.resolveFlyingSwordHit(
      new Vec3(this.swordStartX, this.swordY, 0),
      new Vec3(this.swordEndX, this.swordY, 0),
      3,
    )
  }

  isBattleFrozen() {
    return this.battleFrozen
  }

  private rebuildRuntime(stageNumber: number) {
    if (!this.designData) return
    this.stageNumber = Math.max(1, Math.floor(stageNumber || 1))
    const stage = stageProfileFromDesign(this.designData.json as CultivationDesignData, this.stageNumber)
    this.runtime = createBattleRuntime(stage, this.heroAttack)
    this.pendingEnemyRecycles = 0
    this.playerHealth = this.playerMaxHealth
    this.soulCollected = 0
    this.battleFrozen = false
    this.hud?.updateHero({ realm: '筑基三重', health: this.playerHealth, maxHealth: this.playerMaxHealth, mana: 12, maxMana: 12 })
    this.hud?.updateStage(stage.name, this.stageNumber)
    this.hud?.updateSoul(0, this.runtime.defeatTarget)
    this.hud?.hideBoss()
  }

  private spawnRuntimeEnemy(enemy: BattleEnemy) {
    const node = this.enemySpawner?.spawnEnemy(enemy)
    if (!node) return null
    this.enemyNodes.set(enemy.id, node)
    this.enemyByNode.set(node, enemy)
    node.off('enemy-attack-player', this.onEnemyAttack, this)
    node.on('enemy-attack-player', this.onEnemyAttack, this)
    node.off('enemy-boss-skill', this.onBossSkillVisual, this)
    node.on('enemy-boss-skill', this.onBossSkillVisual, this)
    if (enemy.profile.role === 'boss') this.updateBossHud(enemy)
    return node
  }

  private trySpawnBoss() {
    if (!this.runtime || this.battleFrozen || this.pendingEnemyRecycles > 0) return false
    const stats = runtimeStats(this.runtime)
    if (!stats.bossReady || stats.bossAlive || this.runtime.bossSpawned) return false
    const result = spawnBoss(this.runtime)
    if (!result.ok || !result.enemy) return false
    this.spawnRuntimeEnemy(result.enemy)
    return true
  }

  private tickBossSkill(deltaTime: number) {
    if (!this.runtime) return
    const result = tickBossSkillRuntime(this.runtime, deltaTime)
    if (!result.ok || !result.event) return
    const bossNode = this.enemyNodes.get(result.event.enemyId)
    bossNode?.emit('enemy-boss-skill', result.event)
    bossNode?.emit('enemy-skill-cast', result.event)
    this.applyPlayerDamage(result.event.damage)
    const effect = this.bossSkillEffectPool?.spawn()
    if (effect) {
      effect.setPosition(result.event.position.x - 55, result.event.position.y + 35, 0)
      this.scheduleOnce(() => this.bossSkillEffectPool?.despawn(effect), 0.55)
    }
  }

  private resolveFlyingSwordHit(from: Vec3, to: Vec3, pierce: number) {
    if (!this.runtime || this.battleFrozen) return { hitCount: 0, damageEvents: [], defeatedEnemyIds: [], stageClear: false }
    const points = this.buildArcPath(from, to, this.swordArcHeight)
    const result = applyFlyingSwordPathHit(this.runtime, pierce, 1, {
      points: points.map(({ x, y }) => ({ x, y })),
      width: this.swordHitWidth,
    })

    for (const event of result.damageEvents) {
      const enemyNode = this.enemyNodes.get(event.enemyId)
      enemyNode?.emit('enemy-hit', event)
      const enemy = this.enemyByNode.get(enemyNode as Node)
      if (enemy?.profile.role === 'boss') this.updateBossHud(enemy)
      const damageNode = this.damageNumberPool?.spawn()
      if (damageNode) {
        damageNode.setPosition(event.position.x, event.position.y + 72, 0)
        damageNode.getComponent(DamageNumberController)?.show(event.damage)
      }
    }

    for (const enemyId of result.defeatedEnemyIds) this.handleEnemyDefeat(enemyId)
    if (result.stageClear) this.finishStage()
    return result
  }

  private buildArcPath(from: Vec3, to: Vec3, arcHeight: number) {
    const points: Vec3[] = []
    const segments = 8
    for (let index = 0; index <= segments; index += 1) {
      const progress = index / segments
      points.push(new Vec3(
        from.x + (to.x - from.x) * progress,
        from.y + (to.y - from.y) * progress + Math.sin(progress * Math.PI) * arcHeight,
        0,
      ))
    }
    return points
  }

  private handleEnemyDefeat(enemyId: number) {
    const enemyNode = this.enemyNodes.get(enemyId)
    const enemy = enemyNode ? this.enemyByNode.get(enemyNode) : null
    if (!enemyNode || !enemy) return
    enemyNode.emit('enemy-defeated', enemyId)
    this.spawnSoulOrb(enemyNode.position.clone(), enemy.profile.role === 'boss' ? 5 : 1)
    this.pendingEnemyRecycles += enemy.profile.role === 'boss' ? 0 : 1
    this.scheduleOnce(() => {
      if (this.enemyNodes.get(enemyId) !== enemyNode) return
      this.enemySpawner?.despawnEnemy(enemyNode)
      this.enemyNodes.delete(enemyId)
      this.enemyByNode.delete(enemyNode)
      if (enemy.profile.role !== 'boss') this.pendingEnemyRecycles = Math.max(0, this.pendingEnemyRecycles - 1)
      this.trySpawnBoss()
    }, this.deathRecycleDelay)
  }

  private spawnSoulOrb(position: Vec3, amount: number) {
    const orb = this.soulOrbPool?.spawn()
    if (!orb || !this.playerNode) return
    orb.setPosition(position)
    const controller = orb.getComponent(SoulOrbController)
    if (!controller) return
    controller.follow(this.playerNode, amount)
    controller.onPicked = (picked) => this.collectSoul(picked)
  }

  private collectSoul(amount: number) {
    this.soulCollected += amount
    this.hud?.updateSoul(this.soulCollected, this.runtime?.defeatTarget ?? 12)
    this.node.emit('soul-orb-picked', amount)
  }

  private onEnemyAttack(damage: number) {
    if (this.battleFrozen) return
    this.applyPlayerDamage(damage)
  }

  private onBossSkillVisual() {
    this.node.emit('boss-skill-impact')
  }

  private applyPlayerDamage(damage: number) {
    this.playerHealth = Math.max(1, this.playerHealth - Math.max(0, damage))
    this.hud?.updateHero({ realm: '筑基三重', health: this.playerHealth, maxHealth: this.playerMaxHealth, mana: 12, maxMana: 12 })
    this.playerNode?.emit('player-hit', damage)
  }

  private updateBossHud(enemy: BattleEnemy) {
    this.hud?.showBoss(enemy.profile.name, Math.max(0, enemy.hp), 520)
  }

  private finishStage() {
    this.battleFrozen = true
    this.hud?.hideBoss()
    const result = this.runtime ? claimStageClearRuntime(this.runtime) : null
    if (result?.ok && result.result) this.stageClearPanel?.showResult(result.result)
  }

  private recycleAllEnemies() {
    for (const node of this.enemyNodes.values()) this.enemySpawner?.despawnEnemy(node)
    this.enemyNodes.clear()
    this.enemyByNode.clear()
  }
}
