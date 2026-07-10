import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
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
