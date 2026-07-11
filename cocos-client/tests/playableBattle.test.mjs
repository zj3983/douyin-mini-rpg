import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path) => readFileSync(resolve(path), 'utf8')

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
  assert.match(source, /this\.unscheduleAllCallbacks\(\)/)
  assert.match(source, /rollbackSpawnedEnemy\(this\.runtime, result\.enemy\.id\)/)
  assert.match(source, /bossDeathSettleDelay/)
  assert.match(source, /scheduleBossSettlement/)
  assert.match(source, /completeBossSettlement/)
  assert.match(source, /Math\.max\(this\.deathRecycleDelay, this\.bossDeathSettleDelay\)/)
  assert.doesNotMatch(source, /if \(result\.stageClear\) this\.finishStage\(\)/)
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
  assert.match(source, /animator\.actorId = profile\.id/)
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

test('flying sword hit geometry follows a bounded arc instead of a flat line', () => {
  const controller = read('assets/Scripts/Game/BattleRuntimeController.ts')
  const runtime = read('assets/Scripts/Core/BattleRuntime.ts')

  assert.match(controller, /arcHeight/)
  assert.match(controller, /buildArcPath/)
  assert.match(controller, /applyFlyingSwordPathHit/)
  assert.match(runtime, /export function segmentHitEnemiesAlongPath/)
  assert.match(runtime, /const seen = new Set<number>\(\)/)
})

test('one captured player-relative path drives both sword visuals and hit passes', () => {
  const controller = read('assets/Scripts/Game/BattleRuntimeController.ts')
  const skill = read('assets/Scripts/Game/FlyingSwordSkill.ts')

  assert.match(controller, /createFlyingSwordPath\(\)/)
  assert.match(controller, /target\?\.position \?\? null/)
  assert.match(controller, /createPlayerSwordPath\(/)
  assert.match(skill, /private activePath:/)
  assert.match(skill, /this\.activePath = this\.battleRuntime\?\.createFlyingSwordPath\(\)/)
  assert.match(skill, /castFlyingSwordPass\(path\.from, path\.to\)/)
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
