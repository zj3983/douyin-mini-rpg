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
    alive: true,
    dropped: false,
  }
  runtime.enemies.push(enemy)
  return { ok: true, enemy }
}

export function applyFlyingSwordHit(runtime, { pierce, damageScale }) {
  const targets = runtime.enemies.filter((enemy) => enemy.alive).slice(0, Math.max(0, pierce))
  for (const enemy of targets) {
    enemy.hp -= runtime.heroAttack * damageScale
    if (enemy.hp <= 0) defeatEnemy(runtime, enemy.id)
  }
  return { hitCount: targets.length }
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
