import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createDouyinBuildArgs,
  createDouyinBuildConfig,
  validateDouyinBuildEnv,
} from '../tools/build-douyin-mini-game.mjs'

test('Douyin build env rejects missing Creator and AppID before launching Cocos', () => {
  const report = validateDouyinBuildEnv({
    creatorCommand: '',
    appid: '',
    projectRoot: 'D:/game/cocos-client',
  })

  assert.equal(report.ok, false)
  assert.equal(report.blockers.some((blocker) => blocker.includes('Cocos Creator')), true)
  assert.equal(report.blockers.some((blocker) => blocker.includes('DOUYIN_APPID')), true)
})

test('Douyin build config uses Cocos ByteDance platform fields and remote-resource defaults', () => {
  const config = createDouyinBuildConfig({
    appid: 'tt1234567890',
    remoteServerAddress: 'https://cdn.example.com/void-trial/',
  })

  assert.equal(config.platform, 'bytedance-mini-game')
  assert.equal(config.buildPath, 'project://build')
  assert.equal(config.outputName, 'bytedance-mini-game')
  assert.equal(config.debug, false)
  assert.equal(config.md5Cache, true)
  assert.equal(config.packages['bytedance-mini-game'].appid, 'tt1234567890')
  assert.equal(config.packages['bytedance-mini-game'].remoteServerAddress, 'https://cdn.example.com/void-trial/')
  assert.equal(config.packages['bytedance-mini-game'].orientation, 'portrait')
})

test('Douyin build args pass a generated configPath to Cocos Creator', () => {
  const args = createDouyinBuildArgs({
    projectRoot: 'D:/game/cocos-client',
    configPath: 'D:/game/cocos-client/temp/douyin-build-config.json',
  })

  assert.deepEqual(args, [
    '--project',
    'D:/game/cocos-client',
    '--build',
    'configPath=D:/game/cocos-client/temp/douyin-build-config.json;',
  ])
})

test('package exposes Douyin build command', async () => {
  const pkg = await import('../package.json', { with: { type: 'json' } })
  assert.equal(pkg.default.scripts['build:douyin'], 'node tools/build-douyin-mini-game.mjs')
})
