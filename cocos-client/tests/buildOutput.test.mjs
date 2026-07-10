import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { checkCocosBuildOutput, compressScriptUuid } from '../tools/check-cocos-build-output.mjs'

const projectRoot = process.cwd()
const meta = JSON.parse(readFileSync(resolve('assets/Scripts/Game/PortraitBattleBootstrap.ts.meta'), 'utf8'))
const classId = compressScriptUuid(meta.uuid)

function writeFixture(root, path, source) {
  const target = join(root, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, source)
}

test('build-output check fails when the compiled bootstrap is missing', () => {
  const buildRoot = mkdtempSync(join(tmpdir(), 'cocos-build-missing-'))
  writeFixture(buildRoot, 'assets/main/index.js', 'System.register("main", [])')
  writeFixture(buildRoot, 'assets/main/import/main-battle.json', '["MainBattle"]')

  const report = checkCocosBuildOutput({ buildRoot, projectRoot })

  assert.equal(report.ok, false)
  assert.equal(report.errors.some((error) => error.includes('PortraitBattleBootstrap')), true)
  assert.equal(report.errors.some((error) => error.includes(classId)), true)
})

test('build-output check accepts a compiled script and serialized MainBattle component', () => {
  const buildRoot = mkdtempSync(join(tmpdir(), 'cocos-build-complete-'))
  writeFixture(buildRoot, 'assets/main/index.js', `PortraitBattleBootstrap ${classId}`)
  writeFixture(buildRoot, 'assets/main/import/main-battle.json', `["MainBattle","${classId}"]`)

  const report = checkCocosBuildOutput({ buildRoot, projectRoot })

  assert.equal(report.ok, true, report.errors.join('\n'))
  assert.equal(report.classId, classId)
  assert.equal(Boolean(report.sceneFile), true)
})

test('explicit COCOS_BUILD_ROOT contains the portrait bootstrap', {
  skip: !process.env.COCOS_BUILD_ROOT,
}, () => {
  const report = checkCocosBuildOutput({
    buildRoot: process.env.COCOS_BUILD_ROOT,
    projectRoot,
  })
  assert.equal(report.ok, true, report.errors.join('\n'))
})
