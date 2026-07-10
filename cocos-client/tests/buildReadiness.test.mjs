import test from 'node:test'
import assert from 'node:assert/strict'
import { checkCocosBuildReadiness } from '../tools/check-cocos-build-readiness.mjs'

test('build readiness reports missing Cocos export blockers', () => {
  const report = checkCocosBuildReadiness({ projectRoot: process.cwd(), creatorCommand: null })

  assert.equal(report.ready, false)
  assert.equal(report.blockers.some((blocker) => blocker.includes('Cocos Creator')), true)
  assert.equal(report.blockers.some((blocker) => blocker.includes('assets/Scenes')), true)
  assert.equal(report.blockers.some((blocker) => blocker.includes('settings')), true)
})

test('build readiness passes when editor, scene, settings, and web build output exist', () => {
  const report = checkCocosBuildReadiness({
    projectRoot: process.cwd(),
    creatorCommand: 'D:/CocosCreator/CocosCreator.exe',
    files: new Set([
      'assets/Scenes/MainBattle.scene',
      'settings/v2/packages/builder.json',
      'build/web-mobile/index.html',
    ]),
  })

  assert.equal(report.ready, true)
  assert.deepEqual(report.blockers, [])
})
