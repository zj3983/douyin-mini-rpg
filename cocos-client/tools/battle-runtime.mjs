import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const design = JSON.parse(readFileSync(resolve('assets/Data/cultivation-design.json'), 'utf8'))

function stageProfile(stageId) {
  return design.worldStages[(Math.max(1, stageId) - 1) % design.worldStages.length]
}

export function createBattleRuntime({ stageId, heroAttack }) {
  return {
    stage: stageProfile(stageId),
    heroAttack,
    spawnTimer: 0,
    spawnInterval: 1,
    nextEnemyId: 1,
    enemies: [],
    soulDrops: [],
  }
}

export function nextSpawn(runtime, deltaTime) {
  runtime.spawnTimer += deltaTime
  if (runtime.spawnTimer < runtime.spawnInterval) return { ok: false, enemy: null }

  runtime.spawnTimer = 0
  const pool = runtime.stage.enemies.filter((enemy) => enemy.role !== 'boss')
  const profile = pool[(runtime.nextEnemyId - 1) % pool.length]
  const enemy = {
    id: runtime.nextEnemyId++,
    profileId: profile.id,
    name: profile.name,
    theme: profile.theme,
    role: profile.role,
    hp: 100,
    position: { x: 520, y: profile.role === 'flying' ? 70 : -60 },
    radius: profile.role === 'boss' ? 64 : 34,
    alive: true,
    dropped: false,
  }
  runtime.enemies.push(enemy)
  return { ok: true, enemy }
}

export function applyFlyingSwordHit(runtime, { pierce, damageScale, path }) {
  const targets = path
    ? segmentHitEnemies(runtime, { ...path, pierce })
    : runtime.enemies.filter((enemy) => enemy.alive).slice(0, Math.max(0, pierce))
  const damage = Math.round(runtime.heroAttack * damageScale)
  const damageEvents = []
  const defeatedEnemyIds = []
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
    }
  }
  return { hitCount: targets.length, damageEvents, defeatedEnemyIds }
}

export function segmentHitEnemies(runtime, { from, to, width, pierce }) {
  return runtime.enemies
    .filter((enemy) => enemy.alive)
    .map((enemy) => {
      const projection = projectPointToSegment(enemy.position, from, to)
      return {
        enemy,
        progress: projection.t,
        distance: projection.distance,
      }
    })
    .filter((hit) => hit.distance <= (hit.enemy.radius ?? 0) + width)
    .sort((a, b) => a.progress - b.progress)
    .slice(0, Math.max(0, pierce))
    .map((hit) => hit.enemy)
}

function projectPointToSegment(point, from, to) {
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

export function defeatEnemy(runtime, enemyId) {
  const enemy = runtime.enemies.find((entry) => entry.id === enemyId)
  if (!enemy || enemy.dropped) return false

  enemy.alive = false
  enemy.dropped = true
  runtime.soulDrops.push({ enemyId, amount: enemy.role === 'boss' ? 5 : 1 })
  return true
}

export function runtimeStats(runtime) {
  return {
    aliveEnemies: runtime.enemies.filter((enemy) => enemy.alive).length,
    defeatedEnemies: runtime.enemies.filter((enemy) => !enemy.alive).length,
    soulDrops: runtime.soulDrops.length,
  }
}
