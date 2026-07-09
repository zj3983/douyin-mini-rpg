import test from 'node:test'
import assert from 'node:assert/strict'
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
      assert.equal(action.order.length, action.frames.length)
      assert.equal(typeof action.loop, 'boolean')
      assert.equal(action.fps > 0, true)

      for (const frame of action.frames) {
        assert.equal(frame.x + frame.w <= atlasSize.width, true)
        assert.equal(frame.y + frame.h <= atlasSize.height, true)
      }
    }
  }
})
