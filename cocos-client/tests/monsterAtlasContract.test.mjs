import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const sourcePath = resolve('assets/Data/animation-atlas.json')
const resourcePath = resolve('assets/resources/Data/animation-atlas.json')
const requiredCounts = { idle: 2, move: 4, attack: 4, hurt: 2, death: 4 }

test('source and resource manifests are identical and describe twelve complete monster actors', async () => {
  const source = JSON.parse(await readFile(sourcePath, 'utf8'))
  const resource = JSON.parse(await readFile(resourcePath, 'utf8'))
  assert.deepEqual(resource, source)
  const monsters = source.actors.filter(actor => actor.type === 'monster')
  assert.equal(monsters.length, 12)
  for (const actor of monsters) {
    assert.deepEqual(actor.actions.map(action => action.name), Object.keys(requiredCounts), actor.id)
    for (const action of actor.actions) {
      assert.equal(action.frames.length, requiredCounts[action.name], `${actor.id}/${action.name} frame count`)
      assert.equal(action.order.length, requiredCounts[action.name], `${actor.id}/${action.name} order count`)
      for (const frame of action.frames) {
        assert.ok(Number.isInteger(frame.x) && Number.isInteger(frame.y) && frame.x >= 0 && frame.y >= 0, `${actor.id}/${action.name} grid origin`)
        assert.deepEqual({ w: frame.w, h: frame.h }, actor.frameSize, `${actor.id}/${action.name} frame size`)
        assert.equal(frame.x % actor.frameSize.w, 0, `${actor.id}/${action.name} x grid`)
        assert.equal(frame.y % actor.frameSize.h, 0, `${actor.id}/${action.name} y grid`)
      }
    }
  }
})

test('monster atlas pixels have transparent margins and distinct consecutive frames', () => {
  const script = String.raw`
import json, sys
from collections import deque
from pathlib import Path
from PIL import Image

def connected_components(alpha):
    width, height = alpha.size
    pixels = alpha.load()
    visited = bytearray(width * height)
    found = []
    for start_y in range(height):
        for start_x in range(width):
            offset = start_y * width + start_x
            if visited[offset] or pixels[start_x, start_y] == 0:
                continue
            queue = deque([(start_x, start_y)])
            visited[offset] = 1
            points = []
            while queue:
                x, y = queue.popleft()
                points.append((x, y))
                for nx in range(max(0, x - 1), min(width, x + 2)):
                    for ny in range(max(0, y - 1), min(height, y + 2)):
                        neighbor = ny * width + nx
                        if not visited[neighbor] and pixels[nx, ny] > 0:
                            visited[neighbor] = 1
                            queue.append((nx, ny))
            found.append(points)
    return found

root = Path(sys.argv[1])
manifest = json.loads((root / 'assets/Data/animation-atlas.json').read_text(encoding='utf-8'))
errors = []
for actor in [item for item in manifest['actors'] if item['type'] == 'monster']:
    for action in actor['actions']:
        atlas = Image.open(root / 'assets/resources' / action['atlas']).convert('RGBA')
        previous = None
        for index, rect in enumerate(action['frames']):
            box = (rect['x'], rect['y'], rect['x'] + rect['w'], rect['y'] + rect['h'])
            if box[2] > atlas.width or box[3] > atlas.height:
                errors.append(f"{actor['id']}/{action['name']}[{index}] outside atlas")
                continue
            frame = atlas.crop(box)
            alpha = frame.getchannel('A')
            bounds = alpha.getbbox()
            if bounds is None:
                errors.append(f"{actor['id']}/{action['name']}[{index}] empty")
            else:
                left, top, right, bottom = bounds
                margin = min(left / rect['w'], top / rect['h'], (rect['w'] - right) / rect['w'], (rect['h'] - bottom) / rect['h'])
                if margin < 0.08:
                    errors.append(f"{actor['id']}/{action['name']}[{index}] margin {margin:.3f} < 0.08")
                components = sorted(connected_components(alpha), key=len, reverse=True)
                largest_xs = [point[0] for point in components[0]]
                largest_ys = [point[1] for point in components[0]]
                largest_box = (min(largest_xs), min(largest_ys), max(largest_xs), max(largest_ys))
                for component in components[1:]:
                    if len(component) < 4:
                        continue
                    xs = [point[0] for point in component]
                    ys = [point[1] for point in component]
                    near_safe_edge = min(xs) <= 30 or min(ys) <= 30 or max(xs) >= rect['w'] - 31 or max(ys) >= rect['h'] - 31
                    horizontal_gap = max(largest_box[0] - max(xs) - 1, min(xs) - largest_box[2] - 1, 0)
                    vertical_gap = max(largest_box[1] - max(ys) - 1, min(ys) - largest_box[3] - 1, 0)
                    if near_safe_edge or horizontal_gap > 6 or vertical_gap > 6:
                        errors.append(f"{actor['id']}/{action['name']}[{index}] isolated fragment area {len(component)}")
            digest = frame.tobytes()
            if previous == digest:
                errors.append(f"{actor['id']}/{action['name']}[{index}] identical to previous")
            previous = digest
if errors:
    print('\n'.join(errors))
    raise SystemExit(1)
`
  const result = spawnSync('python', ['-c', script, resolve('.')], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stdout || result.stderr)
})
