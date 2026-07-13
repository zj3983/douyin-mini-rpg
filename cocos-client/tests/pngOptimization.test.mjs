import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
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

function createChannelFixture(path, mode, { width = 64, height = 64, compressLevel = 0 } = {}) {
  mkdirSync(dirname(path), { recursive: true })
  const result = runPython(`
from PIL import Image
import pathlib
import sys
mode = sys.argv[2]
width, height, compress_level = map(int, sys.argv[3:])
pixels = []
for y in range(height):
    for x in range(width):
        rgb = ((x * 4) % 256, (y * 4) % 256, ((x + y) * 2) % 256)
        if mode == "RGB":
            pixels.append(rgb)
        elif mode == "opaque-rgba":
            pixels.append((*rgb, 255))
        elif mode == "transparent-rgba":
            pixels.append((*rgb, (x * 7 + y * 11) % 256))
        else:
            raise ValueError(f"unsupported fixture mode: {mode}")
image_mode = "RGB" if mode == "RGB" else "RGBA"
image = Image.new(image_mode, (width, height))
image.putdata(pixels)
image.save(pathlib.Path(sys.argv[1]), compress_level=compress_level)
`, [path, mode, String(width), String(height), String(compressLevel)])
  assert.equal(result.status, 0, result.stderr)
}

function createTransparencyFixture(path, kind, { width = 64, height = 64, compressLevel = 0 } = {}) {
  mkdirSync(dirname(path), { recursive: true })
  const result = runPython(`
from PIL import Image
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
kind = sys.argv[2]
width, height, compress_level = map(int, sys.argv[3:])
pixel_count = width * height

if kind.startswith("palette-"):
    image = Image.new("P", (width, height))
    palette = []
    for index in range(256):
        palette.extend(((index * 4) % 256, (index * 6) % 256, (index * 10) % 256))
    image.putpalette(palette)
    if kind == "palette-unused-index":
        image.putdata([index % 2 for index in range(pixel_count)])
        transparency = 2
    elif kind == "palette-opaque-table":
        image.putdata([index % 4 for index in range(pixel_count)])
        transparency = bytes([255] * 256)
    elif kind == "palette-used-index":
        image.putdata([index % 2 for index in range(pixel_count)])
        transparency = bytes([255, 64])
    else:
        raise ValueError(f"unsupported fixture kind: {kind}")
    image.save(path, transparency=transparency, compress_level=compress_level)
elif kind.startswith("l-trns-"):
    image = Image.new("L", (width, height))
    if kind == "l-trns-unused":
        image.putdata([(index * 2) % 256 for index in range(pixel_count)])
        transparency = 127
    elif kind == "l-trns-used":
        image.putdata([128 if index % 3 == 0 else 64 for index in range(pixel_count)])
        transparency = 128
    else:
        raise ValueError(f"unsupported fixture kind: {kind}")
    image.save(path, transparency=transparency, compress_level=compress_level)
elif kind.startswith("la-"):
    image = Image.new("LA", (width, height))
    if kind == "la-opaque":
        image.putdata([((index * 2) % 256, 255) for index in range(pixel_count)])
    elif kind == "la-transparent":
        image.putdata([((index * 2) % 256, 80 if index % 3 == 0 else 255) for index in range(pixel_count)])
    else:
        raise ValueError(f"unsupported fixture kind: {kind}")
    image.save(path, compress_level=compress_level)
else:
    raise ValueError(f"unsupported fixture kind: {kind}")
`, [path, kind, String(width), String(height), String(compressLevel)])
  assert.equal(result.status, 0, result.stderr)
}

function optimizeAndInspectTransparency(path) {
  return invokeModule(`
import json
from PIL import Image

source = pathlib.Path(sys.argv[2])
with Image.open(source) as before:
    before.load()
    source_mode = before.mode
    source_has_transparency_metadata = "transparency" in before.info
    source_alpha = before.convert("RGBA").getchannel("A").tobytes()
optimized = module.optimize_png(source, apply=True)
with Image.open(source) as after:
    after.load()
    after_alpha = after.convert("RGBA").getchannel("A").tobytes()
    after_mode = after.mode
    after_has_transparency_metadata = "transparency" in after.info
print(json.dumps({
    "accepted": optimized["accepted"],
    "sourceMode": source_mode,
    "sourceHasTransparencyMetadata": source_has_transparency_metadata,
    "sourceAlphaExtrema": [min(source_alpha), max(source_alpha)],
    "afterMode": after_mode,
    "afterHasTransparencyMetadata": after_has_transparency_metadata,
    "alphaUnchanged": after_alpha == source_alpha,
}))
`, [path])
}

function invokeModule(expression, args = []) {
  const result = runPython(`${loadScriptPrelude()}\n${expression}`, [scriptPath, ...args])
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim() ? JSON.parse(result.stdout.replace(/\bInfinity\b/g, '1e999')) : undefined
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
    with patch.object(module, "_encode_candidate", side_effect=lambda _source, fixture=candidate: fixture.read_bytes()):
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

test('RGB apply keeps the accepted PNG free of alpha channels and transparency metadata', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-png-rgb-mode-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const source = join(root, 'asset.png')
  createChannelFixture(source, 'RGB')

  const result = invokeModule(`
import io
import json
from PIL import Image

source = pathlib.Path(sys.argv[2])
candidate_data = module._encode_candidate(source)
with Image.open(io.BytesIO(candidate_data)) as candidate:
    candidate.load()
    candidate_mode = candidate.mode
    candidate_bands = candidate.getbands()
    candidate_transparency = "transparency" in candidate.info
optimized = module.optimize_png(source, apply=True)
with Image.open(source) as final:
    final.load()
    final_mode = final.mode
    final_bands = final.getbands()
    final_transparency = "transparency" in final.info
print(json.dumps({
    "accepted": optimized["accepted"],
    "candidateMode": candidate_mode,
    "candidateBands": candidate_bands,
    "candidateTransparency": candidate_transparency,
    "finalMode": final_mode,
    "finalBands": final_bands,
    "finalTransparency": final_transparency,
}))
`, [source])

  assert.deepEqual(result, {
    accepted: true,
    candidateMode: 'RGB',
    candidateBands: ['R', 'G', 'B'],
    candidateTransparency: false,
    finalMode: 'RGB',
    finalBands: ['R', 'G', 'B'],
    finalTransparency: false,
  })
})

test('fully opaque RGBA apply normalizes to smaller RGB without changing visual alpha semantics', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-png-opaque-rgba-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const source = join(root, 'asset.png')
  createChannelFixture(source, 'opaque-rgba')

  const result = invokeModule(`
import json
from PIL import Image

source = pathlib.Path(sys.argv[2])
before_bytes = source.stat().st_size
with Image.open(source) as before:
    before.load()
    before_alpha = before.convert("RGBA").getchannel("A").tobytes()
optimized = module.optimize_png(source, apply=True)
with Image.open(source) as after:
    after.load()
    after_mode = after.mode
    after_bands = after.getbands()
    after_transparency = "transparency" in after.info
    after_alpha = after.convert("RGBA").getchannel("A").tobytes()
print(json.dumps({
    "accepted": optimized["accepted"],
    "smaller": source.stat().st_size < before_bytes,
    "mode": after_mode,
    "bands": after_bands,
    "transparency": after_transparency,
    "alphaUnchanged": after_alpha == before_alpha,
    "alphaExtrema": [min(after_alpha), max(after_alpha)],
}))
`, [source])

  assert.deepEqual(result, {
    accepted: true,
    smaller: true,
    mode: 'RGB',
    bands: ['R', 'G', 'B'],
    transparency: false,
    alphaUnchanged: true,
    alphaExtrema: [255, 255],
  })
})

test('RGBA with actual transparency keeps RGBA mode and every source alpha byte', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-png-transparent-rgba-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const source = join(root, 'asset.png')
  createChannelFixture(source, 'transparent-rgba')

  const result = invokeModule(`
import json
from PIL import Image

source = pathlib.Path(sys.argv[2])
with Image.open(source) as before:
    before.load()
    before_alpha = before.convert("RGBA").getchannel("A").tobytes()
optimized = module.optimize_png(source, apply=True)
with Image.open(source) as after:
    after.load()
    after_alpha = after.convert("RGBA").getchannel("A").tobytes()
    after_mode = after.mode
print(json.dumps({
    "accepted": optimized["accepted"],
    "mode": after_mode,
    "alphaUnchanged": after_alpha == before_alpha,
    "hasActualTransparency": min(after_alpha) < 255,
}))
`, [source])

  assert.deepEqual(result, {
    accepted: true,
    mode: 'RGBA',
    alphaUnchanged: true,
    hasActualTransparency: true,
  })
})

test('palette unused transparent index normalizes to RGB from decoded opaque pixels', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-png-palette-unused-transparency-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const unusedIndex = join(root, 'unused-index.png')
  createTransparencyFixture(unusedIndex, 'palette-unused-index')

  assert.deepEqual(optimizeAndInspectTransparency(unusedIndex), {
    accepted: true,
    sourceMode: 'P',
    sourceHasTransparencyMetadata: true,
    sourceAlphaExtrema: [255, 255],
    afterMode: 'RGB',
    afterHasTransparencyMetadata: false,
    alphaUnchanged: true,
  })
})

test('palette all-255 transparency table normalizes to RGB from decoded opaque pixels', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-png-palette-opaque-table-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const opaqueTable = join(root, 'opaque-table.png')
  createTransparencyFixture(opaqueTable, 'palette-opaque-table')

  assert.deepEqual(optimizeAndInspectTransparency(opaqueTable), {
    accepted: true,
    sourceMode: 'P',
    sourceHasTransparencyMetadata: true,
    sourceAlphaExtrema: [255, 255],
    afterMode: 'RGB',
    afterHasTransparencyMetadata: false,
    alphaUnchanged: true,
  })
})

test('palette used transparent index keeps RGBA and every decoded alpha byte', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-png-palette-used-transparency-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const usedIndex = join(root, 'used-index.png')
  createTransparencyFixture(usedIndex, 'palette-used-index')

  assert.deepEqual(optimizeAndInspectTransparency(usedIndex), {
    accepted: true,
    sourceMode: 'P',
    sourceHasTransparencyMetadata: true,
    sourceAlphaExtrema: [64, 255],
    afterMode: 'RGBA',
    afterHasTransparencyMetadata: false,
    alphaUnchanged: true,
  })
})

test('L tRNS transparency is based on whether decoded pixels use the transparent value', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-png-l-transparency-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const unused = join(root, 'unused.png')
  const used = join(root, 'used.png')
  createTransparencyFixture(unused, 'l-trns-unused')
  createTransparencyFixture(used, 'l-trns-used')

  assert.deepEqual(optimizeAndInspectTransparency(unused), {
    accepted: true,
    sourceMode: 'L',
    sourceHasTransparencyMetadata: true,
    sourceAlphaExtrema: [255, 255],
    afterMode: 'RGB',
    afterHasTransparencyMetadata: false,
    alphaUnchanged: true,
  })
  assert.deepEqual(optimizeAndInspectTransparency(used), {
    accepted: true,
    sourceMode: 'L',
    sourceHasTransparencyMetadata: true,
    sourceAlphaExtrema: [0, 255],
    afterMode: 'RGBA',
    afterHasTransparencyMetadata: false,
    alphaUnchanged: true,
  })
})

test('LA transparency is based on decoded alpha extrema and preserves every alpha byte', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-png-la-transparency-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const opaque = join(root, 'opaque.png')
  const transparent = join(root, 'transparent.png')
  createTransparencyFixture(opaque, 'la-opaque')
  createTransparencyFixture(transparent, 'la-transparent')

  assert.deepEqual(optimizeAndInspectTransparency(opaque), {
    accepted: true,
    sourceMode: 'LA',
    sourceHasTransparencyMetadata: false,
    sourceAlphaExtrema: [255, 255],
    afterMode: 'RGB',
    afterHasTransparencyMetadata: false,
    alphaUnchanged: true,
  })
  assert.deepEqual(optimizeAndInspectTransparency(transparent), {
    accepted: true,
    sourceMode: 'LA',
    sourceHasTransparencyMetadata: false,
    sourceAlphaExtrema: [80, 255],
    afterMode: 'RGBA',
    afterHasTransparencyMetadata: false,
    alphaUnchanged: true,
  })
})

test('validation explicitly rejects dropping the alpha channel from an actually transparent source', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-png-alpha-dropped-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const source = join(root, 'source.png')
  const candidate = join(root, 'candidate.png')
  createChannelFixture(source, 'transparent-rgba')
  createChannelFixture(candidate, 'RGB')

  const result = invokeModule(`
import json
validated = module.validate_candidate(
    pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3]), min_psnr=0.0
)
print(json.dumps({"accepted": validated["accepted"], "reason": validated["reason"]}))
`, [source, candidate])

  assert.deepEqual(result, { accepted: false, reason: 'alpha-dropped' })
})

test('apply=False evaluates the normalized output mode in memory and never writes it', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-png-check-mode-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const source = join(root, 'asset.png')
  createChannelFixture(source, 'opaque-rgba')
  const before = snapshot(source)

  const result = invokeModule(`
import io
import json
from PIL import Image
from unittest.mock import patch

source = pathlib.Path(sys.argv[2])
observed_modes = []
original_validate = module._validate_candidate_bytes
def validate_spy(source_path, candidate_data, *, min_psnr):
    with Image.open(io.BytesIO(candidate_data)) as candidate:
        candidate.load()
        observed_modes.append(candidate.mode)
    return original_validate(source_path, candidate_data, min_psnr=min_psnr)

with patch.object(module, "_validate_candidate_bytes", side_effect=validate_spy), patch.object(
    module, "_replace_with_validated_bytes", side_effect=AssertionError("source replacement attempted")
):
    optimized = module.optimize_png(source, apply=False)
print(json.dumps({"accepted": optimized["accepted"], "observedModes": observed_modes}))
`, [source])

  assert.deepEqual(result, { accepted: true, observedModes: ['RGB'] })
  assert.equal(snapshot(source), before)
  assert.deepEqual(readdirSync(root), ['asset.png'])
})

test('two opaque RGBA apply runs are byte-idempotent after RGB normalization', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-png-mode-idempotent-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const source = join(root, 'asset.png')
  createChannelFixture(source, 'opaque-rgba')

  const first = invokeModule(`
import json
print(json.dumps(module.optimize_png(pathlib.Path(sys.argv[2]), apply=True)))
`, [source])
  const afterFirst = snapshot(source)
  const second = invokeModule(`
import json
print(json.dumps(module.optimize_png(pathlib.Path(sys.argv[2]), apply=True)))
`, [source])

  assert.equal(first.accepted, true)
  assert.equal(second.accepted, false)
  assert.equal(second.reason, 'not-smaller')
  assert.equal(snapshot(source), afterFirst)
})

test('lossless RGB candidates use infinite PSNR and pass any finite threshold', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-png-infinite-psnr-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const source = join(root, 'asset.png')
  createFixture(source)

  const result = invokeModule(`
import json
import math
optimized = module.optimize_png(pathlib.Path(sys.argv[2]), apply=False, min_psnr=1000.0)
print(json.dumps({
    "accepted": optimized["accepted"],
    "infinite": math.isinf(optimized["psnr"]),
    "reason": optimized["reason"],
}))
`, [source])

  assert.deepEqual(result, { accepted: true, infinite: true, reason: null })
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
  assert.equal(lines[0].psnr, 'infinite')
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

test('apply=False evaluates entirely in memory without creating a temporary directory entry', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-png-memory-check-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const asset = join(root, 'asset.png')
  createFixture(asset)

  const result = invokeModule(`
import json
from unittest.mock import patch

directory = pathlib.Path(sys.argv[2])
source = pathlib.Path(sys.argv[3])
before = sorted(path.name for path in directory.iterdir())
observed_entries = []
original_temporary = module.tempfile.NamedTemporaryFile

def monitored_temporary(*args, **kwargs):
    temporary = original_temporary(*args, **kwargs)
    observed_entries.extend(sorted(path.name for path in directory.iterdir() if path.name not in before))
    return temporary

with patch.object(module.tempfile, "NamedTemporaryFile", side_effect=monitored_temporary):
    optimized = module.optimize_png(source, apply=False)

print(json.dumps({
    "accepted": optimized["accepted"],
    "observedEntries": observed_entries,
    "after": sorted(path.name for path in directory.iterdir()),
}))
`, [root, asset])

  assert.deepEqual(result, { accepted: true, observedEntries: [], after: ['asset.png'] })
})

test('apply=True rejection evaluates entirely in memory without creating a temporary file', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-png-memory-reject-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const asset = join(root, 'asset.png')
  const lowQuality = join(root, 'low-quality.png')
  createFixture(asset)
  createFixture(lowQuality, { rgbOffset: 100 })

  const result = invokeModule(`
import json
from unittest.mock import patch

candidate_bytes = pathlib.Path(sys.argv[3]).read_bytes()
with patch.object(module, "_encode_candidate", return_value=candidate_bytes), patch.object(
    module.tempfile, "NamedTemporaryFile", side_effect=AssertionError("temporary file created")
):
    optimized = module.optimize_png(pathlib.Path(sys.argv[2]), apply=True, min_psnr=42.0)
print(json.dumps({"accepted": optimized["accepted"], "reason": optimized["reason"]}))
`, [asset, lowQuality])

  assert.deepEqual(result, { accepted: false, reason: 'psnr-below-threshold' })
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

test('CLI rejects a World junction before it can escape the allowed root', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-png-junction-root-'))
  const outside = mkdtempSync(join(tmpdir(), 'runtime-png-junction-outside-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  t.after(() => rmSync(outside, { recursive: true, force: true }))
  const world = join(root, 'assets/resources/Assets/World')
  const junction = join(world, 'Escape')
  mkdirSync(world, { recursive: true })
  createFixture(join(outside, 'outside.png'))
  try {
    symlinkSync(outside, junction, 'junction')
  } catch (error) {
    if (error.code === 'EPERM') {
      t.skip('junction creation is not permitted in this environment')
      return
    }
    throw error
  }

  const result = spawnSync(python, [scriptPath, '--check', '--project-root', root], { encoding: 'utf8' })

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Escape/)
  assert.match(result.stderr, /junction|reparse|symbolic link/i)
})

test('CLI rejects a project-root junction instead of resolving away the reparse parent', (t) => {
  const container = mkdtempSync(join(tmpdir(), 'runtime-png-project-junction-'))
  const actualRoot = mkdtempSync(join(tmpdir(), 'runtime-png-project-target-'))
  t.after(() => rmSync(container, { recursive: true, force: true }))
  t.after(() => rmSync(actualRoot, { recursive: true, force: true }))
  const linkedRoot = join(container, 'linked-project')
  createFixture(join(actualRoot, 'assets/resources/Assets/World/Fixture/far.png'))
  try {
    symlinkSync(actualRoot, linkedRoot, 'junction')
  } catch (error) {
    if (error.code === 'EPERM') {
      t.skip('junction creation is not permitted in this environment')
      return
    }
    throw error
  }

  const result = spawnSync(python, [scriptPath, '--check', '--project-root', linkedRoot], { encoding: 'utf8' })

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /linked-project/)
  assert.match(result.stderr, /junction|reparse|symbolic link/i)
})

test('Windows reparse attributes reject junctions when pathlib has no is_junction API', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-png-no-junction-api-'))
  const outside = mkdtempSync(join(tmpdir(), 'runtime-png-no-junction-api-outside-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  t.after(() => rmSync(outside, { recursive: true, force: true }))
  const world = join(root, 'assets/resources/Assets/World')
  const junction = join(world, 'Escape')
  mkdirSync(world, { recursive: true })
  createFixture(join(outside, 'outside.png'))
  try {
    symlinkSync(outside, junction, 'junction')
  } catch (error) {
    if (error.code === 'EPERM') {
      t.skip('junction creation is not permitted in this environment')
      return
    }
    throw error
  }

  const result = runPython(`${loadScriptPrelude()}
import json
from unittest.mock import patch

try:
    with patch.object(pathlib.Path, "is_junction", None, create=True):
        module.discover_runtime_pngs(pathlib.Path(sys.argv[2]))
except RuntimeError as error:
    print(json.dumps({"rejected": True, "message": str(error)}))
`, [scriptPath, root])

  assert.equal(result.status, 0, result.stderr)
  const rejection = JSON.parse(result.stdout)
  assert.equal(rejection.rejected, true)
  assert.match(rejection.message, /Escape/)
  assert.match(rejection.message, /reparse/i)
})

test('CLI rejects a PNG file symlink before it can escape the allowed root', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-png-symlink-root-'))
  const outside = mkdtempSync(join(tmpdir(), 'runtime-png-symlink-outside-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  t.after(() => rmSync(outside, { recursive: true, force: true }))
  const target = join(outside, 'outside.png')
  const linked = join(root, 'assets/resources/Assets/World/linked.png')
  createFixture(target)
  mkdirSync(dirname(linked), { recursive: true })
  try {
    symlinkSync(target, linked, 'file')
  } catch (error) {
    if (error.code === 'EPERM') {
      t.skip('file symlink creation is not permitted in this environment')
      return
    }
    throw error
  }

  const result = spawnSync(python, [scriptPath, '--check', '--project-root', root], { encoding: 'utf8' })

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /linked\.png/)
  assert.match(result.stderr, /symlink|reparse|symbolic link/i)
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
  createFixture(lowQuality, { rgbOffset: 1 })

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

def fail_after_write(_source):
    raise RuntimeError("fixture processing failure")

try:
    with patch.object(module, "_encode_candidate", side_effect=fail_after_write):
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
original_fsync = __import__("os").fsync
calls = []
fsync_calls = []
def replace_spy(candidate, target):
    calls.append([candidate.name, pathlib.Path(target).name])
    return original_replace(candidate, target)
def fsync_spy(file_descriptor):
    fsync_calls.append(file_descriptor)
    return original_fsync(file_descriptor)

with patch.object(pathlib.Path, "replace", replace_spy), patch("os.fsync", fsync_spy):
    checked = module.optimize_png(pathlib.Path(sys.argv[2]), apply=False)
    check_calls = len(calls)
    check_fsync_calls = len(fsync_calls)
    applied = module.optimize_png(pathlib.Path(sys.argv[3]), apply=True)

print(json.dumps({
    "checkedAccepted": checked["accepted"],
    "appliedAccepted": applied["accepted"],
    "checkCalls": check_calls,
    "checkFsyncCalls": check_fsync_calls,
    "totalCalls": len(calls),
    "totalFsyncCalls": len(fsync_calls),
}))
`, [checkAsset, applyAsset])

  assert.deepEqual(result, {
    checkedAccepted: true,
    appliedAccepted: true,
    checkCalls: 0,
    checkFsyncCalls: 0,
    totalCalls: 1,
    totalFsyncCalls: 1,
  })
  assert.equal(snapshot(checkAsset), checkBefore)
  assert.notEqual(snapshot(applyAsset), applyBefore)
  assert.deepEqual(readdirSync(root).sort(), ['apply.png', 'check.png'])
})

test('package exposes the runtime PNG optimization command', () => {
  const packageJson = JSON.parse(readFileSync(resolve(clientRoot, 'package.json'), 'utf8'))
  assert.equal(packageJson.scripts['optimize:png'], 'python tools/optimize-runtime-pngs.py --apply')
})
