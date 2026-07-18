import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative, resolve, sep } from 'node:path'

const BUILD_ROOT = 'build/bytedance-mini-game'
const MAIN_PACKAGE_LIMIT = 4 * 1024 * 1024
const TOTAL_PACKAGE_LIMIT = 20 * 1024 * 1024
const SINGLE_SUBPACKAGE_LIMIT = 20 * 1024 * 1024

export function checkDouyinReleaseReadiness(options = {}) {
  const projectRoot = options.projectRoot ?? process.cwd()
  const files = options.files ?? collectFiles(projectRoot, BUILD_ROOT)
  const fileSizes = options.fileSizes ?? collectFileSizes(projectRoot, files)
  const projectConfig = options.projectConfig ?? readProjectConfig(projectRoot, files)
  const blockers = []
  const warnings = []

  for (const required of [
    `${BUILD_ROOT}/game.js`,
    `${BUILD_ROOT}/game.json`,
    `${BUILD_ROOT}/project.config.json`,
  ]) {
    if (!hasFile(files, required)) blockers.push(`${required} is missing; run a Cocos Douyin mini-game build first.`)
  }

  const appid = normalizeAppId(projectConfig)
  if (!appid) blockers.push('AppID is missing in project.config.json; fill the Douyin mini-game AppID before upload.')

  const sizes = computePackageSizes(files, fileSizes)
  if (sizes.mainPackageBytes > MAIN_PACKAGE_LIMIT) {
    blockers.push(`Douyin main package is ${formatMb(sizes.mainPackageBytes)}, over the 4MB main package limit.`)
  }
  if (sizes.totalPackageBytes > TOTAL_PACKAGE_LIMIT) {
    blockers.push(`Douyin total package is ${formatMb(sizes.totalPackageBytes)}, over the 20MB total package limit; move low-priority assets to remote resources or split packages.`)
  }
  for (const [name, bytes] of Object.entries(sizes.subpackages)) {
    if (bytes > SINGLE_SUBPACKAGE_LIMIT) blockers.push(`Douyin subpackage ${name} is ${formatMb(bytes)}, over the 20MB single subpackage limit.`)
  }

  if (sizes.totalPackageBytes === 0) {
    warnings.push('No Douyin build files were found, so package sizes are zero.')
  } else if (sizes.remoteAssetHintBytes > 0) {
    warnings.push(`${formatMb(sizes.remoteAssetHintBytes)} of resource-like assets are still inside the mini-game package; prefer remote resources for late-stage art/audio.`)
  }
  if (sizes.remoteBytes > 0) {
    warnings.push(`${formatMb(sizes.remoteBytes)} across ${sizes.remoteFileCount} generated remote files must be uploaded to the configured HTTPS CDN before device preview.`)
  }

  return {
    platform: 'douyin-mini-game',
    ready: blockers.length === 0,
    buildRoot: BUILD_ROOT,
    appid,
    limits: {
      mainPackageBytes: MAIN_PACKAGE_LIMIT,
      totalPackageBytes: TOTAL_PACKAGE_LIMIT,
      singleSubpackageBytes: SINGLE_SUBPACKAGE_LIMIT,
    },
    sizes,
    blockers,
    warnings,
  }
}

function collectFiles(projectRoot, target) {
  const absolute = join(projectRoot, ...target.split('/'))
  if (!existsSync(absolute)) return new Set()
  return new Set(walk(absolute).map((path) => normalizePath(relative(projectRoot, path))))
}

function collectFileSizes(projectRoot, files) {
  const sizes = new Map()
  for (const file of files) {
    const absolute = join(projectRoot, ...file.split('/'))
    if (existsSync(absolute)) sizes.set(normalizePath(file), statSync(absolute).size)
  }
  return sizes
}

function readProjectConfig(projectRoot, files) {
  const path = `${BUILD_ROOT}/project.config.json`
  if (!hasFile(files, path)) return null
  try {
    return JSON.parse(readFileSync(join(projectRoot, ...path.split('/')), 'utf8'))
  } catch {
    return null
  }
}

function walk(root) {
  const entries = readdirSync(root, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const path = join(root, entry.name)
    if (entry.isDirectory()) return walk(path)
    return path
  })
}

function computePackageSizes(files, fileSizes) {
  let mainPackageBytes = 0
  let totalPackageBytes = 0
  let remoteAssetHintBytes = 0
  let remoteBytes = 0
  let remoteFileCount = 0
  const subpackages = {}

  for (const rawPath of files) {
    const path = normalizePath(rawPath)
    if (!path.startsWith(`${BUILD_ROOT}/`)) continue
    const bytes = fileSizes.get(path) ?? 0

    if (path.startsWith(`${BUILD_ROOT}/remote/`)) {
      remoteBytes += bytes
      remoteFileCount += 1
      continue
    }

    totalPackageBytes += bytes

    const subpackage = subpackageName(path)
    if (subpackage) {
      subpackages[subpackage] = (subpackages[subpackage] ?? 0) + bytes
    } else {
      mainPackageBytes += bytes
    }

    if (isResourceLike(path)) remoteAssetHintBytes += bytes
  }

  return {
    mainPackageBytes,
    totalPackageBytes,
    subpackages,
    remoteAssetHintBytes,
    remoteBytes,
    remoteFileCount,
  }
}

function subpackageName(path) {
  const match = path.match(/^build\/bytedance-mini-game\/(?:subpackages|subPackages|sub-packages)\/([^/]+)\//)
  return match?.[1] ?? null
}

function isResourceLike(path) {
  return /\.(?:png|jpg|jpeg|webp|wav|mp3|ogg|m4a|bin|bundle)$/i.test(path)
}

function hasFile(files, path) {
  return files.has(normalizePath(path))
}

function normalizeAppId(config) {
  const appid = config?.appid ?? config?.appId ?? config?.setting?.appid
  return typeof appid === 'string' && appid.trim() && !/^tourist/i.test(appid) ? appid.trim() : null
}

function normalizePath(path) {
  return path.split(sep).join('/').replaceAll('\\', '/')
}

function formatMb(bytes) {
  return `${Math.round((bytes / 1024 / 1024) * 100) / 100}MB`
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = checkDouyinReleaseReadiness()
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.ready ? 0 : 1)
}
