import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const manifestPath = resolve('assets/Data/animation-atlas.json')

function pngSize(assetPath) {
  const buffer = readFileSync(resolve('assets/resources', assetPath))
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  }
}

test('first stage actors use transparent combat strips', () => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const actorRequirements = {
    'qinglan-sword-cultivator': {
      atlas: 'Assets/Combat/QinglanSwordCultivator/action-strip.png',
      actions: {
        idle: [0],
        move: [1, 2],
        cast: [3],
        hurt: [4],
        sword_ride: [1, 2],
        hand_seal: [3],
        death: [5],
      },
    },
    'moss-wolf': {
      atlas: 'Assets/Combat/MistBamboo/moss-wolf-strip.png',
      actions: {
        idle: [0],
        move: [1, 2],
        attack: [3],
        hurt: [4],
        death: [5],
      },
    },
    'green-wing-moth': {
      atlas: 'Assets/Combat/MistBamboo/green-wing-moth-strip.png',
      actions: {
        idle: [0],
        move: [1, 2],
        attack: [3],
        hurt: [4],
        death: [5],
      },
    },
    'bamboo-warden': {
      atlas: 'Assets/Combat/MistBamboo/bamboo-warden-strip.png',
      actions: {
        idle: [0],
        move: [1, 2],
        attack: [3],
        hurt: [4],
        death: [5],
      },
    },
  }

  for (const [actorId, expected] of Object.entries(actorRequirements)) {
    const actor = manifest.actors.find(({ id }) => id === actorId)
    assert.ok(actor, `${actorId} should exist`)
    assert.equal(actor.atlas, expected.atlas)
    assert.deepEqual(actor.frameSize, { w: 320, h: 512 })
    assert.equal(existsSync(resolve('assets/resources', actor.atlas)), true, `${actor.atlas} should exist`)

    const atlasSize = pngSize(actor.atlas)
    assert.deepEqual(atlasSize, { width: 1920, height: 512 })

    assert.deepEqual(
      actor.actions.map(({ name }) => name).sort(),
      Object.keys(expected.actions).sort(),
    )

    for (const [actionName, selectedFrames] of Object.entries(expected.actions)) {
      const action = actor.actions.find(({ name }) => name === actionName)
      assert.ok(action, `${actorId} should define ${actionName}`)
      assert.equal(action.atlas, expected.atlas)
      assert.equal(action.frames.length, selectedFrames.length)
      assert.deepEqual(action.frames, selectedFrames.map((sourceIndex) => ({
        x: sourceIndex * 320,
        y: 0,
        w: 320,
        h: 512,
      })))
      assert.deepEqual(action.order, selectedFrames.map((_, localIndex) => localIndex))
      assert.equal(
        action.order.every((frameIndex) => Number.isInteger(frameIndex) && frameIndex >= 0 && frameIndex < action.frames.length),
        true,
      )
    }
  }

  const farPath = resolve('assets/resources/Assets/World/MistBamboo/far.webp')
  const midPath = resolve('assets/resources/Assets/World/MistBamboo/mid.webp')
  assert.equal(existsSync(farPath), true)
  assert.equal(existsSync(midPath), true)
  const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
  assert.notEqual(sha256(farPath), sha256(midPath))
})

test('first stage combat cells keep transparent gutters', async () => {
  const { readPngRgba } = await import('../tools/png-alpha-runtime.mjs')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const actorIds = ['qinglan-sword-cultivator', 'moss-wolf', 'green-wing-moth', 'bamboo-warden']
  const cellWidth = 320
  const cellHeight = 512
  const gutter = 28

  for (const actorId of actorIds) {
    const actor = manifest.actors.find(({ id }) => id === actorId)
    const image = readPngRgba(resolve('assets/resources', actor.atlas))
    assert.deepEqual({ width: image.width, height: image.height }, { width: 1920, height: 512 })

    const assertTransparent = (x, y) => {
      assert.equal(image.data[(y * image.width + x) * 4 + 3], 0, `${actorId} touches cell boundary at ${x},${y}`)
    }

    const visibleBottoms = []
    for (let cell = 0; cell < 6; cell += 1) {
      const cellX = cell * cellWidth
      for (let y = 0; y < cellHeight; y += 1) {
        for (let x = 0; x < gutter; x += 1) {
          assertTransparent(cellX + x, y)
          assertTransparent(cellX + cellWidth - 1 - x, y)
        }
      }
      for (let x = 0; x < cellWidth; x += 1) {
        for (let y = 0; y < gutter; y += 1) {
          assertTransparent(cellX + x, y)
          assertTransparent(cellX + x, cellHeight - 1 - y)
        }
      }

      let visibleBottom = -1
      for (let y = gutter; y < cellHeight - gutter; y += 1) {
        for (let x = gutter; x < cellWidth - gutter; x += 1) {
          if (image.data[(y * image.width + cellX + x) * 4 + 3] > 0) visibleBottom = y
        }
      }
      assert.notEqual(visibleBottom, -1, `${actorId} cell ${cell} should not be empty`)
      visibleBottoms.push(visibleBottom)
    }

    assert.equal(
      Math.max(...visibleBottoms) - Math.min(...visibleBottoms) <= 1,
      true,
      `${actorId} visible bottoms should align: ${visibleBottoms.join(', ')}`,
    )
  }
})

test('second stage actors use aligned transparent Mist Lantern strips', async () => {
  const { readPngRgba } = await import('../tools/png-alpha-runtime.mjs')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const actorIds = ['fog-spider', 'lantern-wraith', 'mist-deer-king']
  const expectedFrames = {
    idle: [0],
    move: [1, 2],
    attack: [3],
    hurt: [4],
    death: [5],
  }

  for (const actorId of actorIds) {
    const actor = manifest.actors.find(({ id }) => id === actorId)
    const expectedAtlas = `Assets/Combat/MistLantern/${actorId}-strip.png`
    assert.ok(actor, `${actorId} should exist`)
    assert.equal(actor.atlas, expectedAtlas)
    assert.deepEqual(actor.frameSize, { w: 320, h: 512 })

    const image = readPngRgba(resolve('assets/resources', expectedAtlas))
    assert.deepEqual({ width: image.width, height: image.height }, { width: 1920, height: 512 })
    const visibleBottoms = []
    for (let cell = 0; cell < 6; cell += 1) {
      const cellX = cell * 320
      let visibleBottom = -1
      let visiblePixels = 0
      for (let y = 0; y < 512; y += 1) {
        for (let x = 0; x < 320; x += 1) {
          const alpha = image.data[(y * image.width + cellX + x) * 4 + 3]
          if (alpha > 0) {
            visiblePixels += 1
            visibleBottom = y
          }
          if (x < 28 || x >= 292 || y < 28 || y >= 484) {
            assert.equal(alpha, 0, `${actorId} cell ${cell} touches its transparent gutter`)
          }
        }
      }
      assert.equal(visiblePixels > 1000, true, `${actorId} cell ${cell} needs useful subject coverage`)
      visibleBottoms.push(visibleBottom)
    }
    assert.equal(Math.max(...visibleBottoms) - Math.min(...visibleBottoms) <= 1, true)

    for (const [name, indices] of Object.entries(expectedFrames)) {
      const action = actor.actions.find((candidate) => candidate.name === name)
      assert.ok(action, `${actorId} should define ${name}`)
      assert.equal(action.atlas, expectedAtlas)
      assert.deepEqual(action.frames, indices.map((index) => ({ x: index * 320, y: 0, w: 320, h: 512 })))
      assert.deepEqual(action.order, indices.map((_, index) => index))
    }
  }
})

test('third stage actors use clean aligned Flame Ravine strips', async () => {
  const { readPngRgba } = await import('../tools/png-alpha-runtime.mjs')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const actorIds = ['lava-lizard', 'ember-crow', 'flame-ogre']
  const sourceX = (action) => action.order.map((index) => action.frames[index].x)

  for (const actorId of actorIds) {
    const actor = manifest.actors.find(({ id }) => id === actorId)
    const expectedAtlas = `Assets/Combat/FlameRavine/${actorId}-strip.png`
    assert.ok(actor, `${actorId} should exist`)
    assert.equal(actor.atlas, expectedAtlas)
    assert.deepEqual(actor.frameSize, { w: 320, h: 512 })

    const image = readPngRgba(resolve('assets/resources', expectedAtlas))
    assert.deepEqual({ width: image.width, height: image.height }, { width: 1920, height: 512 })
    for (const [x, y] of [[0, 0], [image.width - 1, 0], [0, image.height - 1], [image.width - 1, image.height - 1]]) {
      const offset = (y * image.width + x) * 4
      assert.deepEqual([...image.data.subarray(offset, offset + 4)], [0, 0, 0, 0], `${actorId} corner ${x},${y} must be clean RGBA`)
    }
    for (let x = 0; x < image.width; x += 1) {
      assert.equal(image.data[x * 4 + 3], 0, `${actorId} top outer border must be transparent`)
      assert.equal(image.data[((image.height - 1) * image.width + x) * 4 + 3], 0, `${actorId} bottom outer border must be transparent`)
    }
    const visibleBottoms = []
    for (let cell = 0; cell < 6; cell += 1) {
      const cellX = cell * 320
      let visibleBottom = -1
      let visiblePixels = 0
      let blackPixels = 0
      let magentaPixels = 0
      for (let y = 0; y < 512; y += 1) {
        for (let x = 0; x < 320; x += 1) {
          const offset = (y * image.width + cellX + x) * 4
          const [r, g, b, alpha] = image.data.subarray(offset, offset + 4)
          if (alpha > 0) {
            visiblePixels += 1
            visibleBottom = y
            if (r > 220 && b > 180 && g < 80) magentaPixels += 1
            if (r < 5 && g < 5 && b < 5) blackPixels += 1
          }
          if (x < 28 || x >= 292 || y < 28 || y >= 484) {
            assert.equal(alpha, 0, `${actorId} cell ${cell} touches its transparent gutter`)
          }
        }
      }
      assert.equal(visiblePixels > 1000, true, `${actorId} cell ${cell} needs useful subject coverage`)
      assert.equal(magentaPixels / visiblePixels < 0.02, true, `${actorId} cell ${cell} retains magenta background`)
      assert.equal(blackPixels / visiblePixels < 0.15, true, `${actorId} cell ${cell} retains black background`)

      const pending = new Set()
      for (let y = 28; y < 484; y += 1) {
        for (let x = 28; x < 292; x += 1) {
          if (image.data[(y * image.width + cellX + x) * 4 + 3] > 32) pending.add(`${x},${y}`)
        }
      }
      const componentSizes = []
      while (pending.size) {
        const first = pending.values().next().value
        pending.delete(first)
        const queue = [first]
        let size = 0
        while (queue.length) {
          const [x, y] = queue.pop().split(',').map(Number)
          size += 1
          for (const key of [`${x - 1},${y}`, `${x + 1},${y}`, `${x},${y - 1}`, `${x},${y + 1}`]) {
            if (pending.delete(key)) queue.push(key)
          }
        }
        componentSizes.push(size)
      }
      componentSizes.sort((a, b) => b - a)
      assert.equal(componentSizes[0] > visiblePixels * 0.55, true, `${actorId} cell ${cell} lacks one dominant whole subject`)
      assert.equal((componentSizes[1] ?? 0) < visiblePixels * 0.08, true, `${actorId} cell ${cell} has an obvious detached frame fragment`)
      visibleBottoms.push(visibleBottom)
    }
    assert.equal(
      Math.max(...visibleBottoms) - Math.min(...visibleBottoms) <= 1,
      true,
      `${actorId} visible bottoms should align: ${visibleBottoms.join(', ')}`,
    )

    const actions = Object.fromEntries(actor.actions.map((action) => [action.name, action]))
    for (const action of Object.values(actions)) assert.equal(action.atlas, expectedAtlas)

    assert.equal(actions.idle.loop, true)
    assert.equal(actions.idle.order.length > 1, true, `${actorId} idle should be a readable loop`)
    assert.equal(sourceX(actions.idle).includes(0), true, `${actorId} idle should preserve x0`)
    assert.deepEqual(new Set(sourceX(actions.move)), new Set([320, 640]))

    const attackX = sourceX(actions.attack)
    assert.equal(actions.attack.loop, false)
    assert.equal(attackX.length >= 3, true, `${actorId} attack needs windup, strike, and recovery`)
    assert.equal(attackX.indexOf(960) > 0 && attackX.indexOf(960) < attackX.length - 1, true)
    assert.equal(attackX.at(-1), 0, `${actorId} attack should recover to idle`)

    const hurtX = sourceX(actions.hurt)
    assert.equal(actions.hurt.loop, false)
    assert.equal(hurtX.length >= 2, true, `${actorId} hurt needs recoil and recovery`)
    assert.equal(hurtX.includes(1280), true)
    assert.equal(hurtX.at(-1), 0, `${actorId} hurt should recover to idle`)

    const deathX = sourceX(actions.death)
    assert.equal(actions.death.loop, false)
    assert.equal(deathX.length >= 3, true, `${actorId} death needs transition and hold frames`)
    assert.equal(deathX[0], 1280, `${actorId} death should transition through hurt`)
    assert.equal(deathX.at(-1), 1600, `${actorId} death should end on its death pose`)
    assert.equal(deathX.at(-2), 1600, `${actorId} death should hold its final pose before stopping`)
  }
})

test('third stage replacement atlases leave no stale actor-atlas assets or manifest references', () => {
  const stalePaths = [
    'Assets/ActorAtlases/LavaLizard/atlas.png',
    'Assets/ActorAtlases/EmberCrow/atlas.png',
    'Assets/ActorAtlases/FlameOgre/atlas.png',
  ]
  const manifests = [
    readFileSync(resolve('assets/Data/animation-atlas.json'), 'utf8'),
    readFileSync(resolve('assets/resources/Data/animation-atlas.json'), 'utf8'),
  ]

  for (const stalePath of stalePaths) {
    assert.equal(existsSync(resolve('assets/resources', stalePath)), false, `${stalePath} should be removed`)
    assert.equal(existsSync(resolve('assets/resources', `${stalePath}.meta`)), false, `${stalePath}.meta should be removed`)
    assert.equal(manifests.some((manifest) => manifest.includes(stalePath)), false, `${stalePath} should be unreferenced`)
  }
})

test('source and resources animation manifests stay deeply identical', () => {
  const sourceManifest = JSON.parse(readFileSync(resolve('assets/Data/animation-atlas.json'), 'utf8'))
  const resourceManifest = JSON.parse(readFileSync(resolve('assets/resources/Data/animation-atlas.json'), 'utf8'))
  assert.deepEqual(resourceManifest, sourceManifest)
})

test('animation atlas manifest uses one texture per actor', () => {
  assert.equal(existsSync(manifestPath), true)
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

  assert.equal(manifest.actors.length >= 16, true)

  for (const actor of manifest.actors) {
    assert.equal(Boolean(actor.atlas), true)
    assert.equal(existsSync(resolve('assets/resources', actor.atlas)), true, `${actor.atlas} should exist`)
    assert.equal(actor.actions.every((action) => action.atlas === actor.atlas), true)
  }
})

test('animation atlas actions define frame rects, playback order, and loop rules', () => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

  for (const actor of manifest.actors) {
    const atlasSize = pngSize(actor.atlas)

    for (const action of actor.actions) {
      assert.equal(action.frames.length > 0, true)
      assert.equal(action.order.length > 0, true)
      assert.equal(action.order.every((index) => Number.isInteger(index) && index >= 0 && index < action.frames.length), true)
      assert.equal(typeof action.loop, 'boolean')
      assert.equal(action.fps > 0, true)

      for (const frame of action.frames) {
        assert.equal(frame.x + frame.w <= atlasSize.width, true)
        assert.equal(frame.y + frame.h <= atlasSize.height, true)
      }
    }
  }
})
