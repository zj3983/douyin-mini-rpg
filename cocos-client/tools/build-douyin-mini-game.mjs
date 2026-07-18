import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { findCreatorCommand } from './check-cocos-build-readiness.mjs'

const DEFAULT_OUTPUT_NAME = 'bytedance-mini-game'

export function createDouyinBuildConfig(options = {}) {
  const appid = String(options.appid ?? '').trim()
  const remoteServerAddress = String(options.remoteServerAddress ?? '').trim()
  const orientation = options.orientation ?? 'portrait'

  return {
    platform: 'bytedance-mini-game',
    buildPath: 'project://build',
    outputName: DEFAULT_OUTPUT_NAME,
    debug: options.debug ?? false,
    md5Cache: true,
    mainBundleIsRemote: Boolean(remoteServerAddress),
    packages: {
      'bytedance-mini-game': {
        appid,
        orientation,
        remoteServerAddress,
      },
    },
  }
}

export function createDouyinBuildArgs({ projectRoot, configPath }) {
  return [
    '--project',
    projectRoot,
    '--build',
    `configPath=${configPath};`,
  ]
}

export function validateDouyinBuildEnv(options = {}) {
  const projectRoot = options.projectRoot ? resolve(options.projectRoot) : process.cwd()
  const creatorCommand = options.creatorCommand ?? process.env.COCOS_CREATOR_PATH ?? findCreatorCommand()
  const appid = String(options.appid ?? process.env.DOUYIN_APPID ?? '').trim()
  const remoteServerAddress = String(options.remoteServerAddress ?? process.env.DOUYIN_REMOTE_SERVER ?? '').trim()
  const blockers = []

  if (!creatorCommand || !existsSync(creatorCommand)) {
    blockers.push('Cocos Creator executable is missing; set COCOS_CREATOR_PATH to CocosCreator.exe, preferably on D:.')
  }

  if (!appid || /^tourist/i.test(appid)) {
    blockers.push('DOUYIN_APPID is missing or still a tourist AppID; set the real Douyin mini-game AppID before building.')
  }

  if (!remoteServerAddress) {
    blockers.push('DOUYIN_REMOTE_SERVER is missing; the current art package requires an HTTPS remote resource server.')
  } else if (!/^https:\/\//i.test(remoteServerAddress)) {
    blockers.push('DOUYIN_REMOTE_SERVER must use HTTPS for Douyin device builds.')
  }

  if (!existsSync(projectRoot)) {
    blockers.push(`Project root does not exist: ${projectRoot}`)
  }

  return {
    ok: blockers.length === 0,
    creatorCommand,
    appid,
    remoteServerAddress,
    projectRoot,
    blockers,
  }
}

function writeBuildConfig(projectRoot, config) {
  const configPath = join(projectRoot, 'temp', 'douyin-build-config.json')
  mkdirSync(dirname(configPath), { recursive: true })
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  return configPath
}

function runCli() {
  const envReport = validateDouyinBuildEnv()
  if (!envReport.ok) {
    console.error(JSON.stringify(envReport, null, 2))
    process.exit(1)
  }

  const config = createDouyinBuildConfig({
    appid: envReport.appid,
    remoteServerAddress: envReport.remoteServerAddress,
    debug: process.env.DOUYIN_DEBUG === '1',
    orientation: process.env.DOUYIN_ORIENTATION ?? 'portrait',
  })
  const configPath = writeBuildConfig(envReport.projectRoot, config)
  const args = createDouyinBuildArgs({
    projectRoot: envReport.projectRoot,
    configPath,
  })

  const result = spawnSync(envReport.creatorCommand, args, {
    cwd: envReport.projectRoot,
    stdio: 'inherit',
    shell: false,
  })

  if (result.error) {
    console.error(result.error)
    process.exit(1)
  }

  const status = result.status ?? 1
  process.exit(status === 0 || status === 36 ? 0 : status)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runCli()
}
