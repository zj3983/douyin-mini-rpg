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
const dungeonExpected = [
  ...[1, 2, 3].flatMap((floor) => [
    `assets/resources/Assets/Dungeon/MistBamboo/Floor${floor}/far.webp`,
    `assets/resources/Assets/Dungeon/MistBamboo/Floor${floor}/mid.webp`,
  ]),
  'assets/resources/Assets/Dungeon/MistBamboo/Effects/pursuit_edge.png',
  'assets/resources/Assets/Dungeon/MistBamboo/Effects/extraction_array.png',
  'assets/resources/Assets/ActorAtlases/MistBambooEmperor/atlas.png',
  'assets/resources/Assets/Audio/Cues/pursuit-warning.wav',
  'assets/resources/Assets/Audio/Cues/extraction-start.wav',
  'assets/resources/Assets/Audio/Cues/extraction-complete.wav',
]
const dungeonActorFolders = new Set([
  'MossWolf',
  'GreenWingMoth',
  'FogSpider',
  'LanternWraith',
  'MistDeerKing',
  'MistBambooEmperor',
])
const dungeonFiles = files.filter(({ path }) => (
  path.startsWith('assets/resources/Assets/Dungeon/MistBamboo/')
  || path.startsWith('assets/resources/Assets/Audio/Cues/pursuit-warning.')
  || path.startsWith('assets/resources/Assets/Audio/Cues/extraction-start.')
  || path.startsWith('assets/resources/Assets/Audio/Cues/extraction-complete.')
  || (
    path.startsWith('assets/resources/Assets/ActorAtlases/')
    && dungeonActorFolders.has(path.split('/')[4])
  )
))
const dungeonPaths = new Set(dungeonFiles.map(({ path }) => path))
const dungeonBytes = dungeonFiles.reduce((sum, file) => sum + file.bytes, 0)
const dungeonLimitBytes = 24 * 1024 * 1024
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
  budgets: {
    dungeon: {
      bytes: dungeonBytes,
      megabytes: megabytes(dungeonBytes),
      limitBytes: dungeonLimitBytes,
      withinBudget: dungeonExpected.every((path) => dungeonPaths.has(path)) && dungeonBytes <= dungeonLimitBytes,
      missing: dungeonExpected.filter((path) => !dungeonPaths.has(path)),
      backgroundCount: dungeonFiles.filter(({ path }) => /\/Floor[123]\/(?:far|mid)\.webp$/.test(path)).length,
      effectCount: dungeonFiles.filter(({ path }) => /\/Effects\/.*\.png$/.test(path)).length,
      audioCount: dungeonFiles.filter(({ path }) => /\/Audio\/Cues\/.*\.wav$/.test(path)).length,
      actorAtlasCount: dungeonFiles.filter(({ path }) => /\/ActorAtlases\/.*\.png$/.test(path)).length,
    },
  },
  largest: files.slice(0, largestCount).map((file) => ({
    path: file.path,
    kind: file.kind,
    bytes: file.bytes,
    megabytes: megabytes(file.bytes),
  })),
}, null, 2))
