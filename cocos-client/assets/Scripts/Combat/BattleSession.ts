import { createSeededRandom } from './CombatTypes.ts'
import type { CombatEvent, EnemyKind, Point2 } from './CombatTypes.ts'
import { parseStageOneConfig } from './StageOneConfig.ts'
import type { StageOneCombatConfig } from './StageOneConfig.ts'

export type BattlePhase = 'intro' | 'mowing' | 'pressure' | 'boss' | 'settled' | 'defeated'

export interface EnemySnapshot {
  id: number
  kind: EnemyKind
  position: Point2
  alive: boolean
  spawnedAt: number
}

export interface BattleSession {
  stageId: number
  generation: number
  elapsed: number
  phase: BattlePhase
  enemies: Map<number, EnemySnapshot>
  events: CombatEvent[]
  settled: boolean
}

interface SessionAuthority {
  config: StageOneCombatConfig
  random: () => number
  nextEnemyId: number
  nextOrdinaryKind: Exclude<EnemyKind, 'bamboo-warden'>
  nextSpawnAt: number
  bossEntered: boolean
}

const MAX_SUBSTEP_SECONDS = 1 / 60
const TIME_EPSILON = 1e-10
const authorities = new WeakMap<BattleSession, SessionAuthority>()

function normalizeTime(value: number): number {
  const nearestFrame = Math.round(value * 60) / 60
  if (Math.abs(value - nearestFrame) <= TIME_EPSILON) return nearestFrame
  return Math.round(value * 1e12) / 1e12
}

function authorityFor(session: BattleSession): SessionAuthority {
  const authority = authorities.get(session)
  if (!authority) throw new Error('BattleSession was not created by createBattleSession')
  return authority
}

function aliveCount(session: BattleSession): number {
  let count = 0
  for (const enemy of session.enemies.values()) {
    if (enemy.alive) count += 1
  }
  return count
}

function pushEvent(session: BattleSession, event: CombatEvent): void {
  session.events.push(event)
}

function spawnOrdinary(session: BattleSession, authority: SessionAuthority, at: number): void {
  if (aliveCount(session) >= authority.config.activeEnemyCap) return

  const kind = authority.nextOrdinaryKind
  authority.nextOrdinaryKind = kind === 'moss-wolf' ? 'green-wing-moth' : 'moss-wolf'
  const enemy: EnemySnapshot = {
    id: authority.nextEnemyId,
    kind,
    position: {
      x: authority.random() * 2 - 1,
      y: authority.random() * 2 - 1,
    },
    alive: true,
    spawnedAt: at,
  }
  authority.nextEnemyId += 1
  session.enemies.set(enemy.id, enemy)
}

function processOrdinarySpawns(session: BattleSession, authority: SessionAuthority, through: number): void {
  const cadence = session.phase === 'intro'
    ? authority.config.spawnCadenceSeconds.intro
    : session.phase === 'mowing'
      ? authority.config.spawnCadenceSeconds.mowing
      : authority.config.spawnCadenceSeconds.pressure

  while (authority.nextSpawnAt <= through + TIME_EPSILON) {
    spawnOrdinary(session, authority, authority.nextSpawnAt)
    authority.nextSpawnAt += cadence
  }
}

function enterPhase(session: BattleSession, authority: SessionAuthority, phase: BattlePhase, at: number): void {
  session.phase = phase
  if (phase === 'mowing') {
    authority.nextSpawnAt = at + authority.config.spawnCadenceSeconds.mowing
  } else if (phase === 'pressure') {
    authority.nextSpawnAt = at + authority.config.spawnCadenceSeconds.pressure
  } else if (phase === 'boss' && !authority.bossEntered) {
    authority.bossEntered = true
    for (const enemy of session.enemies.values()) {
      if (enemy.kind !== 'bamboo-warden') enemy.alive = false
    }
    const boss: EnemySnapshot = {
      id: authority.nextEnemyId,
      kind: authority.config.bossId,
      position: { x: 0, y: 0 },
      alive: true,
      spawnedAt: at,
    }
    authority.nextEnemyId += 1
    session.enemies.set(boss.id, boss)
    pushEvent(session, { type: 'boss-entered', enemyId: boss.id, at })
  }
}

function advanceSubstep(session: BattleSession, authority: SessionAuthority, deltaSeconds: number): void {
  const target = normalizeTime(session.elapsed + deltaSeconds)
  const transitions: ReadonlyArray<{ phase: BattlePhase; at: number }> = [
    { phase: 'mowing', at: authority.config.phaseStarts.mowing },
    { phase: 'pressure', at: authority.config.phaseStarts.pressure },
    { phase: 'boss', at: authority.config.phaseStarts.boss },
  ]

  for (const transition of transitions) {
    if (session.elapsed + TIME_EPSILON >= transition.at || target + TIME_EPSILON < transition.at) continue
    if (session.phase !== 'boss') {
      processOrdinarySpawns(session, authority, transition.at - TIME_EPSILON)
    }
    session.elapsed = transition.at
    enterPhase(session, authority, transition.phase, transition.at)
  }

  if (session.phase !== 'boss') processOrdinarySpawns(session, authority, target)
  session.elapsed = Math.max(session.elapsed, target)

  if (session.elapsed + TIME_EPSILON >= authority.config.durationSeconds) {
    session.elapsed = authority.config.durationSeconds
    settleBattleSession(session, 'timeout')
  }
}

export function createBattleSession(input: {
  stageId: number
  seed: number
  config: StageOneCombatConfig
}): BattleSession {
  const config = parseStageOneConfig(input.config)
  if (input.stageId !== config.stageId) throw new Error('stageId must match config.stageId')

  const random = createSeededRandom(input.seed)
  const session: BattleSession = {
    stageId: input.stageId,
    generation: 1,
    elapsed: 0,
    phase: 'intro',
    enemies: new Map<number, EnemySnapshot>(),
    events: [],
    settled: false,
  }
  authorities.set(session, {
    config,
    random,
    nextEnemyId: 1,
    nextOrdinaryKind: random() < 0.5 ? 'moss-wolf' : 'green-wing-moth',
    nextSpawnAt: config.spawnCadenceSeconds.intro,
    bossEntered: false,
  })
  pushEvent(session, { type: 'stage-entered', stageId: session.stageId, at: 0 })
  return session
}

export function advanceBattleSession(session: BattleSession, deltaSeconds: number): readonly CombatEvent[] {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0 || session.settled) return []

  const authority = authorityFor(session)
  const eventStart = session.events.length
  const clampedDelta = Math.min(deltaSeconds, 0.25)
  const substepCount = Math.max(1, Math.ceil(clampedDelta / MAX_SUBSTEP_SECONDS - TIME_EPSILON))
  const substep = clampedDelta / substepCount
  for (let index = 0; index < substepCount && !session.settled; index += 1) {
    advanceSubstep(session, authority, substep)
  }
  return session.events.slice(eventStart)
}

export function registerEnemyDefeat(session: BattleSession, enemyId: number): readonly CombatEvent[] {
  const enemy = session.enemies.get(enemyId)
  if (!enemy || !enemy.alive) return []

  authorityFor(session)
  const eventStart = session.events.length
  enemy.alive = false
  pushEvent(session, { type: 'enemy-defeated', enemyId, at: session.elapsed })
  if (enemy.kind === 'bamboo-warden') settleBattleSession(session, 'boss-defeated')
  return session.events.slice(eventStart)
}

export function settleBattleSession(
  session: BattleSession,
  reason: 'boss-defeated' | 'timeout' | 'button',
): boolean {
  void reason
  authorityFor(session)
  if (session.settled) return false

  session.settled = true
  session.phase = 'settled'
  pushEvent(session, { type: 'stage-settled', stageId: session.stageId, at: session.elapsed })
  return true
}

export function drainCombatEvents(session: BattleSession): CombatEvent[] {
  authorityFor(session)
  return session.events.splice(0, session.events.length)
}
