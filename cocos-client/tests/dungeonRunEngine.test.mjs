import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  advanceDungeonRun,
  applyDungeonCommand,
  applyPursuerDamage,
  beginDungeonExtraction,
  beginSecondPursuit,
  checkpointDungeonRun,
  chooseDungeonExit,
  createDungeonSession,
  defeatDungeonRun,
  interruptDungeonRun,
  restoreDungeonSession,
  searchCurrentRoom,
  validateDungeonCheckpointShape,
} from '../assets/Scripts/Core/Dungeon/DungeonSession.ts'

const profile = JSON.parse(
  await readFile(new URL('../assets/resources/Data/dual-mode-slice.json', import.meta.url), 'utf8'),
)

function makeRun(seed = 41) {
  return createDungeonSession(structuredClone(profile), seed)
}

function advanceTicks(run, count, paused = false) {
  const events = []
  for (let step = 0; step < count; step += 1) {
    events.push(...advanceDungeonRun(run, 0.1, { paused }).events)
  }
  return events
}

function reachDamagedExit(run) {
  chooseDungeonExit(run, 'f1-entry-to-forest')
  chooseDungeonExit(run, 'f1-forest-to-floor2')
  chooseDungeonExit(run, 'f2-bridge-to-exit')
}

function reachAltar(run) {
  chooseDungeonExit(run, 'f1-entry-to-forest')
  chooseDungeonExit(run, 'f1-forest-to-floor2')
  searchCurrentRoom(run)
  chooseDungeonExit(run, 'f2-bridge-to-sword-array')
  chooseDungeonExit(run, 'f2-sword-array-to-elite')
  chooseDungeonExit(run, 'f2-elite-to-floor3')
  chooseDungeonExit(run, 'f3-antechamber-to-altar')
}

test('production dungeon session exposes no route-skipping movement helper', async () => {
  const source = await readFile(
    new URL('../assets/Scripts/Core/Dungeon/DungeonSession.ts', import.meta.url),
    'utf8',
  )
  assert.doesNotMatch(source, /\bmoveRunTo\b/)
})

test('session owns map, pressure, pursuer, extraction and serializable rewards', () => {
  const run = makeRun(7)
  assert.equal(run.seed, 7)
  assert.equal(run.map.currentRoomId, profile.entryRoomId)
  assert.equal(Object.keys(run).includes('currentRoomId'), false)
  assert.equal(Object.hasOwn(JSON.parse(JSON.stringify(run)), 'currentRoomId'), false)
  assert.deepEqual(run.pressure, { elapsedSeconds: 0, phase: 'calm' })
  assert.equal(run.pursuer.phase, 'dormant')
  assert.deepEqual(run.extraction, { phase: 'idle', roomId: null, progressSeconds: 0 })
  assert.deepEqual(run.boundLoot, [])
  assert.equal(run.eventSequence, 0)
})

test('explicit commands search once, charge a chosen exit once, and clone events', () => {
  const run = makeRun()
  let result = applyDungeonCommand(run, { type: 'search' })
  assert.equal(result.accepted, true)
  assert.equal(run.eventSequence, 1)
  assert.equal(run.searchedRoomIds.includes('f1-entry'), true)

  result = applyDungeonCommand(run, { type: 'choose-exit', exitId: 'f1-entry-to-forest' })
  assert.equal(result.accepted, true)
  assert.equal(run.map.currentRoomId, 'f1-forest-combat')
  assert.equal(run.eventSequence, 2)

  const searched = applyDungeonCommand(run, { type: 'search' })
  assert.equal(searched.accepted, true)
  assert.equal(run.doorCurrency, 2)
  const lootEvent = searched.events.find((event) => event.type === 'room-searched')
  lootEvent.loot[0].amount = 999
  assert.equal(run.carriedLoot[0].amount, 2)

  const paid = applyDungeonCommand(run, { type: 'choose-exit', exitId: 'f1-forest-to-sealed-cache' })
  assert.equal(paid.accepted, true)
  assert.equal(run.doorCurrency, 0)
  assert.equal(run.eventSequence, 4)

  const before = structuredClone(run)
  assert.deepEqual(applyDungeonCommand(run, { type: 'choose-exit', exitId: 'missing' }), {
    accepted: false,
    reason: 'unknown-exit',
    events: [],
  })
  assert.deepEqual(run, before)
})

test('one deterministic run searches, pays, triggers both hunts, and extracts early', () => {
  const run = makeRun(41)
  searchCurrentRoom(run)
  chooseDungeonExit(run, 'f1-entry-to-forest')
  const phaseEvents = advanceTicks(run, 1200)
  assert.equal(run.pressure.phase, 'restless')
  assert.equal(run.pursuer.phase, 'first-hunt')
  assert.equal(phaseEvents.filter((event) => event.type === 'pursuer-hunt-started').length, 1)

  applyPursuerDamage(run, 999)
  chooseDungeonExit(run, 'f1-forest-to-floor2')
  searchCurrentRoom(run)
  const second = beginSecondPursuit(run)
  assert.equal(second.accepted, true)
  assert.equal(run.pursuer.phase, 'second-hunt')
  applyPursuerDamage(run, 999)

  chooseDungeonExit(run, 'f2-bridge-to-sword-array')
  chooseDungeonExit(run, 'f2-sword-array-to-elite')
  chooseDungeonExit(run, 'f2-elite-to-exit')
  beginDungeonExtraction(run)
  advanceTicks(run, 30)
  assert.equal(run.phase, 'extracted')
  assert.equal(run.pursuer.phase, 'second-repelled')
})

test('second pursuit seals a reachable exit on the current floor before older routes', () => {
  const run = makeRun(42)
  chooseDungeonExit(run, 'f1-entry-to-forest')
  advanceTicks(run, 1200)
  applyPursuerDamage(run, 999)
  chooseDungeonExit(run, 'f1-forest-to-floor2')
  assert.equal(run.map.currentRoomId, 'f2-bridge-combat')

  const result = beginSecondPursuit(run)
  const sealed = result.events.find((event) => event.type === 'route-sealed')
  assert.ok(sealed)
  const sourceRoom = profile.rooms.find((room) => room.exits.some((exit) => exit.id === sealed.exitId))
  assert.equal(sourceRoom.floor, 2)
  assert.equal(sourceRoom.id, 'f2-bridge-combat')
})

test('entering the floor-two elite gate starts the second pursuit in the same checkpoint', () => {
  const run = makeRun(44)
  chooseDungeonExit(run, 'f1-entry-to-forest')
  advanceTicks(run, 1200)
  applyPursuerDamage(run, 999)
  chooseDungeonExit(run, 'f1-forest-to-floor2')
  searchCurrentRoom(run)
  chooseDungeonExit(run, 'f2-bridge-to-sword-array')
  searchCurrentRoom(run)

  const result = chooseDungeonExit(run, 'f2-sword-array-to-elite')

  assert.equal(result.accepted, true)
  assert.equal(run.map.currentRoomId, 'f2-gate-elite')
  assert.equal(run.pursuer.phase, 'second-hunt')
  assert.equal(result.events.some((event) => event.type === 'pursuer-hunt-started' && event.hunt === 2), true)
  assert.equal(result.events.some((event) => event.type === 'route-sealed'), true)

  const checkpoint = checkpointDungeonRun(run)
  const restored = restoreDungeonSession(profile, JSON.parse(JSON.stringify(checkpoint)))
  assert.equal(restored.map.currentRoomId, 'f2-gate-elite')
  assert.equal(restored.pursuer.phase, 'second-hunt')
})

test('second pursuit rejects atomically when the current floor has no safe seal candidate', () => {
  const run = makeRun(43)
  chooseDungeonExit(run, 'f1-entry-to-forest')
  advanceTicks(run, 1200)
  applyPursuerDamage(run, 999)
  chooseDungeonExit(run, 'f1-forest-to-floor2')
  const floorTwoExitIds = profile.rooms
    .filter((room) => room.floor === 2)
    .flatMap((room) => room.exits.map((exit) => exit.id))
  run.map.sealedExitIds.push(...floorTwoExitIds.filter((id) => !run.map.sealedExitIds.includes(id)))
  const before = JSON.stringify(run)

  assert.deepEqual(beginSecondPursuit(run), {
    accepted: false,
    reason: 'no-safe-route',
    events: [],
  })
  assert.equal(JSON.stringify(run), before)
})

test('paused frames advance neither pressure nor extraction and elite damage returns to exploring', () => {
  const run = makeRun()
  reachDamagedExit(run)
  assert.equal(beginDungeonExtraction(run).accepted, true)

  advanceDungeonRun(run, 10, { paused: true })
  assert.equal(run.pressure.elapsedSeconds, 0)
  assert.equal(run.extraction.progressSeconds, 0)

  advanceDungeonRun(run, 0.1, { paused: false })
  const ordinary = interruptDungeonRun(run, { sourceRole: 'ordinary', effectiveDamage: 5 })
  assert.equal(ordinary.accepted, false)
  assert.equal(run.phase, 'extracting')

  const interrupted = interruptDungeonRun(run, { sourceRole: 'elite', effectiveDamage: 1 })
  assert.equal(interrupted.accepted, true)
  assert.equal(run.phase, 'exploring')
  assert.equal(run.extraction.phase, 'idle')
})

test('damaged and full extraction settlements contain stable isolated fields', () => {
  const damaged = makeRun(10)
  damaged.boundLoot.push({ itemId: 'realm-experience', amount: 8 })
  reachDamagedExit(damaged)
  beginDungeonExtraction(damaged)
  const damagedEvents = advanceTicks(damaged, 30)
  const damagedSettlement = damagedEvents.find((event) => event.type === 'extraction-completed')
  assert.equal(damagedSettlement.exitKind, 'damaged')
  assert.equal(damagedSettlement.bossDefeated, false)
  assert.ok(damagedSettlement.explorationRate >= 0 && damagedSettlement.explorationRate <= 1)
  assert.deepEqual(damagedSettlement.retainedLoot, [{ itemId: 'realm-experience', amount: 8 }])

  damagedSettlement.retainedLoot[0].amount = 999
  assert.equal(damaged.boundLoot[0].amount, 8)

  const full = makeRun(11)
  reachAltar(full)
  chooseDungeonExit(full, 'f3-altar-to-antechamber')
  chooseDungeonExit(full, 'f3-antechamber-to-exit')
  beginDungeonExtraction(full)
  const fullSettlement = advanceTicks(full, 30).find((event) => event.type === 'extraction-completed')
  assert.equal(fullSettlement.exitKind, 'full')
})

test('final Boss defeat opens every sword-vault entrance exactly once', () => {
  const run = makeRun()
  reachAltar(run)
  run.pursuer.phase = 'second-repelled'
  assert.equal(applyDungeonCommand(run, { type: 'activate-altar' }).accepted, true)
  assert.equal(run.pursuer.phase, 'final-fight')

  const defeated = applyPursuerDamage(run, 1200)
  assert.equal(defeated.accepted, true)
  assert.equal(defeated.events.filter((event) => event.type === 'route-unsealed').length, 2)
  const swordVaultEntrances = profile.rooms.flatMap((room) =>
    room.exits.filter((exit) => exit.to === 'f3-sword-vault').map((exit) => exit.id),
  )
  assert.equal(swordVaultEntrances.some((id) => run.map.sealedExitIds.includes(id)), false)

  const sequence = run.eventSequence
  const repeated = applyPursuerDamage(run, 1)
  assert.equal(repeated.accepted, false)
  assert.deepEqual(repeated.events, [])
  assert.equal(run.eventSequence, sequence)

  chooseDungeonExit(run, 'f3-altar-to-vault')
  chooseDungeonExit(run, 'f3-vault-to-exit')
  beginDungeonExtraction(run)
  const settlement = advanceTicks(run, 30).find((event) => event.type === 'extraction-completed')
  assert.equal(settlement.exitKind, 'full')
  assert.equal(settlement.bossDefeated, true)
})

test('defeat and abandon are terminal, idempotent, and retain only bound loot', () => {
  for (const finish of [
    (run) => defeatDungeonRun(run),
    (run) => applyDungeonCommand(run, { type: 'abandon' }),
  ]) {
    const run = makeRun()
    run.boundLoot.push({ itemId: 'realm-experience', amount: 8 })
    run.carriedLoot.push({ itemId: 'mist-herb', amount: 3 })
    const result = finish(run)
    assert.deepEqual(result.retainedLoot, [{ itemId: 'realm-experience', amount: 8 }])
    if (result.phase === 'defeated') {
      assert.deepEqual(result, {
        phase: 'defeated',
        retainedLoot: [{ itemId: 'realm-experience', amount: 8 }],
      })
    }
    assert.deepEqual(run.carriedLoot, [])
    assert.equal(result.events?.some((event) => event.type === 'extraction-completed') ?? false, false)

    const sequence = run.eventSequence
    finish(run)
    assert.equal(run.eventSequence, sequence)
  }
})

test('defeat cannot rewrite an already extracted terminal result', () => {
  const run = makeRun(25)
  reachDamagedExit(run)
  beginDungeonExtraction(run)
  advanceTicks(run, 30)
  const sequence = run.eventSequence

  const result = defeatDungeonRun(run)
  assert.equal(result.phase, 'extracted')
  assert.equal(run.phase, 'extracted')
  assert.equal(run.eventSequence, sequence)
})

test('checkpoint JSON round-trips with deep isolation', () => {
  const run = makeRun(99)
  chooseDungeonExit(run, 'f1-entry-to-forest')
  searchCurrentRoom(run)
  run.boundLoot.push({ itemId: 'realm-experience', amount: 4 })
  advanceDungeonRun(run, 0.1, { paused: false })

  const checkpoint = checkpointDungeonRun(run)
  assert.doesNotThrow(() => validateDungeonCheckpointShape(checkpoint))
  const restored = restoreDungeonSession(profile, JSON.parse(JSON.stringify(checkpoint)))
  assert.deepEqual(checkpointDungeonRun(restored), checkpoint)

  restored.map.revealedRoomIds.push('f1-alchemy')
  restored.carriedLoot[0].amount = 999
  assert.equal(run.map.revealedRoomIds.includes('f1-alchemy'), false)
  assert.notEqual(run.carriedLoot[0].amount, 999)
})

test('checkpoint shape and profile restoration reject corrupted identity and runtime state', () => {
  const checkpoint = checkpointDungeonRun(makeRun(17))
  const malformed = [
    { ...checkpoint, schemaVersion: 2 },
    { ...checkpoint, seed: -1 },
    { ...checkpoint, runId: ' bad ' },
    { ...checkpoint, eventSequence: 1.5 },
    { ...checkpoint, carriedLoot: [{ itemId: '', amount: 1 }] },
    { ...checkpoint, pressure: { elapsedSeconds: 120, phase: 'calm' } },
    { ...checkpoint, extraction: { phase: 'channeling', roomId: null, progressSeconds: 1 } },
    {
      ...checkpoint,
      extraction: { phase: 'channeling', roomId: 'f2-damaged-exit', progressSeconds: 1 },
    },
    {
      ...checkpoint,
      pressure: { elapsedSeconds: 120, phase: 'restless' },
    },
    {
      ...checkpoint,
      phase: 'defeated',
      carriedLoot: [{ itemId: 'mist-herb', amount: 1 }],
    },
    {
      ...checkpoint,
      phase: 'abandoned',
      carriedLoot: [{ itemId: 'mist-herb', amount: 1 }],
    },
    {
      ...checkpoint,
      pursuer: {
        ...checkpoint.pursuer,
        phase: 'first-hunt',
        shield: checkpoint.pursuer.firstShieldMax,
      },
    },
  ]
  for (const candidate of malformed) assert.throws(() => validateDungeonCheckpointShape(candidate), TypeError)

  const mismatches = [
    { ...checkpoint, profileId: 'other-profile' },
    { ...checkpoint, map: { ...checkpoint.map, currentRoomId: 'missing-room' } },
    { ...checkpoint, map: { ...checkpoint.map, revealedRoomIds: ['f1-entry', 'missing-room'] } },
    { ...checkpoint, map: { ...checkpoint.map, sealedExitIds: ['missing-exit'] } },
    { ...checkpoint, searchedRoomIds: ['missing-room'] },
    {
      ...checkpoint,
      phase: 'extracting',
      extraction: { phase: 'channeling', roomId: 'f2-damaged-exit', progressSeconds: 1 },
    },
  ]
  for (const candidate of mismatches) {
    assert.throws(() => restoreDungeonSession(profile, candidate), TypeError)
  }
})

test('restoration rejects dead-end seals and cross-runtime contradictions', () => {
  const checkpoint = checkpointDungeonRun(makeRun(23))

  const strandedSideRoom = structuredClone(checkpoint)
  strandedSideRoom.map.sealedExitIds.push('f1-alchemy-to-forest')
  assert.throws(() => restoreDungeonSession(profile, strandedSideRoom), /route/i)

  const missedFirstHunt = structuredClone(checkpoint)
  missedFirstHunt.pressure = { elapsedSeconds: 120, phase: 'restless' }
  assert.throws(() => restoreDungeonSession(profile, missedFirstHunt), /pursuer|pressure/i)

  const defeatedButLocked = structuredClone(checkpoint)
  defeatedButLocked.pressure = { elapsedSeconds: 120, phase: 'restless' }
  defeatedButLocked.map.revealedRoomIds = [
    'f1-entry',
    'f1-forest-combat',
    'f2-bridge-combat',
    'f2-sword-array',
    'f2-gate-elite',
    'f3-antechamber',
    'f3-altar',
  ]
  defeatedButLocked.pursuer = {
    ...defeatedButLocked.pursuer,
    phase: 'defeated',
    shield: 0,
    finalHealth: 0,
    altarUnlocked: true,
  }
  assert.throws(() => restoreDungeonSession(profile, defeatedButLocked), /vault|seal/i)

  const removedPermanentSeal = structuredClone(checkpoint)
  removedPermanentSeal.map.sealedExitIds = removedPermanentSeal.map.sealedExitIds.filter(
    (exitId) => exitId !== 'f3-vault-to-altar',
  )
  assert.throws(() => restoreDungeonSession(profile, removedPermanentSeal), /seal/i)
})

test('restoration rejects discontinuous reveal history and advanced Boss state without the altar', () => {
  const checkpoint = checkpointDungeonRun(makeRun(26))
  const discontinuousCurrent = structuredClone(checkpoint)
  discontinuousCurrent.map.currentRoomId = 'f3-altar'
  discontinuousCurrent.map.revealedRoomIds = ['f1-entry', 'f3-altar']
  assert.throws(() => restoreDungeonSession(profile, discontinuousCurrent), /reveal|history|connected/i)

  const defeatedWithoutAltar = structuredClone(checkpoint)
  defeatedWithoutAltar.pressure = { elapsedSeconds: 240, phase: 'frenzy' }
  defeatedWithoutAltar.pursuer = {
    ...defeatedWithoutAltar.pursuer,
    phase: 'defeated',
    shield: 0,
    finalHealth: 0,
    altarUnlocked: true,
  }
  defeatedWithoutAltar.map.sealedExitIds = defeatedWithoutAltar.map.sealedExitIds.filter((exitId) =>
    !profile.rooms.some((room) =>
      room.exits.some((exit) => exit.id === exitId && exit.to === 'f3-sword-vault'),
    ),
  )
  assert.throws(() => restoreDungeonSession(profile, defeatedWithoutAltar), /altar|reveal/i)
})

test('oversized frames share one bounded delta and completion is emitted only once', () => {
  const run = makeRun(24)
  reachDamagedExit(run)
  beginDungeonExtraction(run)

  advanceDungeonRun(run, 50, { paused: false })
  assert.equal(run.pressure.elapsedSeconds, 0.1)
  assert.equal(run.extraction.progressSeconds, 0.1)

  const events = advanceTicks(run, 29)
  assert.equal(events.filter((event) => event.type === 'extraction-completed').length, 1)
  assert.equal(run.phase, 'extracted')
  assert.deepEqual(advanceDungeonRun(run, 1, { paused: false }), { events: [] })
})
