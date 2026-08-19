import test from 'node:test'
import assert from 'node:assert/strict'
import { checkpointDungeonRun, createDungeonSession } from '../assets/Scripts/Core/Dungeon/DungeonSession.ts'
import { createDualModeRuntime } from '../assets/Scripts/Core/Progression/DualModeRuntime.ts'
import { createDefaultSave, migratePlayerSave } from '../assets/Scripts/Core/Progression/PlayerSave.ts'

function makeProfile() {
  return {
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
}

function makeCheckpoint(seed = 7) {
  return checkpointDungeonRun(createDungeonSession(makeProfile(), seed))
}

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
  authoritativeLoot = [],
  cancelOk = true,
  cancelThrows = false,
  ready = true,
  restoreOk = true,
} = {}) {
  let runId = activeRunId
  let runPhase = activeRunId ? phase : null
  let runCheckpoint = activeRunId ? makeCheckpoint(Number(activeRunId.split('-').at(-1)) || 7) : null
  const calls = { begin: [], cancel: 0, preview: [], ready: 0, restore: [], checkpoint: 0 }

  return {
    calls,
    isReady() {
      calls.ready += 1
      return ready
    },
    hasRun() {
      return runId !== null
    },
    currentRunId() {
      return runId
    },
    previewRunId(seed) {
      calls.preview.push(seed)
      return Number.isSafeInteger(seed) && seed >= 0 && seed <= 4294967295
        ? `mist-vault-${seed}`
        : null
    },
    begin(seed) {
      calls.begin.push(seed)
      if (!beginOk || runId !== null) return false
      runId = `mist-vault-${seed}`
      runPhase = 'exploring'
      runCheckpoint = makeCheckpoint(seed)
      return true
    },
    restore(value) {
      calls.restore.push(structuredClone(value))
      if (!restoreOk) return false
      runCheckpoint = structuredClone(value)
      runId = value.runId
      runPhase = value.phase
      return true
    },
    checkpoint() {
      calls.checkpoint += 1
      return runCheckpoint === null ? null : structuredClone(runCheckpoint)
    },
    cancelRun() {
      calls.cancel += 1
      if (cancelThrows) throw new Error('cancel unavailable')
      if (!cancelOk) return false
      if (runId === null) return false
      runId = null
      runPhase = null
      runCheckpoint = null
      return true
    },
    isExtractedRun(candidateRunId) {
      return runId === candidateRunId && runPhase === 'extracted'
    },
    extractedLoot(candidateRunId) {
      return runId === candidateRunId && runPhase === 'extracted'
        ? authoritativeLoot.map((item) => ({ ...item }))
        : null
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
  save.dungeon.dayKey = new Date().toISOString().slice(0, 10)
  save.dungeon.freeEntriesUsed = 3
  return save
}

test('not-ready dungeon rejects before preview, begin, checkpoint, payment, or persistence', () => {
  const repository = createRepository()
  const dungeon = createDungeonPort({ ready: false })
  dungeon.hasRun = () => { throw new Error('must not inspect a session before readiness') }
  const initial = saveWithPasses(2)
  const runtime = createDualModeRuntime({ initialSave: initial, repository, dungeon })

  assert.deepEqual(runtime.enterDungeon(4), { ok: false, reason: 'dungeon-not-ready' })
  assert.deepEqual(dungeon.calls.preview, [])
  assert.deepEqual(dungeon.calls.begin, [])
  assert.equal(dungeon.calls.checkpoint, 0)
  assert.equal(repository.saved.length, 0)
  assert.deepEqual(runtime.getSaveSnapshot(), initial)
})

test('entry records its checkpoint and free payment in the same single save', () => {
  const repository = createRepository()
  const dungeon = createDungeonPort()
  const runtime = createDualModeRuntime({
    initialSave: createDefaultSave(),
    repository,
    dungeon,
    dayKeySource: () => '2026-08-19',
  })

  assert.equal(runtime.enterDungeon(21).ok, true)
  assert.equal(repository.saved.length, 1)
  assert.equal(repository.saved[0].dungeon.dayKey, '2026-08-19')
  assert.equal(repository.saved[0].dungeon.freeEntriesUsed, 1)
  assert.equal(repository.saved[0].dungeon.activeRun.payment, 'free')
  assert.equal(repository.saved[0].dungeon.activeRun.checkpoint.runId, 'mist-vault-21')
})

test('entry rejects a missing post-begin checkpoint and rolls the session back without payment', () => {
  const repository = createRepository()
  const dungeon = createDungeonPort()
  dungeon.checkpoint = () => null
  const initial = saveWithPasses(1)
  const runtime = createDualModeRuntime({ initialSave: initial, repository, dungeon })

  assert.deepEqual(runtime.enterDungeon(22), { ok: false, reason: 'dungeon-checkpoint-failed' })
  assert.equal(dungeon.calls.cancel, 1)
  assert.equal(repository.saved.length, 0)
  assert.deepEqual(runtime.getSaveSnapshot(), initial)
})

test('entry rolls back a begun session when the daily key source fails', () => {
  const repository = createRepository()
  const dungeon = createDungeonPort()
  const initial = saveWithPasses(1)
  const runtime = createDualModeRuntime({
    initialSave: initial,
    repository,
    dungeon,
    dayKeySource: () => { throw new Error('clock unavailable') },
  })

  assert.deepEqual(runtime.enterDungeon(28), { ok: false, reason: 'invalid-day-key' })
  assert.equal(dungeon.calls.cancel, 1)
  assert.equal(repository.saved.length, 0)
  assert.deepEqual(runtime.getSaveSnapshot(), initial)
})

test('runtime restores a valid active checkpoint during initialization', () => {
  const checkpoint = makeCheckpoint(23)
  const save = createDefaultSave()
  save.dungeon.activeRun = { payment: 'free', checkpoint }
  save.dungeon.freeEntriesUsed = 1
  const dungeon = createDungeonPort()

  const runtime = createDualModeRuntime({ initialSave: save, repository: createRepository(), dungeon })

  assert.equal(runtime.getMode(), 'dungeon')
  assert.equal(runtime.getActiveRunId(), 'mist-vault-23')
  assert.equal(dungeon.calls.restore.length, 1)
})

test('failed restore remains recoverable and refunds once only after persistence succeeds', () => {
  const checkpoint = makeCheckpoint(24)
  const save = createDefaultSave()
  save.inventory.dungeonPasses = 0
  save.dungeon.activeRun = { payment: 'pass', checkpoint }
  const repository = createRepository({ failAt: 1 })
  const dungeon = createDungeonPort({ restoreOk: false })
  const runtime = createDualModeRuntime({ initialSave: save, repository, dungeon })

  assert.equal(runtime.getMode(), 'world')
  assert.deepEqual(runtime.recoverDungeonRestoreFailure(), { ok: false, reason: 'save-persist-failed' })
  assert.notEqual(runtime.getSaveSnapshot().dungeon.activeRun, null)
  assert.equal(runtime.getSaveSnapshot().inventory.dungeonPasses, 0)

  repository.save = (value) => repository.saved.push(migratePlayerSave(value))
  assert.deepEqual(runtime.recoverDungeonRestoreFailure(), { ok: true, saveChanged: true })
  assert.equal(runtime.getSaveSnapshot().dungeon.activeRun, null)
  assert.equal(runtime.getSaveSnapshot().inventory.dungeonPasses, 1)
  assert.deepEqual(runtime.recoverDungeonRestoreFailure(), { ok: false, reason: 'no-restore-failure' })
  assert.equal(runtime.getSaveSnapshot().inventory.dungeonPasses, 1)
})

test('checkpoint updates replace active progress with one atomic save and remain retryable', () => {
  const repository = createRepository({ failAt: 2 })
  const dungeon = createDungeonPort()
  const runtime = createDualModeRuntime({
    initialSave: saveWithPasses(1),
    repository,
    dungeon,
  })
  assert.equal(runtime.enterDungeon(25).ok, true)
  const nextCheckpoint = dungeon.checkpoint()
  nextCheckpoint.eventSequence = 4

  assert.deepEqual(runtime.handleDungeonCheckpoint(nextCheckpoint), {
    ok: false,
    reason: 'save-persist-failed',
  })
  assert.equal(runtime.getSaveSnapshot().dungeon.activeRun.checkpoint.eventSequence, 0)

  repository.save = (value) => repository.saved.push(migratePlayerSave(value))
  assert.deepEqual(runtime.handleDungeonCheckpoint(nextCheckpoint), { ok: true, saveChanged: true })
  assert.equal(runtime.getSaveSnapshot().dungeon.activeRun.checkpoint.eventSequence, 4)
  assert.equal(repository.saved.length, 2)
})

test('defeat and abandon persist only retained loot, clear activeRun, and return to world', () => {
  for (const method of ['handleDungeonDefeated', 'handleDungeonAbandoned']) {
    const repository = createRepository()
    const dungeon = createDungeonPort()
    const runtime = createDualModeRuntime({
      initialSave: saveWithPasses(1),
      repository,
      dungeon,
    })
    assert.equal(runtime.enterDungeon(26).ok, true)

    const result = runtime[method]({
      type: method === 'handleDungeonDefeated' ? 'dungeon-defeated' : 'dungeon-abandoned',
      retainedLoot: [{ itemId: 'realm-experience', amount: 8 }],
    })

    assert.deepEqual(result, { ok: true, runId: 'mist-vault-26', saveChanged: true })
    assert.equal(repository.saved.length, 2)
    assert.equal(runtime.getMode(), 'world')
    assert.equal(runtime.getActiveRunId(), null)
    assert.equal(runtime.getSaveSnapshot().dungeon.activeRun, null)
    assert.equal(runtime.getSaveSnapshot().inventory.materials['realm-experience'], 8)
  }
})

test('terminal persistence failure leaves active run and retained loot retryable', () => {
  const repository = createRepository({ failAt: 2 })
  const dungeon = createDungeonPort()
  const runtime = createDualModeRuntime({
    initialSave: saveWithPasses(1),
    repository,
    dungeon,
  })
  assert.equal(runtime.enterDungeon(27).ok, true)
  const event = { type: 'dungeon-defeated', retainedLoot: [{ itemId: 'realm-experience', amount: 3 }] }

  assert.deepEqual(runtime.handleDungeonDefeated(event), { ok: false, reason: 'save-persist-failed' })
  assert.equal(runtime.getMode(), 'dungeon')
  assert.notEqual(runtime.getSaveSnapshot().dungeon.activeRun, null)
  assert.equal(runtime.getSaveSnapshot().inventory.materials['realm-experience'], undefined)

  repository.save = (value) => repository.saved.push(migratePlayerSave(value))
  assert.equal(runtime.handleDungeonDefeated(event).ok, true)
  assert.equal(runtime.getSaveSnapshot().inventory.materials['realm-experience'], 3)
})

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
  const dungeon = createDungeonPort({ authoritativeLoot: [{ itemId: 'mist-herb', amount: 2 }] })
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

test('extraction rejects caller loot that differs from the authoritative dungeon session', () => {
  const repository = createRepository()
  const dungeon = createDungeonPort({ authoritativeLoot: [{ itemId: 'flying-sword', amount: 1 }] })
  const runtime = createDualModeRuntime({
    initialSave: saveWithPasses(1),
    repository,
    dungeon,
  })
  assert.equal(runtime.enterDungeon(18).ok, true)
  dungeon.markExtracted()

  assert.deepEqual(runtime.handleDungeonExtracted({
    runId: 'mist-vault-18',
    loot: [{ itemId: 'flying-sword', amount: 999999 }],
  }), { ok: false, reason: 'loot-mismatch' })
  assert.equal(runtime.getMode(), 'dungeon')
  assert.equal(runtime.getSaveSnapshot().inventory.artifacts['flying-sword'], undefined)
  assert.equal(repository.saved.length, 1)
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
  const dungeon = createDungeonPort({ authoritativeLoot: [{ itemId: 'mist-herb', amount: 1 }] })
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
