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
  for (const enemy of targets) {
    enemy.hp -= runtime.heroAttack * damageScale
    if (enemy.hp <= 0) defeatEnemy(runtime, enemy.id)
  }
  return { hitCount: targets.length }
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
  }
}
