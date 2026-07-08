import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const design = JSON.parse(readFileSync(resolve('assets/Data/cultivation-design.json'), 'utf8'))

export function stageProfile(stageNumber) {
  const safeStage = Math.max(1, Math.floor(Number(stageNumber) || 1))
  const stage = design.worldStages[(safeStage - 1) % design.worldStages.length]
  const boss = stage.enemies.find((enemy) => enemy.role === 'boss')

  return {
    ...stage,
    id: safeStage,
    boss,
  }
}

export function dungeonRunPlan(dungeonId) {
  const dungeon = design.dungeons.list.find((item) => item.id === dungeonId || item.name === dungeonId)
  if (!dungeon) {
    throw new Error(`Unknown dungeon: ${dungeonId}`)
  }

  return {
    ...dungeon,
    dailyEntries: design.dungeons.dailyEntries,
    canEvacuateAfterMaterialPickup: design.dungeons.canEvacuateAfterMaterialPickup,
  }
}

export function resolveDungeonFloor(dungeon, floorNumber, outcome) {
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
