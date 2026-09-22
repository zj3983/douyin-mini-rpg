import test from 'node:test'
import assert from 'node:assert/strict'
import { createArtifactState, tickArtifact } from '../assets/Scripts/Core/Battle/ArtifactRuntime.ts'

const config = {
  damage: 55, speed: 900, width: 30, pierce: 3, outboundDistance: 160,
  curveHeight: 90, cooldownSeconds: 0.9, returnArriveRadius: 28,
}
const owner = { x: -260, y: -80 }
const makeTargets = () => [
  { id: 1, position: { x: -60, y: -80 }, radius: 26, alive: true },
  { id: 2, position: { x: 60, y: -80 }, radius: 26, alive: true },
  { id: 3, position: { x: 180, y: -80 }, radius: 26, alive: true },
  { id: 4, position: { x: 500, y: 300 }, radius: 26, alive: true },
]

test('sword auto-fires at the nearest target when the cooldown is ready', () => {
  const state = createArtifactState()
  let fired = false
  for (let tick = 0; tick < 120 && !fired; tick += 1) {
    fired = tickArtifact(state, config, { owner, targets: makeTargets(), deltaTime: 1 / 60 }).fired
  }
  assert.equal(fired, true)
  assert.ok(state.sword)
})

test('outbound path is curved, pierces, and each pass hits a target at most once', () => {
  const state = createArtifactState()
  const targets = makeTargets()
  const allHits = []
  let minY = Infinity
  let maxY = -Infinity
  for (let tick = 0; tick < 600 && !state.sword; tick += 1) {
    tickArtifact(state, config, { owner, targets, deltaTime: 1 / 60 })
  }
  for (let tick = 0; tick < 600 && state.sword; tick += 1) {
    const result = tickArtifact(state, config, { owner, targets, deltaTime: 1 / 60 })
    allHits.push(...result.hits)
    if (state.sword) {
      minY = Math.min(minY, state.sword.position.y)
      maxY = Math.max(maxY, state.sword.position.y)
    }
  }
  assert.ok(maxY - minY > 40, 'path must bend, not be a straight line')
  assert.equal(allHits.filter((hit) => hit.targetId === 1).length <= 2, true)
  assert.ok(allHits.length >= 3, 'outbound + return passes should pierce several targets')
  assert.ok(allHits.every((hit) => hit.targetId !== 4), 'pierce cap keeps the far target unhit')
})

test('sword returns to a moving owner and restarts the cooldown', () => {
  const state = createArtifactState()
  const targets = makeTargets()
  const movingOwner = { ...owner }
  tickArtifact(state, config, { owner: movingOwner, targets, deltaTime: 1 / 60 })
  let returned = false
  for (let tick = 0; tick < 600 && !returned; tick += 1) {
    movingOwner.x -= 1
    returned = tickArtifact(state, config, { owner: movingOwner, targets, deltaTime: 1 / 60 }).returnedToOwner
  }
  assert.equal(returned, true)
  assert.equal(state.sword, null)
  assert.ok(state.cooldownRemaining > 0)
})

test('no targets means no firing', () => {
  const state = createArtifactState()
  const result = tickArtifact(state, config, { owner, targets: [], deltaTime: 1 / 60 })
  assert.equal(result.fired, false)
  assert.equal(state.sword, null)
})
