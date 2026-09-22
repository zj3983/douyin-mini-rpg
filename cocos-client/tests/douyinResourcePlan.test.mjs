import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { classifyDouyinResource } from '../tools/plan-douyin-resources.mjs'

test('Douyin source resources are separated by launch priority', () => {
  assert.equal(classifyDouyinResource('Assets/ActorAtlases/BambooWarden/roar.png'), 'stage-one')
  assert.equal(classifyDouyinResource('Assets/World/MistBamboo/far.webp'), 'stage-one')
  assert.equal(classifyDouyinResource('Assets/World/FlameRavine/far.webp'), 'deferred')
  assert.equal(classifyDouyinResource('Assets/ActorAtlases/FlameOgre/atlas.png'), 'deferred')
  assert.equal(classifyDouyinResource('Assets/Dungeon/MistBamboo/Floor2/far.webp'), 'deferred')
  assert.equal(classifyDouyinResource('Assets/Generated/Atlases/characters-atlas.png'), 'review')
  assert.equal(classifyDouyinResource('Assets/Combat/FlameRavine/flame-ogre-strip.png'), 'review')
  assert.equal(classifyDouyinResource('Data/animation-atlas.json'), 'shared')
})

test('Douyin resource plan accounts for every source byte and exposes cleanup candidates', () => {
  const output = execFileSync(process.execPath, ['tools/plan-douyin-resources.mjs'], {
    cwd: resolve('.'),
    encoding: 'utf8',
  })
  const report = JSON.parse(output)
  const categorizedBytes = Object.values(report.categories)
    .reduce((sum, category) => sum + category.bytes, 0)

  assert.equal(report.root, 'assets/resources')
  assert.equal(categorizedBytes, report.total.bytes)
  assert.ok(report.categories['stage-one'].bytes > 0)
  assert.ok(report.categories.deferred.bytes > 0)
  assert.equal(report.categories.review.bytes, 0)
  assert.equal(report.categories.review.largest.some((entry) => entry.path.includes('Generated/Atlases')), false)
  assert.equal(report.categories.review.largest.some((entry) => entry.path.startsWith('Assets/Monsters/')), false)
  assert.equal(report.releasePolicy.resourcesBundle, 'remote')
  assert.equal(report.releasePolicy.transport, 'https')
})

test('package exposes Douyin resource planning command', () => {
  const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8'))
  assert.equal(pkg.scripts['plan:douyin-resources'], 'node tools/plan-douyin-resources.mjs')
})
