import { _decorator, Component, JsonAsset, Node, Vec3 } from 'cc'
import {
  applyDirectDamage,
  applyFlyingSwordPathHit,
  advanceBossDefeatFlow,
  advanceOrdinaryDefeatFlow,
  BattleEnemy,
  BattleRuntime,
  beginBattleAttempt,
  canProcessBattleAction,
  claimStageClear as claimStageClearRuntime,
  completeBossSettlement,
  createBattleFreezeState,
  createBattleAttemptState,
  createBattleRuntime,
  createContactDamageGate,
  createStageSettlementState,
  freezeBattle,
  isBattleAttemptCallbackCurrent,
  markBattleAttemptCleared,
  markBattleAttemptDefeated,
  nextSpawn,
  rollbackSpawnedEnemy,
  retryBossSpawnFlow,
  rebuildBattleFreeze,
  scheduleBossSettlement,
  segmentHitEnemiesAlongPath,
  spawnBoss,
} from '../Core/BattleRuntime'
import {
  createStageFlow,
  markPlayerDefeated,
  StageFlowState,
} from '../Core/StageFlowRuntime'
import { CultivationDesignData, stageProfileFromDesign } from '../Core/CultivationRuntime'
import type { EnemyProfile, StageProfile } from '../Core/CultivationTypes.ts'
import type {
  DungeonBattleRequest,
  DungeonBattleResult,
} from '../Core/Dungeon/DungeonEncounterDirector.ts'
import {
  HomingSwordSegment,
  HomingSwordPhase,
  HomingSwordState,
  recordGeometricSwordHits,
  snapshotLivingSwordTargets,
} from '../Core/HomingSwordRuntime'
import { stageVisualFor } from '../Core/StageVisualCatalog'
import type { EnemyCommand } from '../Combat/EnemyBrain'
import { feedbackFor } from '../Combat/FeedbackTimeline.ts'
import type { FeedbackRequest } from '../Combat/FeedbackTimeline.ts'
import { createPerformanceBudget, updateVfxQuality } from '../Combat/PerformanceBudget.ts'
import type { PerformanceBudget, VfxQuality } from '../Combat/PerformanceBudget.ts'
import type { PlayerActionToken } from '../Combat/PlayerMotor.ts'
import { BattleHudController } from './BattleHudController'
import { BattleInputController } from './BattleInputController'
import { BossTelegraphPresenter } from './BossTelegraphPresenter'
import { DamageNumberController } from './DamageNumberController'
import { EnemyController } from './EnemyController'
import { EnemySpawner } from './EnemySpawner'
import {
  cancelEnemyCombatActorAttacks,
  consumeEnemyCombatCommand,
  createEnemyCombatResolverAdapter,
  drainEnemyCombatDamage,
  drainEnemyTelegraphs,
  pauseEnemyCombatResolverAdapter,
  removeEnemyCombatActor,
  resetEnemyCombatResolverAdapter,
  stepEnemyCombatResolverAdapter,
  upsertEnemyCombatActor,
  upsertPlayerCombatActor,
} from './EnemyCombatResolverAdapter'
import { NodePoolController } from './NodePoolController'
import { PlayerController } from './PlayerController'
import { SoulOrbController } from './SoulOrbController'
import { StageClearPanelController } from './StageClearPanelController'
import { createWorldRewardSessionId, worldRewardId } from '../Core/World/WorldRewardId.ts'

const { ccclass, property } = _decorator

@ccclass('BattleRuntimeController')
export class BattleRuntimeController extends Component {
  private readonly rewardSessionId = createWorldRewardSessionId()
  @property(JsonAsset) designData: JsonAsset | null = null
  @property(NodePoolController) soulOrbPool: NodePoolController | null = null
  @property(NodePoolController) damageNumberPool: NodePoolController | null = null
  @property(NodePoolController) bossSkillEffectPool: NodePoolController | null = null
  @property(BossTelegraphPresenter) bossTelegraphPresenter: BossTelegraphPresenter | null = null
  @property(StageClearPanelController) stageClearPanel: StageClearPanelController | null = null
  @property(EnemySpawner) enemySpawner: EnemySpawner | null = null
  @property(BattleHudController) hud: BattleHudController | null = null
  @property(Node) playerNode: Node | null = null
  @property(BattleInputController) battleInput: BattleInputController | null = null
  @property stageNumber = 1
  @property heroAttack = 44
  @property swordHitWidth = 72
  @property deathRecycleDelay = 0.45
  @property playerMaxHealth = 220
  @property bossDeathSettleDelay = 0.55
  @property playerDefeatPanelDelay = 0.35
  @property playerHurtDuration = 0.18

  canAdvanceToStage: ((stageId: number) => boolean) | null = null
  onDungeonEncounterCompleted: ((result: DungeonBattleResult) => void) | null = null

  private runtime: BattleRuntime | null = null
  private enemyNodes = new Map<number, Node>()
  private enemyByNode = new Map<Node, BattleEnemy>()
  private damageGate = createContactDamageGate({ maxHealth: 220, cooldown: 0 })
  private enemyCombatResolver = createEnemyCombatResolverAdapter(1)
  private soulCollected = 0
  private initialized = false
  private battleFreeze = createBattleFreezeState()
  private stageGeneration = 0
  private stageSettlement = createStageSettlementState(0)
  private attemptState = createBattleAttemptState(0, 1)
  private stageFlow: StageFlowState = createStageFlow(12, 0)
  private playerHurtToken: Readonly<PlayerActionToken> | null = null
  private vfxBudget: PerformanceBudget = createPerformanceBudget()
  private currentVfxQuality: VfxQuality = 'full'
  private activeDungeonRequest: DungeonBattleRequest | null = null
  private dungeonDefeatedEnemyIds: number[] = []
  private dungeonCompletionPending = false
  private lastDungeonBattleResult: DungeonBattleResult | null = null

  start() {
    this.initialize()
  }

  initialize() {
    if (this.initialized || !this.designData) return false
    const stage = this.resolveStageProfile(this.stageNumber)
    if (!stage) return false
    this.initialized = true
    this.rebuildRuntime(stage)
    return true
  }

  advanceToStage(stageNumber: number) {
    const stage = this.resolveStageProfile(stageNumber)
    if (!stage) return { ok: false, stageNumber: this.stageNumber, reason: 'unknown-stage' as const }
    if (this.canAdvanceToStage && !this.canAdvanceToStage(stage.id)) {
      return { ok: false, stageNumber: this.stageNumber, reason: 'locked-stage' as const }
    }
    this.recycleAllEnemies()
    this.rebuildRuntime(stage)
    return { ok: Boolean(this.runtime), stageNumber: this.stageNumber }
  }

  retryCurrentStage() {
    return this.advanceToStage(this.attemptState.stageNumber)
  }

  advanceToNextStageFromPanel() {
    const result = this.stageClearPanel?.takeResult()
    if (!result) return { ok: false, stageNumber: this.stageNumber }
    if (result.action.kind === 'region-complete') {
      return { ok: false, stageNumber: this.stageNumber, reason: 'region-complete' as const }
    }
    return this.advanceToStage(result.action.stageId)
  }

  beginDungeonEncounter(request: DungeonBattleRequest): boolean {
    const accepted = this.cloneValidDungeonRequest(request)
    if (!accepted) return false

    this.clearBattleGeneration()
    this.activeDungeonRequest = accepted
    this.dungeonDefeatedEnemyIds = []
    this.dungeonCompletionPending = false
    this.lastDungeonBattleResult = null

    const stage = this.stageForDungeonRequest(accepted)
    this.runtime = createBattleRuntime(stage, this.heroAttack, {
      defeatTarget: accepted.defeatTarget,
      maxAlive: accepted.maxAlive,
    })
    this.stageFlow = createStageFlow(this.runtime.defeatTarget, this.stageGeneration)
    this.stageSettlement = createStageSettlementState(this.stageGeneration)
    this.damageGate = createContactDamageGate({ maxHealth: this.playerMaxHealth, cooldown: 0 })
    this.soulCollected = 0
    rebuildBattleFreeze(this.battleFreeze)
    this.setEnemyControllersPaused(false)
    this.playerNode?.getComponent(PlayerController)?.reset()
    this.battleInput?.setInputEnabled(true)
    this.stageClearPanel?.hide()
    this.refreshHeroHealth()
    this.hud?.updateStage(stage.name, this.stageNumber)
    this.hud?.updateSoul(0, this.runtime.defeatTarget)
    this.hud?.hideBoss()

    if (accepted.boss && !this.spawnDungeonBoss(accepted.boss)) {
      this.clearBattleGeneration()
      return false
    }
    return true
  }

  cancelDungeonEncounter(requestId: string): boolean {
    if (!this.activeDungeonRequest || this.activeDungeonRequest.id !== requestId) return false
    this.clearBattleGeneration()
    return true
  }

  isDungeonEncounterActive(): boolean {
    return this.activeDungeonRequest !== null
  }

  update(deltaTime: number) {
    this.currentVfxQuality = updateVfxQuality(this.vfxBudget, deltaTime * 1000)
    if (!this.runtime || this.battleFrozen) return
    if (this.activeDungeonRequest) {
      if (
        this.activeDungeonRequest.completion === 'clear-room'
        && !this.dungeonCompletionPending
        && this.enemySpawner?.canSpawn() !== false
      ) {
        const spawn = nextSpawn(this.runtime, deltaTime)
        if (spawn.ok && spawn.enemy && !this.spawnRuntimeEnemy(spawn.enemy)) {
          rollbackSpawnedEnemy(this.runtime, spawn.enemy.id)
        }
      }
    } else if (this.stageFlow.phase === 'clearing' && this.enemySpawner?.canSpawn() !== false) {
      const spawn = nextSpawn(this.runtime, deltaTime)
      if (spawn.ok && spawn.enemy && !this.spawnRuntimeEnemy(spawn.enemy)) {
        rollbackSpawnedEnemy(this.runtime, spawn.enemy.id)
      }
    }
    if (!this.activeDungeonRequest) {
      const bossRetry = retryBossSpawnFlow(this.runtime, this.stageFlow, this.stageGeneration)
      if (bossRetry.bossSpawn) this.trySpawnBoss(bossRetry.bossSpawn)
    }
    this.syncCombatActors()
    stepEnemyCombatResolverAdapter(this.enemyCombatResolver, deltaTime)
    this.presentEnemyCombatFrame()
  }

  getLivingSwordTargets() {
    return snapshotLivingSwordTargets(this.runtime?.enemies ?? [])
  }

  getCurrentPlayerPosition() {
    const position = this.playerNode?.position ?? Vec3.ZERO
    return { x: position.x, y: position.y }
  }

  getBattleBounds() {
    return { minX: -360, maxX: 360, minY: -260, maxY: 260 }
  }

  resolveArtifactSwordHit(targetId: string) {
    const empty: ReturnType<typeof applyFlyingSwordPathHit> = {
      hitCount: 0,
      damageEvents: [],
      defeatedEnemyIds: [],
      stageClear: false,
    }
    if (!this.runtime || this.battleFrozen) return empty
    const enemyId = Number(targetId)
    if (!Number.isSafeInteger(enemyId)) return empty
    const enemy = this.runtime.enemies.find((entry) => entry.id === enemyId && entry.alive)
    if (!enemy) return empty
    const isolatedRuntime = { ...this.runtime, enemies: [enemy] }
    const result = applyFlyingSwordPathHit(isolatedRuntime, 1, 1, {
      points: [enemy.position, enemy.position],
      width: Math.max(this.swordHitWidth, enemy.radius + 1),
    })
    if (result.stageClear) this.runtime.stageCleared = true
    this.presentFlyingSwordHit(result)
    return result
  }

  resolveHomingSwordSegment(state: HomingSwordState, segment: HomingSwordSegment, phase: HomingSwordPhase) {
    const empty: ReturnType<typeof applyFlyingSwordPathHit> = {
      hitCount: 0,
      damageEvents: [],
      defeatedEnemyIds: [],
      stageClear: false,
    }
    if (!this.runtime || this.battleFrozen) return empty
    const { from, to } = segment
    const geometricHits = segmentHitEnemiesAlongPath(this.runtime, {
      points: [from, to],
      width: this.swordHitWidth,
      pierce: this.runtime.enemies.length,
    })
    const result = { ...empty }
    const newHitIds = new Set(recordGeometricSwordHits(state, geometricHits.map((enemy) => String(enemy.id)), phase))
    for (const enemy of geometricHits) {
      if (!newHitIds.has(String(enemy.id))) continue
      const isolatedRuntime = { ...this.runtime, enemies: [enemy] }
      const applied = applyFlyingSwordPathHit(isolatedRuntime, 1, 1, {
        points: [from, to],
        width: this.swordHitWidth,
      })
      result.hitCount += applied.hitCount
      result.damageEvents.push(...applied.damageEvents)
      result.defeatedEnemyIds.push(...applied.defeatedEnemyIds)
      result.stageClear ||= applied.stageClear
    }
    if (result.stageClear) this.runtime.stageCleared = true
    this.presentFlyingSwordHit(result)
    return result
  }

  isBattleFrozen() {
    return !canProcessBattleAction(this.battleFreeze)
  }

  getCurrentVfxQuality() {
    return this.currentVfxQuality
  }

  presentCombatFeedback(requests: readonly FeedbackRequest[]) {
    if (requests.length === 0) return
    this.node.emit('combat-feedback-requested', {
      quality: this.currentVfxQuality,
      requests,
    })
  }

  private get battleFrozen() {
    return this.isBattleFrozen()
  }

  private resolveStageProfile(stageNumber: number) {
    if (!this.designData || !Number.isSafeInteger(stageNumber) || stageNumber < 1) return null
    try {
      return stageProfileFromDesign(this.designData.json as CultivationDesignData, stageNumber)
    } catch {
      return null
    }
  }

  private rebuildRuntime(stage: ReturnType<typeof stageProfileFromDesign>) {
    this.activeDungeonRequest = null
    this.dungeonDefeatedEnemyIds = []
    this.dungeonCompletionPending = false
    this.unscheduleAllCallbacks()
    this.playerHurtToken = null
    this.bossTelegraphPresenter?.hideAll()
    this.bossSkillEffectPool?.despawnAll()
    this.soulOrbPool?.despawnAll()
    this.stageNumber = stage.id
    this.attemptState = beginBattleAttempt(this.attemptState, this.stageNumber)
    this.stageGeneration = this.attemptState.generation
    resetEnemyCombatResolverAdapter(this.enemyCombatResolver, this.stageGeneration)
    this.bossTelegraphPresenter?.resetGeneration(this.stageGeneration)
    this.setEnemyControllersPaused(false)
    this.stageSettlement = createStageSettlementState(this.stageGeneration)
    this.runtime = createBattleRuntime(stage, this.heroAttack)
    this.stageFlow = createStageFlow(this.runtime.defeatTarget, this.stageGeneration)
    this.damageGate = createContactDamageGate({
      maxHealth: this.playerMaxHealth,
      cooldown: 0,
    })
    this.soulCollected = 0
    rebuildBattleFreeze(this.battleFreeze)
    const playerController = this.playerNode?.getComponent(PlayerController)
    playerController?.reset()
    this.battleInput?.setInputEnabled(true)
    this.stageClearPanel?.hide()
    this.refreshHeroHealth()
    this.hud?.updateStage(stage.name, this.stageNumber)
    this.hud?.updateSoul(0, this.runtime.defeatTarget)
    this.hud?.hideBoss()
    const visual = stageVisualFor(this.stageNumber)
    this.node.emit('battle-stage-changed', {
      stageId: visual.stageId,
      backgroundId: visual.backgroundId,
      theme: visual.theme,
    })
  }

  private spawnRuntimeEnemy(enemy: BattleEnemy) {
    const node = this.enemySpawner?.spawnEnemy(enemy)
    if (!node) return null
    this.enemyNodes.set(enemy.id, node)
    this.enemyByNode.set(node, enemy)
    this.attachEnemyCombatListeners(node)
    this.upsertEnemyCombatActor(enemy, node)
    node.getComponent(EnemyController)?.setCombatPaused(this.battleFrozen)
    if (enemy.profile.role === 'boss') this.updateBossHud(enemy)
    return node
  }

  private trySpawnBoss(bossSpawn?: ReturnType<typeof spawnBoss> | null) {
    if (!this.runtime || this.battleFrozen || this.stageFlow.phase !== 'boss' || (!bossSpawn && this.runtime.bossSpawned)) return false
    const result = bossSpawn ?? spawnBoss(this.runtime)
    if (!result.ok || !result.enemy) return false
    const node = this.spawnRuntimeEnemy(result.enemy)
    if (!node) {
      rollbackSpawnedEnemy(this.runtime, result.enemy.id)
      return false
    }
    return true
  }

  private presentFlyingSwordHit(result: ReturnType<typeof applyFlyingSwordPathHit>) {
    for (const event of result.damageEvents) {
      const enemyNode = this.enemyNodes.get(event.enemyId)
      enemyNode?.emit('enemy-hit', event)
      this.presentCombatFeedback(feedbackFor({
        type: 'damage-resolved',
        sourceId: 'flying-sword',
        targetId: String(event.enemyId),
        amount: event.damage,
        at: performance.now(),
      }, this.currentVfxQuality))
      const enemy = this.enemyByNode.get(enemyNode as Node)
      if (enemy?.profile.role === 'boss') this.updateBossHud(enemy)
      const damageNode = this.damageNumberPool?.spawn()
      if (damageNode) {
        damageNode.setPosition(event.position.x, event.position.y + 72, 0)
        damageNode.getComponent(DamageNumberController)?.show(event.damage)
      }
    }

    for (const enemyId of result.defeatedEnemyIds) this.handleEnemyDefeat(enemyId)
  }

  private handleEnemyDefeat(enemyId: number) {
    if (!this.runtime) return
    const enemyNode = this.enemyNodes.get(enemyId)
    const enemy = enemyNode ? this.enemyByNode.get(enemyNode) : null
    if (!enemyNode || !enemy) return
    this.bossTelegraphPresenter?.cancelEnemy(this.stageGeneration, enemyId)
    removeEnemyCombatActor(this.enemyCombatResolver, this.stageGeneration, enemyId)
    enemyNode.emit('enemy-defeated', enemyId)
    this.spawnSoulOrb(enemyNode.position.clone(), enemy.profile.role === 'boss' ? 5 : 1)

    const generation = this.stageGeneration
    if (this.activeDungeonRequest) {
      if (!this.dungeonDefeatedEnemyIds.includes(enemyId)) this.dungeonDefeatedEnemyIds.push(enemyId)
      const requestId = this.activeDungeonRequest.id
      const completed = enemy.profile.role === 'boss'
        ? this.activeDungeonRequest.completion !== 'clear-room'
        : this.activeDungeonRequest.completion === 'clear-room'
          && this.dungeonDefeatedEnemyIds.length >= this.activeDungeonRequest.defeatTarget
      if (completed && !this.dungeonCompletionPending) {
        this.dungeonCompletionPending = true
        this.freezeDungeonBattle()
        this.scheduleOnce(() => {
          if (
            generation !== this.stageGeneration
            || this.activeDungeonRequest?.id !== requestId
            || !this.dungeonCompletionPending
          ) return
          this.completeDungeonEncounter(generation, requestId)
        }, Math.max(this.deathRecycleDelay, enemy.profile.role === 'boss' ? this.bossDeathSettleDelay : 0))
      } else if (!completed) {
        this.scheduleDungeonEnemyRecycle(generation, enemyId, enemyNode)
      }
      return
    }

    if (enemy.profile.role === 'boss') {
      this.presentCombatFeedback(feedbackFor({
        type: 'guard-broken',
        targetRank: 'boss',
        targetId: String(enemyId),
        at: performance.now(),
      }, this.currentVfxQuality))
      const transition = advanceBossDefeatFlow(this.stageFlow, generation)
      if (!transition.settle) return
      this.freezeBattle()
      const settlementToken = scheduleBossSettlement(this.stageSettlement)
      if (settlementToken === null) return
      const settleDelay = Math.max(this.deathRecycleDelay, this.bossDeathSettleDelay)
      this.scheduleOnce(() => {
        if (!completeBossSettlement(this.stageSettlement, settlementToken)) return
        if (this.enemyNodes.get(enemyId) === enemyNode) {
          this.detachEnemyCombatListeners(enemyNode)
          this.enemySpawner?.despawnEnemy(enemyNode)
          this.enemyNodes.delete(enemyId)
          this.enemyByNode.delete(enemyNode)
        }
        this.finishStage()
      }, settleDelay)
      return
    }

    const transition = advanceOrdinaryDefeatFlow(this.runtime, this.stageFlow, generation)
    this.scheduleOnce(() => {
      if (generation !== this.stageGeneration) return
      if (this.enemyNodes.get(enemyId) === enemyNode) {
        this.detachEnemyCombatListeners(enemyNode)
        this.enemySpawner?.despawnEnemy(enemyNode)
        this.enemyNodes.delete(enemyId)
        this.enemyByNode.delete(enemyNode)
      }
    }, this.deathRecycleDelay)
    for (const retiredEnemyId of transition.retiredEnemyIds) {
      const node = this.enemyNodes.get(retiredEnemyId)
      this.bossTelegraphPresenter?.cancelEnemy(this.stageGeneration, retiredEnemyId)
      removeEnemyCombatActor(this.enemyCombatResolver, this.stageGeneration, retiredEnemyId)
      if (node) {
        this.detachEnemyCombatListeners(node)
        this.enemySpawner?.despawnEnemy(node)
      }
      this.enemyNodes.delete(retiredEnemyId)
      if (node) this.enemyByNode.delete(node)
    }
    if (transition.bossSpawn) this.trySpawnBoss(transition.bossSpawn)
  }

  private spawnSoulOrb(position: Vec3, amount: number) {
    const orb = this.soulOrbPool?.spawn()
    if (!orb || !this.playerNode) return
    orb.setPosition(position)
    const controller = orb.getComponent(SoulOrbController)
    if (!controller) return
    controller.follow(this.playerNode, amount)
    const generation = this.stageGeneration
    controller.onPicked = (picked) => {
      if (!isBattleAttemptCallbackCurrent(this.attemptState, generation, 'active')) return
      this.collectSoul(picked)
    }
  }

  private collectSoul(amount: number) {
    this.soulCollected += amount
    this.hud?.updateSoul(this.soulCollected, this.runtime?.defeatTarget ?? 12)
    this.node.emit('soul-orb-picked', amount)
  }

  private applyResolvedPlayerDamage(damage: number) {
    const applied = applyDirectDamage(this.damageGate, damage)
    if (!applied) return
    this.refreshHeroHealth()
    this.playerNode?.emit('player-hit', damage)
    const playerController = this.playerNode?.getComponent(PlayerController)
    if (this.damageGate.health <= 0 && markPlayerDefeated(this.stageFlow).changed && markBattleAttemptDefeated(this.attemptState)) {
      this.freezeBattle()
      playerController?.requestPresentationAction('death', 'battle-runtime')
      this.playerNode?.emit('player-defeated')
      if (this.activeDungeonRequest) return
      const generation = this.stageGeneration
      this.scheduleOnce(() => {
        if (!isBattleAttemptCallbackCurrent(this.attemptState, generation, 'defeated')) return
        this.stageClearPanel?.showDefeat(this.stageNumber)
      }, this.playerDefeatPanelDelay)
    } else if (this.damageGate.health > 0 && playerController) {
      this.presentPlayerHurt(playerController)
    }
  }

  private presentPlayerHurt(playerController: PlayerController) {
    const token = playerController.requestPresentationAction('hurt', 'battle-runtime-hurt')
    if (!token) return
    this.playerHurtToken = token
    this.scheduleOnce(() => {
      if (this.playerHurtToken !== token) return
      this.playerHurtToken = null
      playerController.completePresentationAction(token)
    }, Math.max(0, this.playerHurtDuration))
  }

  private refreshHeroHealth() {
    this.hud?.updateHero({
      realm: '筑基三重',
      health: this.damageGate.health,
      maxHealth: this.damageGate.maxHealth,
      mana: 12,
      maxMana: 12,
    })
  }

  private updateBossHud(enemy: BattleEnemy) {
    this.hud?.showBoss(enemy.profile.name, Math.max(0, enemy.hp), 520)
  }

  private finishStage() {
    if (!markBattleAttemptCleared(this.attemptState)) return
    this.hud?.hideBoss()
    const result = this.runtime ? claimStageClearRuntime(this.runtime) : null
    if (result?.ok && result.result) {
      this.stageClearPanel?.showResult(result.result)
      this.node.emit('world-stage-cleared', {
        stage: this.stageNumber,
        rewardId: worldRewardId(this.stageNumber, this.rewardSessionId, this.stageGeneration),
      })
    }
  }

  private freezeBattle() {
    freezeBattle(this.battleFreeze)
    pauseEnemyCombatResolverAdapter(this.enemyCombatResolver, this.stageGeneration, true)
    this.bossTelegraphPresenter?.hideAll()
    this.setEnemyControllersPaused(true)
    this.playerNode?.getComponent(PlayerController)?.stop()
    this.battleInput?.setInputEnabled(false)
  }

  private recycleAllEnemies() {
    for (const [enemyId, node] of this.enemyNodes) {
      this.bossTelegraphPresenter?.cancelEnemy(this.stageGeneration, enemyId)
      removeEnemyCombatActor(this.enemyCombatResolver, this.stageGeneration, enemyId)
      this.detachEnemyCombatListeners(node)
      this.enemySpawner?.despawnEnemy(node)
    }
    this.enemyNodes.clear()
    this.enemyByNode.clear()
    this.bossTelegraphPresenter?.hideAll()
  }

  onDestroy() {
    this.clearBattleGeneration()
  }

  private cloneValidDungeonRequest(request: DungeonBattleRequest): DungeonBattleRequest | null {
    if (!request || typeof request !== 'object') return null
    if (typeof request.id !== 'string' || request.id.length === 0 || request.id !== request.id.trim()) return null
    if (!Number.isInteger(request.seed) || request.seed < 0 || request.seed > 0xffffffff) return null
    if (!Number.isSafeInteger(request.defeatTarget) || request.defeatTarget <= 0) return null
    if (!Number.isSafeInteger(request.maxAlive) || request.maxAlive <= 0 || request.maxAlive > 18) return null
    if (!Array.isArray(request.enemies)) return null
    if (!this.validDungeonEnemyProfiles(request.enemies)) return null
    if (request.completion === 'clear-room') {
      if (request.boss !== null || request.enemies.length === 0 || request.enemies.some((enemy) => enemy.role === 'boss')) return null
    } else if (request.completion === 'repel' || request.completion === 'kill') {
      if (request.enemies.length !== 0 || !request.boss || !this.validDungeonEnemyProfiles([request.boss]) || request.boss.role !== 'boss') return null
    } else return null
    return {
      id: request.id,
      seed: request.seed,
      enemies: request.enemies.map((enemy) => ({ ...enemy })),
      defeatTarget: request.defeatTarget,
      maxAlive: request.maxAlive,
      boss: request.boss ? { ...request.boss } : null,
      completion: request.completion,
    }
  }

  private validDungeonEnemyProfiles(enemies: readonly EnemyProfile[]): boolean {
    return enemies.every((enemy) => (
      Boolean(enemy)
      && typeof enemy.id === 'string'
      && enemy.id.length > 0
      && enemy.id === enemy.id.trim()
      && typeof enemy.name === 'string'
      && enemy.name.trim().length > 0
      && (enemy.role === 'ground' || enemy.role === 'flying' || enemy.role === 'boss')
      && typeof enemy.theme === 'string'
      && enemy.theme.trim().length > 0
    ))
  }

  private stageForDungeonRequest(request: DungeonBattleRequest): StageProfile {
    const fallbackBoss: EnemyProfile = request.boss ?? {
      id: 'mist-bamboo-emperor',
      name: '雾竹皇',
      role: 'boss',
      theme: 'mist-bamboo-pursuit',
    }
    return {
      id: 0,
      name: request.id,
      theme: request.boss?.theme ?? request.enemies[0]?.theme ?? 'mist-bamboo',
      background: request.id,
      encounter: request.boss ? 'elite' : 'normal',
      enemies: request.enemies.map((enemy) => ({ ...enemy })),
      boss: { ...fallbackBoss },
    }
  }

  private spawnDungeonBoss(profile: EnemyProfile): boolean {
    if (!this.runtime) return false
    const enemy: BattleEnemy = {
      id: this.runtime.nextEnemyId,
      profile: { ...profile },
      hp: 520,
      position: { x: 580, y: -42 },
      radius: 70,
      alive: true,
      dropped: false,
    }
    this.runtime.nextEnemyId += 1
    this.runtime.bossSpawned = true
    this.runtime.enemies.push(enemy)
    if (this.spawnRuntimeEnemy(enemy)) return true
    rollbackSpawnedEnemy(this.runtime, enemy.id)
    return false
  }

  private scheduleDungeonEnemyRecycle(generation: number, enemyId: number, enemyNode: Node) {
    this.scheduleOnce(() => {
      if (generation !== this.stageGeneration || !this.activeDungeonRequest) return
      if (this.enemyNodes.get(enemyId) === enemyNode) {
        this.detachEnemyCombatListeners(enemyNode)
        this.enemySpawner?.despawnEnemy(enemyNode)
        this.enemyNodes.delete(enemyId)
        this.enemyByNode.delete(enemyNode)
      }
    }, this.deathRecycleDelay)
  }

  private freezeDungeonBattle() {
    this.freezeBattle()
  }

  private completeDungeonEncounter(generation: number, requestId: string) {
    const request = this.activeDungeonRequest
    if (!request || request.id !== requestId || generation !== this.stageGeneration || !this.dungeonCompletionPending) return
    const result: DungeonBattleResult = {
      requestId,
      completion: request.completion,
      defeatedEnemyIds: [...this.dungeonDefeatedEnemyIds],
    }
    this.lastDungeonBattleResult = {
      ...result,
      defeatedEnemyIds: [...result.defeatedEnemyIds],
    }
    const callback = this.onDungeonEncounterCompleted
    this.clearBattleGeneration()
    callback?.({ ...result, defeatedEnemyIds: [...result.defeatedEnemyIds] })
  }

  private clearBattleGeneration() {
    this.unscheduleAllCallbacks()
    this.playerHurtToken = null
    this.setEnemyControllersPaused(true)
    this.recycleAllEnemies()
    this.soulOrbPool?.despawnAll()
    this.damageNumberPool?.despawnAll()
    this.bossSkillEffectPool?.despawnAll()
    this.bossTelegraphPresenter?.hideAll()
    const nextGeneration = Math.max(this.stageGeneration + 1, this.enemyCombatResolver.generation + 1)
    this.stageGeneration = nextGeneration
    this.node.emit('battle-generation-reset', { generation: nextGeneration })
    this.attemptState = createBattleAttemptState(nextGeneration, this.stageNumber)
    resetEnemyCombatResolverAdapter(this.enemyCombatResolver, nextGeneration)
    this.bossTelegraphPresenter?.resetGeneration(nextGeneration)
    this.activeDungeonRequest = null
    this.dungeonDefeatedEnemyIds = []
    this.dungeonCompletionPending = false
    this.runtime = null
    this.stageFlow = createStageFlow(1, nextGeneration)
    this.stageSettlement = createStageSettlementState(nextGeneration)
    this.battleInput?.setInputEnabled(false)
  }

  private attachEnemyCombatListeners(node: Node) {
    this.detachEnemyCombatListeners(node)
    node.on('enemy-telegraph', this.onEnemyTelegraph, this)
    node.on('enemy-hitbox-active', this.onEnemyHitboxActive, this)
    node.on('enemy-projectile-spawned', this.onEnemyProjectileSpawned, this)
    node.on('enemy-attack-cancelled', this.onEnemyCombatCancelled, this)
    node.on('enemy-attack-recovery', this.onEnemyCombatRecovery, this)
  }

  private detachEnemyCombatListeners(node: Node) {
    node.off('enemy-telegraph', this.onEnemyTelegraph, this)
    node.off('enemy-hitbox-active', this.onEnemyHitboxActive, this)
    node.off('enemy-projectile-spawned', this.onEnemyProjectileSpawned, this)
    node.off('enemy-attack-cancelled', this.onEnemyCombatCancelled, this)
    node.off('enemy-attack-recovery', this.onEnemyCombatRecovery, this)
  }

  private onEnemyTelegraph(enemyId: number, command: Extract<EnemyCommand, { type: 'show-telegraph' }>) {
    consumeEnemyCombatCommand(this.enemyCombatResolver, this.stageGeneration, enemyId, command)
    this.presentQueuedEnemyTelegraphs()
  }

  private onEnemyHitboxActive(enemyId: number, command: Extract<EnemyCommand, { type: 'activate-hitbox' }>) {
    consumeEnemyCombatCommand(this.enemyCombatResolver, this.stageGeneration, enemyId, command)
    if (command.danger) this.bossTelegraphPresenter?.activate(this.stageGeneration, enemyId, command)
  }

  private onEnemyProjectileSpawned(enemyId: number, command: Extract<EnemyCommand, { type: 'spawn-projectile' }>) {
    consumeEnemyCombatCommand(this.enemyCombatResolver, this.stageGeneration, enemyId, command)
  }

  private onEnemyCombatCancelled(enemyId: number) {
    cancelEnemyCombatActorAttacks(this.enemyCombatResolver, this.stageGeneration, enemyId)
    this.bossTelegraphPresenter?.cancelEnemy(this.stageGeneration, enemyId)
  }

  private onEnemyCombatRecovery(enemyId: number) {
    this.bossTelegraphPresenter?.recoverEnemy(this.stageGeneration, enemyId)
  }

  private setEnemyControllersPaused(paused: boolean) {
    for (const node of this.enemyNodes.values()) {
      node.getComponent(EnemyController)?.setCombatPaused(paused)
    }
  }

  private syncCombatActors() {
    if (!this.playerNode) return
    const playerPosition = this.playerNode.position
    upsertPlayerCombatActor(this.enemyCombatResolver, {
      generation: this.stageGeneration,
      position: { x: playerPosition.x, y: playerPosition.y },
      radius: 28,
      alive: this.damageGate.health > 0 && this.playerNode.activeInHierarchy,
    })
    for (const [enemyId, node] of this.enemyNodes) {
      const enemy = this.enemyByNode.get(node)
      if (!enemy) continue
      this.upsertEnemyCombatActor(enemy, node)
    }
  }

  private upsertEnemyCombatActor(enemy: BattleEnemy, node: Node) {
    const position = node.position
    upsertEnemyCombatActor(this.enemyCombatResolver, {
      generation: this.stageGeneration,
      enemyId: enemy.id,
      position: { x: position.x, y: position.y },
      radius: enemy.radius,
      alive: enemy.alive && node.activeInHierarchy,
    })
  }

  private presentEnemyCombatFrame() {
    this.presentQueuedEnemyTelegraphs()
    for (const event of drainEnemyCombatDamage(this.enemyCombatResolver)) {
      if (event.generation !== this.stageGeneration || this.battleFrozen) continue
      this.applyResolvedPlayerDamage(event.amount)
    }
  }

  private presentQueuedEnemyTelegraphs() {
    for (const telegraph of drainEnemyTelegraphs(this.enemyCombatResolver)) {
      if (telegraph.danger) this.bossTelegraphPresenter?.present(telegraph)
      this.node.emit('enemy-telegraph-presented', telegraph)
    }
  }
}
