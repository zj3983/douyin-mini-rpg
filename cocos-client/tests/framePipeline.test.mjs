import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

test('frame strip processor script documents trim, center, and pack workflow', () => {
  const scriptPath = resolve('tools/build-frame-strip.py')
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

test('frame strip processor slices one six-column sheet before trimming and packing', () => {
  const workDir = mkdtempSync(resolve(tmpdir(), 'frame-sheet-'))
  const source = resolve(workDir, 'source.png')
  const output = resolve(workDir, 'strip.png')
  const createSheet = spawnSync('python', ['-c', [
    'from PIL import Image, ImageDraw',
    `im=Image.new("RGBA",(600,240),(0,0,0,0))`,
    'd=ImageDraw.Draw(im)',
    '[(d.rectangle((i*100+20, 40+i*3, i*100+79, 219), fill=(20+i*30,180,220,255))) for i in range(6)]',
    `im.save(r"${source.replaceAll('\\', '\\\\')}")`,
  ].join(';')], { encoding: 'utf8' })
  assert.equal(createSheet.status, 0, createSheet.stderr)

  const result = spawnSync('python', [
    resolve('tools/build-frame-strip.py'),
    '--input-sheet', source,
    '--sheet-columns', '6',
    '--output', output,
    '--frame-width', '320',
    '--frame-height', '512',
    '--padding', '28',
    '--vertical-align', 'bottom',
  ], { encoding: 'utf8' })

  try {
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`)
    const png = readFileSync(output)
    assert.equal(png.readUInt32BE(16), 1920)
    assert.equal(png.readUInt32BE(20), 512)
  } finally {
    rmSync(workDir, { recursive: true, force: true })
  }
})

test('sheet mode rejects invalid column counts and non-divisible widths', () => {
  const script = resolve('tools/build-frame-strip.py')
  const source = resolve('temp/imagegen/stage2/transparent/fog-spider-sheet-alpha.png')
  for (const columns of ['0', '-2', '5']) {
    const result = spawnSync('python', [script, '--input-sheet', source, '--sheet-columns', columns, '--output', 'temp-invalid-strip.png'], { encoding: 'utf8' })
    assert.notEqual(result.status, 0)
    assert.match(`${result.stdout}${result.stderr}`, /sheet-columns|divisible/i)
  }
  rmSync(resolve('temp-invalid-strip.png'), { force: true })
})

test('sheet-only options reject directory mode and limit is rejected in sheet mode', () => {
  const script = resolve('tools/build-frame-strip.py')
  const source = resolve('temp/imagegen/stage2/transparent/fog-spider-sheet-alpha.png')
  const directory = resolve('assets/resources/Assets/Combat/QinglanSwordCultivator')
  const misuse = [
    ['--input-dir', directory, '--sheet-columns', '6'],
    ['--input-sheet', source, '--sheet-columns', '6', '--limit', '3'],
  ]
  for (const args of misuse) {
    const result = spawnSync('python', [script, ...args, '--output', 'temp-invalid-strip.png'], { encoding: 'utf8' })
    assert.notEqual(result.status, 0)
    assert.match(`${result.stdout}${result.stderr}`, /only valid|cannot be used/i)
  }
  rmSync(resolve('temp-invalid-strip.png'), { force: true })
})

test('multi-subject sheet cannot silently run as a one-column sheet', () => {
  const result = spawnSync('python', [
    resolve('tools/build-frame-strip.py'),
    '--input-sheet', resolve('temp/imagegen/stage2/transparent/fog-spider-sheet-alpha.png'),
    '--output', 'temp-invalid-strip.png',
  ], { encoding: 'utf8' })
  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}${result.stderr}`, /sheet-columns.+required/i)
  rmSync(resolve('temp-invalid-strip.png'), { force: true })
})

test('adaptive sheet extraction rejects equal-column contamination and preserves whole subjects', () => {
  const result = spawnSync('python', [
    resolve('tools/build-frame-strip.py'),
    '--input-sheet', resolve('temp/imagegen/stage2/transparent/fog-spider-sheet-alpha.png'),
    '--sheet-columns', '6',
    '--extract-components',
    '--output', resolve('temp-component-strip.png'),
    '--frame-width', '320', '--frame-height', '512', '--padding', '28', '--vertical-align', 'bottom',
  ], { encoding: 'utf8' })
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`)
  assert.match(result.stdout, /crosses equal column boundaries/i)
  rmSync(resolve('temp-component-strip.png'), { force: true })
})

test('equal slicing refuses a source whose subjects touch column boundaries', () => {
  const result = spawnSync('python', [
    resolve('tools/build-frame-strip.py'),
    '--input-sheet', resolve('temp/imagegen/stage2/transparent/fog-spider-sheet-alpha.png'),
    '--sheet-columns', '6',
    '--output', 'temp-invalid-strip.png',
  ], { encoding: 'utf8' })
  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}${result.stderr}`, /crosses equal column boundaries.+extract-components/i)
  rmSync(resolve('temp-invalid-strip.png'), { force: true })
})
