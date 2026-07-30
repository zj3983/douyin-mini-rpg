import {
  DungeonFloorOutcome,
  DungeonFloorResult,
  DungeonProfile,
  EnemyProfile,
  StageProfile,
} from './CultivationTypes'

export interface CultivationDesignData {
  worldStages: Array<Omit<StageProfile, 'boss'>>
  dungeons: {
    dailyEntries: number
    canEvacuateAfterMaterialPickup: boolean
    list: DungeonProfile[]
  }
}

export function stageProfileFromDesign(design: CultivationDesignData, stageNumber: number): StageProfile {
  const safeStage = Number.isFinite(stageNumber) && stageNumber > 0 ? Math.floor(stageNumber) : 1
  const stage = design.worldStages.find((item) => item.id === safeStage)
  if (!stage) {
    throw new Error(`Unknown world stage: ${safeStage}`)
  }

  const enemies = stage.enemies.map((enemy) => ({ ...enemy }))
  const boss = enemies.find((enemy) => enemy.role === 'boss')

  if (!boss) {
    throw new Error(`Stage ${stage.name} is missing a boss enemy.`)
  }

  return {
    ...stage,
    enemies,
    boss: boss as EnemyProfile,
  }
}

export function dungeonRunPlanFromDesign(design: CultivationDesignData, dungeonId: string): DungeonProfile {
  const dungeon = design.dungeons.list.find((item) => item.id === dungeonId || item.name === dungeonId)
  if (!dungeon) {
    throw new Error(`Unknown dungeon: ${dungeonId}`)
  }
  return dungeon
}

export function resolveDungeonFloor(
  dungeon: DungeonProfile,
  floorNumber: number,
  outcome: DungeonFloorOutcome,
): DungeonFloorResult {
  const floor = dungeon.floors.find((item) => item.floor === floorNumber)
  if (!floor) {
    throw new Error(`Unknown floor ${floorNumber} in ${dungeon.name}`)
  }

  const bossKilled = Boolean(outcome.bossKilled && floor.boss)
  const extracted = Boolean(outcome.extracted && !bossKilled)

  return {
    status: bossKilled ? 'cleared' : extracted ? 'extracted' : 'fighting',
    floor,
    reward: {
      material: floor.material,
      gachaTickets: bossKilled ? 3 : 1,
      spiritStones: 40 + floor.floor * 20 + (bossKilled ? 120 : 0),
      artifactEssence: bossKilled ? 4 + floor.floor : 1,
      artifact: bossKilled ? dungeon.bossArtifact : undefined,
    },
  }
}
