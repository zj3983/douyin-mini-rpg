import { migratePlayerSave, type PlayerSaveV3 } from '../Progression/PlayerSave.ts'

export interface WorldBossClearResult {
  save: PlayerSaveV3
  granted: {
    dungeonPasses: number
    spiritStones: number
  }
}

function canonicalStage(stage: number): number | null {
  return Number.isFinite(stage) && stage >= 0 ? Math.floor(stage) : null
}

export function applyWorldBossClear(
  current: PlayerSaveV3,
  input: { stage: number; rewardId: string },
): WorldBossClearResult {
  const save = migratePlayerSave(current)

  if (save.rewardLedger.indexOf(input.rewardId) !== -1) {
    return { save, granted: { dungeonPasses: 0, spiritStones: 0 } }
  }

  const stage = canonicalStage(input.stage)
  save.rewardLedger.push(input.rewardId)
  if (stage !== null) {
    save.world.highestClearedStage = Math.max(save.world.highestClearedStage, stage)
  }
  save.inventory.dungeonPasses += 1
  save.spiritStones += 80

  return { save, granted: { dungeonPasses: 1, spiritStones: 80 } }
}
