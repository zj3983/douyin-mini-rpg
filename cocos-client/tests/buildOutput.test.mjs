import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  checkCocosBuildOutput,
  compressAssetUuid,
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
  const sourcePath = resolve(`assets/resources/Assets/Skills/BossDomain/${name}.png`)
  const sourceMeta = JSON.parse(readFileSync(`${sourcePath}.meta`, 'utf8'))
  const spriteFrameMeta = sourceMeta.subMetas?.f9941
  const spriteFrameUuid = spriteFrameMeta?.uuid
  assert.equal(typeof spriteFrameUuid, 'string', `${name} should expose an @f9941 spriteFrame UUID`)
  const [spriteFrameAssetUuid, spriteFrameSubId] = spriteFrameUuid.split('@')
  return {
    name,
    sourcePath,
    sourceMeta,
    spriteFrameMeta,
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

function toVec3([x, y, z]) {
  return { x, y, z }
}

function createBossVfxImport(asset) {
  const frame = asset.spriteFrameMeta
  const data = frame.userData
  const [textureAssetUuid, textureSubId] = data.imageUuidOrDatabaseUri.split('@')
  return [
    1,
    [`${compressAssetUuidFixture(textureAssetUuid)}@${textureSubId}`],
    ['_textureSource'],
    ['cc.SpriteFrame'],
    0,
    [{
      name: frame.displayName,
      rect: { x: data.trimX, y: data.trimY, width: data.width, height: data.height },
      offset: { x: data.offsetX, y: data.offsetY },
      originalSize: { width: data.rawWidth, height: data.rawHeight },
      rotated: data.rotated,
      capInsets: [data.borderLeft, data.borderBottom, data.borderRight, data.borderTop],
      vertices: {
        rawPosition: [...data.vertices.rawPosition],
        indexes: [...data.vertices.indexes],
        uv: [...data.vertices.uv],
        nuv: [...data.vertices.nuv],
        minPos: toVec3(data.vertices.minPos),
        maxPos: toVec3(data.vertices.maxPos),
      },
      packable: data.packable,
      pixelsToUnit: data.pixelsToUnit,
      pivot: { x: data.pivotX, y: data.pivotY },
      meshType: data.meshType,
    }],
    [0],
    0,
    [0],
    [0],
    [0],
  ]
}

function writeBossVfxProjectFixture(root, targetName, mutateMeta) {
  writeFixture(
    root,
    'assets/Scripts/Game/PortraitBattleBootstrap.ts.meta',
    readFileSync(resolve('assets/Scripts/Game/PortraitBattleBootstrap.ts.meta')),
  )
  for (const asset of bossVfxAssets) {
    const meta = structuredClone(asset.sourceMeta)
    writeFixture(
      root,
      `assets/resources/Assets/Skills/BossDomain/${asset.name}.png.meta`,
      JSON.stringify(asset.name === targetName ? mutateMeta(meta) : meta),
    )
    writeFixture(
      root,
      `assets/resources/Assets/Skills/BossDomain/${asset.name}.png`,
      readFileSync(asset.sourcePath),
    )
  }
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
  const configNames = readdirSync(resourcesRoot)
  const configName = configNames.includes('config.json')
    ? 'config.json'
    : configNames.find((name) => /^config\.[0-9a-f]{5,32}\.json$/.test(name))
  assert.ok(configName, 'fixture should contain one exact or Cocos-hashed resources config')
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
  importOverrides = {},
  nativeOverrides = {},
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
        Object.hasOwn(importOverrides, asset.name)
          ? importOverrides[asset.name]
          : JSON.stringify(createBossVfxImport(asset)),
      )
    }
    if (asset.name !== omitNative) {
      writeFixture(
        root,
        `assets/resources/native/${asset.assetUuid.slice(0, 2)}/${asset.assetUuid}${hashed ? '.d3e4f' : ''}.png`,
        Object.hasOwn(nativeOverrides, asset.name)
          ? nativeOverrides[asset.name]
          : readFileSync(asset.sourcePath),
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

const spriteFramePayloadCorruptions = [
  ['name', (frame) => { frame.name = 'stale-name' }],
  ['rect', (frame) => { frame.rect.x += 1 }],
  ['offset', (frame) => { frame.offset.y += 1 }],
  ['originalSize', (frame) => { frame.originalSize.width += 1 }],
  ['rotated', (frame) => { frame.rotated = !frame.rotated }],
  ['capInsets', (frame) => { frame.capInsets[0] += 1 }],
  ['vertices.rawPosition', (frame) => { frame.vertices.rawPosition[0] += 1 }],
  ['vertices.indexes', (frame) => { frame.vertices.indexes[0] += 1 }],
  ['vertices.uv', (frame) => { frame.vertices.uv[0] += 1 }],
  ['vertices.nuv', (frame) => { frame.vertices.nuv[0] += 0.01 }],
  ['vertices.minPos', (frame) => { frame.vertices.minPos.x += 1 }],
  ['vertices.maxPos', (frame) => { frame.vertices.maxPos.x += 1 }],
  ['packable', (frame) => { frame.packable = !frame.packable }],
  ['pixelsToUnit', (frame) => { frame.pixelsToUnit += 1 }],
  ['pivot', (frame) => { frame.pivot.x += 0.1 }],
  ['meshType', (frame) => { frame.meshType += 1 }],
]

test('asset UUID compression matches a tracked Cocos config golden vector', () => {
  assert.equal(
    compressAssetUuid('01b722d2-e2e6-4b71-baa7-d9e6996f0168'),
    '01tyLS4uZLcbqn2eaZbwFo',
  )
  assert.throws(() => compressAssetUuid('not-a-uuid'), /canonical asset UUID/)
})

test('build-output check accepts Cocos production filename hashes', () => {
  const buildRoot = mkdtempSync(join(tmpdir(), 'cocos-build-hashed-'))
  writeFixture(buildRoot, 'assets/main/index.a1b2c.js', validMainIndex)
  writeFixture(buildRoot, 'assets/main/import/main-battle.c3d4e.json', `["MainBattle","${classId}"]`)

  writeBossVfxFixture(buildRoot, { hashed: true })
  writeH3AnimationFixture(buildRoot)

  const report = checkCocosBuildOutput({ buildRoot, projectRoot })

  assert.equal(report.ok, true, report.errors.join('\n'))
})

test('build-output check gives exact filenames precedence over hashed candidates', () => {
  const buildRoot = mkdtempSync(join(tmpdir(), 'cocos-build-exact-precedence-'))
  writeCompleteFixture(buildRoot)
  const asset = bossVfxAssets[0]

  for (const hash of ['a1b2c', 'c3d4e']) {
    writeFixture(buildRoot, `assets/main/index.${hash}.js`, `${validMainIndex} talisman`)
    writeFixture(buildRoot, `assets/resources/config.${hash}.json`, '{')
    writeFixture(
      buildRoot,
      `assets/resources/import/${asset.spriteFrameUuid.slice(0, 2)}/${asset.spriteFrameUuid}.${hash}.json`,
      '',
    )
    writeFixture(
      buildRoot,
      `assets/resources/native/${asset.assetUuid.slice(0, 2)}/${asset.assetUuid}.${hash}.png`,
      'stale-native',
    )
  }

  const report = checkCocosBuildOutput({ buildRoot, projectRoot })

  assert.equal(report.ok, true, report.errors.join('\n'))
})

for (const [label, suffix] of [
  ['backup word', 'backup'],
  ['old word', 'old'],
  ['non-hex word', 'abcxy'],
  ['four hex characters', 'abcd'],
  ['more than a full hex digest', 'a'.repeat(33)],
]) {
  test(`build-output check rejects ${label} as a filename hash`, () => {
    const buildRoot = mkdtempSync(join(tmpdir(), 'cocos-build-invalid-hash-'))
    writeCompleteFixture(buildRoot)
    renameSync(
      join(buildRoot, 'assets/main/index.js'),
      join(buildRoot, `assets/main/index.${suffix}.js`),
    )
    renameSync(
      join(buildRoot, 'assets/resources/config.json'),
      join(buildRoot, `assets/resources/config.${suffix}.json`),
    )

    const report = checkCocosBuildOutput({ buildRoot, projectRoot })

    assert.equal(report.ok, false)
    assert.equal(report.errors.some((error) => error.includes('missing built main index')), true)
    assert.equal(report.errors.some((error) => error.includes('missing built resources config')), true)
  })
}

test('build-output check rejects ambiguous hashed main indexes and resources configs', () => {
  const buildRoot = mkdtempSync(join(tmpdir(), 'cocos-build-ambiguous-hashes-'))
  writeCompleteFixture(buildRoot)
  const configPath = join(buildRoot, 'assets/resources/config.json')
  const configSource = readFileSync(configPath)
  renameSync(join(buildRoot, 'assets/main/index.js'), join(buildRoot, 'assets/main/index.a1b2c.js'))
  writeFixture(buildRoot, 'assets/main/index.c3d4e.js', validMainIndex)
  renameSync(configPath, join(buildRoot, 'assets/resources/config.a1b2c.json'))
  writeFixture(buildRoot, 'assets/resources/config.c3d4e.json', configSource)

  const report = checkCocosBuildOutput({ buildRoot, projectRoot })

  assert.equal(report.ok, false)
  assert.equal(report.errors.some((error) => error.includes('ambiguous built main index')), true)
  assert.equal(report.errors.some((error) => error.includes('ambiguous built resources config')), true)
})

test('build-output check rejects ambiguous hashed boss VFX import and native artifacts', () => {
  const buildRoot = mkdtempSync(join(tmpdir(), 'cocos-build-ambiguous-boss-vfx-'))
  writeCompleteFixture(buildRoot, validMainIndex, { hashed: true })
  const asset = bossVfxAssets[0]
  writeFixture(
    buildRoot,
    `assets/resources/import/${asset.spriteFrameUuid.slice(0, 2)}/${asset.spriteFrameUuid}.c3d4e.json`,
    JSON.stringify(createBossVfxImport(asset)),
  )
  writeFixture(
    buildRoot,
    `assets/resources/native/${asset.assetUuid.slice(0, 2)}/${asset.assetUuid}.c3d4e.png`,
    readFileSync(asset.sourcePath),
  )

  const report = checkCocosBuildOutput({ buildRoot, projectRoot })

  assert.equal(report.ok, false)
  assert.equal(
    report.errors.some((error) => error.includes('ambiguous') && error.includes('sweep_arc import')),
    true,
  )
  assert.equal(
    report.errors.some((error) => error.includes('ambiguous') && error.includes('sweep_arc native')),
    true,
  )
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

test('build-output check validates canonical layered boss VFX source meta UUID relationships', () => {
  const asset = bossVfxAssets.find(({ name }) => name === 'roar_wave')
  const otherAsset = bossVfxAssets.find(({ name }) => name === 'sweep_arc')
  const cases = [
    [
      'malformed top-level UUID',
      (meta) => ({ ...meta, uuid: 'not-a-uuid' }),
      'invalid top-level asset UUID',
    ],
    [
      'cross-asset spriteFrame UUID',
      (meta) => ({
        ...meta,
        subMetas: {
          ...meta.subMetas,
          f9941: { ...meta.subMetas.f9941, uuid: `${otherAsset.assetUuid}@f9941` },
        },
      }),
      'must use spriteFrame UUID',
    ],
    [
      'extra spriteFrame UUID suffix',
      (meta) => ({
        ...meta,
        subMetas: {
          ...meta.subMetas,
          f9941: { ...meta.subMetas.f9941, uuid: `${meta.uuid}@f9941@extra` },
        },
      }),
      'must use spriteFrame UUID',
    ],
    [
      'wrong spriteFrame importer',
      (meta) => ({
        ...meta,
        subMetas: {
          ...meta.subMetas,
          f9941: { ...meta.subMetas.f9941, importer: 'texture' },
        },
      }),
      'must use importer sprite-frame and name spriteFrame',
    ],
    [
      'wrong spriteFrame name',
      (meta) => ({
        ...meta,
        subMetas: {
          ...meta.subMetas,
          f9941: { ...meta.subMetas.f9941, name: asset.name },
        },
      }),
      'must use importer sprite-frame and name spriteFrame',
    ],
  ]

  for (const [name, mutate, expected] of cases) {
    const buildRoot = mkdtempSync(join(tmpdir(), 'cocos-build-invalid-boss-meta-'))
    const sourceRoot = mkdtempSync(join(tmpdir(), 'cocos-source-invalid-boss-meta-'))
    writeCompleteFixture(buildRoot)
    writeBossVfxProjectFixture(sourceRoot, asset.name, mutate)

    const report = checkCocosBuildOutput({ buildRoot, projectRoot: sourceRoot })

    assert.equal(
      report.errors.some((error) => error.includes(asset.name) && error.includes(expected)),
      true,
      `${name}: ${report.errors.join('\n')}`,
    )
  }
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

for (const [label, source, expected] of [
  ['empty', '', 'is empty'],
  ['malformed', '{', 'contains malformed JSON'],
]) {
  test(`build-output check rejects ${label} layered boss VFX import JSON`, () => {
    const buildRoot = mkdtempSync(join(tmpdir(), 'cocos-build-corrupt-boss-import-'))
    writeCompleteFixture(buildRoot, validMainIndex, {
      importOverrides: { sweep_arc: source },
    })

    const report = checkCocosBuildOutput({ buildRoot, projectRoot })

    assert.equal(report.ok, false)
    assert.equal(
      report.errors.some((error) => error.includes('sweep_arc import artifact') && error.includes(expected)),
      true,
      report.errors.join('\n'),
    )
  })
}

for (const [field, mutate] of spriteFramePayloadCorruptions) {
  test(`build-output check rejects stale layered boss VFX import payload field ${field}`, () => {
    const buildRoot = mkdtempSync(join(tmpdir(), 'cocos-build-stale-boss-import-'))
    const asset = bossVfxAssets.find(({ name }) => name === 'roar_wave')
    const payload = createBossVfxImport(asset)
    mutate(payload[5][0])
    writeCompleteFixture(buildRoot, validMainIndex, {
      importOverrides: { [asset.name]: JSON.stringify(payload) },
    })

    const report = checkCocosBuildOutput({ buildRoot, projectRoot })

    assert.equal(report.ok, false, field)
    assert.equal(
      report.errors.some((error) => error.includes(asset.name) && error.includes(`field ${field}`)),
      true,
      report.errors.join('\n'),
    )
  })
}

test('build-output check rejects stale layered boss VFX native PNG bytes', () => {
  const buildRoot = mkdtempSync(join(tmpdir(), 'cocos-build-stale-boss-native-'))
  writeCompleteFixture(buildRoot, validMainIndex, {
    nativeOverrides: { impact_spark: 'stale-native-png' },
  })

  const report = checkCocosBuildOutput({ buildRoot, projectRoot })

  assert.equal(report.ok, false)
  assert.equal(
    report.errors.some((error) => error.includes('impact_spark native PNG bytes differ')),
    true,
    report.errors.join('\n'),
  )
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

for (const allowedReference of ['TalismanCatalog', 'talismanicTheme']) {
  test(`build-output check allows non-retired near-match ${allowedReference}`, () => {
    const buildRoot = mkdtempSync(join(tmpdir(), 'cocos-build-talisman-near-match-'))
    writeCompleteFixture(buildRoot, `${validMainIndex} ${allowedReference}`)

    const report = checkCocosBuildOutput({ buildRoot, projectRoot })

    assert.equal(report.ok, true, report.errors.join('\n'))
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
