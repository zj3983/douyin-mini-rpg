import { migratePlayerSave, type PlayerSaveV4 } from '../Progression/PlayerSave.ts'

export interface WorldBossClearResult {
  save: PlayerSaveV4
  granted: {
    dungeonPasses: number
    spiritStones: number
  }
}

function canonicalStage(stage: number): number | null {
  return Number.isFinite(stage) && stage >= 1 ? Math.floor(stage) : null
}

function canonicalRewardId(rewardId: string): string | null {
  if (typeof rewardId !== 'string') return null
  const canonical = rewardId.trim()
  return canonical === '' ? null : canonical
}

export function applyWorldBossClear(
  current: PlayerSaveV4,
  input: { stage: number; rewardId: string },
): WorldBossClearResult {
  const save = migratePlayerSave(current)
  const stage = canonicalStage(input.stage)
  const rewardId = canonicalRewardId(input.rewardId)

  if (stage === null || rewardId === null) {
    return { save, granted: { dungeonPasses: 0, spiritStones: 0 } }
  }

  if (save.rewardLedger.some((entry) => entry.trim() === rewardId)) {
    return { save, granted: { dungeonPasses: 0, spiritStones: 0 } }
  }

  save.rewardLedger.push(rewardId)
  save.world.highestClearedStage = Math.max(save.world.highestClearedStage, stage)
  save.inventory.dungeonPasses += 1
  save.spiritStones += 80

  return { save, granted: { dungeonPasses: 1, spiritStones: 80 } }
}
