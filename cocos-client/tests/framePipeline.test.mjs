import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

test('frame strip processor script documents trim, center, and pack workflow', () => {
  const scriptPath = resolve('tools/build-frame-strip.py')
  assert.equal(existsSync(scriptPath), true)

  const source = readFileSync(scriptPath, 'utf8')
  assert.equal(source.includes('--input-dir'), true)
  assert.equal(source.includes('--output'), true)
  assert.equal(source.includes('trim_alpha_bounds'), true)
  assert.equal(source.includes('pack_horizontal_strip'), true)
})
