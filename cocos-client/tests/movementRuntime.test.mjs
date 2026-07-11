import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  advancePlayerControllerFrame,
  advancePlayerMovement,
  applyPlayerActionEvent,
  clampBattleTarget,
  createPlayerPresentationState,
  resetPlayerPresentationState,
  stepTowardTarget,
} from '../tools/movement-runtime.mjs'
import * as movementRuntime from '../tools/movement-runtime.mjs'

test('portrait target stays below HUD and above navigation', () => {
  assert.deepEqual(
    clampBattleTarget({ x: 999, y: -999 }, { minX: -300, maxX: 50, minY: -430, maxY: 410 }),
    { x: 50, y: -430 },
  )
})

test('repeated clicks update the target without teleporting', () => {
  const start = { x: -210, y: 0 }
  const firstTarget = { x: 20, y: 100 }
  const secondTarget = { x: -80, y: -120 }
  const expectedStep = 220 / 60
  const epsilon = 0.001
  const firstDistance = Math.hypot(firstTarget.x - start.x, firstTarget.y - start.y)
  const expectedFirst = {
    x: start.x + (firstTarget.x - start.x) / firstDistance * expectedStep,
    y: start.y + (firstTarget.y - start.y) / firstDistance * expectedStep,
  }
  const secondDistance = Math.hypot(secondTarget.x - expectedFirst.x, secondTarget.y - expectedFirst.y)
  const expectedSecond = {
    x: expectedFirst.x + (secondTarget.x - expectedFirst.x) / secondDistance * expectedStep,
    y: expectedFirst.y + (secondTarget.y - expectedFirst.y) / secondDistance * expectedStep,
  }
  const first = stepTowardTarget(start, firstTarget, 220, 1 / 60)
  const second = stepTowardTarget(first.position, secondTarget, 220, 1 / 60)
  assert.ok(Math.abs(first.distanceMoved - expectedStep) <= epsilon)
  assert.ok(Math.abs(second.distanceMoved - expectedStep) <= epsilon)
  assert.ok(Math.abs(first.position.x - expectedFirst.x) <= epsilon)
  assert.ok(Math.abs(first.position.y - expectedFirst.y) <= epsilon)
  assert.ok(Math.abs(second.position.x - expectedSecond.x) <= epsilon)
  assert.ok(Math.abs(second.position.y - expectedSecond.y) <= epsilon)
  assert.ok(
    Math.abs(Math.hypot(first.position.x - start.x, first.position.y - start.y) - first.distanceMoved) <= epsilon,
  )
  assert.ok(
    Math.abs(
      Math.hypot(second.position.x - first.position.x, second.position.y - first.position.y) - second.distanceMoved,
    ) <= epsilon,
  )
  assert.notDeepEqual(second.position, secondTarget)
})

test('target closer than one frame step arrives without overshooting', () => {
  const current = { x: 4, y: -3 }
  const target = { x: 6, y: -2 }
  const result = stepTowardTarget(current, target, 220, 1 / 60)
  assert.deepEqual(result.position, target)
  assert.equal(result.distanceMoved, Math.hypot(target.x - current.x, target.y - current.y))
  assert.equal(result.arrived, true)
})

test('already-reached target reports zero movement and arrival', () => {
  const current = { x: 12, y: -8 }
  assert.deepEqual(stepTowardTarget(current, current, 220, 1 / 60), {
    position: current,
    distanceMoved: 0,
    arrived: true,
  })
})

test('death stops movement input and retry restores the spawn position with no stale target', () => {
  assert.equal(typeof movementRuntime.createPlayerMovementState, 'function')
  const state = movementRuntime.createPlayerMovementState({ x: -210, y: -80 })

  assert.equal(movementRuntime.requestPlayerMovement(state, { x: 20, y: 160 }), true)
  assert.deepEqual(state.target, { x: 20, y: 160 })

  movementRuntime.stopPlayerMovement(state)
  assert.equal(state.movementEnabled, false)
  assert.equal(state.target, null)
  assert.equal(movementRuntime.requestPlayerMovement(state, { x: 40, y: 220 }), false)
  assert.equal(state.target, null)

  assert.deepEqual(movementRuntime.resetPlayerMovement(state), { x: -210, y: -80 })
  assert.equal(state.movementEnabled, true)
  assert.equal(state.target, null)
})

test('rapid target replacement changes only the target and advances from the current position', () => {
  const spawn = { x: -210, y: -80 }
  const state = movementRuntime.createPlayerMovementState(spawn)
  let current = { ...spawn }

  for (const target of [
    { x: 0, y: 300 },
    { x: 300, y: 0 },
    { x: 0, y: -300 },
    { x: -300, y: 0 },
  ]) {
    const currentBeforeRequest = { ...current }
    const spawnBeforeRequest = { ...state.spawnPosition }
    const stateBeforeRequest = { ...state, target: state.target && { ...state.target } }
    assert.equal(movementRuntime.requestPlayerMovement(state, target), true)
    assert.deepEqual(state.spawnPosition, spawnBeforeRequest)
    assert.deepEqual(current, currentBeforeRequest)
    assert.equal(state.movementEnabled, stateBeforeRequest.movementEnabled)
    assert.deepEqual(state.target, target)
    const frame = advancePlayerMovement(state, current, 220, 1 / 60)
    const displacement = { x: frame.position.x - current.x, y: frame.position.y - current.y }
    const latestDirection = { x: target.x - current.x, y: target.y - current.y }
    assert.ok(displacement.x * latestDirection.x + displacement.y * latestDirection.y > 0)
    assert.ok(Math.abs(frame.distanceMoved - 220 / 60) < 1e-9)
    assert.ok(Math.hypot(frame.position.x - current.x, frame.position.y - current.y) <= 220 / 60 + 1e-9)
    current = frame.position
  }
})

test('controller frame helper emits move only for displacement and sword ride once on arrival', () => {
  const movement = movementRuntime.createPlayerMovementState({ x: 0, y: 0 })
  const presentation = createPlayerPresentationState(11)
  movementRuntime.requestPlayerMovement(movement, { x: 2, y: 0 })

  const arrived = advancePlayerControllerFrame(movement, presentation, { x: 0, y: 0 }, 220, 0.2)
  assert.deepEqual(arrived.position, { x: 2, y: 0 })
  assert.equal(arrived.emitMove, true)
  assert.deepEqual(arrived.motionChanges, [true, false])
  assert.equal(arrived.action, 'sword_ride')
  assert.equal(arrived.arrived, true)

  const idle = advancePlayerControllerFrame(movement, presentation, arrived.position, 220, 0.2)
  assert.equal(idle.emitMove, false)
  assert.equal(idle.action, null)
  assert.equal(idle.arrived, false)
})

test('cast hit and death action events preserve position and movement target', () => {
  const movement = movementRuntime.createPlayerMovementState({ x: -10, y: 5 })
  const current = { x: 3, y: 4 }
  movementRuntime.requestPlayerMovement(movement, { x: 80, y: -20 })

  for (const action of ['hand_seal', 'flying_sword_cast', 'hurt', 'death']) {
    const presentation = createPlayerPresentationState(7)
    const before = structuredClone({ movement, current })
    const decision = applyPlayerActionEvent(movement, presentation, current, action)
    assert.deepEqual({ movement, current }, before)
    assert.deepEqual(decision.position, current)
    assert.deepEqual(decision.target, { x: 80, y: -20 })
    assert.equal(decision.action, action)
    assert.equal(decision.emitMove, false)
  }
})

test('arrival cannot override locked hand seal cast hurt or death actions', () => {
  for (const action of ['hand_seal', 'flying_sword_cast', 'hurt', 'death']) {
    const movement = movementRuntime.createPlayerMovementState({ x: 0, y: 0 })
    const presentation = createPlayerPresentationState(0)
    movementRuntime.requestPlayerMovement(movement, { x: 2, y: 0 })
    const actionDecision = applyPlayerActionEvent(movement, presentation, { x: 0, y: 0 }, action)
    assert.equal(actionDecision.action, action)
    assert.equal(actionDecision.emitAction, true)

    const arrival = advancePlayerControllerFrame(movement, presentation, { x: 0, y: 0 }, 220, 1 / 60)
    assert.equal(arrival.arrived, true)
    assert.equal(arrival.action, null)

    const afterLock = advancePlayerControllerFrame(
      movement,
      presentation,
      arrival.position,
      220,
      action === 'death' ? 10 : 0.3,
    )
    assert.equal(afterLock.action, action === 'death' ? null : 'sword_ride')
  }
})

test('death outranks hurt and cast while active', () => {
  const movement = movementRuntime.createPlayerMovementState({ x: 0, y: 0 })
  const presentation = createPlayerPresentationState(0)
  const current = { x: 0, y: 0 }
  assert.equal(applyPlayerActionEvent(movement, presentation, current, 'hand_seal').action, 'hand_seal')
  assert.equal(applyPlayerActionEvent(movement, presentation, current, 'hurt').action, 'hurt')
  assert.equal(applyPlayerActionEvent(movement, presentation, current, 'death').action, 'death')
  const rejected = applyPlayerActionEvent(movement, presentation, current, 'flying_sword_cast')
  assert.equal(rejected.action, 'death')
  assert.equal(rejected.emitAction, false)
})

test('presentation reset clears death lock and preserves hover base', () => {
  const movement = movementRuntime.createPlayerMovementState({ x: 0, y: 0 })
  const presentation = createPlayerPresentationState(19)
  applyPlayerActionEvent(movement, presentation, { x: 0, y: 0 }, 'death')
  resetPlayerPresentationState(presentation)
  const idle = applyPlayerActionEvent(movement, presentation, { x: 0, y: 0 }, 'sword_ride')

  assert.equal(idle.emitAction, true)
  assert.equal(idle.action, 'sword_ride')
  assert.equal(presentation.hoverBaseY, 19)
  assert.equal(presentation.actionLockRemaining, 0)
})

test('hover output is absolute from a stable base and never accumulates', () => {
  const movement = movementRuntime.createPlayerMovementState({ x: 0, y: 0 })
  const presentation = createPlayerPresentationState(20)
  const first = advancePlayerControllerFrame(movement, presentation, { x: 0, y: 0 }, 220, 0.125)
  const second = advancePlayerControllerFrame(movement, presentation, { x: 0, y: 0 }, 220, 0.125)
  const fresh = createPlayerPresentationState(20)
  const combined = advancePlayerControllerFrame(movementRuntime.createPlayerMovementState({ x: 0, y: 0 }), fresh, { x: 0, y: 0 }, 220, 0.25)

  assert.equal(first.hoverY, 20 + Math.sin(0.5) * 2)
  assert.equal(second.hoverY, combined.hoverY)
  assert.ok(second.hoverY >= 18 && second.hoverY <= 22)
})

test('one large update matches deterministic bounded substeps', () => {
  const target = { x: 80, y: 150 }
  const largeState = movementRuntime.createPlayerMovementState({ x: 0, y: 0 })
  const smallState = movementRuntime.createPlayerMovementState({ x: 0, y: 0 })
  movementRuntime.requestPlayerMovement(largeState, target)
  movementRuntime.requestPlayerMovement(smallState, target)

  const large = advancePlayerMovement(largeState, { x: 0, y: 0 }, 220, 0.2)
  let small = { position: { x: 0, y: 0 } }
  for (let index = 0; index < 12; index += 1) {
    small = advancePlayerMovement(smallState, small.position, 220, 1 / 60)
  }

  assert.ok(large.substeps <= 12)
  assert.ok(Math.hypot(large.position.x - small.position.x, large.position.y - small.position.y) < 1e-9)
  assert.ok(large.distanceMoved <= 220 * 0.2 + 1e-9)
})

test('extreme finite delta is clamped to bounded real-time movement work', () => {
  const state = movementRuntime.createPlayerMovementState({ x: 0, y: 0 })
  movementRuntime.requestPlayerMovement(state, { x: 1e9, y: 0 })
  const frame = advancePlayerMovement(state, { x: 0, y: 0 }, 220, 1e12)

  assert.ok(frame.substeps <= 15)
  assert.ok(frame.distanceMoved <= 220 * 0.25 + 1e-9)
  assert.equal(Number.isFinite(frame.position.x) && Number.isFinite(frame.position.y), true)
  assert.deepEqual(state.target, { x: 1e9, y: 0 })
})

test('invalid delta time and coordinates produce finite stationary output', () => {
  const state = movementRuntime.createPlayerMovementState({ x: 1, y: 2 })
  movementRuntime.requestPlayerMovement(state, { x: 20, y: 30 })
  for (const deltaTime of [-1, NaN, Infinity]) {
    const frame = advancePlayerMovement(state, { x: 1, y: 2 }, 220, deltaTime)
    assert.deepEqual(frame.position, { x: 1, y: 2 })
    assert.equal(frame.distanceMoved, 0)
    assert.equal(Number.isFinite(frame.position.x) && Number.isFinite(frame.position.y), true)
  }
  const invalidCurrent = advancePlayerMovement(state, { x: NaN, y: Infinity }, 220, 1 / 60)
  assert.deepEqual(invalidCurrent.position, { x: 0, y: 0 })
})

test('arrival clears the target exactly once without overshoot', () => {
  const state = movementRuntime.createPlayerMovementState({ x: 0, y: 0 })
  movementRuntime.requestPlayerMovement(state, { x: 2, y: 0 })
  const arrived = advancePlayerMovement(state, { x: 0, y: 0 }, 220, 0.2)
  assert.deepEqual(arrived.position, { x: 2, y: 0 })
  assert.equal(arrived.arrived, true)
  assert.equal(state.target, null)
  const idle = advancePlayerMovement(state, arrived.position, 220, 0.2)
  assert.equal(idle.arrived, false)
  assert.equal(idle.distanceMoved, 0)
})

test('TypeScript and mjs movement runtimes expose matching behavior bodies', async () => {
  const ts = readFileSync(resolve('assets/Scripts/Core/MovementRuntime.ts'), 'utf8')
  for (const name of ['requestPlayerMovement', 'stepTowardTarget', 'advancePlayerMovement', 'advancePlayerControllerFrame', 'applyPlayerActionEvent']) {
    assert.equal(typeof movementRuntime[name], 'function')
    assert.match(ts, new RegExp(`export function ${name}\\(`))
  }
  for (const marker of ['MAX_MOVEMENT_SUBSTEP = 1 / 60', 'MAX_MOVEMENT_FRAME_DELTA = 0.25', 'Number.isFinite', 'state.target = null']) {
    assert.equal(readFileSync(resolve('tools/movement-runtime.mjs'), 'utf8').includes(marker), true)
    assert.equal(ts.includes(marker), true)
  }

  const tsRuntime = await import('../assets/Scripts/Core/MovementRuntime.ts')
  const parityResults = []
  for (const runtime of [movementRuntime, tsRuntime]) {
    const state = runtime.createPlayerMovementState({ x: -5, y: 2 })
    runtime.requestPlayerMovement(state, { x: 60, y: 90 })
    const first = runtime.advancePlayerMovement(state, { x: -5, y: 2 }, 220, 0.2)
    runtime.requestPlayerMovement(state, { x: -40, y: -20 })
    const second = runtime.advancePlayerMovement(state, first.position, 220, 1 / 60)
    const extremeState = runtime.createPlayerMovementState({ x: 0, y: 0 })
    runtime.requestPlayerMovement(extremeState, { x: 1e9, y: 0 })
    const extreme = runtime.advancePlayerMovement(extremeState, { x: 0, y: 0 }, 220, 1e12)
    const actionMovement = runtime.createPlayerMovementState({ x: 0, y: 0 })
    const presentation = runtime.createPlayerPresentationState(4)
    runtime.requestPlayerMovement(actionMovement, { x: 2, y: 0 })
    const cast = runtime.applyPlayerActionEvent(actionMovement, presentation, { x: 0, y: 0 }, 'hand_seal')
    const arrival = runtime.advancePlayerControllerFrame(actionMovement, presentation, { x: 0, y: 0 }, 220, 1 / 60)
    const unlocked = runtime.advancePlayerControllerFrame(actionMovement, presentation, arrival.position, 220, 0.3)
    parityResults.push({ first, second, state, extreme, extremeState, cast, arrival, unlocked, presentation })
  }
  assert.deepEqual(parityResults[1], parityResults[0])
})
