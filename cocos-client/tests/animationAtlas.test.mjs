import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const manifestPath = resolve('assets/Data/animation-atlas.json')
const monsterIds = [
  'moss-wolf',
  'green-wing-moth',
  'bamboo-warden',
  'fog-spider',
  'lantern-wraith',
  'mist-deer-king',
  'lava-lizard',
  'ember-crow',
  'flame-ogre',
  'star-armored-beast',
  'void-wing-spirit',
  'meteor-guardian',
]

function pngSize(assetPath) {
  const buffer = readFileSync(resolve('assets/resources', assetPath))
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  }
}

function actorFolder(actorId) {
  return actorId.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join('')
}

test('all monsters use canonical 1024x1280 actor atlases', () => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const monsters = manifest.actors.filter(({ type }) => type === 'monster')

  assert.deepEqual(monsters.map(({ id }) => id).sort(), [...monsterIds].sort())
  for (const actor of monsters) {
    const expectedAtlas = `Assets/ActorAtlases/${actorFolder(actor.id)}/atlas.png`
    assert.equal(actor.atlas, expectedAtlas)
    assert.deepEqual(actor.frameSize, { w: 256, h: 256 })
    assert.deepEqual(pngSize(actor.atlas), { width: 1024, height: 1280 })
    assert.equal(actor.actions.every((action) => action.atlas === expectedAtlas), true)
  }
})

test('monster actor atlases contain visible art on transparent canvases', async () => {
  const { readPngRgba } = await import('../tools/png-alpha-runtime.mjs')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const monsters = manifest.actors.filter(({ type }) => type === 'monster')

  for (const actor of monsters) {
    const image = readPngRgba(resolve('assets/resources', actor.atlas))
    let transparentPixels = 0
    let visiblePixels = 0
    for (let offset = 3; offset < image.data.length; offset += 4) {
      if (image.data[offset] === 0) transparentPixels += 1
      if (image.data[offset] > 0) visiblePixels += 1
    }
    assert.equal(transparentPixels > 0, true, `${actor.id} should retain transparency`)
    assert.equal(visiblePixels > 0, true, `${actor.id} should contain visible art`)
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
