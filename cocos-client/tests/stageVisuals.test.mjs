import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { planBackgroundRelease, planBackgroundRequest, stageVisualFor } from '../tools/stage-visual-catalog.mjs'

const root = resolve(import.meta.dirname, '..')

test('stages 1-4 resolve distinct Cocos background resources', () => {
  const visuals = [1, 2, 3, 4].map(stageVisualFor)

  assert.equal(new Set(visuals.map((visual) => visual.farPath)).size, 4)
  assert.deepEqual(
    visuals.map((visual) => visual.farPath),
    [
      'Assets/World/MistBamboo/far/spriteFrame',
      'Assets/World/MistLantern/far/spriteFrame',
      'Assets/World/FlameRavine/far/spriteFrame',
      'Assets/World/StarRoad/far/spriteFrame',
    ],
  )
  assert.equal(visuals[0].midPath, 'Assets/World/MistBamboo/mid/spriteFrame')
  assert.equal(visuals.slice(1).every((visual) => visual.midPath === null), true)
})

test('stage visual catalog exposes background and theme metadata', () => {
  assert.deepEqual(
    [1, 2, 3, 4].map((stageId) => {
      const { backgroundId, theme } = stageVisualFor(stageId)
      return { backgroundId, theme }
    }),
    [
      { backgroundId: 'green-hill-bamboo-rain', theme: 'mist-bamboo' },
      { backgroundId: 'mist-lantern-forest', theme: 'mist-bamboo' },
      { backgroundId: 'red-flame-ravine', theme: 'flame-cave' },
      { backgroundId: 'fallen-star-ancient-road', theme: 'starlight-ruin' },
    ],
  )
  assert.throws(() => stageVisualFor(0), /Unknown stage visual: 0/)
  assert.throws(() => stageVisualFor(5), /Unknown stage visual: 5/)
  assert.equal(Object.isFrozen(stageVisualFor(1)), true)
  assert.throws(() => {
    stageVisualFor(1).farPath = 'mutated'
  }, TypeError)
  assert.equal(stageVisualFor(1).farPath, 'Assets/World/MistBamboo/far/spriteFrame')
})

test('release plan frees every previous stage asset after a successful swap', () => {
  assert.deepEqual(
    planBackgroundRelease(stageVisualFor(1), stageVisualFor(2)),
    [
      'Assets/World/MistBamboo/far/spriteFrame',
      'Assets/World/MistBamboo/mid/spriteFrame',
    ],
  )
  assert.deepEqual(
    planBackgroundRelease(stageVisualFor(2), stageVisualFor(3)),
    ['Assets/World/MistLantern/far/spriteFrame'],
  )
})

test('release plan never frees current paths and never returns duplicates', () => {
  const shared = {
    stageId: 8,
    backgroundId: 'shared-old',
    theme: 'test',
    farPath: 'Assets/World/Shared/spriteFrame',
    midPath: 'Assets/World/Shared/spriteFrame',
  }
  const current = {
    stageId: 9,
    backgroundId: 'shared-current',
    theme: 'test',
    farPath: 'Assets/World/Shared/spriteFrame',
    midPath: null,
  }

  assert.deepEqual(planBackgroundRelease(shared, current), [])
  assert.deepEqual(planBackgroundRelease(shared, null), ['Assets/World/Shared/spriteFrame'])
})

test('request plan avoids duplicate loads and cancels a stale outgoing request', () => {
  const stage1 = stageVisualFor(1)
  const stage2 = stageVisualFor(2)

  assert.equal(planBackgroundRequest(null, stage1, stage1), 'ignore')
  assert.equal(planBackgroundRequest(stage1, stage1, stage1), 'ignore')
  assert.equal(planBackgroundRequest(stage1, stage2, stage1), 'cancel')
  assert.equal(planBackgroundRequest(stage1, stage1, stage2), 'load')
})

test('stage backgrounds are copied into Cocos resources', () => {
  for (const folder of ['MistLantern', 'FlameRavine', 'StarRoad']) {
    assert.equal(existsSync(join(root, 'assets', 'resources', 'Assets', 'World', folder, 'far.webp')), true)
  }
})

test('stage backgrounds contain distinct artwork instead of duplicate files', () => {
  const folders = ['MistBamboo', 'MistLantern', 'FlameRavine', 'StarRoad']
  const hashes = folders.map((folder) => {
    const bytes = readFileSync(join(root, 'assets', 'resources', 'Assets', 'World', folder, 'far.webp'))
    return createHash('sha256').update(bytes).digest('hex')
  })

  assert.equal(new Set(hashes).size, folders.length)
})

test('battle runtime announces rebuilt stage visual metadata', () => {
  const source = readFileSync(join(root, 'assets', 'Scripts', 'Game', 'BattleRuntimeController.ts'), 'utf8')

  assert.match(source, /battle-stage-changed/)
  assert.match(source, /stageVisualFor\(this\.stageNumber\)/)
  assert.match(source, /stageId/)
  assert.match(source, /backgroundId/)
  assert.match(source, /theme/)
})

test('bootstrap delegates stage background lifecycle and tears its listener down', () => {
  const bootstrap = readFileSync(join(root, 'assets', 'Scripts', 'Game', 'PortraitBattleBootstrap.ts'), 'utf8')
  const controller = readFileSync(join(root, 'assets', 'Scripts', 'Game', 'StageBackgroundController.ts'), 'utf8')

  assert.match(bootstrap, /battle-stage-changed/)
  assert.match(bootstrap, /new StageBackgroundController/)
  assert.match(bootstrap, /stageBackgroundController\?\.destroy\(\)/)
  assert.match(bootstrap, /\.off\('battle-stage-changed'/)
  assert.doesNotMatch(bootstrap, /backgroundLoadGeneration|resources\.release/)
  assert.match(controller, /new StageBackgroundRuntime<SpriteFrame>/)
  assert.match(controller, /asset\.addRef\(\)/)
  assert.match(controller, /release: \(_path, resource\) => resource\.decRef\(\)/)
  assert.match(controller, /midSprite\.spriteFrame = null/)
  assert.match(controller, /midSprite\.node\.active = false/)
})
