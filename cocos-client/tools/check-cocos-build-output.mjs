import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkCocosBuildReadiness } from './check-cocos-build-readiness.mjs'

const base64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const bossTalismanNames = ['sweep', 'spike', 'roar']
const bossTalismanCompiledMarkers = [
  'BossTelegraphVisualProfile',
  'BossTelegraphPresenter',
  'BossHazardVisualController',
]

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
  return compressUuid(uuid, 2)
}

function collectFiles(root) {
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name)
    return entry.isDirectory() ? collectFiles(path) : [path]
  })
}

function findBuildFile(directory, basename, extension) {
  if (!existsSync(directory)) return null
  const exactName = `${basename}${extension}`
  const hashedPrefix = `${basename}.`
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .find((name) => name === exactName || (name.startsWith(hashedPrefix) && name.endsWith(extension)))
    ?? null
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
  const mainIndexName = findBuildFile(mainRoot, 'index', '.js')
  const mainIndexPath = mainIndexName ? join(mainRoot, mainIndexName) : null
  if (!mainIndexPath) {
    errors.push(`missing built main index in: ${mainRoot}`)
  } else {
    const mainIndex = readFileSync(mainIndexPath, 'utf8')
    if (!mainIndex.includes('PortraitBattleBootstrap')) errors.push('built main index omits PortraitBattleBootstrap')
    if (!mainIndex.includes(classId)) errors.push(`built main index omits class ID ${classId}`)
    if (!mainIndex.includes('StageResourceRuntime')) errors.push('built main index omits StageResourceRuntime')
    const missingBossTalismanMarkers = bossTalismanCompiledMarkers.filter((marker) => !mainIndex.includes(marker))
    if (missingBossTalismanMarkers.length > 0) {
      errors.push(`built main index omits boss talisman compiled feature markers: ${missingBossTalismanMarkers.join(', ')}`)
    }
    const unsafeIteratorSpread = /\.concat\(\s*this\.(?:pending\.values|retained\.keys)\(\)\s*\)/
    const materializesPending = /Array\.from\(\s*this\.pending\.values\(\)\s*\)/.test(mainIndex)
    const materializesRetained = /Array\.from\(\s*this\.retained\.keys\(\)\s*\)/.test(mainIndex)
    if (unsafeIteratorSpread.test(mainIndex) || !materializesPending || !materializesRetained) {
      errors.push('built StageResourceRuntime has unsafe Map iterator materialization')
    }
  }

  const resourcesRoot = join(resolvedBuildRoot, 'assets/resources')
  const resourcesConfigName = findBuildFile(resourcesRoot, 'config', '.json')
  const resourcesConfigPath = resourcesConfigName ? join(resourcesRoot, resourcesConfigName) : null
  let resourcesConfig = null
  if (!resourcesConfigPath) {
    errors.push(`missing built resources config in: ${resourcesRoot}`)
  } else {
    try {
      resourcesConfig = JSON.parse(readFileSync(resourcesConfigPath, 'utf8'))
    } catch (error) {
      errors.push(`invalid built resources config: ${resourcesConfigPath}: ${error.message}`)
    }
  }

  if (resourcesConfig) {
    for (const name of bossTalismanNames) {
      const assetName = `talisman_${name}`
      const resourcePath = `Assets/Skills/BossDomain/${assetName}/spriteFrame`
      const talismanMetaPath = resolve(
        projectRoot,
        `assets/resources/Assets/Skills/BossDomain/${assetName}.png.meta`,
      )
      if (!existsSync(talismanMetaPath)) {
        errors.push(`missing boss talisman image meta: ${talismanMetaPath}`)
        continue
      }

      const assetUuid = JSON.parse(readFileSync(talismanMetaPath, 'utf8')).uuid
      const expectedSpriteFrameUuid = `${compressAssetUuid(assetUuid)}@f9941`
      const pathEntry = Object.entries(resourcesConfig.paths ?? {})
        .find(([, value]) => Array.isArray(value) && value[0] === resourcePath)
      if (!pathEntry) {
        errors.push(`built resources omit boss talisman spriteFrame path ${resourcePath}`)
      } else {
        const actualUuid = resourcesConfig.uuids?.[Number(pathEntry[0])]
        if (actualUuid !== expectedSpriteFrameUuid) {
          errors.push(`built ${assetName} resource UUID ${actualUuid ?? '<missing>'} does not match ${expectedSpriteFrameUuid}`)
        }
      }

      const importRoot = join(resourcesRoot, 'import', assetUuid.slice(0, 2))
      const importName = findBuildFile(importRoot, `${assetUuid}@f9941`, '.json')
      if (!importName) errors.push(`built ${assetName} import artifact is missing in: ${importRoot}`)
      const nativeRoot = join(resourcesRoot, 'native', assetUuid.slice(0, 2))
      const nativeName = findBuildFile(nativeRoot, assetUuid, '.png')
      if (!nativeName) errors.push(`built ${assetName} native artifact is missing in: ${nativeRoot}`)
    }
  }

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
