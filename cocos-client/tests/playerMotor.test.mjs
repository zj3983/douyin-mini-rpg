import test from 'node:test'
import assert from 'node:assert/strict'
import {
  computeBattleLayout,
} from '../assets/Scripts/Combat/BattleLayout.ts'
import {
  createPlayerMotor,
  lockPlayerAction,
  requestMove,
  setPlayerBounds,
  stepPlayerMotor,
  unlockPlayerAction,
} from '../assets/Scripts/Combat/PlayerMotor.ts'

const EPSILON = 1e-9
const PORTRAIT_VIEWPORTS = [
  { cssWidth: 360, cssHeight: 780 },
  { cssWidth: 390, cssHeight: 844 },
  { cssWidth: 430, cssHeight: 932 },
]

function assertFiniteTree(value) {
  if (typeof value === 'number') {
    assert.equal(Number.isFinite(value), true)
    return
  }
  if (!value || typeof value !== 'object') return
  for (const child of Object.values(value)) assertFiniteTree(child)
}

function assertDeepFrozen(value) {
  if (!value || typeof value !== 'object') return
  assert.equal(Object.isFrozen(value), true)
  for (const child of Object.values(value)) assertDeepFrozen(child)
}

function assertPointInside(point, bounds) {
  assert.ok(point.x >= bounds.minX && point.x <= bounds.maxX)
  assert.ok(point.y >= bounds.minY && point.y <= bounds.maxY)
}

test('portrait layouts are finite, safe, and deeply frozen', () => {
  for (const viewport of PORTRAIT_VIEWPORTS) {
    const layout = computeBattleLayout({ designWidth: 750, ...viewport, topInsetPx: 0, bottomInsetPx: 0 })
    const visibleMinY = -layout.visibleHeight / 2
    const visibleMaxY = layout.visibleHeight / 2

    assert.equal(layout.visibleHeight, Math.max(1334, 750 * viewport.cssHeight / viewport.cssWidth))
    assert.ok(layout.movement.minX < layout.movement.maxX)
    assert.ok(layout.movement.minY < layout.movement.maxY)
    assert.ok(layout.actorSafeRect.minX <= layout.movement.minX)
    assert.ok(layout.actorSafeRect.maxX >= layout.movement.maxX)
    assert.ok(layout.actorSafeRect.minY <= layout.movement.minY)
    assert.ok(layout.actorSafeRect.maxY >= layout.movement.maxY)
    assert.ok(layout.actorSafeRect.minX >= -375 && layout.actorSafeRect.maxX <= 375)
    assert.ok(layout.actorSafeRect.minY >= visibleMinY && layout.actorSafeRect.maxY <= visibleMaxY)
    assertPointInside(layout.bossSpawn, layout.actorSafeRect)
    assert.ok(layout.bossMaxVisualBounds.width > 0)
    assert.ok(layout.bossMaxVisualBounds.height > 0)
    assert.ok(layout.bossMaxVisualBounds.width <= layout.actorSafeRect.maxX - layout.actorSafeRect.minX)
    assert.ok(layout.bossMaxVisualBounds.height <= layout.actorSafeRect.maxY - layout.actorSafeRect.minY)
    assert.ok(layout.bossSpawn.x - layout.bossMaxVisualBounds.width / 2 >= layout.actorSafeRect.minX)
    assert.ok(layout.bossSpawn.x + layout.bossMaxVisualBounds.width / 2 <= layout.actorSafeRect.maxX)
    assert.ok(layout.bossSpawn.y - layout.bossMaxVisualBounds.height / 2 >= layout.actorSafeRect.minY)
    assert.ok(layout.bossSpawn.y + layout.bossMaxVisualBounds.height / 2 <= layout.actorSafeRect.maxY)
    assert.ok(layout.bossSpawn.x > 0)
    assertFiniteTree(layout)
    assertDeepFrozen(layout)
  }
})

test('390x844 layout covers both horizontal halves and keeps navigation below movement', () => {
  const layout = computeBattleLayout({
    designWidth: 750,
    cssWidth: 390,
    cssHeight: 844,
    topInsetPx: 0,
    bottomInsetPx: 0,
  })

  assert.ok(layout.movement.minX <= -300)
  assert.ok(layout.movement.maxX >= 300)
  assert.ok(layout.navigationTop < layout.movement.minY)
})

test('CSS safe insets shift top and bottom limits without stretching the viewport', () => {
  const base = computeBattleLayout({
    designWidth: 750,
    cssWidth: 390,
    cssHeight: 844,
    topInsetPx: 0,
    bottomInsetPx: 0,
  })
  const inset = computeBattleLayout({
    designWidth: 750,
    cssWidth: 390,
    cssHeight: 844,
    topInsetPx: 39,
    bottomInsetPx: 21,
  })

  assert.equal(inset.visibleHeight, base.visibleHeight)
  assert.equal(inset.actorSafeRect.minX, base.actorSafeRect.minX)
  assert.equal(inset.actorSafeRect.maxX, base.actorSafeRect.maxX)
  assert.ok(Math.abs(base.movement.maxY - inset.movement.maxY - 39 * 750 / 390) <= EPSILON)
  assert.ok(Math.abs(inset.navigationTop - base.navigationTop - 21 * 750 / 390) <= EPSILON)
  assert.ok(Math.abs(inset.movement.minY - base.movement.minY - 21 * 750 / 390) <= EPSILON)
})

test('malformed dimensions and insets never produce nonfinite layout output', () => {
  const malformed = [
    { designWidth: NaN, cssWidth: 0, cssHeight: -1, topInsetPx: Infinity, bottomInsetPx: NaN },
    { designWidth: Infinity, cssWidth: NaN, cssHeight: Infinity, topInsetPx: -20, bottomInsetPx: -30 },
    { designWidth: -750, cssWidth: -390, cssHeight: 0, topInsetPx: 1e100, bottomInsetPx: 1e100 },
  ]

  for (const input of malformed) {
    const first = computeBattleLayout(input)
    const second = computeBattleLayout(input)
    assert.deepEqual(first, second)
    assertFiniteTree(first)
    assert.ok(first.visibleHeight >= 1334)
    assert.ok(first.movement.minX < first.movement.maxX)
    assert.ok(first.movement.minY < first.movement.maxY)
  }
})

test('rapid target replacement advances from current position without teleporting', () => {
  const motor = createPlayerMotor({ x: 0, y: 0 }, 120)
  setPlayerBounds(motor, { minX: -300, maxX: 300, minY: -500, maxY: 500 })

  assert.equal(requestMove(motor, { x: 300, y: 0 }), true)
  const first = stepPlayerMotor(motor, 1 / 60)
  const beforeReplacement = motor.position
  assert.equal(requestMove(motor, { x: -300, y: 500 }), true)
  assert.deepEqual(motor.position, beforeReplacement)
  const second = stepPlayerMotor(motor, 1 / 60)

  assert.ok(first.distanceMoved <= 120 / 60 + EPSILON)
  assert.ok(second.distanceMoved <= 120 / 60 + EPSILON)
  assert.ok(Math.hypot(second.position.x - beforeReplacement.x, second.position.y - beforeReplacement.y) <= 120 / 60 + EPSILON)
  assert.notDeepEqual(second.position, motor.target)
})

test('near target arrives exactly without overshoot', () => {
  const motor = createPlayerMotor({ x: 4, y: -3 }, 220)
  assert.equal(requestMove(motor, { x: 6, y: -2 }), true)

  const frame = stepPlayerMotor(motor, 1 / 60)

  assert.deepEqual(frame.position, { x: 6, y: -2 })
  assert.equal(frame.distanceMoved, Math.hypot(2, 1))
  assert.equal(frame.arrived, true)
  assert.equal(motor.target, null)
})

test('quarter-second step equals fifteen 1/60 steps and larger deltas clamp', () => {
  const large = createPlayerMotor({ x: 0, y: 0 }, 240)
  const small = createPlayerMotor({ x: 0, y: 0 }, 240)
  const clamped = createPlayerMotor({ x: 0, y: 0 }, 240)
  for (const motor of [large, small, clamped]) requestMove(motor, { x: 1000, y: 700 })

  const largeFrame = stepPlayerMotor(large, 0.25)
  let smallDistance = 0
  for (let index = 0; index < 15; index += 1) smallDistance += stepPlayerMotor(small, 1 / 60).distanceMoved
  const clampedFrame = stepPlayerMotor(clamped, 1000)

  assert.ok(Math.hypot(large.position.x - small.position.x, large.position.y - small.position.y) <= EPSILON)
  assert.ok(Math.abs(largeFrame.distanceMoved - smallDistance) <= EPSILON)
  assert.deepEqual(clampedFrame.position, largeFrame.position)
  assert.equal(clampedFrame.distanceMoved, largeFrame.distanceMoved)
})

test('bounds updates clamp current position and target', () => {
  const motor = createPlayerMotor({ x: 80, y: -90 }, 120)
  requestMove(motor, { x: 500, y: 500 })

  setPlayerBounds(motor, { minX: -20, maxX: 30, minY: -40, maxY: 50 })

  assert.deepEqual(motor.position, { x: 30, y: -40 })
  assert.deepEqual(motor.target, { x: 30, y: 50 })
})

test('action lock and unlock preserve movement authority', () => {
  const motor = createPlayerMotor({ x: 2, y: 3 }, 120)
  setPlayerBounds(motor, { minX: -100, maxX: 100, minY: -100, maxY: 100 })
  requestMove(motor, { x: 90, y: -80 })
  const before = motor.snapshot()

  lockPlayerAction(motor, 'cast')
  assert.equal(motor.action, 'cast')
  lockPlayerAction(motor, 'hurt')
  assert.equal(motor.action, 'hurt')
  unlockPlayerAction(motor, 'hurt')
  assert.equal(motor.action, 'cast')
  unlockPlayerAction(motor, 'cast')
  assert.equal(motor.action, null)

  const after = motor.snapshot()
  assert.deepEqual(after.position, before.position)
  assert.deepEqual(after.target, before.target)
  assert.deepEqual(after.bounds, before.bounds)
  assert.equal(after.speed, before.speed)
})

test('snapshots are immutable and forged or spread motors are rejected', () => {
  const motor = createPlayerMotor({ x: 1, y: 2 }, 100)
  setPlayerBounds(motor, { minX: -10, maxX: 10, minY: -20, maxY: 20 })
  requestMove(motor, { x: 8, y: 9 })

  const position = motor.position
  const target = motor.target
  const bounds = motor.bounds
  const snapshot = motor.snapshot()
  assertDeepFrozen(position)
  assertDeepFrozen(target)
  assertDeepFrozen(bounds)
  assertDeepFrozen(snapshot)
  assert.throws(() => { position.x = 999 }, TypeError)
  assert.throws(() => { target.y = 999 }, TypeError)
  assert.deepEqual(motor.position, { x: 1, y: 2 })
  assert.deepEqual(motor.target, { x: 8, y: 9 })

  const spread = { ...motor }
  assert.throws(() => requestMove(spread, { x: 0, y: 0 }), TypeError)
  assert.throws(() => stepPlayerMotor({}, 1 / 60), TypeError)
})

test('invalid construction and mutation inputs are rejected without corrupting authority', () => {
  for (const spawn of [{ x: NaN, y: 0 }, { x: 0, y: Infinity }]) {
    assert.throws(() => createPlayerMotor(spawn, 100), /spawn/)
  }
  for (const speed of [0, -1, NaN, Infinity]) {
    assert.throws(() => createPlayerMotor({ x: 0, y: 0 }, speed), /speed/)
  }

  const motor = createPlayerMotor({ x: 0, y: 0 }, 100)
  assert.throws(() => setPlayerBounds(motor, { minX: 1, maxX: -1, minY: 0, maxY: 2 }), /bounds/)
  assert.equal(requestMove(motor, { x: NaN, y: 0 }), false)
  assert.equal(requestMove(motor, { x: 0, y: Infinity }), false)
  const before = motor.snapshot()
  for (const delta of [0, -1, NaN, Infinity]) {
    const frame = stepPlayerMotor(motor, delta)
    assert.deepEqual(frame.position, before.position)
    assert.equal(frame.distanceMoved, 0)
    assert.equal(frame.arrived, false)
  }
})

test('1000 alternating click targets remain finite and bounded', () => {
  const bounds = { minX: -320, maxX: 320, minY: -480, maxY: 440 }
  const motor = createPlayerMotor({ x: 0, y: 0 }, 220)
  setPlayerBounds(motor, bounds)

  for (let index = 0; index < 1000; index += 1) {
    const sign = index % 2 === 0 ? 1 : -1
    assert.equal(requestMove(motor, { x: sign * 1e9, y: -sign * 1e9 }), true)
    const frame = stepPlayerMotor(motor, 1 / 60)
    assertFiniteTree(frame)
    assertPointInside(frame.position, bounds)
    assertPointInside(motor.target, bounds)
    assert.ok(frame.distanceMoved <= 220 / 60 + EPSILON)
  }
})

test('opposite extreme finite coordinates remain stationary without numeric overflow', () => {
  const motor = createPlayerMotor({ x: -Number.MAX_VALUE, y: 0 }, 220)
  assert.equal(requestMove(motor, { x: Number.MAX_VALUE, y: 0 }), true)

  const frame = stepPlayerMotor(motor, 1 / 60)

  assertFiniteTree(frame)
  assert.deepEqual(frame.position, { x: -Number.MAX_VALUE, y: 0 })
  assert.equal(frame.distanceMoved, 0)
  assert.equal(frame.arrived, false)
})
