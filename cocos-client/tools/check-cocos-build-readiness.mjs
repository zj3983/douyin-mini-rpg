import { existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative, resolve, sep } from 'node:path'

const defaultCreatorCandidates = [
  'D:/CocosCreator/CocosCreator.exe',
  'D:/CocosCreator/Creator/3.8.8/CocosCreator.exe',
  'D:/CocosCreator/3.8.8/CocosCreator.exe',
  'D:/CocosDashboard/editors/Creator/3.8.8/CocosCreator.exe',
]

const requiredDualModeAssets = [
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
]

export function checkCocosBuildReadiness(options = {}) {
  const projectRoot = options.projectRoot ?? process.cwd()
  const files = options.files ?? null
  const creatorCommand = options.creatorCommand ?? process.env.COCOS_CREATOR_PATH ?? findCreatorCommand()
  const buildRoot = options.buildRoot ? resolve(options.buildRoot) : null
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
