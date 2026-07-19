import test from 'node:test'
import assert from 'node:assert/strict'
import { createPlayerMotor, setMoveTarget, tickPlayerMotor } from '../assets/Scripts/Core/Battle/PlayerMotor.ts'

const config = {
  bounds: { minX: -330, maxX: 330, minY: -420, maxY: 460 },
  speed: 280,
  spawn: { x: -260, y: -80 },
  maxHp: 260,
  radius: 24,
}

test('tap target is clamped to full-screen safe bounds, not the old left half', () => {
  const motor = createPlayerMotor(config)
  assert.equal(setMoveTarget(motor, { x: 999, y: 999 }), true)
  assert.deepEqual(motor.target, { x: 330, y: 460 })
  assert.equal(setMoveTarget(motor, { x: 250, y: 100 }), true)
  assert.deepEqual(motor.target, { x: 250, y: 100 })
})

test('repeated taps update the target without teleporting or resetting position', () => {
  const motor = createPlayerMotor(config)
  setMoveTarget(motor, { x: 200, y: 100 })
  tickPlayerMotor(motor, 1 / 60)
  const afterFirst = { ...motor.position }
  assert.ok(afterFirst.x > -260 && afterFirst.x < -255)
  setMoveTarget(motor, { x: -300, y: -200 })
  tickPlayerMotor(motor, 1 / 60)
  const delta = Math.hypot(motor.position.x - afterFirst.x, motor.position.y - afterFirst.y)
  assert.ok(delta <= 280 / 60 + 1e-6)
})

test('non-finite targets and deltas are rejected, keeping the last valid state', () => {
  const motor = createPlayerMotor(config)
  assert.equal(setMoveTarget(motor, { x: Number.NaN, y: 0 }), false)
  assert.equal(motor.target, null)
  setMoveTarget(motor, { x: 100, y: 0 })
  const before = { ...motor.position }
  tickPlayerMotor(motor, Number.NaN)
  assert.deepEqual(motor.position, before)
})

test('movement arrives and stops; hp fields are initialised', () => {
  const motor = createPlayerMotor(config)
  setMoveTarget(motor, { x: -258, y: -80 })
  const result = tickPlayerMotor(motor, 1 / 60)
  assert.equal(result.arrived, true)
  assert.equal(motor.target, null)
  assert.equal(motor.hp, 260)
  assert.equal(motor.alive, true)
})
