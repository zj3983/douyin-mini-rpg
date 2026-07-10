import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { validateSceneBlueprint } from '../tools/validate-scene-blueprint.mjs'

test('scene blueprint defines battle root, pools, hud, and required bindings', () => {
  const blueprint = JSON.parse(readFileSync(resolve('assets/Data/scene-blueprint.json'), 'utf8'))
  const report = validateSceneBlueprint(blueprint)

  assert.equal(report.ok, true, report.errors.join('\n'))
  assert.equal(blueprint.scene.name, 'MainBattle')
  assert.equal(blueprint.nodes.some((node) => node.path === 'Canvas/BattleRoot/Runtime'), true)
  assert.equal(blueprint.nodes.some((node) => node.path === 'Canvas/Pools/SoulOrbPool'), true)
  assert.equal(blueprint.nodes.some((node) => node.path === 'Canvas/BattleRoot/HudLayer/StageClearPanel'), true)
  const enemyPrefab = blueprint.prefabs.find((prefab) => prefab.path === 'prefabs/Enemy.prefab')
  assert.equal(enemyPrefab.components.includes('EnemyVisualController'), true)
})

test('scene blueprint defines the approved portrait runtime hierarchy', () => {
  const blueprint = JSON.parse(readFileSync(resolve('assets/Data/scene-blueprint.json'), 'utf8'))
  const nodes = new Map(blueprint.nodes.map((node) => [node.path, node]))

  assert.equal(blueprint.scene.orientation, 'portrait')
  assert.deepEqual(blueprint.scene.designResolution, { width: 750, height: 1334 })

  for (const path of [
    'Canvas',
    'Canvas/BattleRoot',
    'Canvas/BattleRoot/WorldLayer/FarBackground',
    'Canvas/BattleRoot/WorldLayer/MidBackground',
    'Canvas/BattleRoot/ActorLayer/Player',
    'Canvas/BattleRoot/ActorLayer/EnemySpawner',
    'Canvas/BattleRoot/EffectLayer/FlyingSwordSkill/Sword',
    'Canvas/BattleRoot/DropLayer',
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
  ]) {
    assert.equal(componentNames.has(component), true, `missing portrait component: ${component}`)
  }
})
