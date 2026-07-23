import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

test('scene blueprint describes the serialized host and actual runtime roots', () => {
  const blueprint = JSON.parse(readFileSync(resolve('assets/Data/scene-blueprint.json'), 'utf8'))
  const nodes = new Map(blueprint.nodes.map((node) => [node.path, node]))

  assert.equal(blueprint.scene.name, 'MainBattle')
  assert.deepEqual(nodes.get('Scene/BattleRoot').components, ['PortraitBattleBootstrap'])
  assert.deepEqual(nodes.get('Canvas').children, ['UICamera', 'BattleRoot'])
  assert.deepEqual(nodes.get('Canvas/BattleRoot/ActorLayer/EnemySpawner').bindings, {
    enemyPool: 'Canvas/BattleRoot/ActorLayer/EnemyPool',
  })
  assert.deepEqual(nodes.get('Canvas/BattleRoot/Runtime').bindings, {
    designData: 'resources/Data/cultivation-design.json',
    enemySpawner: 'Canvas/BattleRoot/ActorLayer/EnemySpawner',
    soulOrbPool: 'Canvas/BattleRoot/DropLayer/SoulOrbPool',
    damageNumberPool: 'Canvas/BattleRoot/EffectLayer/DamageNumberPool',
    bossSkillEffectPool: 'Canvas/BattleRoot/EffectLayer/BossEffectPool',
    playerNode: 'Canvas/BattleRoot/ActorLayer/Player',
    hud: 'Canvas/BattleRoot/HudLayer',
    stageClearPanel: 'Canvas/BattleRoot/HudLayer/StageClearPanel',
  })

  const paths = new Set(blueprint.nodes.map((node) => node.path))
  assert.equal([...paths].some((path) => path.startsWith('Canvas/Pools')), false)
  assert.equal([...paths].some((path) => path.includes('StatusLabel')), false)
  assert.deepEqual(nodes.get('Canvas/BattleRoot/HudLayer/StageClearPanel').components, ['UITransform', 'Graphics', 'StageClearPanelController'])
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
    'Canvas/BattleRoot',
    'Canvas/BattleRoot/WorldLayer/FarBackground',
    'Canvas/BattleRoot/WorldLayer/MidBackground',
    'Canvas/BattleRoot/ActorLayer/Player',
    'Canvas/BattleRoot/ActorLayer/EnemySpawner',
    'Canvas/BattleRoot/ActorLayer/EnemyPool',
    'Canvas/BattleRoot/EffectLayer/FlyingSwordSkill/Sword',
    'Canvas/BattleRoot/DropLayer',
    'Canvas/BattleRoot/DropLayer/SoulOrbPool',
    'Canvas/BattleRoot/InputLayer',
    'Canvas/BattleRoot/HudLayer/TopHud',
    'Canvas/BattleRoot/HudLayer/BossHud',
    'Canvas/BattleRoot/HudLayer/BottomNavigation',
    'Canvas/BattleRoot/HudLayer/StageClearPanel',
  ]) {
    assert.equal(nodes.has(path), true, `missing portrait node: ${path}`)
  }

  const inputLayer = nodes.get('Canvas/BattleRoot/InputLayer')
  assert.equal(inputLayer.bounds, 'layout.movement')
  assert.equal(inputLayer.excludes, 'BottomNavigation and bottom safe inset')
  assert.equal(nodes.get('Canvas/BattleRoot/HudLayer/TopHud').positionY, 'layout-safe top HUD position')
  assert.equal(nodes.get('Canvas/BattleRoot/HudLayer/BottomNavigation').positionY, 'layout.navigationTop - 52')
  assert.deepEqual(nodes.get('Canvas/BattleRoot/ActorLayer/EnemySpawner').futureBossLayout, {
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
  ]) {
    assert.equal(componentNames.has(component), true, `missing portrait component: ${component}`)
  }
})
