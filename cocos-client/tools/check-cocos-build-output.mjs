import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import {
  checkCocosBuildReadiness,
  isCanonicalAssetUuid,
} from './check-cocos-build-readiness.mjs'

const base64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const bossVfxNames = [
  'sweep_arc',
  'sweep_trail',
  'spike_cluster',
  'ground_dust',
  'roar_wave',
  'leaf_particle',
  'impact_spark',
]
const bossVfxCompiledMarkers = [
  'BossTelegraphVisualProfile',
  'BossTelegraphPresenter',
  'BossHazardVisualController',
]
const retiredBossResourcePathPrefix = 'Assets/Skills/BossDomain/talisman_'
const retiredBossCompiledReferencePattern = /(?:^|[^A-Za-z0-9_$])(setTalisman|talismanFrames|talismanPath|talismanPulse|talisman_sweep|talisman_spike|talisman_roar|Talisman|talisman)(?![A-Za-z0-9_$])/
const cocosBuildHashMinLength = 5
const cocosBuildHashMaxLength = 32
const cocosSubAssetIdPattern = /^[0-9a-f]{5}$/
const dungeonCompiledMarkers = [
  'DungeonPressureRuntime',
  'PursuitBossRuntime',
  'DungeonRunPresenter',
  'DungeonResourceController',
]
const h3ActorIds = ['qinglan-sword-cultivator', 'moss-wolf']

function compressUuid(uuid, prefixLength) {
  const hex = uuid.replaceAll('-', '')
  let compressed = hex.slice(0, prefixLength)
  for (let index = prefixLength; index < hex.length; index += 3) {
    const value = Number.parseInt(hex.slice(index, index + 3), 16)
    compressed += base64[value >> 6] + base64[value & 63]
  }
  return compressed
}

export function compressScriptUuid(uuid) {
  return compressUuid(uuid, 5)
}

export function compressAssetUuid(uuid) {
  if (!isCanonicalAssetUuid(uuid)) {
    throw new TypeError(`compressAssetUuid expected a canonical asset UUID, received ${JSON.stringify(uuid)}`)
  }
  return compressUuid(uuid, 2)
}

function parseSubAssetUuid(value) {
  if (typeof value !== 'string') return null
  const parts = value.split('@')
  if (
    parts.length !== 2
    || !isCanonicalAssetUuid(parts[0])
    || !cocosSubAssetIdPattern.test(parts[1])
  ) return null
  return { assetUuid: parts[0], subId: parts[1] }
}

function collectFiles(root) {
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name)
    return entry.isDirectory() ? collectFiles(path) : [path]
  })
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function findBuildFile(directory, basename, extension, errors, description) {
  if (!existsSync(directory)) return null
  const exactName = `${basename}${extension}`
  const names = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
  if (names.includes(exactName)) return exactName

  const hashedNamePattern = new RegExp(
    `^${escapeRegExp(basename)}\\.[0-9a-f]{${cocosBuildHashMinLength},${cocosBuildHashMaxLength}}${escapeRegExp(extension)}$`,
  )
  const hashedNames = names.filter((name) => hashedNamePattern.test(name)).sort()
  if (hashedNames.length > 1) {
    errors.push(`ambiguous ${description} in: ${directory}: ${hashedNames.join(', ')}`)
    return undefined
  }
  return hashedNames[0] ?? null
}

function readBossVfxMeta(projectRoot, name, errors) {
  const sourceImagePath = resolve(
    projectRoot,
    `assets/resources/Assets/Skills/BossDomain/${name}.png`,
  )
  const metaPath = `${sourceImagePath}.meta`
  if (!existsSync(metaPath)) {
    errors.push(`missing layered boss VFX image meta for ${name}: ${metaPath}`)
    return null
  }

  let meta
  try {
    meta = JSON.parse(readFileSync(metaPath, 'utf8'))
  } catch (error) {
    errors.push(`invalid layered boss VFX image meta for ${name}: ${metaPath}: ${error.message}`)
    return null
  }

  const assetUuid = meta.uuid
  const spriteFrameMeta = meta.subMetas?.f9941
  let valid = true
  if (!isCanonicalAssetUuid(assetUuid)) {
    errors.push(`layered boss VFX image meta for ${name} has invalid top-level asset UUID: ${metaPath}`)
    valid = false
  }
  if (spriteFrameMeta?.importer !== 'sprite-frame' || spriteFrameMeta?.name !== 'spriteFrame') {
    errors.push(`layered boss VFX image meta for ${name} must use importer sprite-frame and name spriteFrame: ${metaPath}`)
    valid = false
  }
  if (
    isCanonicalAssetUuid(assetUuid)
    && spriteFrameMeta?.uuid !== `${assetUuid}@f9941`
  ) {
    errors.push(`layered boss VFX image meta for ${name} must use spriteFrame UUID ${assetUuid}@f9941: ${metaPath}`)
    valid = false
  }
  if (!valid) return null

  return {
    assetUuid,
    spriteFrameUuid: spriteFrameMeta.uuid,
    spriteFrameMeta,
    sourceImagePath,
  }
}

function toVec3(value) {
  if (!Array.isArray(value)) return value
  return { x: value[0], y: value[1], z: value[2] }
}

function expectedBossVfxSpriteFramePayload(spriteFrameMeta) {
  const data = spriteFrameMeta.userData ?? {}
  const vertices = data.vertices ?? {}
  return {
    name: spriteFrameMeta.displayName,
    rect: { x: data.trimX, y: data.trimY, width: data.width, height: data.height },
    offset: { x: data.offsetX, y: data.offsetY },
    originalSize: { width: data.rawWidth, height: data.rawHeight },
    rotated: data.rotated,
    capInsets: [data.borderLeft, data.borderBottom, data.borderRight, data.borderTop],
    vertices: {
      rawPosition: vertices.rawPosition,
      indexes: vertices.indexes,
      uv: vertices.uv,
      nuv: vertices.nuv,
      minPos: toVec3(vertices.minPos),
      maxPos: toVec3(vertices.maxPos),
    },
    packable: data.packable,
    pixelsToUnit: data.pixelsToUnit,
    pivot: { x: data.pivotX, y: data.pivotY },
    meshType: data.meshType,
  }
}

const bossVfxSpriteFramePayloadFields = [
  'name',
  'rect',
  'offset',
  'originalSize',
  'rotated',
  'capInsets',
  'vertices.rawPosition',
  'vertices.indexes',
  'vertices.uv',
  'vertices.nuv',
  'vertices.minPos',
  'vertices.maxPos',
  'packable',
  'pixelsToUnit',
  'pivot',
  'meshType',
]

function readPath(value, path) {
  return path.split('.').reduce((current, key) => current?.[key], value)
}

function findCocosSpriteFramePayload(importArtifact) {
  if (
    !Array.isArray(importArtifact)
    || !Array.isArray(importArtifact[3])
    || !importArtifact[3].includes('cc.SpriteFrame')
    || !Array.isArray(importArtifact[5])
  ) return null
  return importArtifact[5].find((value) => (
    value !== null && typeof value === 'object' && !Array.isArray(value)
  )) ?? null
}

function validateBossVfxImport(importPath, name, spriteFrameMeta, errors) {
  const source = readFileSync(importPath, 'utf8')
  if (source.trim() === '') {
    errors.push(`built layered boss VFX ${name} import artifact is empty: ${importPath}`)
    return
  }

  let importArtifact
  try {
    importArtifact = JSON.parse(source)
  } catch (error) {
    errors.push(`built layered boss VFX ${name} import artifact contains malformed JSON: ${importPath}: ${error.message}`)
    return
  }

  const payload = findCocosSpriteFramePayload(importArtifact)
  if (!payload) {
    errors.push(`built layered boss VFX ${name} import artifact omits a cc.SpriteFrame payload: ${importPath}`)
    return
  }

  const sourceTextureUuid = spriteFrameMeta.userData?.imageUuidOrDatabaseUri
  const parsedTextureUuid = parseSubAssetUuid(sourceTextureUuid)
  if (!parsedTextureUuid) {
    errors.push(`layered boss VFX source meta for ${name} has invalid imageUuidOrDatabaseUri ${JSON.stringify(sourceTextureUuid)}`)
    return
  }
  const expectedTextureReference = `${compressAssetUuid(parsedTextureUuid.assetUuid)}@${parsedTextureUuid.subId}`
  if (!isDeepStrictEqual(importArtifact[1], [expectedTextureReference])) {
    errors.push(`built layered boss VFX ${name} import texture reference differs from source meta: expected ${expectedTextureReference}: ${importPath}`)
  }
  if (
    !isDeepStrictEqual(importArtifact[2], ['_textureSource'])
    || !isDeepStrictEqual(importArtifact[8], [0])
    || !isDeepStrictEqual(importArtifact[9], [0])
    || !isDeepStrictEqual(importArtifact[10], [0])
  ) {
    errors.push(`built layered boss VFX ${name} import _textureSource property mapping differs from the Cocos SpriteFrame contract: ${importPath}`)
  }

  const expectedPayload = expectedBossVfxSpriteFramePayload(spriteFrameMeta)
  for (const field of bossVfxSpriteFramePayloadFields) {
    if (!isDeepStrictEqual(readPath(payload, field), readPath(expectedPayload, field))) {
      errors.push(`built layered boss VFX ${name} import payload field ${field} differs from source meta: ${importPath}`)
    }
  }
}

function findEmbeddedAnimationManifest(value) {
  if (!value || typeof value !== 'object') return null
  if (
    value.version === 2
    && value.framePacking === 'vertical-slice-action-atlases'
    && Array.isArray(value.actors)
  ) return value
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    const found = findEmbeddedAnimationManifest(child)
    if (found) return found
  }
  return null
}

function checkH3AnimationOutput({ projectRoot, resourcesRoot, resourcesConfig, errors }) {
  const sourceManifestPath = resolve(projectRoot, 'assets/resources/Data/animation-atlas.json')
  const manifestMetaPath = `${sourceManifestPath}.meta`
  if (!existsSync(sourceManifestPath) || !existsSync(manifestMetaPath)) {
    errors.push(`missing H3 animation manifest or meta: ${sourceManifestPath}`)
    return
  }

  let sourceManifest
  let manifestUuid
  try {
    sourceManifest = JSON.parse(readFileSync(sourceManifestPath, 'utf8'))
    manifestUuid = JSON.parse(readFileSync(manifestMetaPath, 'utf8')).uuid
  } catch (error) {
    errors.push(`invalid H3 animation manifest or meta: ${error.message}`)
    return
  }

  const manifestImportRoot = join(resourcesRoot, 'import', manifestUuid.slice(0, 2))
  const manifestImportName = findBuildFile(
    manifestImportRoot,
    manifestUuid,
    '.json',
    errors,
    'built H3 animation manifest',
  )
  let builtManifest = null
  if (manifestImportName === null) {
    errors.push(`built H3 animation manifest is missing in: ${manifestImportRoot}`)
  } else if (manifestImportName) {
    try {
      builtManifest = findEmbeddedAnimationManifest(
        JSON.parse(readFileSync(join(manifestImportRoot, manifestImportName), 'utf8')),
      )
    } catch (error) {
      errors.push(`invalid built H3 animation manifest: ${error.message}`)
    }
  }

  const sourceActors = sourceManifest.actors?.filter(({ id }) => h3ActorIds.includes(id)) ?? []
  const builtActors = builtManifest?.actors?.filter(({ id }) => h3ActorIds.includes(id)) ?? []
  if (!isDeepStrictEqual(builtActors, sourceActors)) {
    errors.push('built H3 animation contract differs from the promoted source manifest')
  }

  const atlasPaths = [...new Set(
    sourceActors.flatMap(({ actions }) => actions.map(({ atlas }) => atlas)),
  )]
  for (const atlasPath of atlasPaths) {
    const sourcePath = resolve(projectRoot, 'assets/resources', atlasPath)
    const metaPath = `${sourcePath}.meta`
    if (!existsSync(sourcePath) || !existsSync(metaPath)) {
      errors.push(`missing H3 atlas or meta: ${atlasPath}`)
      continue
    }

    let meta
    try {
      meta = JSON.parse(readFileSync(metaPath, 'utf8'))
    } catch (error) {
      errors.push(`invalid H3 atlas meta ${atlasPath}: ${error.message}`)
      continue
    }
    const uuid = meta.uuid
    if (resourcesConfig) {
      const textureMeta = Object.values(meta.subMetas ?? {}).find((subMeta) => subMeta?.name === 'texture')
      const resourcePath = atlasPath.replace(/\.png$/, '/texture')
      if (!textureMeta?.uuid) {
        errors.push(`missing H3 atlas texture meta: ${atlasPath}`)
      } else {
        const parsedTextureUuid = parseSubAssetUuid(textureMeta.uuid)
        if (!parsedTextureUuid) {
          errors.push(`invalid H3 atlas texture submeta UUID ${JSON.stringify(textureMeta.uuid)}: ${atlasPath}`)
        } else {
          const expectedTextureUuid = `${compressAssetUuid(parsedTextureUuid.assetUuid)}@${parsedTextureUuid.subId}`
          const pathEntry = Object.entries(resourcesConfig.paths ?? {})
            .find(([, value]) => Array.isArray(value) && value[0] === resourcePath)
          if (!pathEntry) {
            errors.push(`built H3 atlas resource path is missing: ${resourcePath}`)
          } else {
            const actualTextureUuid = resourcesConfig.uuids?.[Number(pathEntry[0])]
            if (actualTextureUuid !== expectedTextureUuid) {
              errors.push(`built H3 atlas resource UUID ${actualTextureUuid ?? '<missing>'} for ${resourcePath} does not match ${expectedTextureUuid}`)
            }
          }
        }
      }
    }
    const nativeRoot = join(resourcesRoot, 'native', uuid.slice(0, 2))
    const nativeName = findBuildFile(
      nativeRoot,
      uuid,
      extname(sourcePath),
      errors,
      `built H3 atlas ${atlasPath}`,
    )
    if (nativeName === null) {
      errors.push(`built H3 atlas is missing: ${atlasPath}`)
      continue
    }
    if (!nativeName) continue
    if (!readFileSync(sourcePath).equals(readFileSync(join(nativeRoot, nativeName)))) {
      errors.push(`built H3 atlas bytes differ from source: ${atlasPath}`)
    }
  }
}

export function checkCocosBuildOutput({ buildRoot, projectRoot = process.cwd() }) {
  const resolvedBuildRoot = resolve(buildRoot)
  const metaPath = resolve(projectRoot, 'assets/Scripts/Game/PortraitBattleBootstrap.ts.meta')
  const errors = []
  if (!existsSync(metaPath)) {
    return { ok: false, buildRoot: resolvedBuildRoot, classId: null, sceneFile: null, errors: [`missing script meta: ${metaPath}`] }
  }

  const classId = compressScriptUuid(JSON.parse(readFileSync(metaPath, 'utf8')).uuid)
  const mainRoot = join(resolvedBuildRoot, 'assets/main')
  const mainIndexName = findBuildFile(mainRoot, 'index', '.js', errors, 'built main index')
  const mainIndexPath = mainIndexName ? join(mainRoot, mainIndexName) : null
  if (mainIndexName === null) {
    errors.push(`missing built main index in: ${mainRoot}`)
  } else if (mainIndexPath) {
    const mainIndex = readFileSync(mainIndexPath, 'utf8')
    if (!mainIndex.includes('PortraitBattleBootstrap')) errors.push('built main index omits PortraitBattleBootstrap')
    if (!mainIndex.includes(classId)) errors.push(`built main index omits class ID ${classId}`)
    if (!mainIndex.includes('StageResourceRuntime')) errors.push('built main index omits StageResourceRuntime')
    const missingBossVfxMarkers = bossVfxCompiledMarkers.filter((marker) => !mainIndex.includes(marker))
    if (missingBossVfxMarkers.length > 0) {
      errors.push(`built main index omits layered boss VFX compiled feature markers: ${missingBossVfxMarkers.join(', ')}`)
    }
    const retiredBossReference = mainIndex.match(retiredBossCompiledReferencePattern)?.[1]
    if (retiredBossReference) {
      errors.push(`built main index contains retired boss talisman runtime reference: ${retiredBossReference}`)
    }
    const missingDungeonMarkers = dungeonCompiledMarkers.filter((marker) => !mainIndex.includes(marker))
    if (missingDungeonMarkers.length > 0) {
      errors.push(`built main index omits dungeon compiled feature markers: ${missingDungeonMarkers.join(', ')}`)
    }
    const unsafeIteratorSpread = /\.concat\(\s*this\.(?:pending\.values|retained\.keys)\(\)\s*\)/
    const materializesPending = /Array\.from\(\s*this\.pending\.values\(\)\s*\)/.test(mainIndex)
    const materializesRetained = /Array\.from\(\s*this\.retained\.keys\(\)\s*\)/.test(mainIndex)
    if (unsafeIteratorSpread.test(mainIndex) || !materializesPending || !materializesRetained) {
      errors.push('built StageResourceRuntime has unsafe Map iterator materialization')
    }
  }

  const resourcesRoot = join(resolvedBuildRoot, 'assets/resources')
  const resourcesConfigName = findBuildFile(
    resourcesRoot,
    'config',
    '.json',
    errors,
    'built resources config',
  )
  const resourcesConfigPath = resourcesConfigName ? join(resourcesRoot, resourcesConfigName) : null
  let resourcesConfig = null
  if (resourcesConfigName === null) {
    errors.push(`missing built resources config in: ${resourcesRoot}`)
  } else if (resourcesConfigPath) {
    try {
      resourcesConfig = JSON.parse(readFileSync(resourcesConfigPath, 'utf8'))
    } catch (error) {
      errors.push(`invalid built resources config: ${resourcesConfigPath}: ${error.message}`)
    }
  }

  if (resourcesConfig) {
    const resourcePaths = Object.values(resourcesConfig.paths ?? {})
      .filter((value) => Array.isArray(value) && typeof value[0] === 'string')
      .map((value) => value[0])
    for (const path of resourcePaths.filter((path) => path.startsWith(retiredBossResourcePathPrefix))) {
      errors.push(`built resources contain retired boss talisman resource path: ${path}`)
    }

    for (const name of bossVfxNames) {
      const resourcePath = `Assets/Skills/BossDomain/${name}/spriteFrame`
      const sourceMeta = readBossVfxMeta(projectRoot, name, errors)
      if (!sourceMeta) continue

      const {
        assetUuid,
        spriteFrameUuid,
        spriteFrameMeta,
        sourceImagePath,
      } = sourceMeta
      const expectedSpriteFrameUuid = `${compressAssetUuid(assetUuid)}@f9941`
      const pathEntry = Object.entries(resourcesConfig.paths ?? {})
        .find(([, value]) => Array.isArray(value) && value[0] === resourcePath)
      if (!pathEntry) {
        errors.push(`built resources omit layered boss VFX spriteFrame path ${resourcePath}`)
      } else {
        const actualUuid = resourcesConfig.uuids?.[Number(pathEntry[0])]
        if (actualUuid !== expectedSpriteFrameUuid) {
          errors.push(`built layered boss VFX ${name} resource UUID ${actualUuid ?? '<missing>'} does not match ${expectedSpriteFrameUuid}`)
        }
      }

      const importRoot = join(resourcesRoot, 'import', assetUuid.slice(0, 2))
      const importName = findBuildFile(
        importRoot,
        spriteFrameUuid,
        '.json',
        errors,
        `built layered boss VFX ${name} import artifacts`,
      )
      if (importName === null) {
        errors.push(`built layered boss VFX ${name} import artifact is missing in: ${importRoot}`)
      } else if (importName) {
        validateBossVfxImport(join(importRoot, importName), name, spriteFrameMeta, errors)
      }
      const nativeRoot = join(resourcesRoot, 'native', assetUuid.slice(0, 2))
      const nativeName = findBuildFile(
        nativeRoot,
        assetUuid,
        '.png',
        errors,
        `built layered boss VFX ${name} native artifacts`,
      )
      if (nativeName === null) {
        errors.push(`built layered boss VFX ${name} native artifact is missing in: ${nativeRoot}`)
      } else if (nativeName) {
        if (!existsSync(sourceImagePath)) {
          errors.push(`missing layered boss VFX source PNG for ${name}: ${sourceImagePath}`)
        } else if (!readFileSync(sourceImagePath).equals(readFileSync(join(nativeRoot, nativeName)))) {
          errors.push(`built layered boss VFX ${name} native PNG bytes differ from source: ${sourceImagePath}`)
        }
      }
    }
  }

  checkH3AnimationOutput({ projectRoot, resourcesRoot, resourcesConfig, errors })

  const sceneFile = collectFiles(join(resolvedBuildRoot, 'assets/main/import'))
    .filter((path) => path.endsWith('.json'))
    .find((path) => {
      const source = readFileSync(path, 'utf8')
      return source.includes('MainBattle') && source.includes(classId)
    }) ?? null
  if (!sceneFile) errors.push(`built MainBattle scene omits PortraitBattleBootstrap class ID ${classId}`)

  return { ok: errors.length === 0, buildRoot: resolvedBuildRoot, classId, sceneFile, errors }
}

export function verifyCocosBuildOutput({
  buildRoot,
  projectRoot = process.cwd(),
  creatorCommand,
}) {
  const readiness = checkCocosBuildReadiness({ projectRoot, buildRoot, creatorCommand })
  const output = checkCocosBuildOutput({ buildRoot, projectRoot })
  const errors = [...readiness.blockers, ...output.errors]
  return {
    ok: readiness.ready && output.ok,
    buildRoot: output.buildRoot,
    classId: output.classId,
    sceneFile: output.sceneFile,
    readiness,
    errors,
  }
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isCli) {
  const buildRoot = process.argv[2] ?? process.env.COCOS_BUILD_ROOT
  if (!buildRoot) {
    console.error('Usage: node tools/check-cocos-build-output.mjs <build-root> (or set COCOS_BUILD_ROOT)')
    process.exitCode = 2
  } else {
    const report = verifyCocosBuildOutput({ buildRoot })
    console.log(JSON.stringify(report, null, 2))
    if (!report.ok) process.exitCode = 1
  }
}
