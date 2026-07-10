import { existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative, sep } from 'node:path'

const defaultCreatorCandidates = [
  'D:/CocosCreator/CocosCreator.exe',
  'D:/CocosCreator/Creator/3.8.8/CocosCreator.exe',
  'D:/CocosCreator/3.8.8/CocosCreator.exe',
  'D:/CocosDashboard/editors/Creator/3.8.8/CocosCreator.exe',
]

export function checkCocosBuildReadiness(options = {}) {
  const projectRoot = options.projectRoot ?? process.cwd()
  const files = options.files ?? null
  const creatorCommand = options.creatorCommand ?? findCreatorCommand()
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

  if (!hasPath(projectRoot, 'build/web-mobile/index.html', files)) {
    blockers.push('build/web-mobile/index.html is missing; run a Cocos web-mobile build before deployment can serve it.')
  }

  return {
    ready: blockers.length === 0,
    creatorCommand,
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
