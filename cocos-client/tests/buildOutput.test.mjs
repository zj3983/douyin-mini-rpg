import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  checkCocosBuildOutput,
  compressScriptUuid,
  verifyCocosBuildOutput,
} from '../tools/check-cocos-build-output.mjs'

const projectRoot = process.cwd()
const meta = JSON.parse(readFileSync(resolve('assets/Scripts/Game/PortraitBattleBootstrap.ts.meta'), 'utf8'))
const classId = compressScriptUuid(meta.uuid)
const validMainIndex = `PortraitBattleBootstrap ${classId} StageResourceRuntime Array.from(this.pending.values()) Array.from(this.retained.keys())`

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
  writeFixture(buildRoot, 'assets/main/index.js', validMainIndex)
  writeFixture(buildRoot, 'assets/main/import/main-battle.json', `["MainBattle","${classId}"]`)

  const report = checkCocosBuildOutput({ buildRoot, projectRoot })

  assert.equal(report.ok, true, report.errors.join('\n'))
  assert.equal(report.classId, classId)
  assert.equal(Boolean(report.sceneFile), true)
})

test('build-output check rejects the Cocos Map iterator spread regression', () => {
  const buildRoot = mkdtempSync(join(tmpdir(), 'cocos-build-iterator-regression-'))
  writeFixture(
    buildRoot,
    'assets/main/index.js',
    `PortraitBattleBootstrap ${classId} StageResourceRuntime [].concat(this.pending.values()) [].concat(this.retained.keys())`,
  )
  writeFixture(buildRoot, 'assets/main/import/main-battle.json', `["MainBattle","${classId}"]`)

  const report = checkCocosBuildOutput({ buildRoot, projectRoot })

  assert.equal(report.ok, false)
  assert.equal(report.errors.some((error) => error.includes('Map iterator materialization')), true)
})

test('formal build verifier combines readiness and bootstrap output checks', () => {
  const buildRoot = mkdtempSync(join(tmpdir(), 'cocos-build-verified-'))
  writeFixture(buildRoot, 'assets/main/index.js', validMainIndex)
  writeFixture(buildRoot, 'assets/main/import/main-battle.json', `["MainBattle","${classId}"]`)

  const missingIndex = verifyCocosBuildOutput({
    buildRoot,
    projectRoot,
    creatorCommand: process.execPath,
  })
  assert.equal(missingIndex.ok, false)
  assert.equal(missingIndex.readiness.blockers.some((blocker) => blocker.includes('index.html')), true)

  writeFixture(buildRoot, 'index.html', '<!doctype html>')
  const complete = verifyCocosBuildOutput({
    buildRoot,
    projectRoot,
    creatorCommand: process.execPath,
  })
  assert.equal(complete.ok, true, complete.errors.join('\n'))
})

test('verify:build-output is mandatory and accepts an explicit build root', () => {
  const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'))
  assert.equal(packageJson.scripts['verify:build-output'], 'node tools/check-cocos-build-output.mjs')

  const missingRootEnv = { ...process.env }
  delete missingRootEnv.COCOS_BUILD_ROOT
  const missingRoot = spawnSync(process.execPath, ['tools/check-cocos-build-output.mjs'], {
    cwd: projectRoot,
    env: missingRootEnv,
    encoding: 'utf8',
  })
  assert.equal(missingRoot.status, 2)

  const buildRoot = mkdtempSync(join(tmpdir(), 'cocos-build-command-'))
  writeFixture(buildRoot, 'index.html', '<!doctype html>')
  writeFixture(buildRoot, 'assets/main/index.js', validMainIndex)
  writeFixture(buildRoot, 'assets/main/import/main-battle.json', `["MainBattle","${classId}"]`)
  const verified = spawnSync(process.execPath, ['tools/check-cocos-build-output.mjs'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      COCOS_BUILD_ROOT: buildRoot,
      COCOS_CREATOR_PATH: process.execPath,
    },
    encoding: 'utf8',
  })
  assert.equal(verified.status, 0, `${verified.stdout}\n${verified.stderr}`)
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
