import test from 'node:test'
import assert from 'node:assert/strict'

import { actorRenderScaleForHeight, battleGroundY, heroScreenXForWidth } from '../src/combatLayout.ts'

test('mobile battle canvas keeps the full cultivator visible above the ground line', () => {
  const height = 225
  const scale = actorRenderScaleForHeight(height)
  const groundY = battleGroundY(height)
  const actionSheetHeight = 308
  const drawOffset = 13
  const spriteTop = groundY - actionSheetHeight * scale + drawOffset * scale
  const swordBottom = groundY + 22 * scale

  assert.equal(scale, 0.58)
  assert.equal(Math.round(groundY), 191)
  assert.equal(spriteTop >= 20, true)
  assert.equal(swordBottom <= height - 8, true)
})

test('tall battle canvas keeps the previous spacious side-view composition', () => {
  assert.equal(actorRenderScaleForHeight(720), 1)
  assert.equal(battleGroundY(720), 518.4)
})

test('hero screen x stays left-biased without hugging the edge', () => {
  assert.equal(heroScreenXForWidth(390), 148.2)
  assert.equal(heroScreenXForWidth(260), 118)
  assert.equal(heroScreenXForWidth(900), 342)
})
