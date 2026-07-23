import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'

import { decodePngRgba } from '../tools/png-alpha-runtime.mjs'

const root = resolve(import.meta.dirname, '..')
const talismanPaths = [
  'assets/resources/Assets/Skills/BossDomain/talisman_sweep.png',
  'assets/resources/Assets/Skills/BossDomain/talisman_spike.png',
  'assets/resources/Assets/Skills/BossDomain/talisman_roar.png',
]

test('boss talisman core assets are distinct square RGBA sprites with transparency', async () => {
  const hashes = []

  for (const relativePath of talismanPaths) {
    const bytes = await readFile(resolve(root, relativePath))
    const image = decodePngRgba(bytes)
    const alpha = image.data.filter((_, index) => index % 4 === 3)
    let minX = image.width
    let minY = image.height
    let maxX = -1
    let maxY = -1
    for (let index = 3; index < image.data.length; index += 4) {
      if (image.data[index] > 8) {
        const pixelIndex = (index - 3) / 4
        const x = pixelIndex % image.width
        const y = Math.floor(pixelIndex / image.width)
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }

    assert.equal(image.width, 512, `${relativePath} must be 512px wide`)
    assert.equal(image.height, 512, `${relativePath} must be 512px high`)
    assert.ok(bytes.length <= 300_000, `${relativePath} must stay within the encoded PNG budget`)
    assert.ok(alpha.includes(0), `${relativePath} must contain transparent pixels`)
    assert.ok(alpha.some((value) => value > 180), `${relativePath} must contain a clearly opaque subject`)

    const visibleWidthRatio = (maxX - minX + 1) / image.width
    const visibleHeightRatio = (maxY - minY + 1) / image.height
    assert.ok(visibleWidthRatio >= 0.65 && visibleWidthRatio <= 0.75, `${relativePath} must have a normalized visible width`)
    assert.ok(visibleHeightRatio >= 0.65 && visibleHeightRatio <= 0.75, `${relativePath} must have a normalized visible height`)

    const inset = Math.ceil(image.width * 0.08)
    assert.ok(minX >= inset, `${relativePath} must have generous left padding`)
    assert.ok(minY >= inset, `${relativePath} must have generous top padding`)
    assert.ok(image.width - 1 - maxX >= inset, `${relativePath} must have generous right padding`)
    assert.ok(image.height - 1 - maxY >= inset, `${relativePath} must have generous bottom padding`)

    hashes.push(
      createHash('sha256')
        .update(`${image.width}x${image.height}\0`)
        .update(image.data)
        .digest('hex'),
    )
  }

  assert.equal(new Set(hashes).size, talismanPaths.length, 'boss talisman artwork must be distinct')
})
