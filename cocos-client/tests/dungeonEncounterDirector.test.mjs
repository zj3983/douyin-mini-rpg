import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  planDungeonEncounter,
  planPursuitEncounter,
  validateDungeonEncounterCatalog,
} from '../assets/Scripts/Core/Dungeon/DungeonEncounterDirector.ts'

const catalogPath = new URL('../assets/resources/Data/dungeon-encounters.json', import.meta.url)
const profilePath = new URL('../assets/resources/Data/dual-mode-slice.json', import.meta.url)

function loadCatalog() {
  return JSON.parse(readFileSync(catalogPath, 'utf8'))
}

function encounterRoomIds() {
  const profile = JSON.parse(readFileSync(profilePath, 'utf8'))
  return profile.rooms
    .filter((room) => ['combat', 'mechanism', 'elite', 'boss'].includes(room.kind))
    .map((room) => room.id)
    .sort()
}

test('real catalog validates and covers every authored combat-capable room', () => {
  const catalog = loadCatalog()
  assert.doesNotThrow(() => validateDungeonEncounterCatalog(catalog))
  assert.deepEqual(catalog.encounters.map((entry) => entry.roomId).sort(), encounterRoomIds())
  assert.equal(catalog.encounters.every((entry) => entry.maxAlive >= 1 && entry.maxAlive <= 18), true)
  assert.equal(catalog.encounters.every((entry) => Number.isSafeInteger(entry.defeatTarget) && entry.defeatTarget > 0), true)
  assert.equal(catalog.encounters.every((entry) => entry.loot.length > 0), true)
})

test('authored rooms use the approved actor sets and safe encounter sizes', () => {
  const catalog = loadCatalog()
  const actorsFor = (roomId) => catalog.encounters
    .find((entry) => entry.roomId === roomId)
    .enemies.map((enemy) => enemy.id)

  assert.deepEqual(actorsFor('f1-forest-combat').sort(), ['green-wing-moth', 'moss-wolf'])
  assert.deepEqual(actorsFor('f2-bridge-combat').sort(), ['fog-spider', 'lantern-wraith'])
  assert.deepEqual(actorsFor('f2-sword-array').sort(), ['fog-spider', 'lantern-wraith'])
  assert.deepEqual(actorsFor('f2-gate-elite'), ['moss-wolf'])
  assert.deepEqual(actorsFor('f3-antechamber').sort(), ['fog-spider', 'lantern-wraith', 'mist-deer-king'])
  assert.deepEqual(actorsFor('f3-altar'), ['mist-bamboo-emperor'])
})

test('room planning is deterministic, seed-sensitive, and deeply isolated', () => {
  const catalog = loadCatalog()
  const first = planDungeonEncounter(catalog, 'f1-forest-combat', 41)
  const same = planDungeonEncounter(catalog, 'f1-forest-combat', 41)
  assert.deepEqual(first, same)
  assert.notStrictEqual(first, same)
  assert.notStrictEqual(first.enemies, same.enemies)
  assert.notStrictEqual(first.enemies[0], same.enemies[0])

  const variants = new Set(Array.from({ length: 16 }, (_, seed) => (
    JSON.stringify(planDungeonEncounter(catalog, 'f1-forest-combat', seed).enemies)
  )))
  assert.ok(variants.size > 1)

  first.enemies[0].name = 'tampered'
  first.enemies.reverse()
  assert.deepEqual(planDungeonEncounter(catalog, 'f1-forest-combat', 41), same)
})

test('room planning rejects unknown rooms and non-uint32 seeds', () => {
  const catalog = loadCatalog()
  for (const seed of [-1, 2 ** 32, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => planDungeonEncounter(catalog, 'f1-forest-combat', seed), /uint32/i)
  }
  assert.throws(() => planDungeonEncounter(catalog, 'not-a-room', 1), /unknown room/i)
})

test('catalog validation rejects duplicate rooms, unsafe limits, and malformed actors', () => {
  const catalog = loadCatalog()
  catalog.encounters.push(structuredClone(catalog.encounters[0]))
  assert.throws(() => validateDungeonEncounterCatalog(catalog), /duplicate room/i)

  const unsafe = loadCatalog()
  unsafe.encounters[0].maxAlive = 19
  assert.throws(() => validateDungeonEncounterCatalog(unsafe), /maxAlive/i)

  const malformed = loadCatalog()
  malformed.encounters[0].enemies[0].role = 'elite'
  assert.throws(() => validateDungeonEncounterCatalog(malformed), /role/i)
})

test('pursuit encounters reuse one actor and retain authoritative completion semantics', () => {
  const catalog = loadCatalog()
  const first = planPursuitEncounter(catalog, 1)
  const second = planPursuitEncounter(catalog, 2)
  const final = planPursuitEncounter(catalog, 3)

  assert.deepEqual([first.completion, second.completion, final.completion], ['repel', 'repel', 'kill'])
  assert.deepEqual([first.boss.id, second.boss.id, final.boss.id], [
    'mist-bamboo-emperor',
    'mist-bamboo-emperor',
    'mist-bamboo-emperor',
  ])
  assert.deepEqual([first.enemies.length, second.enemies.length, final.enemies.length], [0, 0, 0])
  assert.notStrictEqual(first.boss, second.boss)
  assert.notStrictEqual(second.boss, final.boss)

  first.boss.name = 'tampered'
  assert.equal(planPursuitEncounter(catalog, 1).boss.name, '雾竹皇')
  assert.throws(() => planPursuitEncounter(catalog, 0), /hunt/i)
  assert.throws(() => planPursuitEncounter(catalog, 4), /hunt/i)
})
