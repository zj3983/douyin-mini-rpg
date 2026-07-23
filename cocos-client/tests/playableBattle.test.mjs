import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as swordRuntime from '../tools/homing-sword-runtime.mjs'
import * as battleRuntime from '../tools/battle-runtime.mjs'
import {
  createPlayerMotor,
  requestMove,
  resetPlayerMotor,
  stepPlayerMotor,
  stopPlayerMotor,
} from '../assets/Scripts/Combat/PlayerMotor.ts'
import { completeDrain, createStageFlow, recordBossDefeat, recordOrdinaryDefeat } from '../tools/stage-flow-runtime.mjs'

const read = (path) => readFileSync(resolve(path), 'utf8')

const homingConfig = { speed: 10, maxTurnRadians: Math.PI, maxOutboundDistance: 20, returnRadius: 1 }

test('accepted boss settlement freezes input movement and queued damage until rebuild', () => {
  const flow = createStageFlow(1, 4)
  recordOrdinaryDefeat(flow)
  completeDrain(flow, 4)
  const movement = createPlayerMotor({ x: -210, y: -80 }, 220)
  const damageGate = battleRuntime.createContactDamageGate({ maxHealth: 220, cooldown: 0 })
  const freeze = battleRuntime.createBattleFreezeState()

  assert.equal(requestMove(movement, { x: 40, y: 200 }), true)
  const transition = recordBossDefeat(flow)
  assert.deepEqual(transition, { changed: true, command: 'settle' })
  battleRuntime.freezeBattle(freeze)
  stopPlayerMotor(movement)

  assert.equal(battleRuntime.canProcessBattleAction(freeze), false)
  assert.equal(requestMove(movement, { x: 20, y: 120 }), false)
  assert.equal(movement.target, null)
  const delayedFrame = stepPlayerMotor(movement, 0.55)
  assert.equal(delayedFrame.distanceMoved, 0)
  if (battleRuntime.canProcessBattleAction(freeze)) battleRuntime.applyDirectDamage(damageGate, 35)
  assert.equal(damageGate.health, 220)

  battleRuntime.rebuildBattleFreeze(freeze)
  resetPlayerMotor(movement)
  assert.equal(battleRuntime.canProcessBattleAction(freeze), true)
  assert.equal(requestMove(movement, { x: 20, y: 120 }), true)
  if (battleRuntime.canProcessBattleAction(freeze)) battleRuntime.applyDirectDamage(damageGate, 35)
  assert.equal(damageGate.health, 185)
})

test('runtime node pool supports a bounded factory-backed pool', () => {
  const source = read('assets/Scripts/Game/NodePoolController.ts')

  assert.match(source, /setFactory\(factory:/)
  assert.match(source, /private factory:/)
  assert.match(source, /this\.factory\?\.\(result\.id\)/)
  assert.match(source, /capacity = 18/)
  assert.match(source, /hasAvailableSlot\(\)/)
  assert.match(source, /poolStats\(this\.state\)\.active < this\.capacity/)
})

test('enemy spawner binds ordinary and Boss brains to shared live context providers', () => {
  const source = read('assets/Scripts/Game/EnemySpawner.ts')

  assert.match(source, /bindEnemy\(enemy: BattleEnemy\)/)
  assert.match(source, /profile\.role === 'flying'/)
  assert.match(source, /profile\.role === 'boss'/)
  assert.match(source, /profile\.id === 'moss-wolf'/)
  assert.match(source, /profile\.id === 'green-wing-moth'/)
  assert.match(source, /computeOrdinaryEnemySpawn\(this\.battleLayout, visualSize, laneY\)/)
  assert.match(source, /enemy\.position = \{ x: spawn\.x, y: spawn\.y \}/)
  assert.match(source, /battleBounds:\s*\(\) => this\.currentBattleBounds\(\)/)
  assert.match(source, /neighbors:\s*\(\) => this\.livingNeighbors\(\)/)
  assert.match(source, /if \(kind \|\| isBoss\)[\s\S]*controller\.bindRuntimeEnemy\(enemy,\s*\{[\s\S]*kind: isBoss \? 'bamboo-warden'/)
  assert.doesNotMatch(source, /createEnemyBrain\([^\n]*bamboo-warden/)
})

test('enemy controller builds live brain context and continuously synchronizes movement to runtime position', () => {
  const source = read('assets/Scripts/Game/EnemyController.ts')

  assert.match(source, /private runtimeEnemy: BattleEnemy \| null/)
  assert.match(source, /private brain: EnemyBrainState \| null/)
  assert.match(source, /private bossBrain: BossBrainState \| null/)
  assert.match(source, /bindRuntimeEnemy\(enemy: BattleEnemy, binding\?: EnemyBrainBinding\)/)
  assert.match(source, /createBambooWardenBrain\(enemy\.id,/)
  assert.match(source, /createEnemyBrain\(binding\.kind, enemy\.id,/)
  assert.match(source, /stepEnemyBrain\(this\.brain, context, deltaTime\)/)
  assert.match(source, /player:\s*\{[\s\S]*position:\s*\{ x: liveTarget\.x, y: liveTarget\.y \}/)
  assert.match(source, /neighbors:\s*this\.brainBinding\.neighbors\(\)/)
  assert.match(source, /battleBounds:\s*this\.brainBinding\.battleBounds\(\)/)
  assert.match(source, /case 'move':[\s\S]*this\.brain\?\.position \?\? this\.bossBrain\?\.position/)
  assert.match(source, /this\.runtimeEnemy\.position = \{ x: local\.x, y: local\.y \}/)
  assert.match(source, /setTargetNode\(targetNode: Node, lockY:/)
  assert.match(source, /this\.targetNode\?\.position/)
})

test('enemy controller forwards active-frame commands and never emits direct player damage', () => {
  const source = read('assets/Scripts/Game/EnemyController.ts')

  assert.match(source, /mapEnemyAnimationAction\(this\.brain\.kind, command\.action\)/)
  assert.match(source, /emit\('enemy-semantic-animation', command\.action,/)
  assert.match(source, /case 'show-telegraph':[\s\S]*emit\('enemy-telegraph',/)
  assert.match(source, /case 'activate-hitbox':[\s\S]*emit\('enemy-hitbox-active',/)
  assert.match(source, /case 'spawn-projectile':[\s\S]*emit\('enemy-projectile-spawned',/)
  assert.doesNotMatch(source, /enemy-attack-player/)
  assert.doesNotMatch(source, /attackCooldown|cooldownLeft|contactDamage|contact-damage/)
  assert.doesNotMatch(source, /new Node\([^\n]*(?:wing|limb)/i)
  assert.match(source, /consumeCommands\(hurtEnemyBrain\(this\.brain, this\.brain\.elapsed\)\)/)
  assert.match(source, /setCombatPaused\(paused: boolean\)/)
  assert.match(source, /if \(this\.combatPaused\) return/)
  assert.match(source, /emit\('enemy-attack-cancelled', this\.runtimeEnemy\.id\)/)
})

test('battle controller drives resolved enemy damage, stage flow, drops, HUD, and manual clear', () => {
  const source = read('assets/Scripts/Game/BattleRuntimeController.ts')

  for (const marker of [
    "'enemy-telegraph-presented'",
    'bossTelegraphPresenter',
    "'soul-orb-picked'",
    'spawnSoulOrb',
    'trySpawnBoss',
    'showResult',
    'battleFrozen',
    'updateBossHud',
  ]) {
    assert.equal(source.includes(marker), true, `missing ${marker}`)
  }
  assert.doesNotMatch(source, /scheduleOnce\([^)]*hide/)
  assert.match(source, /if \(this\.stageFlow\.phase === 'clearing' && this\.enemySpawner\?\.canSpawn\(\) !== false\)/)
  assert.match(source, /isBattleFrozen\(\)/)
  assert.match(source, /if \(this\.enemyNodes\.get\(enemyId\) === enemyNode\) \{/)
  assert.match(source, /private stageFlow: StageFlowState/)
  assert.match(source, /this\.stageFlow\.phase === 'clearing'/)
  assert.match(source, /advanceOrdinaryDefeatFlow\(this\.runtime, this\.stageFlow, generation\)/)
  assert.doesNotMatch(source, /pendingEnemyRecycles/)
  assert.doesNotMatch(source, /if \(this\.enemyNodes\.get\(enemyId\) !== enemyNode\) return/)
})

test('battle controller owns one generation-scoped resolver adapter and all enemy combat listeners', () => {
  const source = read('assets/Scripts/Game/BattleRuntimeController.ts')

  assert.match(source, /createEnemyCombatResolverAdapter\(1\)/)
  assert.match(source, /resetEnemyCombatResolverAdapter\(this\.enemyCombatResolver, this\.stageGeneration\)/)
  assert.match(source, /upsertPlayerCombatActor\(this\.enemyCombatResolver,/)
  assert.match(source, /upsertEnemyCombatActor\(this\.enemyCombatResolver,/)
  assert.match(source, /stepEnemyCombatResolverAdapter\(this\.enemyCombatResolver, deltaTime\)/)
  assert.match(source, /drainEnemyCombatDamage\(this\.enemyCombatResolver\)/)
  assert.match(source, /drainEnemyTelegraphs\(this\.enemyCombatResolver\)/)
  assert.match(source, /node\.on\('enemy-telegraph', this\.onEnemyTelegraph, this\)/)
  assert.match(source, /node\.on\('enemy-hitbox-active', this\.onEnemyHitboxActive, this\)/)
  assert.match(source, /node\.on\('enemy-projectile-spawned', this\.onEnemyProjectileSpawned, this\)/)
  assert.match(source, /node\.on\('enemy-attack-cancelled', this\.onEnemyCombatCancelled, this\)/)
  assert.match(source, /pauseEnemyCombatResolverAdapter\(this\.enemyCombatResolver, this\.stageGeneration, true\)/)
  assert.match(source, /getComponent\(EnemyController\)\?\.setCombatPaused\(paused\)/)
  assert.match(source, /node\.off\('enemy-telegraph', this\.onEnemyTelegraph, this\)/)
  assert.match(source, /removeEnemyCombatActor\(this\.enemyCombatResolver, this\.stageGeneration, enemyId\)/)
  assert.match(source, /onDestroy\(\)[\s\S]*detachEnemyCombatListeners/)
  assert.doesNotMatch(source, /enemy-attack-player|onEnemyAttack|applyContactDamage|tickContactDamageGate/)
})

test('enemy spawner shares one immutable neighbor snapshot across all brains per frame', () => {
  const source = read('assets/Scripts/Game/EnemySpawner.ts')

  assert.match(source, /private neighborSnapshot: readonly EnemyNeighborSnapshot\[\]/)
  assert.match(source, /lateUpdate\(\)/)
  assert.match(source, /this\.rebuildNeighborSnapshot\(\)/)
  assert.match(source, /neighbors: \(\) => this\.livingNeighbors\(\)/)
  assert.doesNotMatch(source, /livingNeighbors\(excludedId: number\)/)
  assert.match(source, /return this\.neighborSnapshot/)
})

test('boss spawn and settlement are commanded once with delayed generation guards', () => {
  const source = read('assets/Scripts/Game/BattleRuntimeController.ts')
  const input = read('assets/Scripts/Game/BattleInputController.ts')
  const bootstrap = read('assets/Scripts/Game/PortraitBattleBootstrap.ts')

  assert.match(source, /advanceBossDefeatFlow\(this\.stageFlow, generation\)/)
  assert.match(source, /!transition\.settle/)
  assert.match(source, /createStageFlow\(this\.runtime\.defeatTarget, this\.stageGeneration\)/)
  assert.match(source, /retryBossSpawnFlow\(this\.runtime, this\.stageFlow, this\.stageGeneration\)/)
  assert.match(source, /if \(bossRetry\.bossSpawn\) this\.trySpawnBoss\(bossRetry\.bossSpawn\)/)
  assert.match(source, /this\.unscheduleAllCallbacks\(\)/)
  assert.match(source, /rollbackSpawnedEnemy\(this\.runtime, result\.enemy\.id\)/)
  assert.match(source, /bossDeathSettleDelay/)
  assert.match(source, /scheduleBossSettlement/)
  assert.match(source, /completeBossSettlement/)
  assert.match(source, /Math\.max\(this\.deathRecycleDelay, this\.bossDeathSettleDelay\)/)
  const transitionIndex = source.indexOf('if (!transition.settle) return')
  const freezeIndex = source.indexOf('this.freezeBattle()')
  const delayIndex = source.indexOf('this.scheduleOnce(() => {', transitionIndex)
  assert.ok(transitionIndex >= 0 && freezeIndex > transitionIndex && delayIndex > freezeIndex)
  const finishBody = source.match(/private finishStage\(\) \{([\s\S]*?)\n  \}/)?.[1] ?? ''
  assert.doesNotMatch(finishBody, /freezeBattle|battleFrozen\s*=\s*true/)
  assert.match(source, /this\.battleInput\?\.setInputEnabled\(false\)/)
  assert.match(source, /this\.battleInput\?\.setInputEnabled\(true\)/)
  assert.match(input, /public setInputEnabled\(enabled: boolean\)/)
  assert.match(input, /if \(!this\.inputEnabled\) return false/)
  assert.match(bootstrap, /runtime\.battleInput = bindings\.battleInput/)
  assert.doesNotMatch(source, /if \(result\.stageClear\) this\.finishStage\(\)/)
})

test('enemy pool can reserve a node and activate it only after visual reset', () => {
  const pool = read('assets/Scripts/Game/NodePoolController.ts')
  const spawner = read('assets/Scripts/Game/EnemySpawner.ts')

  assert.match(pool, /spawn\(activate = true\)/)
  assert.match(pool, /activateNode\(node: Node\)/)
  assert.match(pool, /if \(activate\) this\.activateNode\(node\)/)
  assert.match(spawner, /enemyPool\.spawn\(false\)/)
  const resetIndex = spawner.indexOf('visual?.resetForSpawn')
  const activateIndex = spawner.indexOf('enemyPool.activateNode(node)')
  assert.ok(resetIndex >= 0 && activateIndex > resetIndex)
})

test('pooled enemy lifecycle resets combat and visual state before spawn events', () => {
  const spawner = read('assets/Scripts/Game/EnemySpawner.ts')
  const enemy = read('assets/Scripts/Game/EnemyController.ts')
  const visual = read('assets/Scripts/Game/EnemyVisualController.ts')

  assert.match(enemy, /prepareForPool\(\)/)
  assert.match(enemy, /this\.target = null/)
  assert.match(enemy, /this\.targetNode = null/)
  assert.match(enemy, /this\.lockTargetY = false/)
  assert.match(enemy, /this\.brain = null/)
  assert.match(enemy, /this\.brainBinding = null/)
  assert.match(enemy, /this\.facing = -1/)
  assert.match(visual, /resetForSpawn\(profile:/)
  assert.match(visual, /prepareForPool\(\)/)
  assert.match(visual, /unscheduleAllCallbacks\(\)/)
  assert.match(visual, /this\.animator\?\.reset\(commands\.action\)/)
  assert.match(visual, /this\.animator\?\.stop\(\)/)

  const resetIndex = spawner.indexOf('visual?.resetForSpawn')
  const activeIndex = spawner.indexOf('enemyPool.activateNode(node)')
  const eventIndex = spawner.indexOf("node.emit('enemy-runtime-spawned'")
  assert.ok(resetIndex >= 0 && activeIndex > resetIndex && eventIndex > activeIndex)
  assert.match(spawner, /visual\?\.prepareForPool\(\)[\s\S]*controller\?\.prepareForPool\(\)[\s\S]*enemyPool\?\.despawn/)
})

test('atlas animator invalidates stale loads and exposes stop and frame-zero reset', () => {
  const source = read('assets/Scripts/Game/AtlasAnimator.ts')

  assert.match(source, /private loadGeneration = 0/)
  assert.match(source, /setActor\(actorId: string\)/)
  assert.match(source, /this\.loadGeneration \+= 1/)
  assert.match(source, /stop\(\)/)
  assert.match(source, /reset\(actionName = 'move'\)/)
  assert.match(source, /currentFrameSize\(\)/)
  assert.match(source, /currentFrameAspect\(\)/)
  assert.match(source, /acceptAnimationLoad\(/)
  assert.match(source, /this\.frameIndex = 0/)
  assert.match(source, /resourcePathForPng\(action\.atlas\)/)
  assert.match(source, /this\.buildFrames\(texture, this\.actorId, action\.atlas, action\)/)
})

test('atlas animator owns and reuses cached action frames until destruction', () => {
  const source = read('assets/Scripts/Game/AtlasAnimator.ts')

  assert.match(source, /private frameCache = new Map<string, SpriteFrame\[\]>\(\)/)
  assert.match(source, /private frameCacheKey\(actorId: string, atlas: string, actionName: string\)/)
  assert.match(source, /const cached = this\.frameCache\.get\(cacheKey\)/)
  assert.match(source, /if \(cached\) return cached/)
  assert.match(source, /this\.frameCache\.set\(cacheKey, frames\)/)
  assert.match(source, /for \(const frames of this\.frameCache\.values\(\)\)/)
  assert.match(source, /for \(const frame of frames\) frame\.destroy\(\)/)
  assert.match(source, /this\.frameCache\.clear\(\)/)
})

test('atlas animator destruction invalidates late loads and checks every Cocos target', () => {
  const source = read('assets/Scripts/Game/AtlasAnimator.ts')

  assert.match(source, /private destroyed = false/)
  assert.match(source, /onDestroy\(\)/)
  assert.match(source, /this\.destroyed = true/)
  assert.match(source, /this\.loadGeneration \+= 1/)
  assert.match(source, /this\.resetState = prepareVisualForPool\(this\.resetState\)/)
  assert.match(source, /if \(this\.targetSprite\?\.isValid\) this\.targetSprite\.spriteFrame = null/)
  assert.match(source, /this\.destroyed/)
  assert.match(source, /!this\.node\.isValid/)
  assert.match(source, /!this\.targetSprite\?\.isValid/)
  assert.match(source, /!this\.targetSprite\.node\.isValid/)
})

test('enemy manifest loading is guarded by the pooled visual generation', () => {
  const bootstrap = read('assets/Scripts/Game/PortraitBattleBootstrap.ts')
  const visual = read('assets/Scripts/Game/EnemyVisualController.ts')

  assert.match(bootstrap, /const token = visual\.beginManifestLoad\(\)/)
  assert.match(bootstrap, /if \(!visual\.acceptManifestLoad\(token\)\) return/)
  assert.match(bootstrap, /bindAnimationManifest\(visual, animator, 'move'\)/)
  assert.match(visual, /beginManifestLoad\(\)/)
  assert.match(visual, /acceptManifestLoad\(token:/)
})

test('enemy visual controller applies canonical reset commands instead of detached defaults', () => {
  const source = read('assets/Scripts/Game/EnemyVisualController.ts')

  assert.match(source, /private visualState: VisualResetState = createVisualResetState\(\)/)
  assert.match(source, /this\.visualState = resetVisualForSpawn\(/)
  assert.match(source, /this\.visualState = prepareVisualForPool\(/)
  assert.match(source, /const commands = visualResetCommands\(this\.visualState\)/)
  assert.match(source, /setPosition\(commands\.position\.x, commands\.position\.y, commands\.position\.z\)/)
  assert.match(source, /setScale\(commands\.scale\.x, commands\.scale\.y, commands\.scale\.z\)/)
  assert.match(source, /setRotationFromEuler\(commands\.rotation\.x, commands\.rotation\.y, commands\.rotation\.z\)/)
  assert.match(source, /new Color\(commands\.color\.r, commands\.color\.g, commands\.color\.b, commands\.color\.a\)/)
  assert.match(source, /this\.applyActionState\('hurt'\)/)
  assert.match(source, /this\.applyActionState\('attack'\)/)
  assert.match(source, /this\.applyActionState\('death'\)/)
})

test('enemy visual controller consumes every canonical combat flag', () => {
  const source = read('assets/Scripts/Game/EnemyVisualController.ts')

  assert.match(source, /private defeated = false/)
  assert.match(source, /private hit = false/)
  assert.match(source, /private attacking = false/)
  assert.match(source, /this\.defeated = commands\.defeated/)
  assert.match(source, /this\.hit = commands\.hit/)
  assert.match(source, /this\.attacking = commands\.attacking/)

  for (const action of ['move', 'hurt', 'attack', 'death']) {
    assert.match(source, new RegExp(`applyActionState\\(['"]${action}['"]\\)`))
  }
  assert.match(source, /private applyActionState\(action: string\)/)
  assert.match(source, /this\.applyCombatFlags\(visualResetCommands\(this\.visualState\)\)/)
})

test('stage rebuild drains controller-scheduled boss effects after cancelling cleanup callbacks', () => {
  const source = read('assets/Scripts/Game/BattleRuntimeController.ts')

  assert.match(source, /this\.unscheduleAllCallbacks\(\)[\s\S]*this\.bossSkillEffectPool\?\.despawnAll\(\)/)
})

test('defeat panel retries the current stage after a guarded death presentation', () => {
  const runtime = read('assets/Scripts/Game/BattleRuntimeController.ts')
  const panel = read('assets/Scripts/Game/StageClearPanelController.ts')
  const bootstrap = read('assets/Scripts/Game/PortraitBattleBootstrap.ts')

  assert.match(runtime, /markBattleAttemptDefeated/)
  assert.match(runtime, /requestPresentationAction\('death', 'battle-runtime'\)/)
  assert.match(runtime, /showDefeat\(this\.stageNumber\)/)
  assert.match(runtime, /retryCurrentStage\(\)/)
  assert.match(panel, /showDefeat\(stageNumber: number\)/)
  assert.match(panel, /试炼失败/)
  assert.match(panel, /重新挑战/)
  assert.match(panel, /onRetry/)
  assert.match(bootstrap, /onRetry = \(\) => runtime\.retryCurrentStage\(\)/)
  const defeatBody = panel.match(/showDefeat\(stageNumber: number\) \{([\s\S]*?)\n  \}/)?.[1] ?? ''
  assert.doesNotMatch(panel, /location\.reload/)
  assert.doesNotMatch(defeatBody, /scheduleAutoContinue|scheduleOnce/)
})

test('moving player stops before death and retry restores sword ride without a stale target', () => {
  const runtime = read('assets/Scripts/Game/BattleRuntimeController.ts')
  const player = read('assets/Scripts/Game/PlayerController.ts')
  const input = read('assets/Scripts/Game/BattleInputController.ts')
  const bootstrap = read('assets/Scripts/Game/PortraitBattleBootstrap.ts')

  assert.match(player, /public stop\(\)/)
  assert.match(player, /public reset\(\)/)
  assert.match(player, /stopPlayerMotor/)
  assert.match(player, /resetPlayerMotor/)
  const stopBody = player.match(/public stop\(\) \{([\s\S]*?)\n  \}/)?.[1] ?? ''
  assert.doesNotMatch(stopBody, /sword_ride/)
  assert.match(stopBody, /stopPlayerMotor\(this\.motor\)/)
  const resetBody = player.match(/public reset\(\) \{([\s\S]*?)\n  \}/)?.[1] ?? ''
  assert.match(resetBody, /resetPlayerMotor\(this\.motor\)/)
  assert.doesNotMatch(player, /movementBounds|movementEnabled|movementSpawn/)

  const stopIndex = runtime.indexOf('this.freezeBattle()')
  const deathIndex = runtime.indexOf("requestPresentationAction('death', 'battle-runtime')")
  assert.ok(stopIndex >= 0 && deathIndex > stopIndex)
  assert.match(runtime, /private freezeBattle\(\)[\s\S]*getComponent\(PlayerController\)\?\.stop\(\)/)
  assert.match(runtime, /playerController\?\.reset\(\)/)
  assert.match(input, /player\.requestMovementInCoordinateSpace/)
  assert.match(bootstrap, /player\.node\.setPosition\(-210, -80, 0\)[\s\S]*addComponent\(PlayerController\)[\s\S]*configureMovement\(/)
})

test('stage changes clear soul nodes and reject stale pickup callbacks', () => {
  const runtime = read('assets/Scripts/Game/BattleRuntimeController.ts')
  const pool = read('assets/Scripts/Game/NodePoolController.ts')

  assert.match(pool, /despawnAll\(\)/)
  assert.match(runtime, /this\.soulOrbPool\?\.despawnAll\(\)/)
  assert.match(runtime, /const generation = this\.stageGeneration/)
  assert.match(runtime, /isBattleAttemptCallbackCurrent\(this\.attemptState, generation, 'active'\)/)
})

test('all failed visual spawns use the generic runtime rollback', () => {
  const runtime = read('assets/Scripts/Game/BattleRuntimeController.ts')

  assert.match(runtime, /rollbackSpawnedEnemy\(this\.runtime, spawn\.enemy\.id\)/)
  assert.match(runtime, /rollbackSpawnedEnemy\(this\.runtime, result\.enemy\.id\)/)
  assert.doesNotMatch(runtime, /rollbackBossSpawn/)
})

test('battle controller presents player damage only after resolver damage events', () => {
  const controller = read('assets/Scripts/Game/BattleRuntimeController.ts')
  const enemy = read('assets/Scripts/Game/EnemyController.ts')

  assert.match(controller, /createContactDamageGate/)
  assert.match(controller, /for \(const event of drainEnemyCombatDamage\(this\.enemyCombatResolver\)\)/)
  assert.match(controller, /this\.applyResolvedPlayerDamage\(event\.amount\)/)
  assert.match(controller, /private applyResolvedPlayerDamage\(damage: number\)/)
  assert.match(controller, /applyDirectDamage\(this\.damageGate, damage\)/)
  assert.match(controller, /requestPresentationAction\('hurt', 'battle-runtime-hurt'\)/)
  assert.match(controller, /completePresentationAction\(token\)/)
  assert.match(controller, /playerHurtDuration/)
  assert.match(controller, /markPlayerDefeated\(this\.stageFlow\)\.changed/)
  assert.match(controller, /markBattleAttemptDefeated\(this\.attemptState\)/)
  assert.doesNotMatch(controller, /applyPlayerDamage\(|applyContactDamage|enemy-attack-player/)
  assert.doesNotMatch(enemy, /enemy-attack-player|role === 'boss' \? 10 : 3/)
})

test('runtime-created enemies contain sprite animation combat and pool components', () => {
  const source = read('assets/Scripts/Game/PortraitBattleBootstrap.ts')
  const manifest = read('assets/resources/Data/animation-atlas.json')

  for (const marker of [
    "addComponent(Sprite)",
    "addComponent(AtlasAnimator)",
    "addComponent(EnemyController)",
    "addComponent(EnemyVisualController)",
    "addComponent(PoolableActor)",
    "setFactory",
  ]) {
    assert.equal(source.includes(marker), true, `missing ${marker}`)
  }
  assert.match(source, /bindAnimationManifest\(visual, animator, 'move'\)/)
  assert.match(source, /createSpriteNode\('Visual', node, 210, 336\)/)
  assert.match(read('assets/Scripts/Game/EnemySpawner.ts'), /visual\?\.animator\?\.currentFrameSize\(\)/)
  for (const actorId of ['moss-wolf', 'green-wing-moth', 'bamboo-warden']) {
    assert.equal(manifest.includes(`\"id\": \"${actorId}\"`), true, `missing ${actorId}`)
  }
})

test('portrait bootstrap does not special-case the player atlas texture path', () => {
  const source = read('assets/Scripts/Game/PortraitBattleBootstrap.ts')
  assert.doesNotMatch(source, /actor\.atlas\s*=/)
})

test('flying sword uses the transparent v2 asset at a long-sword ratio', () => {
  const source = read('assets/Scripts/Game/PortraitBattleBootstrap.ts')

  assert.match(source, /Assets\/Skills\/FlyingSword\/sword-projectile-v2\/spriteFrame/)
  assert.match(source, /createSpriteNode\('Sword', skillNode, 176, 44\)/)
  assert.doesNotMatch(source, /Assets\/Skills\/FlyingSword\/sword_projectile\/spriteFrame/)
})

test('flying sword visual and damage consume artifact runtime commands from one authority', () => {
  const controller = read('assets/Scripts/Game/BattleRuntimeController.ts')
  const skill = read('assets/Scripts/Game/FlyingSwordSkill.ts')
  const artifact = read('assets/Scripts/Combat/ArtifactRuntime.ts')

  assert.match(skill, /const commands = stepArtifact\(this\.artifact,/)
  assert.match(skill, /case 'move-sword':[\s\S]*this\.applySwordPose\(command\)/)
  assert.match(skill, /case 'resolve-sword-hit':[\s\S]*resolveArtifactSwordHit\(command\.targetId\)/)
  assert.match(controller, /resolveArtifactSwordHit\(targetId: string\)/)
  assert.match(artifact, /resolveHits\(path, targets, from, to, phase\)/)
  assert.doesNotMatch(skill, /timeline\.progress|Math\.sin|Math\.cos/)
})

test('player controller keeps sword ride presentation while movement emits motion transitions', () => {
  const player = read('assets/Scripts/Game/PlayerController.ts')
  assert.match(player, /stepPlayerMotor\(this\.motor, deltaTime\)/)
  assert.match(player, /if \(frame\.distanceMoved > 0\)/)
  assert.match(player, /this\.syncNodePosition\(frame\.position\)/)
  assert.match(player, /if \(frame\.distanceMoved > 0\) \{[\s\S]*this\.setMoving\(true\)/)
  assert.match(player, /if \(frame\.arrived\) this\.setMoving\(false\)/)
  assert.match(player, /setPlayerFallbackAction\(this\.motor, 'sword_ride'\)/)
  assert.doesNotMatch(player, /setPlayerFallbackAction\(this\.motor, moving \? 'move'/)
  assert.doesNotMatch(player, /private target: Vec3/)
})

test('cast hit and death events cannot mutate player movement or create a lunge', () => {
  const player = read('assets/Scripts/Game/PlayerController.ts')
  const skill = read('assets/Scripts/Game/FlyingSwordSkill.ts')
  const runtime = read('assets/Scripts/Game/BattleRuntimeController.ts')

  assert.doesNotMatch(skill, /player(?:Node)?\??\.(?:setWorldPosition|setPosition|moveTo)\(/)
  assert.doesNotMatch(skill, /movementState|requestPlayerMovement/)
  assert.doesNotMatch(runtime, /playerNode\??\.(?:setWorldPosition|setPosition|moveTo)\(/)
  assert.doesNotMatch(skill, /emit\('player-action-requested'[^\n]*\)[\s\S]{0,120}(?:setWorldPosition|moveTo)\(/)
  assert.doesNotMatch(runtime, /emit\('player-action-requested', '(?:hurt|death)'\)[\s\S]{0,120}(?:setWorldPosition|moveTo)\(/)
})

test('sword hover is subtle and always derives from its captured base transform', () => {
  const player = read('assets/Scripts/Game/PlayerController.ts')
  assert.match(player, /this\.swordMountBasePosition\.set\(this\.swordMount\.position\)/)
  assert.match(player, /this\.swordMountBasePosition\.y \+ Math\.sin\(this\.hoverElapsed \* 4\) \* 2/)
  assert.doesNotMatch(player, /swordMount\.position\.y \+ yOffset/)
})

test('flying sword refreshes live artifact targets every frame so dead targets retarget next frame', () => {
  const controller = read('assets/Scripts/Game/BattleRuntimeController.ts')
  const skill = read('assets/Scripts/Game/FlyingSwordSkill.ts')
  const artifact = read('assets/Scripts/Combat/ArtifactRuntime.ts')

  assert.match(controller, /getLivingSwordTargets\(\)[\s\S]*snapshotLivingSwordTargets\(this\.runtime\?\.enemies \?\? \[\]\)/)
  assert.match(skill, /stepArtifact\(this\.artifact,/)
  const updateBody = skill.match(/update\(deltaTime: number\) \{([\s\S]*?)\n  \}/)?.[1] ?? ''
  assert.match(updateBody, /getLivingSwordTargets\(\)/)
  assert.match(updateBody, /stepArtifact\(this\.artifact,/)
  assert.match(artifact, /const targets = livingTargets\(context\)/)
  assert.doesNotMatch(skill, /cachedTargets|activeTarget/)
})

test('each homing phase records geometric hits before damage and rejects repeats', () => {
  const controller = read('assets/Scripts/Game/BattleRuntimeController.ts')

  assert.match(controller, /const newHitIds = new Set\(recordGeometricSwordHits\(state, geometricHits\.map\(\(enemy\) => String\(enemy\.id\)\), phase\)\)/)
  assert.match(controller, /for \(const enemy of geometricHits\)[\s\S]*if \(!newHitIds\.has\(String\(enemy\.id\)\)\) continue/)
  assert.match(controller, /enemies: \[enemy\]/)
  assert.match(controller, /points: \[from, to\]/)
})

test('homing integration filters target snapshots and copies positions', () => {
  assert.equal(typeof swordRuntime.snapshotLivingSwordTargets, 'function')
  const sourcePosition = { x: 4, y: 5 }
  const snapshots = swordRuntime.snapshotLivingSwordTargets([
    { id: 2, position: sourcePosition, alive: true },
    { id: 1, position: { x: 1, y: 1 }, alive: false },
    { id: 3, position: { x: NaN, y: 1 }, alive: true },
  ])

  assert.deepEqual(snapshots, [{ id: '2', position: { x: 4, y: 5 }, alive: true }])
  assert.notEqual(snapshots[0].position, sourcePosition)
})

test('homing integration de-duplicates per phase and lets return hit the outbound target once', () => {
  assert.equal(typeof swordRuntime.recordGeometricSwordHits, 'function')
  const cast = swordRuntime.createHomingSwordCast(
    { x: 0, y: 0 },
    [{ id: 'a', position: { x: 10, y: 0 }, alive: true }],
    homingConfig,
  )

  assert.deepEqual(swordRuntime.recordGeometricSwordHits(cast, ['a'], 'outbound'), ['a'])
  assert.deepEqual(swordRuntime.recordGeometricSwordHits(cast, ['a'], 'outbound'), [])
  assert.deepEqual(swordRuntime.recordGeometricSwordHits(cast, ['a'], 'returning'), ['a'])
  assert.deepEqual(swordRuntime.recordGeometricSwordHits(cast, ['a'], 'returning'), [])
})

test('homing integration retargets dead targets and shares one swept segment object', () => {
  assert.equal(typeof swordRuntime.stepHomingSwordCast, 'function')
  const cast = swordRuntime.createHomingSwordCast(
    { x: 0, y: 0 },
    [{ id: 'a', position: { x: 5, y: 0 }, alive: true }],
    homingConfig,
  )
  const frame = swordRuntime.stepHomingSwordCast(cast, 0.1, [
    { id: 'a', position: { x: 5, y: 0 }, alive: false },
    { id: 'b', position: { x: 8, y: 0 }, alive: true },
  ], { x: 0, y: 0 })

  assert.equal(frame.step.previousTargetId, 'a')
  assert.equal(frame.step.nextTargetId, 'b')
  assert.strictEqual(frame.presentationSegment, frame.damageSegment)
  assert.strictEqual(frame.segment.from, frame.step.previousPosition)
  assert.strictEqual(frame.segment.to, frame.step.nextPosition)
})

test('homing integration reset clears active casts for frozen and disable lifecycle paths', () => {
  assert.equal(typeof swordRuntime.resetHomingSwordCast, 'function')
  const frozenCast = swordRuntime.createHomingSwordCast({ x: 0, y: 0 }, [], homingConfig)
  const disabledCast = swordRuntime.createHomingSwordCast({ x: 0, y: 0 }, [], homingConfig)

  assert.equal(swordRuntime.resetHomingSwordCast(frozenCast), null)
  assert.equal(swordRuntime.resetHomingSwordCast(disabledCast), null)
})

test('automatic flying sword keeps a forgiving hit corridor for moving enemies', () => {
  const controller = read('assets/Scripts/Game/BattleRuntimeController.ts')
  assert.match(controller, /@property swordHitWidth = 72/)
})

test('soul orbs magnet to the player and publish pickup amount before recycling', () => {
  const source = read('assets/Scripts/Game/SoulOrbController.ts')

  assert.match(source, /follow\(target: Node, amount = 1\)/)
  assert.match(source, /emit\('soul-orb-picked', this\.amount\)/)
  assert.match(source, /Math\.min\(distance, this\.magnetSpeed \* deltaTime\)/)
})

test('stage clear panel is compact, click-driven, auto-continues clear, and has one-line rewards', () => {
  const source = read('assets/Scripts/Game/StageClearPanelController.ts')
  const bootstrap = read('assets/Scripts/Game/PortraitBattleBootstrap.ts')

  assert.match(source, /rewardLabel\.string = \[/)
  assert.match(source, /\.join\('   '\)/)
  assert.match(source, /nextStageButton\?\.node\.on\(Button\.EventType\.CLICK/)
  assert.match(source, /@property\s+autoContinueSeconds = 3/)
  assert.match(source, /private scheduleAutoContinue\(\)/)
  assert.match(source, /this\.scheduleOnce\(this\.handleAutoContinue, this\.autoContinueSeconds\)/)
  assert.match(source, /this\.unschedule\(this\.handleAutoContinue\)/)
  assert.match(source, /this\.scheduleAutoContinue\(\)/)
  assert.match(source, /private handleAutoContinue\(\)[\s\S]*this\.handleContinue\(\)/)
  assert.match(source, /private handleContinue\(\)[\s\S]*this\.unschedule\(this\.handleAutoContinue\)/)
  assert.match(bootstrap, /createNode\('StageClearPanel', parent, 472, 214\)/)
  assert.doesNotMatch(bootstrap, /createNode\('StageClearPanel', parent, 520, 258\)/)
})
