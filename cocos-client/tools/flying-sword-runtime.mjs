const EPSILON = 0.000000001
const MAX_TRANSITIONS = 8

function nonnegative(value) {
  return Number.isFinite(value) && value > 0 ? value : 0
}

function setState(timeline, state) {
  timeline.state = state
  timeline.phaseElapsed = 0
  timeline.progress = 0
  timeline.phaseHitResolved = false
  timeline.cooldownRemaining = state === 'idle' ? timeline.config.cooldown : 0
}

function consumePhase(timeline, duration, budget) {
  const remaining = Math.max(0, duration - timeline.phaseElapsed)
  if (duration === 0 || remaining <= EPSILON) {
    timeline.phaseElapsed = duration
    timeline.progress = 1
    return { budget, complete: true }
  }
  if (budget <= 0) return { budget: 0, complete: false }

  const consumed = Math.min(remaining, budget)
  timeline.phaseElapsed = Math.min(duration, timeline.phaseElapsed + consumed)
  timeline.progress = Math.min(1, timeline.phaseElapsed / duration)
  const nextBudget = Math.max(0, budget - consumed)
  return {
    budget: nextBudget <= EPSILON ? 0 : nextBudget,
    complete: duration - timeline.phaseElapsed <= EPSILON,
  }
}

export function createFlyingSwordTimeline(input = {}) {
  const config = {
    cooldown: nonnegative(input.cooldown),
    handSealDuration: nonnegative(input.handSealDuration),
    flightDuration: nonnegative(input.flightDuration),
  }
  return {
    config,
    state: 'idle',
    phaseElapsed: 0,
    progress: 0,
    phaseHitResolved: false,
    cooldownRemaining: config.cooldown,
  }
}

export function resetFlyingSwordTimeline(timeline) {
  setState(timeline, 'idle')
}

export function advanceFlyingSwordTimeline(timeline, deltaTime) {
  const events = []
  let budget = nonnegative(deltaTime)

  for (let transition = 0; transition < MAX_TRANSITIONS; transition += 1) {
    if (timeline.state === 'idle') {
      const step = consumePhase(timeline, timeline.config.cooldown, budget)
      budget = step.budget
      timeline.cooldownRemaining = Math.max(0, timeline.config.cooldown - timeline.phaseElapsed)
      if (!step.complete) break
      setState(timeline, 'handSeal')
      events.push({ type: 'castStarted', phase: 'handSeal' })
      events.push({ type: 'action', action: 'hand_seal' })
      continue
    }

    if (timeline.state === 'handSeal') {
      const step = consumePhase(timeline, timeline.config.handSealDuration, budget)
      budget = step.budget
      if (!step.complete) break
      setState(timeline, 'outbound')
      continue
    }

    const phase = timeline.state
    const step = consumePhase(timeline, timeline.config.flightDuration, budget)
    budget = step.budget
    if (!timeline.phaseHitResolved && timeline.progress >= 0.5) {
      timeline.phaseHitResolved = true
      events.push({ type: 'pass', phase })
    }
    if (!step.complete) break

    if (phase === 'outbound') {
      setState(timeline, 'returning')
      continue
    }

    events.push({ type: 'action', action: 'sword_ride' })
    events.push({ type: 'finished' })
    resetFlyingSwordTimeline(timeline)
    break
  }

  return events
}
