import { createArtifactState, tickArtifact } from './ArtifactRuntime.ts'
import type { ArtifactState, SwordTarget } from './ArtifactRuntime.ts'
import {
  applyBossDamage,
  createBoss,
  roarHitsPlayer,
  sweepHitsPlayer,
  tickBoss,
} from './BossBrain.ts'
import type { BossEntity, BossEvent } from './BossBrain.ts'
import { applyEnemyDamage, applyPlayerDamage, tickPlayerCombat } from './CombatResolver.ts'
import { createEnemy, enemyBodyHitsPlayer, tickEnemy } from './EnemyBrain.ts'
import type { EnemyEntity, EnemyEvent } from './EnemyBrain.ts'
import { vecAdd, vecDistance, vecScale } from './Geometry.ts'
import type { Vec2 } from './Geometry.ts'
import { createPlayerMotor, tickPlayerMotor } from './PlayerMotor.ts'
import type { PlayerMotor } from './PlayerMotor.ts'
import { createSeededRandom } from './Random.ts'
import type { SeededRandom } from './Random.ts'
import type { StageOneProfile } from './StageOneConfig.ts'

export type SessionPhase = 'opening' | 'waves' | 'drain' | 'boss-entry' | 'boss' | 'settle' | 'cleared' | 'defeated'

export interface Projectile {
  id: number
  position: Vec2
  direction: Vec2
  speed: number
  radius: number
  damage: number
  alive: boolean
}

export interface SoulDrop {
  id: number
  position: Vec2
  amount: number
}

export type SessionEvent =
  | { type: 'phase'; phase: SessionPhase }
  | { type: 'enemy-spawn'; enemy: EnemyEntity }
  | { type: 'enemy-event'; event: EnemyEvent }
  | { type: 'enemy-damage'; enemyId: number; amount: number; remainingHp: number; position: Vec2 }
  | { type: 'enemy-death'; enemyId: number; kind: string; position: Vec2 }
  | { type: 'enemy-recycled'; enemyId: number }
  | { type: 'sword-fired' }
  | { type: 'sword-returned' }
  | { type: 'projectile-spawn'; projectile: Projectile }
  | { type: 'projectile-despawn'; id: number }
  | { type: 'player-hurt'; amount: number; remainingHp: number }
  | { type: 'boss-event'; event: BossEvent }
  | { type: 'boss-damage'; amount: number; remainingHp: number }
  | { type: 'soul-drop'; soul: SoulDrop }
  | { type: 'settle' }
  | { type: 'cleared' }
  | { type: 'defeated' }

export interface BattleSession {
  stage: StageOneProfile
  phase: SessionPhase
  elapsed: number
  phaseElapsed: number
  generation: number
  player: PlayerMotor
  enemies: EnemyEntity[]
  boss: BossEntity | null
  artifact: ArtifactState
  projectiles: Projectile[]
  souls: SoulDrop[]
  spawnCursor: number
  spawnTimer: number
  nextEntityId: number
  settleElapsed: number
  settleContinued: boolean
  events: SessionEvent[]
  random: SeededRandom
}

const MAX_FRAME_DELTA = 0.25
const SETTLE_AUTO_CONTINUE_SECONDS = 3

export function createBattleSession(stage: StageOneProfile, seed: number): BattleSession {
  return {
    stage,
    phase: 'opening',
    elapsed: 0,
    phaseElapsed: 0,
    generation: 1,
    player: createPlayerMotor(stage.player),
    enemies: [],
    boss: null,
    artifact: createArtifactState(),
    projectiles: [],
    souls: [],
    spawnCursor: 0,
    spawnTimer: 0,
    nextEntityId: 1,
    settleElapsed: 0,
    settleContinued: false,
    events: [],
    random: createSeededRandom(seed),
  }
}

function setPhase(session: BattleSession, phase: SessionPhase) {
  session.phase = phase
  session.phaseElapsed = 0
  session.events.push({ type: 'phase', phase })
}

function activeWave(session: BattleSession, stage: StageOneProfile) {
  return stage.waves.find((wave) => session.elapsed >= wave.start && session.elapsed < wave.end) ?? null
}

function trySpawn(session: BattleSession, stage: StageOneProfile, deltaTime: number) {
  const wave = activeWave(session, stage)
  if (!wave) return
  session.spawnTimer += deltaTime
  if (session.spawnTimer < wave.spawnInterval) return
  session.spawnTimer = 0
  const aliveOrdinary = session.enemies.filter((enemy) => enemy.alive).length
  if (aliveOrdinary >= stage.maxAliveEnemies) return
  const kind = wave.composition[session.spawnCursor % wave.composition.length]
  session.spawnCursor += 1
  const behavior = kind === 'wolf' ? stage.wolf : stage.moth
  const band = kind === 'wolf' ? stage.enemySpawn.groundY : stage.enemySpawn.airY
  const spawn = { x: stage.enemySpawn.x, y: session.random.range(band[0], band[1]) }
  const enemy = createEnemy(session.nextEntityId, behavior, spawn, session.random)
  session.nextEntityId += 1
  session.enemies.push(enemy)
  session.events.push({ type: 'enemy-spawn', enemy })
}

function swordTargets(session: BattleSession): SwordTarget[] {
  const targets: SwordTarget[] = session.enemies
    .filter((enemy) => enemy.alive)
    .map((enemy) => ({ id: enemy.id, position: enemy.position, radius: enemy.radius, alive: enemy.alive }))
  if (session.boss && session.boss.alive && session.boss.state !== 'entry') {
    targets.push({ id: session.boss.id, position: session.boss.position, radius: session.boss.radius, alive: true })
  }
  return targets
}

function damagePlayer(session: BattleSession, stage: StageOneProfile, amount: number) {
  if (applyPlayerDamage(session.player, amount, stage.playerInvincibleSeconds)) {
    session.events.push({ type: 'player-hurt', amount, remainingHp: session.player.hp })
  }
}

function hurtPlayerFromEnemies(session: BattleSession, stage: StageOneProfile) {
  for (const enemy of session.enemies) {
    if (!enemyBodyHitsPlayer(enemy, session.player.position, session.player.radius)) continue
    enemy.attackDidHit = true
    damagePlayer(session, stage, enemy.behavior.touchDamage)
  }
}

function hurtPlayerFromBoss(session: BattleSession, stage: StageOneProfile) {
  const boss = session.boss
  if (!boss || !boss.alive) return
  if (sweepHitsPlayer(boss, session.player.position, session.player.radius)) {
    boss.didHit = true
    damagePlayer(session, stage, stage.boss.sweep.damage)
  }
  if (boss.roarWave && roarHitsPlayer(boss, session.player.position, session.player.radius)) {
    boss.roarWave.didHit = true
    damagePlayer(session, stage, stage.boss.roar.damage)
  }
  for (const marker of boss.spikes) {
    if (!marker.erupted || marker.resolved) continue
    marker.resolved = true
    if (vecDistance(marker.position, session.player.position) <= marker.radius + session.player.radius * 0.5) {
      damagePlayer(session, stage, marker.damage)
    }
  }
}

function dropSouls(session: BattleSession, position: Vec2, amount: number) {
  const soul: SoulDrop = { id: session.nextEntityId, position: { ...position }, amount }
  session.nextEntityId += 1
  session.souls.push(soul)
  session.events.push({ type: 'soul-drop', soul })
}

function settle(session: BattleSession) {
  setPhase(session, 'settle')
  session.settleElapsed = 0
  session.events.push({ type: 'settle' })
}

function tickProjectiles(session: BattleSession, stage: StageOneProfile, deltaTime: number) {
  for (const projectile of session.projectiles) {
    if (!projectile.alive) continue
    projectile.position = vecAdd(projectile.position, vecScale(projectile.direction, projectile.speed * deltaTime))
    if (session.player.alive
      && vecDistance(projectile.position, session.player.position) <= projectile.radius + session.player.radius) {
      projectile.alive = false
      damagePlayer(session, stage, projectile.damage)
      session.events.push({ type: 'projectile-despawn', id: projectile.id })
      continue
    }
    const { bounds } = stage
    if (projectile.position.x < bounds.minX - 80 || projectile.position.x > bounds.maxX + 80
      || projectile.position.y < bounds.minY - 80 || projectile.position.y > bounds.maxY + 80) {
      projectile.alive = false
      session.events.push({ type: 'projectile-despawn', id: projectile.id })
    }
  }
  session.projectiles = session.projectiles.filter((projectile) => projectile.alive)
}

function recycleDeadEnemies(session: BattleSession, stage: StageOneProfile) {
  const recycled = session.enemies.filter(
    (enemy) => enemy.state === 'death' && enemy.deathElapsed >= stage.enemyDeathRecycleSeconds,
  )
  if (recycled.length === 0) return
  const recycledIds = new Set(recycled.map((enemy) => enemy.id))
  session.enemies = session.enemies.filter((enemy) => !recycledIds.has(enemy.id))
  for (const enemy of recycled) session.events.push({ type: 'enemy-recycled', enemyId: enemy.id })
}

function forceKillRemainingOrdinary(session: BattleSession) {
  for (const enemy of session.enemies) {
    if (!enemy.alive) continue
    enemy.alive = false
    enemy.state = 'death'
    enemy.deathElapsed = 0
    session.events.push({ type: 'enemy-death', enemyId: enemy.id, kind: enemy.kind, position: { ...enemy.position } })
  }
}

function summonBoss(session: BattleSession, stage: StageOneProfile) {
  session.boss = createBoss(session.nextEntityId, stage.boss)
  session.nextEntityId += 1
  setPhase(session, 'boss-entry')
}

function applySwordHits(session: BattleSession, stage: StageOneProfile, hits: Array<{ targetId: number; position: Vec2 }>) {
  for (const hit of hits) {
    if (session.boss && hit.targetId === session.boss.id) {
      const result = applyBossDamage(session.boss, stage.sword.damage)
      session.events.push({ type: 'boss-damage', amount: stage.sword.damage, remainingHp: session.boss.hp })
      if (result.enteredPhaseTwo) session.events.push({ type: 'boss-event', event: { type: 'boss-phase-two' } })
      if (result.killed) {
        dropSouls(session, session.boss.position, stage.bossSoulAmount)
        settle(session)
        return true
      }
      continue
    }
    const enemy = session.enemies.find((entry) => entry.id === hit.targetId)
    if (!enemy) continue
    const result = applyEnemyDamage(enemy, stage.sword.damage)
    session.events.push({
      type: 'enemy-damage',
      enemyId: enemy.id,
      amount: result.amount,
      remainingHp: result.remainingHp,
      position: { ...enemy.position },
    })
    if (result.killed) {
      session.events.push({ type: 'enemy-death', enemyId: enemy.id, kind: enemy.kind, position: { ...enemy.position } })
      dropSouls(session, enemy.position, stage.soulPerKill)
    }
  }
  return false
}

export function requestSettleContinue(session: BattleSession): boolean {
  if (session.phase !== 'settle' || session.settleContinued) return false
  session.settleContinued = true
  setPhase(session, 'cleared')
  session.events.push({ type: 'cleared' })
  return true
}

export function tickBattleSession(session: BattleSession, deltaTime: number): void {
  if (!Number.isFinite(deltaTime) || deltaTime <= 0) return
  const stage = session.stage
  const dt = Math.min(deltaTime, MAX_FRAME_DELTA)

  if (session.phase === 'settle') {
    session.settleElapsed += dt
    if (session.settleElapsed >= SETTLE_AUTO_CONTINUE_SECONDS) requestSettleContinue(session)
    return
  }
  if (session.phase === 'cleared' || session.phase === 'defeated') return

  if (!session.player.alive) {
    setPhase(session, 'defeated')
    session.events.push({ type: 'defeated' })
    return
  }

  session.elapsed += dt
  session.phaseElapsed += dt

  if (session.phase === 'opening' && session.phaseElapsed >= stage.openingSeconds) setPhase(session, 'waves')

  if (session.phase === 'waves' && session.elapsed >= stage.bossEntryTime) setPhase(session, 'drain')

  if (session.phase === 'drain') {
    const aliveOrdinary = session.enemies.filter((enemy) => enemy.alive).length
    if (aliveOrdinary === 0 || session.phaseElapsed >= stage.drainSeconds) {
      forceKillRemainingOrdinary(session)
      summonBoss(session, stage)
    }
  }

  if (session.phase === 'boss-entry' && session.boss && session.boss.state !== 'entry') setPhase(session, 'boss')

  tickPlayerMotor(session.player, dt)
  tickPlayerCombat(session.player, dt)

  if (session.phase === 'waves') trySpawn(session, stage, dt)

  const enemyCtx = {
    playerPosition: session.player.position,
    playerAlive: session.player.alive,
    enemies: session.enemies,
    bounds: stage.bounds,
    random: session.random,
    deltaTime: dt,
  }
  for (const enemy of session.enemies) {
    for (const event of tickEnemy(enemy, enemyCtx)) {
      session.events.push({ type: 'enemy-event', event })
      if (event.type === 'moth-bolt') {
        const projectile: Projectile = {
          id: session.nextEntityId,
          position: { ...event.from },
          direction: { ...event.direction },
          speed: event.speed,
          radius: event.radius,
          damage: event.damage,
          alive: true,
        }
        session.nextEntityId += 1
        session.projectiles.push(projectile)
        session.events.push({ type: 'projectile-spawn', projectile })
      }
    }
  }

  if (session.boss && session.boss.alive) {
    const bossEvents = tickBoss(session.boss, stage.boss, {
      playerPosition: session.player.position,
      playerAlive: session.player.alive,
      random: session.random,
      deltaTime: dt,
    })
    for (const event of bossEvents) session.events.push({ type: 'boss-event', event })
  }

  const artifactResult = tickArtifact(session.artifact, stage.sword, {
    owner: session.player.position,
    targets: swordTargets(session),
    deltaTime: dt,
  })
  if (artifactResult.fired) session.events.push({ type: 'sword-fired' })
  if (artifactResult.returnedToOwner) session.events.push({ type: 'sword-returned' })
  if (applySwordHits(session, stage, artifactResult.hits)) return

  if (session.boss && !session.boss.alive && session.phase === 'boss') {
    dropSouls(session, session.boss.position, stage.bossSoulAmount)
    settle(session)
    return
  }

  hurtPlayerFromEnemies(session, stage)
  hurtPlayerFromBoss(session, stage)
  tickProjectiles(session, stage, dt)
  recycleDeadEnemies(session, stage)

  if (!session.player.alive) {
    setPhase(session, 'defeated')
    session.events.push({ type: 'defeated' })
  }
}
