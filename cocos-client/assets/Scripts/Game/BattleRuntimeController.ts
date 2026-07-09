import { _decorator, Component, JsonAsset, Label, Vec3 } from 'cc'
import {
  applyFlyingSwordHit,
  BattleRuntime,
  claimStageClear as claimStageClearRuntime,
  createBattleRuntime,
  nextSpawn,
  runtimeStats,
  spawnBoss,
  tickBossSkill as tickBossSkillRuntime,
} from '../Core/BattleRuntime'
import { CultivationDesignData, stageProfileFromDesign } from '../Core/CultivationRuntime'
import { DamageNumberController } from './DamageNumberController'
import { EnemySpawner } from './EnemySpawner'
import { NodePoolController } from './NodePoolController'
import { StageClearPanelController } from './StageClearPanelController'

const { ccclass, property } = _decorator

@ccclass('BattleRuntimeController')
export class BattleRuntimeController extends Component {
  @property(JsonAsset)
  designData: JsonAsset | null = null

  @property(NodePoolController)
  soulOrbPool: NodePoolController | null = null

  @property(NodePoolController)
  damageNumberPool: NodePoolController | null = null

  @property(NodePoolController)
  bossSkillEffectPool: NodePoolController | null = null

  @property(Label)
  statusLabel: Label | null = null

  @property(StageClearPanelController)
  stageClearPanel: StageClearPanelController | null = null

  @property(EnemySpawner)
  enemySpawner: EnemySpawner | null = null

  @property
  stageNumber = 1

  @property
  heroAttack = 40

  @property
  swordStartX = -180

  @property
  swordEndX = 300

  @property
  swordY = -30

  @property
  swordHitWidth = 18

  private runtime: BattleRuntime | null = null

  start() {
    this.rebuildRuntime(this.stageNumber)
  }

  advanceToStage(stageNumber: number) {
    this.rebuildRuntime(stageNumber)
    this.stageClearPanel?.hide()
    return { ok: Boolean(this.runtime), stageNumber: this.stageNumber }
  }

  advanceToNextStageFromPanel() {
    const result = this.stageClearPanel?.takeResult()
    if (!result) return { ok: false, stageNumber: this.stageNumber }
    return this.advanceToStage(result.nextStageId)
  }

  private rebuildRuntime(stageNumber: number) {
    if (!this.designData) return
    this.stageNumber = Math.max(1, Math.floor(stageNumber || 1))
    const stage = stageProfileFromDesign(this.designData.json as CultivationDesignData, this.stageNumber)
    this.runtime = createBattleRuntime(stage, this.heroAttack)
    this.refresh()
  }

  tickSpawn(deltaTime: number) {
    if (!this.runtime) return { ok: false, enemy: null }
    return nextSpawn(this.runtime, deltaTime)
  }

  update(deltaTime: number) {
    const spawn = this.tickSpawn(deltaTime)
    if (spawn.ok && spawn.enemy) {
      this.enemySpawner?.spawnEnemy(spawn.enemy)
      this.refresh()
    }
  }

  summonWorldBoss() {
    if (!this.runtime) return { ok: false, enemy: null }
    const result = spawnBoss(this.runtime)
    if (result.ok && result.enemy) {
      this.enemySpawner?.spawnEnemy(result.enemy)
    }
    this.refresh()
    return result
  }

  tickBossSkill(deltaTime: number) {
    if (!this.runtime) return { ok: false, event: null }
    const result = tickBossSkillRuntime(this.runtime, deltaTime)
    if (result.ok && result.event) {
      const effectNode = this.bossSkillEffectPool?.spawn()
      effectNode?.setPosition(new Vec3(result.event.position.x - 48, result.event.position.y + 24, 0))
    }
    return result
  }

  claimStageClear() {
    if (!this.runtime) return { ok: false, reason: 'not-cleared', result: null }
    const result = claimStageClearRuntime(this.runtime)
    if (result.ok && result.result) {
      this.stageClearPanel?.showResult(result.result)
    }
    this.refresh()
    return result
  }

  castFlyingSword() {
    if (!this.runtime) return { hitCount: 0, damageEvents: [], defeatedEnemyIds: [] }
    const result = applyFlyingSwordHit(this.runtime, 3, 1, {
      from: { x: this.swordStartX, y: this.swordY },
      to: { x: this.swordEndX, y: this.swordY },
      width: this.swordHitWidth,
    })
    for (const event of result.damageEvents) {
      const damageNode = this.damageNumberPool?.spawn()
      if (!damageNode) continue
      damageNode.setPosition(new Vec3(event.position.x, event.position.y + 54, 0))
      damageNode.getComponent(DamageNumberController)?.show(event.damage)
    }
    for (let index = 0; index < result.defeatedEnemyIds.length; index += 1) {
      this.soulOrbPool?.spawn()
    }
    this.refresh()
    return result
  }

  private refresh() {
    if (!this.statusLabel || !this.runtime) return
    const stats = runtimeStats(this.runtime)
    const bossText = stats.stageClearClaimed ? '已结算' : stats.stageCleared ? '已破关' : stats.bossAlive ? 'Boss' : '巡游'
    this.statusLabel.string = `敌 ${stats.aliveEnemies} | 魂球 ${stats.soulDrops} | ${bossText}`
  }
}
