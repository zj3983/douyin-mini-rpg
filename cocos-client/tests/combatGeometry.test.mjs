import test from 'node:test'
import assert from 'node:assert/strict'
import {
  angleDiff,
  clampVecToBounds,
  distancePointToSegment,
  pointInFan,
  pointInRingBand,
  vecNormalize,
} from '../assets/Scripts/Core/Battle/Geometry.ts'

test('clampVecToBounds confines targets to the safe battle area', () => {
  const bounds = { minX: -330, maxX: 330, minY: -420, maxY: 460 }
  assert.deepEqual(clampVecToBounds({ x: 999, y: -999 }, bounds), { x: 330, y: -420 })
})

test('angleDiff wraps into [-PI, PI]', () => {
  assert.ok(Math.abs(angleDiff(Math.PI - 0.1, -Math.PI + 0.1) + 0.2) < 1e-9)
})

test('vecNormalize of a zero vector falls back to unit-x', () => {
  assert.deepEqual(vecNormalize({ x: 0, y: 0 }), { x: 1, y: 0 })
})

test('distancePointToSegment measures perpendicular distance and clamps ends', () => {
  assert.equal(distancePointToSegment({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 }), 5)
  assert.equal(distancePointToSegment({ x: -4, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 }), 5)
})

test('pointInFan respects radius and half angle', () => {
  const fan = { origin: { x: 0, y: 0 }, directionRadians: 0, radius: 100, halfAngleRadians: Math.PI / 4 }
  assert.equal(pointInFan({ x: 80, y: 0 }, fan), true)
  assert.equal(pointInFan({ x: 60, y: 60 }, fan), false)
  assert.equal(pointInFan({ x: 140, y: 0 }, fan), false)
})

test('pointInRingBand hits the band but never the safe gap', () => {
  const ring = { center: { x: 0, y: 0 }, innerRadius: 90, outerRadius: 110, gapCenterRadians: 0, gapHalfAngleRadians: 0.5 }
  assert.equal(pointInRingBand({ x: 0, y: 100 }, ring), true)
  assert.equal(pointInRingBand({ x: 100, y: 0 }, ring), false)
  assert.equal(pointInRingBand({ x: 0, y: 50 }, ring), false)
})
