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

    assert.equal(image.width, image.height, `${relativePath} must be square`)
    assert.ok(image.width >= 512 && image.width <= 2048, `${relativePath} must be 512-2048px wide`)
    assert.ok(alpha.includes(0), `${relativePath} must contain transparent pixels`)
    assert.ok(alpha.some((value) => value > 180), `${relativePath} must contain a clearly opaque subject`)

    hashes.push(createHash('sha256').update(bytes).digest('hex'))
  }

  assert.equal(new Set(hashes).size, talismanPaths.length, 'boss talisman artwork must be distinct')
})
