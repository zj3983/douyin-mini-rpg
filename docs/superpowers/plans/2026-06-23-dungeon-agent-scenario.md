# Dungeon Agent Scenario Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `GAME_AGENT_SCENARIO=dungeon` so the game-playing agent verifies the dungeon reward and artifact-growth loop separately from the default experience test.

**Architecture:** Keep the default agent flow intact. Add pure dungeon-loop scoring/reporting helpers to `scripts/game-agent-core.mjs`, then add a scenario branch in `scripts/game-agent.mjs` that reuses the current browser setup, login helpers, screenshots, evolution choice helper, and report writer.

**Tech Stack:** Node.js ESM, Playwright, `node:test`, existing Vite game server and auth API.

---

### Task 1: Dungeon Loop Review Core

**Files:**
- Modify: `test/gameAgentCore.test.js`
- Modify: `scripts/game-agent-core.mjs`

- [ ] **Step 1: Write failing tests for dungeon loop review**

Append these tests to `test/gameAgentCore.test.js` and add `dungeonLoopReview` to the import list:

```js
import {
  canvasAspectHealth,
  canvasHealth,
  dungeonLoopReview,
  playtestReview,
  summarizeAgentRun,
} from '../scripts/game-agent-core.mjs'

test('dungeon loop review passes when combat, settlement, reward, and artifact progress all change', () => {
  const review = dungeonLoopReview({
    entered: true,
    before: {
      tickets: 0,
      stones: 0,
      artifactOwned: 1,
      artifactProgress: ['御剑·穿云 1/6', '御剑·回锋 0/6', '御剑·分光 0/6'],
    },
    after: {
      tickets: 2,
      stones: 88,
      artifactOwned: 1,
      artifactProgress: ['御剑·穿云 2/6', '御剑·回锋 0/6', '御剑·分光 0/6'],
    },
    samples: [
      { mode: '副本·灵根洞天', kills: 9, wave: '第1/5层', quest: '清怪 2/3', message: '门钥碎片靠近' },
      { mode: '副本·灵根洞天', kills: 15, wave: '第2/5层', quest: '门钥 3/3', message: '下层门已找到' },
    ],
    settlementText: '副本结算 奖励 券 +2 灵石 +88 法宝精华 +1',
  })

  assert.equal(review.ok, true)
  assert.equal(review.reason, 'passed')
  assert.deepEqual(review.changedResources.sort(), ['artifactProgress', 'stones', 'tickets'])
  assert.match(review.markdown, /Dungeon Loop Review/)
  assert.match(review.markdown, /PASS/)
})

test('dungeon loop review fails as settlement when dungeon advances but never settles', () => {
  const review = dungeonLoopReview({
    entered: true,
    before: { tickets: 0, stones: 0, artifactOwned: 1, artifactProgress: ['御剑·穿云 1/6'] },
    after: { tickets: 0, stones: 0, artifactOwned: 1, artifactProgress: ['御剑·穿云 1/6'] },
    samples: [
      { mode: '副本·灵根洞天', kills: 4, wave: '第1/5层', quest: '清怪 1/3', message: '新的怪物潮正在靠近' },
      { mode: '副本·灵根洞天', kills: 9, wave: '第1/5层', quest: '清怪 3/3', message: '下层门已找到' },
    ],
    settlementText: '',
  })

  assert.equal(review.ok, false)
  assert.equal(review.reason, 'settlement')
  assert.match(review.markdown, /settlement/)
})

test('dungeon loop review fails as reward when settlement has no resource change', () => {
  const review = dungeonLoopReview({
    entered: true,
    before: { tickets: 1, stones: 20, artifactOwned: 1, artifactProgress: ['御剑·穿云 1/6'] },
    after: { tickets: 1, stones: 20, artifactOwned: 1, artifactProgress: ['御剑·穿云 1/6'] },
    samples: [
      { mode: '副本·灵根洞天', kills: 4, wave: '第1/5层', quest: '清怪 1/3', message: '新的怪物潮正在靠近' },
      { mode: '副本·灵根洞天', kills: 11, wave: '第2/5层', quest: '清怪 1/4', message: '副本结算' },
    ],
    settlementText: '副本结算 无掉落',
  })

  assert.equal(review.ok, false)
  assert.equal(review.reason, 'reward')
  assert.deepEqual(review.changedResources, [])
})
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npm test -- test/gameAgentCore.test.js
```

Expected: FAIL with `The requested module '../scripts/game-agent-core.mjs' does not provide an export named 'dungeonLoopReview'`.

- [ ] **Step 3: Implement minimal dungeon review helper**

Add these helpers to `scripts/game-agent-core.mjs`, before `reportMarkdown`:

```js
function numericDelta(before = {}, after = {}, key) {
  return (Number(after[key]) || 0) - (Number(before[key]) || 0)
}

function listChanged(beforeList = [], afterList = []) {
  return JSON.stringify(beforeList ?? []) !== JSON.stringify(afterList ?? [])
}

function dungeonProgressed(samples = []) {
  const safeSamples = Array.isArray(samples) ? samples.filter(Boolean) : []
  if (safeSamples.length < 2) return false
  const first = safeSamples[0]
  const last = safeSamples.at(-1)
  return firstNumber(last.kills) > firstNumber(first.kills)
    || uniqueCount(safeSamples.map((sample) => sample.wave)) > 1
    || uniqueCount(safeSamples.map((sample) => sample.quest)) > 1
    || /Boss|门|撤离|下层|结算/.test(safeSamples.map((sample) => `${sample.message ?? ''} ${sample.quest ?? ''}`).join(' '))
}

export function dungeonLoopReview({ before = {}, after = {}, samples = [], settlementText = '', entered = true, runtimeOk = true } = {}) {
  const changedResources = []
  for (const key of ['passes', 'tickets', 'stones', 'essence', 'materials', 'artifactOwned']) {
    if (numericDelta(before, after, key) !== 0) changedResources.push(key)
  }
  if (listChanged(before.artifactProgress, after.artifactProgress)) changedResources.push('artifactProgress')

  const progressed = dungeonProgressed(samples)
  const hasSettlement = String(settlementText || '').trim().length > 0
  const rewardText = /奖励|券|灵石|精华|材料|法宝|碎片|\+\d+/i.test(String(settlementText || ''))

  let reason = 'passed'
  if (!runtimeOk) reason = 'runtime'
  else if (!entered) reason = 'entry'
  else if (!progressed) reason = 'combat'
  else if (!hasSettlement) reason = 'settlement'
  else if (!rewardText || changedResources.length === 0) reason = 'reward'
  else if (!changedResources.includes('artifactProgress') && !changedResources.includes('artifactOwned') && !changedResources.includes('essence')) reason = 'artifact'

  const ok = reason === 'passed'
  const markdown = [
    '## Dungeon Loop Review',
    '',
    `- Status: ${ok ? 'PASS' : 'FAIL'}`,
    `- Reason: ${reason}`,
    `- Samples: ${Array.isArray(samples) ? samples.length : 0}`,
    `- Settlement: ${hasSettlement ? 'seen' : 'missing'}`,
    `- Changed resources: ${changedResources.length ? changedResources.join(', ') : 'none'}`,
    '',
    '### Settlement Text',
    '',
    String(settlementText || '未捕获结算文本').trim(),
    '',
  ].join('\n')

  return {
    ok,
    reason,
    changedResources,
    progressed,
    hasSettlement,
    rewardText,
    markdown,
  }
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```bash
npm test -- test/gameAgentCore.test.js
```

Expected: PASS for the existing game-agent-core tests and the three new dungeon-loop tests.

- [ ] **Step 5: Commit core review work**

Run:

```bash
git add scripts/game-agent-core.mjs test/gameAgentCore.test.js
git commit -m "Add dungeon loop review scoring"
```

### Task 2: Scenario Branch and Dungeon Samplers

**Files:**
- Modify: `scripts/game-agent.mjs`

- [ ] **Step 1: Write a failing scenario smoke test command**

Run:

```bash
$env:GAME_AGENT_SCENARIO='dungeon'; $env:GAME_AGENT_PLAYTEST_MS='15000'; npm run agent:test
```

Expected before implementation: the command still runs the default flow, and the report does not contain `Dungeon Loop Review`.

- [ ] **Step 2: Add scenario import and environment flag**

Modify the import and constants in `scripts/game-agent.mjs`:

```js
import { canvasAspectHealth, canvasHealth, dungeonLoopReview, playtestReview, reportMarkdown } from './game-agent-core.mjs'

const scenario = String(process.env.GAME_AGENT_SCENARIO || 'default').toLowerCase()
```

Add top-level state:

```js
let dungeonReview = null
```

- [ ] **Step 3: Add DOM sampling helpers**

Add these functions after `collectPlaytestSample`:

```js
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
```

- [ ] **Step 4: Add dungeon entry helper**

Add:

```js
async function enterFirstDungeon() {
  await click('#dungeon-btn', '打开副本页')
  await expectVisible('#dungeon-panel', '副本页显示')
  await shot('dungeon-scenario-entry')
  const entered = await page.locator('#dungeon-panel button').filter({ hasText: /进入|可进入|副本/ }).last().click({ timeout: 5000 }).then(() => true).catch(() => false)
  addCheck('副本专项进入按钮', entered, entered ? '已点击可进入副本' : '没有找到可进入按钮')
  if (!entered) return false
  await page.waitForTimeout(800)
  await click('#battle-btn', '副本专项回到战斗页')
  await expectVisible('#game', '副本专项战斗画布可见')
  return true
}
```

- [ ] **Step 5: Add scenario report passthrough**

Pass `dungeonReview` into `reportMarkdown` in the final block:

```js
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
```

Update `reportMarkdown` in Task 3 so this field is rendered.

### Task 3: Dungeon Scenario Runner

**Files:**
- Modify: `scripts/game-agent.mjs`
- Modify: `scripts/game-agent-core.mjs`

- [ ] **Step 1: Add dungeon scenario runner**

Add this function before the `try` block in `scripts/game-agent.mjs`:

```js
async function runDungeonScenario() {
  await completeGuestEntry(false)
  await measureFrames()
  await sampleCanvasHealth()
  await shot('battle-view')

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
```

- [ ] **Step 2: Branch the main agent flow**

Replace the fixed default flow after `page.goto(...)` with:

```js
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
```

- [ ] **Step 3: Render dungeon review in markdown report**

Update the `reportMarkdown` signature in `scripts/game-agent-core.mjs`:

```js
export function reportMarkdown({ startedAt, durationMs, baseUrl, viewport, checks, consoleIssues, pageErrors, requestFailures, screenshots, performance, playtest, dungeonReview }) {
```

Add after the playtest markdown block:

```js
...(dungeonReview?.markdown ? [dungeonReview.markdown.trim(), ''] : []),
```

- [ ] **Step 4: Run scenario and expect a useful result**

Run:

```bash
$env:GAME_AGENT_SCENARIO='dungeon'; $env:GAME_AGENT_PLAYTEST_MS='180000'; $env:GAME_AGENT_RANDOM_MS='1000'; npm run agent:test
```

Expected: report includes `## Dungeon Loop Review`. It may PASS or FAIL depending on current dungeon tuning, but any failure reason must be one of `entry`, `combat`, `settlement`, `reward`, `artifact`, or `runtime`.

- [ ] **Step 5: Commit scenario runner**

Run:

```bash
git add scripts/game-agent.mjs scripts/game-agent-core.mjs
git commit -m "Add dungeon scenario to game agent"
```

### Task 4: Verification and Deployment

**Files:**
- No source edits unless verification reveals a bug.

- [ ] **Step 1: Run full unit tests**

Run:

```bash
npm test
```

Expected: all tests pass with zero failures.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build -- --base=/game/douyin-mini-rpg/
```

Expected: TypeScript and Vite build finish with exit code 0.

- [ ] **Step 3: Run default agent**

Run:

```bash
$env:GAME_AGENT_PLAYTEST_MS='60000'; $env:GAME_AGENT_RANDOM_MS='3000'; Remove-Item Env:GAME_AGENT_SCENARIO -ErrorAction SilentlyContinue; npm run agent:test
```

Expected: default report remains PASS and still includes `## Playtest Review`.

- [ ] **Step 4: Run dungeon scenario agent**

Run:

```bash
$env:GAME_AGENT_SCENARIO='dungeon'; $env:GAME_AGENT_PLAYTEST_MS='180000'; $env:GAME_AGENT_RANDOM_MS='1000'; npm run agent:test
```

Expected: report includes `## Dungeon Loop Review`. If it fails, the final response must report the exact reason and artifact report path, then use that as the next gameplay task.

- [ ] **Step 5: Push and watch deployment**

Run:

```bash
git push origin main
gh run list --branch main --limit 5
gh run watch <latest-run-id> --exit-status
```

Expected: deployment workflow completes successfully.
