import { ArtifactKey, DungeonReward, HeroStats, SkillMutation } from './CultivationTypes'

export const artifactMaxLevel = 18
export const artifactMutationLevels = [6, 12, 18] as const
export const levelUpStats = ['attack', 'health', 'mana'] as const

const realms = ['炼气', '筑基', '金丹', '元婴', '化神', '炼虚', '合体', '大乘']
const stages = ['一重', '二重', '三重', '四重', '五重', '六重', '七重', '八重', '九重']

export function realmName(level: number) {
  const safeLevel = Math.max(1, Math.floor(level))
  const realmIndex = Math.min(realms.length - 1, Math.floor((safeLevel - 1) / stages.length))
  return `${realms[realmIndex]}${stages[(safeLevel - 1) % stages.length]}`
}

export function applyLevelUp(stats: HeroStats): HeroStats {
  const nextLevel = stats.level + 1
  return {
    ...stats,
    level: nextLevel,
    realm: realmName(nextLevel),
    attack: stats.attack + 6,
    health: stats.health + 28,
    mana: stats.mana + 4,
  }
}

export function canMutateArtifact(level: number) {
  return artifactMutationLevels.includes(level as 6 | 12 | 18)
}

export function artifactMutationOptions(artifact: ArtifactKey, level: number): SkillMutation[] {
  if (!canMutateArtifact(level)) return []
  if (artifact === 'flyingSword') {
    return [
      { id: 'flyingSword.split', artifact, unlockLevel: level, title: '御剑·分光', description: '飞剑分化剑影，穿透多个目标。' },
      { id: 'flyingSword.returnArc', artifact, unlockLevel: level, title: '御剑·回锋', description: '飞剑掠出后弧线回旋，再次切入敌阵。' },
      { id: 'flyingSword.cloudPierce', artifact, unlockLevel: level, title: '御剑·穿云', description: '飞剑轨迹抬升，优先贯穿飞行妖兽。' },
    ]
  }
  return [
    { id: `${artifact}.wide`, artifact, unlockLevel: level, title: '法宝·扩域', description: '扩大法宝影响范围。' },
    { id: `${artifact}.echo`, artifact, unlockLevel: level, title: '法宝·残响', description: '释放后追加一次残响。' },
    { id: `${artifact}.focus`, artifact, unlockLevel: level, title: '法宝·凝神', description: '降低冷却并提高命中稳定性。' },
  ]
}

export function worldBossPassDrop(stage: number) {
  if (stage <= 0) return 0
  return stage % 5 === 0 ? 2 : 1
}

export function dungeonClearReward(floor: number, bossKilled: boolean, artifact?: ArtifactKey): DungeonReward {
  const safeFloor = Math.max(1, Math.floor(floor))
  return {
    gachaTickets: bossKilled ? 2 + safeFloor : safeFloor,
    spiritStones: 60 + safeFloor * 18,
    artifactEssence: bossKilled ? 2 + Math.floor(safeFloor / 2) : 1,
    materials: 2 + safeFloor,
    artifact: bossKilled ? artifact : undefined,
  }
}
