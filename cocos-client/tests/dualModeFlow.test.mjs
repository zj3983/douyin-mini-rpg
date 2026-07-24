import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyExtractionLoot,
  consumeDungeonPass,
  createDefaultSave,
} from '../assets/Scripts/Core/Progression/PlayerSave.ts'
import { applyWorldBossClear } from '../assets/Scripts/Core/World/WorldRewards.ts'

const ARTIFACT_IDS = ['flying-sword', 'thunder-seal', 'soul-bell', 'flame-ruler']
const RELIC_IDS = ['soul-magnet', 'jade-guard', 'spirit-vessel']

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function assertDeeplyIsolated(actual, expected) {
  assert.notEqual(actual, expected)
  assert.notEqual(actual.character, expected.character)
  assert.notEqual(actual.world, expected.world)
  assert.notEqual(actual.world.claimedFirstClears, expected.world.claimedFirstClears)
  assert.notEqual(actual.inventory, expected.inventory)
  assert.notEqual(actual.inventory.artifacts, expected.inventory.artifacts)
  assert.notEqual(actual.inventory.relics, expected.inventory.relics)
  assert.notEqual(actual.inventory.materials, expected.inventory.materials)
  assert.notEqual(actual.loadout, expected.loadout)
  assert.notEqual(actual.loadout.active, expected.loadout.active)
  assert.notEqual(actual.loadout.relics, expected.loadout.relics)
  assert.notEqual(actual.rewardLedger, expected.rewardLedger)
}

test('world Boss clear, pass consumption, and extraction persist dungeon loot once', () => {
  const initial = createDefaultSave()
  const world = applyWorldBossClear(initial, { stage: 1, rewardId: 'stage-1-run-1' }).save

  assert.equal(world.inventory.dungeonPasses, 1)
  const entry = consumeDungeonPass(world)
  assert.equal(entry.ok, true)
  assert.equal(entry.save.inventory.dungeonPasses, 0)

  const extracted = applyExtractionLoot(entry.save, '  mist-vault-run-1  ', [
    { itemId: '  flying-sword ', amount: 1 },
    { itemId: ' mist-herb  ', amount: 3 },
  ])
  assert.equal(extracted.inventory.artifacts['flying-sword'], 1)
  assert.equal(extracted.inventory.materials['mist-herb'], 3)
  assert.deepEqual(extracted.rewardLedger, ['stage-1-run-1', 'mist-vault-run-1'])

  const duplicate = applyExtractionLoot(extracted, 'mist-vault-run-1', [
    { itemId: 'flying-sword', amount: 5 },
  ])
  assert.deepEqual(duplicate, extracted)
  assertDeeplyIsolated(duplicate, extracted)
})

test('dungeon pass consumption rejects zero and always returns an isolated save', () => {
  const initial = createDefaultSave()
  initial.inventory.materials['mist-herb'] = 2
  const snapshot = clone(initial)

  const rejected = consumeDungeonPass(initial)

  assert.equal(rejected.ok, false)
  assert.deepEqual(rejected.save, snapshot)
  assert.deepEqual(initial, snapshot)
  assertDeeplyIsolated(rejected.save, initial)

  initial.inventory.dungeonPasses = 2
  const accepted = consumeDungeonPass(initial)
  assert.equal(accepted.ok, true)
  assert.equal(accepted.save.inventory.dungeonPasses, 1)
  assert.equal(initial.inventory.dungeonPasses, 2)
  assertDeeplyIsolated(accepted.save, initial)
})

test('extraction classifies every known artifact and relic and canonicalizes item IDs', () => {
  const initial = createDefaultSave()
  const loot = [
    ...ARTIFACT_IDS.map((itemId) => ({ itemId: ` ${itemId} `, amount: 1 })),
    ...RELIC_IDS.map((itemId) => ({ itemId: `\t${itemId}\n`, amount: 2 })),
    { itemId: '  mist-herb  ', amount: 3 },
  ]

  const extracted = applyExtractionLoot(initial, 'classify-all', loot)

  for (const itemId of ARTIFACT_IDS) assert.equal(extracted.inventory.artifacts[itemId], 1)
  for (const itemId of RELIC_IDS) assert.equal(extracted.inventory.relics[itemId], 2)
  assert.deepEqual(extracted.inventory.materials, { 'mist-herb': 3 })
})

test('extraction preserves and adds to existing inventory counts', () => {
  const initial = createDefaultSave()
  initial.inventory.artifacts['flying-sword'] = 4
  initial.inventory.relics['jade-guard'] = 5
  initial.inventory.materials['mist-herb'] = 6
  initial.inventory.materials.bamboo = 7

  const extracted = applyExtractionLoot(initial, 'existing-counts', [
    { itemId: 'flying-sword', amount: 2 },
    { itemId: 'jade-guard', amount: 3 },
    { itemId: 'mist-herb', amount: 4 },
  ])

  assert.deepEqual(extracted.inventory.artifacts, { 'flying-sword': 6 })
  assert.deepEqual(extracted.inventory.relics, { 'jade-guard': 8 })
  assert.deepEqual(extracted.inventory.materials, { 'mist-herb': 10, bamboo: 7 })
})

test('invalid extraction payloads grant nothing and record no reward', () => {
  const invalidPayloads = [
    ['', [{ itemId: 'mist-herb', amount: 1 }]],
    ['   ', [{ itemId: 'mist-herb', amount: 1 }]],
    ['not-an-array', null],
    ['blank-item', [{ itemId: '  ', amount: 1 }]],
    ['non-string-item', [{ itemId: 7, amount: 1 }]],
    ['zero-amount', [{ itemId: 'mist-herb', amount: 0 }]],
    ['negative-amount', [{ itemId: 'mist-herb', amount: -1 }]],
    ['fractional-amount', [{ itemId: 'mist-herb', amount: 1.5 }]],
    ['infinite-amount', [{ itemId: 'mist-herb', amount: Infinity }]],
    ['atomic', [
      { itemId: 'flying-sword', amount: 1 },
      { itemId: '', amount: 1 },
    ]],
  ]

  for (const [rewardId, loot] of invalidPayloads) {
    const initial = createDefaultSave()
    initial.inventory.materials.bamboo = 2
    const snapshot = clone(initial)
    const extracted = applyExtractionLoot(initial, rewardId, loot)

    assert.deepEqual(extracted, snapshot, rewardId)
    assert.deepEqual(initial, snapshot, rewardId)
    assertDeeplyIsolated(extracted, initial)
  }
})

test('unsafe resulting counts reject the entire extraction atomically', () => {
  const initial = createDefaultSave()
  initial.inventory.artifacts['flying-sword'] = 2
  initial.inventory.materials['mist-herb'] = Number.MAX_SAFE_INTEGER
  const snapshot = clone(initial)

  const extracted = applyExtractionLoot(initial, 'overflowing-run', [
    { itemId: 'flying-sword', amount: 1 },
    { itemId: 'mist-herb', amount: 1 },
  ])

  assert.deepEqual(extracted, snapshot)
  assert.deepEqual(initial, snapshot)
  assertDeeplyIsolated(extracted, initial)
})

test('successful extraction returns a deeply isolated save without mutating input', () => {
  const initial = createDefaultSave()
  initial.world.claimedFirstClears.push(1)
  initial.inventory.artifacts['flying-sword'] = 1
  initial.inventory.relics['jade-guard'] = 1
  initial.inventory.materials.bamboo = 1
  initial.loadout.active.push('flying-sword')
  initial.loadout.relics.push('jade-guard')
  const snapshot = clone(initial)

  const extracted = applyExtractionLoot(initial, 'isolated-run', [
    { itemId: 'mist-herb', amount: 1 },
  ])

  assert.deepEqual(initial, snapshot)
  assertDeeplyIsolated(extracted, initial)

  extracted.character.id = 'changed'
  extracted.world.claimedFirstClears.push(2)
  extracted.inventory.artifacts['flying-sword'] = 99
  extracted.loadout.active.length = 0
  extracted.rewardLedger.length = 0
  assert.deepEqual(initial, snapshot)
})
