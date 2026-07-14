import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BATTLE_DESIGN_WIDTH,
  BATTLE_NAVIGATION_HEIGHT,
  BATTLE_TOP_HUD_RESERVE,
  computeBattleLayout,
  PLAYER_DISPLAY_SCALE,
  PLAYER_FRAME_HEIGHT,
  PLAYER_FRAME_WIDTH,
} from '../assets/Scripts/Combat/BattleLayout.ts'
import {
  createPlayerMotor,
  completePlayerAction,
  PLAYER_COORDINATE_LIMIT,
  requestMove,
  requestMoveInCoordinateSpace,
  requestPlayerAction,
  resetPlayerMotor,
  setPlayerBounds,
  setPlayerFallbackAction,
  stepPlayerMotor,
  stopPlayerMotor,
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

test('displayed player frame remains fully inside actor-safe bounds on supported phones', () => {
  const insets = [
    { topInsetPx: 24, bottomInsetPx: 18 },
    { topInsetPx: 47, bottomInsetPx: 34 },
    { topInsetPx: 59, bottomInsetPx: 36 },
  ]
  const halfWidth = PLAYER_FRAME_WIDTH * PLAYER_DISPLAY_SCALE / 2
  const halfHeight = PLAYER_FRAME_HEIGHT * PLAYER_DISPLAY_SCALE / 2

  PORTRAIT_VIEWPORTS.forEach((viewport, index) => {
    const layout = computeBattleLayout({ designWidth: BATTLE_DESIGN_WIDTH, ...viewport, ...insets[index] })
    assert.ok(layout.movement.minX <= -300)
    assert.ok(layout.movement.maxX >= 300)
    assert.ok(layout.movement.minX - halfWidth >= layout.actorSafeRect.minX - EPSILON)
    assert.ok(layout.movement.maxX + halfWidth <= layout.actorSafeRect.maxX + EPSILON)
    assert.ok(layout.movement.minY - halfHeight >= layout.actorSafeRect.minY - EPSILON)
    assert.ok(layout.movement.maxY + halfHeight <= layout.actorSafeRect.maxY + EPSILON)
    assert.ok(layout.movement.minY - halfHeight >= layout.navigationTop - EPSILON)
  })
})

test('layout exports the shared HUD navigation and actor sizing constants', () => {
  assert.equal(BATTLE_DESIGN_WIDTH, 750)
  assert.equal(BATTLE_NAVIGATION_HEIGHT, 104)
  assert.equal(BATTLE_TOP_HUD_RESERVE, 210)
  assert.equal(PLAYER_FRAME_WIDTH / PLAYER_FRAME_HEIGHT, 320 / 512)
  assert.ok(PLAYER_FRAME_WIDTH * PLAYER_DISPLAY_SCALE <= 150)
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

test('extreme finite design width keeps scaled layout rectangles ordered', () => {
  const layout = computeBattleLayout({
    designWidth: 3000,
    cssWidth: 3000,
    cssHeight: 1,
    topInsetPx: 0,
    bottomInsetPx: 0,
  })

  assert.equal(layout.visibleHeight, 3000 * 1334 / 750)
  for (const rect of [layout.actorSafeRect, layout.movement]) {
    assert.ok(rect.minX <= rect.maxX)
    assert.ok(rect.minY <= rect.maxY)
    assert.ok(rect.maxX - rect.minX > 0)
    assert.ok(rect.maxY - rect.minY > 0)
  }
})

test('narrow design width preserves the absolute battle height floor', () => {
  const layout = computeBattleLayout({
    designWidth: 375,
    cssWidth: 375,
    cssHeight: 1,
    topInsetPx: 0,
    bottomInsetPx: 0,
  })

  assert.equal(layout.visibleHeight, 1334)
  assert.ok(layout.actorSafeRect.minY < layout.actorSafeRect.maxY)
  assert.ok(layout.movement.minY < layout.movement.maxY)
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

test('idle motor frames and snapshots reuse frozen references until authority changes', () => {
  const motor = createPlayerMotor({ x: 0, y: 0 }, 120)

  const firstFrame = stepPlayerMotor(motor, 0)
  const firstSnapshot = motor.snapshot()
  assert.strictEqual(stepPlayerMotor(motor, -1), firstFrame)
  assert.strictEqual(stepPlayerMotor(motor, NaN), firstFrame)
  assert.strictEqual(motor.snapshot(), firstSnapshot)

  requestMove(motor, { x: 20, y: 0 })
  const targetedFrame = stepPlayerMotor(motor, 0)
  const targetedSnapshot = motor.snapshot()
  assert.notStrictEqual(targetedFrame, firstFrame)
  assert.notStrictEqual(targetedSnapshot, firstSnapshot)
  assert.strictEqual(stepPlayerMotor(motor, Infinity), targetedFrame)
  assert.strictEqual(motor.snapshot(), targetedSnapshot)

  const movedFrame = stepPlayerMotor(motor, 1 / 60)
  assert.notStrictEqual(movedFrame, targetedFrame)
  const movedSnapshot = motor.snapshot()
  assert.notStrictEqual(movedSnapshot, targetedSnapshot)

  setPlayerBounds(motor, { minX: -10, maxX: 10, minY: -10, maxY: 10 })
  assert.notStrictEqual(stepPlayerMotor(motor, 0), movedFrame)
  assert.notStrictEqual(motor.snapshot(), movedSnapshot)
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

test('action tokens preserve movement authority while priorities arbitrate', () => {
  const motor = createPlayerMotor({ x: 2, y: 3 }, 120)
  setPlayerBounds(motor, { minX: -100, maxX: 100, minY: -100, maxY: 100 })
  requestMove(motor, { x: 90, y: -80 })
  const before = motor.snapshot()

  const cast = requestPlayerAction(motor, 'hand_seal', 'skill-a')
  assert.ok(cast.token)
  assert.equal(motor.action, 'cast')
  const hurt = requestPlayerAction(motor, 'hurt', 'damage-a')
  assert.ok(hurt.token)
  assert.equal(motor.action, 'hurt')
  unlockPlayerAction(motor, hurt.token)
  assert.equal(motor.action, 'cast')
  unlockPlayerAction(motor, cast.token)
  assert.equal(motor.action, null)

  const after = motor.snapshot()
  assert.deepEqual(after.position, before.position)
  assert.deepEqual(after.target, before.target)
  assert.deepEqual(after.bounds, before.bounds)
  assert.equal(after.speed, before.speed)
})

test('cast arrival keeps cast active and falls back to sword ride after unlock', () => {
  const motor = createPlayerMotor({ x: 0, y: 0 }, 220)
  requestMove(motor, { x: 2, y: 0 })
  const cast = requestPlayerAction(motor, 'hand_seal', 'flying-sword')

  const arrival = stepPlayerMotor(motor, 1 / 60)
  const pending = setPlayerFallbackAction(motor, 'sword_ride')

  assert.equal(arrival.arrived, true)
  assert.equal(pending.action, 'hand_seal')
  assert.equal(pending.changed, false)
  const released = unlockPlayerAction(motor, cast.token)
  assert.equal(released.unlocked, true)
  assert.equal(released.action, 'sword_ride')
  assert.equal(released.changed, true)
})

test('cast completion preserves moving fallback across later movement frames', () => {
  const motor = createPlayerMotor({ x: 0, y: 0 }, 120)
  setPlayerFallbackAction(motor, 'move')
  requestMove(motor, { x: 100, y: 0 })
  const cast = requestPlayerAction(motor, 'flying_sword_cast', 'flying-sword')

  assert.equal(stepPlayerMotor(motor, 1 / 60).distanceMoved, 2)
  const completed = completePlayerAction(motor, cast.token)
  assert.equal(completed.action, 'move')
  assert.equal(motor.presentationAction, 'move')

  assert.equal(stepPlayerMotor(motor, 1 / 60).distanceMoved, 2)
  assert.equal(motor.presentationAction, 'move')
  const stale = completePlayerAction(motor, cast.token)
  assert.equal(stale.unlocked, false)
  assert.equal(stale.action, 'move')
})

test('hurt completion restores fallback while death and overlapping cast retain priority', () => {
  const motor = createPlayerMotor({ x: 0, y: 0 }, 120)
  setPlayerFallbackAction(motor, 'move')

  const firstHurt = requestPlayerAction(motor, 'hurt', 'battle-runtime-hurt')
  assert.equal(motor.presentationAction, 'hurt')
  assert.equal(completePlayerAction(motor, firstHurt.token).action, 'move')

  const cast = requestPlayerAction(motor, 'hand_seal', 'flying-sword')
  const overlappingHurt = requestPlayerAction(motor, 'hurt', 'battle-runtime-hurt')
  assert.equal(completePlayerAction(motor, overlappingHurt.token).action, 'hand_seal')
  assert.equal(completePlayerAction(motor, cast.token).action, 'move')

  const lethalHurt = requestPlayerAction(motor, 'hurt', 'battle-runtime-hurt')
  requestPlayerAction(motor, 'death', 'battle-runtime')
  assert.equal(completePlayerAction(motor, lethalHurt.token).action, 'death')
  assert.equal(motor.presentationAction, 'death')
})

test('overlapping cast and hurt restore the next priority before fallback', () => {
  const motor = createPlayerMotor({ x: 0, y: 0 }, 220)
  const cast = requestPlayerAction(motor, 'flying_sword_cast', 'skill')
  const hurt = requestPlayerAction(motor, 'hurt', 'damage')
  assert.equal(motor.presentationAction, 'hurt')

  const hurtReleased = unlockPlayerAction(motor, hurt.token)
  assert.equal(hurtReleased.action, 'flying_sword_cast')
  assert.equal(motor.action, 'cast')
  const castReleased = unlockPlayerAction(motor, cast.token)
  assert.equal(castReleased.action, 'sword_ride')
  assert.equal(motor.action, null)
})

test('death outranks all actions and cannot auto-unlock', () => {
  const motor = createPlayerMotor({ x: 0, y: 0 }, 220)
  const death = requestPlayerAction(motor, 'death', 'battle-runtime')
  requestPlayerAction(motor, 'hurt', 'damage')
  requestPlayerAction(motor, 'hand_seal', 'skill')
  assert.equal(motor.presentationAction, 'death')

  const release = unlockPlayerAction(motor, death.token)
  assert.equal(release.unlocked, false)
  assert.equal(release.action, 'death')
  assert.equal(motor.action, 'death')
})

test('stale owner tokens cannot unlock replacement actions', () => {
  const motor = createPlayerMotor({ x: 0, y: 0 }, 220)
  const first = requestPlayerAction(motor, 'hand_seal', 'skill')
  const replacement = requestPlayerAction(motor, 'flying_sword_cast', 'skill')

  const stale = unlockPlayerAction(motor, first.token)
  assert.equal(stale.unlocked, false)
  assert.equal(stale.action, 'flying_sword_cast')
  const current = unlockPlayerAction(motor, replacement.token)
  assert.equal(current.unlocked, true)
  assert.equal(current.action, 'sword_ride')
})

test('resize clamps active movement immediately without disturbing action locks', () => {
  const motor = createPlayerMotor({ x: 80, y: -90 }, 120)
  setPlayerBounds(motor, { minX: -100, maxX: 100, minY: -100, maxY: 100 })
  requestMove(motor, { x: 95, y: 95 })
  stepPlayerMotor(motor, 1 / 60)
  const cast = requestPlayerAction(motor, 'hand_seal', 'skill')

  setPlayerBounds(motor, { minX: -20, maxX: 30, minY: -40, maxY: 50 })

  assert.deepEqual(motor.position, { x: 30, y: -40 })
  assert.deepEqual(motor.target, { x: 30, y: 50 })
  assert.equal(motor.presentationAction, 'hand_seal')
  assert.equal(unlockPlayerAction(motor, cast.token).action, 'sword_ride')
})

test('transformed coordinate adapter requests movement in the shared actor space', () => {
  const motor = createPlayerMotor({ x: 0, y: 0 }, 220)
  setPlayerBounds(motor, { minX: -300, maxX: 300, minY: -500, maxY: 500 })

  const requested = requestMoveInCoordinateSpace(motor, { x: 710, y: 920 }, (point) => ({
    x: (point.x - 110) / 2,
    y: (point.y - 120) / 2,
  }))

  assert.equal(requested, true)
  assert.deepEqual(motor.position, { x: 0, y: 0 })
  assert.deepEqual(motor.target, { x: 300, y: 400 })
})

test('stop and reset keep movement enabled state inside motor authority', () => {
  const motor = createPlayerMotor({ x: -20, y: 10 }, 220)
  requestMove(motor, { x: 100, y: 100 })
  stepPlayerMotor(motor, 1 / 60)

  stopPlayerMotor(motor)
  assert.equal(motor.enabled, false)
  assert.equal(motor.target, null)
  assert.equal(requestMove(motor, { x: 30, y: 30 }), false)

  resetPlayerMotor(motor)
  assert.equal(motor.enabled, true)
  assert.deepEqual(motor.position, { x: -20, y: 10 })
  assert.equal(motor.target, null)
  assert.equal(motor.presentationAction, 'sword_ride')
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
    assert.equal(requestMove(motor, { x: sign * PLAYER_COORDINATE_LIMIT, y: -sign * PLAYER_COORDINATE_LIMIT }), true)
    const frame = stepPlayerMotor(motor, 1 / 60)
    assertFiniteTree(frame)
    assertPointInside(frame.position, bounds)
    assertPointInside(motor.target, bounds)
    assert.ok(frame.distanceMoved <= 220 / 60 + EPSILON)
  }
})

test('coordinate magnitude limit accepts boundaries and rejects larger finite values', () => {
  const boundary = createPlayerMotor({ x: -PLAYER_COORDINATE_LIMIT, y: PLAYER_COORDINATE_LIMIT }, 220)
  assert.equal(requestMove(boundary, { x: PLAYER_COORDINATE_LIMIT, y: -PLAYER_COORDINATE_LIMIT }), true)
  assertFiniteTree(stepPlayerMotor(boundary, 1 / 60))

  assert.throws(
    () => createPlayerMotor({ x: PLAYER_COORDINATE_LIMIT + 1, y: 0 }, 220),
    /supported coordinate magnitude/,
  )
  assert.equal(requestMove(boundary, { x: PLAYER_COORDINATE_LIMIT + 1, y: 0 }), false)
  assert.throws(
    () => setPlayerBounds(boundary, {
      minX: -PLAYER_COORDINATE_LIMIT - 1,
      maxX: 0,
      minY: 0,
      maxY: 1,
    }),
    /supported coordinate magnitude/,
  )
})
