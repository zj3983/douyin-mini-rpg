import test from 'node:test'
import assert from 'node:assert/strict'

import * as gameAgentCore from '../scripts/game-agent-core.mjs'

const {
  canvasAspectHealth,
  canvasHealth,
  dungeonLoopReview,
  playtestReview,
  summarizeAgentRun,
} = gameAgentCore

function visibleVfx({
  skill,
  phase,
  sequence = 1,
  generation = 7,
  id = 99,
  attackId = `${skill}:${id}:${sequence}`,
  authorityId = `${skill}:${id}:${sequence}`,
  progress = 0.5,
} = {}) {
  return {
    generation,
    enemyId: id,
    skill,
    sequence,
    attackId,
    authorityId,
    phase,
    progress,
  }
}

function bossStatus({
  elapsed,
  lastAttack = null,
  brainPhase = 'spawn',
  entries = [],
  alive = true,
  generation = 7,
  id = 99,
  hp = alive ? 520 : 0,
  vfxQuality = 'full',
} = {}) {
  const visibleTelegraphCount = entries.filter((entry) => entry.phase === 'telegraph').length
  const visibleImpactCount = entries.filter((entry) => entry.phase === 'impact').length
  return {
    brain: {
      id,
      phase: brainPhase,
      phaseNumber: 1,
      healthRatio: alive ? 1 : 0,
      elapsed,
      position: { x: 120, y: -40 },
      lastAttack,
      attackSequence: 1,
      cooldowns: {},
    },
    hp,
    alive,
    stageGeneration: generation,
    vfxQuality,
    visibleTelegraphCount,
    visibleImpactCount,
    visibleVfx: entries,
  }
}

function capturedEvidence(
  skill,
  phase,
  sequence,
  elapsedBefore = sequence,
  elapsedAfter = elapsedBefore + 0.05,
  progressBefore = 0.5,
  progressAfter = 0.6,
) {
  const authorityId = `${skill}:99:${sequence}`
  return {
    key: `${skill}:${phase}`,
    skill,
    phase,
    vfxPhase: phase === 'telegraph' ? 'telegraph' : 'impact',
    sequence,
    attackId: authorityId,
    authorityId,
    bossId: 99,
    stageGeneration: 7,
    elapsedBefore,
    elapsedAfter,
    progressBefore,
    progressAfter,
  }
}

function completeBossCaptures() {
  return [
    capturedEvidence('bamboo-sweep', 'telegraph', 1),
    capturedEvidence('bamboo-sweep', 'active', 1),
    capturedEvidence('ground-spikes', 'telegraph', 2),
    capturedEvidence('ground-spikes', 'active', 2),
    capturedEvidence('mountain-roar', 'telegraph', 3),
    capturedEvidence('mountain-roar', 'active', 3),
  ]
}

test('boss evidence derives skill identity from live VFX instead of phase-two lastAttack', () => {
  const initial = bossStatus({ elapsed: 0.1 })
  const phaseTwoMismatch = bossStatus({
    elapsed: 0.4,
    lastAttack: 'mountain-roar',
    brainPhase: 'telegraph',
    entries: [visibleVfx({ skill: 'bamboo-sweep', phase: 'telegraph', sequence: 1 })],
  })

  const waiting = gameAgentCore.reviewBossSkillEvidence({ samples: [initial, phaseTwoMismatch] })

  assert.equal(waiting.state, 'waiting')
  assert.equal(waiting.captureRequests[0].key, 'bamboo-sweep:telegraph')
  assert.equal(waiting.captureRequests[0].authorityId, 'bamboo-sweep:99:1')
  assert.equal(waiting.captureRequests.some((entry) => entry.skill === 'mountain-roar'), false)

  const review = gameAgentCore.reviewBossSkillEvidence({
    samples: [initial, bossStatus({ elapsed: 9.4 })],
    captures: completeBossCaptures(),
  })

  assert.equal(review.ok, true)
  assert.equal(review.state, 'complete')
  assert.equal(review.reason, 'complete')
  assert.deepEqual(review.missing, [])
  assert.deepEqual(review.observed, {
    'bamboo-sweep': { telegraph: true, active: true },
    'ground-spikes': { telegraph: true, active: true },
    'mountain-roar': { telegraph: true, active: true },
  })
  assert.deepEqual(review.captureRequests, [])
  assert.ok(Math.abs(review.gameElapsedSeconds - 9.3) < 1e-9)

  const mismatchedCast = gameAgentCore.reviewBossSkillEvidence({
    samples: [initial, bossStatus({ elapsed: 4 })],
    captures: [
      capturedEvidence('bamboo-sweep', 'telegraph', 1),
      capturedEvidence('bamboo-sweep', 'active', 4),
    ],
  })
  assert.equal(mismatchedCast.state, 'waiting')
  assert.ok(mismatchedCast.missing.includes('bamboo-sweep:active'))
})

test('boss screenshot evidence is accepted only while the exact VFX cast survives capture', () => {
  const candidateEntry = visibleVfx({ skill: 'bamboo-sweep', phase: 'impact', sequence: 4 })
  const before = bossStatus({
    elapsed: 6,
    lastAttack: 'mountain-roar',
    brainPhase: 'attack',
    entries: [candidateEntry],
  })
  const candidate = {
    key: 'bamboo-sweep:active',
    skill: 'bamboo-sweep',
    phase: 'active',
    vfxPhase: 'impact',
    sequence: 4,
    attackId: candidateEntry.attackId,
    authorityId: candidateEntry.authorityId,
    bossId: 99,
    stageGeneration: 7,
    elapsed: 6,
    progress: candidateEntry.progress,
  }

  const changed = gameAgentCore.reviewBossEvidenceCapture({
    before,
    after: bossStatus({ elapsed: 6.14, brainPhase: 'recovery' }),
    candidate,
  })
  assert.deepEqual({ ok: changed.ok, reason: changed.reason }, { ok: false, reason: 'state-changed' })

  const retry = gameAgentCore.reviewBossEvidenceCapture({
    before,
    after: bossStatus({
      elapsed: 6.08,
      lastAttack: 'mountain-roar',
      brainPhase: 'attack',
      entries: [{ ...candidateEntry }],
    }),
    candidate,
  })
  assert.equal(retry.ok, true)
  assert.equal(retry.evidence.authorityId, candidateEntry.authorityId)
  assert.equal(retry.evidence.sequence, 4)
  assert.equal(retry.evidence.elapsedBefore, 6)
  assert.equal(retry.evidence.elapsedAfter, 6.08)
  assert.equal(retry.evidence.progressBefore, 0.5)
  assert.equal(retry.evidence.progressAfter, 0.5)

  const recovery = gameAgentCore.reviewBossEvidenceCapture({
    before,
    after: bossStatus({
      elapsed: 6.08,
      brainPhase: 'recovery',
      entries: [{ ...candidateEntry, progress: 0.62 }],
    }),
    candidate,
  })
  assert.equal(recovery.ok, true)
  assert.equal(Object.isFrozen(recovery.evidence), true)
  assert.equal(recovery.evidence.progressAfter, 0.62)

  const replacement = gameAgentCore.reviewBossSkillEvidence({
    samples: [
      bossStatus({ elapsed: 0 }),
      bossStatus({
        elapsed: 8,
        entries: [visibleVfx({ skill: 'bamboo-sweep', phase: 'telegraph', sequence: 4 })],
      }),
    ],
    captures: [capturedEvidence('bamboo-sweep', 'telegraph', 1)],
  })
  assert.equal(replacement.captureRequests[0].key, 'bamboo-sweep:telegraph')
  assert.equal(replacement.captureRequests[0].sequence, 4)
  assert.equal(replacement.captureRequests[0].authorityId, 'bamboo-sweep:99:4')
})

test('boss evidence candidates require readable bounded warning and impact progress', () => {
  const initial = bossStatus({ elapsed: 0 })
  const requestFor = (entry, captures = []) => gameAgentCore.reviewBossSkillEvidence({
    samples: [initial, bossStatus({ elapsed: 1, entries: [entry] })],
    captures,
  }).captureRequests

  assert.deepEqual(requestFor(visibleVfx({ skill: 'bamboo-sweep', phase: 'telegraph', progress: 0 })), [])
  assert.deepEqual(requestFor(visibleVfx({ skill: 'bamboo-sweep', phase: 'telegraph', progress: 0.24 })), [])
  assert.equal(requestFor(visibleVfx({ skill: 'bamboo-sweep', phase: 'telegraph', progress: 0.25 }))[0].progress, 0.25)
  assert.equal(requestFor(visibleVfx({ skill: 'bamboo-sweep', phase: 'telegraph', progress: 0.7 }))[0].progress, 0.7)
  assert.deepEqual(requestFor(visibleVfx({ skill: 'bamboo-sweep', phase: 'telegraph', progress: 0.71 })), [])

  const telegraphCapture = capturedEvidence('ground-spikes', 'telegraph', 1)
  assert.deepEqual(requestFor(
    visibleVfx({ skill: 'ground-spikes', phase: 'impact', progress: 0.34 }),
    [telegraphCapture],
  ), [])
  assert.equal(requestFor(
    visibleVfx({ skill: 'ground-spikes', phase: 'impact', progress: 0.35 }),
    [telegraphCapture],
  )[0].progress, 0.35)
  assert.equal(requestFor(
    visibleVfx({ skill: 'ground-spikes', phase: 'impact', progress: 0.75 }),
    [telegraphCapture],
  )[0].progress, 0.75)
  assert.deepEqual(requestFor(
    visibleVfx({ skill: 'ground-spikes', phase: 'impact', progress: 0.76 }),
    [telegraphCapture],
  ), [])
})

test('boss capture deadline applies before completion but final invariant does not retroactively fail it', () => {
  const initial = bossStatus({ elapsed: 0 })
  const completedAtBoundary = gameAgentCore.reviewBossSkillEvidence({
    samples: [initial, bossStatus({ elapsed: 24.9 })],
    captures: completeBossCaptures(),
    maxGameElapsedSeconds: 25,
  })
  assert.equal(completedAtBoundary.state, 'complete')

  const final = gameAgentCore.reviewBossFinalInvariant({
    initial,
    previous: bossStatus({ elapsed: 24.9 }),
    final: bossStatus({ elapsed: 25.1 }),
  })
  assert.deepEqual({ ok: final.ok, reason: final.reason }, { ok: true, reason: 'valid' })

  const regressedFinal = gameAgentCore.reviewBossFinalInvariant({
    initial,
    previous: bossStatus({ elapsed: 24.9 }),
    final: bossStatus({ elapsed: 24.8 }),
  })
  assert.deepEqual(
    { ok: regressedFinal.ok, reason: regressedFinal.reason },
    { ok: false, reason: 'malformed-sample' },
  )

  const incompleteAtDeadline = gameAgentCore.reviewBossSkillEvidence({
    samples: [initial, bossStatus({ elapsed: 25.1 })],
    captures: completeBossCaptures().slice(0, 5),
    maxGameElapsedSeconds: 25,
  })
  assert.deepEqual(
    { state: incompleteAtDeadline.state, reason: incompleteAtDeadline.reason },
    { state: 'failed', reason: 'game-timeout' },
  )
})

test('boss performance metadata describes a mixed combat interval instead of one short skill phase', () => {
  const start = bossStatus({
    elapsed: 3,
    lastAttack: 'mountain-roar',
    brainPhase: 'telegraph',
    entries: [visibleVfx({ skill: 'bamboo-sweep', phase: 'telegraph', sequence: 1 })],
  })
  const end = bossStatus({
    elapsed: 6.1,
    lastAttack: 'ground-spikes',
    brainPhase: 'attack',
    entries: [visibleVfx({ skill: 'ground-spikes', phase: 'impact', sequence: 2 })],
  })

  const interval = gameAgentCore.reviewBossPerformanceInterval({
    start,
    end,
    frameCount: 180,
    wallDurationMs: 3075,
  })

  assert.equal(interval.ok, true)
  assert.equal(interval.metadata.kind, 'mixed-boss-combat')
  assert.equal(interval.metadata.startElapsed, 3)
  assert.equal(interval.metadata.endElapsed, 6.1)
  assert.equal(interval.metadata.frameCount, 180)
  assert.equal(interval.metadata.wallDurationMs, 3075)
  assert.deepEqual(interval.metadata.startVisibleVfx, ['bamboo-sweep:telegraph:bamboo-sweep:99:1'])
  assert.deepEqual(interval.metadata.endVisibleVfx, ['ground-spikes:impact:ground-spikes:99:2'])
  assert.equal('skill' in interval.metadata, false)
  assert.match(interval.detail, /mixed Boss combat interval/)

  const stalled = gameAgentCore.reviewBossPerformanceInterval({
    start,
    end: { ...start, visibleVfx: [...start.visibleVfx] },
    frameCount: 180,
    wallDurationMs: 3075,
  })
  assert.deepEqual({ ok: stalled.ok, reason: stalled.reason }, { ok: false, reason: 'game-time-stalled' })

  const noVisibleStart = gameAgentCore.reviewBossPerformanceInterval({
    start: bossStatus({ elapsed: 3 }),
    end,
    frameCount: 180,
    wallDurationMs: 3075,
  })
  assert.deepEqual({ ok: noVisibleStart.ok, reason: noVisibleStart.reason }, { ok: false, reason: 'no-visible-vfx' })
})

test('boss skill evidence review hard-fails missing, dead, replaced, and timed-out Boss states', () => {
  const initial = bossStatus({ elapsed: 0.1 })
  const missing = gameAgentCore.reviewBossSkillEvidence({ samples: [initial, null] })
  assert.deepEqual({ state: missing.state, reason: missing.reason }, { state: 'failed', reason: 'boss-missing' })

  const dead = gameAgentCore.reviewBossSkillEvidence({
    samples: [initial, bossStatus({ elapsed: 2, brainPhase: 'death', alive: false })],
  })
  assert.deepEqual({ state: dead.state, reason: dead.reason }, { state: 'failed', reason: 'boss-dead' })

  const replaced = gameAgentCore.reviewBossSkillEvidence({
    samples: [initial, bossStatus({ elapsed: 1, generation: 8 })],
  })
  assert.deepEqual({ state: replaced.state, reason: replaced.reason }, { state: 'failed', reason: 'stage-changed' })

  const gameTimeout = gameAgentCore.reviewBossSkillEvidence({
    samples: [initial, bossStatus({ elapsed: 25.2 })],
    maxGameElapsedSeconds: 25,
  })
  assert.deepEqual({ state: gameTimeout.state, reason: gameTimeout.reason }, { state: 'failed', reason: 'game-timeout' })

  const wallTimeout = gameAgentCore.reviewBossSkillEvidence({ samples: [initial], wallTimedOut: true })
  assert.deepEqual({ state: wallTimeout.state, reason: wallTimeout.reason }, { state: 'failed', reason: 'wall-timeout' })

  const completeAtWallTimeout = gameAgentCore.reviewBossSkillEvidence({
    samples: [initial, bossStatus({ elapsed: 9.4 })],
    captures: completeBossCaptures(),
    wallTimedOut: true,
  })
  assert.deepEqual(
    { state: completeAtWallTimeout.state, reason: completeAtWallTimeout.reason },
    { state: 'failed', reason: 'wall-timeout' },
  )
})

test('boss evidence validation fails closed for malformed runtime samples', () => {
  const initial = bossStatus({ elapsed: 1 })
  const malformed = [
    { label: 'elapsed nonfinite', samples: [initial, bossStatus({ elapsed: Number.NaN })] },
    { label: 'elapsed regressed', samples: [initial, bossStatus({ elapsed: 0.9 })] },
    { label: 'boss id fractional', samples: [bossStatus({ elapsed: 1, id: 9.5 })] },
    { label: 'generation infinite', samples: [bossStatus({ elapsed: 1, generation: Number.POSITIVE_INFINITY })] },
    { label: 'alive nonboolean', samples: [{ ...initial, alive: 'yes' }] },
    { label: 'hp nonfinite', samples: [{ ...initial, hp: Number.NaN }] },
    { label: 'quality invalid', samples: [bossStatus({ elapsed: 1, vfxQuality: 'ultra' })] },
    { label: 'negative count', samples: [{ ...initial, visibleImpactCount: -1 }] },
    { label: 'fractional count', samples: [{ ...initial, visibleTelegraphCount: 0.5 }] },
    { label: 'entries not array', samples: [{ ...initial, visibleVfx: {} }] },
    {
      label: 'count mismatch',
      samples: [{ ...initial, visibleVfx: [visibleVfx({ skill: 'bamboo-sweep', phase: 'telegraph' })] }],
    },
    {
      label: 'entry sequence fractional',
      samples: [bossStatus({
        elapsed: 1,
        entries: [visibleVfx({ skill: 'bamboo-sweep', phase: 'telegraph', sequence: 1.5 })],
      })],
    },
    {
      label: 'entry identity disagreement',
      samples: [bossStatus({
        elapsed: 1,
        entries: [visibleVfx({
          skill: 'bamboo-sweep',
          phase: 'telegraph',
          sequence: 2,
          attackId: 'mountain-roar:99:8',
          authorityId: 'ground-spikes:99:4',
        })],
      })],
    },
    {
      label: 'entry progress nonfinite',
      samples: [bossStatus({
        elapsed: 1,
        entries: [visibleVfx({ skill: 'bamboo-sweep', phase: 'telegraph', progress: Number.NaN })],
      })],
    },
    {
      label: 'entry progress outside normalized range',
      samples: [bossStatus({
        elapsed: 1,
        entries: [visibleVfx({ skill: 'bamboo-sweep', phase: 'telegraph', progress: 1.01 })],
      })],
    },
    {
      label: 'same VFX progress regresses',
      samples: [
        bossStatus({
          elapsed: 1,
          entries: [visibleVfx({ skill: 'bamboo-sweep', phase: 'telegraph', progress: 0.6 })],
        }),
        bossStatus({
          elapsed: 1.1,
          entries: [visibleVfx({ skill: 'bamboo-sweep', phase: 'telegraph', progress: 0.5 })],
        }),
      ],
    },
  ]

  for (const entry of malformed) {
    const review = gameAgentCore.reviewBossSkillEvidence({ samples: entry.samples })
    assert.deepEqual(
      { state: review.state, reason: review.reason },
      { state: 'failed', reason: 'malformed-sample' },
      entry.label,
    )
  }
})

test('dungeon artifacts retain structured Boss failure reasons', () => {
  const artifacts = gameAgentCore.buildDungeonAgentArtifacts({
    policy: 'greedy',
    viewport: { width: 430, height: 860 },
    baseUrl: 'http://127.0.0.1:4176/',
    checks: [{ name: '完整 Boss 技能状态证据', ok: false, detail: 'boss-dead' }],
    performance: { p95FrameMs: 16.7, minimumFps: 58 },
    performancePhase: 'mixed Boss combat interval',
    consoleIssues: [],
    pageErrors: [],
    requestFailures: [],
    screenshots: [],
    route: null,
    failure: {
      reason: 'boss-dead',
      message: 'Boss died before mountain-roar impact evidence',
      details: { missing: ['mountain-roar:active'] },
    },
  })

  assert.equal(artifacts.ok, false)
  assert.equal(artifacts.evidence.failure.reason, 'boss-dead')
  assert.match(JSON.stringify(artifacts.evidence), /mountain-roar:active/)
  assert.match(artifacts.markdown, /Result: FAIL/)
  assert.match(artifacts.markdown, /Failure reason: boss-dead/)
})

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
