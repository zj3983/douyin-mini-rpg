import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

test('Mist Bamboo Emperor source size is truthful and boundary matte is removed', () => {
  const manifest = JSON.parse(readFileSync(new URL('../assets/Data/vertical-slice-animation-sources.json', import.meta.url), 'utf8'))
  const actor = manifest.actors['mist-bamboo-emperor']
  assert.deepEqual(actor.masterFrameSize, [256, 320])

  const script = String.raw`
from pathlib import Path
from PIL import Image
import sys

root = Path(sys.argv[1]) / 'art-source/vertical-slice/mist-bamboo-emperor'
worst = 0.0
for path in root.rglob('*.png'):
    image = Image.open(path).convert('RGBA')
    assert image.size == (256, 320), (path, image.size)
    pixels = image.load()
    visible = 0
    matte = 0
    for y in range(image.height):
        for x in range(image.width):
            red, green, blue, alpha = pixels[x, y]
            if alpha >= 32:
                visible += 1
            if alpha >= 96 and min(red, green, blue) >= 225 and max(red, green, blue) - min(red, green, blue) <= 24:
                neighbors = ((max(0, x - 1), y), (min(image.width - 1, x + 1), y), (x, max(0, y - 1)), (x, min(image.height - 1, y + 1)))
                if any(pixels[nx, ny][3] < 32 for nx, ny in neighbors):
                    matte += 1
    worst = max(worst, matte / max(1, visible))
print(worst)
`
  const result = spawnSync('python', ['-c', script, process.cwd()], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stdout || result.stderr)
  assert.ok(Number(result.stdout.trim()) < 0.012, `white boundary ratio ${result.stdout.trim()}`)
})
