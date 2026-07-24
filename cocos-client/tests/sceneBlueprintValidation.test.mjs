import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { validateSceneBlueprint } from '../tools/validate-scene-blueprint.mjs'

const readBlueprint = () => JSON.parse(readFileSync(resolve('assets/Data/scene-blueprint.json'), 'utf8'))

test('scene blueprint validator accepts the runtime authority bindings', () => {
  const blueprint = readBlueprint()
  assert.deepEqual(validateSceneBlueprint(blueprint), { ok: true, errors: [] })
  const status = blueprint.nodes.find((node) => node.path === 'Canvas/DungeonRoot/DungeonStatusLabel')
  assert.equal(status.bindings.presentation, 'Canvas/DungeonRoot/DungeonRunController.onRunChanged')
  assert.equal('events' in status.bindings, false)
})

test('scene blueprint validator rejects unknown and misplaced controller bindings', () => {
  const blueprint = readBlueprint()
  const dualMode = blueprint.nodes.find((node) => node.path === 'Canvas/DualModeGameController')
  const dungeon = blueprint.nodes.find((node) => node.path === 'Canvas/DungeonRoot/DungeonRunController')
  dualMode.bindings.profileData = dungeon.bindings.profileData
  delete dungeon.bindings.profileData
  dungeon.bindings.unowned = 'somewhere'

  const report = validateSceneBlueprint(blueprint)
  assert.equal(report.ok, false)
  assert.ok(report.errors.includes('unknown DualModeGameController binding: profileData'))
  assert.ok(report.errors.includes('missing DungeonRunController binding: profileData'))
  assert.ok(report.errors.includes('unknown DungeonRunController binding: unowned'))
})
