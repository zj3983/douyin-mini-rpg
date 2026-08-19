import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  createDungeonMap,
  enterMappedRoom,
  roomIntel,
  sealRoute,
  snapshotDungeonMap,
} from '../assets/Scripts/Core/Dungeon/DungeonMapRuntime.ts'

const rawProfile = JSON.parse(
  await readFile(new URL('../assets/resources/Data/dual-mode-slice.json', import.meta.url), 'utf8'),
)

function makeProfile() {
  return structuredClone(rawProfile)
}

test('map reveals topology while hiding room kinds until entry', () => {
  const profile = makeProfile()
  const map = createDungeonMap(profile)

  assert.deepEqual(roomIntel(map, profile, 'f1-entry'), {
    id: 'f1-entry',
    floor: 1,
    risk: 'low',
    revealed: true,
    kind: 'entry',
  })
  assert.deepEqual(roomIntel(map, profile, 'f1-forest-combat'), {
    id: 'f1-forest-combat',
    floor: 1,
    risk: 'medium',
    revealed: false,
    kind: null,
  })
  assert.equal(roomIntel(map, profile, 'not-a-room'), null)

  assert.deepEqual(enterMappedRoom(map, profile, 'f1-forest-combat', 0), { ok: true, currency: 0 })
  assert.deepEqual(roomIntel(map, profile, 'f1-forest-combat'), {
    id: 'f1-forest-combat',
    floor: 1,
    risk: 'medium',
    revealed: true,
    kind: 'combat',
  })
})

test('map starts at the entry and seals every boss-defeat exit', () => {
  const profile = makeProfile()
  const map = createDungeonMap(profile)
  const bossExitIds = profile.rooms.flatMap((room) =>
    room.exits.filter((exit) => exit.unlock === 'boss-defeat').map((exit) => exit.id),
  )

  assert.equal(map.currentRoomId, profile.entryRoomId)
  assert.deepEqual(map.revealedRoomIds, [profile.entryRoomId])
  assert.deepEqual(new Set(map.sealedExitIds), new Set(bossExitIds))

  profile.rooms[9].exits.length = 0
  assert.deepEqual(new Set(map.sealedExitIds), new Set(bossExitIds))
})

test('entering a mapped room deducts its door cost exactly once', () => {
  const profile = makeProfile()
  const map = createDungeonMap(profile)

  assert.deepEqual(enterMappedRoom(map, profile, 'f1-forest-combat', 2), { ok: true, currency: 2 })
  assert.deepEqual(enterMappedRoom(map, profile, 'f1-sealed-cache', 2), { ok: true, currency: 0 })
  assert.equal(map.currentRoomId, 'f1-sealed-cache')
  assert.deepEqual(map.revealedRoomIds, ['f1-entry', 'f1-forest-combat', 'f1-sealed-cache'])
})

test('invalid entry attempts are atomic and return stable reasons', () => {
  const cases = [
    ['missing-room', 0, 'unknown-room'],
    ['f3-altar', 0, 'not-connected'],
    ['f1-sealed-cache', 1, 'door-cost'],
    ['f1-sealed-cache', -1, 'invalid-currency'],
    ['f1-sealed-cache', 1.5, 'invalid-currency'],
    ['f1-sealed-cache', Number.MAX_SAFE_INTEGER + 1, 'invalid-currency'],
  ]

  for (const [targetId, currency, reason] of cases) {
    const profile = makeProfile()
    const map = createDungeonMap(profile)
    assert.equal(enterMappedRoom(map, profile, 'f1-forest-combat', 0).ok, true)
    const before = snapshotDungeonMap(map)

    assert.deepEqual(enterMappedRoom(map, profile, targetId, currency), { ok: false, reason })
    assert.deepEqual(snapshotDungeonMap(map), before)
  }
})

test('sealed exits reject entry without changing map state', () => {
  const profile = makeProfile()
  const map = createDungeonMap(profile)
  map.currentRoomId = 'f3-altar'
  map.revealedRoomIds.push('f3-altar')
  const before = snapshotDungeonMap(map)

  assert.deepEqual(enterMappedRoom(map, profile, 'f3-sword-vault', 0), {
    ok: false,
    reason: 'sealed-exit',
  })
  assert.deepEqual(snapshotDungeonMap(map), before)
})

test('safe route sealing refuses the final extraction path', () => {
  const profile = makeProfile()
  const map = createDungeonMap(profile)
  map.currentRoomId = 'f2-gate-elite'
  map.revealedRoomIds.push('f2-gate-elite')

  assert.deepEqual(sealRoute(map, profile, 'f2-elite-to-floor3'), { ok: true })
  assert.deepEqual(sealRoute(map, profile, 'f2-bridge-to-exit'), { ok: true })
  const before = snapshotDungeonMap(map)
  assert.deepEqual(sealRoute(map, profile, 'f2-elite-to-exit'), {
    ok: false,
    reason: 'would-strand-player',
  })
  assert.deepEqual(snapshotDungeonMap(map), before)
})

test('route sealing rejects unknown exits and is idempotent', () => {
  const profile = makeProfile()
  const map = createDungeonMap(profile)
  const before = snapshotDungeonMap(map)

  assert.deepEqual(sealRoute(map, profile, 'missing-exit'), { ok: false, reason: 'unknown-exit' })
  assert.deepEqual(snapshotDungeonMap(map), before)

  assert.deepEqual(sealRoute(map, profile, 'f1-forest-to-alchemy'), { ok: true })
  const once = snapshotDungeonMap(map)
  assert.deepEqual(sealRoute(map, profile, 'f1-forest-to-alchemy'), { ok: true })
  assert.deepEqual(snapshotDungeonMap(map), once)

  const initiallySealed = map.sealedExitIds[0]
  const beforeBossSeal = snapshotDungeonMap(map)
  assert.deepEqual(sealRoute(map, profile, initiallySealed), { ok: true })
  assert.deepEqual(snapshotDungeonMap(map), beforeBossSeal)
})

test('map snapshots deeply isolate their arrays', () => {
  const map = createDungeonMap(makeProfile())
  const first = snapshotDungeonMap(map)
  const second = snapshotDungeonMap(map)

  assert.notEqual(first.revealedRoomIds, map.revealedRoomIds)
  assert.notEqual(first.sealedExitIds, map.sealedExitIds)
  first.revealedRoomIds.push('fake-room')
  first.sealedExitIds.length = 0

  assert.deepEqual(snapshotDungeonMap(map), second)
})
