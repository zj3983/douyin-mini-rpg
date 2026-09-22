export type DungeonEncounterStart = () => boolean
export type DungeonEncounterRecovery = () => void

export function startDungeonEncounterWithRecovery(
  start: DungeonEncounterStart,
  recover: DungeonEncounterRecovery,
): boolean {
  try {
    if (start()) return true
  } catch {
    // A failed Cocos reservation must leave the visual runtime in exploration mode.
  }
  recover()
  return false
}
