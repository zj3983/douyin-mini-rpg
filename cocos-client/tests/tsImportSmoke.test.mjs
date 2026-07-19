import test from 'node:test'
import assert from 'node:assert/strict'
import { createStageFlow, recordOrdinaryDefeat } from '../assets/Scripts/Core/StageFlowRuntime.ts'

test('tests import TypeScript core modules directly without a mirror', () => {
  const flow = createStageFlow(2, 0)
  assert.equal(flow.phase, 'clearing')
  recordOrdinaryDefeat(flow)
  assert.equal(flow.ordinaryDefeats, 1)
})
