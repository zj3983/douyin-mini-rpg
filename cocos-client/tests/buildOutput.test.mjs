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
const uuidBase64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function compressAssetUuidFixture(uuid) {
  const hex = uuid.replaceAll('-', '')
  let compressed = hex.slice(0, 2)
  for (let index = 2; index < hex.length; index += 3) {
    const value = Number.parseInt(hex.slice(index, index + 3), 16)
    compressed += uuidBase64[value >> 6] + uuidBase64[value & 63]
  }
  return compressed
}

const legacyMainIndex = `PortraitBattleBootstrap ${classId} StageResourceRuntime Array.from(this.pending.values()) Array.from(this.retained.keys())`
const bossTalismanMarkers = 'BossTelegraphVisualProfile BossTelegraphPresenter BossHazardVisualController'
const validMainIndex = `${legacyMainIndex} ${bossTalismanMarkers}`
const talismans = ['sweep', 'spike', 'roar'].map((name) => {
  const assetUuid = JSON.parse(
    readFileSync(resolve(`assets/resources/Assets/Skills/BossDomain/talisman_${name}.png.meta`), 'utf8'),
  ).uuid
  return {
    name,
    assetUuid,
    spriteFrameUuid: `${compressAssetUuidFixture(assetUuid)}@f9941`,
    resourcePath: `Assets/Skills/BossDomain/talisman_${name}/spriteFrame`,
  }
})

function writeFixture(root, path, source) {
  const target = join(root, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, source)
}

function writeBossTalismanFixture(root, {
  omitPath = null,
  wrongUuid = null,
  omitImport = null,
  omitNative = null,
} = {}) {
  const uuids = []
  const paths = {}

  for (const talisman of talismans) {
    const index = uuids.length
    uuids.push(talisman.name === wrongUuid ? 'wrong-resource-uuid@f9941' : talisman.spriteFrameUuid)
    if (talisman.name !== omitPath) paths[index] = [talisman.resourcePath, 3, 1]
    if (talisman.name !== omitImport) {
      writeFixture(
        root,
        `assets/resources/import/${talisman.assetUuid.slice(0, 2)}/${talisman.assetUuid}@f9941.json`,
        `{"name":"talisman_${talisman.name}"}`,
      )
    }
    if (talisman.name !== omitNative) {
      writeFixture(
        root,
        `assets/resources/native/${talisman.assetUuid.slice(0, 2)}/${talisman.assetUuid}.png`,
        'png-fixture',
      )
    }
  }

  writeFixture(root, 'assets/resources/config.json', JSON.stringify({ uuids, paths }))
}

function writeCompleteFixture(root, mainIndex = validMainIndex) {
  writeFixture(root, 'assets/main/index.js', mainIndex)
  writeFixture(root, 'assets/main/import/main-battle.json', `["MainBattle","${classId}"]`)
  writeBossTalismanFixture(root)
}

test('build-output check accepts Cocos production filename hashes', () => {
  const buildRoot = mkdtempSync(join(tmpdir(), 'cocos-build-hashed-'))
  writeFixture(buildRoot, 'assets/main/index.a1b2c.js', validMainIndex)
  writeFixture(buildRoot, 'assets/main/import/main-battle.c3d4e.json', `["MainBattle","${classId}"]`)

  const uuids = []
  const paths = {}
  for (const talisman of talismans) {
    const index = uuids.length
    uuids.push(talisman.spriteFrameUuid)
    paths[index] = [talisman.resourcePath, 3, 1]
    writeFixture(
      buildRoot,
      `assets/resources/import/${talisman.assetUuid.slice(0, 2)}/${talisman.assetUuid}@f9941.a1b2c.json`,
      `{"name":"talisman_${talisman.name}"}`,
    )
    writeFixture(
      buildRoot,
      `assets/resources/native/${talisman.assetUuid.slice(0, 2)}/${talisman.assetUuid}.d3e4f.png`,
      'png-fixture',
    )
  }
  writeFixture(buildRoot, 'assets/resources/config.f5a6b.json', JSON.stringify({ uuids, paths }))

  const report = checkCocosBuildOutput({ buildRoot, projectRoot })

  assert.equal(report.ok, true, report.errors.join('\n'))
})

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
  writeCompleteFixture(buildRoot)

  const report = checkCocosBuildOutput({ buildRoot, projectRoot })

  assert.equal(report.ok, true, report.errors.join('\n'))
  assert.equal(report.classId, classId)
  assert.equal(Boolean(report.sceneFile), true)
})

test('build-output check rejects output without compiled boss talisman feature markers', () => {
  const buildRoot = mkdtempSync(join(tmpdir(), 'cocos-build-missing-talisman-code-'))
  writeCompleteFixture(buildRoot, legacyMainIndex)

  const report = checkCocosBuildOutput({ buildRoot, projectRoot })

  assert.equal(report.ok, false)
  assert.equal(report.errors.some((error) => error.includes('boss talisman compiled feature')), true)
})

test('build-output check rejects a missing boss talisman spriteFrame resource path', () => {
  const buildRoot = mkdtempSync(join(tmpdir(), 'cocos-build-missing-talisman-path-'))
  writeFixture(buildRoot, 'assets/main/index.js', validMainIndex)
  writeFixture(buildRoot, 'assets/main/import/main-battle.json', `["MainBattle","${classId}"]`)
  writeBossTalismanFixture(buildRoot, { omitPath: 'spike' })

  const report = checkCocosBuildOutput({ buildRoot, projectRoot })

  assert.equal(report.ok, false)
  assert.equal(report.errors.some((error) => error.includes(talismans[1].resourcePath)), true)
})

test('build-output check rejects a boss talisman resource path mapped to the wrong UUID', () => {
  const buildRoot = mkdtempSync(join(tmpdir(), 'cocos-build-wrong-talisman-uuid-'))
  writeFixture(buildRoot, 'assets/main/index.js', validMainIndex)
  writeFixture(buildRoot, 'assets/main/import/main-battle.json', `["MainBattle","${classId}"]`)
  writeBossTalismanFixture(buildRoot, { wrongUuid: 'roar' })

  const report = checkCocosBuildOutput({ buildRoot, projectRoot })

  assert.equal(report.ok, false)
  assert.equal(report.errors.some((error) => error.includes('talisman_roar') && error.includes('UUID')), true)
})

test('build-output check rejects missing boss talisman import and native artifacts', () => {
  const buildRoot = mkdtempSync(join(tmpdir(), 'cocos-build-missing-talisman-artifacts-'))
  writeFixture(buildRoot, 'assets/main/index.js', validMainIndex)
  writeFixture(buildRoot, 'assets/main/import/main-battle.json', `["MainBattle","${classId}"]`)
  writeBossTalismanFixture(buildRoot, { omitImport: 'sweep', omitNative: 'spike' })

  const report = checkCocosBuildOutput({ buildRoot, projectRoot })

  assert.equal(report.ok, false)
  assert.equal(report.errors.some((error) => error.includes('talisman_sweep') && error.includes('import')), true)
  assert.equal(report.errors.some((error) => error.includes('talisman_spike') && error.includes('native')), true)
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
  writeCompleteFixture(buildRoot)

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
  writeCompleteFixture(buildRoot)
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
