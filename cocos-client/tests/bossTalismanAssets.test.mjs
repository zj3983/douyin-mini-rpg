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
      if (image.data[index] > 180) {
        const pixelIndex = (index - 3) / 4
        const x = pixelIndex % image.width
        const y = Math.floor(pixelIndex / image.width)
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }

    assert.equal(image.width, image.height, `${relativePath} must be square`)
    assert.ok(image.width >= 512 && image.width <= 2048, `${relativePath} must be 512-2048px wide`)
    assert.ok(alpha.includes(0), `${relativePath} must contain transparent pixels`)
    assert.ok(alpha.some((value) => value > 180), `${relativePath} must contain a clearly opaque subject`)

    const inset = Math.floor(image.width * 0.08)
    assert.ok(minX >= inset, `${relativePath} must have generous left padding`)
    assert.ok(minY >= inset, `${relativePath} must have generous top padding`)
    assert.ok(maxX < image.width - inset, `${relativePath} must have generous right padding`)
    assert.ok(maxY < image.height - inset, `${relativePath} must have generous bottom padding`)

    hashes.push(createHash('sha256').update(bytes).digest('hex'))
  }

  assert.equal(new Set(hashes).size, talismanPaths.length, 'boss talisman artwork must be distinct')
})
