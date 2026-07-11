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
