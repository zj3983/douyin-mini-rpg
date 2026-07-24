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

function makeProfile() {
  return {
    id: 'mist-vault',
    entryRoomId: 'f1-entry',
    extractionRoomId: 'f3-gate',
    rooms: [
      {
        id: 'f1-entry',
        floor: 1,
        kind: 'entry',
        exits: [
          { to: 'f1-store', cost: 2 },
          { to: 'f2-alchemy', cost: 0 },
        ],
      },
      {
        id: 'f1-store',
        floor: 1,
        kind: 'treasure',
        exits: [{ to: 'f3-gate', cost: 0 }],
        loot: [{ itemId: 'flying-sword', amount: 1 }],
      },
      {
        id: 'f2-alchemy',
        floor: 2,
        kind: 'alchemy',
        exits: [{ to: 'f3-gate', cost: 0 }],
        loot: [{ itemId: 'mist-herb', amount: 2 }],
      },
      { id: 'f3-gate', floor: 3, kind: 'extraction', exits: [] },
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
  assert.deepEqual(searchRoom(first), { loot: [] })

  first.currentRoomId = 'missing-room'
  assert.deepEqual(searchRoom(first), { loot: [] })
  first.phase = 'defeated'
  first.currentRoomId = 'f1-entry'
  assert.deepEqual(searchRoom(first), { loot: [] })
})

test('extraction only succeeds at the gate while exploring and returns cloned loot', () => {
  const run = createDungeonSession(makeProfile(), 7)
  run.carriedLoot.push({ itemId: 'spirit-ore', amount: 3 })

  assert.deepEqual(extractRun(run), { ok: false, loot: [] })
  assert.equal(run.phase, 'exploring')

  run.currentRoomId = 'f3-gate'
  const extracted = extractRun(run)
  assert.deepEqual(extracted, { ok: true, loot: [{ itemId: 'spirit-ore', amount: 3 }] })
  assert.equal(run.phase, 'extracted')
  assert.notEqual(extracted.loot[0], run.carriedLoot[0])

  extracted.loot[0].amount = 100
  assert.equal(run.carriedLoot[0].amount, 3)
  assert.deepEqual(extractRun(run), { ok: false, loot: [] })
})

test('profile validation rejects malformed room graphs and loot', () => {
  const cases = [
    ['duplicate room IDs', (profile) => profile.rooms.push({ ...profile.rooms[0] })],
    ['missing entry room', (profile) => { profile.entryRoomId = 'missing' }],
    ['missing extraction room', (profile) => { profile.extractionRoomId = 'missing' }],
    ['missing exit target', (profile) => { profile.rooms[0].exits[0].to = '' }],
    ['unknown exit target', (profile) => { profile.rooms[0].exits[0].to = 'missing' }],
    ['negative door cost', (profile) => { profile.rooms[0].exits[0].cost = -1 }],
    ['fractional door cost', (profile) => { profile.rooms[0].exits[0].cost = 1.5 }],
    ['non-finite door cost', (profile) => { profile.rooms[0].exits[0].cost = Number.NaN }],
    ['zero floor', (profile) => { profile.rooms[0].floor = 0 }],
    ['fractional floor', (profile) => { profile.rooms[0].floor = 1.5 }],
    ['empty loot ID', (profile) => { profile.rooms[1].loot[0].itemId = '' }],
    ['zero loot amount', (profile) => { profile.rooms[1].loot[0].amount = 0 }],
    ['fractional loot amount', (profile) => { profile.rooms[1].loot[0].amount = 1.5 }],
    ['unreachable extraction', (profile) => {
      profile.rooms[0].exits = [{ to: 'f1-store', cost: 0 }]
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

test('the real dungeon profile parses, validates, and spans all three floors', async () => {
  const raw = await readFile(new URL('../assets/resources/Data/dual-mode-slice.json', import.meta.url), 'utf8')
  const profile = JSON.parse(raw)

  assert.doesNotThrow(() => validateDungeonProfile(profile))
  assert.deepEqual([...new Set(profile.rooms.map((room) => room.floor))].sort(), [1, 2, 3])
  for (const id of ['f1-entry', 'f1-store', 'f2-alchemy', 'f2-elite', 'f3-boss', 'f3-gate']) {
    assert.ok(profile.rooms.some((room) => room.id === id), `missing room ${id}`)
  }
})
