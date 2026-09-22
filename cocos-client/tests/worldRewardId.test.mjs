import test from 'node:test'
import assert from 'node:assert/strict'
import { createWorldRewardSessionId, worldRewardId } from '../assets/Scripts/Core/World/WorldRewardId.ts'

test('world reward IDs remain unique across runtime sessions with identical attempt generations', () => {
  const firstSession = createWorldRewardSessionId(1000, 0.25)
  const secondSession = createWorldRewardSessionId(1000, 0.25)

  assert.notEqual(firstSession, secondSession)
  assert.notEqual(worldRewardId(3, firstSession, 1), worldRewardId(3, secondSession, 1))
})

test('world reward IDs canonicalize stage and generation values', () => {
  assert.equal(worldRewardId(3.9, ' session ', 2.8), 'world-3-session-session-attempt-2')
})
