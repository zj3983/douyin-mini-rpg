import type { DungeonCommand, DungeonRun } from './DungeonTypes.ts'
import { applyDungeonCommand, type DungeonCommandResult } from './DungeonSession.ts'

export { applyDungeonCommand }
export type { DungeonCommandResult }

export function interactDungeonRun(run: DungeonRun, command?: DungeonCommand): DungeonCommandResult {
  if (!command) return { accepted: false, reason: 'invalid-phase', events: [] }
  return applyDungeonCommand(run, command)
}
