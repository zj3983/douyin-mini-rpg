import test from 'node:test'
import assert from 'node:assert/strict'
import { createDungeonSession, checkpointDungeonRun } from '../assets/Scripts/Core/Dungeon/DungeonSession.ts'
import { createDefaultSave, migratePlayerSave } from '../assets/Scripts/Core/Progression/PlayerSave.ts'
import {
  createJsonSaveRepository,
  createMemorySaveRepository,
} from '../assets/Scripts/Core/Progression/SaveRepository.ts'

function checkpoint(seed = 7) {
  const profile = {
    id: 'mist-vault',
    entryRoomId: 'entry',
    extractionRoomIds: ['exit'],
    finalExtractionRoomId: 'exit',
    bossAltarRoomId: 'altar',
    rooms: [
      { id: 'entry', floor: 1, kind: 'entry', sceneId: 'entry-scene', risk: 'low', exits: [{ id: 'to-exit', to: 'exit', cost: 0 }, { id: 'to-altar', to: 'altar', cost: 0 }] },
      { id: 'exit', floor: 3, kind: 'extraction', sceneId: 'exit-scene', risk: 'high', exits: [] },
      { id: 'altar', floor: 3, kind: 'boss', sceneId: 'altar-scene', risk: 'extreme', exits: [{ id: 'altar-to-exit', to: 'exit', cost: 0 }] },
    ],
  }
  return checkpointDungeonRun(createDungeonSession(profile, seed))
}

test('createDefaultSave returns the version 4 safe defaults', () => {
  assert.deepEqual(createDefaultSave(), {
    version: 4,
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
    dungeon: {
      dayKey: '',
      freeEntriesUsed: 0,
      activeRun: null,
    },
  })
})

test('V3 migrates to V4 with three unused daily entries and no active run', () => {
  const save = migratePlayerSave({ version: 3, inventory: { dungeonPasses: 2 } })

  assert.equal(save.version, 4)
  assert.deepEqual(save.dungeon, { dayKey: '', freeEntriesUsed: 0, activeRun: null })
})

test('V4 migration preserves and deeply clones a valid active dungeon checkpoint', () => {
  const activeCheckpoint = checkpoint(19)
  const input = {
    version: 4,
    inventory: { dungeonPasses: 2 },
    dungeon: {
      dayKey: '2026-08-19',
      freeEntriesUsed: 2,
      activeRun: { payment: 'free', checkpoint: activeCheckpoint },
    },
  }

  const migrated = migratePlayerSave(input)

  assert.deepEqual(migrated.dungeon, input.dungeon)
  assert.notEqual(migrated.dungeon, input.dungeon)
  assert.notEqual(migrated.dungeon.activeRun, input.dungeon.activeRun)
  assert.notEqual(migrated.dungeon.activeRun.checkpoint, activeCheckpoint)
  assert.notEqual(migrated.dungeon.activeRun.checkpoint.map, activeCheckpoint.map)
  assert.notEqual(migrated.dungeon.activeRun.checkpoint.carriedLoot, activeCheckpoint.carriedLoot)
})

test('invalid active dungeon checkpoints refund their recorded payment exactly once', () => {
  const corruptFree = migratePlayerSave({
    version: 4,
    inventory: { dungeonPasses: 1 },
    dungeon: {
      dayKey: '2026-08-19',
      freeEntriesUsed: 2,
      activeRun: { payment: 'free', checkpoint: { schemaVersion: 999 } },
    },
  })
  assert.deepEqual(corruptFree.dungeon, {
    dayKey: '2026-08-19',
    freeEntriesUsed: 1,
    activeRun: null,
  })
  assert.deepEqual(migratePlayerSave(corruptFree).dungeon, corruptFree.dungeon)

  const corruptPass = migratePlayerSave({
    version: 4,
    inventory: { dungeonPasses: 1 },
    dungeon: {
      dayKey: '2026-08-19',
      freeEntriesUsed: 3,
      activeRun: { payment: 'pass', checkpoint: null },
    },
  })
  assert.equal(corruptPass.inventory.dungeonPasses, 2)
  assert.equal(corruptPass.dungeon.activeRun, null)
  assert.equal(migratePlayerSave(corruptPass).inventory.dungeonPasses, 2)
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

test('migratePlayerSave prefers valid world progress for any version and falls back to legacy stage', () => {
  assert.equal(migratePlayerSave({
    version: 3,
    stage: 3,
    world: { highestClearedStage: 11.9 },
  }).world.highestClearedStage, 11)
  assert.equal(migratePlayerSave({
    version: 4,
    stage: 7.8,
    world: { highestClearedStage: -1 },
  }).world.highestClearedStage, 7)
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
    version: 4,
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
    dungeon: {
      dayKey: '',
      freeEntriesUsed: 0,
      activeRun: null,
    },
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

test('migratePlayerSave floors nonnegative integral progression fields', () => {
  const migrated = migratePlayerSave({
    world: {
      highestClearedStage: 8.9,
      claimedFirstClears: [1.9, -2, 3.1, Infinity, '4'],
    },
    inventory: {
      dungeonPasses: 5.8,
      artifacts: { 'flying-sword': 2.9, 'thunder-seal': -1 },
      relics: { 'jade-guard': 4.7 },
      materials: { bamboo: 9.6, ore: NaN },
    },
  })

  assert.equal(migrated.world.highestClearedStage, 8)
  assert.deepEqual(migrated.world.claimedFirstClears, [1, 3])
  assert.equal(migrated.inventory.dungeonPasses, 5)
  assert.deepEqual(migrated.inventory.artifacts, { 'flying-sword': 2 })
  assert.deepEqual(migrated.inventory.relics, { 'jade-guard': 4 })
  assert.deepEqual(migrated.inventory.materials, { bamboo: 9 })
})

test('migratePlayerSave produces a canonical legal loadout', () => {
  const migrated = migratePlayerSave({
    version: 3,
    loadout: {
      active: [
        'flying-sword',
        'flying-sword',
        'unknown-artifact',
        'thunder-seal',
        'soul-bell',
        'flame-ruler',
      ],
      relics: ['soul-magnet', 'soul-magnet', 'jade-guard', 'spirit-vessel'],
    },
  })

  assert.deepEqual(migrated.loadout, {
    active: ['flying-sword', 'thunder-seal', 'soul-bell'],
    relics: ['soul-magnet', 'jade-guard'],
  })
  assert.equal(
    new Set([...migrated.loadout.active, ...migrated.loadout.relics]).size,
    migrated.loadout.active.length + migrated.loadout.relics.length,
  )
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

test('createMemorySaveRepository treats null as an empty repository', () => {
  assert.equal(createMemorySaveRepository(null).load(), null)
  assert.equal(createMemorySaveRepository().load(), null)
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

  assert.equal(loaded?.version, 4)
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
