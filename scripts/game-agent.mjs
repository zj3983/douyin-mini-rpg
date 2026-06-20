#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import { createWriteStream, existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'

import { canvasAspectHealth, canvasHealth, reportMarkdown } from './game-agent-core.mjs'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const runId = new Date().toISOString().replace(/[:.]/g, '-')
const outDir = join(rootDir, 'artifacts', 'game-agent', runId)
const viewport = { width: 430, height: 860 }
const port = Number(process.env.GAME_AGENT_PORT || 5179)
const apiPort = Number(process.env.GAME_AGENT_API_PORT || 4174)
const baseUrl = process.env.GAME_AGENT_URL || `http://127.0.0.1:${port}/`
const apiHealthUrl = `http://127.0.0.1:${apiPort}/api/health`
const randomMs = Number(process.env.GAME_AGENT_RANDOM_MS || 20000)
const headless = process.env.GAME_AGENT_HEADLESS !== '0'
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const chromeCandidates = process.platform === 'win32'
  ? [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ]
  : [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
    ]

await mkdir(outDir, { recursive: true })

const checks = []
const screenshots = []
const consoleIssues = []
const pageErrors = []
const requestFailures = []
const ownedProcesses = []
let browser
let page
let startedAt = new Date().toISOString()
let performance = { averageFrameMs: 0, slowFrames: 0 }

function addCheck(name, ok, detail = '') {
  checks.push({ name, ok: Boolean(ok), detail })
}

async function probe(url, timeoutMs = 800) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

async function waitForProbe(url, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await probe(url, 1000)) return true
    await new Promise((resolveWait) => setTimeout(resolveWait, 500))
  }
  return false
}

function spawnLogged(name, command, args, env = {}) {
  const stdout = createWriteStream(join(outDir, `${name}.out.log`))
  const stderr = createWriteStream(join(outDir, `${name}.err.log`))
  const spawnCommand = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : command
  const spawnArgs = process.platform === 'win32' ? ['/d', '/s', '/c', command, ...args] : args
  const child = spawn(spawnCommand, spawnArgs, {
    cwd: rootDir,
    env: { ...cleanProcessEnv(), ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.pipe(stdout)
  child.stderr.pipe(stderr)
  ownedProcesses.push(child)
  return child
}

function cleanProcessEnv() {
  return Object.fromEntries(
    Object.entries(process.env).filter(([key, value]) => key && !key.startsWith('=') && value !== undefined),
  )
}

function browserLaunchOptions() {
  const executablePath = chromeCandidates.find((candidate) => candidate && existsSync(candidate))
  return {
    headless,
    ...(executablePath ? { executablePath } : {}),
  }
}

function stopOwnedProcess(child) {
  if (!child.pid) return
  if (process.platform === 'win32') {
    spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'taskkill', '/pid', String(child.pid), '/t', '/f'], {
      stdio: 'ignore',
    })
    return
  }
  child.kill('SIGTERM')
}

function expectedConsoleError(text) {
  return text.includes('Failed to load resource')
    && (text.includes('401') || text.includes('404'))
}

function expectedHttpStatus(url, status) {
  if (status === 401 && url.includes('/api/me')) return true
  if (status === 404 && url.endsWith('/favicon.ico')) return true
  return false
}

async function ensureApiServer() {
  if (await probe(apiHealthUrl)) {
    addCheck('API 服务', true, '复用已运行服务')
    return
  }
  spawnLogged('api-server', npmCmd, ['run', 'server'], {
    PORT: String(apiPort),
    AUTH_DATA_FILE: join(outDir, 'auth.json'),
  })
  const ok = await waitForProbe(apiHealthUrl)
  addCheck('API 服务', ok, ok ? '已启动临时账号服务' : '启动超时')
  if (!ok) throw new Error('API server did not start')
}

async function ensureGameServer() {
  if (await probe(baseUrl)) {
    addCheck('游戏服务', true, `复用 ${baseUrl}`)
    return
  }
  spawnLogged('vite-dev', npmCmd, ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'])
  const ok = await waitForProbe(baseUrl)
  addCheck('游戏服务', ok, ok ? `已启动 ${baseUrl}` : '启动超时')
  if (!ok) throw new Error('game server did not start')
}

async function shot(label, required = true) {
  const file = join(outDir, `${String(screenshots.length + 1).padStart(2, '0')}-${label}.png`)
  try {
    await page.screenshot({ path: file, fullPage: false, timeout: 10000 })
    screenshots.push({ label, file })
    return true
  } catch (error) {
    if (required) addCheck(`截图 ${label}`, false, error.message)
    return false
  }
}

async function visible(selector) {
  try {
    return await page.locator(selector).isVisible({ timeout: 2500 })
  } catch {
    return false
  }
}

async function expectVisible(selector, name) {
  const ok = await visible(selector)
  addCheck(name, ok, selector)
  return ok
}

async function click(selector, name) {
  try {
    await page.locator(selector).click({ timeout: 5000 })
    addCheck(name, true, selector)
    return true
  } catch (error) {
    try {
      await page.locator(selector).click({ timeout: 3000, force: true })
      addCheck(name, true, `${selector} (force retry)`)
      return true
    } catch (retryError) {
      addCheck(name, false, `${selector}: ${retryError.message || error.message}`)
      return false
    }
  }
}

async function waitHidden(selector, timeout = 8000) {
  try {
    await page.locator(selector).waitFor({ state: 'hidden', timeout })
    return true
  } catch {
    return false
  }
}

async function sampleCanvasHealth() {
  const stats = await page.evaluate(async () => {
    const canvas = document.querySelector('#game')
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return { coloredPixels: 0, uniqueColors: 0, diffRatio: 0 }

    function sample() {
      const width = canvas.width
      const height = canvas.height
      const data = ctx.getImageData(0, 0, width, height).data
      const colors = new Set()
      const samples = []
      let coloredPixels = 0
      for (let y = 0; y < height; y += 10) {
        for (let x = 0; x < width; x += 10) {
          const i = (y * width + x) * 4
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          const a = data[i + 3]
          const bright = r + g + b
          if (a > 0 && bright > 24) coloredPixels += 100
          colors.add(`${r >> 4},${g >> 4},${b >> 4},${a >> 7}`)
          samples.push((r << 16) | (g << 8) | b)
        }
      }
      return { coloredPixels, uniqueColors: colors.size, samples }
    }

    const first = sample()
    await new Promise((resolveWait) => setTimeout(resolveWait, 700))
    const second = sample()
    let changed = 0
    const length = Math.min(first.samples.length, second.samples.length)
    for (let i = 0; i < length; i += 1) {
      if (first.samples[i] !== second.samples[i]) changed += 1
    }
    return {
      coloredPixels: second.coloredPixels,
      uniqueColors: second.uniqueColors,
      diffRatio: length ? changed / length : 0,
    }
  })
  const health = canvasHealth(stats)
  addCheck('画面内容和动态', health.ok, health.detail)

  const aspect = await page.evaluate(() => {
    const canvas = document.querySelector('#game')
    const rect = canvas?.getBoundingClientRect()
    return {
      intrinsicWidth: canvas?.width ?? 0,
      intrinsicHeight: canvas?.height ?? 0,
      cssWidth: rect?.width ?? 0,
      cssHeight: rect?.height ?? 0,
    }
  })
  const aspectHealth = canvasAspectHealth(aspect)
  addCheck('画面比例未拉伸', aspectHealth.ok, aspectHealth.detail)
}

async function measureFrames(sampleCount = 90) {
  performance = await page.evaluate(async (count) => {
    const intervals = []
    let last = await new Promise((resolveFrame) => requestAnimationFrame(resolveFrame))
    while (intervals.length < count) {
      const now = await new Promise((resolveFrame) => requestAnimationFrame(resolveFrame))
      intervals.push(now - last)
      last = now
    }
    const averageFrameMs = intervals.reduce((sum, value) => sum + value, 0) / intervals.length
    const slowFrames = intervals.filter((value) => value > 50).length
    return { averageFrameMs, slowFrames }
  }, sampleCount)
  addCheck('帧循环', performance.averageFrameMs > 0 && performance.averageFrameMs < 80 && performance.slowFrames < sampleCount * 0.7, `${performance.averageFrameMs.toFixed(2)}ms avg, slow=${performance.slowFrames}`)
}

async function completeGuestEntry() {
  await expectVisible('#profile-panel', '登录面板出现')
  await expectVisible('#profile-entry-status', '服务器状态卡出现')
  await expectVisible('#profile-guest', '游客试玩按钮出现')
  await shot('login-entry')
  await click('#profile-guest', '点击游客试玩')

  if (await visible('#profile-create-slot')) {
    await shot('create-character')
    const nameInput = page.locator('#profile-character-name')
    const currentName = await nameInput.inputValue().catch(() => '')
    if (!currentName.trim()) await nameInput.fill('巡检行者')
    await click('#profile-create-confirm', '创建游客角色')
  }

  const hidden = await waitHidden('#profile-panel')
  addCheck('进入战斗主界面', hidden, hidden ? '账号面板已关闭' : '账号面板仍显示')
  await expectVisible('#game', '战斗画布存在')
  await shot('battle-view')
}

async function exerciseAccountCenter() {
  await click('#profile-btn', '打开账号中心')
  await expectVisible('#profile-center-tabs', '账号中心页签出现')
  await expectVisible('#profile-slots', '角色档案页显示')
  await click('[data-profile-tab="cloud"]', '切到云端同步')
  await expectVisible('.profile-cloud', '云端同步页显示')
  await click('[data-profile-tab="security"]', '切到账号安全')
  const securityVisible = await visible('#profile-password-box') || await visible('#profile-local-security')
  addCheck('账号安全页显示', securityVisible, securityVisible ? '密码或绑定说明可见' : '安全内容不可见')
  await shot('account-center')
  await page.locator('#close-profile').click({ timeout: 5000 })
  await waitHidden('#profile-panel')
}

async function exercisePages() {
  const pages = [
    ['#dungeon-btn', '#dungeon-panel', '副本页'],
    ['#gacha-btn', '#gacha-panel', '抽卡页'],
    ['#equip-btn', '#equip-panel', '装备页'],
    ['#bag-btn', '#bag-panel', '背包页'],
    ['#train-btn', '#skill-panel', '法宝页'],
  ]
  for (const [button, panel, name] of pages) {
    await click(button, `打开${name}`)
    await expectVisible(panel, `${name}显示`)
    await shot(name)
  }
  await click('#battle-btn', '回到战斗页')
}

async function randomExplore() {
  const endAt = Date.now() + randomMs
  const actions = ['canvas', 'dungeon', 'gacha', 'bag', 'artifact', 'battle']
  while (Date.now() < endAt) {
    const action = actions[Math.floor(Math.random() * actions.length)]
    if (action === 'canvas') {
      const x = 90 + Math.random() * 250
      const y = 360 + Math.random() * 250
      await page.mouse.click(x, y)
    } else {
      const selector = action === 'artifact' ? '#train-btn' : `#${action}-btn`
      await page.locator(selector).click({ timeout: 2500 }).catch(() => {})
    }
    await page.waitForTimeout(450 + Math.random() * 350)
  }
  addCheck('随机探索', true, `${(randomMs / 1000).toFixed(0)}s`)
  await shot('random-explore-end', false)
}

try {
  await ensureApiServer()
  await ensureGameServer()

  const launchOptions = browserLaunchOptions()
  browser = await chromium.launch(launchOptions)
  addCheck('浏览器', true, launchOptions.executablePath ? `系统浏览器 ${launchOptions.executablePath}` : 'Playwright Chromium')
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
  page = await context.newPage()

  page.on('console', (message) => {
    const text = message.text()
    if (message.type() === 'error' && !expectedConsoleError(text)) consoleIssues.push({ type: message.type(), text })
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('response', (response) => {
    const status = response.status()
    if (status >= 400 && !expectedHttpStatus(response.url(), status)) {
      requestFailures.push(`HTTP ${status} ${response.url()}`)
    }
  })
  page.on('requestfailed', (request) => {
    const url = request.url()
    if (!url.includes('/@vite/client')) requestFailures.push(`${request.method()} ${url} ${request.failure()?.errorText ?? ''}`)
  })

  await page.goto(`${baseUrl}?gameAgent=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await completeGuestEntry()
  await sampleCanvasHealth()
  await measureFrames()
  await exerciseAccountCenter()
  await exercisePages()
  await randomExplore()
} catch (error) {
  addCheck('Agent 致命错误', false, error.stack || error.message)
  if (page) {
    try {
      await shot('fatal-state')
    } catch {
      // Reporting should continue even when screenshot capture fails.
    }
  }
} finally {
  const durationMs = Date.now() - Date.parse(startedAt)
  const { summary, markdown } = reportMarkdown({
    startedAt,
    durationMs,
    baseUrl,
    viewport,
    checks,
    consoleIssues,
    pageErrors,
    requestFailures,
    screenshots,
    performance,
  })
  const reportFile = join(outDir, 'report.md')
  await writeFile(reportFile, markdown, 'utf8')
  console.log(markdown)
  console.log(`\nReport: ${reportFile}`)

  if (browser) await browser.close().catch(() => {})
  for (const child of ownedProcesses.reverse()) stopOwnedProcess(child)
  process.exitCode = summary.ok ? 0 : 1
}
