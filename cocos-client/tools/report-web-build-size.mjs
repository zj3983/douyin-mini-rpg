import { lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { extname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const compressibleExtensions = new Set(['.js', '.json', '.css', '.svg', '.txt', '.xml', '.wasm'])
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.avif'])

function comparePaths(left, right) {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

export function isCompressibleText(path) {
  return compressibleExtensions.has(extname(path).toLowerCase())
}

function collectFiles(buildRoot) {
  const files = []

  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = resolve(directory, entry.name)
      const stats = lstatSync(absolutePath)
      const relativePath = relative(buildRoot, absolutePath).replaceAll('\\', '/')
      if (stats.isSymbolicLink()) throw new Error(`Symbolic link not allowed: ${relativePath}`)
      if (stats.isDirectory()) visit(absolutePath)
      if (stats.isFile()) files.push(absolutePath)
    }
  }

  visit(buildRoot)
  return files.sort((left, right) => comparePaths(relative(buildRoot, left), relative(buildRoot, right)))
}

export function reportBuildSize(buildRoot, { largestCount = 20 } = {}) {
  const absoluteRoot = resolve(buildRoot)
  let rootStats
  try {
    rootStats = lstatSync(absoluteRoot)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    throw new Error(`Build root not found: ${absoluteRoot}`)
  }
  if (rootStats.isSymbolicLink()) throw new Error(`Symbolic link not allowed: ${absoluteRoot}`)
  if (!rootStats.isDirectory()) throw new Error(`Build root not found: ${absoluteRoot}`)

  const report = {
    fileCount: 0,
    totalBytes: 0,
    imageBytes: 0,
    textBytes: 0,
    estimatedGzipTextBytes: 0,
    largestFiles: [],
  }

  const files = collectFiles(absoluteRoot).map((absolutePath) => {
    const path = relative(absoluteRoot, absolutePath).replaceAll('\\', '/')
    const contents = readFileSync(absolutePath)
    const bytes = contents.length

    report.fileCount += 1
    report.totalBytes += bytes
    if (imageExtensions.has(extname(path).toLowerCase())) report.imageBytes += bytes
    if (isCompressibleText(path)) {
      report.textBytes += bytes
      report.estimatedGzipTextBytes += gzipSync(contents).length
    }

    return { path, bytes }
  })

  report.largestFiles = files
    .sort((left, right) => right.bytes - left.bytes || comparePaths(left.path, right.path))
    .slice(0, Math.max(0, largestCount))

  return report
}

const isCli = process.argv[1]
  && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))

if (isCli) {
  if (!process.argv[2]) {
    console.error('Usage: node tools/report-web-build-size.mjs <build-root>')
    process.exitCode = 2
  } else {
    try {
      console.log(JSON.stringify(reportBuildSize(process.argv[2]), null, 2))
    } catch (error) {
      console.error(error.message)
      process.exitCode = 1
    }
  }
}
