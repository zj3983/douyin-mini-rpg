import test from 'node:test'
import assert from 'node:assert/strict'
import { createDefaultSave } from '../assets/Scripts/Core/Progression/PlayerSave.ts'
import { applyWorldBossClear } from '../assets/Scripts/Core/World/WorldRewards.ts'

test('first Boss clear grants progression and currency', () => {
  const save = createDefaultSave()

  const result = applyWorldBossClear(save, { stage: 3, rewardId: 'world-3-clear-a' })

  assert.deepEqual(result.granted, { dungeonPasses: 1, spiritStones: 80 })
  assert.equal(result.save.world.highestClearedStage, 3)
  assert.equal(result.save.inventory.dungeonPasses, 1)
  assert.equal(result.save.spiritStones, 80)
  assert.deepEqual(result.save.rewardLedger, ['world-3-clear-a'])
})

test('duplicate reward id is idempotent', () => {
  const save = createDefaultSave()
  save.world.highestClearedStage = 4
  save.inventory.dungeonPasses = 2
  save.spiritStones = 160
  save.rewardLedger.push('world-4-clear-a')

  const result = applyWorldBossClear(save, { stage: 9, rewardId: 'world-4-clear-a' })

  assert.deepEqual(result.granted, { dungeonPasses: 0, spiritStones: 0 })
  assert.equal(result.save.world.highestClearedStage, 4)
  assert.equal(result.save.inventory.dungeonPasses, 2)
  assert.equal(result.save.spiritStones, 160)
  assert.deepEqual(result.save.rewardLedger, ['world-4-clear-a'])
  assert.notEqual(result.save, save)
  assert.notEqual(result.save.inventory, save.inventory)
  assert.notEqual(result.save.rewardLedger, save.rewardLedger)
})

test('reward application does not mutate input and returns a deeply isolated save', () => {
  const save = createDefaultSave()
  save.inventory.artifacts['flying-sword'] = 2
  save.inventory.materials.bamboo = 5
  save.loadout.active.push('flying-sword')
  const snapshot = JSON.parse(JSON.stringify(save))

  const result = applyWorldBossClear(save, { stage: 1, rewardId: 'world-1-clear-a' })

  assert.deepEqual(save, snapshot)
  assert.notEqual(result.save, save)
  assert.notEqual(result.save.world, save.world)
  assert.notEqual(result.save.world.claimedFirstClears, save.world.claimedFirstClears)
  assert.notEqual(result.save.inventory, save.inventory)
  assert.notEqual(result.save.inventory.artifacts, save.inventory.artifacts)
  assert.notEqual(result.save.inventory.relics, save.inventory.relics)
  assert.notEqual(result.save.inventory.materials, save.inventory.materials)
  assert.notEqual(result.save.loadout, save.loadout)
  assert.notEqual(result.save.loadout.active, save.loadout.active)
  assert.notEqual(result.save.loadout.relics, save.loadout.relics)
  assert.notEqual(result.save.rewardLedger, save.rewardLedger)

  result.save.inventory.materials.bamboo = 99
  result.save.loadout.active.length = 0
  assert.deepEqual(save, snapshot)
})

test('distinct reward ids grant repeat clear rewards without lowering progress', () => {
  const initial = createDefaultSave()
  const first = applyWorldBossClear(initial, { stage: 6, rewardId: 'world-6-clear-a' })
  const repeat = applyWorldBossClear(first.save, { stage: 2, rewardId: 'world-2-clear-b' })

  assert.deepEqual(repeat.granted, { dungeonPasses: 1, spiritStones: 80 })
  assert.equal(repeat.save.world.highestClearedStage, 6)
  assert.equal(repeat.save.inventory.dungeonPasses, 2)
  assert.equal(repeat.save.spiritStones, 160)
  assert.deepEqual(repeat.save.rewardLedger, ['world-6-clear-a', 'world-2-clear-b'])
})

test('fractional stages are floored', () => {
  const initial = createDefaultSave()
  initial.world.highestClearedStage = 5

  const fractional = applyWorldBossClear(initial, { stage: 8.9, rewardId: 'fractional' })
  assert.equal(fractional.save.world.highestClearedStage, 8)
  assert.deepEqual(fractional.granted, { dungeonPasses: 1, spiritStones: 80 })
})

test('invalid stages reject rewards without changing save state', () => {
  const initial = createDefaultSave()
  initial.world.highestClearedStage = 5
  initial.inventory.dungeonPasses = 2
  initial.spiritStones = 160
  initial.rewardLedger.push('existing')

  for (const [index, stage] of [NaN, Infinity, -Infinity, -1, 0, 0.9].entries()) {
    const result = applyWorldBossClear(initial, {
      stage,
      rewardId: `invalid-${index}`,
    })
    assert.deepEqual(result.granted, { dungeonPasses: 0, spiritStones: 0 })
    assert.deepEqual(result.save, initial)
    assert.notEqual(result.save, initial)
    assert.notEqual(result.save.inventory, initial.inventory)
    assert.notEqual(result.save.rewardLedger, initial.rewardLedger)
  }
})

test('blank reward ids reject rewards without changing save state', () => {
  const initial = createDefaultSave()

  for (const rewardId of ['', '   ', '\t\r\n']) {
    const result = applyWorldBossClear(initial, { stage: 1, rewardId })
    assert.deepEqual(result.granted, { dungeonPasses: 0, spiritStones: 0 })
    assert.deepEqual(result.save, initial)
    assert.notEqual(result.save, initial)
    assert.notEqual(result.save.rewardLedger, initial.rewardLedger)
  }
})

test('reward ids are trimmed before storage and duplicate detection', () => {
  const initial = createDefaultSave()
  const first = applyWorldBossClear(initial, { stage: 1, rewardId: '  world-1-clear-a  ' })
  const duplicate = applyWorldBossClear(first.save, { stage: 9, rewardId: 'world-1-clear-a' })
  const paddedLedger = createDefaultSave()
  paddedLedger.rewardLedger.push('  world-2-clear-a  ')
  paddedLedger.inventory.dungeonPasses = 1
  paddedLedger.spiritStones = 80
  const paddedDuplicate = applyWorldBossClear(paddedLedger, {
    stage: 2,
    rewardId: 'world-2-clear-a',
  })

  assert.deepEqual(first.granted, { dungeonPasses: 1, spiritStones: 80 })
  assert.deepEqual(first.save.rewardLedger, ['world-1-clear-a'])
  assert.deepEqual(duplicate.granted, { dungeonPasses: 0, spiritStones: 0 })
  assert.equal(duplicate.save.world.highestClearedStage, 1)
  assert.equal(duplicate.save.inventory.dungeonPasses, 1)
  assert.equal(duplicate.save.spiritStones, 80)
  assert.deepEqual(duplicate.save.rewardLedger, ['world-1-clear-a'])
  assert.deepEqual(paddedDuplicate.granted, { dungeonPasses: 0, spiritStones: 0 })
  assert.equal(paddedDuplicate.save.inventory.dungeonPasses, 1)
  assert.equal(paddedDuplicate.save.spiritStones, 80)
  assert.deepEqual(paddedDuplicate.save.rewardLedger, ['  world-2-clear-a  '])
})
