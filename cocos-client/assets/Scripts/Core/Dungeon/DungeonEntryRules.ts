import { migratePlayerSave, type PlayerSaveV4 } from '../Progression/PlayerSave.ts'

export type DungeonEntryPayment = 'free' | 'pass'

type EntryFailureReason = 'invalid-day-key' | 'invalid-entry-state' | 'missing-pass'

export type DungeonEntryResult =
  | { ok: true; payment: DungeonEntryPayment; save: PlayerSaveV4 }
  | { ok: false; reason: EntryFailureReason; save: PlayerSaveV4 }

export type DungeonRefundResult =
  | { ok: true; save: PlayerSaveV4 }
  | { ok: false; reason: 'invalid-entry-state'; save: PlayerSaveV4 }

function isCanonicalDayKey(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim()
}

function isNonnegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

export function consumeDungeonEntry(current: PlayerSaveV4, dayKey: string): DungeonEntryResult {
  const save = migratePlayerSave(current)
  if (!isCanonicalDayKey(dayKey)) return { ok: false, reason: 'invalid-day-key', save }
  if (!current?.dungeon || !isNonnegativeSafeInteger(current.dungeon.freeEntriesUsed)) {
    return { ok: false, reason: 'invalid-entry-state', save }
  }

  if (save.dungeon.dayKey !== dayKey) {
    save.dungeon.dayKey = dayKey
    save.dungeon.freeEntriesUsed = 0
  }
  if (save.dungeon.freeEntriesUsed < 3) {
    save.dungeon.freeEntriesUsed += 1
    return { ok: true, payment: 'free', save }
  }

  if (!isNonnegativeSafeInteger(current.inventory?.dungeonPasses)) {
    return { ok: false, reason: 'invalid-entry-state', save }
  }
  if (save.inventory.dungeonPasses === 0) return { ok: false, reason: 'missing-pass', save }
  save.inventory.dungeonPasses -= 1
  return { ok: true, payment: 'pass', save }
}

export function refundDungeonEntry(
  current: PlayerSaveV4,
  payment: DungeonEntryPayment,
): DungeonRefundResult {
  const save = migratePlayerSave(current)
  if (payment === 'free') {
    if (!current?.dungeon || !isNonnegativeSafeInteger(current.dungeon.freeEntriesUsed)
      || current.dungeon.freeEntriesUsed === 0) {
      return { ok: false, reason: 'invalid-entry-state', save }
    }
    save.dungeon.freeEntriesUsed -= 1
    return { ok: true, save }
  }

  if (!isNonnegativeSafeInteger(current.inventory?.dungeonPasses)
    || current.inventory.dungeonPasses === Number.MAX_SAFE_INTEGER) {
    return { ok: false, reason: 'invalid-entry-state', save }
  }
  save.inventory.dungeonPasses += 1
  return { ok: true, save }
}
