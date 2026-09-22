import test from 'node:test'
import assert from 'node:assert/strict'
import {
  consumeDungeonEntry,
  refundDungeonEntry,
} from '../assets/Scripts/Core/Dungeon/DungeonEntryRules.ts'
import { createDefaultSave } from '../assets/Scripts/Core/Progression/PlayerSave.ts'

test('entry uses three daily attempts before consuming a pass', () => {
  let save = createDefaultSave()
  save.inventory.dungeonPasses = 1

  for (let index = 0; index < 3; index += 1) {
    const result = consumeDungeonEntry(save, '2026-08-19')
    assert.equal(result.ok, true)
    assert.equal(result.payment, 'free')
    save = result.save
  }

  const paid = consumeDungeonEntry(save, '2026-08-19')
  assert.equal(paid.ok, true)
  assert.equal(paid.payment, 'pass')
  assert.equal(paid.save.inventory.dungeonPasses, 0)
  assert.equal(paid.save.dungeon.freeEntriesUsed, 3)
})

test('a new day resets the free-entry counter before charging', () => {
  const save = createDefaultSave()
  save.dungeon.dayKey = '2026-08-18'
  save.dungeon.freeEntriesUsed = 3

  const result = consumeDungeonEntry(save, '2026-08-19')

  assert.equal(result.ok, true)
  assert.equal(result.payment, 'free')
  assert.equal(result.save.dungeon.dayKey, '2026-08-19')
  assert.equal(result.save.dungeon.freeEntriesUsed, 1)
  assert.equal(save.dungeon.freeEntriesUsed, 3)
})

test('entry rejects missing passes and invalid counters without negative or unsafe values', () => {
  const exhausted = createDefaultSave()
  exhausted.dungeon.dayKey = '2026-08-19'
  exhausted.dungeon.freeEntriesUsed = 3
  assert.deepEqual(consumeDungeonEntry(exhausted, '2026-08-19'), {
    ok: false,
    reason: 'missing-pass',
    save: exhausted,
  })

  for (const invalid of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const save = createDefaultSave()
    save.dungeon.dayKey = '2026-08-19'
    save.dungeon.freeEntriesUsed = invalid
    const result = consumeDungeonEntry(save, '2026-08-19')
    assert.equal(result.ok, false)
    assert.equal(result.reason, 'invalid-entry-state')
    assert.ok(Number.isSafeInteger(result.save.dungeon.freeEntriesUsed))
    assert.ok(result.save.dungeon.freeEntriesUsed >= 0)
  }
})

test('refund reverses exactly the recorded payment and never underflows', () => {
  const free = createDefaultSave()
  free.dungeon.dayKey = '2026-08-19'
  free.dungeon.freeEntriesUsed = 1
  const freeRefund = refundDungeonEntry(free, 'free')
  assert.equal(freeRefund.ok, true)
  assert.equal(freeRefund.save.dungeon.freeEntriesUsed, 0)

  const pass = createDefaultSave()
  const passRefund = refundDungeonEntry(pass, 'pass')
  assert.equal(passRefund.ok, true)
  assert.equal(passRefund.save.inventory.dungeonPasses, 1)

  const invalidFree = refundDungeonEntry(createDefaultSave(), 'free')
  assert.equal(invalidFree.ok, false)
  assert.equal(invalidFree.reason, 'invalid-entry-state')
  assert.equal(invalidFree.save.dungeon.freeEntriesUsed, 0)
})
