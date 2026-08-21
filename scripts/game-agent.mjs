#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import { createWriteStream, existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'

import {
  canvasAspectHealth,
  canvasHealth,
  dungeonLoopReview,
  playtestReview,
  reportMarkdown,
  reviewBossSkillEvidence,
} from './game-agent-core.mjs'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const runId = new Date().toISOString().replace(/[:.]/g, '-')
const outDir = join(rootDir, 'artifacts', 'game-agent', runId)

function argument(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}

function parseViewport(value) {
  const match = String(value).match(/^(\d+)x(\d+)$/i)
  if (!match) return { width: 430, height: 860 }
  return { width: Number(match[1]), height: Number(match[2]) }
}

const agentMode = argument('mode', process.env.GAME_AGENT_SCENARIO || 'default').toLowerCase()
const dungeonPolicy = argument('policy', 'balanced').toLowerCase()
const viewport = parseViewport(argument('viewport', process.env.GAME_AGENT_VIEWPORT || '430x860'))
const port = Number(process.env.GAME_AGENT_PORT || 5179)
const apiPort = Number(process.env.GAME_AGENT_API_PORT || 4174)
const baseUrl = argument('url', process.env.GAME_AGENT_URL || `http://127.0.0.1:${port}/`)
const apiHealthUrl = `http://127.0.0.1:${apiPort}/api/health`
const randomMs = Number(process.env.GAME_AGENT_RANDOM_MS || 20000)
const playtestMs = Number(process.env.GAME_AGENT_PLAYTEST_MS || 24000)
const scenario = agentMode
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
let performancePhase = 'not-sampled'
let playtest = null
let dungeonReview = null

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

async function collectPlaytestSample(startMs) {
  return page.evaluate((started) => {
    const text = (selector) => document.querySelector(selector)?.textContent?.trim() ?? ''
    const number = (selector) => {
      const match = text(selector).match(/-?\d+/)
      return match ? Number(match[0]) : 0
    }
    return {
      elapsedMs: Date.now() - started,
      level: text('#level-label'),
      kills: number('#kill-label'),
      killText: text('#kill-label'),
      soul: text('#soul-label'),
      quest: text('#quest-label'),
      message: text('#message'),
      skill: text('#skill-status-recent'),
      mode: text('#mode-label'),
      wave: text('#wave-label'),
      control: text('#auto-orb-label'),
    }
  }, startMs)
}

async function collectDungeonState() {
  return page.evaluate(() => {
    const text = (selector) => document.querySelector(selector)?.textContent?.trim() ?? ''
    const number = (value) => {
      const match = String(value ?? '').match(/-?\d+/)
      return match ? Number(match[0]) : 0
    }
    const progress = Array.from(document.querySelectorAll('#technique-progress .technique-card, #technique-progress [class*="technique"]'))
      .map((item) => item.textContent?.replace(/\s+/g, ' ').trim() ?? '')
      .filter(Boolean)
      .slice(0, 6)
    const artifactTitle = text('#artifact-page-title')
    const artifactOwnedMatch = artifactTitle.match(/(\d+)\/(\d+)/)
    const resourceText = `${text('#ticket-count')} ${text('#stone-count')} ${text('#gear-label')} ${document.querySelector('#skill-points')?.textContent ?? ''}`
    return {
      mode: text('#mode-label'),
      wave: text('#wave-label'),
      quest: text('#quest-label'),
      message: text('#message'),
      kills: number(text('#kill-label')),
      passes: number(text('#mode-btn')),
      tickets: number(text('#ticket-count')),
      stones: number(text('#stone-count')),
      essence: number(resourceText.match(/精华\s*(\d+)/)?.[1] ?? 0),
      materials: number(resourceText.match(/材料\s*(\d+)/)?.[1] ?? 0),
      artifactSummary: artifactTitle,
      artifactOwned: artifactOwnedMatch ? Number(artifactOwnedMatch[1]) : 0,
      artifactProgress: progress,
    }
  })
}

async function collectSettlementText() {
  return page.evaluate(() => {
    const panel = document.querySelector('#settlement-panel')
    if (!panel || panel.hidden) return ''
    return panel.textContent?.replace(/\s+/g, ' ').trim() ?? ''
  })
}

async function chooseEvolutionIfOpen() {
  const card = page.locator('.evolution-card').first()
  if (!await card.isVisible({ timeout: 300 }).catch(() => false)) return false
  const title = await card.locator('b').textContent({ timeout: 300 }).catch(() => '')
  await card.click({ timeout: 1500 })
  await page.waitForTimeout(400)
  return title?.trim() || true
}

async function clearEvolutionChoices(max = 4) {
  for (let i = 0; i < max; i += 1) {
    const choice = await chooseEvolutionIfOpen()
    if (!choice) return
  }
}

async function playtestCombat() {
  await page.locator('#battle-btn').click({ timeout: 3000 }).catch(() => {})
  await expectVisible('#game', '试玩战斗页可见')
  await shot('playtest-start', false)

  const samples = []
  const started = Date.now()
  const endAt = started + playtestMs
  const evolutionChoices = []
  while (Date.now() <= endAt) {
    const choice = await chooseEvolutionIfOpen()
    if (choice) evolutionChoices.push(choice)
    samples.push(await collectPlaytestSample(started))
    await page.waitForTimeout(Math.min(3000, Math.max(800, endAt - Date.now())))
  }
  const finalChoice = await chooseEvolutionIfOpen()
  if (finalChoice) evolutionChoices.push(finalChoice)
  samples.push(await collectPlaytestSample(started))
  playtest = playtestReview({
    samples,
    durationMs: Date.now() - started,
    performance,
  })
  addCheck('试玩评测生成', samples.length >= 3, `score=${playtest.score}/100 kills=+${playtest.metrics.killDelta} skills=${playtest.metrics.skillEventCount} evolutions=${evolutionChoices.length}`)
  await shot('playtest-end', false)
}

async function completeGuestEntry(captureBattle = true) {
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

  let hidden = await waitHidden('#profile-panel')
  if (!hidden && await visible('#close-profile')) {
    await page.locator('#close-profile').click({ timeout: 3000 }).catch(() => {})
    hidden = await waitHidden('#profile-panel', 4000)
  }
  addCheck('进入战斗主界面', hidden, hidden ? '账号面板已关闭' : '账号面板仍显示')
  await expectVisible('#game', '战斗画布存在')
  if (captureBattle) await shot('battle-view')
}

async function exerciseAccountCenter() {
  await chooseEvolutionIfOpen()
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
  await chooseEvolutionIfOpen()
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
    await chooseEvolutionIfOpen()
    await click(button, `打开${name}`)
    await chooseEvolutionIfOpen()
    await expectVisible(panel, `${name}显示`)
    await shot(name)
  }
  await chooseEvolutionIfOpen()
  await click('#battle-btn', '回到战斗页')
}

async function randomExplore() {
  const endAt = Date.now() + randomMs
  const actions = ['canvas', 'dungeon', 'gacha', 'bag', 'artifact', 'battle']
  while (Date.now() < endAt) {
    await chooseEvolutionIfOpen()
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
  await chooseEvolutionIfOpen()
  addCheck('随机探索', true, `${(randomMs / 1000).toFixed(0)}s`)
  await shot('random-explore-end', false)
}

async function enterFirstDungeon() {
  await clearEvolutionChoices()
  await click('#dungeon-btn', '打开副本页')
  await expectVisible('#dungeon-panel', '副本页显示')
  await shot('dungeon-scenario-entry')
  const entryButtons = page.locator('#dungeon-panel button').filter({ hasText: /进入副本|可进入|进入/ })
  const entered = await entryButtons.first().click({ timeout: 5000 }).then(() => true).catch(() => false)
  addCheck('副本专项进入按钮', entered, entered ? '已点击可进入副本' : '没有找到可进入按钮')
  if (!entered) return false
  await page.waitForTimeout(800)
  await click('#battle-btn', '副本专项回到战斗页')
  await expectVisible('#game', '副本专项战斗画布可见')
  return true
}

async function runDungeonScenario() {
  await completeGuestEntry(false)
  await measureFrames()
  await sampleCanvasHealth()
  await shot('battle-view')

  await clearEvolutionChoices()
  await click('#train-btn', '副本专项打开法宝页')
  await expectVisible('#skill-panel', '副本专项法宝页显示')
  const before = await collectDungeonState()
  await shot('dungeon-artifact-before')

  const entered = await enterFirstDungeon()
  const samples = []
  let settlementText = ''
  const started = Date.now()
  const endAt = started + playtestMs

  while (entered && Date.now() <= endAt) {
    await chooseEvolutionIfOpen()
    const text = await collectSettlementText()
    if (text) {
      settlementText = text
      break
    }
    const sample = await collectDungeonState()
    samples.push(sample)
    const gateReady = /撤离|下层|进下一层|找撤离门|找下层门/.test(`${sample.quest} ${sample.message} ${sample.wave}`)
    if (gateReady) {
      await page.locator('#mode-btn').click({ timeout: 1500 }).catch(() => {})
      await page.waitForTimeout(900)
      const afterGateText = await collectSettlementText()
      if (afterGateText) {
        settlementText = afterGateText
        break
      }
    }
    await page.waitForTimeout(900)
  }

  if (!settlementText) settlementText = await collectSettlementText()
  if (settlementText) {
    await shot('dungeon-settlement')
    await page.locator('#close-settlement').click({ timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(600)
  }

  await click('#train-btn', '副本专项回到法宝页')
  await expectVisible('#skill-panel', '副本专项法宝页复查')
  const after = await collectDungeonState()
  await shot('dungeon-artifact-after')

  dungeonReview = dungeonLoopReview({ before, after, samples, settlementText, entered })
  addCheck('副本闭环专项评测', dungeonReview.ok, `${dungeonReview.reason}; changed=${dungeonReview.changedResources.join(',') || 'none'}`)
}

async function bridgeCall(method, payload) {
  return page.evaluate(({ methodName, value }) => {
    const bridge = globalThis.__M3_DUNGEON_AGENT__
    if (!bridge || typeof bridge[methodName] !== 'function') throw new Error(`Dungeon bridge method unavailable: ${methodName}`)
    return bridge[methodName](value)
  }, { methodName: method, value: payload })
}

async function dungeonCommand(command, label) {
  const result = await bridgeCall('command', command)
  const accepted = Boolean(result?.accepted)
  addCheck(label, accepted, accepted ? JSON.stringify(command) : JSON.stringify(result))
  await page.waitForTimeout(120)
  return accepted
}

async function dungeonMove(exitId) {
  return dungeonCommand({ type: 'choose-exit', exitId }, `通过路线 ${exitId}`)
}

async function measureDetailedFrames(sampleCount = 180, phase = '基线', bossEvidence = null) {
  const result = await page.evaluate(async (count) => {
    const samples = []
    let previous = await new Promise((resolveFrame) => requestAnimationFrame(resolveFrame))
    while (samples.length < count) {
      const current = await new Promise((resolveFrame) => requestAnimationFrame(resolveFrame))
      samples.push(current - previous)
      previous = current
    }
    const sorted = [...samples].sort((a, b) => a - b)
    const percentile = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]
    const max = sorted.at(-1) ?? 0
    return {
      averageFrameMs: samples.reduce((sum, value) => sum + value, 0) / samples.length,
      p95FrameMs: percentile,
      minimumFps: max > 0 ? 1000 / max : 0,
      droppedFrames: samples.filter((value) => value > 34).length,
    }
  }, sampleCount)
  performance = result
  const verifiedBossPhase = Boolean(
    bossEvidence?.alive
      && Number(bossEvidence.hp) > 0
      && ['bamboo-sweep', 'ground-spikes', 'mountain-roar'].includes(bossEvidence.skill)
      && (
        (bossEvidence.phase === 'telegraph'
          && bossEvidence.brainPhase === 'telegraph'
          && Number(bossEvidence.visibleTelegraphCount) > 0)
        || (bossEvidence.phase === 'active'
          && bossEvidence.brainPhase === 'attack'
          && Number(bossEvidence.visibleImpactCount) > 0)
      )
  )
  const phaseDetail = bossEvidence
    ? `skill=${bossEvidence.skill}, phase=${bossEvidence.brainPhase}, evidence=${bossEvidence.phase}, elapsed=${Number(bossEvidence.elapsed).toFixed(3)}s, telegraphs=${bossEvidence.visibleTelegraphCount}, impacts=${bossEvidence.visibleImpactCount}, quality=${bossEvidence.vfxQuality}`
    : phase
  const phaseVerified = bossEvidence ? verifiedBossPhase : phase.includes('战斗')
  performancePhase = phaseDetail
  addCheck('Cocos 帧时间', result.p95FrameMs <= 20 && result.minimumFps >= 30, `P95 ${result.p95FrameMs.toFixed(2)}ms, min ${result.minimumFps.toFixed(1)} FPS, dropped ${result.droppedFrames}`)
  addCheck('性能采样阶段', phaseVerified, phaseDetail)
  return { ...result, phaseVerified }
}

const BOSS_SKILL_SCREENSHOT_LABELS = Object.freeze({
  'bamboo-sweep': Object.freeze({
    telegraph: 'greedy-boss-bamboo-sweep-telegraph',
    active: 'greedy-boss-bamboo-sweep-active',
  }),
  'ground-spikes': Object.freeze({
    telegraph: 'greedy-boss-ground-spikes-telegraph',
    active: 'greedy-boss-ground-spikes-active',
  }),
  'mountain-roar': Object.freeze({
    telegraph: 'greedy-boss-mountain-roar-telegraph',
    active: 'greedy-boss-mountain-roar-active',
  }),
})

async function captureBossSkillStates() {
  const wallDeadlineMs = Date.now() + 60_000
  const samples = []
  const captureTasks = new Map()
  let performancePromise = null
  let review = null

  while (true) {
    const status = await bridgeCall('bossCombatStatus')
    const wallTimedOut = Date.now() >= wallDeadlineMs
    if (samples.length === 0 && !status?.brain) {
      if (wallTimedOut) {
        samples.push(null)
        review = reviewBossSkillEvidence({ samples, maxGameElapsedSeconds: 25, wallTimedOut: true })
        break
      }
      await page.waitForTimeout(16)
      continue
    }

    samples.push(status)
    review = reviewBossSkillEvidence({ samples, maxGameElapsedSeconds: 25, wallTimedOut })
    for (const evidence of review.captureRequests) {
      if (captureTasks.has(evidence.key)) continue
      const label = BOSS_SKILL_SCREENSHOT_LABELS[evidence.skill]?.[evidence.phase]
      if (!label) throw new Error(`Unknown Boss evidence label: ${evidence.key}`)
      captureTasks.set(evidence.key, shot(label).then((ok) => ({
        key: evidence.key,
        label,
        ok,
        evidence,
      })))
      if (!performancePromise) {
        performancePromise = measureDetailedFrames(180, 'Boss技能状态实战', evidence).then(
          (result) => ({ result, evidence }),
          (error) => ({ error, evidence }),
        )
      }
    }
    if (review.state !== 'waiting') break
    await page.waitForTimeout(16)
  }

  const captures = await Promise.all(captureTasks.values())
  const performanceOutcome = performancePromise ? await performancePromise : null
  if (review?.ok) {
    samples.push(await bridgeCall('bossCombatStatus'))
    review = reviewBossSkillEvidence({
      samples,
      maxGameElapsedSeconds: 25,
      wallTimedOut: Date.now() >= wallDeadlineMs,
    })
  }
  if (!performanceOutcome) addCheck('性能采样阶段', false, 'no verified Boss VFX state observed')
  else if (performanceOutcome.error) addCheck('性能采样阶段', false, performanceOutcome.error.message)
  const complete = Boolean(
    review?.ok
      && captures.length === 6
      && captures.every((capture) => capture.ok)
      && performanceOutcome
      && !performanceOutcome.error
      && performanceOutcome.result?.phaseVerified
  )
  const detail = `state=${review?.state ?? 'missing'}, reason=${review?.reason ?? 'missing'}, gameElapsed=${review?.gameElapsedSeconds?.toFixed(3) ?? 'n/a'}s, captured=${captures.filter((capture) => capture.ok).length}/6, missing=${review?.missing?.join(',') || 'none'}`
  addCheck(
    '完整 Boss 技能状态证据',
    complete,
    detail,
  )
  if (!complete) throw new Error(`Boss skill evidence incomplete: ${detail}`)
  return {
    review,
    captures,
    sampleCount: samples.length,
    initialStatus: samples[0] ?? null,
    finalStatus: samples.at(-1) ?? null,
    performanceEvidence: performanceOutcome.evidence,
  }
}

function designRectToCss(rect, scale) {
  return {
    left: viewport.width / 2 + (rect.centerX - rect.width / 2) * scale,
    right: viewport.width / 2 + (rect.centerX + rect.width / 2) * scale,
    top: viewport.height / 2 - (rect.centerY + rect.height / 2) * scale,
    bottom: viewport.height / 2 - (rect.centerY - rect.height / 2) * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  }
}

async function inspectDungeonUiLayout() {
  const layout = await bridgeCall('uiLayout')
  const keys = ['hud', 'mapButton', 'interaction', 'commandBar', 'settlement']
  const rects = Object.fromEntries(keys.map((key) => [key, designRectToCss(layout[key], layout.physicalScale)]))
  const inside = Object.values(rects).every((rect) => (
    rect.left >= -1 && rect.top >= -1 && rect.right <= viewport.width + 1 && rect.bottom <= viewport.height + 1
  ))
  const touchable = rects.mapButton.width >= 44 && rects.mapButton.height >= 44 && rects.commandBar.height >= 44
  addCheck('副本功能区完整显示', inside, JSON.stringify(rects))
  addCheck('副本触控尺寸可用', touchable, `map=${rects.mapButton.width.toFixed(1)}x${rects.mapButton.height.toFixed(1)}, command=${rects.commandBar.height.toFixed(1)}`)
  return layout
}

async function clickDungeonCommand(layout, index) {
  const minimumTouch = 44 / layout.physicalScale
  const buttonWidth = Math.max(minimumTouch, (layout.commandBar.width - 24) / 4)
  const centerX = layout.commandBar.centerX + (index - 1.5) * (buttonWidth + 8)
  const x = viewport.width / 2 + centerX * layout.physicalScale
  const y = viewport.height / 2 - layout.commandBar.centerY * layout.physicalScale
  await page.mouse.click(x, y)
  await page.waitForTimeout(180)
}

async function clickDungeonMapRoundTrip(layout) {
  const mapX = viewport.width / 2 + layout.mapButton.centerX * layout.physicalScale
  const mapY = viewport.height / 2 - layout.mapButton.centerY * layout.physicalScale
  await page.mouse.click(mapX, mapY)
  await page.waitForTimeout(100)
  const pausedStart = await bridgeCall('snapshot')
  await bridgeCall('advance', 1)
  await page.waitForTimeout(100)
  const pausedEnd = await bridgeCall('snapshot')
  const touch = Math.max(44 / layout.physicalScale, 44)
  const closeXDesign = layout.safeRect.centerX + layout.safeRect.width / 2 - touch / 2 - 12
  const closeYDesign = layout.safeRect.centerY + layout.safeRect.height / 2 - touch / 2 - 12
  await page.mouse.click(
    viewport.width / 2 + closeXDesign * layout.physicalScale,
    viewport.height / 2 - closeYDesign * layout.physicalScale,
  )
  await page.waitForTimeout(180)
  const unchanged = pausedStart?.pressure?.elapsedSeconds === pausedEnd?.pressure?.elapsedSeconds
  addCheck('地图按钮可点击并暂停', unchanged, `${pausedStart?.pressure?.elapsedSeconds} -> ${pausedEnd?.pressure?.elapsedSeconds}`)
}

async function clickSettlementClose(layout) {
  const touch = Math.max(44 / layout.physicalScale, 44)
  const centerY = layout.settlement.centerY - layout.settlement.height / 2 + touch / 2 + 18
  await page.mouse.click(
    viewport.width / 2 + layout.settlement.centerX * layout.physicalScale,
    viewport.height / 2 - centerY * layout.physicalScale,
  )
  await page.waitForTimeout(200)
  return (await bridgeCall('snapshot')) === null
}

async function inspectCocosViewport() {
  await page.waitForFunction(() => {
    const canvas = document.querySelector('#GameCanvas')
    return Boolean(canvas && canvas.width === innerWidth && canvas.height === innerHeight)
  }, null, { timeout: 30000 })
  const metrics = await page.evaluate(() => {
    const canvas = document.querySelector('#GameCanvas')
    const rect = canvas?.getBoundingClientRect()
    return {
      found: Boolean(canvas),
      left: rect?.left ?? -1,
      top: rect?.top ?? -1,
      right: rect?.right ?? -1,
      bottom: rect?.bottom ?? -1,
      width: rect?.width ?? 0,
      height: rect?.height ?? 0,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      intrinsicWidth: canvas?.width ?? 0,
      intrinsicHeight: canvas?.height ?? 0,
    }
  })
  const withinViewport = metrics.found
    && metrics.left >= -1 && metrics.top >= -1
    && metrics.right <= metrics.viewportWidth + 1 && metrics.bottom <= metrics.viewportHeight + 1
  const intrinsicAspect = metrics.intrinsicHeight ? metrics.intrinsicWidth / metrics.intrinsicHeight : 0
  const cssAspect = metrics.height ? metrics.width / metrics.height : 0
  const unstretched = intrinsicAspect > 0 && Math.abs(intrinsicAspect - cssAspect) <= 0.02
  addCheck('Cocos 画布完整显示', withinViewport, JSON.stringify(metrics))
  addCheck('Cocos 画面未拉伸', unstretched, `intrinsic=${intrinsicAspect.toFixed(3)}, css=${cssAspect.toFixed(3)}`)
  return metrics
}

async function playCocosDungeonPolicy(policy) {
  if (!['safe', 'balanced', 'greedy'].includes(policy)) throw new Error(`Unknown dungeon policy: ${policy}`)
  await page.waitForFunction(() => globalThis.__M3_DUNGEON_AGENT__?.ready(), null, { timeout: 30000 })
  await page.waitForFunction(() => globalThis.__M3_DUNGEON_AGENT__?.resourceStatus()?.state !== 'loading', null, { timeout: 30000 })
  const resourceStatus = await bridgeCall('resourceStatus')
  addCheck('副本美术资源加载完成', resourceStatus?.state === 'ready', JSON.stringify(resourceStatus))
  await page.evaluate(() => localStorage.removeItem('cultivation-save-v4'))
  const entered = await bridgeCall('enterDungeon', policy === 'safe' ? 300 : policy === 'balanced' ? 301 : 302)
  addCheck('进入 Cocos 副本', entered, policy)
  if (!entered) throw new Error('Dungeon entry was rejected')
  await page.waitForTimeout(1000)
  await shot(`${policy}-entry`)

  const uiLayout = await inspectDungeonUiLayout()
  let bossSkillEvidence = null
  await clickDungeonMapRoundTrip(uiLayout)
  await clickDungeonCommand(uiLayout, 1)
  const firstRoom = await bridgeCall('snapshot')
  addCheck('真实按钮进入首个房间', firstRoom?.map?.currentRoomId === 'f1-forest-combat', firstRoom?.map?.currentRoomId ?? 'missing')
  if (policy === 'safe') {
    await measureDetailedFrames(180, '首房真实战斗')
    await dungeonMove('f1-forest-to-floor2')
    await dungeonMove('f2-bridge-to-exit')
  } else {
    await dungeonCommand({ type: 'search' }, '搜索雾竹林')
    await dungeonMove('f1-forest-to-sealed-cache')
    await dungeonCommand({ type: 'search' }, '搜索封印宝库')
    await dungeonMove('f1-sealed-cache-to-forest')

    if (policy === 'balanced') {
      await dungeonMove('f1-forest-to-alchemy')
      await dungeonCommand({ type: 'search' }, '搜索炼丹遗址')
      await dungeonMove('f1-alchemy-to-forest')
      await shot('balanced-before-pursuit')
      await bridgeCall('advance', 80)
      await page.waitForTimeout(250)
      await measureDetailedFrames(180, '追击真实战斗')
      await bridgeCall('completeEncounter')
      await dungeonMove('f1-forest-to-floor2')
      await dungeonMove('f2-bridge-to-exit')
    } else {
      await dungeonMove('f1-forest-to-floor2')
      await dungeonCommand({ type: 'search' }, '搜索寒灯桥')
      await dungeonMove('f2-bridge-to-sword-array')
      await dungeonCommand({ type: 'search' }, '破解剑阵')
      await shot('greedy-before-pursuit')
      await bridgeCall('advance', 70)
      await page.waitForTimeout(250)
      await bridgeCall('completeEncounter')
      await bridgeCall('advance', 125)
      await page.waitForTimeout(250)
      await dungeonMove('f2-sword-array-to-elite')
      await page.waitForTimeout(250)
      await bridgeCall('completeEncounter')
      await dungeonMove('f2-elite-to-floor3')
      await dungeonMove('f3-antechamber-to-altar')
      const altarActivated = await dungeonCommand({ type: 'activate-altar' }, '激活竹皇祭坛')
      if (!altarActivated) throw new Error('Bamboo Emperor altar activation was rejected')
      bossSkillEvidence = await captureBossSkillStates()
      await bridgeCall('completeEncounter')
      await dungeonMove('f3-altar-to-vault')
      await dungeonCommand({ type: 'search' }, '搜索飞剑宝库')
      await dungeonMove('f3-vault-to-exit')
    }
  }

  const beforeExtraction = await bridgeCall('snapshot')
  await dungeonCommand({ type: 'begin-extraction' }, '开始三秒撤离')
  await bridgeCall('advance', 3.2)
  await page.waitForTimeout(300)
  const terminalSnapshot = await bridgeCall('snapshot')
  const extracted = terminalSnapshot?.phase === 'extracted'
  addCheck('副本完成撤离', extracted, `${beforeExtraction?.map?.currentRoomId ?? 'unknown'} -> ${terminalSnapshot?.phase ?? 'missing'}`)
  await shot(`${policy}-settlement`)
  const closed = await clickSettlementClose(uiLayout)
  addCheck('真实按钮关闭结算', closed, String(closed))
  return { beforeExtraction, terminalSnapshot, bossSkillEvidence }
}

async function runCocosDungeonAgent() {
  if (!await probe(baseUrl, 1500)) throw new Error(`Cocos build is not reachable: ${baseUrl}`)
  browser = await chromium.launch(browserLaunchOptions())
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: viewport.width < viewport.height, hasTouch: true })
  page = await context.newPage()
  page.on('console', (message) => {
    const location = message.location()
    if (message.type() === 'error' && !location.url.endsWith('/favicon.ico')) {
      consoleIssues.push({ type: message.type(), text: message.text(), url: location.url })
    }
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('requestfailed', (request) => requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`))
  await page.goto(`${baseUrl}${baseUrl.includes('?') ? '&' : '?'}gameAgent=1`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await inspectCocosViewport()
  const route = await playCocosDungeonPolicy(dungeonPolicy)
  addCheck('运行时无错误', consoleIssues.length === 0 && pageErrors.length === 0 && requestFailures.length === 0, `console=${consoleIssues.length}, page=${pageErrors.length}, request=${requestFailures.length}`)

  const evidence = {
    mode: 'dungeon', policy: dungeonPolicy, viewport, baseUrl,
    checks, performance, performancePhase, consoleIssues, pageErrors, requestFailures, screenshots, route,
  }
  await writeFile(join(outDir, 'dungeon-evidence.json'), JSON.stringify(evidence, null, 2), 'utf8')
  const markdown = [
    `# Cocos Dungeon Agent: ${dungeonPolicy}`,
    '',
    `- Viewport: ${viewport.width}x${viewport.height}`,
    `- P95 frame: ${performance.p95FrameMs?.toFixed(2) ?? 'n/a'}ms`,
    `- Performance phase: ${performancePhase}`,
    `- Minimum sampled FPS: ${performance.minimumFps?.toFixed(1) ?? 'n/a'}`,
    `- Result: ${checks.every((check) => check.ok) ? 'PASS' : 'FAIL'}`,
    '',
    ...checks.map((check) => `- ${check.ok ? '[x]' : '[ ]'} ${check.name}: ${check.detail}`),
  ].join('\n')
  await writeFile(join(outDir, 'report.md'), markdown, 'utf8')
  console.log(markdown)
  console.log(`\nReport: ${join(outDir, 'report.md')}`)
  await browser.close()
  browser = null
  return checks.every((check) => check.ok)
}

if (agentMode === 'dungeon') {
  let ok = false
  try {
    ok = await runCocosDungeonAgent()
  } catch (error) {
    console.error(error.stack || error.message)
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
  process.exit(ok ? 0 : 1)
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
  if (scenario === 'dungeon') {
    await runDungeonScenario()
  } else {
    await completeGuestEntry(false)
    await measureFrames()
    await sampleCanvasHealth()
    await shot('battle-view')
    await exerciseAccountCenter()
    await exercisePages()
    await playtestCombat()
    await randomExplore()
  }
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
    playtest,
    dungeonReview,
  })
  const reportFile = join(outDir, 'report.md')
  await writeFile(reportFile, markdown, 'utf8')
  console.log(markdown)
  console.log(`\nReport: ${reportFile}`)

  if (browser) await browser.close().catch(() => {})
  for (const child of ownedProcesses.reverse()) stopOwnedProcess(child)
  process.exitCode = summary.ok ? 0 : 1
}
