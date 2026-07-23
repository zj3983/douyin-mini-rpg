import { readdirSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'

const root = resolve('assets/resources')
const largestCount = 10

function posix(path) {
  return path.split(sep).join('/')
}

function megabytes(bytes) {
  return Math.round((bytes / 1024 / 1024) * 100) / 100
}

function kindFor(path) {
  const lower = path.toLowerCase()
  if (/\.(?:png|jpg|jpeg|webp)$/.test(lower)) return 'image'
  if (/\.(?:wav|mp3|ogg|m4a)$/.test(lower)) return 'audio'
  if (lower.endsWith('.json')) return 'json'
  return 'other'
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const absolute = join(dir, name)
    const stat = statSync(absolute)
    if (stat.isDirectory()) {
      walk(absolute, out)
      continue
    }
    if (name.endsWith('.meta')) continue
    out.push({
      path: posix(relative(resolve('.'), absolute)),
      bytes: stat.size,
      kind: kindFor(name),
    })
  }
  return out
}

const files = walk(root).sort((left, right) => right.bytes - left.bytes || left.path.localeCompare(right.path))
const groups = {
  image: { bytes: 0, count: 0, largest: [] },
  audio: { bytes: 0, count: 0, largest: [] },
  json: { bytes: 0, count: 0, largest: [] },
  other: { bytes: 0, count: 0, largest: [] },
}

for (const file of files) {
  const group = groups[file.kind]
  group.bytes += file.bytes
  group.count += 1
  if (group.largest.length < largestCount) {
    group.largest.push({
      path: file.path,
      bytes: file.bytes,
      megabytes: megabytes(file.bytes),
    })
  }
}

for (const group of Object.values(groups)) {
  group.megabytes = megabytes(group.bytes)
}

const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0)
console.log(JSON.stringify({
  root: 'assets/resources',
  total: {
    bytes: totalBytes,
    megabytes: megabytes(totalBytes),
    count: files.length,
  },
  groups,
  largest: files.slice(0, largestCount).map((file) => ({
    path: file.path,
    kind: file.kind,
    bytes: file.bytes,
    megabytes: megabytes(file.bytes),
  })),
}, null, 2))
