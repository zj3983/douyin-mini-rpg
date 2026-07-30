import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'
import ts from 'typescript'

import {
  planBackgroundRelease,
  planBackgroundRequest,
  stageResourcePlanFor,
  stageVisualFor,
} from '../tools/stage-visual-catalog.mjs'
import { readPngRgba } from '../tools/png-alpha-runtime.mjs'
import { resourcePathForPng } from '../tools/strip-animation-runtime.mjs'

const root = resolve(import.meta.dirname, '..')

const stageIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

test('stages 1-10 resolve distinct Cocos background resources', () => {
  const visuals = stageIds.map(stageVisualFor)

  assert.equal(new Set(visuals.map((visual) => visual.farPath)).size, visuals.length)
  assert.deepEqual(
    visuals.map((visual) => visual.farPath),
    [
      'Assets/World/MistBamboo/far/spriteFrame',
      'Assets/World/MistLantern/far/spriteFrame',
      'Assets/World/FlameRavine/far/spriteFrame',
      'Assets/World/StarRoad/far/spriteFrame',
      'Assets/World/CloudGate/far/spriteFrame',
      'Assets/World/NetherLantern/far/spriteFrame',
      'Assets/World/DeepFlameRavine/far/spriteFrame',
      'Assets/World/UpperStarRoad/far/spriteFrame',
      'Assets/World/MysticSpring/far/spriteFrame',
      'Assets/World/MistHeaven/far/spriteFrame',
    ],
  )
  assert.equal(visuals[0].midPath, 'Assets/World/MistBamboo/mid/spriteFrame')
  assert.equal(visuals.slice(1, 4).every((visual) => visual.midPath === null), true)
  assert.equal(visuals.slice(4).every((visual) => visual.midPath?.endsWith('/mid/spriteFrame')), true)
  assert.equal(visuals[8].midPath, 'Assets/World/MysticSpring/mid/spriteFrame')
  assert.equal(visuals[9].midPath, 'Assets/World/MistHeaven/mid/spriteFrame')
})

test('stage visual catalog exposes background and theme metadata', () => {
  assert.deepEqual(
    stageIds.map((stageId) => {
      const { backgroundId, theme } = stageVisualFor(stageId)
      return { backgroundId, theme }
    }),
    [
      { backgroundId: 'green-hill-bamboo-rain', theme: 'mist-bamboo' },
      { backgroundId: 'mist-lantern-forest', theme: 'mist-bamboo' },
      { backgroundId: 'red-flame-ravine', theme: 'flame-cave' },
      { backgroundId: 'fallen-star-ancient-road', theme: 'starlight-ruin' },
      { backgroundId: 'cloud-sea-heaven-gate', theme: 'cloud-gate' },
      { backgroundId: 'nether-lantern-forest', theme: 'soul-valley' },
      { backgroundId: 'deep-flame-ravine', theme: 'flame-cave' },
      { backgroundId: 'upper-fallen-star-road', theme: 'starlight-ruin' },
      { backgroundId: 'mystic-spring-stone-forest', theme: 'mist-bamboo' },
      { backgroundId: 'mist-sea-heaven-palace', theme: 'cloud-gate' },
    ],
  )
  assert.throws(() => stageVisualFor(0), /Unknown stage visual: 0/)
  assert.throws(() => stageVisualFor(11), /Unknown stage visual: 11/)
  assert.equal(Object.isFrozen(stageVisualFor(1)), true)
  assert.throws(() => {
    stageVisualFor(1).farPath = 'mutated'
  }, TypeError)
  assert.equal(stageVisualFor(1).farPath, 'Assets/World/MistBamboo/far/spriteFrame')
})

test('stage resource plans map catalog backgrounds and manifest monster atlases only', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'assets', 'resources', 'Data', 'animation-atlas.json'), 'utf8'))
  const atlasPathsByActor = new Map(manifest.actors.map((actor) => [
    actor.id,
    [...new Set(actor.actions.map((action) => resourcePathForPng(action.atlas ?? actor.atlas)))],
  ]))
  const expectedActors = [
    ['moss-wolf', 'green-wing-moth', 'bamboo-warden'],
    ['fog-spider', 'lantern-wraith', 'mist-deer-king'],
    ['lava-lizard', 'ember-crow', 'flame-ogre'],
    ['star-armored-beast', 'void-wing-spirit', 'meteor-guardian'],
    ['star-armored-beast', 'void-wing-spirit', 'meteor-guardian'],
    ['fog-spider', 'lantern-wraith', 'mist-deer-king'],
    ['lava-lizard', 'ember-crow', 'flame-ogre'],
    ['star-armored-beast', 'void-wing-spirit', 'meteor-guardian'],
    ['moss-wolf', 'green-wing-moth', 'mist-deer-king'],
    ['star-armored-beast', 'void-wing-spirit', 'meteor-guardian'],
  ]

  for (const stageId of stageIds) {
    const visual = stageVisualFor(stageId)
    const resourcePlan = stageResourcePlanFor(stageId)
    assert.deepEqual(visual.monsterActorIds, expectedActors[stageId - 1])
    assert.equal(Object.isFrozen(visual.monsterActorIds), true)
    assert.deepEqual(
      resourcePlan.assets.filter(({ kind }) => kind === 'texture').map(({ path }) => path),
      expectedActors[stageId - 1].flatMap((actorId) => atlasPathsByActor.get(actorId)),
    )
    assert.deepEqual(resourcePlan, {
      stageId,
      assets: [
        { path: visual.farPath, kind: 'spriteFrame' },
        ...(visual.midPath ? [{ path: visual.midPath, kind: 'spriteFrame' }] : []),
        ...expectedActors[stageId - 1].flatMap((actorId) => atlasPathsByActor.get(actorId).map((path) => ({ path, kind: 'texture' }))),
      ],
    })
    assert.equal(resourcePlan.assets.some(({ path }) => /character|skill|artifact|Generated/i.test(path)), false)
  }

  assert.throws(() => stageResourcePlanFor(11), /Unknown stage visual: 11/)
})

test('stages 9 and 10 load their complete background and actor resource plans', () => {
  const expected = [
    {
      stageId: 9,
      farPath: 'Assets/World/MysticSpring/far/spriteFrame',
      midPath: 'Assets/World/MysticSpring/mid/spriteFrame',
      monsterActorIds: ['moss-wolf', 'green-wing-moth', 'mist-deer-king'],
    },
    {
      stageId: 10,
      farPath: 'Assets/World/MistHeaven/far/spriteFrame',
      midPath: 'Assets/World/MistHeaven/mid/spriteFrame',
      monsterActorIds: ['star-armored-beast', 'void-wing-spirit', 'meteor-guardian'],
    },
  ]

  for (const expectation of expected) {
    const visual = stageVisualFor(expectation.stageId)
    const plan = stageResourcePlanFor(expectation.stageId)
    assert.deepEqual(
      {
        stageId: visual.stageId,
        farPath: visual.farPath,
        midPath: visual.midPath,
        monsterActorIds: visual.monsterActorIds,
      },
      expectation,
    )
    assert.deepEqual(plan.assets.slice(0, 2), [
      { path: expectation.farPath, kind: 'spriteFrame' },
      { path: expectation.midPath, kind: 'spriteFrame' },
    ])
    assert.equal(plan.assets.slice(2).every(({ kind }) => kind === 'texture'), true)
    assert.equal(plan.assets.slice(2).length > 0, true)
  }
})

test('TypeScript and ESM stage catalogs stay behaviorally identical', async () => {
  const source = readFileSync(join(root, 'assets', 'Scripts', 'Core', 'StageVisualCatalog.ts'), 'utf8')
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const typescriptCatalog = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`)
  const esmCatalog = await import('../tools/stage-visual-catalog.mjs')

  assert.deepEqual(
    stageIds.map(typescriptCatalog.stageVisualFor),
    stageIds.map(esmCatalog.stageVisualFor),
  )
  assert.deepEqual(
    stageIds.map(typescriptCatalog.stageResourcePlanFor),
    stageIds.map(esmCatalog.stageResourcePlanFor),
  )
  assert.equal(typescriptCatalog.WORLD_STAGE_COUNT, 10)
  assert.equal(esmCatalog.WORLD_STAGE_COUNT, typescriptCatalog.WORLD_STAGE_COUNT)
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
  assert.deepEqual(
    planBackgroundRelease(stageVisualFor(5), stageVisualFor(6)),
    [
      'Assets/World/CloudGate/far/spriteFrame',
      'Assets/World/CloudGate/mid/spriteFrame',
    ],
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
  for (const folder of ['MistLantern', 'FlameRavine', 'StarRoad', 'CloudGate', 'NetherLantern', 'DeepFlameRavine', 'UpperStarRoad']) {
    assert.equal(existsSync(join(root, 'assets', 'resources', 'Assets', 'World', folder, 'far.webp')), true)
  }
})

test('stage backgrounds contain distinct artwork instead of duplicate files', () => {
  const folders = ['MistBamboo', 'MistLantern', 'FlameRavine', 'StarRoad', 'CloudGate', 'NetherLantern', 'DeepFlameRavine', 'UpperStarRoad']
  const hashes = folders.map((folder) => {
    const bytes = readFileSync(join(root, 'assets', 'resources', 'Assets', 'World', folder, 'far.webp'))
    return createHash('sha256').update(bytes).digest('hex')
  })

  assert.equal(new Set(hashes).size, folders.length)
})

test('final region PNG layers satisfy the portrait and transparency contracts', () => {
  const farHashes = []

  for (const stageId of [9, 10]) {
    const visual = stageVisualFor(stageId)
    const descriptors = [visual.farPath, visual.midPath]
    const dimensions = []

    for (const descriptor of descriptors) {
      assert.equal(typeof descriptor, 'string')
      const resourcePath = descriptor.replace(/\/spriteFrame$/, '.png')
      assert.notEqual(resourcePath, descriptor)
      const pngPath = join(root, 'assets', 'resources', ...resourcePath.split('/'))
      const metaPath = `${pngPath}.meta`
      assert.equal(existsSync(pngPath), true, `missing ${resourcePath}`)
      assert.equal(existsSync(metaPath), true, `missing ${resourcePath}.meta`)

      const bytes = readFileSync(pngPath)
      const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
      const width = bytes.readUInt32BE(16)
      const height = bytes.readUInt32BE(20)
      const isMid = descriptor === visual.midPath
      dimensions.push({ width, height })

      assert.equal(width / height > 0.54 && width / height < 0.59, true, `${resourcePath} should be near 9:16`)
      assert.equal(bytes[25], isMid ? 6 : 2, `${resourcePath} should use the expected PNG color type`)
      assert.equal(meta.importer, 'image')
      assert.equal(meta.files.includes('.png'), true)
      assert.equal(meta.subMetas['6c48a'].uuid, `${meta.uuid}@6c48a`)
      assert.equal(meta.subMetas['f9941'].uuid, `${meta.uuid}@f9941`)
      assert.equal(meta.subMetas['6c48a'].userData.imageUuidOrDatabaseUri, meta.uuid)
      assert.equal(meta.subMetas['f9941'].userData.imageUuidOrDatabaseUri, `${meta.uuid}@6c48a`)
      assert.equal(meta.subMetas['f9941'].userData.width, width)
      assert.equal(meta.subMetas['f9941'].userData.height, height)
      assert.equal(meta.subMetas['f9941'].userData.rawWidth, width)
      assert.equal(meta.subMetas['f9941'].userData.rawHeight, height)
      assert.equal(meta.userData.redirect, `${meta.uuid}@6c48a`)
      assert.equal(meta.userData.hasAlpha, isMid)

      if (isMid) {
        const image = readPngRgba(pngPath)
        let transparentPixels = 0
        let visiblePixels = 0
        for (let offset = 3; offset < image.data.length; offset += 4) {
          if (image.data[offset] === 0) transparentPixels += 1
          else visiblePixels += 1
        }
        const pixelCount = image.width * image.height
        assert.equal(transparentPixels / pixelCount >= 0.6, true)
        assert.equal(visiblePixels / pixelCount >= 0.05, true)
      } else {
        farHashes.push(createHash('sha256').update(bytes).digest('hex'))
      }
    }

    assert.deepEqual(dimensions[0], dimensions[1])
  }

  assert.equal(new Set(farHashes).size, farHashes.length)
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
  const resourceController = readFileSync(join(root, 'assets', 'Scripts', 'Game', 'StageResourceController.ts'), 'utf8')

  assert.match(bootstrap, /battle-stage-changed/)
  assert.match(bootstrap, /new StageBackgroundController/)
  assert.match(bootstrap, /new StageResourceController\(this\.stageBackgroundController\)/)
  assert.match(bootstrap, /stageResourceController\.activate\(1\)/)
  assert.match(bootstrap, /stageResourceController\?\.destroy\(\)/)
  assert.match(bootstrap, /stageBackgroundController\?\.destroy\(\)/)
  assert.match(bootstrap, /\.off\('battle-stage-changed'/)
  assert.doesNotMatch(bootstrap, /backgroundLoadGeneration|resources\.release/)
  assert.match(controller, /new StageBackgroundRuntime<SpriteFrame>/)
  assert.match(controller, /asset\.addRef\(\)/)
  assert.match(controller, /release: \(_path, resource\) => resource\.decRef\(\)/)
  assert.match(controller, /midSprite\.spriteFrame = null/)
  assert.match(controller, /midSprite\.node\.active = false/)
  assert.match(resourceController, /stageResourcePlanFor/)
})
