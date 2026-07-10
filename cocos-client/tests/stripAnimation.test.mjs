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

test('atlas png path maps to its Cocos Texture2D subresource', () => {
  assert.equal(
    resourcePathForPng('Assets/Combat/MistBamboo/moss-wolf-strip.png'),
    'Assets/Combat/MistBamboo/moss-wolf-strip/texture',
  )
})

test('existing texture paths are normalized without adding texture twice', () => {
  assert.equal(
    resourcePathForPng('Assets/Combat/QinglanSwordCultivator/action-strip/texture.png'),
    'Assets/Combat/QinglanSwordCultivator/action-strip/texture',
  )
  assert.equal(
    resourcePathForPng('Assets/Combat/QinglanSwordCultivator/action-strip/texture'),
    'Assets/Combat/QinglanSwordCultivator/action-strip/texture',
  )
})
