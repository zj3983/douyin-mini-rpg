import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import {
  characterVisuals,
  dungeonMonsterVisuals,
  skillVfxVisuals,
  techniqueVisualArts,
  visualAssetPaths,
  worldMonsterVisuals,
} from '../src/visualAssets.ts'

function publicAssetPath(assetPath) {
  return join(process.cwd(), 'public', assetPath.replace(/^\/+/, ''))
}

test('visual asset catalog exposes character portraits and battle sprites', () => {
  assert.deepEqual(Object.keys(characterVisuals), ['sword', 'thunder', 'flame', 'wood'])

  for (const [id, visual] of Object.entries(characterVisuals)) {
    assert.match(visual.portrait, /^\/assets\/generated\/portrait-[a-z]+\.webp$/, `${id} portrait path`)
    assert.match(visual.battle, /^\/assets\/generated\/.+\.(png|webp)$/, `${id} battle path`)
    assert.equal(existsSync(publicAssetPath(visual.portrait)), true, `${visual.portrait} should exist`)
    assert.equal(existsSync(publicAssetPath(visual.battle)), true, `${visual.battle} should exist`)
    assert.equal(visual.palette.length >= 3, true, `${id} should define a reusable palette`)
  }

  assert.deepEqual(Object.keys(characterVisuals.sword.actions ?? {}), ['sheet', 'idle', 'fly', 'slash'])
  for (const assetPath of Object.values(characterVisuals.sword.actions ?? {})) {
    assert.equal(existsSync(publicAssetPath(assetPath)), true, `${assetPath} should exist`)
  }
})

test('visual asset catalog covers dungeon and world monsters', () => {
  assert.deepEqual(Object.keys(dungeonMonsterVisuals), ['slime', 'bat', 'wolf', 'crystal', 'warden'])
  assert.equal(worldMonsterVisuals.length >= 7, true)

  for (const [id, visual] of Object.entries(dungeonMonsterVisuals)) {
    assert.equal(existsSync(publicAssetPath(visual.image)), true, `${id} monster image should exist`)
    assert.match(visual.motion, /^(ground|flying|heavy)$/)
  }

  for (const visual of worldMonsterVisuals) {
    assert.equal(existsSync(publicAssetPath(visual.image)), true, `${visual.stage} world monster image should exist`)
    assert.equal(visual.layout.width > 0, true)
    assert.equal(visual.layout.height > 0, true)
    assert.match(visual.layout.motion, /^(ground|flying|heavy)$/)
  }
})

test('visual asset catalog covers skill vfx and evolution card art', () => {
  assert.deepEqual(Object.keys(skillVfxVisuals), ['swordWave', 'impact', 'thunder', 'lotus', 'heal'])
  assert.equal(Object.keys(techniqueVisualArts).length, 12)

  for (const assetPath of [...Object.values(skillVfxVisuals), ...Object.values(techniqueVisualArts)]) {
    assert.equal(existsSync(publicAssetPath(assetPath)), true, `${assetPath} should exist`)
  }
})

test('visual asset paths are normalized project assets', () => {
  assert.equal(visualAssetPaths.length >= 30, true)

  for (const assetPath of visualAssetPaths) {
    assert.match(assetPath, /^\/assets\/generated\//)
    assert.equal(existsSync(publicAssetPath(assetPath)), true, `${assetPath} should exist`)
  }
})
