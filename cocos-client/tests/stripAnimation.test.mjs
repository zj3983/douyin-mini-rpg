import test from 'node:test'
import assert from 'node:assert/strict'
import { frameIndexAtTime, shouldAdvanceAnimation, resourcePathForPng } from '../tools/strip-animation-runtime.mjs'

test('strip animation frame index loops by elapsed time and fps', () => {
  assert.equal(frameIndexAtTime({ elapsed: 0, framesPerSecond: 8, frameCount: 4, loop: true }), 0)
  assert.equal(frameIndexAtTime({ elapsed: 0.13, framesPerSecond: 8, frameCount: 4, loop: true }), 1)
  assert.equal(frameIndexAtTime({ elapsed: 0.51, framesPerSecond: 8, frameCount: 4, loop: true }), 0)
})

test('non-loop strip animation clamps at last frame', () => {
  assert.equal(frameIndexAtTime({ elapsed: 5, framesPerSecond: 8, frameCount: 4, loop: false }), 3)
})

test('animation update can be culled or throttled for performance', () => {
  assert.equal(shouldAdvanceAnimation({ visible: false, distanceToCamera: 100, maxActiveDistance: 600, accumulatedTime: 1, updateInterval: 0.1 }), false)
  assert.equal(shouldAdvanceAnimation({ visible: true, distanceToCamera: 900, maxActiveDistance: 600, accumulatedTime: 1, updateInterval: 0.1 }), false)
  assert.equal(shouldAdvanceAnimation({ visible: true, distanceToCamera: 100, maxActiveDistance: 600, accumulatedTime: 0.05, updateInterval: 0.1 }), false)
  assert.equal(shouldAdvanceAnimation({ visible: true, distanceToCamera: 100, maxActiveDistance: 600, accumulatedTime: 0.12, updateInterval: 0.1 }), true)
})

test('png catalog path maps to Cocos resources path', () => {
  assert.equal(
    resourcePathForPng('Assets/Characters/QinglanSwordCultivator/Frames/idle.png'),
    'Assets/Characters/QinglanSwordCultivator/Frames/idle',
  )
})
