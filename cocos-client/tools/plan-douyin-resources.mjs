import { readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative, resolve, sep } from 'node:path'

const CATEGORY_NAMES = ['stage-one', 'deferred', 'review', 'shared']
const STAGE_ONE_PREFIXES = [
  'Assets/ActorAtlases/QinglanSwordCultivator/',
  'Assets/ActorAtlases/MossWolf/',
  'Assets/ActorAtlases/GreenWingMoth/',
  'Assets/ActorAtlases/BambooWarden/',
  'Assets/World/MistBamboo/',
  'Assets/Skills/FlyingSword/',
  'Assets/Vfx/StageOne/',
  'Assets/Audio/',
]
const DEFERRED_PREFIXES = [
  'Assets/ActorAtlases/',
  'Assets/Artifacts/',
  'Assets/Characters/',
  'Assets/Dungeon/',
  'Assets/Skills/',
  'Assets/World/',
]
const REVIEW_PREFIXES = [
  'Assets/Generated/Atlases/',
  'Assets/Combat/',
]

export function classifyDouyinResource(rawPath) {
  const path = normalizePath(rawPath)
    .replace(/^assets\/resources\//, '')

  if (REVIEW_PREFIXES.some((prefix) => path.startsWith(prefix))) return 'review'
  if (STAGE_ONE_PREFIXES.some((prefix) => path.startsWith(prefix))) return 'stage-one'
  if (DEFERRED_PREFIXES.some((prefix) => path.startsWith(prefix))) return 'deferred'
  if (path.startsWith('Data/')) return 'shared'
  return 'review'
}

export function createDouyinResourcePlan(options = {}) {
  const projectRoot = resolve(options.projectRoot ?? '.')
  const resourceRoot = join(projectRoot, 'assets', 'resources')
  const files = walk(resourceRoot)
    .filter((file) => !file.endsWith('.meta'))
    .map((absolute) => ({
      path: normalizePath(relative(resourceRoot, absolute)),
      bytes: statSync(absolute).size,
    }))
    .sort((left, right) => right.bytes - left.bytes || left.path.localeCompare(right.path))
  const categories = Object.fromEntries(CATEGORY_NAMES.map((name) => [name, {
    bytes: 0,
    megabytes: 0,
    count: 0,
    largest: [],
  }]))

  for (const file of files) {
    const category = categories[classifyDouyinResource(file.path)]
    category.bytes += file.bytes
    category.count += 1
    if (category.largest.length < 12) {
      category.largest.push({
        path: file.path,
        bytes: file.bytes,
        megabytes: megabytes(file.bytes),
      })
    }
  }

  for (const category of Object.values(categories)) {
    category.megabytes = megabytes(category.bytes)
  }

  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0)
  return {
    root: 'assets/resources',
    total: {
      bytes: totalBytes,
      megabytes: megabytes(totalBytes),
      count: files.length,
    },
    releasePolicy: {
      mainBundle: 'remote',
      resourcesBundle: 'remote',
      compression: 'zip',
      transport: 'https',
      firstPlayablePriority: ['shared', 'stage-one'],
    },
    categories,
  }
}

function walk(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(root, entry.name)
    return entry.isDirectory() ? walk(absolute) : [absolute]
  })
}

function normalizePath(path) {
  return path.split(sep).join('/').replaceAll('\\', '/')
}

function megabytes(bytes) {
  return Math.round((bytes / 1024 / 1024) * 100) / 100
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log(JSON.stringify(createDouyinResourcePlan(), null, 2))
}
