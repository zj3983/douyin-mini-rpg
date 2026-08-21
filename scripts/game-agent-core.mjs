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

const REQUIRED_BOSS_SKILLS = Object.freeze(['bamboo-sweep', 'ground-spikes', 'mountain-roar'])
const BOSS_BRAIN_PHASES = Object.freeze(['spawn', 'telegraph', 'attack', 'recovery', 'hurt', 'interrupted', 'death'])
const VFX_QUALITIES = Object.freeze(['full', 'reduced', 'minimal'])
const VFX_CAPTURE_PROGRESS_WINDOWS = Object.freeze({
  telegraph: Object.freeze({ min: 0.25, max: 0.7 }),
  impact: Object.freeze({ min: 0.35, max: 0.75 }),
})

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0
}

function malformed(detail) {
  return { ok: false, reason: 'malformed-sample', detail }
}

function validateVisibleVfx(entry, status, index) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return malformed(`visibleVfx[${index}] must be an object`)
  if (!isNonNegativeInteger(entry.generation) || entry.generation !== status.stageGeneration) {
    return malformed(`visibleVfx[${index}].generation must match stageGeneration`)
  }
  if (!isNonNegativeInteger(entry.enemyId) || entry.enemyId !== status.brain.id) {
    return malformed(`visibleVfx[${index}].enemyId must match the Boss id`)
  }
  if (typeof entry.attackId !== 'string' || entry.attackId.length === 0) {
    return malformed(`visibleVfx[${index}].attackId must be nonempty`)
  }
  if (typeof entry.authorityId !== 'string' || entry.authorityId.length === 0) {
    return malformed(`visibleVfx[${index}].authorityId must be nonempty`)
  }
  if (!REQUIRED_BOSS_SKILLS.includes(entry.skill)) return malformed(`visibleVfx[${index}].skill is invalid`)
  if (!isNonNegativeInteger(entry.sequence)) return malformed(`visibleVfx[${index}].sequence must be a nonnegative integer`)
  const castPrefix = `${entry.skill}:${entry.enemyId}:${entry.sequence}`
  if (entry.attackId !== castPrefix && !entry.attackId.startsWith(`${castPrefix}:`)) {
    return malformed(`visibleVfx[${index}].attackId must match skill, enemyId, and sequence`)
  }
  if (entry.authorityId !== castPrefix && !entry.authorityId.startsWith(`${castPrefix}:`)) {
    return malformed(`visibleVfx[${index}].authorityId must match skill, enemyId, and sequence`)
  }
  if (entry.phase !== 'telegraph' && entry.phase !== 'impact') {
    return malformed(`visibleVfx[${index}].phase is invalid`)
  }
  if (!Number.isFinite(entry.progress) || entry.progress < 0 || entry.progress > 1) {
    return malformed(`visibleVfx[${index}].progress must be finite and normalized`)
  }
  return { ok: true }
}

function sameVisibleVfxIdentity(left, right) {
  return left.generation === right.generation
    && left.enemyId === right.enemyId
    && left.skill === right.skill
    && left.sequence === right.sequence
    && left.attackId === right.attackId
    && left.authorityId === right.authorityId
    && left.phase === right.phase
}

function readableVfxProgress(entry) {
  const window = VFX_CAPTURE_PROGRESS_WINDOWS[entry.phase]
  return Boolean(window && entry.progress >= window.min && entry.progress <= window.max)
}

function validateBossStatus(status, previous = null) {
  if (status === null || status === undefined || status?.brain === null || status?.brain === undefined) {
    return { ok: false, reason: 'boss-missing', detail: 'Boss status or brain snapshot is missing' }
  }
  if (typeof status !== 'object' || Array.isArray(status) || typeof status.brain !== 'object' || Array.isArray(status.brain)) {
    return malformed('Boss status and brain must be objects')
  }
  if (!isNonNegativeInteger(status.brain.id)) return malformed('Boss id must be a nonnegative integer')
  if (!isNonNegativeInteger(status.stageGeneration)) return malformed('stageGeneration must be a nonnegative integer')
  if (!Number.isFinite(status.brain.elapsed) || status.brain.elapsed < 0) return malformed('brain elapsed must be finite and nonnegative')
  const previousElapsed = typeof previous === 'number' ? previous : previous?.brain?.elapsed ?? null
  if (previousElapsed !== null && status.brain.elapsed < previousElapsed) return malformed('brain elapsed must be monotonic')
  if (!BOSS_BRAIN_PHASES.includes(status.brain.phase)) return malformed('brain phase is invalid')
  if (typeof status.alive !== 'boolean') return malformed('alive must be boolean')
  if (!Number.isFinite(status.hp)) return malformed('hp must be finite')
  if (!VFX_QUALITIES.includes(status.vfxQuality)) return malformed('vfxQuality is invalid')
  if (!isNonNegativeInteger(status.visibleTelegraphCount)) return malformed('visibleTelegraphCount must be a nonnegative integer')
  if (!isNonNegativeInteger(status.visibleImpactCount)) return malformed('visibleImpactCount must be a nonnegative integer')
  if (!Array.isArray(status.visibleVfx)) return malformed('visibleVfx must be an array')
  for (const [index, entry] of status.visibleVfx.entries()) {
    const validation = validateVisibleVfx(entry, status, index)
    if (!validation.ok) return validation
  }
  const telegraphCount = status.visibleVfx.filter((entry) => entry.phase === 'telegraph').length
  const impactCount = status.visibleVfx.filter((entry) => entry.phase === 'impact').length
  if (telegraphCount !== status.visibleTelegraphCount || impactCount !== status.visibleImpactCount) {
    return malformed('visible VFX counts must match visibleVfx entries')
  }
  if (previous && typeof previous === 'object') {
    for (const entry of status.visibleVfx) {
      const prior = previous.visibleVfx.find((candidate) => sameVisibleVfxIdentity(candidate, entry))
      if (prior && entry.progress < prior.progress) return malformed('visible VFX progress must be monotonic')
    }
  }
  return { ok: true }
}

function bossInvariantFailure(initial, current) {
  if (current.stageGeneration !== initial.stageGeneration) return { reason: 'stage-changed', detail: 'Boss stage generation changed' }
  if (current.brain.id !== initial.brain.id) return { reason: 'boss-changed', detail: 'Boss identity changed' }
  if (!current.alive || current.hp <= 0 || current.brain.phase === 'death') {
    return { reason: 'boss-dead', detail: 'Boss died before evidence collection completed' }
  }
  return null
}

function validateCapturedEvidence(capture) {
  if (!capture || typeof capture !== 'object' || Array.isArray(capture)) return false
  if (!REQUIRED_BOSS_SKILLS.includes(capture.skill)) return false
  if (capture.phase !== 'telegraph' && capture.phase !== 'impact') return false
  if (capture.key !== `${capture.skill}:${capture.phase}`) return false
  if (capture.vfxPhase !== capture.phase) return false
  if (!isNonNegativeInteger(capture.sequence)) return false
  if (!isNonNegativeInteger(capture.bossId) || !isNonNegativeInteger(capture.stageGeneration)) return false
  if (typeof capture.attackId !== 'string' || capture.attackId.length === 0) return false
  if (typeof capture.authorityId !== 'string' || capture.authorityId.length === 0) return false
  const castPrefix = `${capture.skill}:${capture.bossId}:${capture.sequence}`
  if (capture.attackId !== castPrefix && !capture.attackId.startsWith(`${castPrefix}:`)) return false
  if (capture.authorityId !== castPrefix && !capture.authorityId.startsWith(`${castPrefix}:`)) return false
  if (!Number.isFinite(capture.elapsedBefore) || !Number.isFinite(capture.elapsedAfter)) return false
  if (!Number.isFinite(capture.progressBefore) || !Number.isFinite(capture.progressAfter)) return false
  if (capture.progressBefore < 0 || capture.progressBefore > 1) return false
  if (capture.progressAfter < capture.progressBefore || capture.progressAfter > 1) return false
  const progressWindow = VFX_CAPTURE_PROGRESS_WINDOWS[capture.vfxPhase]
  if (!progressWindow || capture.progressBefore < progressWindow.min || capture.progressBefore > progressWindow.max) return false
  if (capture.progressAfter < progressWindow.min || capture.progressAfter > progressWindow.max) return false
  return capture.elapsedBefore >= 0 && capture.elapsedAfter >= capture.elapsedBefore
}

function sameCast(left, right) {
  return left
    && right
    && left.skill === right.skill
    && left.sequence === right.sequence
    && left.authorityId === right.authorityId
    && left.bossId === right.bossId
    && left.stageGeneration === right.stageGeneration
}

function captureCandidate(status, entry) {
  const phase = entry.phase
  return Object.freeze({
    key: `${entry.skill}:${phase}`,
    skill: entry.skill,
    phase,
    vfxPhase: entry.phase,
    sequence: entry.sequence,
    attackId: entry.attackId,
    authorityId: entry.authorityId,
    bossId: status.brain.id,
    stageGeneration: status.stageGeneration,
    elapsed: status.brain.elapsed,
    hp: status.hp,
    alive: status.alive,
    vfxQuality: status.vfxQuality,
    visibleTelegraphCount: status.visibleTelegraphCount,
    visibleImpactCount: status.visibleImpactCount,
    progress: entry.progress,
  })
}

function exactVisibleEntry(status, candidate) {
  return status.visibleVfx.find((entry) => (
    entry.generation === candidate.stageGeneration
      && entry.enemyId === candidate.bossId
      && entry.skill === candidate.skill
      && entry.sequence === candidate.sequence
      && entry.attackId === candidate.attackId
      && entry.authorityId === candidate.authorityId
      && entry.phase === candidate.vfxPhase
  ))
}

export function reviewBossEvidenceCapture({ before, after, candidate } = {}) {
  const beforeValidation = validateBossStatus(before)
  if (!beforeValidation.ok) return beforeValidation
  const afterValidation = validateBossStatus(after, before)
  if (!afterValidation.ok) return afterValidation
  const beforeInvariant = bossInvariantFailure(before, before)
  if (beforeInvariant) return { ok: false, ...beforeInvariant }
  const invariant = bossInvariantFailure(before, after)
  if (invariant) return { ok: false, ...invariant }
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return { ok: false, reason: 'malformed-candidate', detail: 'capture candidate must be an object' }
  }
  if (!Number.isFinite(candidate.progress) || candidate.progress < 0 || candidate.progress > 1) {
    return { ok: false, reason: 'malformed-candidate', detail: 'capture candidate fields are invalid' }
  }
  if (candidate.bossId !== before.brain.id || candidate.stageGeneration !== before.stageGeneration) {
    return { ok: false, reason: 'state-changed', detail: 'capture candidate does not belong to the current Boss' }
  }
  const beforeEntry = exactVisibleEntry(before, candidate)
  const afterEntry = exactVisibleEntry(after, candidate)
  if (!beforeEntry || !afterEntry || beforeEntry.progress !== candidate.progress) {
    return { ok: false, reason: 'state-changed', detail: 'the exact visible VFX entry did not survive screenshot capture' }
  }
  const candidateShape = {
    ...candidate,
    elapsedBefore: before.brain.elapsed,
    elapsedAfter: after.brain.elapsed,
    progressBefore: beforeEntry.progress,
    progressAfter: afterEntry.progress,
  }
  const progressWindow = VFX_CAPTURE_PROGRESS_WINDOWS[candidate.vfxPhase]
  if (progressWindow
    && candidate.progress >= progressWindow.min
    && candidate.progress <= progressWindow.max
    && (afterEntry.progress < progressWindow.min || afterEntry.progress > progressWindow.max)) {
    return { ok: false, reason: 'state-changed', detail: 'the visible VFX left its readable progress window during screenshot capture' }
  }
  if (!validateCapturedEvidence(candidateShape)) {
    return { ok: false, reason: 'malformed-candidate', detail: 'capture candidate fields are invalid' }
  }
  return {
    ok: true,
    reason: 'captured',
    evidence: Object.freeze(candidateShape),
  }
}

export function reviewBossFinalInvariant({ initial, previous = initial, final } = {}) {
  const initialValidation = validateBossStatus(initial)
  if (!initialValidation.ok) return initialValidation
  const previousValidation = validateBossStatus(previous, initial)
  if (!previousValidation.ok) return previousValidation
  const previousInvariant = bossInvariantFailure(initial, previous)
  if (previousInvariant) return { ok: false, ...previousInvariant }
  const finalValidation = validateBossStatus(final, previous)
  if (!finalValidation.ok) return finalValidation
  const initialInvariant = bossInvariantFailure(initial, initial)
  if (initialInvariant) return { ok: false, ...initialInvariant }
  const invariant = bossInvariantFailure(initial, final)
  if (invariant) return { ok: false, ...invariant }
  return {
    ok: true,
    reason: 'valid',
    detail: 'Boss identity, generation, and alive state remained valid',
    gameElapsedSeconds: final.brain.elapsed - initial.brain.elapsed,
  }
}

export function reviewBossPerformanceInterval({ start, end, frameCount, wallDurationMs } = {}) {
  if (!Number.isSafeInteger(frameCount) || frameCount <= 0) throw new TypeError('frameCount must be a positive integer')
  if (!Number.isFinite(wallDurationMs) || wallDurationMs < 0) throw new TypeError('wallDurationMs must be finite and nonnegative')
  const invariant = reviewBossFinalInvariant({ initial: start, final: end })
  if (!invariant.ok) return invariant
  if (start.visibleVfx.length === 0) {
    return { ok: false, reason: 'no-visible-vfx', detail: 'mixed Boss combat sampling must start from visible Boss VFX' }
  }
  if (end.brain.elapsed <= start.brain.elapsed) {
    return { ok: false, reason: 'game-time-stalled', detail: 'Boss brain elapsed did not advance during the performance interval' }
  }
  const visibleSummary = (status) => Object.freeze(status.visibleVfx.map((entry) => (
    `${entry.skill}:${entry.phase}:${entry.authorityId}`
  )))
  const metadata = Object.freeze({
    kind: 'mixed-boss-combat',
    bossId: start.brain.id,
    stageGeneration: start.stageGeneration,
    frameCount,
    wallDurationMs,
    startElapsed: start.brain.elapsed,
    endElapsed: end.brain.elapsed,
    startVisibleVfx: visibleSummary(start),
    endVisibleVfx: visibleSummary(end),
  })
  return {
    ok: true,
    reason: 'valid',
    metadata,
    detail: `mixed Boss combat interval, boss=${metadata.bossId}, generation=${metadata.stageGeneration}, elapsed=${metadata.startElapsed.toFixed(3)}-${metadata.endElapsed.toFixed(3)}s, frames=${frameCount}, wall=${wallDurationMs}ms`,
  }
}

const BOSS_EVIDENCE_POLL_STATE = Symbol('boss-evidence-poll-state')

export function createBossEvidencePollState() {
  return {
    [BOSS_EVIDENCE_POLL_STATE]: true,
    initial: null,
    previous: null,
    failure: null,
    appendedSamples: 0,
    totalValidatedSamples: 0,
  }
}

function requireBossEvidencePollState(state) {
  if (!state || state[BOSS_EVIDENCE_POLL_STATE] !== true) {
    throw new TypeError('Boss evidence poll state must be created by createBossEvidencePollState')
  }
}

export function appendBossEvidenceSample(state, status) {
  requireBossEvidencePollState(state)
  state.appendedSamples += 1
  if (state.failure) {
    return { ...state.failure, validatedThisAppend: 0, totalValidatedSamples: state.totalValidatedSamples }
  }

  state.totalValidatedSamples += 1
  const validation = validateBossStatus(status, state.previous)
  if (!validation.ok) {
    state.failure = validation
  } else {
    const invariant = state.initial
      ? bossInvariantFailure(state.initial, status)
      : bossInvariantFailure(status, status)
    if (invariant) state.failure = { ok: false, ...invariant }
  }

  if (!state.failure) {
    if (!state.initial) state.initial = status
    state.previous = status
  }
  return state.failure
    ? { ...state.failure, validatedThisAppend: 1, totalValidatedSamples: state.totalValidatedSamples }
    : { ok: true, validatedThisAppend: 1, totalValidatedSamples: state.totalValidatedSamples }
}

function captureForKey(captures, key) {
  for (let index = captures.length - 1; index >= 0; index -= 1) {
    if (captures[index]?.key === key) return captures[index]
  }
  return null
}

export function reviewBossEvidencePollState({
  state,
  captures = [],
  maxGameElapsedSeconds = 25,
  wallTimedOut = false,
} = {}) {
  requireBossEvidencePollState(state)
  if (!Array.isArray(captures)) throw new TypeError('Boss skill evidence captures must be an array')
  if (!Number.isFinite(maxGameElapsedSeconds) || maxGameElapsedSeconds <= 0) {
    throw new TypeError('maxGameElapsedSeconds must be positive and finite')
  }
  if (typeof wallTimedOut !== 'boolean') throw new TypeError('wallTimedOut must be boolean')

  const observed = Object.fromEntries(REQUIRED_BOSS_SKILLS.map((skill) => [
    skill,
    { telegraph: false, impact: false },
  ]))
  const initial = state.initial
  const last = state.previous
  let failure = state.failure

  if (!failure && !initial) failure = { ok: false, reason: 'boss-missing', detail: 'Boss status is missing' }
  if (!failure) {
    for (const capture of captures) {
      if (!validateCapturedEvidence(capture)) {
        failure = { ok: false, reason: 'malformed-capture', detail: 'captured evidence fields are invalid' }
        break
      }
      if (capture.bossId !== initial.brain.id || capture.stageGeneration !== initial.stageGeneration) {
        failure = { ok: false, reason: 'malformed-capture', detail: 'captured evidence belongs to another Boss' }
        break
      }
    }
  }

  for (const skill of REQUIRED_BOSS_SKILLS) {
    const telegraph = captureForKey(captures, `${skill}:telegraph`)
    const impact = captureForKey(captures, `${skill}:impact`)
    observed[skill].telegraph = Boolean(telegraph)
    observed[skill].impact = Boolean(impact && sameCast(telegraph, impact))
  }

  const missing = REQUIRED_BOSS_SKILLS.flatMap((skill) => (
    ['telegraph', 'impact']
      .filter((phase) => !observed[skill][phase])
      .map((phase) => `${skill}:${phase}`)
  ))
  const initialElapsed = Number(initial?.brain?.elapsed)
  const lastElapsed = Number(last?.brain?.elapsed)
  const gameElapsedSeconds = Number.isFinite(initialElapsed) && Number.isFinite(lastElapsed)
    ? Math.max(0, lastElapsed - initialElapsed)
    : 0
  const captureRequests = []

  if (!failure && last) {
    for (const skill of REQUIRED_BOSS_SKILLS) {
      const telegraph = captureForKey(captures, `${skill}:telegraph`)
      const impact = captureForKey(captures, `${skill}:impact`)
      if (impact && sameCast(telegraph, impact)) continue
      const matchingImpact = telegraph && last.visibleVfx.find((entry) => (
        entry.skill === skill
          && entry.phase === 'impact'
          && entry.sequence === telegraph.sequence
          && entry.authorityId === telegraph.authorityId
          && readableVfxProgress(entry)
      ))
      if (matchingImpact) {
        captureRequests.push(captureCandidate(last, matchingImpact))
        continue
      }
      const visibleTelegraph = last.visibleVfx.find((entry) => (
        entry.skill === skill && entry.phase === 'telegraph' && readableVfxProgress(entry)
      ))
      if (visibleTelegraph && (!telegraph
        || visibleTelegraph.sequence !== telegraph.sequence
        || visibleTelegraph.authorityId !== telegraph.authorityId)) {
        captureRequests.push(captureCandidate(last, visibleTelegraph))
      }
    }
  }

  const pollValidation = Object.freeze({
    appendedSamples: state.appendedSamples,
    totalValidatedSamples: state.totalValidatedSamples,
  })
  const result = { observed, captureRequests, missing, gameElapsedSeconds, pollValidation }
  if (failure) return { ok: false, state: 'failed', reason: failure.reason, detail: failure.detail, ...result }
  if (wallTimedOut) return { ok: false, state: 'failed', reason: 'wall-timeout', detail: 'Boss evidence wall timeout elapsed', ...result }
  if (gameElapsedSeconds >= maxGameElapsedSeconds) {
    return { ok: false, state: 'failed', reason: 'game-timeout', detail: 'Boss brain elapsed exceeded the capture deadline', ...result }
  }
  if (missing.length === 0) return { ok: true, state: 'complete', reason: 'complete', detail: 'all Boss evidence captured', ...result }
  return { ok: false, state: 'waiting', reason: 'waiting', detail: 'waiting for visible Boss VFX evidence', ...result }
}

export function reviewBossSkillEvidence({
  samples = [],
  captures = [],
  maxGameElapsedSeconds = 25,
  wallTimedOut = false,
} = {}) {
  if (!Array.isArray(samples)) throw new TypeError('Boss skill evidence samples must be an array')
  const state = createBossEvidencePollState()
  for (const sample of samples) {
    const appended = appendBossEvidenceSample(state, sample)
    if (!appended.ok) break
  }
  return reviewBossEvidencePollState({ state, captures, maxGameElapsedSeconds, wallTimedOut })
}

export function buildDungeonAgentArtifacts({
  policy,
  viewport,
  baseUrl,
  checks = [],
  performance = {},
  performancePhase = 'not-sampled',
  consoleIssues = [],
  pageErrors = [],
  requestFailures = [],
  screenshots = [],
  route = null,
  failure = null,
} = {}) {
  const summary = summarizeAgentRun({ checks, consoleIssues, pageErrors, requestFailures })
  const ok = summary.ok && !failure
  const evidence = {
    mode: 'dungeon',
    policy,
    viewport,
    baseUrl,
    checks,
    performance,
    performancePhase,
    consoleIssues,
    pageErrors,
    requestFailures,
    screenshots,
    route,
    failure,
    ok,
  }
  const markdown = [
    `# Cocos Dungeon Agent: ${policy}`,
    '',
    `- Viewport: ${viewport?.width ?? 'n/a'}x${viewport?.height ?? 'n/a'}`,
    `- P95 frame: ${Number.isFinite(performance.p95FrameMs) ? performance.p95FrameMs.toFixed(2) : 'n/a'}ms`,
    `- Performance phase: ${performancePhase}`,
    `- Minimum sampled FPS: ${Number.isFinite(performance.minimumFps) ? performance.minimumFps.toFixed(1) : 'n/a'}`,
    `- Result: ${ok ? 'PASS' : 'FAIL'}`,
    `- Failure reason: ${failure?.reason ?? 'none'}`,
    ...(failure?.message ? [`- Failure message: ${failure.message}`] : []),
    '',
    ...checks.map((check) => `- ${check.ok ? '[x]' : '[ ]'} ${check.name}: ${check.detail}`),
  ].join('\n')
  return { ok, evidence, markdown }
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
