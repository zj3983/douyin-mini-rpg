import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkCocosBuildReadiness } from './check-cocos-build-readiness.mjs'

const base64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function compressScriptUuid(uuid) {
  const hex = uuid.replaceAll('-', '')
  let compressed = hex.slice(0, 5)
  for (let index = 5; index < hex.length; index += 3) {
    const value = Number.parseInt(hex.slice(index, index + 3), 16)
    compressed += base64[value >> 6] + base64[value & 63]
  }
  return compressed
}

function collectFiles(root) {
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name)
    return entry.isDirectory() ? collectFiles(path) : [path]
  })
}

export function checkCocosBuildOutput({ buildRoot, projectRoot = process.cwd() }) {
  const resolvedBuildRoot = resolve(buildRoot)
  const metaPath = resolve(projectRoot, 'assets/Scripts/Game/PortraitBattleBootstrap.ts.meta')
  const errors = []
  if (!existsSync(metaPath)) {
    return { ok: false, buildRoot: resolvedBuildRoot, classId: null, sceneFile: null, errors: [`missing script meta: ${metaPath}`] }
  }

  const classId = compressScriptUuid(JSON.parse(readFileSync(metaPath, 'utf8')).uuid)
  const mainIndexPath = join(resolvedBuildRoot, 'assets/main/index.js')
  if (!existsSync(mainIndexPath)) {
    errors.push(`missing built main index: ${mainIndexPath}`)
  } else {
    const mainIndex = readFileSync(mainIndexPath, 'utf8')
    if (!mainIndex.includes('PortraitBattleBootstrap')) errors.push('built main index omits PortraitBattleBootstrap')
    if (!mainIndex.includes(classId)) errors.push(`built main index omits class ID ${classId}`)
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
