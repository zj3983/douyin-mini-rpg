import test from 'node:test'
import assert from 'node:assert/strict'
import { feedbackFor } from '../assets/Scripts/Combat/FeedbackTimeline.ts'

function findKind(requests, kind, key) {
  return requests.find((request) => request.kind === kind && (key === undefined || request.key === key))
}

test('flying sword cast has readable cast, launch, impact, hit-stop and return cues', () => {
  const requests = feedbackFor({
    type: 'artifact-cast',
    artifactId: 'qing-shuang-yujian',
    actorId: 'player',
    at: 1000,
    target: { x: 540, y: 220 },
  }, 'full')

  assert.equal(findKind(requests, 'cast-cue')?.atMs, 0)
  assert.equal(findKind(requests, 'audio-cue', 'hand-seal')?.atMs, 0)
  assert.ok(findKind(requests, 'sword-trail')?.atMs >= 55)
  assert.ok(findKind(requests, 'sword-trail')?.atMs <= 70)
  assert.equal(findKind(requests, 'audio-cue', 'sword-launch')?.atMs, findKind(requests, 'sword-trail')?.atMs)

  const impact = findKind(requests, 'impact')
  assert.ok(impact)
  assert.ok(impact.atMs >= 130)
  assert.ok(impact.atMs <= 155)
  assert.deepEqual(impact.position, { x: 540, y: 220 })

  const hitStop = findKind(requests, 'hit-stop')
  assert.ok(hitStop.durationMs >= 35)
  assert.ok(hitStop.durationMs <= 50)
  assert.ok(findKind(requests, 'audio-cue', 'sword-return').atMs > impact.atMs)
})

test('regular hits do not shake the camera', () => {
  const requests = feedbackFor({
    type: 'damage-resolved',
    sourceId: 'player-sword',
    targetId: 'moss-wolf-1',
    amount: 56,
    at: 1200,
  }, 'full')

  assert.equal(findKind(requests, 'camera-kick'), undefined)
})

test('elite and boss break shakes stay mobile safe', () => {
  const elite = feedbackFor({
    type: 'guard-broken',
    targetRank: 'elite',
    targetId: 'green-wing-moth-elite',
    at: 1300,
  }, 'full')
  const boss = feedbackFor({
    type: 'guard-broken',
    targetRank: 'boss',
    targetId: 'bamboo-warden',
    at: 1400,
  }, 'full')

  assert.ok(findKind(elite, 'camera-kick').strength <= 2)
  assert.ok(findKind(boss, 'camera-kick').strength <= 5)
})

test('reduced quality keeps combat readability but removes optional debris', () => {
  const requests = feedbackFor({
    type: 'artifact-cast',
    artifactId: 'qing-shuang-yujian',
    actorId: 'player',
    at: 1000,
    target: { x: 540, y: 220 },
  }, 'reduced')

  assert.ok(findKind(requests, 'sword-trail'))
  assert.ok(findKind(requests, 'impact'))
  assert.equal(findKind(requests, 'debris'), undefined)
})
