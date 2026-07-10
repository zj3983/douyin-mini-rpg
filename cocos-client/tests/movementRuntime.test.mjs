import test from 'node:test'
import assert from 'node:assert/strict'
import { clampBattleTarget, stepTowardTarget } from '../tools/movement-runtime.mjs'
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
