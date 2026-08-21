import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
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
const bossVfxCompiledMarkers = 'BossTelegraphVisualProfile BossTelegraphPresenter BossHazardVisualController'
const dungeonRuntimeMarkers = 'DungeonPressureRuntime PursuitBossRuntime DungeonRunPresenter DungeonResourceController'
const validMainIndex = `${legacyMainIndex} ${bossVfxCompiledMarkers} ${dungeonRuntimeMarkers}`
const bossVfxNames = [
  'sweep_arc',
  'sweep_trail',
  'spike_cluster',
  'ground_dust',
  'roar_wave',
  'leaf_particle',
  'impact_spark',
]
const retiredBossRuntimeReferences = [
  'talisman',
  'Talisman',
  'setTalisman',
  'talismanFrames',
  'talismanPath',
  'talismanPulse',
  'talisman_sweep',
  'talisman_spike',
  'talisman_roar',
]
const bossVfxAssets = bossVfxNames.map((name) => {
  const sourceMeta = JSON.parse(
    readFileSync(resolve(`assets/resources/Assets/Skills/BossDomain/${name}.png.meta`), 'utf8'),
  )
  const spriteFrameUuid = sourceMeta.subMetas?.f9941?.uuid
  assert.equal(typeof spriteFrameUuid, 'string', `${name} should expose an @f9941 spriteFrame UUID`)
  const [spriteFrameAssetUuid, spriteFrameSubId] = spriteFrameUuid.split('@')
  return {
    name,
    assetUuid: sourceMeta.uuid,
    spriteFrameUuid,
    builtSpriteFrameUuid: `${compressAssetUuidFixture(spriteFrameAssetUuid)}@${spriteFrameSubId}`,
    resourcePath: `Assets/Skills/BossDomain/${name}/spriteFrame`,
  }
})
const h3ActorIds = new Set(['qinglan-sword-cultivator', 'moss-wolf'])
const h3Manifest = JSON.parse(readFileSync(resolve('assets/resources/Data/animation-atlas.json'), 'utf8'))
const h3ManifestUuid = JSON.parse(
  readFileSync(resolve('assets/resources/Data/animation-atlas.json.meta'), 'utf8'),
).uuid
const h3AtlasAssets = [...new Set(
  h3Manifest.actors
    .filter(({ id }) => h3ActorIds.has(id))
    .flatMap(({ actions }) => actions.map(({ atlas }) => atlas)),
)].map((atlas) => {
  const sourcePath = resolve('assets/resources', atlas)
  const meta = JSON.parse(readFileSync(`${sourcePath}.meta`, 'utf8'))
  const textureUuid = Object.values(meta.subMetas).find(({ name }) => name === 'texture').uuid
  return {
    atlas,
    sourcePath,
    uuid: meta.uuid,
    textureUuid: `${compressAssetUuidFixture(textureUuid.split('@')[0])}@${textureUuid.split('@')[1]}`,
    resourcePath: atlas.replace(/\.png$/, '/texture'),
  }
})

function writeFixture(root, path, source) {
  const target = join(root, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, source)
}

function writeH3AnimationFixture(root, manifest = h3Manifest) {
  writeFixture(
    root,
    `assets/resources/import/${h3ManifestUuid.slice(0, 2)}/${h3ManifestUuid}.json`,
    JSON.stringify([manifest]),
  )
  for (const asset of h3AtlasAssets) {
    writeFixture(
      root,
      `assets/resources/native/${asset.uuid.slice(0, 2)}/${asset.uuid}.png`,
      readFileSync(asset.sourcePath),
    )
  }
  const resourcesRoot = join(root, 'assets/resources')
  const configName = readdirSync(resourcesRoot).find((name) => /^config(?:\.[^.]+)?\.json$/.test(name))
  const configPath = join(resourcesRoot, configName)
  const config = JSON.parse(readFileSync(configPath, 'utf8'))
  for (const asset of h3AtlasAssets) {
    if (Object.values(config.paths).some((value) => value[0] === asset.resourcePath)) continue
    const index = config.uuids.length
    config.uuids.push(asset.textureUuid)
    config.paths[index] = [asset.resourcePath, 2, 1]
  }
  writeFileSync(configPath, JSON.stringify(config))
}

function reverseObjectKeys(value) {
  if (Array.isArray(value)) return value.map(reverseObjectKeys)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value).reverse().map(([key, child]) => [key, reverseObjectKeys(child)]),
  )
}

function writeBossVfxFixture(root, {
  omitPath = null,
  wrongUuid = null,
  omitImport = null,
  omitNative = null,
  retiredPath = null,
  hashed = false,
} = {}) {
  const uuids = []
  const paths = {}

  for (const asset of bossVfxAssets) {
    const index = uuids.length
    uuids.push(asset.name === wrongUuid ? 'wrong-resource-uuid@f9941' : asset.builtSpriteFrameUuid)
    if (asset.name !== omitPath) paths[index] = [asset.resourcePath, 3, 1]
    if (asset.name !== omitImport) {
      writeFixture(
        root,
        `assets/resources/import/${asset.spriteFrameUuid.slice(0, 2)}/${asset.spriteFrameUuid}${hashed ? '.a1b2c' : ''}.json`,
        `{"name":"${asset.name}"}`,
      )
    }
    if (asset.name !== omitNative) {
      writeFixture(
        root,
        `assets/resources/native/${asset.assetUuid.slice(0, 2)}/${asset.assetUuid}${hashed ? '.d3e4f' : ''}.png`,
        'png-fixture',
      )
    }
  }

  if (retiredPath) {
    const index = uuids.length
    uuids.push('retired-resource-uuid@f9941')
    paths[index] = [`Assets/Skills/BossDomain/${retiredPath}/spriteFrame`, 3, 1]
  }

  writeFixture(
    root,
    `assets/resources/config${hashed ? '.f5a6b' : ''}.json`,
    JSON.stringify({ uuids, paths }),
  )
}

function writeCompleteFixture(root, mainIndex = validMainIndex, bossVfxOptions = {}) {
  writeFixture(root, 'assets/main/index.js', mainIndex)
  writeFixture(root, 'assets/main/import/main-battle.json', `["MainBattle","${classId}"]`)
  writeBossVfxFixture(root, bossVfxOptions)
  writeH3AnimationFixture(root)
}

test('build-output check accepts Cocos production filename hashes', () => {
  const buildRoot = mkdtempSync(join(tmpdir(), 'cocos-build-hashed-'))
  writeFixture(buildRoot, 'assets/main/index.a1b2c.js', validMainIndex)
  writeFixture(buildRoot, 'assets/main/import/main-battle.c3d4e.json', `["MainBattle","${classId}"]`)

  writeBossVfxFixture(buildRoot, { hashed: true })
  writeH3AnimationFixture(buildRoot)

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

test('build-output check rejects output without compiled layered boss VFX feature markers', () => {
  const buildRoot = mkdtempSync(join(tmpdir(), 'cocos-build-missing-boss-vfx-code-'))
  writeCompleteFixture(buildRoot, legacyMainIndex)

  const report = checkCocosBuildOutput({ buildRoot, projectRoot })

  assert.equal(report.ok, false)
  assert.equal(report.errors.some((error) => error.includes('layered boss VFX compiled feature')), true)
})

test('build-output check rejects output without compiled dungeon runtime markers', () => {
  const buildRoot = mkdtempSync(join(tmpdir(), 'cocos-build-missing-dungeon-runtime-'))
  writeCompleteFixture(buildRoot, `${legacyMainIndex} ${bossVfxCompiledMarkers}`)

  const report = checkCocosBuildOutput({ buildRoot, projectRoot })

  assert.equal(report.ok, false)
  assert.equal(report.errors.some((error) => error.includes('dungeon compiled feature')), true)
})

test('build-output check rejects an omitted layered boss VFX spriteFrame resource path', () => {
  const buildRoot = mkdtempSync(join(tmpdir(), 'cocos-build-missing-boss-vfx-path-'))
  writeFixture(buildRoot, 'assets/main/index.js', validMainIndex)
  writeFixture(buildRoot, 'assets/main/import/main-battle.json', `["MainBattle","${classId}"]`)
  writeBossVfxFixture(buildRoot, { omitPath: 'spike_cluster' })

  const report = checkCocosBuildOutput({ buildRoot, projectRoot })

  assert.equal(report.ok, false)
  assert.equal(report.errors.some((error) => error.includes('Assets/Skills/BossDomain/spike_cluster/spriteFrame')), true)
})

test('build-output check rejects a layered boss VFX resource path mapped to the wrong UUID', () => {
  const buildRoot = mkdtempSync(join(tmpdir(), 'cocos-build-wrong-boss-vfx-uuid-'))
  writeFixture(buildRoot, 'assets/main/index.js', validMainIndex)
  writeFixture(buildRoot, 'assets/main/import/main-battle.json', `["MainBattle","${classId}"]`)
  writeBossVfxFixture(buildRoot, { wrongUuid: 'roar_wave' })

  const report = checkCocosBuildOutput({ buildRoot, projectRoot })

  assert.equal(report.ok, false)
  assert.equal(report.errors.some((error) => error.includes('roar_wave') && error.includes('UUID')), true)
})

test('build-output check rejects missing layered boss VFX import and native artifacts', () => {
  const buildRoot = mkdtempSync(join(tmpdir(), 'cocos-build-missing-boss-vfx-artifacts-'))
  writeFixture(buildRoot, 'assets/main/index.js', validMainIndex)
  writeFixture(buildRoot, 'assets/main/import/main-battle.json', `["MainBattle","${classId}"]`)
  writeBossVfxFixture(buildRoot, { omitImport: 'sweep_arc', omitNative: 'spike_cluster' })

  const report = checkCocosBuildOutput({ buildRoot, projectRoot })

  assert.equal(report.ok, false)
  assert.equal(report.errors.some((error) => error.includes('sweep_arc') && error.includes('import')), true)
  assert.equal(report.errors.some((error) => error.includes('spike_cluster') && error.includes('native')), true)
})

test('build-output check rejects retired boss talisman resource settings paths', () => {
  const buildRoot = mkdtempSync(join(tmpdir(), 'cocos-build-retired-talisman-path-'))
  writeCompleteFixture(buildRoot, validMainIndex, { retiredPath: 'talisman_sweep' })

  const report = checkCocosBuildOutput({ buildRoot, projectRoot })

  assert.equal(report.ok, false)
  assert.equal(
    report.errors.some((error) => error.includes('Assets/Skills/BossDomain/talisman_')),
    true,
  )
})

for (const reference of retiredBossRuntimeReferences) {
  test(`build-output check rejects retired boss runtime reference ${reference}`, () => {
    const buildRoot = mkdtempSync(join(tmpdir(), 'cocos-build-retired-talisman-runtime-'))
    writeCompleteFixture(buildRoot, `${validMainIndex} ${reference}`)

    const report = checkCocosBuildOutput({ buildRoot, projectRoot })

    assert.equal(report.ok, false, reference)
    assert.equal(
      report.errors.includes(
        `built main index contains retired boss talisman runtime reference: ${reference}`,
      ),
      true,
      report.errors.join('\n'),
    )
  })
}

test('build-output check rejects output without the promoted H3 animation contract', () => {
  const buildRoot = mkdtempSync(join(tmpdir(), 'cocos-build-missing-h3-runtime-'))
  writeCompleteFixture(buildRoot)
  writeH3AnimationFixture(buildRoot, {
    ...h3Manifest,
    actors: h3Manifest.actors.filter(({ id }) => !h3ActorIds.has(id)),
  })

  const report = checkCocosBuildOutput({ buildRoot, projectRoot })

  assert.equal(report.ok, false)
  assert.equal(report.errors.some((error) => error.includes('H3 animation')), true)
})

test('build-output check accepts Cocos key reordering in the promoted H3 manifest', () => {
  const buildRoot = mkdtempSync(join(tmpdir(), 'cocos-build-reordered-h3-runtime-'))
  writeCompleteFixture(buildRoot)
  writeH3AnimationFixture(buildRoot, reverseObjectKeys(h3Manifest))

  const report = checkCocosBuildOutput({ buildRoot, projectRoot })

  assert.equal(report.ok, true, report.errors.join('\n'))
})

test('build-output check rejects a promoted H3 atlas whose bytes are stale', () => {
  const buildRoot = mkdtempSync(join(tmpdir(), 'cocos-build-stale-h3-atlas-'))
  writeCompleteFixture(buildRoot)
  const stale = h3AtlasAssets.find(({ atlas }) => atlas.endsWith('/MossWolf/attack.png'))
  writeFixture(
    buildRoot,
    `assets/resources/native/${stale.uuid.slice(0, 2)}/${stale.uuid}.png`,
    'stale-atlas',
  )

  const report = checkCocosBuildOutput({ buildRoot, projectRoot })

  assert.equal(report.ok, false)
  assert.equal(report.errors.some((error) => error.includes('H3 atlas bytes') && error.includes(stale.atlas)), true)
})

test('build-output check rejects a promoted H3 atlas omitted from the resources path index', () => {
  const buildRoot = mkdtempSync(join(tmpdir(), 'cocos-build-missing-h3-path-'))
  writeCompleteFixture(buildRoot)
  const omitted = h3AtlasAssets.find(({ atlas }) => atlas.endsWith('/MossWolf/attack.png'))
  const configPath = join(buildRoot, 'assets/resources/config.json')
  const config = JSON.parse(readFileSync(configPath, 'utf8'))
  config.paths = Object.fromEntries(
    Object.entries(config.paths).filter(([, value]) => value[0] !== omitted.resourcePath),
  )
  writeFileSync(configPath, JSON.stringify(config))

  const report = checkCocosBuildOutput({ buildRoot, projectRoot })

  assert.equal(report.ok, false)
  assert.equal(report.errors.some((error) => error.includes('H3 atlas resource path') && error.includes(omitted.resourcePath)), true)
})

test('build-output check rejects a promoted H3 atlas path mapped to the wrong texture UUID', () => {
  const buildRoot = mkdtempSync(join(tmpdir(), 'cocos-build-wrong-h3-path-uuid-'))
  writeCompleteFixture(buildRoot)
  const wrong = h3AtlasAssets.find(({ atlas }) => atlas.endsWith('/MossWolf/attack.png'))
  const configPath = join(buildRoot, 'assets/resources/config.json')
  const config = JSON.parse(readFileSync(configPath, 'utf8'))
  const pathEntry = Object.entries(config.paths).find(([, value]) => value[0] === wrong.resourcePath)
  config.uuids[Number(pathEntry[0])] = 'wrong-h3-texture-uuid'
  writeFileSync(configPath, JSON.stringify(config))

  const report = checkCocosBuildOutput({ buildRoot, projectRoot })

  assert.equal(report.ok, false)
  assert.equal(report.errors.some((error) => error.includes('H3 atlas resource UUID') && error.includes(wrong.resourcePath)), true)
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
