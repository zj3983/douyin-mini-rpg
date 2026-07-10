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
  assert.equal(blueprint.scene.runtimeHeight, 'view.getVisibleSize().height')

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
