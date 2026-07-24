import test from 'node:test'
import assert from 'node:assert/strict'
import { createDualModeRuntime } from '../assets/Scripts/Core/Progression/DualModeRuntime.ts'
import { createDefaultSave, migratePlayerSave } from '../assets/Scripts/Core/Progression/PlayerSave.ts'

function createRepository({ failAt = Infinity } = {}) {
  const saved = []
  return {
    saved,
    save(value) {
      if (saved.length + 1 === failAt) throw new Error('storage unavailable')
      saved.push(migratePlayerSave(value))
    },
  }
}

function createDungeonPort({
  beginOk = true,
  activeRunId = null,
  phase = 'exploring',
  cancelOk = true,
  cancelThrows = false,
} = {}) {
  let runId = activeRunId
  let runPhase = activeRunId ? phase : null
  const calls = { begin: [], cancel: 0 }

  return {
    calls,
    hasRun() {
      return runId !== null
    },
    currentRunId() {
      return runId
    },
    previewRunId(seed) {
      return Number.isSafeInteger(seed) && seed >= 0 && seed <= 4294967295
        ? `mist-vault-${seed}`
        : null
    },
    begin(seed) {
      calls.begin.push(seed)
      if (!beginOk || runId !== null) return false
      runId = `mist-vault-${seed}`
      runPhase = 'exploring'
      return true
    },
    cancelRun() {
      calls.cancel += 1
      if (cancelThrows) throw new Error('cancel unavailable')
      if (!cancelOk) return false
      if (runId === null) return false
      runId = null
      runPhase = null
      return true
    },
    isExtractedRun(candidateRunId) {
      return runId === candidateRunId && runPhase === 'extracted'
    },
    markExtracted() {
      assert.notEqual(runId, null)
      runPhase = 'extracted'
    },
  }
}

function saveWithPasses(count, rewardLedger = []) {
  const save = createDefaultSave()
  save.inventory.dungeonPasses = count
  save.rewardLedger = [...rewardLedger]
  return save
}

test('default entry probes from a generated uint32 seed until the run ID is unused', () => {
  const firstDungeon = createDungeonPort()
  const first = createDualModeRuntime({
    initialSave: saveWithPasses(1, ['mist-vault-5']),
    repository: createRepository(),
    dungeon: firstDungeon,
    seedSource: () => 5,
  })

  const firstEntry = first.enterDungeon()
  assert.deepEqual(firstEntry, {
    ok: true,
    seed: 6,
    runId: 'mist-vault-6',
    saveChanged: true,
  })
  assert.deepEqual(firstDungeon.calls.begin, [6])

  const secondDungeon = createDungeonPort()
  const second = createDualModeRuntime({
    initialSave: saveWithPasses(1, ['mist-vault-5', 'mist-vault-6']),
    repository: createRepository(),
    dungeon: secondDungeon,
    seedSource: () => 5,
  })
  assert.equal(second.enterDungeon().runId, 'mist-vault-7')
})

test('explicit duplicate seeds and double entry reject without consuming or persisting', () => {
  const duplicateRepository = createRepository()
  const duplicateDungeon = createDungeonPort()
  const duplicate = createDualModeRuntime({
    initialSave: saveWithPasses(2, ['mist-vault-9']),
    repository: duplicateRepository,
    dungeon: duplicateDungeon,
  })

  assert.deepEqual(duplicate.enterDungeon(9), { ok: false, reason: 'duplicate-run-id' })
  assert.equal(duplicate.getSaveSnapshot().inventory.dungeonPasses, 2)
  assert.deepEqual(duplicateDungeon.calls.begin, [])
  assert.equal(duplicateRepository.saved.length, 0)

  const repository = createRepository()
  const dungeon = createDungeonPort()
  const runtime = createDualModeRuntime({
    initialSave: saveWithPasses(2),
    repository,
    dungeon,
  })
  assert.equal(runtime.enterDungeon(10).ok, true)
  const afterFirst = runtime.getSaveSnapshot()
  assert.deepEqual(runtime.enterDungeon(11), { ok: false, reason: 'run-active' })
  assert.deepEqual(runtime.getSaveSnapshot(), afterFirst)
  assert.deepEqual(dungeon.calls.begin, [10])
  assert.equal(repository.saved.length, 1)
})

test('begin failure retains the dungeon pass and performs no persistence', () => {
  const repository = createRepository()
  const dungeon = createDungeonPort({ beginOk: false })
  const runtime = createDualModeRuntime({
    initialSave: saveWithPasses(1),
    repository,
    dungeon,
  })

  assert.deepEqual(runtime.enterDungeon(12), { ok: false, reason: 'dungeon-begin-failed' })
  assert.equal(runtime.getSaveSnapshot().inventory.dungeonPasses, 1)
  assert.equal(runtime.getMode(), 'world')
  assert.equal(repository.saved.length, 0)
})

test('malformed world and extraction envelopes reject without throwing or persisting', () => {
  const repository = createRepository()
  const dungeon = createDungeonPort()
  const runtime = createDualModeRuntime({
    initialSave: saveWithPasses(1),
    repository,
    dungeon,
  })

  const throwingWorld = Object.defineProperty({}, 'stage', {
    get() {
      throw new Error('hostile getter')
    },
  })
  for (const payload of [null, undefined, 7, {}, { stage: '1', rewardId: 'world-1' }, throwingWorld]) {
    assert.doesNotThrow(() => runtime.handleWorldCleared(payload))
    assert.deepEqual(runtime.handleWorldCleared(payload), { ok: false, reason: 'invalid-world-event' })
  }
  const throwingExtraction = Object.defineProperty({}, 'runId', {
    get() {
      throw new Error('hostile getter')
    },
  })
  for (const payload of [
    null,
    undefined,
    {},
    { runId: 7, loot: [] },
    { runId: 'run', loot: null },
    { runId: 'run', loot: [{ itemId: 'item', amount: 0 }] },
    throwingExtraction,
  ]) {
    assert.doesNotThrow(() => runtime.handleDungeonExtracted(payload))
    assert.deepEqual(runtime.handleDungeonExtracted(payload), { ok: false, reason: 'invalid-extraction-event' })
  }
  assert.equal(repository.saved.length, 0)
})

test('entry persistence failure rolls back the started session and all in-memory state', () => {
  const repository = createRepository({ failAt: 1 })
  const dungeon = createDungeonPort()
  const runtime = createDualModeRuntime({
    initialSave: saveWithPasses(1),
    repository,
    dungeon,
  })

  assert.deepEqual(runtime.enterDungeon(13), { ok: false, reason: 'save-persist-failed' })
  assert.equal(runtime.getSaveSnapshot().inventory.dungeonPasses, 1)
  assert.equal(runtime.getMode(), 'world')
  assert.equal(runtime.getActiveRunId(), null)
  assert.equal(dungeon.hasRun(), false)
  assert.equal(dungeon.calls.cancel, 1)
})

test('failed entry cancellation retains the candidate session and surfaces rollback failure', () => {
  const repository = createRepository({ failAt: 1 })
  const dungeon = createDungeonPort({ cancelOk: false })
  const runtime = createDualModeRuntime({
    initialSave: saveWithPasses(1),
    repository,
    dungeon,
  })

  assert.deepEqual(runtime.enterDungeon(13), {
    ok: false,
    reason: 'save-persist-rollback-failed',
  })
  assert.equal(runtime.getSaveSnapshot().inventory.dungeonPasses, 1)
  assert.equal(runtime.getMode(), 'dungeon')
  assert.equal(runtime.getActiveRunId(), 'mist-vault-13')
  assert.equal(dungeon.hasRun(), true)
  assert.equal(dungeon.calls.cancel, 1)
})

test('throwing entry cancellation also retains the candidate session and surfaces rollback failure', () => {
  const dungeon = createDungeonPort({ cancelThrows: true })
  const runtime = createDualModeRuntime({
    initialSave: saveWithPasses(1),
    repository: createRepository({ failAt: 1 }),
    dungeon,
  })

  assert.deepEqual(runtime.enterDungeon(16), {
    ok: false,
    reason: 'save-persist-rollback-failed',
  })
  assert.equal(runtime.getMode(), 'dungeon')
  assert.equal(runtime.getActiveRunId(), 'mist-vault-16')
  assert.equal(dungeon.hasRun(), true)
})

test('world persistence failure does not assign the reducer result', () => {
  const runtime = createDualModeRuntime({
    initialSave: createDefaultSave(),
    repository: createRepository({ failAt: 1 }),
    dungeon: createDungeonPort(),
  })

  assert.deepEqual(
    runtime.handleWorldCleared({ stage: 1, rewardId: 'world-1-generation-1' }),
    { ok: false, reason: 'save-persist-failed' },
  )
  assert.deepEqual(runtime.getSaveSnapshot(), createDefaultSave())
})

test('accepted matching extraction atomically returns to world and clears the active run', () => {
  const repository = createRepository()
  const dungeon = createDungeonPort()
  const runtime = createDualModeRuntime({
    initialSave: saveWithPasses(1),
    repository,
    dungeon,
  })
  assert.equal(runtime.enterDungeon(14).ok, true)
  dungeon.markExtracted()

  const payload = { runId: 'mist-vault-14', loot: [{ itemId: 'mist-herb', amount: 2 }] }
  assert.deepEqual(runtime.handleDungeonExtracted(payload), {
    ok: true,
    runId: 'mist-vault-14',
    duplicate: false,
    saveChanged: true,
  })
  assert.equal(runtime.getMode(), 'world')
  assert.equal(runtime.getActiveRunId(), null)
  assert.equal(runtime.getSaveSnapshot().inventory.materials['mist-herb'], 2)
  assert.equal(repository.saved.length, 2)
})

test('duplicate matching extraction atomically returns to world without writing', () => {
  const repository = createRepository()
  const dungeon = createDungeonPort({ activeRunId: 'mist-vault-14', phase: 'extracted' })
  const runtime = createDualModeRuntime({
    initialSave: saveWithPasses(0, ['mist-vault-14']),
    repository,
    dungeon,
  })

  assert.deepEqual(runtime.handleDungeonExtracted({ runId: 'mist-vault-14', loot: [] }), {
    ok: true,
    runId: 'mist-vault-14',
    duplicate: true,
    saveChanged: false,
  })
  assert.equal(runtime.getMode(), 'world')
  assert.equal(runtime.getActiveRunId(), null)
  assert.equal(repository.saved.length, 0)
})

test('mismatched, invalid-loot, and persist-failed extraction remain active and retryable', () => {
  const repository = createRepository({ failAt: 2 })
  const dungeon = createDungeonPort()
  const runtime = createDualModeRuntime({
    initialSave: saveWithPasses(1),
    repository,
    dungeon,
  })
  assert.equal(runtime.enterDungeon(15).ok, true)
  dungeon.markExtracted()

  assert.deepEqual(
    runtime.handleDungeonExtracted({ runId: 'mist-vault-99', loot: [] }),
    { ok: false, reason: 'run-id-mismatch' },
  )
  assert.deepEqual(
    runtime.handleDungeonExtracted({ runId: 'mist-vault-15', loot: [{ itemId: '', amount: 1 }] }),
    { ok: false, reason: 'invalid-extraction-event' },
  )
  assert.deepEqual(
    runtime.handleDungeonExtracted({ runId: 'mist-vault-15', loot: [{ itemId: 'mist-herb', amount: 1 }] }),
    { ok: false, reason: 'save-persist-failed' },
  )
  assert.equal(runtime.getMode(), 'dungeon')
  assert.equal(runtime.getActiveRunId(), 'mist-vault-15')
  assert.equal(runtime.getSaveSnapshot().inventory.materials['mist-herb'], undefined)
  assert.equal(repository.saved.length, 1)
})

test('save snapshots are deeply isolated from coordinator state', () => {
  const initial = saveWithPasses(1)
  initial.inventory.materials['mist-herb'] = 2
  const runtime = createDualModeRuntime({
    initialSave: initial,
    repository: createRepository(),
    dungeon: createDungeonPort(),
  })

  const snapshot = runtime.getSaveSnapshot()
  snapshot.inventory.dungeonPasses = 99
  snapshot.inventory.materials['mist-herb'] = 99
  snapshot.rewardLedger.push('forged')

  assert.equal(runtime.getSaveSnapshot().inventory.dungeonPasses, 1)
  assert.equal(runtime.getSaveSnapshot().inventory.materials['mist-herb'], 2)
  assert.deepEqual(runtime.getSaveSnapshot().rewardLedger, [])
})
