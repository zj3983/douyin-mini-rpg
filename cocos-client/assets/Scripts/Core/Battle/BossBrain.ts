import { angleDiff, clampVecToBounds, pointInFan, pointInRingBand, vecAdd, vecAngle, vecDistance, vecNormalize, vecScale, vecSub } from './Geometry.ts'
import type { FanSpec, Vec2 } from './Geometry.ts'
import type { SeededRandom } from './Random.ts'

export type BossSkillId = 'bamboo-sweep' | 'earth-spikes' | 'mountain-roar'
export type BossState = 'entry' | 'idle' | 'telegraph' | 'attack' | 'recovery' | 'death'

export interface SpikeMarker {
  id: number
  position: Vec2
  radius: number
  eruptAt: number
  erupted: boolean
  resolved: boolean
  damage: number
}

export interface RoarWave {
  center: Vec2
  radius: number
  bandWidth: number
  gapCenterRadians: number
  gapHalfAngleRadians: number
  didHit: boolean
}

export interface BossConfig {
  spawn: Vec2
  anchor: Vec2
  maxHp: number
  radius: number
  moveSpeed: number
  entrySeconds: number
  idleSeconds: number
  decisionHz: number
  phaseTwoHpFraction: number
  sweep: { telegraph: number; active: number; recovery: number; radius: number; halfAngleRadians: number; damage: number }
  spikes: { count: number; interval: number; markerDelay: number; radius: number; damage: number; recovery: number }
  roar: { telegraph: number; waveSpeed: number; bandWidth: number; maxRadius: number; gapHalfAngleRadians: number; damage: number; recovery: number }
}

export interface BossEntity {
  id: number
  position: Vec2
  hp: number
  maxHp: number
  radius: number
  alive: boolean
  state: BossState
  stateElapsed: number
  clock: number
  phase: 1 | 2
  currentSkill: BossSkillId | null
  queuedSkill: BossSkillId | null
  sweepFan: FanSpec | null
  spikes: SpikeMarker[]
  roarWave: RoarWave | null
  roarGapRadians: number
  skillCursor: number
  spikeSpawned: number
  spikeTimer: number
  didHit: boolean
  nextSpikeId: number
}

export type BossEvent =
  | { type: 'boss-state'; state: BossState }
  | { type: 'boss-telegraph'; skill: BossSkillId; fan?: FanSpec; gapRadians?: number }
  | { type: 'boss-attack'; skill: BossSkillId }
  | { type: 'boss-spike-marker'; marker: SpikeMarker }
  | { type: 'boss-spike-erupt'; marker: SpikeMarker }
  | { type: 'boss-phase-two' }

export interface BossTickContext {
  playerPosition: Vec2
  playerAlive: boolean
  random: SeededRandom
  deltaTime: number
}

const SKILL_ROTATION: readonly BossSkillId[] = ['bamboo-sweep', 'earth-spikes', 'mountain-roar']

export function createBoss(id: number, config: BossConfig): BossEntity {
  return {
    id,
    position: { ...config.spawn },
    hp: config.maxHp,
    maxHp: config.maxHp,
    radius: config.radius,
    alive: true,
    state: 'entry',
    stateElapsed: 0,
    clock: 0,
    phase: 1,
    currentSkill: null,
    queuedSkill: null,
    sweepFan: null,
    spikes: [],
    roarWave: null,
    roarGapRadians: 0,
    skillCursor: 0,
    spikeSpawned: 0,
    spikeTimer: 0,
    didHit: false,
    nextSpikeId: 1,
  }
}

function enterBossState(boss: BossEntity, state: BossState, events: BossEvent[]) {
  boss.state = state
  boss.stateElapsed = 0
  events.push({ type: 'boss-state', state })
}

function moveToward(position: Vec2, target: Vec2, speed: number, deltaTime: number): Vec2 {
  const offset = vecSub(target, position)
  const distance = Math.hypot(offset.x, offset.y)
  if (distance === 0) return position
  const step = Math.min(distance, speed * deltaTime)
  return vecAdd(position, vecScale(offset, step / distance))
}

function startSkill(boss: BossEntity, config: BossConfig, skill: BossSkillId, ctx: BossTickContext, events: BossEvent[]) {
  boss.currentSkill = skill
  boss.didHit = false
  boss.spikeSpawned = 0
  boss.spikeTimer = 0
  boss.sweepFan = null
  if (skill === 'bamboo-sweep') {
    boss.sweepFan = {
      origin: { ...boss.position },
      directionRadians: vecAngle(vecSub(ctx.playerPosition, boss.position)),
      radius: config.sweep.radius,
      halfAngleRadians: config.sweep.halfAngleRadians,
    }
  }
  if (skill === 'mountain-roar') {
    boss.roarGapRadians = ctx.random.range(-Math.PI, Math.PI)
  }
  enterBossState(boss, 'telegraph', events)
  events.push({
    type: 'boss-telegraph',
    skill,
    fan: boss.sweepFan ?? undefined,
    gapRadians: skill === 'mountain-roar' ? boss.roarGapRadians : undefined,
  })
}

function pickNextSkill(boss: BossEntity): BossSkillId {
  const skill = SKILL_ROTATION[boss.skillCursor % SKILL_ROTATION.length]
  boss.skillCursor += 1
  return skill
}

function telegraphSecondsOf(boss: BossEntity, config: BossConfig): number {
  if (boss.currentSkill === 'bamboo-sweep') return config.sweep.telegraph
  if (boss.currentSkill === 'earth-spikes') return 0.4
  return config.roar.telegraph
}

function recoverySecondsOf(boss: BossEntity, config: BossConfig): number {
  if (boss.currentSkill === 'bamboo-sweep') return config.sweep.recovery
  if (boss.currentSkill === 'earth-spikes') return config.spikes.recovery
  return config.roar.recovery
}

function beginBossAttack(boss: BossEntity, config: BossConfig, events: BossEvent[]) {
  enterBossState(boss, 'attack', events)
  events.push({ type: 'boss-attack', skill: boss.currentSkill ?? 'bamboo-sweep' })
  if (boss.currentSkill === 'mountain-roar') {
    boss.roarWave = {
      center: { ...boss.position },
      radius: config.roar.bandWidth,
      bandWidth: config.roar.bandWidth,
      gapCenterRadians: boss.roarGapRadians,
      gapHalfAngleRadians: config.roar.gapHalfAngleRadians,
      didHit: false,
    }
  }
}

function tickSpikeMarkers(boss: BossEntity, events: BossEvent[]) {
  for (const marker of boss.spikes) {
    if (!marker.erupted && boss.clock >= marker.eruptAt) {
      marker.erupted = true
      events.push({ type: 'boss-spike-erupt', marker })
    } else if (marker.erupted && !marker.resolved && boss.clock >= marker.eruptAt + 0.25) {
      marker.resolved = true
    }
  }
}

export function tickBoss(boss: BossEntity, config: BossConfig, ctx: BossTickContext): BossEvent[] {
  const events: BossEvent[] = []
  if (!boss.alive) {
    boss.stateElapsed += ctx.deltaTime
    return events
  }
  boss.stateElapsed += ctx.deltaTime
  boss.clock += ctx.deltaTime
  tickSpikeMarkers(boss, events)

  switch (boss.state) {
    case 'entry': {
      boss.position = moveToward(boss.position, config.anchor, config.moveSpeed * 2, ctx.deltaTime)
      if (boss.stateElapsed >= config.entrySeconds) enterBossState(boss, 'idle', events)
      break
    }
    case 'idle': {
      if (ctx.playerAlive) {
        const hold = clampVecToBounds(
          vecAdd(ctx.playerPosition, vecScale(vecNormalize(vecSub(boss.position, ctx.playerPosition)), 220)),
          { minX: -300, maxX: 300, minY: -390, maxY: 430 },
        )
        boss.position = moveToward(boss.position, hold, config.moveSpeed, ctx.deltaTime)
      }
      if (boss.stateElapsed >= config.idleSeconds && ctx.playerAlive) {
        const skill = pickNextSkill(boss)
        if (boss.phase === 2) boss.queuedSkill = SKILL_ROTATION[boss.skillCursor % SKILL_ROTATION.length]
        startSkill(boss, config, skill, ctx, events)
      }
      break
    }
    case 'telegraph':
      if (boss.stateElapsed >= telegraphSecondsOf(boss, config)) beginBossAttack(boss, config, events)
      break
    case 'attack': {
      if (boss.currentSkill === 'bamboo-sweep' && boss.stateElapsed >= config.sweep.active) {
        enterBossState(boss, 'recovery', events)
        break
      }
      if (boss.currentSkill === 'earth-spikes') {
        boss.spikeTimer -= ctx.deltaTime
        if (boss.spikeSpawned < config.spikes.count && boss.spikeTimer <= 0) {
          boss.spikeTimer = config.spikes.interval
          boss.spikeSpawned += 1
          const marker: SpikeMarker = {
            id: boss.nextSpikeId,
            position: { ...ctx.playerPosition },
            radius: config.spikes.radius,
            eruptAt: boss.clock + config.spikes.markerDelay,
            erupted: false,
            resolved: false,
            damage: config.spikes.damage,
          }
          boss.nextSpikeId += 1
          boss.spikes.push(marker)
          events.push({ type: 'boss-spike-marker', marker })
        }
        if (boss.spikeSpawned >= config.spikes.count && boss.spikes.every((marker) => marker.resolved)) {
          boss.spikes = []
          enterBossState(boss, 'recovery', events)
        }
        break
      }
      if (boss.currentSkill === 'mountain-roar' && boss.roarWave) {
        boss.roarWave.radius += config.roar.waveSpeed * ctx.deltaTime
        if (boss.roarWave.radius >= config.roar.maxRadius) {
          boss.roarWave = null
          enterBossState(boss, 'recovery', events)
        }
      }
      break
    }
    case 'recovery':
      if (boss.stateElapsed >= recoverySecondsOf(boss, config)) {
        if (boss.queuedSkill) {
          const queued = boss.queuedSkill
          boss.queuedSkill = null
          startSkill(boss, config, queued, ctx, events)
        } else {
          boss.currentSkill = null
          enterBossState(boss, 'idle', events)
        }
      }
      break
  }

  return events
}

export function applyBossDamage(boss: BossEntity, amount: number, phaseTwoFraction = 0.5): { killed: boolean; enteredPhaseTwo: boolean } {
  if (!boss.alive) return { killed: false, enteredPhaseTwo: false }
  boss.hp = Math.max(0, boss.hp - Math.max(0, Math.round(amount)))
  const enteredPhaseTwo = boss.phase === 1 && boss.hp > 0 && boss.hp <= boss.maxHp * Math.min(1, Math.max(0, phaseTwoFraction))
  if (enteredPhaseTwo) boss.phase = 2
  if (boss.hp === 0) {
    boss.alive = false
    boss.state = 'death'
    boss.stateElapsed = 0
    return { killed: true, enteredPhaseTwo }
  }
  return { killed: false, enteredPhaseTwo }
}

export function sweepHitsPlayer(boss: BossEntity, playerPosition: Vec2, playerRadius: number): boolean {
  if (!boss.alive || boss.state !== 'attack' || boss.currentSkill !== 'bamboo-sweep' || boss.didHit || !boss.sweepFan) return false
  return pointInFan(playerPosition, { ...boss.sweepFan, radius: boss.sweepFan.radius + playerRadius * 0.5 })
}

export function roarHitsPlayer(boss: BossEntity, playerPosition: Vec2, playerRadius: number): boolean {
  const wave = boss.roarWave
  if (!boss.alive || boss.state !== 'attack' || boss.currentSkill !== 'mountain-roar' || !wave || wave.didHit) return false
  const half = wave.bandWidth * 0.5 + playerRadius * 0.5
  return pointInRingBand(playerPosition, {
    center: wave.center,
    innerRadius: wave.radius - half,
    outerRadius: wave.radius + half,
    gapCenterRadians: wave.gapCenterRadians,
    gapHalfAngleRadians: wave.gapHalfAngleRadians,
  })
}
