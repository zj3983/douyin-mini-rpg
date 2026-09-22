import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  createDungeonSession,
  enterRoom,
  extractRun,
  searchRoom,
  validateDungeonProfile,
} from '../assets/Scripts/Core/Dungeon/DungeonSession.ts'
import { interactDungeonRun } from '../assets/Scripts/Core/Dungeon/DungeonInteraction.ts'

function makeProfile() {
  return {
    id: 'mist-vault',
    entryRoomId: 'f1-entry',
    extractionRoomIds: ['f3-gate'],
    finalExtractionRoomId: 'f3-gate',
    bossAltarRoomId: 'f3-altar',
    rooms: [
      {
        id: 'f1-entry',
        floor: 1,
        kind: 'entry',
        sceneId: 'mist-entry',
        risk: 'low',
        exits: [
          { id: 'entry-to-store', to: 'f1-store', cost: 2 },
          { id: 'entry-to-alchemy', to: 'f2-alchemy', cost: 0 },
        ],
      },
      {
        id: 'f1-store',
        floor: 1,
        kind: 'treasure',
        sceneId: 'mist-store',
        risk: 'medium',
        exits: [{ id: 'store-to-gate', to: 'f3-gate', cost: 0 }],
        loot: [{ itemId: 'flying-sword', amount: 1 }],
        doorCurrency: 2,
        searchPressureSeconds: 20,
      },
      {
        id: 'f2-alchemy',
        floor: 2,
        kind: 'alchemy',
        sceneId: 'mist-alchemy',
        risk: 'medium',
        exits: [
          { id: 'alchemy-to-gate', to: 'f3-gate', cost: 0 },
          { id: 'alchemy-to-altar', to: 'f3-altar', cost: 0 },
        ],
        loot: [{ itemId: 'mist-herb', amount: 2 }],
        searchPressureSeconds: 12,
      },
      {
        id: 'f3-gate',
        floor: 3,
        kind: 'extraction',
        sceneId: 'mist-gate',
        risk: 'high',
        exits: [],
      },
      {
        id: 'f3-altar',
        floor: 3,
        kind: 'boss',
        sceneId: 'mist-altar',
        risk: 'extreme',
        encounterId: 'mist-emperor',
        exits: [{ id: 'altar-to-gate', to: 'f3-gate', cost: 0 }],
      },
    ],
  }
}

test('locked doors reject entry without mutating the run', () => {
  const run = createDungeonSession(makeProfile(), 7)
  const before = JSON.stringify(run)

  assert.deepEqual(enterRoom(run, 'f1-store'), { ok: false, reason: 'door-cost' })
  assert.equal(JSON.stringify(run), before)
})

test('entering a connected room deducts the exact door cost', () => {
  const run = createDungeonSession(makeProfile(), 7)
  run.doorCurrency = 5

  assert.deepEqual(enterRoom(run, 'f1-store'), { ok: true })
  assert.equal(run.currentRoomId, 'f1-store')
  assert.equal(run.doorCurrency, 3)
})

test('invalid door currency rejects entry without mutating the run', () => {
  for (const currency of [Number.NaN, Number.POSITIVE_INFINITY, -1, 1.5]) {
    const run = createDungeonSession(makeProfile(), 7)
    run.doorCurrency = currency
    const currentRoomId = run.currentRoomId

    assert.deepEqual(enterRoom(run, 'f1-store'), { ok: false, reason: 'invalid-currency' })
    assert.equal(run.currentRoomId, currentRoomId)
    assert.ok(Object.is(run.doorCurrency, currency))
  }
})

test('disconnected and inactive entry attempts do not mutate the run', () => {
  const run = createDungeonSession(makeProfile(), 7)
  run.doorCurrency = 9
  const beforeDisconnected = JSON.stringify(run)

  assert.deepEqual(enterRoom(run, 'f3-gate'), { ok: false, reason: 'not-connected' })
  assert.equal(JSON.stringify(run), beforeDisconnected)

  run.phase = 'defeated'
  const beforeInactive = JSON.stringify(run)
  assert.deepEqual(enterRoom(run, 'f2-alchemy'), { ok: false, reason: 'inactive' })
  assert.equal(JSON.stringify(run), beforeInactive)
})

test('sessions and searched loot are deeply isolated and rooms can be searched only once', () => {
  const profile = makeProfile()
  const first = createDungeonSession(profile, 7)
  const second = createDungeonSession(profile, 8)

  assert.equal(first.id, 'mist-vault-7')
  assert.equal(first.currentRoomId, 'f1-entry')
  assert.equal(first.doorCurrency, 0)
  assert.notEqual(first.profile, profile)
  assert.notEqual(first.profile.extractionRoomIds, profile.extractionRoomIds)
  assert.notEqual(first.profile.rooms[1], profile.rooms[1])
  assert.notEqual(first.profile.rooms[1].loot, profile.rooms[1].loot)

  profile.rooms[1].loot[0].amount = 99
  first.profile.rooms[1].exits[0].cost = 4
  assert.equal(second.profile.rooms[1].loot[0].amount, 1)
  assert.equal(second.profile.rooms[1].exits[0].cost, 0)

  first.doorCurrency = 2
  assert.equal(enterRoom(first, 'f1-store').ok, true)
  const searched = searchRoom(first)
  assert.deepEqual(searched.loot, [{ itemId: 'flying-sword', amount: 1 }])
  assert.notEqual(searched.loot[0], first.profile.rooms[1].loot[0])
  assert.notEqual(searched.loot[0], first.carriedLoot[0])

  searched.loot[0].amount = 50
  assert.deepEqual(first.carriedLoot, [{ itemId: 'flying-sword', amount: 1 }])
  assert.deepEqual(searchRoom(first), { ok: false, reason: 'already-searched', loot: [], doorCurrencyGranted: 0 })

  first.map.currentRoomId = 'missing-room'
  assert.deepEqual(searchRoom(first), { ok: false, reason: 'missing-room', loot: [], doorCurrencyGranted: 0 })
  first.phase = 'defeated'
  first.map.currentRoomId = 'f1-entry'
  assert.deepEqual(searchRoom(first), { ok: false, reason: 'inactive', loot: [], doorCurrencyGranted: 0 })
})

test('room search grants configured door currency and loot exactly once', () => {
  const run = createDungeonSession(makeProfile(), 11)
  run.doorCurrency = 2
  assert.equal(enterRoom(run, 'f1-store').ok, true)

  assert.deepEqual(searchRoom(run), {
    ok: true,
    loot: [{ itemId: 'flying-sword', amount: 1 }],
    doorCurrencyGranted: 2,
  })
  assert.equal(run.doorCurrency, 2)
  assert.deepEqual(searchRoom(run), {
    ok: false,
    reason: 'already-searched',
    loot: [],
    doorCurrencyGranted: 0,
  })
  assert.equal(run.doorCurrency, 2)
  assert.deepEqual(run.carriedLoot, [{ itemId: 'flying-sword', amount: 1 }])
})

test('room search rejects unsafe currency totals atomically', () => {
  const run = createDungeonSession(makeProfile(), 12)
  run.doorCurrency = 2
  assert.equal(enterRoom(run, 'f1-store').ok, true)
  run.doorCurrency = Number.MAX_SAFE_INTEGER
  const before = structuredClone(run)

  assert.deepEqual(searchRoom(run), {
    ok: false,
    reason: 'invalid-currency',
    loot: [],
    doorCurrencyGranted: 0,
  })
  assert.deepEqual(run, before)
})

test('profile validation accepts positive safe room currency and rejects invalid rewards', () => {
  assert.doesNotThrow(() => validateDungeonProfile(makeProfile()))
  for (const reward of [0, -1, 1.5, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
    const profile = makeProfile()
    profile.rooms[1].doorCurrency = reward
    assert.throws(() => validateDungeonProfile(profile), /door currency/i)
  }
})

test('Core interaction requires explicit commands and never auto-routes', () => {
  const run = createDungeonSession(makeProfile(), 13)
  const before = JSON.stringify(run)
  assert.deepEqual(interactDungeonRun(run), { accepted: false, reason: 'invalid-phase', events: [] })
  assert.equal(JSON.stringify(run), before)

  assert.equal(interactDungeonRun(run, { type: 'search' }).accepted, true)
  assert.equal(interactDungeonRun(run, { type: 'choose-exit', exitId: 'entry-to-alchemy' }).accepted, true)
  assert.equal(interactDungeonRun(run, { type: 'search' }).accepted, true)
  assert.equal(interactDungeonRun(run, { type: 'choose-exit', exitId: 'alchemy-to-gate' }).accepted, true)
  assert.equal(run.currentRoomId, 'f3-gate')
  assert.equal(run.phase, 'exploring')
})

test('deprecated extraction adapter starts channeling but cannot settle the run', () => {
  const run = createDungeonSession(makeProfile(), 7)

  assert.deepEqual(extractRun(run), { ok: false, reason: 'wrong-room', loot: [] })
  assert.equal(run.phase, 'exploring')

  run.doorCurrency = 2
  assert.deepEqual(enterRoom(run, 'f1-store'), { ok: true })
  assert.deepEqual(searchRoom(run), {
    ok: true,
    loot: [{ itemId: 'flying-sword', amount: 1 }],
    doorCurrencyGranted: 2,
  })
  assert.deepEqual(enterRoom(run, 'f3-gate'), { ok: true })
  assert.deepEqual(extractRun(run), { ok: false, reason: 'channeling', loot: [] })
  assert.equal(run.phase, 'extracting')
  assert.equal(run.extraction.phase, 'channeling')
  assert.equal(run.carriedLoot[0].amount, 1)
  assert.deepEqual(extractRun(run), { ok: false, reason: 'inactive', loot: [] })
  assert.equal(run.phase, 'extracting')
})

test('profile validation enforces runtime identity and room kind invariants', () => {
  const cases = [
    ['blank profile ID', (profile) => { profile.id = '  ' }],
    ['blank room ID', (profile) => { profile.rooms[1].id = '  ' }],
    ['noncanonical room ID', (profile) => { profile.rooms[1].id = ' f1-store ' }],
    ['invalid room kind', (profile) => { profile.rooms[1].kind = 'shop' }],
    ['same entry and extraction', (profile) => {
      profile.extractionRoomIds = [profile.entryRoomId]
      profile.finalExtractionRoomId = profile.entryRoomId
    }],
    ['wrong entry kind', (profile) => { profile.rooms[0].kind = 'combat' }],
    ['wrong extraction kind', (profile) => { profile.rooms[3].kind = 'treasure' }],
    ['boss altar below floor three', (profile) => { profile.rooms[4].floor = 2 }],
    ['boss altar is not the boss room', (profile) => { profile.bossAltarRoomId = 'f3-gate' }],
    ['more than one boss room', (profile) => { profile.rooms[2].kind = 'boss' }],
  ]

  for (const [name, mutate] of cases) {
    const profile = makeProfile()
    mutate(profile)
    assert.throws(() => validateDungeonProfile(profile), undefined, name)
  }
})

test('profile validation rejects rooms unreachable from entry', () => {
  const profile = makeProfile()
  profile.rooms.push({
    id: 'f2-orphan',
    floor: 2,
    kind: 'combat',
    sceneId: 'mist-orphan',
    risk: 'medium',
    exits: [{ id: 'orphan-to-gate', to: 'f3-gate', cost: 0 }],
  })

  assert.throws(() => validateDungeonProfile(profile), /unreachable from the entry/i)
})

test('profile validation rejects reachable rooms with no path to extraction', () => {
  const profile = makeProfile()
  profile.rooms[0].exits.push({ id: 'entry-to-dead-end', to: 'f1-dead-end', cost: 0 })
  profile.rooms.push({
    id: 'f1-dead-end',
    floor: 1,
    kind: 'combat',
    sceneId: 'mist-dead-end',
    risk: 'low',
    exits: [],
  })

  assert.throws(() => validateDungeonProfile(profile), /path to the extraction/i)
})

test('profile validation rejects duplicate exit targets with ambiguous costs', () => {
  const profile = makeProfile()
  profile.rooms[0].exits.push({ id: 'entry-to-store-again', to: 'f1-store', cost: 5 })

  assert.throws(() => validateDungeonProfile(profile), /duplicate.*exit/i)
})

test('profile validation rejects extraction rooms omitted from extractionRoomIds', () => {
  const profile = makeProfile()
  profile.rooms[2].exits.push({ id: 'alchemy-to-emergency-exit', to: 'f3-emergency-exit', cost: 0 })
  profile.rooms.push({
    id: 'f3-emergency-exit',
    floor: 3,
    kind: 'extraction',
    sceneId: 'mist-emergency-exit',
    risk: 'high',
    exits: [{ id: 'emergency-exit-to-gate', to: 'f3-gate', cost: 0 }],
  })

  assert.throws(() => validateDungeonProfile(profile), /extraction.*declared/i)
})

test('session seeds must be uint32 integers', () => {
  for (const seed of [Number.NaN, Number.POSITIVE_INFINITY, -1, 1.5, 4294967296]) {
    assert.throws(() => createDungeonSession(makeProfile(), seed), /seed/i)
  }

  assert.equal(createDungeonSession(makeProfile(), 0).id, 'mist-vault-0')
  assert.equal(createDungeonSession(makeProfile(), 4294967295).id, 'mist-vault-4294967295')
})

test('profile validation rejects malformed room graphs and loot', () => {
  const cases = [
    ['duplicate room IDs', (profile) => profile.rooms.push({ ...profile.rooms[0] })],
    ['missing entry room', (profile) => { profile.entryRoomId = 'missing' }],
    ['missing extraction room', (profile) => {
      profile.extractionRoomIds = ['missing']
      profile.finalExtractionRoomId = 'missing'
    }],
    ['duplicate extraction room', (profile) => { profile.extractionRoomIds.push('f3-gate') }],
    ['final extraction absent from choices', (profile) => { profile.finalExtractionRoomId = 'f3-altar' }],
    ['missing boss altar', (profile) => { profile.bossAltarRoomId = 'missing' }],
    ['missing exit target', (profile) => { profile.rooms[0].exits[0].to = '' }],
    ['unknown exit target', (profile) => { profile.rooms[0].exits[0].to = 'missing' }],
    ['blank exit ID', (profile) => { profile.rooms[0].exits[0].id = ' ' }],
    ['noncanonical exit ID', (profile) => { profile.rooms[0].exits[0].id = ' entry-to-store ' }],
    ['duplicate exit ID', (profile) => { profile.rooms[2].exits[0].id = 'entry-to-store' }],
    ['negative door cost', (profile) => { profile.rooms[0].exits[0].cost = -1 }],
    ['fractional door cost', (profile) => { profile.rooms[0].exits[0].cost = 1.5 }],
    ['non-finite door cost', (profile) => { profile.rooms[0].exits[0].cost = Number.NaN }],
    ['zero floor', (profile) => { profile.rooms[0].floor = 0 }],
    ['fractional floor', (profile) => { profile.rooms[0].floor = 1.5 }],
    ['floor above three', (profile) => { profile.rooms[0].floor = 4 }],
    ['blank scene ID', (profile) => { profile.rooms[0].sceneId = ' ' }],
    ['noncanonical scene ID', (profile) => { profile.rooms[0].sceneId = ' mist-entry ' }],
    ['duplicate scene ID', (profile) => { profile.rooms[1].sceneId = 'mist-entry' }],
    ['invalid risk', (profile) => { profile.rooms[0].risk = 'certain-doom' }],
    ['invalid search pressure', (profile) => { profile.rooms[1].searchPressureSeconds = 15 }],
    ['invalid exit unlock', (profile) => { profile.rooms[0].exits[0].unlock = 'search' }],
    ['empty loot ID', (profile) => { profile.rooms[1].loot[0].itemId = '' }],
    ['zero loot amount', (profile) => { profile.rooms[1].loot[0].amount = 0 }],
    ['fractional loot amount', (profile) => { profile.rooms[1].loot[0].amount = 1.5 }],
    ['unreachable extraction', (profile) => {
      profile.rooms[0].exits = [{ id: 'entry-to-store', to: 'f1-store', cost: 0 }]
      profile.rooms[1].exits = []
      profile.rooms[2].exits = []
    }],
  ]

  for (const [name, mutate] of cases) {
    const profile = makeProfile()
    mutate(profile)
    assert.throws(() => validateDungeonProfile(profile), undefined, name)
  }
})

test('Mist Bamboo is a three-floor twelve-room authored dungeon with two extraction choices', async () => {
  const raw = await readFile(new URL('../assets/resources/Data/dual-mode-slice.json', import.meta.url), 'utf8')
  const profile = JSON.parse(raw)

  assert.doesNotThrow(() => validateDungeonProfile(profile))
  assert.equal(profile.rooms.length, 12)
  assert.deepEqual([...new Set(profile.rooms.map((room) => room.floor))], [1, 2, 3])
  assert.deepEqual(profile.extractionRoomIds, ['f2-damaged-exit', 'f3-full-exit'])
  assert.equal(profile.finalExtractionRoomId, 'f3-full-exit')
  assert.equal(profile.bossAltarRoomId, 'f3-altar')
  assert.equal(profile.rooms.filter((room) => room.kind === 'boss').length, 1)
  assert.equal(new Set(profile.rooms.map((room) => room.sceneId)).size, 12)
  const sealedCache = profile.rooms.find((room) => room.id === 'f1-sealed-cache')
  assert.equal(sealedCache.exits.find((exit) => exit.id === 'f1-sealed-cache-to-forest').cost, 2)
  const vaultEntrances = profile.rooms.flatMap((room) => room.exits.filter((exit) => exit.to === 'f3-sword-vault'))
  assert.ok(vaultEntrances.length > 0)
  assert.ok(vaultEntrances.every((exit) => exit.unlock === 'boss-defeat'))
})

test('Mist Bamboo sealed cache search refunds enough currency for the return door', async () => {
  const raw = await readFile(new URL('../assets/resources/Data/dual-mode-slice.json', import.meta.url), 'utf8')
  const run = createDungeonSession(JSON.parse(raw), 21)

  assert.deepEqual(enterRoom(run, 'f1-forest-combat'), { ok: true })
  assert.equal(searchRoom(run).doorCurrencyGranted, 2)
  assert.equal(run.doorCurrency, 2)
  assert.deepEqual(enterRoom(run, 'f1-sealed-cache'), { ok: true })
  assert.equal(run.doorCurrency, 0)
  assert.equal(searchRoom(run).doorCurrencyGranted, 2)
  assert.equal(run.doorCurrency, 2)
  assert.deepEqual(enterRoom(run, 'f1-forest-combat'), { ok: true })
  assert.equal(run.doorCurrency, 0)
})
