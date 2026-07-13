import { createSeededRandom } from './CombatTypes.ts'
import type { CombatEvent, EnemyKind, Point2 } from './CombatTypes.ts'
import { parseStageOneConfig } from './StageOneConfig.ts'
import type { StageOneCombatConfig } from './StageOneConfig.ts'

export type BattlePhase = 'intro' | 'mowing' | 'pressure' | 'boss' | 'settled' | 'defeated'
type BattleTerminalReason = 'boss-defeated' | 'timeout' | 'button'

export interface EnemySnapshot {
  readonly id: number
  readonly kind: EnemyKind
  readonly position: Readonly<Point2>
  readonly alive: boolean
  readonly spawnedAt: number
}

interface MutableEnemySnapshot {
  id: number
  kind: EnemyKind
  position: Point2
  alive: boolean
  spawnedAt: number
}

const SESSION_TOKEN = Symbol('BattleSession')
const MAX_EXTERNAL_DELTA_SECONDS = 0.25
const MAX_SUBSTEP_SECONDS = 1 / 60
const MAX_SPAWN_ITERATIONS_PER_STEP = 18
const TIME_EPSILON = 1e-10
const MAX_UINT32 = 0xffffffff

let constructSession: (
  stageId: number,
  seed: number,
  config: StageOneCombatConfig,
) => BattleSession
let advanceSession: (session: BattleSession, deltaSeconds: number) => void
let defeatEnemy: (session: BattleSession, enemyId: number) => boolean
let settleSession: (session: BattleSession, reason: BattleTerminalReason) => boolean
let drainSessionEvents: (session: BattleSession) => readonly CombatEvent[]

function normalizeTime(value: number): number {
  const nearestFrame = Math.round(value * 60) / 60
  if (Math.abs(value - nearestFrame) <= TIME_EPSILON) return nearestFrame
  return Math.round(value * 1e12) / 1e12
}

function freezeEventCopy(event: CombatEvent): CombatEvent {
  switch (event.type) {
    case 'stage-entered':
    case 'stage-settled':
      return Object.freeze({ type: event.type, stageId: event.stageId, at: event.at })
    case 'animation-requested':
      return Object.freeze({ type: event.type, actorId: event.actorId, action: event.action, at: event.at })
    case 'attack-telegraphed':
      return Object.freeze({
        type: event.type,
        enemyId: event.enemyId,
        attackId: event.attackId,
        area: Object.freeze({ ...event.area }),
        at: event.at,
      })
    case 'damage-resolved':
      return Object.freeze({
        type: event.type,
        sourceId: event.sourceId,
        targetId: event.targetId,
        amount: event.amount,
        at: event.at,
      })
    case 'enemy-defeated':
    case 'boss-entered':
      return Object.freeze({ type: event.type, enemyId: event.enemyId, at: event.at })
  }
}

function requireBattleSession(value: BattleSession): BattleSession {
  if (!(value instanceof BattleSession)) throw new TypeError('session must be a BattleSession')
  return value
}

export class BattleSession {
  #stageId: number
  #generation = 1
  #elapsed = 0
  #phase: BattlePhase = 'intro'
  #settled = false
  #terminalReason: BattleTerminalReason | null = null
  #enemies = new Map<number, MutableEnemySnapshot>()
  #events: CombatEvent[] = []
  #config: StageOneCombatConfig
  #random: () => number
  #nextEnemyId = 1
  #nextOrdinaryKind: Exclude<EnemyKind, 'bamboo-warden'>
  #nextSpawnAt: number
  #bossEntered = false

  private constructor(token: symbol, stageId: number, seed: number, config: StageOneCombatConfig) {
    if (token !== SESSION_TOKEN) throw new TypeError('BattleSession must be created by createBattleSession')
    this.#stageId = stageId
    this.#config = config
    this.#random = createSeededRandom(seed)
    this.#nextOrdinaryKind = this.#random() < 0.5 ? 'moss-wolf' : 'green-wing-moth'
    this.#nextSpawnAt = config.spawnCadenceSeconds.intro
    this.#pushEvent({ type: 'stage-entered', stageId, at: 0 })
  }

  static {
    constructSession = (stageId, seed, config) => new BattleSession(SESSION_TOKEN, stageId, seed, config)
    advanceSession = (session, deltaSeconds) => session.#advance(deltaSeconds)
    defeatEnemy = (session, enemyId) => session.#registerEnemyDefeat(enemyId)
    settleSession = (session, reason) => session.#settle(reason)
    drainSessionEvents = (session) => session.#drainCombatEvents()
  }

  get stageId(): number { return this.#stageId }
  get generation(): number { return this.#generation }
  get elapsed(): number { return this.#elapsed }
  get phase(): BattlePhase { return this.#phase }
  get settled(): boolean { return this.#settled }
  get terminalReason(): BattleTerminalReason | null { return this.#terminalReason }

  enemySnapshots(): readonly EnemySnapshot[] {
    const snapshots = Array.from(this.#enemies.values(), (enemy) => Object.freeze({
      id: enemy.id,
      kind: enemy.kind,
      position: Object.freeze({ x: enemy.position.x, y: enemy.position.y }),
      alive: enemy.alive,
      spawnedAt: enemy.spawnedAt,
    }))
    return Object.freeze(snapshots)
  }

  #isTerminal(): boolean {
    return this.#settled || this.#phase === 'settled' || this.#phase === 'defeated'
  }

  #aliveCount(): number {
    let count = 0
    for (const enemy of this.#enemies.values()) {
      if (enemy.alive) count += 1
    }
    return count
  }

  #pushEvent(event: CombatEvent): void {
    this.#events.push(event)
  }

  #spawnOrdinary(at: number): void {
    if (this.#aliveCount() >= this.#config.activeEnemyCap) return

    const kind = this.#nextOrdinaryKind
    this.#nextOrdinaryKind = kind === 'moss-wolf' ? 'green-wing-moth' : 'moss-wolf'
    const enemy: MutableEnemySnapshot = {
      id: this.#nextEnemyId,
      kind,
      position: { x: this.#random() * 2 - 1, y: this.#random() * 2 - 1 },
      alive: true,
      spawnedAt: at,
    }
    this.#nextEnemyId += 1
    this.#enemies.set(enemy.id, enemy)
  }

  #processOrdinarySpawns(through: number): void {
    const cadence = this.#phase === 'intro'
      ? this.#config.spawnCadenceSeconds.intro
      : this.#phase === 'mowing'
        ? this.#config.spawnCadenceSeconds.mowing
        : this.#config.spawnCadenceSeconds.pressure
    const iterationLimit = Math.min(this.#config.activeEnemyCap, MAX_SPAWN_ITERATIONS_PER_STEP)
    let iterations = 0

    while (this.#nextSpawnAt <= through + TIME_EPSILON && iterations < iterationLimit) {
      this.#spawnOrdinary(this.#nextSpawnAt)
      this.#nextSpawnAt += cadence
      iterations += 1
    }

    if (this.#nextSpawnAt <= through + TIME_EPSILON) {
      const skippedIntervals = Math.floor((through + TIME_EPSILON - this.#nextSpawnAt) / cadence) + 1
      this.#nextSpawnAt += skippedIntervals * cadence
    }
  }

  #enterPhase(phase: BattlePhase, at: number): void {
    this.#phase = phase
    if (phase === 'mowing') {
      this.#nextSpawnAt = at + this.#config.spawnCadenceSeconds.mowing
      return
    }
    if (phase === 'pressure') {
      this.#nextSpawnAt = at + this.#config.spawnCadenceSeconds.pressure
      return
    }
    if (phase !== 'boss' || this.#bossEntered) return

    this.#bossEntered = true
    for (const enemy of this.#enemies.values()) {
      if (enemy.kind !== 'bamboo-warden') enemy.alive = false
    }
    const boss: MutableEnemySnapshot = {
      id: this.#nextEnemyId,
      kind: this.#config.bossId,
      position: { x: 0, y: 0 },
      alive: true,
      spawnedAt: at,
    }
    this.#nextEnemyId += 1
    this.#enemies.set(boss.id, boss)
    this.#pushEvent({ type: 'boss-entered', enemyId: boss.id, at })
  }

  #advanceSubstep(deltaSeconds: number): void {
    const target = normalizeTime(this.#elapsed + deltaSeconds)
    const transitions: ReadonlyArray<{ phase: BattlePhase; at: number }> = [
      { phase: 'mowing', at: this.#config.phaseStarts.mowing },
      { phase: 'pressure', at: this.#config.phaseStarts.pressure },
      { phase: 'boss', at: this.#config.phaseStarts.boss },
    ]

    for (const transition of transitions) {
      if (this.#elapsed + TIME_EPSILON >= transition.at || target + TIME_EPSILON < transition.at) continue
      if (this.#phase !== 'boss') this.#processOrdinarySpawns(transition.at - TIME_EPSILON)
      this.#elapsed = transition.at
      this.#enterPhase(transition.phase, transition.at)
    }

    if (this.#phase !== 'boss') this.#processOrdinarySpawns(target)
    this.#elapsed = Math.max(this.#elapsed, target)
    if (this.#elapsed + TIME_EPSILON >= this.#config.durationSeconds) {
      this.#elapsed = this.#config.durationSeconds
      this.#settle('timeout')
    }
  }

  #advance(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0 || this.#isTerminal()) return

    const clampedDelta = Math.min(deltaSeconds, MAX_EXTERNAL_DELTA_SECONDS)
    const substepCount = Math.max(1, Math.ceil(clampedDelta / MAX_SUBSTEP_SECONDS - TIME_EPSILON))
    const substep = clampedDelta / substepCount
    for (let index = 0; index < substepCount && !this.#isTerminal(); index += 1) {
      this.#advanceSubstep(substep)
    }
  }

  #registerEnemyDefeat(enemyId: number): boolean {
    if (this.#isTerminal()) return false
    const enemy = this.#enemies.get(enemyId)
    if (!enemy || !enemy.alive) return false

    enemy.alive = false
    this.#pushEvent({ type: 'enemy-defeated', enemyId, at: this.#elapsed })
    if (enemy.kind === 'bamboo-warden') this.#settle('boss-defeated')
    return true
  }

  #settle(reason: BattleTerminalReason): boolean {
    if (this.#isTerminal()) return false
    this.#settled = true
    this.#phase = 'settled'
    this.#terminalReason = reason
    this.#pushEvent({ type: 'stage-settled', stageId: this.#stageId, at: this.#elapsed })
    return true
  }

  #drainCombatEvents(): readonly CombatEvent[] {
    const queued = this.#events
    this.#events = []
    return Object.freeze(queued.map(freezeEventCopy))
  }
}

export function createBattleSession(input: {
  stageId: number
  seed: number
  config: StageOneCombatConfig
}): BattleSession {
  const config = parseStageOneConfig(input.config)
  if (input.stageId !== config.stageId) throw new Error('stageId must match config.stageId')
  if (!Number.isFinite(input.seed) || !Number.isInteger(input.seed) || input.seed < 0 || input.seed > MAX_UINT32) {
    throw new Error('seed must be a finite uint32 integer')
  }
  return constructSession(input.stageId, input.seed, config)
}

export function advanceBattleSession(session: BattleSession, deltaSeconds: number): void {
  advanceSession(requireBattleSession(session), deltaSeconds)
}

export function registerEnemyDefeat(session: BattleSession, enemyId: number): boolean {
  return defeatEnemy(requireBattleSession(session), enemyId)
}

export function settleBattleSession(session: BattleSession, reason: BattleTerminalReason): boolean {
  return settleSession(requireBattleSession(session), reason)
}

export function drainCombatEvents(session: BattleSession): readonly CombatEvent[] {
  return drainSessionEvents(requireBattleSession(session))
}
