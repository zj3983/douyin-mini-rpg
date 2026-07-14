import type { BattleRect, Point2 } from './CombatTypes.ts'
import type { EnemyCommand, EnemyContext, EnemyDangerDescriptor } from './EnemyBrain.ts'

export type BossAttackId = 'bamboo-sweep' | 'ground-spikes' | 'mountain-roar'
export type BossBrainPhase = 'spawn' | 'telegraph' | 'attack' | 'recovery' | 'hurt' | 'interrupted' | 'death'

export const BAMBOO_WARDEN_TARGET_GRID = Object.freeze({
  cellSize: 48,
  tieBreak: 'positive-axis' as const,
})

export interface BossBrainSnapshot {
  readonly id: number
  readonly phase: BossBrainPhase
  readonly phaseNumber: 1 | 2
  readonly healthRatio: number
  readonly elapsed: number
  readonly position: Readonly<Point2>
  readonly lastAttack: BossAttackId | null
  readonly attackSequence: number
  readonly cooldowns: Readonly<Record<BossAttackId, number>>
}

type BossEventType =
  | 'select'
  | 'telegraph'
  | 'spike-marker'
  | 'sweep-active'
  | 'spike-active'
  | 'roar-wave'
  | 'recovery'
  | 'resume'

interface BossEvent {
  readonly at: number
  readonly order: number
  readonly type: BossEventType
  readonly attack?: BossAttackId
  readonly sequence?: number
  readonly markerIndex?: number
  readonly waveIndex?: number
}

const BOSS_TOKEN = Symbol('BossBrainState')
const ATTACKS: readonly BossAttackId[] = Object.freeze(['bamboo-sweep', 'ground-spikes', 'mountain-roar'])
const TELEGRAPH_SECONDS = 0.8
const MAX_EXTERNAL_DELTA_SECONDS = 0.25
const HAZARD_SEQUENCE_INTERVAL_SECONDS = 0.18
const SPIKE_MARKER_COUNT = 3
const ROAR_WAVE_RADII = Object.freeze([80, 135, 190])
const ROAR_SECTORS = Object.freeze(['top', 'bottom', 'right', 'left-upper', 'left-lower'])
const MAX_NON_ROAR_HAZARDS = Math.max(SPIKE_MARKER_COUNT, 1)
const TIME_EPSILON = 1e-10
const MAX_UINT32 = 0xffffffff
const COORDINATE_LIMIT = 10_000_000
const ATTACK_COOLDOWNS: Readonly<Record<BossAttackId, number>> = Object.freeze({
  'bamboo-sweep': 2.8,
  'ground-spikes': 3.2,
  'mountain-roar': 3.6,
})
const ATTACK_END_OFFSETS: Readonly<Record<BossAttackId, number>> = Object.freeze({
  'bamboo-sweep': 1.48,
  'ground-spikes': 1.72,
  'mountain-roar': 1.82,
})
const ATTACK_ACTIVE_END_OFFSETS: Readonly<Record<BossAttackId, number>> = Object.freeze({
  'bamboo-sweep': 0.98,
  'ground-spikes': 1.22,
  'mountain-roar': 1.28,
})

// Coarse frames must keep every roar wave visible through a render boundary while
// the paired phase-two attack can retain all three spike markers.
export const BOSS_HAZARD_POOL_CAPACITY = ROAR_WAVE_RADII.length * ROAR_SECTORS.length + MAX_NON_ROAR_HAZARDS

let constructBoss: (id: number, spawn: Point2, seed: number) => BossBrainState
let advanceBoss: (state: BossBrainState, context: EnemyContext, deltaSeconds: number) => readonly EnemyCommand[]
let updateHealth: (state: BossBrainState, ratio: number) => void
let relocateBoss: (state: BossBrainState, position: Point2) => void
let hurtBoss: (state: BossBrainState, now: number) => readonly EnemyCommand[]
let interruptBoss: (state: BossBrainState, now: number) => readonly EnemyCommand[]
let defeatBoss: (state: BossBrainState, now: number) => readonly EnemyCommand[]

function isFinitePoint(value: unknown): value is Point2 {
  if (value === null || typeof value !== 'object') return false
  const point = value as Point2
  return Number.isFinite(point.x)
    && Number.isFinite(point.y)
    && Math.abs(point.x) <= COORDINATE_LIMIT
    && Math.abs(point.y) <= COORDINATE_LIMIT
}

function isFiniteBounds(value: unknown): value is BattleRect {
  if (value === null || typeof value !== 'object') return false
  const bounds = value as BattleRect
  return isFinitePoint({ x: bounds.minX, y: bounds.minY })
    && isFinitePoint({ x: bounds.maxX, y: bounds.maxY })
    && bounds.minX <= bounds.maxX
    && bounds.minY <= bounds.maxY
}

function validateContext(context: EnemyContext): void {
  if (!Number.isFinite(context?.now)) throw new TypeError('context now must be finite')
  if (!context.player || !isFinitePoint(context.player.position)) {
    throw new TypeError('player position must contain finite coordinates')
  }
  if (!isFiniteBounds(context.battleBounds)) throw new TypeError('battleBounds must be finite and ordered')
  if (context.playerMotion) {
    const motion = context.playerMotion
    if (
      !Number.isFinite(motion.fromTime)
      || !Number.isFinite(motion.toTime)
      || motion.fromTime > motion.toTime
      || !isFinitePoint(motion.fromPosition)
      || !isFinitePoint(motion.toPosition)
    ) throw new TypeError('playerMotion must contain finite ordered samples')
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function roundTime(value: number): number {
  return Math.round(value * 1e12) / 1e12
}

function roundCoordinate(value: number): number {
  return Math.round(value * 1e6) / 1e6
}

function mixUint32(value: number): number {
  let mixed = value >>> 0
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x7feb352d)
  mixed = Math.imul(mixed ^ (mixed >>> 15), 0x846ca68b)
  return (mixed ^ (mixed >>> 16)) >>> 0
}

function freezePoint(point: Readonly<Point2>): Readonly<Point2> {
  return Object.freeze({ x: point.x, y: point.y })
}

function freezeRect(rect: Readonly<BattleRect>): Readonly<BattleRect> {
  return Object.freeze({ minX: rect.minX, maxX: rect.maxX, minY: rect.minY, maxY: rect.maxY })
}

function freezeDanger(danger: Readonly<EnemyDangerDescriptor> | undefined): Readonly<EnemyDangerDescriptor> | undefined {
  if (!danger) return undefined
  if (danger.kind === 'sweep') return Object.freeze({ ...danger, origin: freezePoint(danger.origin) })
  if (danger.kind === 'spike') return Object.freeze({ ...danger, center: freezePoint(danger.center) })
  return Object.freeze({ ...danger, safeGap: Object.freeze({ ...danger.safeGap }) })
}

function freezeCommand(command: EnemyCommand): EnemyCommand {
  if (command.type === 'move') return Object.freeze({ ...command, velocity: freezePoint(command.velocity) })
  if (command.type === 'face' || command.type === 'animate') return Object.freeze({ ...command })
  if (command.type === 'spawn-projectile') {
    return Object.freeze({ ...command, origin: freezePoint(command.origin), velocity: freezePoint(command.velocity) })
  }
  return Object.freeze({ ...command, area: freezeRect(command.area), danger: freezeDanger(command.danger) })
}

function freezeCommands(commands: EnemyCommand[]): readonly EnemyCommand[] {
  return Object.freeze(commands.map(freezeCommand))
}

function requireBoss(value: BossBrainState): BossBrainState {
  if (!(value instanceof BossBrainState)) throw new TypeError('state must be a BossBrainState')
  return value
}

function clippedArea(area: BattleRect, bounds: Readonly<BattleRect>): BattleRect | null {
  const clipped = {
    minX: Math.max(area.minX, bounds.minX),
    maxX: Math.min(area.maxX, bounds.maxX),
    minY: Math.max(area.minY, bounds.minY),
    maxY: Math.min(area.maxY, bounds.maxY),
  }
  return clipped.minX <= clipped.maxX && clipped.minY <= clipped.maxY ? clipped : null
}

function quantizeAxis(value: number, min: number, max: number): number {
  const cellSize = BAMBOO_WARDEN_TARGET_GRID.cellSize
  const firstCell = Math.ceil(min / cellSize)
  const lastCell = Math.floor(max / cellSize)
  if (firstCell > lastCell) return roundCoordinate((min + max) / 2)
  const nearestCell = Math.floor(value / cellSize + 0.5)
  return clamp(nearestCell, firstCell, lastCell) * cellSize
}

export function quantizeBambooWardenTarget(
  position: Readonly<Point2>,
  centerBounds: Readonly<BattleRect>,
): Readonly<Point2> {
  if (!isFinitePoint(position)) throw new TypeError('position must contain finite supported coordinates')
  if (!isFiniteBounds(centerBounds)) throw new TypeError('centerBounds must be finite and ordered')
  return freezePoint({
    x: quantizeAxis(position.x, centerBounds.minX, centerBounds.maxX),
    y: quantizeAxis(position.y, centerBounds.minY, centerBounds.maxY),
  })
}

export class BossBrainState {
  #id: number
  #phase: BossBrainPhase = 'spawn'
  #healthRatio = 1
  #elapsed = 0
  #position: Point2
  #randomState: number
  #lastAttack: BossAttackId | null = null
  #attackSequence = 0
  #uninterruptibleUntil = 0
  #eventOrder = 0
  #events: BossEvent[] = []
  #cooldowns: Record<BossAttackId, number> = {
    'bamboo-sweep': 0,
    'ground-spikes': 0,
    'mountain-roar': 0,
  }
  #spikeAreas = new Map<string, Readonly<BattleRect>>()
  #sweepAreas = new Map<string, Readonly<BattleRect>>()
  #roarAreasByAttack = new Map<string, readonly {
    readonly waveIndex: number
    readonly radius: number
    readonly sector: string
    readonly area: Readonly<BattleRect>
  }[]>()

  private constructor(token: symbol, id: number, spawn: Point2, seed: number) {
    if (token !== BOSS_TOKEN) throw new TypeError('BossBrainState must be created by createBambooWardenBrain')
    this.#id = id
    this.#position = { ...spawn }
    this.#randomState = mixUint32(seed ^ Math.imul(id + 1, 0x9e3779b9))
    this.#schedule({ at: 0.4, type: 'select' })
  }

  static {
    constructBoss = (id, spawn, seed) => new BossBrainState(BOSS_TOKEN, id, spawn, seed)
    advanceBoss = (state, context, deltaSeconds) => state.#step(context, deltaSeconds)
    updateHealth = (state, ratio) => state.#setHealthRatio(ratio)
    relocateBoss = (state, position) => state.#relocate(position)
    hurtBoss = (state, now) => state.#interruptWith('hurt', now)
    interruptBoss = (state, now) => state.#interruptWith('interrupted', now)
    defeatBoss = (state, now) => state.#defeat(now)
  }

  get id(): number { return this.#id }
  get phase(): BossBrainPhase { return this.#phase }
  get phaseNumber(): 1 | 2 { return this.#healthRatio < 0.5 ? 2 : 1 }
  get healthRatio(): number { return this.#healthRatio }
  get elapsed(): number { return Math.round(this.#elapsed * 1e9) / 1e9 }
  get position(): Readonly<Point2> { return freezePoint(this.#position) }
  get lastAttack(): BossAttackId | null { return this.#lastAttack }

  snapshot(): Readonly<BossBrainSnapshot> {
    return Object.freeze({
      id: this.#id,
      phase: this.#phase,
      phaseNumber: this.phaseNumber,
      healthRatio: this.#healthRatio,
      elapsed: this.elapsed,
      position: this.position,
      lastAttack: this.#lastAttack,
      attackSequence: this.#attackSequence,
      cooldowns: Object.freeze({ ...this.#cooldowns }),
    })
  }

  #random(): number {
    this.#randomState = (Math.imul(this.#randomState, 1664525) + 1013904223) >>> 0
    return this.#randomState / 0x100000000
  }

  #schedule(event: Omit<BossEvent, 'order'>): void {
    this.#events.push(Object.freeze({ ...event, at: roundTime(event.at), order: this.#eventOrder++ }))
    this.#events.sort((left, right) => left.at - right.at || left.order - right.order)
  }

  #attackId(attack: BossAttackId, sequence: number): string {
    return `${attack}:${this.#id}:${sequence}`
  }

  #choose(pool: readonly BossAttackId[]): BossAttackId {
    return pool[Math.min(pool.length - 1, Math.floor(this.#random() * pool.length))]
  }

  #selectAttack(ready: readonly BossAttackId[], excluded: readonly BossAttackId[]): BossAttackId {
    const preferred = ready.filter((attack) => !excluded.includes(attack))
    return this.#choose(preferred.length > 0 ? preferred : ready)
  }

  #selectCycle(at: number): void {
    const ready = ATTACKS.filter((attack) => this.#cooldowns[attack] <= at + TIME_EPSILON)
    if (ready.length === 0) {
      this.#schedule({ at: Math.min(...Object.values(this.#cooldowns)), type: 'select' })
      return
    }
    const first = this.#selectAttack(ready, this.#lastAttack ? [this.#lastAttack] : [])
    const selected = [first]
    if (this.phaseNumber === 2) {
      const secondPool = ready.filter((attack) => attack !== first)
      if (secondPool.length > 0) selected.push(this.#selectAttack(secondPool, []))
    }

    let cycleEnd = at
    selected.forEach((attack, index) => {
      const attackStart = roundTime(at + index * 0.32)
      this.#attackSequence += 1
      this.#lastAttack = attack
      this.#cooldowns[attack] = roundTime(attackStart + ATTACK_COOLDOWNS[attack])
      this.#uninterruptibleUntil = Math.max(
        this.#uninterruptibleUntil,
        roundTime(attackStart + ATTACK_ACTIVE_END_OFFSETS[attack]),
      )
      this.#scheduleAttack(attack, this.#attackSequence, attackStart)
      cycleEnd = Math.max(cycleEnd, attackStart + ATTACK_END_OFFSETS[attack])
    })
    this.#schedule({ at: roundTime(cycleEnd + 0.2), type: 'select' })
  }

  #scheduleAttack(attack: BossAttackId, sequence: number, at: number): void {
    if (attack === 'bamboo-sweep') {
      this.#schedule({ at, type: 'telegraph', attack, sequence })
      this.#schedule({ at: at + TELEGRAPH_SECONDS, type: 'sweep-active', attack, sequence })
      this.#schedule({ at: at + 0.98, type: 'recovery', attack, sequence })
      return
    }
    if (attack === 'ground-spikes') {
      for (let markerIndex = 0; markerIndex < SPIKE_MARKER_COUNT; markerIndex += 1) {
        this.#schedule({ at: at + markerIndex * HAZARD_SEQUENCE_INTERVAL_SECONDS, type: 'spike-marker', attack, sequence, markerIndex })
        this.#schedule({ at: at + TELEGRAPH_SECONDS + markerIndex * HAZARD_SEQUENCE_INTERVAL_SECONDS, type: 'spike-active', attack, sequence, markerIndex })
      }
      this.#schedule({ at: at + 1.24, type: 'recovery', attack, sequence })
      return
    }
    this.#schedule({ at, type: 'telegraph', attack, sequence })
    for (let waveIndex = 0; waveIndex < ROAR_WAVE_RADII.length; waveIndex += 1) {
      this.#schedule({ at: at + TELEGRAPH_SECONDS + waveIndex * HAZARD_SEQUENCE_INTERVAL_SECONDS, type: 'roar-wave', attack, sequence, waveIndex })
    }
    this.#schedule({ at: at + 1.32, type: 'recovery', attack, sequence })
  }

  #sweepArea(context: EnemyContext): BattleRect {
    const height = Math.max(1, context.battleBounds.maxY - context.battleBounds.minY)
    const escape = Math.min(72, height * 0.24)
    const halfBand = Math.min(54, Math.max(18, (height - escape * 2) / 2))
    const centerBounds = {
      minX: context.battleBounds.minX,
      maxX: context.battleBounds.maxX,
      minY: context.battleBounds.minY + escape + halfBand,
      maxY: context.battleBounds.maxY - escape - halfBand,
    }
    const centerY = quantizeBambooWardenTarget(context.player.position, centerBounds).y
    return {
      minX: context.battleBounds.minX,
      maxX: Math.min(context.battleBounds.maxX, this.#position.x + 36),
      minY: centerY - halfBand,
      maxY: centerY + halfBand,
    }
  }

  #spikeArea(context: EnemyContext): BattleRect {
    const half = 28
    const center = quantizeBambooWardenTarget(context.player.position, {
      minX: context.battleBounds.minX + half,
      maxX: context.battleBounds.maxX - half,
      minY: context.battleBounds.minY + half,
      maxY: context.battleBounds.maxY - half,
    })
    return { minX: center.x - half, maxX: center.x + half, minY: center.y - half, maxY: center.y + half }
  }

  #roarAreas(radius: number, bounds: Readonly<BattleRect>): readonly { sector: string; area: BattleRect }[] {
    const thickness = 42
    const half = thickness / 2
    const gapHalf = radius * 0.34
    const x = this.#position.x
    const y = this.#position.y
    const candidates = [
      { sector: ROAR_SECTORS[0], area: { minX: x - radius + half, maxX: x + radius - half, minY: y + radius - half, maxY: y + radius + half } },
      { sector: ROAR_SECTORS[1], area: { minX: x - radius + half, maxX: x + radius - half, minY: y - radius - half, maxY: y - radius + half } },
      { sector: ROAR_SECTORS[2], area: { minX: x + radius - half, maxX: x + radius + half, minY: y - radius, maxY: y + radius } },
      { sector: ROAR_SECTORS[3], area: { minX: x - radius - half, maxX: x - radius + half, minY: y + gapHalf, maxY: y + radius } },
      { sector: ROAR_SECTORS[4], area: { minX: x - radius - half, maxX: x - radius + half, minY: y - radius, maxY: y - gapHalf } },
    ]
    return Object.freeze(candidates.flatMap((candidate) => {
      const area = clippedArea(candidate.area, bounds)
      return area ? [{ sector: candidate.sector, area }] : []
    }))
  }

  #roarDanger(waveIndex: number, radius: number, sector: string): EnemyDangerDescriptor {
    return {
      kind: 'roar-sector',
      waveIndex,
      radius,
      sector,
      safeGap: { sector: 'left', centerAngle: Math.PI, width: Math.PI / 3 },
    }
  }

  #contextAt(context: EnemyContext, eventTime: number): EnemyContext {
    const motion = context.playerMotion
    if (!motion) return context
    const span = motion.toTime - motion.fromTime
    const progress = span <= TIME_EPSILON
      ? 1
      : clamp((eventTime - motion.fromTime) / span, 0, 1)
    const position = {
      x: roundCoordinate(motion.fromPosition.x + (motion.toPosition.x - motion.fromPosition.x) * progress),
      y: roundCoordinate(motion.fromPosition.y + (motion.toPosition.y - motion.fromPosition.y) * progress),
    }
    return {
      ...context,
      now: eventTime,
      player: { ...context.player, position },
    }
  }

  #emit(event: BossEvent, context: EnemyContext, commands: EnemyCommand[]): void {
    if (event.type === 'select') {
      this.#selectCycle(event.at)
      return
    }
    if (event.type === 'resume') {
      this.#phase = 'recovery'
      commands.push({ type: 'animate', action: 'boss-recovery' })
      this.#schedule({ at: event.at + 0.3, type: 'select' })
      return
    }
    const attack = event.attack as BossAttackId
    const sequence = event.sequence as number
    const baseId = this.#attackId(attack, sequence)
    if (event.type === 'telegraph' && attack === 'bamboo-sweep') {
      this.#phase = 'telegraph'
      const area = this.#sweepArea(context)
      this.#sweepAreas.set(baseId, freezeRect(area))
      commands.push({ type: 'face', direction: context.player.position.x < this.#position.x ? -1 : 1 })
      commands.push({ type: 'animate', action: 'boss-sweep-telegraph' })
      commands.push({
        type: 'show-telegraph',
        attackId: baseId,
        area,
        duration: TELEGRAPH_SECONDS,
        eventTime: event.at,
        activatesAt: roundTime(event.at + TELEGRAPH_SECONDS),
        telegraphId: baseId,
        danger: { kind: 'sweep', escape: 'vertical', origin: this.#position, arcDegrees: 120 },
      })
      return
    }
    if (event.type === 'spike-marker') {
      this.#phase = 'telegraph'
      const markerIndex = event.markerIndex as number
      const attackId = `${baseId}:marker:${markerIndex}`
      const area = this.#spikeArea(context)
      this.#spikeAreas.set(attackId, freezeRect(area))
      const center = { x: (area.minX + area.maxX) / 2, y: (area.minY + area.maxY) / 2 }
      if (markerIndex === 0) commands.push({ type: 'animate', action: 'boss-spikes-telegraph' })
      commands.push({
        type: 'show-telegraph',
        attackId,
        area,
        duration: TELEGRAPH_SECONDS,
        eventTime: event.at,
        activatesAt: roundTime(event.at + TELEGRAPH_SECONDS),
        telegraphId: attackId,
        danger: { kind: 'spike', markerIndex, center },
      })
      return
    }
    if (event.type === 'telegraph' && attack === 'mountain-roar') {
      this.#phase = 'telegraph'
      commands.push({ type: 'animate', action: 'boss-roar-telegraph' })
      const lockedAreas = Object.freeze(ROAR_WAVE_RADII.flatMap((radius, waveIndex) =>
        this.#roarAreas(radius, context.battleBounds).map((sector) => Object.freeze({
          waveIndex,
          radius,
          sector: sector.sector,
          area: freezeRect(sector.area),
        })),
      ))
      this.#roarAreasByAttack.set(baseId, lockedAreas)
      for (const sector of lockedAreas.filter((locked) => locked.waveIndex === 2)) {
        commands.push({
          type: 'show-telegraph',
          attackId: `${baseId}:sector:${sector.sector}`,
          area: sector.area,
          duration: TELEGRAPH_SECONDS,
          eventTime: event.at,
          activatesAt: roundTime(event.at + TELEGRAPH_SECONDS),
          telegraphId: baseId,
          danger: this.#roarDanger(-1, 190, sector.sector),
        })
      }
      return
    }
    if (event.type === 'sweep-active') {
      this.#phase = 'attack'
      const area = this.#sweepAreas.get(baseId)
      if (!area) return
      commands.push({ type: 'animate', action: 'boss-sweep-active' })
      commands.push({
        type: 'activate-hitbox',
        attackId: baseId,
        area,
        damage: 8,
        duration: 0.18,
        eventTime: event.at,
        activationNotBefore: event.at,
        telegraphId: baseId,
        danger: { kind: 'sweep', escape: 'vertical', origin: this.#position, arcDegrees: 120 },
      })
      this.#sweepAreas.delete(baseId)
      return
    }
    if (event.type === 'spike-active') {
      this.#phase = 'attack'
      const markerIndex = event.markerIndex as number
      const attackId = `${baseId}:marker:${markerIndex}`
      const area = this.#spikeAreas.get(attackId)
      if (!area) return
      if (markerIndex === 0) commands.push({ type: 'animate', action: 'boss-spikes-active' })
      const center = { x: (area.minX + area.maxX) / 2, y: (area.minY + area.maxY) / 2 }
      commands.push({
        type: 'activate-hitbox',
        attackId,
        area,
        damage: 7,
        duration: 0.14,
        eventTime: event.at,
        activationNotBefore: event.at,
        telegraphId: attackId,
        danger: { kind: 'spike', markerIndex, center },
      })
      this.#spikeAreas.delete(attackId)
      return
    }
    if (event.type === 'roar-wave') {
      this.#phase = 'attack'
      const waveIndex = event.waveIndex as number
      const radius = ROAR_WAVE_RADII[waveIndex]
      if (waveIndex === 0) commands.push({ type: 'animate', action: 'boss-roar-active' })
      const lockedAreas = this.#roarAreasByAttack.get(baseId) ?? []
      for (const sector of lockedAreas.filter((locked) => locked.waveIndex === waveIndex)) {
        commands.push({
          type: 'activate-hitbox',
          attackId: `${baseId}:wave:${waveIndex}:sector:${sector.sector}`,
          area: sector.area,
          damage: 6,
          duration: 0.12,
          eventTime: event.at,
          activationNotBefore: event.at,
          telegraphId: baseId,
          danger: this.#roarDanger(waveIndex, radius, sector.sector),
        })
      }
      if (waveIndex === 2) this.#roarAreasByAttack.delete(baseId)
      return
    }
    if (event.type === 'recovery') {
      this.#phase = 'recovery'
      commands.push({ type: 'animate', action: 'boss-recovery' })
    }
  }

  #step(context: EnemyContext, deltaSeconds: number): readonly EnemyCommand[] {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return Object.freeze([])
    validateContext(context)
    const target = roundTime(this.#elapsed + Math.min(deltaSeconds, MAX_EXTERNAL_DELTA_SECONDS))
    if (this.#phase === 'death') {
      this.#elapsed = target
      return Object.freeze([])
    }
    const commands: EnemyCommand[] = []
    while (this.#events.length > 0 && this.#events[0].at <= target + TIME_EPSILON) {
      const event = this.#events.shift() as BossEvent
      this.#elapsed = Math.max(this.#elapsed, event.at)
      this.#emit(event, this.#contextAt(context, event.at), commands)
    }
    this.#elapsed = target
    return freezeCommands(commands)
  }

  #setHealthRatio(ratio: number): void {
    if (!Number.isFinite(ratio)) throw new TypeError('health ratio must be finite')
    this.#healthRatio = clamp(ratio, 0, 1)
  }

  #relocate(position: Point2): void {
    if (!isFinitePoint(position)) throw new TypeError('position must contain finite supported coordinates')
    this.#position = { ...position }
  }

  #interruptWith(phase: 'hurt' | 'interrupted', now: number): readonly EnemyCommand[] {
    if (!Number.isFinite(now)) throw new TypeError('now must be finite')
    if (
      now + TIME_EPSILON < this.#elapsed
      || this.#phase !== 'recovery'
      || this.#elapsed + TIME_EPSILON < this.#uninterruptibleUntil
    ) return Object.freeze([])
    this.#events = []
    this.#spikeAreas.clear()
    this.#sweepAreas.clear()
    this.#roarAreasByAttack.clear()
    this.#phase = phase
    this.#schedule({ at: this.#elapsed + 0.25, type: 'resume' })
    return freezeCommands([
      { type: 'move', velocity: { x: 0, y: 0 } },
      { type: 'animate', action: phase === 'hurt' ? 'boss-hurt' : 'boss-interrupted' },
    ])
  }

  #defeat(now: number): readonly EnemyCommand[] {
    if (!Number.isFinite(now)) throw new TypeError('now must be finite')
    if (this.#phase === 'death') return Object.freeze([])
    this.#events = []
    this.#spikeAreas.clear()
    this.#sweepAreas.clear()
    this.#roarAreasByAttack.clear()
    this.#phase = 'death'
    return freezeCommands([
      { type: 'move', velocity: { x: 0, y: 0 } },
      { type: 'animate', action: 'boss-death' },
    ])
  }
}

export function createBambooWardenBrain(id: number, spawn: Point2, seed: number): BossBrainState {
  if (!Number.isSafeInteger(id) || id < 0) throw new TypeError('id must be a non-negative safe integer')
  if (!isFinitePoint(spawn)) throw new TypeError('spawn must contain finite supported coordinates')
  if (!Number.isFinite(seed) || !Number.isInteger(seed) || seed < 0 || seed > MAX_UINT32) {
    throw new TypeError('seed must be a finite uint32 integer')
  }
  return constructBoss(id, spawn, seed)
}

export function stepBambooWarden(
  state: BossBrainState,
  context: EnemyContext,
  deltaSeconds: number,
): readonly EnemyCommand[] {
  return advanceBoss(requireBoss(state), context, deltaSeconds)
}

export function setBossHealthRatio(state: BossBrainState, ratio: number): void {
  updateHealth(requireBoss(state), ratio)
}

export function setBambooWardenPosition(state: BossBrainState, position: Point2): void {
  relocateBoss(requireBoss(state), position)
}

export function hurtBambooWarden(state: BossBrainState, now: number): readonly EnemyCommand[] {
  return hurtBoss(requireBoss(state), now)
}

export function interruptBambooWarden(state: BossBrainState, now: number): readonly EnemyCommand[] {
  return interruptBoss(requireBoss(state), now)
}

export function defeatBambooWarden(state: BossBrainState, now: number): readonly EnemyCommand[] {
  return defeatBoss(requireBoss(state), now)
}
