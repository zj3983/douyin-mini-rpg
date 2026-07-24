import test from 'node:test'
import assert from 'node:assert/strict'
import { createDefaultSave, migratePlayerSave } from '../assets/Scripts/Core/Progression/PlayerSave.ts'
import {
  createJsonSaveRepository,
  createMemorySaveRepository,
} from '../assets/Scripts/Core/Progression/SaveRepository.ts'

test('createDefaultSave returns the version 3 safe defaults', () => {
  assert.deepEqual(createDefaultSave(), {
    version: 3,
    spiritStones: 0,
    character: {
      id: 'qinglan',
      realm: 'qi-refining',
      innateSkillId: 'flying-sword-art',
    },
    world: {
      highestClearedStage: 0,
      claimedFirstClears: [],
    },
    inventory: {
      dungeonPasses: 0,
      artifacts: {},
      relics: {},
      materials: {},
    },
    loadout: {
      active: [],
      relics: [],
    },
    rewardLedger: [],
  })
})

test('migratePlayerSave accepts non-objects safely', () => {
  for (const input of [null, undefined, false, 7, 'save']) {
    assert.deepEqual(migratePlayerSave(input), createDefaultSave())
  }
})

test('migratePlayerSave preserves legacy spirit stones and maps stage', () => {
  const migrated = migratePlayerSave({ version: 2, spiritStones: 611, stage: 9 })

  assert.equal(migrated.spiritStones, 611)
  assert.equal(migrated.world.highestClearedStage, 9)
})

test('migratePlayerSave rejects invalid spirit stone and stage values', () => {
  assert.equal(migratePlayerSave({ spiritStones: -1, stage: Infinity }).spiritStones, 0)
  assert.equal(migratePlayerSave({ spiritStones: NaN, stage: -3 }).world.highestClearedStage, 0)
})

test('migratePlayerSave preserves valid version 3 progression in new containers', () => {
  const input = {
    version: 3,
    spiritStones: 144,
    world: {
      highestClearedStage: 12,
      claimedFirstClears: [1, '2', 3, null],
    },
    inventory: {
      dungeonPasses: 4,
      artifacts: { 'flying-sword': 2, 'thunder-seal': 1 },
      relics: { 'jade-guard': 3 },
      materials: { bamboo: 8, ore: 5 },
    },
    loadout: {
      active: ['flying-sword', 'thunder-seal'],
      relics: ['jade-guard'],
    },
    rewardLedger: ['stage:1', 7, 'dungeon:first', null],
  }

  const migrated = migratePlayerSave(input)

  assert.deepEqual(migrated, {
    version: 3,
    spiritStones: 144,
    character: {
      id: 'qinglan',
      realm: 'qi-refining',
      innateSkillId: 'flying-sword-art',
    },
    world: {
      highestClearedStage: 12,
      claimedFirstClears: [1, 3],
    },
    inventory: {
      dungeonPasses: 4,
      artifacts: { 'flying-sword': 2, 'thunder-seal': 1 },
      relics: { 'jade-guard': 3 },
      materials: { bamboo: 8, ore: 5 },
    },
    loadout: {
      active: ['flying-sword', 'thunder-seal'],
      relics: ['jade-guard'],
    },
    rewardLedger: ['stage:1', 'dungeon:first'],
  })
  assert.notEqual(migrated.world, input.world)
  assert.notEqual(migrated.world.claimedFirstClears, input.world.claimedFirstClears)
  assert.notEqual(migrated.inventory, input.inventory)
  assert.notEqual(migrated.inventory.artifacts, input.inventory.artifacts)
  assert.notEqual(migrated.inventory.relics, input.inventory.relics)
  assert.notEqual(migrated.inventory.materials, input.inventory.materials)
  assert.notEqual(migrated.loadout, input.loadout)
  assert.notEqual(migrated.loadout.active, input.loadout.active)
  assert.notEqual(migrated.loadout.relics, input.loadout.relics)
  assert.notEqual(migrated.rewardLedger, input.rewardLedger)
})

test('createMemorySaveRepository round-trips isolated deep copies', () => {
  const repository = createMemorySaveRepository()
  const source = createDefaultSave()
  source.spiritStones = 28
  source.inventory.materials.bamboo = 6
  source.rewardLedger.push('reward:one')

  repository.save(source)
  source.inventory.materials.bamboo = 99
  source.rewardLedger.push('source-only')

  const firstLoad = repository.load()
  assert.equal(firstLoad?.inventory.materials.bamboo, 6)
  assert.deepEqual(firstLoad?.rewardLedger, ['reward:one'])

  firstLoad.inventory.materials.bamboo = 77
  firstLoad.rewardLedger.push('load-only')

  const secondLoad = repository.load()
  assert.equal(secondLoad?.inventory.materials.bamboo, 6)
  assert.deepEqual(secondLoad?.rewardLedger, ['reward:one'])
  assert.notEqual(firstLoad, secondLoad)
})

test('createJsonSaveRepository loads JSON and migrates legacy data', () => {
  const storage = {
    value: JSON.stringify({ version: 2, spiritStones: 611, stage: 9 }),
    getItem(key) {
      assert.equal(key, 'player-save')
      return this.value
    },
    setItem(key, value) {
      assert.equal(key, 'player-save')
      this.value = value
    },
  }
  const repository = createJsonSaveRepository(storage, 'player-save')

  const loaded = repository.load()

  assert.equal(loaded?.version, 3)
  assert.equal(loaded?.spiritStones, 611)
  assert.equal(loaded?.world.highestClearedStage, 9)
})

test('createJsonSaveRepository stringifies saves', () => {
  const writes = []
  const storage = {
    getItem() {
      return null
    },
    setItem(key, value) {
      writes.push([key, value])
    },
  }
  const repository = createJsonSaveRepository(storage, 'slot-a')
  const save = createDefaultSave()
  save.spiritStones = 42

  repository.save(save)

  assert.deepEqual(writes, [['slot-a', JSON.stringify(save)]])
})

test('createJsonSaveRepository returns null for malformed JSON without throwing', () => {
  const repository = createJsonSaveRepository({
    getItem() {
      return '{bad json'
    },
    setItem() {},
  }, 'player-save')

  assert.doesNotThrow(() => repository.load())
  assert.equal(repository.load(), null)
})
