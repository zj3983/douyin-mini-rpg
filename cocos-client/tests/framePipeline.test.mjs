import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

const scriptPath = resolve('tools/build-frame-strip.py')

function createSheet(path, width = 60, height = 40, drawing = '') {
  const result = spawnSync('python', ['-c', [
    'from PIL import Image, ImageDraw',
    `im=Image.new("RGBA",(${width},${height}),(0,0,0,0))`,
    'd=ImageDraw.Draw(im)',
    drawing,
    `im.save(r"${path.replaceAll('\\', '\\\\')}")`,
  ].filter(Boolean).join(';')], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
}

test('frame strip processor script documents trim, center, and pack workflow', () => {
  assert.equal(existsSync(scriptPath), true)

  const source = readFileSync(scriptPath, 'utf8')
  assert.equal(source.includes('--input-dir'), true)
  assert.equal(source.includes('--output'), true)
  assert.equal(source.includes('--padding'), true)
  assert.match(source, /add_argument\("--padding",[^\n]*default=28/)
  assert.equal(source.includes('--vertical-align'), true)
  assert.match(source, /choices=\("center", "bottom"\)/)
  assert.equal(source.includes('trim_alpha_bounds'), true)
  assert.equal(source.includes('pack_horizontal_strip'), true)
  assert.equal(source.includes('--extract-components'), false)
  assert.equal(source.includes('extract_sheet_components'), false)
})

test('frame strip processor rejects padding that leaves no drawable area', () => {
  const result = spawnSync('python', [
    resolve('tools/build-frame-strip.py'),
    '--input-dir', resolve('assets/resources/Assets/Combat/QinglanSwordCultivator'),
    '--output', resolve('temp-invalid-strip.png'),
    '--frame-width', '512',
    '--frame-height', '512',
    '--padding', '256',
  ], { encoding: 'utf8' })

  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}${result.stderr}`, /padding.+drawable area/i)
})

test('fixed-grid sheet keeps frame ownership, detached effects, and low alpha pixels', async () => {
  const workDir = mkdtempSync(resolve(tmpdir(), 'frame-sheet-'))
  const source = resolve(workDir, 'source.png')
  const output = resolve(workDir, 'strip.png')
  createSheet(source, 60, 40, [
    'colors=[(255,0,0,255),(0,255,0,255),(0,0,255,255)]',
    '[(d.rectangle((i*20+5,10,i*20+14,29),fill=colors[i])) for i in range(3)]',
    'd.rectangle((7,5,8,6),fill=(255,0,0,255))',
    'd.point((12,4),fill=(255,0,0,7))',
  ].join(';'))

  const result = spawnSync('python', [
    resolve('tools/build-frame-strip.py'),
    '--input-sheet', source,
    '--sheet-columns', '3',
    '--output', output,
    '--frame-width', '64',
    '--frame-height', '64',
    '--padding', '4',
    '--vertical-align', 'bottom',
  ], { encoding: 'utf8' })

  try {
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`)
    const { readPngRgba } = await import('../tools/png-alpha-runtime.mjs')
    const image = readPngRgba(output)
    assert.deepEqual({ width: image.width, height: image.height }, { width: 192, height: 64 })
    const colorsByFrame = [0, 1, 2].map(() => new Set())
    let lowAlphaFound = false
    for (let y = 0; y < image.height; y += 1) {
      for (let x = 0; x < image.width; x += 1) {
        const offset = (y * image.width + x) * 4
        const [r, g, b, a] = image.data.subarray(offset, offset + 4)
        if (a === 0) continue
        colorsByFrame[Math.floor(x / 64)].add(`${r > g && r > b ? 'r' : g > r && g > b ? 'g' : 'b'}`)
        if (a < 20) lowAlphaFound = true
      }
    }
    assert.deepEqual(colorsByFrame.map((colors) => [...colors]), [['r'], ['g'], ['b']])
    assert.equal(lowAlphaFound, true, 'low-alpha source pixels should survive fixed-grid packing')

    const opaqueRed = new Set()
    for (let y = 0; y < image.height; y += 1) {
      for (let x = 0; x < 64; x += 1) {
        const offset = (y * image.width + x) * 4
        if (image.data[offset] > 200 && image.data[offset + 3] > 200) opaqueRed.add(`${x},${y}`)
      }
    }
    let redComponents = 0
    while (opaqueRed.size) {
      redComponents += 1
      const pending = [opaqueRed.values().next().value]
      opaqueRed.delete(pending[0])
      while (pending.length) {
        const [x, y] = pending.pop().split(',').map(Number)
        for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
          const key = `${nx},${ny}`
          if (opaqueRed.delete(key)) pending.push(key)
        }
      }
    }
    assert.equal(redComponents >= 2, true, 'detached opaque effects should remain separate and present')
  } finally {
    rmSync(workDir, { recursive: true, force: true })
  }
})

test('sheet mode rejects invalid column counts and non-divisible widths', () => {
  const workDir = mkdtempSync(resolve(tmpdir(), 'frame-invalid-'))
  const source = resolve(workDir, 'source.png')
  createSheet(source)
  for (const columns of ['0', '-2', '7']) {
    const result = spawnSync('python', [scriptPath, '--input-sheet', source, '--sheet-columns', columns, '--output', resolve(workDir, 'out.png')], { encoding: 'utf8' })
    assert.notEqual(result.status, 0)
    assert.match(`${result.stdout}${result.stderr}`, /sheet-columns|divisible/i)
  }
  rmSync(workDir, { recursive: true, force: true })
})

test('sheet-only options reject directory mode and limit is rejected in sheet mode', () => {
  const workDir = mkdtempSync(resolve(tmpdir(), 'frame-mode-'))
  const source = resolve(workDir, 'source.png')
  createSheet(source)
  const directory = resolve('assets/resources/Assets/Combat/QinglanSwordCultivator')
  const misuse = [
    ['--input-dir', directory, '--sheet-columns', '6'],
    ['--input-sheet', source, '--sheet-columns', '6', '--limit', '3'],
  ]
  for (const args of misuse) {
    const result = spawnSync('python', [scriptPath, ...args, '--output', resolve(workDir, 'out.png')], { encoding: 'utf8' })
    assert.notEqual(result.status, 0)
    assert.match(`${result.stdout}${result.stderr}`, /only valid|cannot be used/i)
  }
  rmSync(workDir, { recursive: true, force: true })
})

test('multi-subject sheet cannot silently run as a one-column sheet', () => {
  const workDir = mkdtempSync(resolve(tmpdir(), 'frame-columns-'))
  const source = resolve(workDir, 'source.png')
  createSheet(source)
  const result = spawnSync('python', [
    scriptPath, '--input-sheet', source, '--output', resolve(workDir, 'out.png'),
  ], { encoding: 'utf8' })
  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}${result.stderr}`, /sheet-columns.+required/i)
  rmSync(workDir, { recursive: true, force: true })
})

test('equal slicing refuses a source whose subjects touch column boundaries', () => {
  const workDir = mkdtempSync(resolve(tmpdir(), 'frame-crossing-'))
  const source = resolve(workDir, 'source.png')
  createSheet(source, 60, 40, 'd.rectangle((18,10,22,29),fill=(255,255,255,255))')
  const result = spawnSync('python', [
    scriptPath, '--input-sheet', source, '--sheet-columns', '3', '--output', resolve(workDir, 'out.png'),
  ], { encoding: 'utf8' })
  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}${result.stderr}`, /crosses equal column boundaries.+offline art preparation/i)
  rmSync(workDir, { recursive: true, force: true })
})
