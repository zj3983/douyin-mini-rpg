import test from 'node:test'
import assert from 'node:assert/strict'
import { createSeededRandom, isCombatEvent } from '../assets/Scripts/Combat/CombatTypes.ts'

test('combat core is imported from TypeScript without an executable mirror', () => {
  const random = createSeededRandom(7)
  assert.deepEqual([random(), random()].map((value) => Number(value.toFixed(6))), [0.238781, 0.913493])
  assert.equal(isCombatEvent({ type: 'stage-entered', stageId: 1, at: 0 }), true)
})
