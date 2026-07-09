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
  nextEnemyId: number
  enemies: BattleEnemy[]
  soulDrops: Array<{ enemyId: number; amount: number }>
  bossSpawned: boolean
  bossSkillTimer: number
  bossSkillInterval: number
  stageCleared: boolean
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

export function createBattleRuntime(stage: StageProfile, heroAttack: number): BattleRuntime {
  return {
    stage,
    heroAttack,
    spawnTimer: 0,
    spawnInterval: 1,
    nextEnemyId: 1,
    enemies: [],
    soulDrops: [],
    bossSpawned: false,
    bossSkillTimer: 0,
    bossSkillInterval: 2.6,
    stageCleared: false,
  }
}

export function nextSpawn(runtime: BattleRuntime, deltaTime: number) {
  runtime.spawnTimer += deltaTime
  if (runtime.spawnTimer < runtime.spawnInterval) return { ok: false, enemy: null }

  runtime.spawnTimer = 0
  const pool = runtime.stage.enemies.filter((enemy) => enemy.role !== 'boss')
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

export function spawnBoss(runtime: BattleRuntime) {
  if (runtime.bossSpawned || runtime.stageCleared) return { ok: false, enemy: null }

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
    defeatedEnemies: runtime.enemies.filter((enemy) => !enemy.alive).length,
    soulDrops: runtime.soulDrops.length,
    bossAlive: runtime.enemies.some((enemy) => enemy.profile.role === 'boss' && enemy.alive),
    stageCleared: runtime.stageCleared,
  }
}
