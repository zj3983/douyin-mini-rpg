import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

test('resource budget report groups source assets by kind', () => {
  const output = execFileSync(process.execPath, ['tools/report-resource-budget.mjs'], {
    cwd: resolve('.'),
    encoding: 'utf8',
  })
  const report = JSON.parse(output)

  assert.equal(report.root, 'assets/resources')
  assert.ok(report.total.bytes > 0)
  assert.ok(report.total.megabytes > 0)
  for (const key of ['image', 'audio', 'json', 'other']) {
    assert.ok(report.groups[key], `missing ${key}`)
    assert.equal(typeof report.groups[key].bytes, 'number')
    assert.equal(Array.isArray(report.groups[key].largest), true)
    assert.equal(report.groups[key].largest.length <= 10, true)
  }
  assert.ok(report.groups.image.bytes > report.groups.audio.bytes)
  assert.ok(report.groups.audio.largest.some((entry) => entry.path.endsWith('mist-bamboo.mp3')))
  assert.ok(report.budgets.dungeon)
  assert.equal(report.budgets.dungeon.withinBudget, true)
  assert.equal(report.budgets.dungeon.backgroundCount, 6)
  assert.equal(report.budgets.dungeon.effectCount, 2)
  assert.equal(report.budgets.dungeon.audioCount, 4)
  assert.equal(report.budgets.dungeon.limitBytes, 20 * 1024 * 1024)
  assert.deepEqual(report.budgets.dungeon.missing, [])
})

test('package exposes a repeatable source resource budget command', () => {
  const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8'))
  assert.equal(pkg.scripts['report:resources'], 'node tools/report-resource-budget.mjs')
})
