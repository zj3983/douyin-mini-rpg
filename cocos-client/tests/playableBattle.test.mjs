import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as swordRuntime from '../tools/homing-sword-runtime.mjs'

const read = (path) => readFileSync(resolve(path), 'utf8')

const homingConfig = { speed: 10, maxTurnRadians: Math.PI, maxOutboundDistance: 20, returnRadius: 1 }

test('runtime node pool supports a bounded factory-backed pool', () => {
  const source = read('assets/Scripts/Game/NodePoolController.ts')

  assert.match(source, /setFactory\(factory:/)
  assert.match(source, /private factory:/)
  assert.match(source, /this\.factory\?\.\(result\.id\)/)
  assert.match(source, /capacity = 18/)
  assert.match(source, /hasAvailableSlot\(\)/)
  assert.match(source, /poolStats\(this\.state\)\.active < this\.capacity/)
})

test('enemy spawner binds runtime profiles and separates ground, flying, and boss lanes', () => {
  const source = read('assets/Scripts/Game/EnemySpawner.ts')

  assert.match(source, /bindEnemy\(enemy: BattleEnemy\)/)
  assert.match(source, /profile\.role === 'flying'/)
  assert.match(source, /profile\.role === 'boss'/)
  assert.match(source, /enemy\.position = \{ x: spawnX, y: spawnY \}/)
  assert.match(source, /controller\.bindRuntimeEnemy\(enemy\)/)
})

test('enemy movement continuously synchronizes the combat runtime position', () => {
  const source = read('assets/Scripts/Game/EnemyController.ts')

  assert.match(source, /private runtimeEnemy: BattleEnemy \| null/)
  assert.match(source, /bindRuntimeEnemy\(enemy: BattleEnemy\)/)
  assert.match(source, /this\.runtimeEnemy\.position = \{ x: local\.x, y: local\.y \}/)
  assert.match(source, /setTargetNode\(targetNode: Node, lockY:/)
  assert.match(source, /this\.targetNode\?\.worldPosition/)
})

test('battle controller drives enemy contact damage, stage flow, drops, HUD, and manual clear', () => {
  const source = read('assets/Scripts/Game/BattleRuntimeController.ts')

  for (const marker of [
    "'enemy-attack-player'",
    "'enemy-boss-skill'",
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

test('boss spawn and settlement are commanded once with delayed generation guards', () => {
  const source = read('assets/Scripts/Game/BattleRuntimeController.ts')

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
  assert.match(enemy, /this\.cooldownLeft = 0/)
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
  assert.match(source, /acceptAnimationLoad\(/)
  assert.match(source, /this\.frameIndex = 0/)
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
  assert.match(runtime, /emit\('player-action-requested', 'death'\)/)
  assert.match(runtime, /showDefeat\(this\.stageNumber\)/)
  assert.match(runtime, /retryCurrentStage\(\)/)
  assert.match(panel, /showDefeat\(stageNumber: number\)/)
  assert.match(panel, /试炼失败/)
  assert.match(panel, /重新挑战/)
  assert.match(panel, /onRetry/)
  assert.match(bootstrap, /onRetry = \(\) => runtime\.retryCurrentStage\(\)/)
  assert.doesNotMatch(panel, /location\.reload|scheduleOnce/)
})

test('moving player stops before death and retry restores sword ride without a stale target', () => {
  const runtime = read('assets/Scripts/Game/BattleRuntimeController.ts')
  const player = read('assets/Scripts/Game/PlayerController.ts')
  const input = read('assets/Scripts/Game/BattleInputController.ts')
  const bootstrap = read('assets/Scripts/Game/PortraitBattleBootstrap.ts')

  assert.match(player, /public stop\(\)/)
  assert.match(player, /public reset\(\)/)
  assert.match(player, /stopPlayerMovement/)
  assert.match(player, /resetPlayerMovement/)
  const stopBody = player.match(/public stop\(\) \{([\s\S]*?)\n  \}/)?.[1] ?? ''
  assert.doesNotMatch(stopBody, /sword_ride/)
  assert.match(stopBody, /this\.target = null/)
  const resetBody = player.match(/public reset\(\) \{([\s\S]*?)\n  \}/)?.[1] ?? ''
  assert.match(resetBody, /this\.target = null/)

  const stopIndex = runtime.indexOf('playerController?.stop()')
  const deathIndex = runtime.indexOf("emit('player-action-requested', 'death')")
  assert.ok(stopIndex >= 0 && deathIndex > stopIndex)
  assert.match(runtime, /playerController\?\.reset\(\)/)
  assert.match(input, /player\.moveTo\(worldTarget\)/)
  assert.match(bootstrap, /player\.node\.setPosition\(-210, -80, 0\)[\s\S]*addComponent\(PlayerController\)/)
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

test('battle controller uses a real contact damage gate and zero-health defeat state', () => {
  const controller = read('assets/Scripts/Game/BattleRuntimeController.ts')
  const enemy = read('assets/Scripts/Game/EnemyController.ts')

  assert.match(controller, /createContactDamageGate/)
  assert.match(controller, /tickContactDamageGate\(this\.damageGate, deltaTime\)/)
  assert.match(controller, /applyContactDamage\(this\.damageGate, damage\)/)
  assert.match(controller, /applyDirectDamage\(this\.damageGate, damage\)/)
  assert.match(controller, /markPlayerDefeated\(this\.stageFlow\)\.changed/)
  assert.match(controller, /markBattleAttemptDefeated\(this\.attemptState\)/)
  assert.match(enemy, /role === 'boss' \? 10 : 3/)
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

test('flying sword visual and damage consume the same per-frame swept segment', () => {
  const controller = read('assets/Scripts/Game/BattleRuntimeController.ts')
  const skill = read('assets/Scripts/Game/FlyingSwordSkill.ts')

  assert.match(skill, /const frame = stepHomingSwordCast\(/)
  assert.match(skill, /applySwordPose\(frame\.presentationSegment\)/)
  assert.match(skill, /resolveHomingSwordSegment\(this\.homingState, frame\.damageSegment, frame\.step\.previousPhase\)/)
  assert.match(controller, /points: \[from, to\]/)
  assert.doesNotMatch(skill, /timeline\.progress|Math\.sin|Math\.cos/)
})

test('flying sword refreshes live targets every frame so dead targets retarget next frame', () => {
  const controller = read('assets/Scripts/Game/BattleRuntimeController.ts')
  const skill = read('assets/Scripts/Game/FlyingSwordSkill.ts')

  assert.match(controller, /getLivingSwordTargets\(\)[\s\S]*snapshotLivingSwordTargets\(this\.runtime\?\.enemies \?\? \[\]\)/)
  assert.match(skill, /updateHomingSword\(deltaTime\)/)
  const updateBody = skill.match(/private updateHomingSword\(deltaTime: number\) \{([\s\S]*?)\n  \}/)?.[1] ?? ''
  assert.match(updateBody, /getLivingSwordTargets\(\)/)
  assert.match(updateBody, /stepHomingSwordCast\(this\.homingState, deltaTime, targets,/)
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

test('stage clear panel is compact, click-driven, and has one-line rewards', () => {
  const source = read('assets/Scripts/Game/StageClearPanelController.ts')

  assert.match(source, /rewardLabel\.string = \[/)
  assert.match(source, /\.join\('   '\)/)
  assert.match(source, /nextStageButton\?\.node\.on\(Button\.EventType\.CLICK/)
  assert.doesNotMatch(source, /scheduleOnce/)
})
