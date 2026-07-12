import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
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
      if (entry.isDirectory()) visit(absolutePath)
      if (entry.isFile()) files.push(absolutePath)
    }
  }

  visit(buildRoot)
  return files.sort((left, right) => comparePaths(relative(buildRoot, left), relative(buildRoot, right)))
}

export function reportBuildSize(buildRoot, { largestCount = 20 } = {}) {
  const absoluteRoot = resolve(buildRoot)
  if (!existsSync(absoluteRoot) || !statSync(absoluteRoot).isDirectory()) {
    throw new Error(`Build root not found: ${absoluteRoot}`)
  }

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

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isCli) {
  const buildRoot = resolve(process.argv[2] ?? '')
  try {
    console.log(JSON.stringify(reportBuildSize(buildRoot), null, 2))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
