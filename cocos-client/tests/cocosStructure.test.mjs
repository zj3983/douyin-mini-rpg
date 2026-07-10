import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const requiredComponents = [
  ['assets/Scripts/Game/StageDirector.ts', 'class StageDirector'],
  ['assets/Scripts/Game/EnemyController.ts', 'class EnemyController'],
  ['assets/Scripts/Game/DungeonRunController.ts', 'class DungeonRunController'],
  ['assets/Scripts/Game/SoulOrbController.ts', 'class SoulOrbController'],
  ['assets/Scripts/Game/AssetBindingController.ts', 'class AssetBindingController'],
  ['assets/Scripts/Game/StripAnimator.ts', 'class StripAnimator'],
  ['assets/Scripts/Game/ActorAnimationBinder.ts', 'class ActorAnimationBinder'],
  ['assets/Scripts/Game/AtlasAnimator.ts', 'class AtlasAnimator'],
  ['assets/Scripts/Game/NodePoolController.ts', 'class NodePoolController'],
  ['assets/Scripts/Game/PoolableActor.ts', 'class PoolableActor'],
  ['assets/Scripts/Game/EnemySpawner.ts', 'class EnemySpawner'],
  ['assets/Scripts/Game/EnemyVisualController.ts', 'class EnemyVisualController'],
  ['assets/Scripts/Game/BattleRuntimeController.ts', 'class BattleRuntimeController'],
  ['assets/Scripts/Game/DamageNumberController.ts', 'class DamageNumberController'],
  ['assets/Scripts/Game/StageClearPanelController.ts', 'class StageClearPanelController'],
]

function readSource(file) {
  const path = resolve(file)
  return existsSync(path) ? readFileSync(path, 'utf8') : ''
}

test('Cocos game layer has dedicated battle-loop components', () => {
  for (const [file, marker] of requiredComponents) {
    const source = readFileSync(resolve(file), 'utf8')
    assert.equal(source.includes(marker), true, `${file} should define ${marker}`)
  }
})

test('battle runtime controller exposes boss stage hooks', () => {
  const source = readFileSync(resolve('assets/Scripts/Game/BattleRuntimeController.ts'), 'utf8')

  assert.equal(source.includes('enemySpawner'), true)
  assert.equal(source.includes('enemyNodes'), true)
  assert.equal(source.includes('registerEnemyNode'), true)
  assert.equal(source.includes('enemy-hit'), true)
  assert.equal(source.includes('enemy-defeated'), true)
  assert.equal(source.includes('despawnEnemy'), true)
  assert.equal(source.includes('this.enemySpawner?.spawnEnemy(result.enemy)'), true)
  assert.equal(source.includes('update(deltaTime'), true)
  assert.equal(source.includes('summonWorldBoss'), true)
  assert.equal(source.includes('tickBossSkill'), true)
  assert.equal(source.includes('claimStageClear'), true)
  assert.equal(source.includes('bossSkillEffectPool'), true)
  assert.equal(source.includes('stageClearPanel'), true)
  assert.equal(source.includes('showResult'), true)
  assert.equal(source.includes('advanceToStage'), true)
  assert.equal(source.includes('advanceToNextStageFromPanel'), true)
})

test('enemy spawner only maps runtime spawns to pooled nodes', () => {
  const source = readFileSync(resolve('assets/Scripts/Game/EnemySpawner.ts'), 'utf8')

  assert.equal(source.includes('spawnEnemy'), true)
  assert.equal(source.includes('despawnEnemy'), true)
  assert.equal(source.includes('bossSpawnX'), true)
  assert.equal(source.includes('bossY'), true)
  assert.equal(source.includes('bossScale'), true)
  assert.equal(source.includes('nextSpawn'), false)
  assert.equal(source.includes('createBattleRuntime'), false)
})

test('enemy visual controller reacts to hit and defeat events', () => {
  const source = readFileSync(resolve('assets/Scripts/Game/EnemyVisualController.ts'), 'utf8')

  assert.equal(source.includes('enemy-hit'), true)
  assert.equal(source.includes('enemy-defeated'), true)
  assert.equal(source.includes("play('hurt')"), true)
  assert.equal(source.includes("play('death')"), true)
  assert.equal(source.includes('enemy-visual-hit'), true)
  assert.equal(source.includes('enemy-visual-death'), true)
})

test('portrait battle input clamps touch-end coordinates before moving the player', () => {
  const source = readSource('assets/Scripts/Game/BattleInputController.ts')

  assert.match(source, /import\s*{[^}]*EventTouch[^}]*UITransform[^}]*}\s*from\s*'cc'/s)
  assert.match(source, /import\s*{[^}]*clampBattleTarget[^}]*}\s*from\s*'\.\.\/Core\/MovementRuntime'/s)
  assert.match(source, /Node\.EventType\.TOUCH_END/)
  assert.match(source, /\.on\(Node\.EventType\.TOUCH_END/)
  assert.match(source, /\.off\(Node\.EventType\.TOUCH_END/)
  assert.match(source, /getUILocation\(\)/)
  assert.match(source, /convertToNodeSpaceAR\(new Vec3\(/)
  assert.match(source, /clampBattleTarget\(/)
  assert.match(source, /convertToWorldSpaceAR\(new Vec3\(clamped\.x, clamped\.y, 0\)\)/)
  assert.match(source, /player\.moveTo\(worldTarget\)/)

  const localIndex = source.indexOf('convertToNodeSpaceAR')
  const clampIndex = source.indexOf('clampBattleTarget(local')
  const worldIndex = source.indexOf('convertToWorldSpaceAR')
  const moveIndex = source.indexOf('player.moveTo(worldTarget)')
  assert.ok(localIndex < clampIndex && clampIndex < worldIndex && worldIndex < moveIndex)
})

test('portrait battle input rebinds the actual subscribed node without duplicates', () => {
  const source = readSource('assets/Scripts/Game/BattleInputController.ts')

  assert.match(source, /private subscribedNode:\s*Node\s*\|\s*null\s*=\s*null/)
  assert.match(source, /public bindInputArea\(inputArea:\s*UITransform\s*\|\s*null\)/)
  assert.match(source, /this\.unsubscribeInputNode\(\)[\s\S]*this\.inputArea = inputArea/)
  assert.match(source, /if \(this\.inputEnabled\) this\.subscribeInputNode\(\)/)
  assert.match(source, /if \(!node \|\| this\.subscribedNode === node\) return/)
  assert.match(source, /this\.subscribedNode\.off\(Node\.EventType\.TOUCH_END/)
  assert.match(source, /this\.subscribedNode = null/)
})

test('player movement uses fixed-speed runtime steps and emits motion transitions', () => {
  const source = readSource('assets/Scripts/Game/PlayerController.ts')

  assert.match(source, /import\s*{[^}]*stepTowardTarget[^}]*}\s*from\s*'\.\.\/Core\/MovementRuntime'/s)
  assert.match(source, /stepTowardTarget\(/)
  assert.doesNotMatch(source, /Date\.now/)
  assert.doesNotMatch(source, /Vec3\.lerp/)
  assert.match(source, /hoverElapsed\s*\+=\s*deltaTime/)
  assert.match(source, /emit\('player-motion-changed', moving\)/)
  assert.match(source, /emit\('player-action-requested', 'sword_ride'\)/)
})

test('flying sword delegates timing and keeps combat independent from sword visuals', () => {
  const source = readSource('assets/Scripts/Game/FlyingSwordSkill.ts')
  const runtimeSource = readSource('assets/Scripts/Core/FlyingSwordRuntime.ts')

  assert.match(source, /from '\.\.\/Core\/FlyingSwordRuntime'/)
  assert.match(source, /createFlyingSwordTimeline\(/)
  assert.match(source, /advanceFlyingSwordTimeline\(/)
  assert.match(source, /resetFlyingSwordTimeline\(/)
  assert.match(source, /handSealDuration/)
  assert.match(source, /'outbound'/)
  assert.match(source, /'returning'/)
  assert.equal((source.match(/castFlyingSwordPass\(/g) ?? []).length, 1)
  assert.match(source, /if \(!this\.battleRuntime\) return/)
  assert.doesNotMatch(source, /this\.battleRuntime && this\.sword/)
  assert.match(source, /emit\('sword-cast-started',\s*{ phase: 'handSeal' }\)/)
  assert.match(source, /emit\('sword-pass-resolved',\s*{ phase: event\.phase, result }\)/)
  assert.match(source, /onDisable\(\)[\s\S]*resetFlyingSwordTimeline/)
  assert.match(source, /onDisable\(\)[\s\S]*this\.sword\.active = false/)
  assert.match(source, /setRotationFromEuler\(/)
  assert.match(runtimeSource, /FlyingSwordTimelineState = 'idle' \| 'handSeal' \| 'outbound' \| 'returning'/)
  assert.doesNotMatch(runtimeSource, /state(?:\s*===|:)\s*'cooldown'/)
})

test('battle runtime exposes path-aware sword passes and the legacy cast wrapper', () => {
  const source = readSource('assets/Scripts/Game/BattleRuntimeController.ts')

  assert.match(source, /private resolveFlyingSwordHit\(from:\s*Vec3,\s*to:\s*Vec3,\s*pierce:\s*number\)/)
  assert.match(source, /public castFlyingSwordPass\(from:\s*Vec3,\s*to:\s*Vec3\)/)
  assert.match(source, /return this\.resolveFlyingSwordHit\(from, to, 6\)/)
  assert.match(source, /public castFlyingSword\(\)/)
  assert.match(source, /return this\.resolveFlyingSwordHit\(from, to, 3\)/)
  assert.match(source, /applyFlyingSwordHit\(this\.runtime,\s*pierce,\s*1,/s)
})

test('stage clear panel renders reward fields and next stage action', () => {
  const source = readFileSync(resolve('assets/Scripts/Game/StageClearPanelController.ts'), 'utf8')

  assert.equal(source.includes('titleLabel'), true)
  assert.equal(source.includes('rewardLabel'), true)
  assert.equal(source.includes('nextStageButton'), true)
  assert.equal(source.includes('nextStageTarget'), true)
  assert.equal(source.includes('spiritStones'), true)
  assert.equal(source.includes('artifactEssence'), true)
  assert.equal(source.includes('dungeonPass'), true)
})
