import { EnemyProfile, StageProfile } from './CultivationTypes'

export interface BattleEnemy {
  id: number
  profile: EnemyProfile
  hp: number
  position: { x: number; y: number }
  radius: number
  alive: boolean
  dropped: boolean
}

export interface BattleRuntime {
  stage: StageProfile
  heroAttack: number
  spawnTimer: number
  spawnInterval: number
  defeatTarget: number
  maxAliveEnemies: number
  nextEnemyId: number
  enemies: BattleEnemy[]
  soulDrops: Array<{ enemyId: number; amount: number }>
  bossSpawned: boolean
  bossSkillTimer: number
  bossSkillInterval: number
  stageCleared: boolean
  stageClearClaimed: boolean
}

export interface DamageEvent {
  enemyId: number
  damage: number
  remainingHp: number
  position: { x: number; y: number }
}

export interface BossSkillEvent {
  enemyId: number
  skillId: string
  name: string
  damage: number
  position: { x: number; y: number }
}

export interface StageClearReward {
  spiritStones: number
  artifactEssence: number
  dungeonPass: { id: string; name: string }
}

export interface StageClearResult {
  title: string
  stageId: number
  nextStageId: number
  reward: StageClearReward
}

export function createBattleRuntime(stage: StageProfile, heroAttack: number): BattleRuntime {
  return {
    stage,
    heroAttack,
    spawnTimer: 0,
    spawnInterval: 1,
    defeatTarget: 12,
    maxAliveEnemies: 18,
    nextEnemyId: 1,
    enemies: [],
    soulDrops: [],
    bossSpawned: false,
    bossSkillTimer: 0,
    bossSkillInterval: 2.6,
    stageCleared: false,
    stageClearClaimed: false,
  }
}

export function nextSpawn(runtime: BattleRuntime, deltaTime: number) {
  const pool = runtime.stage.enemies.filter((enemy) => enemy.role !== 'boss')
  const bossAlive = runtime.enemies.some((enemy) => enemy.profile.role === 'boss' && enemy.alive)
  const aliveOrdinaryEnemies = runtime.enemies.filter((enemy) => enemy.profile.role !== 'boss' && enemy.alive).length
  if (
    pool.length === 0
    || runtime.stageCleared
    || defeatedOrdinaryEnemies(runtime) >= runtime.defeatTarget
    || bossAlive
    || aliveOrdinaryEnemies >= runtime.maxAliveEnemies
  ) {
    return { ok: false, enemy: null }
  }

  runtime.spawnTimer += deltaTime
  if (runtime.spawnTimer < runtime.spawnInterval) return { ok: false, enemy: null }

  runtime.spawnTimer = 0
  const profile = pool[(runtime.nextEnemyId - 1) % pool.length]
  const enemy: BattleEnemy = {
    id: runtime.nextEnemyId,
    profile,
    hp: 100,
    position: { x: 520, y: profile.role === 'flying' ? 70 : -60 },
    radius: profile.role === 'boss' ? 64 : 34,
    alive: true,
    dropped: false,
  }
  runtime.nextEnemyId += 1
  runtime.enemies.push(enemy)
  return { ok: true, enemy }
}

export function applyFlyingSwordHit(
  runtime: BattleRuntime,
  pierce: number,
  damageScale: number,
  path?: { from: { x: number; y: number }; to: { x: number; y: number }; width: number },
) {
  const targets = path
    ? segmentHitEnemies(runtime, { ...path, pierce })
    : runtime.enemies.filter((enemy) => enemy.alive).slice(0, Math.max(0, pierce))
  const damage = Math.round(runtime.heroAttack * damageScale)
  const damageEvents: DamageEvent[] = []
  const defeatedEnemyIds: number[] = []
  let stageClear = false
  for (const enemy of targets) {
    enemy.hp -= damage
    damageEvents.push({
      enemyId: enemy.id,
      damage,
      remainingHp: Math.max(0, enemy.hp),
      position: { ...enemy.position },
    })
    if (enemy.hp <= 0 && defeatEnemy(runtime, enemy.id)) {
      defeatedEnemyIds.push(enemy.id)
      if (enemy.profile.role === 'boss') {
        runtime.stageCleared = true
        stageClear = true
      }
    }
  }
  return { hitCount: targets.length, damageEvents, defeatedEnemyIds, stageClear }
}

export function applyFlyingSwordPathHit(
  runtime: BattleRuntime,
  pierce: number,
  damageScale: number,
  path: { points: Array<{ x: number; y: number }>; width: number },
) {
  const targets = segmentHitEnemiesAlongPath(runtime, { ...path, pierce })
  const damage = Math.round(runtime.heroAttack * damageScale)
  const damageEvents: DamageEvent[] = []
  const defeatedEnemyIds: number[] = []
  let stageClear = false
  for (const enemy of targets) {
    enemy.hp -= damage
    damageEvents.push({
      enemyId: enemy.id,
      damage,
      remainingHp: Math.max(0, enemy.hp),
      position: { ...enemy.position },
    })
    if (enemy.hp <= 0 && defeatEnemy(runtime, enemy.id)) {
      defeatedEnemyIds.push(enemy.id)
      if (enemy.profile.role === 'boss') {
        runtime.stageCleared = true
        stageClear = true
      }
    }
  }
  return { hitCount: targets.length, damageEvents, defeatedEnemyIds, stageClear }
}

export function spawnBoss(runtime: BattleRuntime) {
  if (
    runtime.bossSpawned
    || runtime.stageCleared
    || defeatedOrdinaryEnemies(runtime) < runtime.defeatTarget
  ) {
    return { ok: false, enemy: null }
  }

  const profile = runtime.stage.boss
  const enemy: BattleEnemy = {
    id: runtime.nextEnemyId,
    profile,
    hp: 520,
    position: { x: 580, y: -42 },
    radius: 70,
    alive: true,
    dropped: false,
  }
  runtime.nextEnemyId += 1
  runtime.bossSpawned = true
  runtime.enemies.push(enemy)
  return { ok: true, enemy }
}

export function tickBossSkill(runtime: BattleRuntime, deltaTime: number): { ok: boolean; event: BossSkillEvent | null } {
  const boss = runtime.enemies.find((enemy) => enemy.profile.role === 'boss' && enemy.alive)
  if (!boss || runtime.stageCleared) return { ok: false, event: null }

  runtime.bossSkillTimer += deltaTime
  if (runtime.bossSkillTimer + 0.000001 < runtime.bossSkillInterval) return { ok: false, event: null }

  runtime.bossSkillTimer = 0
  return {
    ok: true,
    event: {
      enemyId: boss.id,
      skillId: `${boss.profile.theme}-boss-skill`,
      name: boss.profile.theme === 'flame-cave' ? '地火裂涌' : boss.profile.theme === 'starlight-ruin' ? '星陨压境' : '妖气冲袭',
      damage: boss.profile.theme === 'flame-cave' ? 18 : boss.profile.theme === 'starlight-ruin' ? 16 : 14,
      position: { ...boss.position },
    },
  }
}

export function claimStageClear(
  runtime: BattleRuntime,
): { ok: boolean; reason: 'not-cleared' | 'already-claimed' | null; result: StageClearResult | null } {
  if (!runtime.stageCleared) return { ok: false, reason: 'not-cleared', result: null }
  if (runtime.stageClearClaimed) return { ok: false, reason: 'already-claimed', result: null }

  runtime.stageClearClaimed = true
  const stageId = runtime.stage.id
  const passCycle = [
    { id: 'mist-bamboo-secret', name: '青竹令' },
    { id: 'flame-cave', name: '赤焰符券' },
    { id: 'soul-bell-valley', name: '摄魂残铃' },
    { id: 'star-gate-ruins', name: '星门残券' },
  ]
  return {
    ok: true,
    reason: null,
    result: {
      title: `第${stageId}关突破`,
      stageId,
      nextStageId: stageId + 1,
      reward: {
        spiritStones: 180 + stageId * 20,
        artifactEssence: 2 + stageId,
        dungeonPass: passCycle[(stageId - 1) % passCycle.length],
      },
    },
  }
}

export function segmentHitEnemies(
  runtime: BattleRuntime,
  input: { from: { x: number; y: number }; to: { x: number; y: number }; width: number; pierce: number },
) {
  return runtime.enemies
    .filter((enemy) => enemy.alive)
    .map((enemy) => {
      const projection = projectPointToSegment(enemy.position, input.from, input.to)
      return {
        enemy,
        progress: projection.t,
        distance: projection.distance,
      }
    })
    .filter((hit) => hit.distance <= hit.enemy.radius + input.width)
    .sort((a, b) => a.progress - b.progress)
    .slice(0, Math.max(0, input.pierce))
    .map((hit) => hit.enemy)
}

export function segmentHitEnemiesAlongPath(
  runtime: BattleRuntime,
  input: { points: Array<{ x: number; y: number }>; width: number; pierce: number },
) {
  if (input.points.length < 2) return []
  const seen = new Set<number>()
  const hits: Array<{ enemy: BattleEnemy; progress: number }> = []
  for (let index = 0; index < input.points.length - 1; index += 1) {
    const from = input.points[index]
    const to = input.points[index + 1]
    for (const enemy of runtime.enemies) {
      if (!enemy.alive || seen.has(enemy.id)) continue
      const projection = projectPointToSegment(enemy.position, from, to)
      if (projection.distance > enemy.radius + input.width) continue
      seen.add(enemy.id)
      hits.push({ enemy, progress: index + projection.t })
    }
  }
  return hits
    .sort((a, b) => a.progress - b.progress)
    .slice(0, Math.max(0, input.pierce))
    .map(({ enemy }) => enemy)
}

function projectPointToSegment(point: { x: number; y: number }, from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const lengthSq = dx * dx + dy * dy
  const rawT = lengthSq === 0 ? 0 : ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSq
  const t = Math.max(0, Math.min(1, rawT))
  const x = from.x + dx * t
  const y = from.y + dy * t
  const distance = Math.hypot(point.x - x, point.y - y)
  return { t, distance }
}

export function defeatEnemy(runtime: BattleRuntime, enemyId: number) {
  const enemy = runtime.enemies.find((entry) => entry.id === enemyId)
  if (!enemy || enemy.dropped) return false

  enemy.alive = false
  enemy.dropped = true
  runtime.soulDrops.push({ enemyId, amount: enemy.profile.role === 'boss' ? 5 : 1 })
  return true
}

export function runtimeStats(runtime: BattleRuntime) {
  return {
    aliveEnemies: runtime.enemies.filter((enemy) => enemy.alive).length,
    defeatedEnemies: defeatedOrdinaryEnemies(runtime),
    bossReady: defeatedOrdinaryEnemies(runtime) >= runtime.defeatTarget,
    soulDrops: runtime.soulDrops.length,
    bossAlive: runtime.enemies.some((enemy) => enemy.profile.role === 'boss' && enemy.alive),
    stageCleared: runtime.stageCleared,
    stageClearClaimed: runtime.stageClearClaimed,
  }
}

function defeatedOrdinaryEnemies(runtime: BattleRuntime): number {
  return runtime.enemies.filter((enemy) => enemy.profile.role !== 'boss' && !enemy.alive).length
}
