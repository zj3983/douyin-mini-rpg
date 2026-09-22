import test from 'node:test'
import assert from 'node:assert/strict'
import { validateLoadout } from '../assets/Scripts/Core/Loadout/LoadoutRules.ts'

test('empty default loadout is valid', () => {
  const result = validateLoadout({
    active: [],
    relics: [],
  })

  assert.deepEqual(result, { ok: true })
})

test('one active artifact and zero relics is valid', () => {
  const result = validateLoadout({
    active: ['flying-sword'],
    relics: [],
  })

  assert.deepEqual(result, { ok: true })
})

test('exactly three active artifacts plus two relics is valid', () => {
  const result = validateLoadout({
    active: ['flying-sword', 'thunder-seal', 'soul-bell'],
    relics: ['soul-magnet', 'jade-guard'],
  })

  assert.deepEqual(result, { ok: true })
})

test('four active artifacts exceeds the active limit', () => {
  const result = validateLoadout({
    active: ['flying-sword', 'thunder-seal', 'soul-bell', 'flame-ruler'],
    relics: [],
  })

  assert.deepEqual(result, { ok: false, reason: 'active-limit' })
})

test('three relics exceeds the relic limit', () => {
  const result = validateLoadout({
    active: ['flying-sword'],
    relics: ['soul-magnet', 'jade-guard', 'spirit-vessel'],
  })

  assert.deepEqual(result, { ok: false, reason: 'relic-limit' })
})

test('duplicate equipment IDs are rejected', () => {
  const result = validateLoadout({
    active: ['flying-sword', 'flying-sword'],
    relics: ['soul-magnet'],
  })

  assert.deepEqual(result, { ok: false, reason: 'duplicate-id' })
})
