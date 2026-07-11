import { EnemyProfile, StageProfile } from './CultivationTypes'
import {
  completeDrain,
  recordBossDefeat,
  recordOrdinaryDefeat,
  StageFlowState,
} from './StageFlowRuntime'

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

export interface ContactDamageGate {
  health: number
  maxHealth: number
  cooldown: number
  cooldownRemaining: number
}

export interface StageSettlementState {
  generation: number
  pending: boolean
  settled: boolean
}

export type BattleAttemptStatus = 'active' | 'defeated' | 'cleared'

export interface BattleAttemptState {
  generation: number
  stageNumber: number
  status: BattleAttemptStatus
}

export function createBattleAttemptState(generation: number, stageNumber: number): BattleAttemptState {
  return {
    generation: Math.max(0, Math.floor(generation)),
    stageNumber: Math.max(1, Math.floor(stageNumber)),
    status: 'active',
  }
}

export function beginBattleAttempt(previous: BattleAttemptState, stageNumber: number) {
  return createBattleAttemptState(previous.generation + 1, stageNumber)
}

export function markBattleAttemptDefeated(state: BattleAttemptState) {
  if (state.status !== 'active') return false
  state.status = 'defeated'
  return true
}

export function markBattleAttemptCleared(state: BattleAttemptState) {
  if (state.status !== 'active') return false
  state.status = 'cleared'
  return true
}

export function isBattleAttemptCallbackCurrent(
  state: BattleAttemptState,
  generation: number,
  status: BattleAttemptStatus,
) {
  return state.generation === generation && state.status === status
}

export function createStageSettlementState(generation: number): StageSettlementState {
  return {
    generation: Math.max(0, Math.floor(generation)),
    pending: false,
    settled: false,
  }
}

export function scheduleBossSettlement(state: StageSettlementState) {
  if (state.pending || state.settled) return null
  state.pending = true
  return state.generation
}

export function completeBossSettlement(state: StageSettlementState, generation: number) {
  if (generation !== state.generation || !state.pending || state.settled) return false
  state.pending = false
  state.settled = true
  return true
}

export function canSummonWorldBoss(
  stats: { bossReady: boolean; bossAlive: boolean; aliveOrdinaryEnemies: number },
  pendingDeathRecycles: number,
) {
  return stats.bossReady
    && !stats.bossAlive
    && pendingDeathRecycles === 0
}

export function normalizeSoulHudCount(current: number, required: number) {
  const safeRequired = Number.isFinite(required) ? Math.max(0, Math.floor(required)) : 0
  const safeCurrent = Number.isFinite(current) ? Math.max(0, Math.floor(current)) : 0
  return {
    current: Math.min(safeCurrent, safeRequired),
    required: safeRequired,
  }
}

export function createContactDamageGate(input: { maxHealth: number; cooldown: number }): ContactDamageGate {
  const maxHealth = Math.max(1, Math.floor(input.maxHealth))
  return {
    health: maxHealth,
    maxHealth,
    cooldown: Math.max(0, input.cooldown),
    cooldownRemaining: 0,
  }
}

export function tickContactDamageGate(gate: ContactDamageGate, deltaTime: number) {
  gate.cooldownRemaining = Math.max(0, gate.cooldownRemaining - Math.max(0, deltaTime))
}

export function applyContactDamage(gate: ContactDamageGate, damage: number) {
  if (gate.health <= 0 || gate.cooldownRemaining > 0) return false
  applyDirectDamage(gate, damage)
  gate.cooldownRemaining = gate.cooldown
  return true
}

export function applyDirectDamage(gate: ContactDamageGate, damage: number) {
  if (gate.health <= 0) return false
  gate.health = Math.max(0, gate.health - Math.max(0, damage))
  return true
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

export function rollbackSpawnedEnemy(runtime: BattleRuntime, enemyId: number) {
  const index = runtime.enemies.findIndex((enemy) => enemy.id === enemyId)
  if (index < 0) return false
  const [enemy] = runtime.enemies.splice(index, 1)
  if (enemy.profile.role !== 'boss') return true
  runtime.bossSpawned = false
  runtime.bossSkillTimer = 0
  return true
}

export function rollbackBossSpawn(runtime: BattleRuntime, enemyId: number) {
  return rollbackSpawnedEnemy(runtime, enemyId)
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

export function retireOrdinaryEnemy(runtime: BattleRuntime, enemyId: number) {
  const enemy = runtime.enemies.find((entry) => entry.id === enemyId)
  if (!enemy || !enemy.alive || enemy.profile.role === 'boss') return false

  enemy.alive = false
  return true
}

export function advanceOrdinaryDefeatFlow(
  runtime: BattleRuntime,
  stageFlow: StageFlowState,
  generation: number,
) {
  if (generation !== stageFlow.generation) {
    return { changed: false, retiredEnemyIds: [] as number[], bossSpawn: null }
  }

  const transition = recordOrdinaryDefeat(stageFlow)
  if (transition.command !== 'beginDrain') {
    return { changed: transition.changed, retiredEnemyIds: [] as number[], bossSpawn: null }
  }

  const retiredEnemyIds = runtime.enemies
    .filter((enemy) => enemy.alive && enemy.profile.role !== 'boss')
    .filter((enemy) => retireOrdinaryEnemy(runtime, enemy.id))
    .map((enemy) => enemy.id)
  const drain = completeDrain(stageFlow, generation)
  const bossSpawn = drain.command === 'spawnBoss' ? spawnBoss(runtime) : null
  return { changed: true, retiredEnemyIds, bossSpawn }
}

export function advanceBossDefeatFlow(stageFlow: StageFlowState, generation: number) {
  if (generation !== stageFlow.generation) return { changed: false, settle: false }
  const transition = recordBossDefeat(stageFlow)
  return { changed: transition.changed, settle: transition.command === 'settle' }
}

export function retryBossSpawnFlow(
  runtime: BattleRuntime,
  stageFlow: StageFlowState,
  generation: number,
) {
  if (generation !== stageFlow.generation || stageFlow.phase !== 'boss' || runtime.bossSpawned) {
    return { changed: false, bossSpawn: null }
  }
  const bossSpawn = spawnBoss(runtime)
  return { changed: bossSpawn.ok, bossSpawn: bossSpawn.ok ? bossSpawn : null }
}

export function runtimeStats(runtime: BattleRuntime) {
  return {
    aliveEnemies: runtime.enemies.filter((enemy) => enemy.alive).length,
    aliveOrdinaryEnemies: aliveOrdinaryEnemies(runtime),
    defeatedEnemies: defeatedOrdinaryEnemies(runtime),
    bossReady: defeatedOrdinaryEnemies(runtime) >= runtime.defeatTarget,
    soulDrops: runtime.soulDrops.length,
    bossAlive: runtime.enemies.some((enemy) => enemy.profile.role === 'boss' && enemy.alive),
    stageCleared: runtime.stageCleared,
    stageClearClaimed: runtime.stageClearClaimed,
  }
}

function defeatedOrdinaryEnemies(runtime: BattleRuntime): number {
  return runtime.enemies.filter((enemy) => enemy.profile.role !== 'boss' && enemy.dropped).length
}

function aliveOrdinaryEnemies(runtime: BattleRuntime): number {
  return runtime.enemies.filter((enemy) => enemy.profile.role !== 'boss' && enemy.alive).length
}
