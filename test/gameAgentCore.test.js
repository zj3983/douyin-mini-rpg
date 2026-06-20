import test from 'node:test'
import assert from 'node:assert/strict'

import { canvasAspectHealth, canvasHealth, summarizeAgentRun } from '../scripts/game-agent-core.mjs'

test('game agent summary fails on failed checks or runtime issues', () => {
  const summary = summarizeAgentRun({
    checks: [
      { name: '登录入口', ok: true },
      { name: '副本入口', ok: false, detail: 'button missing' },
    ],
    consoleIssues: [{ type: 'error', text: 'boom' }],
    pageErrors: [],
    requestFailures: [],
  })

  assert.equal(summary.ok, false)
  assert.equal(summary.passed, 1)
  assert.equal(summary.failed, 2)
  assert.match(summary.lines.join('\n'), /副本入口/)
  assert.match(summary.lines.join('\n'), /console error/)
})

test('canvas health requires visual content and motion', () => {
  assert.equal(canvasHealth({ coloredPixels: 40, uniqueColors: 3, diffRatio: 0.01 }).ok, false)
  assert.equal(canvasHealth({ coloredPixels: 20000, uniqueColors: 80, diffRatio: 0 }).ok, false)
  assert.deepEqual(canvasHealth({ coloredPixels: 20000, uniqueColors: 80, diffRatio: 0.02 }), {
    ok: true,
    detail: 'colored=20000 unique=80 motion=2.00%',
  })
})

test('canvas aspect health catches CSS-stretched game canvas', () => {
  assert.equal(canvasAspectHealth({ intrinsicWidth: 540, intrinsicHeight: 720, cssWidth: 430, cssHeight: 326 }).ok, false)
  assert.deepEqual(canvasAspectHealth({ intrinsicWidth: 430, intrinsicHeight: 326, cssWidth: 430, cssHeight: 326 }), {
    ok: true,
    detail: 'intrinsic=430x326 css=430x326 mismatch=0.00%',
  })
})
