import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'

import { decodePngRgba } from '../tools/png-alpha-runtime.mjs'

const root = resolve(import.meta.dirname, '..')
const assetRoot = 'assets/resources/Assets/Skills/BossDomain'
const assetNames = [
  'sweep_arc',
  'sweep_trail',
  'spike_cluster',
  'ground_dust',
  'roar_wave',
  'leaf_particle',
  'impact_spark',
]
const retiredNames = [
  'talisman_sweep',
  'talisman_spike',
  'talisman_roar',
]
const retiredUuids = new Set([
  '103770df-cddc-4047-8782-2b5f5391b3fa',
  'c702616f-a8af-498d-8dd0-a1bfb5b00a77',
  '636faadf-ee47-42b2-8f03-3b3ff5d62d5d',
])

function visibleBounds(image, alphaThreshold = 8) {
  let minX = image.width
  let minY = image.height
  let maxX = -1
  let maxY = -1

  for (let offset = 3; offset < image.data.length; offset += 4) {
    if (image.data[offset] <= alphaThreshold) continue
    const pixelIndex = (offset - 3) / 4
    const x = pixelIndex % image.width
    const y = Math.floor(pixelIndex / image.width)
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }

  return { minX, minY, maxX, maxY }
}

function assertTransparentEdges(image, relativePath) {
  for (let x = 0; x < image.width; x += 1) {
    assert.equal(image.data[(x * 4) + 3], 0, `${relativePath} must have transparent top padding`)
    const bottomOffset = (((image.height - 1) * image.width + x) * 4) + 3
    assert.equal(image.data[bottomOffset], 0, `${relativePath} must have transparent bottom padding`)
  }

  for (let y = 0; y < image.height; y += 1) {
    const leftOffset = ((y * image.width) * 4) + 3
    const rightOffset = ((y * image.width + image.width - 1) * 4) + 3
    assert.equal(image.data[leftOffset], 0, `${relativePath} must have transparent left padding`)
    assert.equal(image.data[rightOffset], 0, `${relativePath} must have transparent right padding`)
  }
}

test('boss skill VFX textures are compact, padded, distinct RGBA sprites with valid Cocos metadata', async () => {
  const pixelHashes = []
  const assetUuids = []

  for (const assetName of assetNames) {
    const relativePath = `${assetRoot}/${assetName}.png`
    const bytes = await readFile(resolve(root, relativePath))
    const image = decodePngRgba(bytes)
    const alpha = image.data.filter((_, index) => index % 4 === 3)

    assert.ok(
      image.width >= 256 && image.width <= 1024,
      `${relativePath} width must be within 256..1024`,
    )
    assert.ok(
      image.height >= 256 && image.height <= 1024,
      `${relativePath} height must be within 256..1024`,
    )
    assert.ok(bytes.length <= 500_000, `${relativePath} must stay within the encoded PNG budget`)
    assert.ok(alpha.includes(0), `${relativePath} must contain fully transparent pixels`)
    assert.ok(alpha.some((value) => value > 180), `${relativePath} must contain a clearly opaque subject`)

    const bounds = visibleBounds(image)
    const visibleWidthRatio = (bounds.maxX - bounds.minX + 1) / image.width
    const visibleHeightRatio = (bounds.maxY - bounds.minY + 1) / image.height
    assert.ok(visibleWidthRatio <= 0.9, `${relativePath} visible width must leave transparent padding`)
    assert.ok(visibleHeightRatio <= 0.9, `${relativePath} visible height must leave transparent padding`)
    assert.ok(bounds.minX > 0 && bounds.maxX < image.width - 1, `${relativePath} must be inset horizontally`)
    assert.ok(bounds.minY > 0 && bounds.maxY < image.height - 1, `${relativePath} must be inset vertically`)
    assertTransparentEdges(image, relativePath)

    pixelHashes.push(
      createHash('sha256')
        .update(`${image.width}x${image.height}\0`)
        .update(image.data)
        .digest('hex'),
    )

    const meta = JSON.parse(await readFile(resolve(root, `${relativePath}.meta`), 'utf8'))
    const texture = Object.values(meta.subMetas ?? {}).find((entry) => entry.importer === 'texture')
    const spriteFrame = Object.values(meta.subMetas ?? {}).find(
      (entry) => entry.importer === 'sprite-frame' && entry.name === 'spriteFrame',
    )

    assert.equal(meta.importer, 'image', `${relativePath}.meta must use the image importer`)
    assert.equal(meta.ver, '1.0.27', `${relativePath}.meta must use the Creator 3.8 image version`)
    assert.equal(meta.userData?.hasAlpha, true, `${relativePath}.meta must preserve alpha`)
    assert.ok(texture, `${relativePath}.meta must expose a texture subMeta`)
    assert.ok(spriteFrame, `${relativePath}.meta must expose a /spriteFrame subMeta`)
    assert.equal(spriteFrame.userData?.rawWidth, image.width, `${relativePath}.meta must match PNG width`)
    assert.equal(spriteFrame.userData?.rawHeight, image.height, `${relativePath}.meta must match PNG height`)
    assert.equal(retiredUuids.has(meta.uuid), false, `${relativePath}.meta must not reuse a retired UUID`)
    assetUuids.push(meta.uuid)
  }

  assert.equal(new Set(pixelHashes).size, assetNames.length, 'boss skill VFX decoded pixels must all be distinct')
  assert.equal(new Set(assetUuids).size, assetNames.length, 'boss skill VFX metadata UUIDs must all be distinct')
})

test('retired boss talisman textures and metadata are absent', async () => {
  for (const retiredName of retiredNames) {
    for (const suffix of ['.png', '.png.meta']) {
      const relativePath = `${assetRoot}/${retiredName}${suffix}`
      await assert.rejects(access(resolve(root, relativePath)), { code: 'ENOENT' }, `${relativePath} must be retired`)
    }
  }
})
