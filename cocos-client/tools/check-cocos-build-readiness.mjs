import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative, resolve, sep } from 'node:path'
import { validateDungeonProfile } from '../assets/Scripts/Core/Dungeon/DungeonSession.ts'
import { validateSceneBlueprint } from './validate-scene-blueprint.mjs'

const defaultCreatorCandidates = [
  'D:/CocosCreator/CocosCreator.exe',
  'D:/CocosCreator/Creator/3.8.8/CocosCreator.exe',
  'D:/CocosCreator/3.8.8/CocosCreator.exe',
  'D:/CocosDashboard/editors/Creator/3.8.8/CocosCreator.exe',
]

export const requiredDualModeAssets = [
  'assets/Scenes/MainBattle.scene',
  'assets/Scenes/MainBattle.scene.meta',
  'assets/Data/scene-blueprint.json',
  'assets/Data/scene-blueprint.json.meta',
  'assets/resources/Data/dual-mode-slice.json',
  'assets/resources/Data/dual-mode-slice.json.meta',
  'assets/Scripts/Core/Dungeon.meta',
  'assets/Scripts/Core/Dungeon/DungeonInteraction.ts',
  'assets/Scripts/Core/Dungeon/DungeonInteraction.ts.meta',
  'assets/Scripts/Core/Dungeon/DungeonSession.ts',
  'assets/Scripts/Core/Dungeon/DungeonSession.ts.meta',
  'assets/Scripts/Core/Dungeon/DungeonTypes.ts',
  'assets/Scripts/Core/Dungeon/DungeonTypes.ts.meta',
  'assets/Scripts/Core/GameContent.ts',
  'assets/Scripts/Core/GameContent.ts.meta',
  'assets/Scripts/Core/Loadout.meta',
  'assets/Scripts/Core/Loadout/LoadoutRules.ts',
  'assets/Scripts/Core/Loadout/LoadoutRules.ts.meta',
  'assets/Scripts/Core/Progression.meta',
  'assets/Scripts/Core/Progression/BestEffortNotification.ts',
  'assets/Scripts/Core/Progression/BestEffortNotification.ts.meta',
  'assets/Scripts/Core/Progression/DualModeRuntime.ts',
  'assets/Scripts/Core/Progression/DualModeRuntime.ts.meta',
  'assets/Scripts/Core/Progression/PlayerSave.ts',
  'assets/Scripts/Core/Progression/PlayerSave.ts.meta',
  'assets/Scripts/Core/Progression/SaveRepository.ts',
  'assets/Scripts/Core/Progression/SaveRepository.ts.meta',
  'assets/Scripts/Core/World.meta',
  'assets/Scripts/Core/World/WorldRewards.ts',
  'assets/Scripts/Core/World/WorldRewards.ts.meta',
  'assets/Scripts/Game/DungeonRunController.ts',
  'assets/Scripts/Game/DungeonRunController.ts.meta',
  'assets/Scripts/Game/DualModeGameController.ts',
  'assets/Scripts/Game/DualModeGameController.ts.meta',
  'assets/Scripts/Game/WorldStageSelectLayout.ts',
  'assets/Scripts/Game/WorldStageSelectLayout.ts.meta',
  'assets/Scripts/Game/WorldStageSelectPageAssembler.ts',
  'assets/Scripts/Game/WorldStageSelectPageAssembler.ts.meta',
]

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const REQUIRED_SCENE_NODES = [
  'WorldRoot',
  'DualModeGameController',
  'DungeonRoot',
  'DungeonFloor1',
  'DungeonFloor2',
  'DungeonFloor3',
  'DungeonRoomLabel',
  'DungeonInteractButton',
]
const REQUIRED_STRUCTURED_ASSETS = [
  'assets/Scenes/MainBattle.scene',
  'assets/Data/scene-blueprint.json',
  'assets/resources/Data/dual-mode-slice.json',
]

function metaConvention(path) {
  if (path.endsWith('.scene.meta')) return { importer: 'scene', ver: '1.1.50' }
  if (path.endsWith('.json.meta')) return { importer: 'json', ver: '2.0.1' }
  if (path.endsWith('.ts.meta')) return { importer: 'typescript', ver: '4.0.24' }
  return { importer: 'directory', ver: '1.2.0' }
}

export function checkCocosBuildReadiness(options = {}) {
  const projectRoot = options.projectRoot ?? process.cwd()
  const files = options.files ?? null
  const creatorCommand = options.creatorCommand ?? process.env.COCOS_CREATOR_PATH ?? findCreatorCommand()
  const buildRoot = options.buildRoot ? resolve(options.buildRoot) : null
  const readFile = options.readFile
    ?? (files ? () => undefined : (path) => readFileSync(join(projectRoot, ...path.split('/')), 'utf8'))
  const blockers = []

  if (!creatorCommand) {
    blockers.push('Cocos Creator 3.8.x executable is missing; install it on D: before building.')
  }

  if (!hasPath(projectRoot, 'assets/Scenes', files, (path) => path.endsWith('.scene'))) {
    blockers.push('assets/Scenes is missing a real .scene file, such as assets/Scenes/MainBattle.scene.')
  }

  if (!hasPath(projectRoot, 'settings', files, (path) => path.includes('/packages/') || path.endsWith('builder.json'))) {
    blockers.push('settings is missing Creator build configuration, such as settings/v2/packages/builder.json.')
  }

  for (const asset of requiredDualModeAssets) {
    if (!hasPath(projectRoot, asset, files)) blockers.push(`${asset} is missing from the Cocos import contract.`)
  }

  for (const asset of REQUIRED_STRUCTURED_ASSETS) {
    if (!hasPath(projectRoot, asset, files)) continue
    const parsed = parseJsonAsset(asset, readFile, blockers)
    if (parsed === undefined) continue
    if (asset.endsWith('.scene')) {
      for (const error of validateCocosSceneStructure(parsed)) blockers.push(`${asset} ${error}.`)
    } else if (asset.endsWith('scene-blueprint.json')) {
      const report = validateSceneBlueprint(parsed)
      if (!report.ok) blockers.push(`${asset} fails scene blueprint structural validation: ${report.errors.join('; ')}.`)
    } else {
      try {
        validateDungeonProfile(parsed)
      } catch (error) {
        blockers.push(`${asset} fails dungeon profile validation: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  const requiredMetaPaths = new Set(requiredDualModeAssets.filter((asset) => asset.endsWith('.meta')))
  const metaUuidOwners = new Map()
  for (const asset of discoverAssetMetaPaths(projectRoot, files)) {
    const parsed = parseJsonAsset(asset, readFile, blockers)
    if (parsed === undefined) continue
    if (typeof parsed.uuid !== 'string' || !UUID_PATTERN.test(parsed.uuid)) {
      blockers.push(`${asset} has a missing or invalid UUID.`)
    } else if (metaUuidOwners.has(parsed.uuid)) {
      blockers.push(`${asset} has duplicate asset meta UUID ${parsed.uuid} also used by ${metaUuidOwners.get(parsed.uuid)}.`)
    } else {
      metaUuidOwners.set(parsed.uuid, asset)
    }
    if (requiredMetaPaths.has(asset)) {
      const expected = metaConvention(asset)
      if (parsed.importer !== expected.importer || parsed.ver !== expected.ver) {
        blockers.push(`${asset} must use importer ${expected.importer} version ${expected.ver}.`)
      }
    }
  }

  const hasBuildIndex = buildRoot
    ? existsSync(join(buildRoot, 'index.html'))
    : hasPath(projectRoot, 'build/web-mobile/index.html', files)
  if (!hasBuildIndex) {
    const expectedIndex = buildRoot ? join(buildRoot, 'index.html') : 'build/web-mobile/index.html'
    blockers.push(`${expectedIndex} is missing; run a Cocos web-mobile build before deployment can serve it.`)
  }

  return {
    ready: blockers.length === 0,
    creatorCommand,
    buildRoot,
    blockers,
  }
}

export function validateCocosSceneStructure(scene) {
  const errors = []
  if (!Array.isArray(scene)) return ['must be a Cocos scene array']
  const sceneAssetIndex = scene.findIndex((entry) => entry?.__type__ === 'cc.SceneAsset')
  const sceneIndex = scene.findIndex((entry) => entry?.__type__ === 'cc.Scene')
  if (sceneAssetIndex < 0) errors.push('is missing a cc.SceneAsset record')
  if (sceneIndex < 0) errors.push('is missing a cc.Scene record')
  if (sceneAssetIndex >= 0 && scene[sceneAssetIndex]?.scene?.__id__ !== sceneIndex) {
    errors.push('has a SceneAsset that does not reference its cc.Scene record')
  }
  visitReferences(scene, scene.length, errors, '$')
  const nodeNames = new Set(
    scene.filter((entry) => entry?.__type__ === 'cc.Node' && typeof entry._name === 'string').map((entry) => entry._name),
  )
  for (const name of REQUIRED_SCENE_NODES) {
    if (!nodeNames.has(name)) errors.push(`is missing required stable node ${name}`)
  }
  return errors
}

function visitReferences(value, recordCount, errors, path) {
  if (!value || typeof value !== 'object') return
  if (!Array.isArray(value) && Object.hasOwn(value, '__id__')) {
    if (!Number.isSafeInteger(value.__id__) || value.__id__ < 0 || value.__id__ >= recordCount) {
      errors.push(`has invalid __id__ reference at ${path}`)
    }
  }
  for (const [key, child] of Object.entries(value)) visitReferences(child, recordCount, errors, `${path}.${key}`)
}

function parseJsonAsset(asset, readFile, blockers) {
  try {
    const contents = readFile(asset)
    if (typeof contents !== 'string') throw new TypeError('JSON contents are unavailable')
    return JSON.parse(contents)
  } catch {
    blockers.push(`${asset} contains malformed JSON or could not be read.`)
    return undefined
  }
}

function discoverAssetMetaPaths(projectRoot, files) {
  if (files) {
    return Array.from(files)
      .map(normalizePath)
      .filter((path) => path.startsWith('assets/') && path.endsWith('.meta'))
      .sort()
  }
  const assetRoot = join(projectRoot, 'assets')
  if (!existsSync(assetRoot)) return []
  return walk(assetRoot)
    .map((path) => normalizePath(relative(projectRoot, path)))
    .filter((path) => path.endsWith('.meta'))
    .sort()
}

export function findCreatorCommand(candidates = defaultCreatorCandidates) {
  return candidates.find((candidate) => existsSync(candidate)) ?? null
}

function hasPath(projectRoot, target, files, predicate = null) {
  const normalizedTarget = normalizePath(target)
  if (files) {
    if (!predicate) return files.has(normalizedTarget)
    return Array.from(files).some((file) => normalizePath(file).startsWith(normalizedTarget) && predicate(normalizePath(file)))
  }

  const absolute = join(projectRoot, ...target.split('/'))
  if (!existsSync(absolute)) return false
  if (!predicate) return true
  return walk(absolute).some((path) => predicate(normalizePath(relative(projectRoot, path))))
}

function walk(root) {
  const entries = readdirSync(root, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const path = join(root, entry.name)
    if (entry.isDirectory()) return walk(path)
    return path
  })
}

function normalizePath(path) {
  return path.split(sep).join('/').replaceAll('\\', '/')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = checkCocosBuildReadiness()
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.ready ? 0 : 1)
}
