import type { PlayerLoadout } from '../GameContent.ts'

export type LoadoutValidation =
  | { ok: true }
  | { ok: false; reason: 'active-limit' | 'relic-limit' | 'duplicate-id' }

export function validateLoadout(loadout: PlayerLoadout): LoadoutValidation {
  if (loadout.active.length > 3) {
    return { ok: false, reason: 'active-limit' }
  }

  if (loadout.relics.length > 2) {
    return { ok: false, reason: 'relic-limit' }
  }

  const equipmentIds = [...loadout.active, ...loadout.relics]
  if (new Set(equipmentIds).size !== equipmentIds.length) {
    return { ok: false, reason: 'duplicate-id' }
  }

  return { ok: true }
}
