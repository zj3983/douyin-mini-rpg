import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

test('scene blueprint describes the serialized host and actual runtime roots', () => {
  const blueprint = JSON.parse(readFileSync(resolve('assets/Data/scene-blueprint.json'), 'utf8'))
  const nodes = new Map(blueprint.nodes.map((node) => [node.path, node]))

  assert.equal(blueprint.scene.name, 'MainBattle')
  assert.deepEqual(nodes.get('Scene/BattleRoot').components, ['PortraitBattleBootstrap'])
  assert.deepEqual(nodes.get('Canvas').children, ['UICamera', 'SharedCombatRoot', 'WorldRoot', 'DungeonRoot', 'DualModeGameController'])
  assert.deepEqual(nodes.get('Canvas/SharedCombatRoot/SharedActorLayer/EnemySpawner').bindings, {
    enemyPool: 'Canvas/SharedCombatRoot/SharedActorLayer/EnemyPool',
  })
  assert.deepEqual(nodes.get('Canvas/SharedCombatRoot/Runtime').bindings, {
    designData: 'resources/Data/cultivation-design.json',
    enemySpawner: 'Canvas/SharedCombatRoot/SharedActorLayer/EnemySpawner',
    soulOrbPool: 'Canvas/SharedCombatRoot/SharedDropLayer/SoulOrbPool',
    damageNumberPool: 'Canvas/SharedCombatRoot/SharedEffectLayer/DamageNumberPool',
    bossSkillEffectPool: 'Canvas/SharedCombatRoot/SharedEffectLayer/BossEffectPool',
    playerNode: 'Canvas/SharedCombatRoot/SharedActorLayer/Player',
    hud: 'Canvas/WorldRoot/WorldHudLayer',
    stageClearPanel: 'Canvas/WorldRoot/WorldHudLayer/StageClearPanel',
    dualMode: 'Canvas/DualModeGameController',
  })

  const paths = new Set(blueprint.nodes.map((node) => node.path))
  assert.equal([...paths].some((path) => path.startsWith('Canvas/Pools')), false)
  assert.equal(paths.has('Canvas/DungeonRoot/DungeonHud'), true)
  assert.deepEqual(nodes.get('Canvas/WorldRoot/WorldHudLayer/StageClearPanel').components, ['UITransform', 'Graphics', 'StageClearPanelController'])
  assert.equal(JSON.stringify(blueprint).includes('StageClearPanelController'), true)
  assert.equal(JSON.stringify(blueprint).includes('NodePoolController'), true)
})

test('scene blueprint defines the approved portrait runtime hierarchy', () => {
  const blueprint = JSON.parse(readFileSync(resolve('assets/Data/scene-blueprint.json'), 'utf8'))
  const nodes = new Map(blueprint.nodes.map((node) => [node.path, node]))

  assert.equal(blueprint.scene.orientation, 'portrait')
  assert.deepEqual(blueprint.scene.designResolution, { width: 750, height: 1334 })
  assert.equal(blueprint.scene.runtimeHeight, 'computeBattleLayout(...).visibleHeight')
  assert.equal(blueprint.scene.layout.authority, 'BattleLayout.computeBattleLayout')
  assert.equal(blueprint.scene.layout.horizontalMovement, 'movement.minX <= -300 and movement.maxX >= 300 at 390x844')
  assert.equal(blueprint.scene.layout.safeInsets, 'CSS pixels converted by designWidth / cssWidth')
  assert.equal(blueprint.scene.layout.navigation, 'navigationTop < movement.minY')

  for (const path of [
    'Canvas',
    'Canvas/SharedCombatRoot',
    'Canvas/WorldRoot',
    'Canvas/DungeonRoot',
    'Canvas/WorldRoot/WorldLayer/FarBackground',
    'Canvas/WorldRoot/WorldLayer/MidBackground',
    'Canvas/SharedCombatRoot/SharedActorLayer/Player',
    'Canvas/SharedCombatRoot/SharedActorLayer/EnemySpawner',
    'Canvas/SharedCombatRoot/SharedActorLayer/EnemyPool',
    'Canvas/SharedCombatRoot/SharedEffectLayer/FlyingSwordSkill/Sword',
    'Canvas/SharedCombatRoot/SharedDropLayer',
    'Canvas/SharedCombatRoot/SharedDropLayer/SoulOrbPool',
    'Canvas/SharedCombatRoot/SharedInputLayer',
    'Canvas/WorldRoot/WorldHudLayer/TopHud',
    'Canvas/WorldRoot/WorldHudLayer/BossHud',
    'Canvas/WorldRoot/WorldHudLayer/BottomNavigation',
    'Canvas/WorldRoot/WorldHudLayer/StageClearPanel',
    'Canvas/DungeonRoot/DungeonWorldLayer',
    'Canvas/DungeonRoot/DungeonHud',
  ]) {
    assert.equal(nodes.has(path), true, `missing portrait node: ${path}`)
  }

  const inputLayer = nodes.get('Canvas/SharedCombatRoot/SharedInputLayer')
  assert.equal(inputLayer.bounds, 'layout.movement')
  assert.equal(inputLayer.excludes, 'BottomNavigation and bottom safe inset')
  assert.equal(nodes.get('Canvas/WorldRoot/WorldHudLayer/TopHud').positionY, 'layout-safe top HUD position')
  assert.equal(nodes.get('Canvas/WorldRoot/WorldHudLayer/BottomNavigation').positionY, 'layout.navigationTop - 52')
  assert.deepEqual(nodes.get('Canvas/SharedCombatRoot/SharedActorLayer/EnemySpawner').futureBossLayout, {
    spawn: 'layout.bossSpawn',
    maxVisualBounds: 'layout.bossMaxVisualBounds',
  })
})

test('scene blueprint declares portrait bootstrap component bindings', () => {
  const blueprint = JSON.parse(readFileSync(resolve('assets/Data/scene-blueprint.json'), 'utf8'))
  const componentNames = new Set(blueprint.nodes.flatMap((node) => node.components ?? []))

  for (const component of [
    'PortraitBattleBootstrap',
    'BattleInputController',
    'PlayerController',
    'BattleRuntimeController',
    'FlyingSwordSkill',
    'BattleHudController',
    'NodePoolController',
    'StageClearPanelController',
    'DungeonRunController',
    'DungeonRunPresenter',
    'DungeonResourceController',
    'DualModeGameController',
  ]) {
    assert.equal(componentNames.has(component), true, `missing portrait component: ${component}`)
  }
})

test('scene blueprint keeps dungeon profile data on DungeonRunController', () => {
  const blueprint = JSON.parse(readFileSync(resolve('assets/Data/scene-blueprint.json'), 'utf8'))
  const nodes = new Map(blueprint.nodes.map((node) => [node.path, node]))

  assert.deepEqual(nodes.get('Canvas/DualModeGameController').bindings, {
    worldRoot: 'Canvas/WorldRoot',
    dungeonRoot: 'Canvas/DungeonRoot',
    dungeonRun: 'Canvas/DungeonRoot/DungeonRunController',
  })
  assert.deepEqual(nodes.get('Canvas/DungeonRoot/DungeonRunController').bindings, {
    profileData: 'resources/Data/dual-mode-slice.json',
    presenter: 'Canvas/DungeonRoot',
    battleRuntime: 'Canvas/SharedCombatRoot/Runtime',
  })
})
