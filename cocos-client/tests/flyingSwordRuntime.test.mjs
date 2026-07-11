import test from 'node:test'
import assert from 'node:assert/strict'
import {
  advanceFlyingSwordTimeline,
  createFlyingSwordTimeline,
  resetFlyingSwordTimeline,
} from '../tools/flying-sword-runtime.mjs'
import * as swordRuntime from '../tools/flying-sword-runtime.mjs'

const config = {
  cooldown: 1,
  handSealDuration: 0.2,
  flightDuration: 0.6,
}

function eventNames(events) {
  return events.map((event) => {
    if (event.type === 'action') return `action:${event.action}`
    if (event.type === 'pass') return `pass:${event.phase}`
    return event.type
  })
}

test('small deterministic steps emit one midpoint pass in each flight phase', () => {
  const timeline = createFlyingSwordTimeline(config)
  const events = []

  for (let step = 0; step < 9; step += 1) {
    assert.deepEqual(advanceFlyingSwordTimeline(timeline, 0.1), [])
  }
  const cooldownEvents = advanceFlyingSwordTimeline(timeline, 0.1)
  assert.deepEqual(eventNames(cooldownEvents), ['castStarted', 'action:hand_seal'])
  events.push(...cooldownEvents)

  for (let step = 10; step < 24; step += 1) {
    events.push(...advanceFlyingSwordTimeline(timeline, 0.1))
  }

  assert.deepEqual(eventNames(events), [
    'castStarted',
    'action:hand_seal',
    'pass:outbound',
    'pass:returning',
    'action:sword_ride',
    'finished',
  ])
  assert.equal(timeline.state, 'idle')
})

test('one large delta crosses every phase and resolves both passes exactly once', () => {
  const timeline = createFlyingSwordTimeline(config)
  const events = advanceFlyingSwordTimeline(timeline, 100)

  assert.deepEqual(eventNames(events), [
    'castStarted',
    'action:hand_seal',
    'pass:outbound',
    'pass:returning',
    'action:sword_ride',
    'finished',
  ])
  assert.equal(events.filter((event) => event.type === 'pass' && event.phase === 'outbound').length, 1)
  assert.equal(events.filter((event) => event.type === 'pass' && event.phase === 'returning').length, 1)
  assert.equal(timeline.cooldownRemaining, config.cooldown)
})

test('zero durations complete immediately without looping or dropping passes', () => {
  const timeline = createFlyingSwordTimeline({ cooldown: 0, handSealDuration: 0, flightDuration: 0 })
  const events = advanceFlyingSwordTimeline(timeline, 0)

  assert.deepEqual(eventNames(events), [
    'castStarted',
    'action:hand_seal',
    'pass:outbound',
    'pass:returning',
    'action:sword_ride',
    'finished',
  ])
  assert.equal(timeline.state, 'idle')
})

test('midpoint pass events do not repeat within a phase', () => {
  const timeline = createFlyingSwordTimeline({ cooldown: 0, handSealDuration: 0, flightDuration: 1 })
  advanceFlyingSwordTimeline(timeline, 0)

  const first = advanceFlyingSwordTimeline(timeline, 0.5)
  const repeated = [
    ...advanceFlyingSwordTimeline(timeline, 0),
    ...advanceFlyingSwordTimeline(timeline, 0.1),
    ...advanceFlyingSwordTimeline(timeline, 0.1),
  ]

  assert.deepEqual(eventNames(first), ['pass:outbound'])
  assert.deepEqual(repeated, [])
})

test('finish restores the configured cooldown and reset discards a partial cast', () => {
  const timeline = createFlyingSwordTimeline(config)
  advanceFlyingSwordTimeline(timeline, 100)

  assert.equal(timeline.state, 'idle')
  assert.equal(timeline.phaseElapsed, 0)
  assert.equal(timeline.cooldownRemaining, config.cooldown)

  advanceFlyingSwordTimeline(timeline, 1.1)
  assert.equal(timeline.state, 'handSeal')
  resetFlyingSwordTimeline(timeline)
  assert.equal(timeline.state, 'idle')
  assert.equal(timeline.phaseElapsed, 0)
  assert.equal(timeline.cooldownRemaining, config.cooldown)
})

test('negative delta is ignored', () => {
  const timeline = createFlyingSwordTimeline(config)
  assert.deepEqual(advanceFlyingSwordTimeline(timeline, -10), [])
  assert.equal(timeline.cooldownRemaining, config.cooldown)
})

test('flying sword path starts at the current player position and stays inside battle bounds', () => {
  assert.equal(typeof swordRuntime.createPlayerSwordPath, 'function')
  const path = swordRuntime.createPlayerSwordPath({ x: 40, y: 260 })
  assert.deepEqual(path, {
    from: { x: 68, y: 284 },
    to: { x: 330, y: -30 },
  })

  assert.deepEqual(swordRuntime.createPlayerSwordPath({ x: 500, y: 500 }), {
    from: { x: 100, y: 390 },
    to: { x: 330, y: -30 },
  })
  assert.deepEqual(swordRuntime.createPlayerSwordPath({ x: -500, y: -500 }), {
    from: { x: -300, y: -390 },
    to: { x: 260, y: -30 },
  })
})

test('flying sword can lock a nearby ground target when the player is high', () => {
  assert.deepEqual(
    swordRuntime.createPlayerSwordPath({ x: 180, y: 280 }, { x: 225, y: -42 }),
    {
      from: { x: 100, y: 304 },
      to: { x: 225, y: -42 },
    },
  )
})
