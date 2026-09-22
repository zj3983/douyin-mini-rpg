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
const expectedAssetUuids = {
  sweep_arc: '678e80be-bf6a-43e6-a68f-5e000f64084c',
  sweep_trail: 'e874ccc7-208e-41cc-bffb-43e1ffa66e57',
  spike_cluster: 'f0ffdb04-e9fa-4b57-a486-b2ce5c096d10',
  ground_dust: '676026ca-1187-4b66-aad0-77fc010f7767',
  roar_wave: '85d591c4-7646-47eb-8f6b-c6449dccbfa7',
  leaf_particle: '28fe5312-e11e-4a7d-ade8-eefd46a61c2f',
  impact_spark: '83063288-28a9-4001-8251-cace4e5854a8',
}
const visibleAlphaThreshold = 8
const trimAlphaThreshold = 0
const minimumPaddingRatio = 0.08
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

function visibleBounds(image, alphaThreshold = visibleAlphaThreshold) {
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

  assert.ok(maxX >= minX && maxY >= minY, 'PNG must contain visible pixels')
  return { minX, minY, maxX, maxY }
}

function assertTransparentPixelRgbIsZero(image, relativePath) {
  for (let offset = 0; offset < image.data.length; offset += 4) {
    if (image.data[offset + 3] !== 0) continue
    if (image.data[offset] === 0 && image.data[offset + 1] === 0 && image.data[offset + 2] === 0) continue

    const pixelIndex = offset / 4
    const x = pixelIndex % image.width
    const y = Math.floor(pixelIndex / image.width)
    assert.fail(`${relativePath} fully transparent pixel at (${x}, ${y}) must have zero RGB`)
  }
}

function assertNumberArrayClose(actual, expected, message) {
  assert.equal(actual.length, expected.length, `${message} length`)
  for (let index = 0; index < expected.length; index += 1) {
    assert.ok(
      Math.abs(actual[index] - expected[index]) <= 1e-12,
      `${message}[${index}] must be ${expected[index]}, received ${actual[index]}`,
    )
  }
}

function assertSpriteFrameGeometry(spriteFrame, trimBounds, visible, relativePath) {
  const data = spriteFrame.userData
  const expectedTrim = {
    trimX: trimBounds.minX,
    trimY: trimBounds.minY,
    width: trimBounds.maxX - trimBounds.minX + 1,
    height: trimBounds.maxY - trimBounds.minY + 1,
  }
  assert.deepEqual(
    { trimX: data.trimX, trimY: data.trimY, width: data.width, height: data.height },
    expectedTrim,
    `${relativePath}.meta trim rectangle must match nonzero alpha bounds`,
  )
  assert.ok(data.trimX <= visible.minX, `${relativePath}.meta trim must contain visible left edge`)
  assert.ok(data.trimY <= visible.minY, `${relativePath}.meta trim must contain visible top edge`)
  assert.ok(
    data.trimX + data.width - 1 >= visible.maxX,
    `${relativePath}.meta trim must contain visible right edge`,
  )
  assert.ok(
    data.trimY + data.height - 1 >= visible.maxY,
    `${relativePath}.meta trim must contain visible bottom edge`,
  )

  const expectedOffsetX = data.trimX + (data.width / 2) - (data.rawWidth * data.pivotX)
  const expectedOffsetY = (data.rawHeight * (1 - data.pivotY)) - data.trimY - (data.height / 2)
  assert.equal(data.offsetX, expectedOffsetX, `${relativePath}.meta offsetX must match trim geometry`)
  assert.equal(data.offsetY, expectedOffsetY, `${relativePath}.meta offsetY must match trim geometry`)

  const left = -data.width * data.pivotX
  const right = data.width * (1 - data.pivotX)
  const bottom = -data.height * data.pivotY
  const top = data.height * (1 - data.pivotY)
  const uvTop = data.rawHeight - data.trimY
  const uvBottom = uvTop - data.height
  const expectedUv = [
    data.trimX, uvTop,
    data.trimX + data.width, uvTop,
    data.trimX, uvBottom,
    data.trimX + data.width, uvBottom,
  ]
  const expectedNuv = [
    data.trimX / data.rawWidth, uvBottom / data.rawHeight,
    (data.trimX + data.width) / data.rawWidth, uvBottom / data.rawHeight,
    data.trimX / data.rawWidth, uvTop / data.rawHeight,
    (data.trimX + data.width) / data.rawWidth, uvTop / data.rawHeight,
  ]

  assert.deepEqual(
    data.vertices.rawPosition,
    [left, bottom, 0, right, bottom, 0, left, top, 0, right, top, 0],
    `${relativePath}.meta rawPosition must match trim geometry`,
  )
  assert.deepEqual(data.vertices.indexes, [0, 1, 2, 2, 1, 3], `${relativePath}.meta indexes must be a quad`)
  assert.deepEqual(data.vertices.uv, expectedUv, `${relativePath}.meta UVs must match trim geometry`)
  assertNumberArrayClose(data.vertices.nuv, expectedNuv, `${relativePath}.meta normalized UVs`)
  assert.deepEqual(data.vertices.minPos, [left, bottom, 0], `${relativePath}.meta minPos must match vertices`)
  assert.deepEqual(data.vertices.maxPos, [right, top, 0], `${relativePath}.meta maxPos must match vertices`)
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

test('boss skill VFX transparent pixels are premultiply-safe', async () => {
  for (const assetName of assetNames) {
    const relativePath = `${assetRoot}/${assetName}.png`
    const image = decodePngRgba(await readFile(resolve(root, relativePath)))
    assertTransparentPixelRgbIsZero(image, relativePath)
  }
})

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

    const bounds = visibleBounds(image, visibleAlphaThreshold)
    const trimBounds = visibleBounds(image, trimAlphaThreshold)
    const visibleWidthRatio = (bounds.maxX - bounds.minX + 1) / image.width
    const visibleHeightRatio = (bounds.maxY - bounds.minY + 1) / image.height
    assert.ok(visibleWidthRatio <= 0.9, `${relativePath} visible width must leave transparent padding`)
    assert.ok(visibleHeightRatio <= 0.9, `${relativePath} visible height must leave transparent padding`)
    assert.ok(
      bounds.minX / image.width >= minimumPaddingRatio,
      `${relativePath} must leave at least 8% transparent padding on the left`,
    )
    assert.ok(
      bounds.minY / image.height >= minimumPaddingRatio,
      `${relativePath} must leave at least 8% transparent padding on the top`,
    )
    assert.ok(
      (image.width - bounds.maxX - 1) / image.width >= minimumPaddingRatio,
      `${relativePath} must leave at least 8% transparent padding on the right`,
    )
    assert.ok(
      (image.height - bounds.maxY - 1) / image.height >= minimumPaddingRatio,
      `${relativePath} must leave at least 8% transparent padding on the bottom`,
    )
    assertTransparentEdges(image, relativePath)

    pixelHashes.push(
      createHash('sha256')
        .update(`${image.width}x${image.height}\0`)
        .update(image.data)
        .digest('hex'),
    )

    const meta = JSON.parse(await readFile(resolve(root, `${relativePath}.meta`), 'utf8'))
    const textures = Object.entries(meta.subMetas ?? {}).filter(([, entry]) => entry.importer === 'texture')
    const spriteFrames = Object.entries(meta.subMetas ?? {}).filter(
      ([, entry]) => entry.importer === 'sprite-frame' && entry.name === 'spriteFrame',
    )

    assert.equal(meta.importer, 'image', `${relativePath}.meta must use the image importer`)
    assert.equal(meta.ver, '1.0.27', `${relativePath}.meta must use the Creator 3.8 image version`)
    assert.equal(meta.userData?.hasAlpha, true, `${relativePath}.meta must preserve alpha`)
    assert.equal(meta.uuid, expectedAssetUuids[assetName], `${relativePath}.meta must preserve its image UUID`)
    assert.equal(textures.length, 1, `${relativePath}.meta must expose exactly one texture subMeta`)
    assert.equal(spriteFrames.length, 1, `${relativePath}.meta must expose exactly one /spriteFrame subMeta`)
    const [[textureId, texture]] = textures
    const [[spriteFrameId, spriteFrame]] = spriteFrames

    assert.equal(texture.id, textureId, `${relativePath}.meta texture id must match its subMeta key`)
    assert.equal(texture.uuid, `${meta.uuid}@${textureId}`, `${relativePath}.meta texture UUID must derive from image UUID`)
    assert.equal(texture.userData?.imageUuidOrDatabaseUri, meta.uuid, `${relativePath}.meta texture must reference image UUID`)
    assert.equal(texture.userData?.isUuid, true, `${relativePath}.meta texture image reference must be a UUID`)
    assert.equal(spriteFrame.id, spriteFrameId, `${relativePath}.meta spriteFrame id must match its subMeta key`)
    assert.equal(
      spriteFrame.uuid,
      `${meta.uuid}@${spriteFrameId}`,
      `${relativePath}.meta spriteFrame UUID must derive from image UUID`,
    )
    assert.equal(
      spriteFrame.userData?.imageUuidOrDatabaseUri,
      texture.uuid,
      `${relativePath}.meta spriteFrame must reference texture UUID`,
    )
    assert.equal(spriteFrame.userData?.isUuid, true, `${relativePath}.meta spriteFrame texture reference must be a UUID`)
    assert.equal(meta.userData?.redirect, texture.uuid, `${relativePath}.meta redirect must reference texture UUID`)
    assert.equal(spriteFrame.userData?.rawWidth, image.width, `${relativePath}.meta must match PNG width`)
    assert.equal(spriteFrame.userData?.rawHeight, image.height, `${relativePath}.meta must match PNG height`)
    assert.equal(spriteFrame.userData?.rotated, false, `${relativePath}.meta spriteFrame must not be rotated`)
    assert.equal(spriteFrame.userData?.trimType, 'auto', `${relativePath}.meta spriteFrame must use automatic trim`)
    assertSpriteFrameGeometry(spriteFrame, trimBounds, bounds, relativePath)
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
