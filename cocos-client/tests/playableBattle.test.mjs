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

test('battle controller drives enemy contact damage, boss gate, drops, HUD, and manual clear', () => {
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
  assert.match(source, /if \(this\.enemySpawner\?\.canSpawn\(\) !== false\)/)
  assert.match(source, /isBattleFrozen\(\)/)
  assert.match(source, /if \(this\.enemyNodes\.get\(enemyId\) !== enemyNode\) return/)
})

test('boss spawn and settlement honor live enemies, pool rollback, and delayed generation guards', () => {
  const source = read('assets/Scripts/Game/BattleRuntimeController.ts')

  assert.match(source, /canSummonWorldBoss\(stats, this\.pendingEnemyRecycles\)/)
  assert.match(source, /rollbackBossSpawn\(this\.runtime, result\.enemy\.id\)/)
  assert.match(source, /bossDeathSettleDelay/)
  assert.match(source, /scheduleBossSettlement/)
  assert.match(source, /completeBossSettlement/)
  assert.match(source, /Math\.max\(this\.deathRecycleDelay, this\.bossDeathSettleDelay\)/)
  assert.doesNotMatch(source, /if \(result\.stageClear\) this\.finishStage\(\)/)
})

test('battle controller uses a real contact damage gate and zero-health defeat state', () => {
  const controller = read('assets/Scripts/Game/BattleRuntimeController.ts')
  const enemy = read('assets/Scripts/Game/EnemyController.ts')

  assert.match(controller, /createContactDamageGate/)
  assert.match(controller, /tickContactDamageGate\(this\.damageGate, deltaTime\)/)
  assert.match(controller, /applyContactDamage\(this\.damageGate, damage\)/)
  assert.match(controller, /applyDirectDamage\(this\.damageGate, damage\)/)
  assert.match(controller, /if \(this\.damageGate\.health <= 0\)/)
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
  assert.match(controller, /createPlayerSwordPath\(\{ x: playerPosition\.x, y: playerPosition\.y \}\)/)
  assert.match(skill, /private activePath:/)
  assert.match(skill, /this\.activePath = this\.battleRuntime\?\.createFlyingSwordPath\(\)/)
  assert.match(skill, /castFlyingSwordPass\(path\.from, path\.to\)/)
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
