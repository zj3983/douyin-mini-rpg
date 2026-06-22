import test from 'node:test'
import assert from 'node:assert/strict'

import {
  canvasAspectHealth,
  canvasHealth,
  dungeonLoopReview,
  playtestReview,
  summarizeAgentRun,
} from '../scripts/game-agent-core.mjs'

test('game agent summary fails on failed checks or runtime issues', () => {
  const summary = summarizeAgentRun({
    checks: [
      { name: '登录入口', ok: true },
      { name: '副本入口', ok: false, detail: 'button missing' },
    ],
    consoleIssues: [{ type: 'error', text: 'boom' }],
    pageErrors: [],
    requestFailures: [],
  })

  assert.equal(summary.ok, false)
  assert.equal(summary.passed, 1)
  assert.equal(summary.failed, 2)
  assert.match(summary.lines.join('\n'), /副本入口/)
  assert.match(summary.lines.join('\n'), /console error/)
})

test('canvas health requires visual content and motion', () => {
  assert.equal(canvasHealth({ coloredPixels: 40, uniqueColors: 3, diffRatio: 0.01 }).ok, false)
  assert.equal(canvasHealth({ coloredPixels: 20000, uniqueColors: 80, diffRatio: 0 }).ok, false)
  assert.deepEqual(canvasHealth({ coloredPixels: 20000, uniqueColors: 80, diffRatio: 0.02 }), {
    ok: true,
    detail: 'colored=20000 unique=80 motion=2.00%',
  })
})

test('canvas aspect health catches CSS-stretched game canvas', () => {
  assert.equal(canvasAspectHealth({ intrinsicWidth: 540, intrinsicHeight: 720, cssWidth: 430, cssHeight: 326 }).ok, false)
  assert.deepEqual(canvasAspectHealth({ intrinsicWidth: 430, intrinsicHeight: 326, cssWidth: 430, cssHeight: 326 }), {
    ok: true,
    detail: 'intrinsic=430x326 css=430x326 mismatch=0.00%',
  })
})

test('playtest review rewards combat rhythm, skill feedback, and growth signals', () => {
  const review = playtestReview({
    durationMs: 24000,
    performance: { averageFrameMs: 16.6, slowFrames: 0 },
    samples: [
      {
        elapsedMs: 0,
        level: '炼气一重',
        kills: 0,
        soul: '魂质 0/5',
        quest: '第1关进度 0/15，满后挑战 Boss',
        message: '自动推进中',
        skill: '自动施法准备中',
      },
      {
        elapsedMs: 8000,
        level: '炼气一重',
        kills: 3,
        soul: '魂质 4/5',
        quest: '第1关进度 3/15，满后挑战 Boss',
        message: '新的怪物潮正在靠近。',
        skill: '御剑术｜飞剑穿刺',
      },
      {
        elapsedMs: 16000,
        level: '炼气二重',
        kills: 7,
        soul: '魂质 2/6',
        quest: '第1关进度 7/15，满后挑战 Boss',
        message: '魂质进化：御剑·分光',
        skill: '御剑·分光｜本命术发动',
      },
      {
        elapsedMs: 24000,
        level: '炼气二重',
        kills: 10,
        soul: '魂质 5/6',
        quest: '第1关进度 10/15，满后挑战 Boss',
        message: 'Boss 战即将开启',
        skill: '九霄引雷印｜法宝共鸣',
      },
    ],
  })

  assert.equal(review.metrics.killDelta, 10)
  assert.equal(review.metrics.levelChanged, true)
  assert.equal(review.metrics.skillEventCount, 3)
  assert.ok(review.score >= 75)
  assert.match(review.markdown, /试玩评分/)
  assert.match(review.markdown, /击杀 \+10/)
})

test('playtest review calls out stale loops and performance risk', () => {
  const review = playtestReview({
    durationMs: 30000,
    performance: { averageFrameMs: 58, slowFrames: 18 },
    samples: [
      {
        elapsedMs: 0,
        level: '炼气一重',
        kills: 0,
        soul: '魂质 0/5',
        quest: '第1关进度 0/15，满后挑战 Boss',
        message: '自动推进中',
        skill: '自动施法准备中',
      },
      {
        elapsedMs: 15000,
        level: '炼气一重',
        kills: 0,
        soul: '魂质 0/5',
        quest: '第1关进度 0/15，满后挑战 Boss',
        message: '自动推进中',
        skill: '自动施法准备中',
      },
      {
        elapsedMs: 30000,
        level: '炼气一重',
        kills: 0,
        soul: '魂质 0/5',
        quest: '第1关进度 0/15，满后挑战 Boss',
        message: '自动推进中',
        skill: '自动施法准备中',
      },
    ],
  })

  assert.equal(review.metrics.killDelta, 0)
  assert.ok(review.score < 55)
  assert.match(review.markdown, /长时间无击杀/)
  assert.ok(review.recommendations.some((item) => item.includes('怪物密度') || item.includes('掉落反馈')))
})

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
