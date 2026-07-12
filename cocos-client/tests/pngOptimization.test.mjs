import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import test from 'node:test'

const clientRoot = resolve(import.meta.dirname, '..')
const scriptPath = resolve(clientRoot, 'tools', 'optimize-runtime-pngs.py')
const python = process.env.PYTHON ?? 'python'

function runPython(code, args = [], options = {}) {
  return spawnSync(python, ['-c', code, ...args], {
    cwd: clientRoot,
    encoding: 'utf8',
    ...options,
  })
}

function loadScriptPrelude() {
  return `
import importlib.util
import pathlib
import sys
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("png_optimizer", pathlib.Path(sys.argv[1]))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
`
}

function createFixture(path, { width = 64, height = 64, alphaOffset = 0, rgbOffset = 0, compressLevel = 0 } = {}) {
  mkdirSync(dirname(path), { recursive: true })
  const result = runPython(`
from PIL import Image
import pathlib
import sys
width, height, alpha_offset, rgb_offset, compress_level = map(int, sys.argv[2:])
pixels = []
for y in range(height):
    for x in range(width):
        pixels.append(((x * 4 + rgb_offset) % 256, (y * 4 + rgb_offset) % 256,
                       ((x + y) * 2 + rgb_offset) % 256, (x * 7 + y * 11 + alpha_offset) % 256))
image = Image.new("RGBA", (width, height))
image.putdata(pixels)
image.save(pathlib.Path(sys.argv[1]), compress_level=compress_level)
`, [path, String(width), String(height), String(alphaOffset), String(rgbOffset), String(compressLevel)])
  assert.equal(result.status, 0, result.stderr)
}

function invokeModule(expression, args = []) {
  const result = runPython(`${loadScriptPrelude()}\n${expression}`, [scriptPath, ...args])
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim() ? JSON.parse(result.stdout) : undefined
}

function snapshot(path) {
  return readFileSync(path).toString('hex')
}

test('discovers only runtime PNGs in stable relative-path order', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-png-discovery-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const included = [
    'assets/resources/Assets/ActorAtlases/Zeta/atlas.png',
    'assets/resources/Assets/ActorAtlases/Alpha/atlas.PNG',
    'assets/resources/Assets/World/Stage/far.png',
    'assets/resources/Assets/Generated/Atlases/ui.png',
  ]
  const excluded = [
    'assets/resources/Assets/ActorAtlases/Alpha/motion/idle.png',
    'assets/resources/Assets/Portraits/hero.png',
    'assets/resources/Assets/Generated/Skills/fire.png',
    'assets/resources/Assets/Generated/Atlases/ui.png.meta',
  ]
  for (const path of [...included, ...excluded]) {
    const absolutePath = join(root, path)
    mkdirSync(dirname(absolutePath), { recursive: true })
    writeFileSync(absolutePath, 'fixture')
  }

  const discovered = invokeModule(`
import json
root = pathlib.Path(sys.argv[2])
print(json.dumps([path.relative_to(root).as_posix() for path in module.discover_runtime_pngs(root)]))
`, [root])

  assert.deepEqual(discovered, [...included].sort((a, b) => a.localeCompare(b)))
})

test('validates dimensions, every alpha byte, and RGB PSNR with exact rejection reasons', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-png-validation-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const source = join(root, 'source.png')
  const dimensions = join(root, 'dimensions.png')
  const alpha = join(root, 'alpha.png')
  const lowPsnr = join(root, 'low-psnr.png')
  createFixture(source)
  createFixture(dimensions, { width: 63 })
  createFixture(alpha, { alphaOffset: 1 })
  createFixture(lowPsnr, { rgbOffset: 100 })

  const result = invokeModule(`
import json
source = pathlib.Path(sys.argv[2])
print(json.dumps({
  pathlib.Path(candidate).stem: module.validate_candidate(source, pathlib.Path(candidate), min_psnr=42.0)["reason"]
  for candidate in sys.argv[3:]
}))
`, [source, dimensions, alpha, lowPsnr])

  assert.deepEqual(result, {
    dimensions: 'dimensions-changed',
    alpha: 'alpha-changed',
    'low-psnr': 'psnr-below-threshold',
  })
})

test('optimize_png rejects changed dimensions, alpha, and low PSNR without changing source bytes', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-png-public-rejections-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const source = join(root, 'source.png')
  const dimensions = join(root, 'dimensions.png')
  const alpha = join(root, 'alpha.png')
  const lowPsnr = join(root, 'low-psnr.png')
  createFixture(source)
  createFixture(dimensions, { width: 63 })
  createFixture(alpha, { alphaOffset: 1 })
  createFixture(lowPsnr, { rgbOffset: 100 })

  const result = invokeModule(`
import json
import shutil
from unittest.mock import patch

source = pathlib.Path(sys.argv[2])
before = source.read_bytes()
results = {}
for candidate_name in sys.argv[3:]:
    candidate = pathlib.Path(candidate_name)
    with patch.object(module, "_write_candidate", side_effect=lambda _source, temporary, fixture=candidate: shutil.copyfile(fixture, temporary)):
        optimized = module.optimize_png(source, apply=True, min_psnr=42.0)
    results[candidate.stem] = {
        "reason": optimized["reason"],
        "sourceUnchanged": source.read_bytes() == before,
    }
print(json.dumps(results))
`, [source, dimensions, alpha, lowPsnr])

  assert.deepEqual(result, {
    dimensions: { reason: 'dimensions-changed', sourceUnchanged: true },
    alpha: { reason: 'alpha-changed', sourceUnchanged: true },
    'low-psnr': { reason: 'psnr-below-threshold', sourceUnchanged: true },
  })
})

test('accepts only a strictly smaller candidate and preserves dimensions, alpha, and PSNR', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-png-accepted-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const source = join(root, 'asset.png')
  createFixture(source)
  const beforeBytes = readFileSync(source).length

  const result = invokeModule(`
import json
result = module.optimize_png(pathlib.Path(sys.argv[2]), apply=True)
print(json.dumps(result))
`, [source])

  assert.equal(result.accepted, true)
  assert.equal(result.reason, null)
  assert.equal(result.originalBytes, beforeBytes)
  assert.equal(result.candidateBytes < result.originalBytes, true)
  assert.equal(result.psnr >= 42, true)

  const validation = runPython(`
from PIL import Image
import json
import sys
with Image.open(sys.argv[1]) as image:
    rgba = image.convert("RGBA")
    print(json.dumps({"size": list(rgba.size), "alpha": list(rgba.getchannel("A").tobytes())}))
`, [source])
  assert.equal(validation.status, 0, validation.stderr)
  const decoded = JSON.parse(validation.stdout)
  assert.deepEqual(decoded.size, [64, 64])
  assert.equal(decoded.alpha.length, 64 * 64)
  assert.deepEqual(
    decoded.alpha.slice(0, 128),
    Array.from({ length: 128 }, (_, index) => ((index % 64) * 7 + Math.floor(index / 64) * 11) % 256),
  )
})

test('rejects a candidate that is not smaller and leaves source bytes untouched', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-png-rejected-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const source = join(root, 'asset.png')
  createFixture(source)
  const first = invokeModule(`
import json
print(json.dumps(module.optimize_png(pathlib.Path(sys.argv[2]), apply=True)))
`, [source])
  assert.equal(first.accepted, true)
  const before = snapshot(source)

  const result = invokeModule(`
import json
result = module.optimize_png(pathlib.Path(sys.argv[2]), apply=True)
print(json.dumps(result))
`, [source])

  assert.equal(result.accepted, false)
  assert.equal(result.reason, 'not-smaller')
  assert.equal(snapshot(source), before)
})

test('produces identical applied bytes for identical inputs and parameters', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-png-deterministic-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const first = join(root, 'first.png')
  const second = join(root, 'second.png')
  createFixture(first)
  writeFileSync(second, readFileSync(first))

  invokeModule(`module.optimize_png(pathlib.Path(sys.argv[2]), apply=True)`, [first])
  invokeModule(`module.optimize_png(pathlib.Path(sys.argv[2]), apply=True)`, [second])

  assert.equal(snapshot(first), snapshot(second))
})

test('--check evaluates files without changing source bytes and emits JSON lines plus totals', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-png-check-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const asset = join(root, 'assets/resources/Assets/World/Fixture/far.png')
  createFixture(asset)
  const before = snapshot(asset)

  const result = spawnSync(python, [scriptPath, '--check', '--project-root', root], { encoding: 'utf8' })

  assert.equal(result.status, 0, result.stderr)
  assert.equal(snapshot(asset), before)
  const lines = result.stdout.trim().split(/\r?\n/).map((line) => JSON.parse(line))
  assert.equal(lines.length, 2)
  assert.equal(lines[0].path, relative(root, asset).replaceAll('\\', '/'))
  assert.deepEqual(lines[1], {
    totals: {
      files: 1,
      accepted: 1,
      originalBytes: lines[0].originalBytes,
      candidateBytes: lines[0].candidateBytes,
      savedBytes: lines[0].originalBytes - lines[0].candidateBytes,
    },
  })
})

test('CLI rejects --check and --apply together', () => {
  const result = spawnSync(python, [scriptPath, '--check', '--apply'], { encoding: 'utf8' })

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /not allowed with argument|mutually exclusive/i)
})

test('CLI resolves the default project root from its own tools directory', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-png-default-root-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const copiedScript = join(root, 'cocos-client', 'tools', 'optimize-runtime-pngs.py')
  const asset = join(root, 'cocos-client', 'assets/resources/Assets/World/Fixture/far.png')
  mkdirSync(dirname(copiedScript), { recursive: true })
  copyFileSync(scriptPath, copiedScript)
  createFixture(asset)

  const result = spawnSync(python, [copiedScript, '--check'], {
    cwd: root,
    encoding: 'utf8',
  })

  assert.equal(result.status, 0, result.stderr)
  const lines = result.stdout.trim().split(/\r?\n/).map((line) => JSON.parse(line))
  assert.equal(lines[0].path, 'assets/resources/Assets/World/Fixture/far.png')
  assert.equal(lines.at(-1).totals.files, 1)
})

test('CLI exits nonzero for an invalid PNG and identifies its project-relative path', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-png-invalid-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const relativeAsset = 'assets/resources/Assets/World/Broken/broken.png'
  const asset = join(root, relativeAsset)
  mkdirSync(dirname(asset), { recursive: true })
  writeFileSync(asset, 'not a png')

  const result = spawnSync(python, [scriptPath, '--check', '--project-root', root], { encoding: 'utf8' })

  assert.notEqual(result.status, 0)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /Failed to optimize assets\/resources\/Assets\/World\/Broken\/broken\.png:/)
})

test('temporary candidate is removed after a successful apply', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-png-cleanup-success-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const asset = join(root, 'asset.png')
  createFixture(asset)

  const result = invokeModule(`
import json
print(json.dumps(module.optimize_png(pathlib.Path(sys.argv[2]), apply=True)))
`, [asset])

  assert.equal(result.accepted, true)
  assert.deepEqual(readdirSync(root), ['asset.png'])
})

test('temporary candidates are removed after not-smaller and quality rejections', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-png-cleanup-rejections-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const notSmaller = join(root, 'not-smaller.png')
  const lowQuality = join(root, 'low-quality.png')
  createFixture(notSmaller)
  createFixture(lowQuality)

  const results = invokeModule(`
import json
not_smaller = pathlib.Path(sys.argv[2])
low_quality = pathlib.Path(sys.argv[3])
module.optimize_png(not_smaller, apply=True)
print(json.dumps([
    module.optimize_png(not_smaller, apply=True)["reason"],
    module.optimize_png(low_quality, apply=True, min_psnr=1000.0)["reason"],
]))
`, [notSmaller, lowQuality])

  assert.deepEqual(results, ['not-smaller', 'psnr-below-threshold'])
  assert.deepEqual(readdirSync(root).sort(), ['low-quality.png', 'not-smaller.png'])
})

test('temporary candidate is removed when processing raises', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-png-cleanup-error-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const asset = join(root, 'asset.png')
  createFixture(asset)

  const result = invokeModule(`
import json
from unittest.mock import patch

def fail_after_write(_source, candidate):
    candidate.write_bytes(b"partial candidate")
    raise RuntimeError("fixture processing failure")

try:
    with patch.object(module, "_write_candidate", side_effect=fail_after_write):
        module.optimize_png(pathlib.Path(sys.argv[2]), apply=True)
except RuntimeError as error:
    print(json.dumps({"error": str(error)}))
`, [asset])

  assert.equal(result.error, 'fixture processing failure')
  assert.deepEqual(readdirSync(root), ['asset.png'])
})

test('apply=False never replaces while accepted apply=True replaces exactly once', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-png-replace-spy-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const checkAsset = join(root, 'check.png')
  const applyAsset = join(root, 'apply.png')
  createFixture(checkAsset)
  copyFileSync(checkAsset, applyAsset)
  const checkBefore = snapshot(checkAsset)
  const applyBefore = snapshot(applyAsset)

  const result = invokeModule(`
import json
from unittest.mock import patch

original_replace = pathlib.Path.replace
calls = []
def replace_spy(candidate, target):
    calls.append([candidate.name, pathlib.Path(target).name])
    return original_replace(candidate, target)

with patch.object(pathlib.Path, "replace", replace_spy):
    checked = module.optimize_png(pathlib.Path(sys.argv[2]), apply=False)
    check_calls = len(calls)
    applied = module.optimize_png(pathlib.Path(sys.argv[3]), apply=True)

print(json.dumps({
    "checkedAccepted": checked["accepted"],
    "appliedAccepted": applied["accepted"],
    "checkCalls": check_calls,
    "totalCalls": len(calls),
}))
`, [checkAsset, applyAsset])

  assert.deepEqual(result, {
    checkedAccepted: true,
    appliedAccepted: true,
    checkCalls: 0,
    totalCalls: 1,
  })
  assert.equal(snapshot(checkAsset), checkBefore)
  assert.notEqual(snapshot(applyAsset), applyBefore)
  assert.deepEqual(readdirSync(root).sort(), ['apply.png', 'check.png'])
})

test('package exposes the runtime PNG optimization command', () => {
  const packageJson = JSON.parse(readFileSync(resolve(clientRoot, 'package.json'), 'utf8'))
  assert.equal(packageJson.scripts['optimize:png'], 'python tools/optimize-runtime-pngs.py --apply')
})
