export const DEFAULT_DUNGEON_MAX_FLOORS = 5

export type DungeonFloorRole = 'clear' | 'key' | 'elite' | 'treasure' | 'boss'

export interface DungeonProgressionSource {
  killGoal: number
  materialGoal: number
  unlockLevel: number
}

const floorNames = ['外层', '灵脉层', '精英层', '藏宝层', '守门层'] as const
const floorRoles: DungeonFloorRole[] = ['clear', 'key', 'elite', 'treasure', 'boss']

export function dungeonFloorName(floor: number) {
  const index = Math.max(0, Math.min(floorNames.length - 1, Math.floor(floor) - 1))
  return floorNames[index]
}

export function dungeonTierFromUnlock(unlockLevel: number) {
  return Math.max(1, Math.ceil(unlockLevel / 8))
}

export function dungeonFloorKillGoal(
  dungeon: DungeonProgressionSource,
  floor: number,
  maxFloors = DEFAULT_DUNGEON_MAX_FLOORS,
) {
  const safeFloor = Math.max(1, Math.min(maxFloors, Math.floor(floor)))
  const tier = dungeonTierFromUnlock(dungeon.unlockLevel)
  if (tier <= 1) return Math.max(3, 2 + Math.ceil(safeFloor * 0.75))
  return Math.max(4, Math.ceil(dungeon.killGoal / maxFloors) + safeFloor)
}

export function dungeonFloorMaterialGoal(
  dungeon: DungeonProgressionSource,
  floor: number,
  maxFloors = DEFAULT_DUNGEON_MAX_FLOORS,
) {
  const safeFloor = Math.max(1, Math.min(maxFloors, Math.floor(floor)))
  const tier = dungeonTierFromUnlock(dungeon.unlockLevel)
  const base = Math.max(2, dungeon.materialGoal - (tier <= 1 ? 1 : 2))
  const bossKey = tier > 1 && safeFloor >= maxFloors ? 1 : 0
  return base + Math.floor(safeFloor / 2) + bossKey
}

export function dungeonFloorPlan(
  dungeon: DungeonProgressionSource,
  floor: number,
  maxFloors = DEFAULT_DUNGEON_MAX_FLOORS,
) {
  const safeFloor = Math.max(1, Math.min(maxFloors, Math.floor(floor)))
  const role = floorRoles[Math.min(floorRoles.length - 1, safeFloor - 1)]
  const eliteBias = role === 'elite' ? 0.5 : role === 'boss' ? 0.42 : role === 'treasure' ? 0.24 : 0.12
  const rewardMultiplier = role === 'treasure' ? 1.55 : role === 'boss' ? 1.35 : role === 'elite' ? 1.22 : 1 + (safeFloor - 1) * 0.06
  return {
    floor: safeFloor,
    maxFloors,
    name: dungeonFloorName(safeFloor),
    role,
    killGoal: dungeonFloorKillGoal(dungeon, safeFloor, maxFloors),
    materialGoal: dungeonFloorMaterialGoal(dungeon, safeFloor, maxFloors),
    eliteBias,
    rewardMultiplier,
    requiresBoss: role === 'boss' || safeFloor >= maxFloors,
  }
}
