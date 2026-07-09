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
