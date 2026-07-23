import test from 'node:test'
import assert from 'node:assert/strict'
import { checkDouyinReleaseReadiness } from '../tools/check-douyin-release-readiness.mjs'

test('Douyin readiness reports missing mini-game build and AppID blockers', () => {
  const report = checkDouyinReleaseReadiness({
    projectRoot: process.cwd(),
    files: new Set(),
    fileSizes: new Map(),
  })

  assert.equal(report.ready, false)
  assert.equal(report.platform, 'douyin-mini-game')
  assert.equal(report.limits.mainPackageBytes, 4 * 1024 * 1024)
  assert.equal(report.limits.totalPackageBytes, 20 * 1024 * 1024)
  for (const expected of ['game.js', 'game.json', 'project.config.json', 'AppID']) {
    assert.equal(report.blockers.some((blocker) => blocker.includes(expected)), true, `missing blocker for ${expected}`)
  }
})

test('Douyin readiness rejects oversize main package and total package', () => {
  const report = checkDouyinReleaseReadiness({
    projectRoot: process.cwd(),
    files: new Set([
      'build/bytedance-mini-game/game.js',
      'build/bytedance-mini-game/game.json',
      'build/bytedance-mini-game/project.config.json',
      'build/bytedance-mini-game/assets/big.bin',
      'build/bytedance-mini-game/subpackages/stage2/pack.bin',
    ]),
    fileSizes: new Map([
      ['build/bytedance-mini-game/game.js', 512 * 1024],
      ['build/bytedance-mini-game/game.json', 200],
      ['build/bytedance-mini-game/project.config.json', 200],
      ['build/bytedance-mini-game/assets/big.bin', 5 * 1024 * 1024],
      ['build/bytedance-mini-game/subpackages/stage2/pack.bin', 16 * 1024 * 1024],
    ]),
    projectConfig: { appid: 'tt1234567890' },
  })

  assert.equal(report.ready, false)
  assert.equal(report.sizes.mainPackageBytes > report.limits.mainPackageBytes, true)
  assert.equal(report.sizes.totalPackageBytes > report.limits.totalPackageBytes, true)
  assert.equal(report.blockers.some((blocker) => blocker.includes('main package')), true)
  assert.equal(report.blockers.some((blocker) => blocker.includes('total package')), true)
})

test('Douyin readiness passes for a valid split mini-game package', () => {
  const report = checkDouyinReleaseReadiness({
    projectRoot: process.cwd(),
    files: new Set([
      'build/bytedance-mini-game/game.js',
      'build/bytedance-mini-game/game.json',
      'build/bytedance-mini-game/project.config.json',
      'build/bytedance-mini-game/src/main.js',
      'build/bytedance-mini-game/subpackages/stage2/pack.js',
    ]),
    fileSizes: new Map([
      ['build/bytedance-mini-game/game.js', 128 * 1024],
      ['build/bytedance-mini-game/game.json', 300],
      ['build/bytedance-mini-game/project.config.json', 300],
      ['build/bytedance-mini-game/src/main.js', 2 * 1024 * 1024],
      ['build/bytedance-mini-game/subpackages/stage2/pack.js', 8 * 1024 * 1024],
    ]),
    projectConfig: { appid: 'tt1234567890' },
  })

  assert.equal(report.ready, true)
  assert.deepEqual(report.blockers, [])
  assert.equal(report.warnings.length, 0)
})

test('Douyin readiness excludes generated remote assets from the upload package budget', () => {
  const report = checkDouyinReleaseReadiness({
    projectRoot: process.cwd(),
    files: new Set([
      'build/bytedance-mini-game/game.js',
      'build/bytedance-mini-game/game.json',
      'build/bytedance-mini-game/project.config.json',
      'build/bytedance-mini-game/src/main.js',
      'build/bytedance-mini-game/remote/resources/config.json',
      'build/bytedance-mini-game/remote/resources/native/large.png',
    ]),
    fileSizes: new Map([
      ['build/bytedance-mini-game/game.js', 128 * 1024],
      ['build/bytedance-mini-game/game.json', 300],
      ['build/bytedance-mini-game/project.config.json', 300],
      ['build/bytedance-mini-game/src/main.js', 2 * 1024 * 1024],
      ['build/bytedance-mini-game/remote/resources/config.json', 64 * 1024],
      ['build/bytedance-mini-game/remote/resources/native/large.png', 30 * 1024 * 1024],
    ]),
    projectConfig: { appid: 'tt1234567890' },
  })

  assert.equal(report.ready, true)
  assert.equal(report.sizes.totalPackageBytes < report.limits.mainPackageBytes, true)
  assert.equal(report.sizes.remoteBytes > report.limits.totalPackageBytes, true)
  assert.equal(report.sizes.remoteFileCount, 2)
  assert.equal(report.warnings.some((warning) => warning.includes('CDN')), true)
})

test('package exposes Douyin release check command', async () => {
  const pkg = await import('../package.json', { with: { type: 'json' } })
  assert.equal(pkg.default.scripts['check:douyin'], 'node tools/check-douyin-release-readiness.mjs')
})
