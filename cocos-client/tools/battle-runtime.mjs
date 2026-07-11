import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const design = JSON.parse(readFileSync(resolve('assets/Data/cultivation-design.json'), 'utf8'))

function stageProfile(stageId) {
  const stage = design.worldStages[(Math.max(1, stageId) - 1) % design.worldStages.length]
  const boss = stage.enemies.find((enemy) => enemy.role === 'boss')
  return { ...stage, boss }
}

export function createBattleRuntime({ stageId, heroAttack }) {
  return {
    stage: stageProfile(stageId),
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

export function nextSpawn(runtime, deltaTime) {
  const pool = runtime.stage.enemies.filter((enemy) => enemy.role !== 'boss')
  const bossAlive = runtime.enemies.some((enemy) => enemy.role === 'boss' && enemy.alive)
  const aliveOrdinaryEnemies = runtime.enemies.filter((enemy) => enemy.role !== 'boss' && enemy.alive).length
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
      if (enemy.role === 'boss') {
        runtime.stageCleared = true
        stageClear = true
      }
    }
  }
  return { hitCount: targets.length, damageEvents, defeatedEnemyIds, stageClear }
}

export function spawnBoss(runtime) {
  if (
    runtime.bossSpawned
    || runtime.stageCleared
    || defeatedOrdinaryEnemies(runtime) < runtime.defeatTarget
  ) {
    return { ok: false, enemy: null }
  }

  const profile = runtime.stage.boss
  const enemy = {
    id: runtime.nextEnemyId++,
    profileId: profile.id,
    name: profile.name,
    theme: profile.theme,
    role: 'boss',
    hp: 520,
    position: { x: 580, y: -42 },
    radius: 70,
    alive: true,
    dropped: false,
  }
  runtime.bossSpawned = true
  runtime.enemies.push(enemy)
  return { ok: true, enemy }
}

export function tickBossSkill(runtime, deltaTime) {
  const boss = runtime.enemies.find((enemy) => enemy.role === 'boss' && enemy.alive)
  if (!boss || runtime.stageCleared) return { ok: false, event: null }

  runtime.bossSkillTimer += deltaTime
  if (runtime.bossSkillTimer + 0.000001 < runtime.bossSkillInterval) return { ok: false, event: null }

  runtime.bossSkillTimer = 0
  return {
    ok: true,
    event: {
      enemyId: boss.id,
      skillId: `${boss.theme}-boss-skill`,
      name: boss.theme === 'flame-cave' ? '地火裂涌' : boss.theme === 'starlight-ruin' ? '星陨压境' : '妖气冲袭',
      damage: boss.theme === 'flame-cave' ? 18 : boss.theme === 'starlight-ruin' ? 16 : 14,
      position: { ...boss.position },
    },
  }
}

export function claimStageClear(runtime) {
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

export function segmentHitEnemiesAlongPath(runtime, { points, width, pierce }) {
  if (points.length < 2) return []
  const seen = new Set()
  const hits = []
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index]
    const to = points[index + 1]
    for (const enemy of runtime.enemies) {
      if (!enemy.alive || seen.has(enemy.id)) continue
      const projection = projectPointToSegment(enemy.position, from, to)
      if (projection.distance > (enemy.radius ?? 0) + width) continue
      seen.add(enemy.id)
      hits.push({ enemy, progress: index + projection.t })
    }
  }
  return hits
    .sort((a, b) => a.progress - b.progress)
    .slice(0, Math.max(0, pierce))
    .map(({ enemy }) => enemy)
}

export function rollbackSpawnedEnemy(runtime, enemyId) {
  const index = runtime.enemies.findIndex((enemy) => enemy.id === enemyId)
  if (index < 0) return false
  const [enemy] = runtime.enemies.splice(index, 1)
  if (enemy.role !== 'boss') return true
  runtime.bossSpawned = false
  runtime.bossSkillTimer = 0
  return true
}

export function rollbackBossSpawn(runtime, enemyId) {
  return rollbackSpawnedEnemy(runtime, enemyId)
}

export function createContactDamageGate({ maxHealth, cooldown }) {
  const safeMaxHealth = Math.max(1, Math.floor(maxHealth))
  return {
    health: safeMaxHealth,
    maxHealth: safeMaxHealth,
    cooldown: Math.max(0, cooldown),
    cooldownRemaining: 0,
  }
}

export function createStageSettlementState(generation) {
  return {
    generation: Math.max(0, Math.floor(generation)),
    pending: false,
    settled: false,
  }
}

export function createBattleAttemptState(generation, stageNumber) {
  return {
    generation: Math.max(0, Math.floor(generation)),
    stageNumber: Math.max(1, Math.floor(stageNumber)),
    status: 'active',
  }
}

export function beginBattleAttempt(previous, stageNumber) {
  return createBattleAttemptState(previous.generation + 1, stageNumber)
}

export function markBattleAttemptDefeated(state) {
  if (state.status !== 'active') return false
  state.status = 'defeated'
  return true
}

export function markBattleAttemptCleared(state) {
  if (state.status !== 'active') return false
  state.status = 'cleared'
  return true
}

export function isBattleAttemptCallbackCurrent(state, generation, status) {
  return state.generation === generation && state.status === status
}

export function scheduleBossSettlement(state) {
  if (state.pending || state.settled) return null
  state.pending = true
  return state.generation
}

export function completeBossSettlement(state, generation) {
  if (generation !== state.generation || !state.pending || state.settled) return false
  state.pending = false
  state.settled = true
  return true
}

export function canSummonWorldBoss(stats, pendingDeathRecycles) {
  return stats.bossReady
    && !stats.bossAlive
    && pendingDeathRecycles === 0
}

export function normalizeSoulHudCount(current, required) {
  const safeRequired = Number.isFinite(required) ? Math.max(0, Math.floor(required)) : 0
  const safeCurrent = Number.isFinite(current) ? Math.max(0, Math.floor(current)) : 0
  return {
    current: Math.min(safeCurrent, safeRequired),
    required: safeRequired,
  }
}

export function tickContactDamageGate(gate, deltaTime) {
  gate.cooldownRemaining = Math.max(0, gate.cooldownRemaining - Math.max(0, deltaTime))
}

export function applyContactDamage(gate, damage) {
  if (gate.health <= 0 || gate.cooldownRemaining > 0) return false
  applyDirectDamage(gate, damage)
  gate.cooldownRemaining = gate.cooldown
  return true
}

export function applyDirectDamage(gate, damage) {
  if (gate.health <= 0) return false
  gate.health = Math.max(0, gate.health - Math.max(0, damage))
  return true
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

export function retireOrdinaryEnemy(runtime, enemyId) {
  const enemy = runtime.enemies.find((entry) => entry.id === enemyId)
  if (!enemy || !enemy.alive || enemy.role === 'boss') return false

  enemy.alive = false
  return true
}

export function runtimeStats(runtime) {
  return {
    aliveEnemies: runtime.enemies.filter((enemy) => enemy.alive).length,
    aliveOrdinaryEnemies: aliveOrdinaryEnemies(runtime),
    defeatedEnemies: defeatedOrdinaryEnemies(runtime),
    bossReady: defeatedOrdinaryEnemies(runtime) >= runtime.defeatTarget,
    soulDrops: runtime.soulDrops.length,
    bossAlive: runtime.enemies.some((enemy) => enemy.role === 'boss' && enemy.alive),
    stageCleared: runtime.stageCleared,
    stageClearClaimed: runtime.stageClearClaimed,
  }
}

function defeatedOrdinaryEnemies(runtime) {
  return runtime.enemies.filter((enemy) => enemy.role !== 'boss' && enemy.dropped).length
}

function aliveOrdinaryEnemies(runtime) {
  return runtime.enemies.filter((enemy) => enemy.role !== 'boss' && enemy.alive).length
}
