export function canvasHealth(stats) {
  const coloredPixels = Number(stats.coloredPixels) || 0
  const uniqueColors = Number(stats.uniqueColors) || 0
  const diffRatio = Number(stats.diffRatio) || 0
  const detail = `colored=${coloredPixels} unique=${uniqueColors} motion=${(diffRatio * 100).toFixed(2)}%`
  return {
    ok: coloredPixels >= 5000 && uniqueColors >= 24 && diffRatio >= 0.002,
    detail,
  }
}

export function canvasAspectHealth(stats) {
  const intrinsicWidth = Number(stats.intrinsicWidth) || 0
  const intrinsicHeight = Number(stats.intrinsicHeight) || 0
  const cssWidth = Number(stats.cssWidth) || 0
  const cssHeight = Number(stats.cssHeight) || 0
  const intrinsicRatio = intrinsicHeight > 0 ? intrinsicWidth / intrinsicHeight : 0
  const cssRatio = cssHeight > 0 ? cssWidth / cssHeight : 0
  const mismatch = cssRatio > 0 ? Math.abs(intrinsicRatio - cssRatio) / cssRatio : 1
  const detail = `intrinsic=${intrinsicWidth}x${intrinsicHeight} css=${cssWidth.toFixed(0)}x${cssHeight.toFixed(0)} mismatch=${(mismatch * 100).toFixed(2)}%`
  return {
    ok: intrinsicRatio > 0 && cssRatio > 0 && mismatch <= 0.03,
    detail,
  }
}

export function summarizeAgentRun({ checks, consoleIssues, pageErrors, requestFailures }) {
  const lines = []
  let passed = 0
  let failed = 0

  for (const check of checks) {
    if (check.ok) {
      passed += 1
      lines.push(`PASS ${check.name}${check.detail ? ` - ${check.detail}` : ''}`)
    } else {
      failed += 1
      lines.push(`FAIL ${check.name}${check.detail ? ` - ${check.detail}` : ''}`)
    }
  }

  for (const issue of consoleIssues) {
    failed += 1
    lines.push(`FAIL console ${issue.type}: ${issue.text}`)
  }
  for (const error of pageErrors) {
    failed += 1
    lines.push(`FAIL page error: ${error}`)
  }
  for (const failure of requestFailures) {
    failed += 1
    lines.push(`FAIL request: ${failure}`)
  }

  return {
    ok: failed === 0,
    passed,
    failed,
    lines,
  }
}

function firstNumber(value) {
  const match = String(value ?? '').match(/-?\d+/)
  return match ? Number(match[0]) : 0
}

function uniqueCount(values) {
  return new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean)).size
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function paceScore(killRatePerMinute, killDelta) {
  if (killDelta <= 0) return 15
  if (killRatePerMinute >= 20) return 92
  if (killRatePerMinute >= 12) return 78
  if (killRatePerMinute >= 6) return 58
  return 38
}

function skillFeedbackScore(skillEventCount) {
  if (skillEventCount >= 3) return 90
  if (skillEventCount >= 2) return 76
  if (skillEventCount >= 1) return 56
  return 20
}

function growthScore({ levelChanged, soulChanged }) {
  if (levelChanged && soulChanged) return 88
  if (levelChanged || soulChanged) return 68
  return 25
}

function objectiveScore({ questChanged, messageVariety }) {
  if (questChanged && messageVariety >= 3) return 84
  if (questChanged || messageVariety >= 3) return 66
  return 28
}

function rewardScore(rewardSignalCount) {
  if (rewardSignalCount >= 4) return 88
  if (rewardSignalCount >= 2) return 68
  if (rewardSignalCount >= 1) return 48
  return 20
}

function stabilityScore(performance = {}) {
  const averageFrameMs = Number(performance.averageFrameMs) || 0
  const slowFrames = Number(performance.slowFrames) || 0
  if (averageFrameMs <= 0) return 50
  if (averageFrameMs <= 22 && slowFrames === 0) return 92
  if (averageFrameMs <= 34 && slowFrames <= 3) return 78
  if (averageFrameMs <= 48 && slowFrames <= 10) return 58
  return 30
}

function verdictForScore(score) {
  if (score >= 85) return '爽感基础不错'
  if (score >= 70) return '可以继续打磨'
  if (score >= 55) return '有雏形但节奏偏弱'
  return '试玩空转明显'
}

function scoreLine(label, score, detail) {
  return `- ${label}：${score}/100${detail ? `，${detail}` : ''}`
}

export function playtestReview({ samples = [], durationMs = 0, performance = {} } = {}) {
  const safeSamples = Array.isArray(samples) ? samples.filter(Boolean) : []
  const first = safeSamples[0] ?? {}
  const last = safeSamples.at(-1) ?? first
  const seconds = Math.max(1, Number(durationMs) / 1000 || firstNumber(last.elapsedMs) / 1000 || safeSamples.length)
  const firstKills = Number(first.kills) || firstNumber(first.killText)
  const lastKills = Number(last.kills) || firstNumber(last.killText)
  const firstSoul = firstNumber(first.soul)
  const lastSoul = firstNumber(last.soul)
  const killDelta = Math.max(0, lastKills - firstKills)
  const killRatePerMinute = killDelta / (seconds / 60)
  const levelChanged = uniqueCount(safeSamples.map((sample) => sample.level)) > 1
  const soulChanged = uniqueCount(safeSamples.map((sample) => sample.soul)) > 1 || lastSoul !== firstSoul
  const questChanged = uniqueCount(safeSamples.map((sample) => sample.quest)) > 1
  const messageVariety = uniqueCount(safeSamples.map((sample) => sample.message))
  const skillEvents = safeSamples
    .map((sample) => String(sample.skill ?? '').trim())
    .filter((skill) => skill && !skill.includes('自动施法准备中'))
  const skillEventCount = uniqueCount(skillEvents)
  const rewardSignalCount = safeSamples.filter((sample) => {
    const text = `${sample.message ?? ''} ${sample.quest ?? ''} ${sample.skill ?? ''} ${sample.soul ?? ''}`
    return /魂质|进化|Boss|掉落|抽卡券|灵石|精华|经验|材料|法宝|奖励/.test(text)
  }).length
  const repeatedStateCount = safeSamples.slice(1).filter((sample, index) => {
    const prev = safeSamples[index]
    return sample.kills === prev.kills
      && sample.soul === prev.soul
      && sample.level === prev.level
      && sample.quest === prev.quest
      && sample.message === prev.message
      && sample.skill === prev.skill
  }).length
  const staleRatio = safeSamples.length > 1 ? repeatedStateCount / (safeSamples.length - 1) : 1

  const categories = {
    pace: { label: '战斗节奏', score: paceScore(killRatePerMinute, killDelta) },
    skill: { label: '技能反馈', score: skillFeedbackScore(skillEventCount) },
    growth: { label: '成长反馈', score: growthScore({ levelChanged, soulChanged }) },
    objective: { label: '目标引导', score: objectiveScore({ questChanged, messageVariety }) },
    reward: { label: '奖励期待', score: rewardScore(rewardSignalCount) },
    stability: { label: '性能稳定', score: stabilityScore(performance) },
  }
  const score = clampScore(
    categories.pace.score * 0.22
      + categories.skill.score * 0.18
      + categories.growth.score * 0.18
      + categories.objective.score * 0.14
      + categories.reward.score * 0.13
      + categories.stability.score * 0.15,
  )
  const findings = []
  const recommendations = []

  if (killDelta <= 0) {
    findings.push('长时间无击杀，战斗循环没有给玩家推进感。')
    recommendations.push('提高怪物密度或缩短出生距离，让开局 10 秒内稳定进入交战。')
  } else {
    findings.push(`战斗推进可见，${seconds.toFixed(0)} 秒内击杀 +${killDelta}。`)
  }
  if (skillEventCount < 2) {
    findings.push('技能发动提示偏少，玩家不容易意识到本命术在工作。')
    recommendations.push('增加技能名闪现、命中顿帧或飞剑轨迹层次，强化自动施法反馈。')
  }
  if (!levelChanged && !soulChanged) {
    findings.push('成长反馈不足，魂质或境界没有明显变化。')
    recommendations.push('把魂球吸收、境界提升、卡牌选择做成更明确的短周期奖励。')
  }
  if (rewardSignalCount < 2) {
    findings.push('掉落反馈偏弱，奖励期待还不够明确。')
    recommendations.push('增加掉落反馈文字和飞向背包/法宝入口的动效。')
  }
  if (staleRatio >= 0.65) {
    findings.push('多次采样状态重复，玩家可能感觉在空等。')
    recommendations.push('减少无事发生的时间片，保持怪物、目标或奖励至少一项持续变化。')
  }
  if (categories.stability.score < 60) {
    findings.push('帧循环压力偏高，技能多起来后可能继续卡。')
    recommendations.push('限制同屏粒子数量，并给满屏技能做性能档位。')
  }
  if (recommendations.length === 0) {
    recommendations.push('下一步可以延长到 3-5 分钟试玩，重点观察副本通关、Boss 战和法宝成长闭环。')
  }

  const markdown = [
    '## Playtest Review',
    '',
    `- 试玩评分：${score}/100（${verdictForScore(score)}）`,
    `- 采样时长：${seconds.toFixed(0)}s`,
    `- 关键数据：击杀 +${killDelta}，技能事件 ${skillEventCount}，目标变化 ${questChanged ? '有' : '无'}，成长变化 ${levelChanged || soulChanged ? '有' : '无'}`,
    '',
    '### Category Scores',
    '',
    scoreLine(categories.pace.label, categories.pace.score, `${killRatePerMinute.toFixed(1)} 击杀/分钟`),
    scoreLine(categories.skill.label, categories.skill.score, `${skillEventCount} 个有效技能提示`),
    scoreLine(categories.growth.label, categories.growth.score, levelChanged ? '境界变化' : soulChanged ? '魂质变化' : '无变化'),
    scoreLine(categories.objective.label, categories.objective.score, `${messageVariety} 条状态文案`),
    scoreLine(categories.reward.label, categories.reward.score, `${rewardSignalCount} 次奖励信号`),
    scoreLine(categories.stability.label, categories.stability.score, `${(Number(performance.averageFrameMs) || 0).toFixed(2)}ms avg, slow=${Number(performance.slowFrames) || 0}`),
    '',
    '### Findings',
    '',
    ...findings.map((item) => `- ${item}`),
    '',
    '### Recommendations',
    '',
    ...recommendations.map((item) => `- ${item}`),
    '',
  ].join('\n')

  return {
    score,
    verdict: verdictForScore(score),
    metrics: {
      seconds,
      killDelta,
      killRatePerMinute,
      levelChanged,
      soulChanged,
      questChanged,
      messageVariety,
      skillEventCount,
      rewardSignalCount,
      staleRatio,
    },
    categories,
    findings,
    recommendations,
    markdown,
  }
}

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

export function reportMarkdown({ startedAt, durationMs, baseUrl, viewport, checks, consoleIssues, pageErrors, requestFailures, screenshots, performance, playtest, dungeonReview }) {
  const summary = summarizeAgentRun({ checks, consoleIssues, pageErrors, requestFailures })
  const lines = [
    '# Game Agent Report',
    '',
    `- Started: ${startedAt}`,
    `- Duration: ${(durationMs / 1000).toFixed(1)}s`,
    `- Target: ${baseUrl}`,
    `- Viewport: ${viewport.width}x${viewport.height}`,
    `- Status: ${summary.ok ? 'PASS' : 'FAIL'}`,
    `- Checks: ${summary.passed} passed, ${summary.failed} failed`,
    '',
    '## Checks',
    '',
    ...summary.lines.map((line) => `- ${line}`),
    '',
    '## Performance',
    '',
    `- Average frame interval: ${performance.averageFrameMs.toFixed(2)} ms`,
    `- Slow frames over 50ms: ${performance.slowFrames}`,
    '',
    ...(playtest?.markdown ? [playtest.markdown.trim(), ''] : []),
    ...(dungeonReview?.markdown ? [dungeonReview.markdown.trim(), ''] : []),
    '## Screenshots',
    '',
    ...screenshots.map((shot) => `- ${shot.label}: ${shot.file}`),
    '',
  ]
  return { summary, markdown: lines.join('\n') }
}
