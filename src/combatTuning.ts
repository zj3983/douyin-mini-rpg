export function wildEnemyTarget(stage: number) {
  const safeStage = Math.max(1, Math.floor(stage) || 1)
  return Math.min(10, 8 + Math.floor((safeStage - 1) / 3))
}

export function wildSpawnDistance(visibleRight: number, random = Math.random()) {
  const safeVisibleRight = Math.max(180, Number(visibleRight) || 0)
  const safeRandom = Math.max(0, Math.min(1, Number(random) || 0))
  return Math.max(190, safeVisibleRight * 0.58) + safeRandom * 90
}

export function wildEnemyHpMultiplier(stage: number) {
  const safeStage = Math.max(1, Math.floor(stage) || 1)
  return Math.min(1, 0.72 + safeStage * 0.035)
}

export function skillAnnouncementText(name: string, desc: string, sequence: number) {
  const safeName = String(name || '本命术')
  const safeDesc = String(desc || '发动')
  const safeSequence = Math.max(1, Math.floor(sequence) || 1)
  return `${safeName}｜${safeDesc} #${safeSequence}`
}

export function wildBossHp(stage: number, heroLevel: number) {
  const safeStage = Math.max(1, Math.floor(stage) || 1)
  const safeHeroLevel = Math.max(1, Math.floor(heroLevel) || 1)
  return 240 + safeStage * 46 + safeHeroLevel * 12
}

export function wildBossSpawnOffset(stage: number) {
  const safeStage = Math.max(1, Math.floor(stage) || 1)
  return Math.min(386, 290 + safeStage * 8)
}

export function wildInnateCooldownMultiplier(stage: number) {
  const safeStage = Math.max(1, Math.floor(stage) || 1)
  return Number(Math.min(0.9, 0.42 + safeStage * 0.04).toFixed(2))
}

export function wildSkillDamageMultiplier(stage: number) {
  const safeStage = Math.max(1, Math.floor(stage) || 1)
  return Number(Math.max(1.15, 1.75 - safeStage * 0.05).toFixed(2))
}
