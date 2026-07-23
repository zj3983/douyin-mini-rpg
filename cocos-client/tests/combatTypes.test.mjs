import test from 'node:test'
import assert from 'node:assert/strict'
import { createSeededRandom, isCombatEvent } from '../assets/Scripts/Combat/CombatTypes.ts'

test('combat core is imported from TypeScript without an executable mirror', () => {
  const expected = [0.238781, 0.913493]
  const sample = (random) => [random(), random()].map((value) => Number(value.toFixed(6)))

  assert.deepEqual(sample(createSeededRandom(7)), expected)
  assert.deepEqual(sample(createSeededRandom(7)), expected)
})

test('combat event guard accepts every complete event variant', () => {
  const events = [
    { type: 'stage-entered', stageId: 1, at: 0, debug: true },
    { type: 'animation-requested', actorId: 'player', action: 'attack', at: 1 },
    {
      type: 'attack-telegraphed',
      enemyId: 2,
      attackId: 'claw-swipe',
      area: { minX: -2, maxX: 2, minY: 0, maxY: 4 },
      at: 2,
    },
    { type: 'damage-resolved', sourceId: 'enemy:2', targetId: 'player', amount: 10, at: 3 },
    { type: 'enemy-defeated', enemyId: 2, at: 4 },
    { type: 'boss-entered', enemyId: 9, at: 5 },
    { type: 'stage-settled', stageId: 1, at: 6 },
  ]

  for (const event of events) {
    assert.equal(isCombatEvent(event), true, event.type)
  }
})

test('combat event guard rejects malformed values', async (t) => {
  const validArea = { minX: -2, maxX: 2, minY: 0, maxY: 4 }
  const malformed = [
    ['null', null],
    ['undefined', undefined],
    ['number primitive', 1],
    ['string primitive', 'stage-entered'],
    ['boolean primitive', true],
    ['array', Object.assign([], { type: 'stage-entered', stageId: 1, at: 0 })],
    ['unknown type', { type: 'stage-paused', at: 0 }],
    ['missing stageId', { type: 'stage-entered', at: 0 }],
    ['wrong stageId type', { type: 'stage-entered', stageId: '1', at: 0 }],
    ['missing action', { type: 'animation-requested', actorId: 'player', at: 0 }],
    ['wrong actorId type', { type: 'animation-requested', actorId: 1, action: 'attack', at: 0 }],
    ['wrong action type', { type: 'animation-requested', actorId: 'player', action: 1, at: 0 }],
    ['missing attackId', { type: 'attack-telegraphed', enemyId: 2, area: validArea, at: 0 }],
    ['wrong telegraph enemyId type', { type: 'attack-telegraphed', enemyId: '2', attackId: 'claw-swipe', area: validArea, at: 0 }],
    ['missing attack area', { type: 'attack-telegraphed', enemyId: 2, attackId: 'claw-swipe', at: 0 }],
    ['wrong attack area type', { type: 'attack-telegraphed', enemyId: 2, attackId: 'claw-swipe', area: [], at: 0 }],
    ['wrong enemyId type', { type: 'enemy-defeated', enemyId: '2', at: 0 }],
    ['missing boss enemyId', { type: 'boss-entered', at: 0 }],
    ['wrong stage settlement type', { type: 'stage-settled', stageId: '1', at: 0 }],
    ['wrong damage amount type', { type: 'damage-resolved', sourceId: 'enemy:2', targetId: 'player', amount: '10', at: 0 }],
    ['wrong damage source type', { type: 'damage-resolved', sourceId: 2, targetId: 'player', amount: 10, at: 0 }],
    ['missing damage target', { type: 'damage-resolved', sourceId: 'enemy:2', amount: 10, at: 0 }],
    ['wrong damage target type', { type: 'damage-resolved', sourceId: 'enemy:2', targetId: 1, amount: 10, at: 0 }],
    ['wrong timestamp type', { type: 'stage-entered', stageId: 1, at: '0' }],
    ['NaN timestamp', { type: 'stage-entered', stageId: 1, at: Number.NaN }],
    ['infinite timestamp', { type: 'stage-entered', stageId: 1, at: Number.POSITIVE_INFINITY }],
    ...['minX', 'maxX', 'minY', 'maxY'].map((coordinate) => [
      `invalid area ${coordinate}`,
      {
        type: 'attack-telegraphed',
        enemyId: 2,
        attackId: 'claw-swipe',
        area: { ...validArea, [coordinate]: Number.POSITIVE_INFINITY },
        at: 0,
      },
    ]),
  ]

  for (const [label, value] of malformed) {
    await t.test(label, () => {
      assert.equal(isCombatEvent(value), false)
    })
  }
})
