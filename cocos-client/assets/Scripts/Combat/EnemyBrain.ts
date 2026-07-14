import type { BattleRect, Point2 } from './CombatTypes.ts'

export type OrdinaryEnemyKind = 'moss-wolf' | 'green-wing-moth'
export type EnemyBrainPhase =
  | 'spawn'
  | 'select-position'
  | 'telegraph'
  | 'attack'
  | 'recovery'
  | 'hurt'
  | 'interrupted'
  | 'death'
export type EnemyAttack = 'pounce' | 'dive' | 'spirit-orb'
export type EnemyPresentationAction = 'idle' | 'move' | 'attack' | 'hurt' | 'death'

export interface EnemyAnimationCatalogCompatibility {
  readonly compatible: boolean
  readonly missing: readonly EnemyPresentationAction[]
}

export interface EnemyContext {
  readonly now: number
  readonly player: {
    readonly id: string
    readonly position: Readonly<Point2>
    readonly alive: boolean
  }
  readonly neighbors: readonly {
    readonly id: number
    readonly position: Readonly<Point2>
    readonly alive: boolean
  }[]
  readonly battleBounds: Readonly<BattleRect>
}

export type EnemyCommand =
  | { readonly type: 'move'; readonly velocity: Readonly<Point2> }
  | { readonly type: 'face'; readonly direction: -1 | 1 }
  | { readonly type: 'animate'; readonly action: string }
  | {
    readonly type: 'show-telegraph'
    readonly attackId: string
    readonly area: Readonly<BattleRect>
    readonly duration: number
  }
  | {
    readonly type: 'activate-hitbox'
    readonly attackId: string
    readonly area: Readonly<BattleRect>
    readonly damage: number
    readonly duration: number
  }
  | {
    readonly type: 'spawn-projectile'
    readonly attackId: string
    readonly origin: Readonly<Point2>
    readonly velocity: Readonly<Point2>
    readonly radius: number
    readonly damage: number
    readonly duration: number
  }

export interface EnemyBrainSnapshot {
  readonly kind: OrdinaryEnemyKind
  readonly id: number
  readonly phase: EnemyBrainPhase
  readonly attack: EnemyAttack
  readonly elapsed: number
  readonly position: Readonly<Point2>
  readonly selectedPosition: Readonly<Point2>
  readonly sampledTarget: Readonly<Point2> | null
  readonly attackDestination: Readonly<Point2> | null
  readonly decisionCount: number
  readonly nextDecisionAt: number
  readonly attackSequence: number
}

const BRAIN_TOKEN = Symbol('EnemyBrainState')
const MAX_EXTERNAL_DELTA_SECONDS = 0.25
const MAX_SUBSTEP_SECONDS = 1 / 60
const DECISION_INTERVAL_SECONDS = 0.1
const DECISION_EPSILON = 1e-10
const WOLF_TELEGRAPH_SECONDS = 0.45
const MOTH_TELEGRAPH_SECONDS = 0.48
const WOLF_ATTACK_SECONDS = 0.36
const MOTH_DIVE_SECONDS = 0.42
const MOTH_ORB_SECONDS = 0.18
const MAX_UINT32 = 0xffffffff
const COORDINATE_LIMIT = 10_000_000

let constructBrain: (
  kind: OrdinaryEnemyKind,
  id: number,
  spawn: Point2,
  seed: number,
) => EnemyBrainState
let advanceBrain: (state: EnemyBrainState, context: EnemyContext, deltaSeconds: number) => readonly EnemyCommand[]
let hurtBrain: (state: EnemyBrainState, now: number) => readonly EnemyCommand[]
let interruptBrain: (state: EnemyBrainState, now: number) => readonly EnemyCommand[]
let defeatBrain: (state: EnemyBrainState, now: number) => readonly EnemyCommand[]

const REQUIRED_PRESENTATION_ACTIONS: readonly EnemyPresentationAction[] = Object.freeze([
  'idle',
  'move',
  'attack',
  'hurt',
  'death',
])

const SEMANTIC_PRESENTATION_ACTIONS: Readonly<Record<OrdinaryEnemyKind, Readonly<Record<string, EnemyPresentationAction>>>> = Object.freeze({
  'moss-wolf': Object.freeze({
    'wolf-prowl': 'move',
    'wolf-crouch': 'attack',
    'wolf-pounce': 'attack',
    'wolf-brake': 'idle',
    'wolf-hurt': 'hurt',
    'wolf-interrupted': 'hurt',
    'wolf-death': 'death',
  }),
  'green-wing-moth': Object.freeze({
    'moth-flight': 'move',
    'moth-dive': 'attack',
    'moth-spirit-orb': 'attack',
    'moth-recover': 'idle',
    'moth-hurt': 'hurt',
    'moth-interrupted': 'hurt',
    'moth-death': 'death',
  }),
})

function requireOrdinaryKind(kind: OrdinaryEnemyKind): OrdinaryEnemyKind {
  if (kind !== 'moss-wolf' && kind !== 'green-wing-moth') {
    throw new TypeError('kind must be moss-wolf or green-wing-moth')
  }
  return kind
}

export function mapEnemyAnimationAction(
  kind: OrdinaryEnemyKind,
  semanticAction: string,
): EnemyPresentationAction {
  const mapping = SEMANTIC_PRESENTATION_ACTIONS[requireOrdinaryKind(kind)]
  if (typeof semanticAction !== 'string') throw new TypeError('semanticAction must be a string')
  return mapping[semanticAction] ?? 'idle'
}

export function enemyAnimationCatalogCompatibility(
  kind: OrdinaryEnemyKind,
  availableActions: readonly string[],
): Readonly<EnemyAnimationCatalogCompatibility> {
  requireOrdinaryKind(kind)
  if (!Array.isArray(availableActions) || availableActions.some((action) => typeof action !== 'string')) {
    throw new TypeError('availableActions must be an array of strings')
  }
  const available = new Set(availableActions)
  const missing = Object.freeze(REQUIRED_PRESENTATION_ACTIONS.filter((action) => !available.has(action)))
  return Object.freeze({ compatible: missing.length === 0, missing })
}

function freezePoint(point: Point2): Readonly<Point2> {
  return Object.freeze({ x: point.x, y: point.y })
}

function freezeRect(rect: BattleRect): Readonly<BattleRect> {
  return Object.freeze({ minX: rect.minX, maxX: rect.maxX, minY: rect.minY, maxY: rect.maxY })
}

function freezeCommand(command: EnemyCommand): EnemyCommand {
  switch (command.type) {
    case 'move':
      return Object.freeze({ type: command.type, velocity: freezePoint(command.velocity) })
    case 'face':
    case 'animate':
      return Object.freeze({ ...command })
    case 'show-telegraph':
      return Object.freeze({ ...command, area: freezeRect(command.area) })
    case 'activate-hitbox':
      return Object.freeze({ ...command, area: freezeRect(command.area) })
    case 'spawn-projectile':
      return Object.freeze({
        ...command,
        origin: freezePoint(command.origin),
        velocity: freezePoint(command.velocity),
      })
  }
}

function freezeCommands(commands: EnemyCommand[]): readonly EnemyCommand[] {
  return Object.freeze(commands.map(freezeCommand))
}

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
  if (!Array.isArray(context.neighbors)) throw new TypeError('neighbors must be an array')
  for (const neighbor of context.neighbors) {
    if (!Number.isSafeInteger(neighbor.id) || !isFinitePoint(neighbor.position)) {
      throw new TypeError('neighbor positions and ids must be finite')
    }
  }
  if (!isFiniteBounds(context.battleBounds)) throw new TypeError('battleBounds must be finite and ordered')
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function distance(a: Point2, b: Point2): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function normalizedVelocity(from: Point2, to: Point2, speed: number): Point2 {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  if (length <= 1e-9) return { x: 0, y: 0 }
  return { x: dx / length * speed, y: dy / length * speed }
}

function requireBrain(value: EnemyBrainState): EnemyBrainState {
  if (!(value instanceof EnemyBrainState)) throw new TypeError('state must be an EnemyBrainState')
  return value
}

export class EnemyBrainState {
  #kind: OrdinaryEnemyKind
  #id: number
  #phase: EnemyBrainPhase = 'spawn'
  #attack: EnemyAttack
  #elapsed = 0
  #phaseStartedAt = 0
  #position: Point2
  #selectedPosition: Point2
  #sampledTarget: Point2 | null = null
  #attackDestination: Point2 | null = null
  #velocity: Point2 = { x: 0, y: 0 }
  #groundY: number
  #randomState: number
  #decisionCount = 0
  #nextDecisionAt: number
  #attackSequence = 0
  #activeHitboxEmitted = false
  #projectilesEmitted = false
  #recoveryReturnsToSelection = false

  private constructor(token: symbol, kind: OrdinaryEnemyKind, id: number, spawn: Point2, seed: number) {
    if (token !== BRAIN_TOKEN) throw new TypeError('EnemyBrainState must be created by createEnemyBrain')
    this.#kind = kind
    this.#id = id
    this.#position = { ...spawn }
    this.#selectedPosition = { ...spawn }
    this.#groundY = spawn.y
    this.#randomState = seed
    this.#attack = kind === 'moss-wolf' ? 'pounce' : 'dive'
    this.#nextDecisionAt = (id % 5) * 0.02
  }

  static {
    constructBrain = (kind, id, spawn, seed) => new EnemyBrainState(BRAIN_TOKEN, kind, id, spawn, seed)
    advanceBrain = (state, context, deltaSeconds) => state.#step(context, deltaSeconds)
    hurtBrain = (state, now) => state.#hurt(now)
    interruptBrain = (state, now) => state.#interrupt(now)
    defeatBrain = (state, now) => state.#defeat(now)
  }

  get kind(): OrdinaryEnemyKind { return this.#kind }
  get id(): number { return this.#id }
  get phase(): EnemyBrainPhase { return this.#phase }
  get attack(): EnemyAttack { return this.#attack }
  get phaseLabel(): string {
    if (this.#kind === 'green-wing-moth' && (this.#phase === 'telegraph' || this.#phase === 'attack')) {
      return `${this.#phase}:${this.#attack}`
    }
    return this.#phase
  }
  get elapsed(): number { return this.#elapsed }
  get position(): Readonly<Point2> { return freezePoint(this.#position) }
  get selectedPosition(): Readonly<Point2> { return freezePoint(this.#selectedPosition) }
  get sampledTarget(): Readonly<Point2> | null { return this.#sampledTarget ? freezePoint(this.#sampledTarget) : null }
  get attackDestination(): Readonly<Point2> | null {
    return this.#attackDestination ? freezePoint(this.#attackDestination) : null
  }
  get decisionCount(): number { return this.#decisionCount }
  get nextDecisionAt(): number { return this.#nextDecisionAt }
  get attackSequence(): number { return this.#attackSequence }
  get attackDuration(): number {
    if (this.#kind === 'moss-wolf') return WOLF_ATTACK_SECONDS
    return this.#attack === 'dive' ? MOTH_DIVE_SECONDS : MOTH_ORB_SECONDS
  }

  snapshot(): Readonly<EnemyBrainSnapshot> {
    return Object.freeze({
      kind: this.#kind,
      id: this.#id,
      phase: this.#phase,
      attack: this.#attack,
      elapsed: this.#elapsed,
      position: this.position,
      selectedPosition: this.selectedPosition,
      sampledTarget: this.sampledTarget,
      attackDestination: this.attackDestination,
      decisionCount: this.#decisionCount,
      nextDecisionAt: this.#nextDecisionAt,
      attackSequence: this.#attackSequence,
    })
  }

  #random(): number {
    this.#randomState = (Math.imul(this.#randomState, 1664525) + 1013904223) >>> 0
    return this.#randomState / 0x100000000
  }

  #animationName(suffix: string): string {
    return this.#kind === 'moss-wolf' ? `wolf-${suffix}` : `moth-${suffix}`
  }

  #setPhase(phase: EnemyBrainPhase): void {
    this.#phase = phase
    this.#phaseStartedAt = this.#elapsed
  }

  #selectWolfPosition(context: EnemyContext): Point2 {
    const preferredSide = this.#random() < 0.5 ? -1 : 1
    const minX = context.battleBounds.minX + 24
    const maxX = context.battleBounds.maxX - 24
    const candidates = [preferredSide, -preferredSide].flatMap((side) => [180, 260].map((offset) => ({
      x: clamp(context.player.position.x + side * offset, minX, maxX),
      y: this.#groundY,
    })))
    const living = context.neighbors.filter((neighbor) => neighbor.alive && neighbor.id !== this.#id)
    let best = candidates[0]
    let bestSeparation = -1
    for (const candidate of candidates) {
      const separation = living.reduce(
        (minimum, neighbor) => Math.min(minimum, Math.abs(candidate.x - neighbor.position.x)),
        Number.POSITIVE_INFINITY,
      )
      if (separation > bestSeparation) {
        best = candidate
        bestSeparation = separation
      }
    }
    return best
  }

  #selectMothPosition(context: EnemyContext): Point2 {
    const minY = Math.min(context.battleBounds.maxY, Math.max(40, context.battleBounds.minY + 80))
    const maxY = Math.max(minY, context.battleBounds.maxY - 20)
    const preferredSide = this.#random() < 0.5 ? -1 : 1
    const desiredY = clamp(context.player.position.y + 170 + (this.#random() - 0.5) * 50, minY, maxY)
    const candidates = [preferredSide, -preferredSide].flatMap((side) => [160, 240].map((offset, index) => ({
      x: clamp(context.player.position.x + side * offset, context.battleBounds.minX + 20, context.battleBounds.maxX - 20),
      y: clamp(desiredY + (index === 0 ? 0 : 45), minY, maxY),
    })))
    const living = context.neighbors.filter((neighbor) => neighbor.alive && neighbor.id !== this.#id)
    let best = candidates[0]
    let bestSeparation = -1
    for (const candidate of candidates) {
      const separation = living.reduce(
        (minimum, neighbor) => Math.min(minimum, distance(candidate, neighbor.position)),
        Number.POSITIVE_INFINITY,
      )
      if (separation > bestSeparation) {
        best = candidate
        bestSeparation = separation
      }
    }
    return best
  }

  #attackId(): string {
    const prefix = this.#kind === 'moss-wolf'
      ? 'wolf-pounce'
      : this.#attack === 'dive' ? 'moth-dive' : 'moth-spirit-orb'
    return `${prefix}:${this.#id}:${this.#attackSequence}`
  }

  #wolfAttackArea(): BattleRect {
    const target = this.#sampledTarget ?? this.#position
    return { minX: target.x - 42, maxX: target.x + 42, minY: this.#groundY - 24, maxY: this.#groundY + 24 }
  }

  #mothDiveArea(): BattleRect {
    const target = this.#sampledTarget ?? this.#position
    return { minX: target.x - 34, maxX: target.x + 34, minY: target.y - 38, maxY: target.y + 38 }
  }

  #beginTelegraph(context: EnemyContext, commands: EnemyCommand[]): void {
    this.#attackSequence += 1
    this.#sampledTarget = this.#kind === 'moss-wolf'
      ? { x: context.player.position.x, y: this.#groundY }
      : { x: context.player.position.x, y: context.player.position.y }
    this.#attackDestination = null
    this.#velocity = { x: 0, y: 0 }
    this.#activeHitboxEmitted = false
    this.#projectilesEmitted = false
    this.#setPhase('telegraph')
    const duration = this.#kind === 'moss-wolf' ? WOLF_TELEGRAPH_SECONDS : MOTH_TELEGRAPH_SECONDS
    const area = this.#kind === 'moss-wolf'
      ? this.#wolfAttackArea()
      : this.#attack === 'dive'
        ? this.#mothDiveArea()
        : {
          minX: context.battleBounds.minX,
          maxX: context.battleBounds.maxX,
          minY: this.#sampledTarget.y - 88,
          maxY: this.#sampledTarget.y + 88,
        }
    commands.push({ type: 'animate', action: this.#kind === 'moss-wolf' ? 'wolf-crouch' : this.#animationName(this.#attack) })
    commands.push({ type: 'show-telegraph', attackId: this.#attackId(), area, duration })
  }

  #beginAttack(context: EnemyContext, commands: EnemyCommand[]): void {
    this.#setPhase('attack')
    const sample = this.#sampledTarget ?? context.player.position
    if (this.#kind === 'moss-wolf') {
      const direction = sample.x < this.#position.x ? -1 : 1
      this.#attackDestination = {
        x: clamp(sample.x + direction * 90, context.battleBounds.minX, context.battleBounds.maxX),
        y: this.#groundY,
      }
      commands.push({ type: 'animate', action: 'wolf-pounce' })
      return
    }
    if (this.#attack === 'dive') {
      const dx = sample.x - this.#position.x
      const dy = sample.y - this.#position.y
      const length = Math.max(1, Math.hypot(dx, dy))
      this.#attackDestination = {
        x: clamp(sample.x + dx / length * 80, context.battleBounds.minX, context.battleBounds.maxX),
        y: clamp(sample.y + dy / length * 80, context.battleBounds.minY, context.battleBounds.maxY),
      }
    }
    commands.push({ type: 'animate', action: this.#animationName(this.#attack) })
  }

  #beginRecovery(commands: EnemyCommand[], returnToSelection = false): void {
    this.#velocity = { x: 0, y: 0 }
    this.#recoveryReturnsToSelection = returnToSelection
    this.#setPhase('recovery')
    commands.push({ type: 'animate', action: this.#kind === 'moss-wolf' ? 'wolf-brake' : 'moth-recover' })
  }

  #runDecision(context: EnemyContext, commands: EnemyCommand[]): void {
    this.#decisionCount += 1
    if (this.#phase === 'spawn') {
      this.#setPhase('select-position')
      this.#selectedPosition = this.#kind === 'moss-wolf'
        ? this.#selectWolfPosition(context)
        : this.#selectMothPosition(context)
      commands.push({ type: 'animate', action: this.#kind === 'moss-wolf' ? 'wolf-prowl' : 'moth-flight' })
      return
    }
    if (this.#phase === 'select-position') {
      if (distance(this.#position, this.#selectedPosition) <= 6 || this.#elapsed - this.#phaseStartedAt >= 0.8) {
        this.#beginTelegraph(context, commands)
      }
      return
    }
    if (this.#phase === 'telegraph') {
      const duration = this.#kind === 'moss-wolf' ? WOLF_TELEGRAPH_SECONDS : MOTH_TELEGRAPH_SECONDS
      if (this.#elapsed - this.#phaseStartedAt + DECISION_EPSILON >= duration) this.#beginAttack(context, commands)
      return
    }
    if (this.#phase === 'attack') {
      if (this.#elapsed - this.#phaseStartedAt + DECISION_EPSILON >= this.attackDuration) this.#beginRecovery(commands)
      return
    }
    if (this.#phase === 'recovery' && this.#elapsed - this.#phaseStartedAt + DECISION_EPSILON >= 0.45) {
      if (this.#recoveryReturnsToSelection) {
        this.#recoveryReturnsToSelection = false
        this.#setPhase('select-position')
        this.#selectedPosition = this.#kind === 'moss-wolf'
          ? this.#selectWolfPosition(context)
          : this.#selectMothPosition(context)
        commands.push({ type: 'animate', action: this.#kind === 'moss-wolf' ? 'wolf-prowl' : 'moth-flight' })
        return
      }
      if (this.#kind === 'green-wing-moth') {
        this.#attack = this.#attack === 'dive' ? 'spirit-orb' : 'dive'
        this.#beginTelegraph(context, commands)
      } else {
        this.#setPhase('select-position')
        this.#selectedPosition = this.#selectWolfPosition(context)
        commands.push({ type: 'animate', action: 'wolf-prowl' })
      }
      return
    }
    if (this.#phase === 'hurt' && this.#elapsed - this.#phaseStartedAt >= 0.2) this.#beginRecovery(commands, true)
    if (this.#phase === 'interrupted' && this.#elapsed - this.#phaseStartedAt >= 0.25) {
      this.#beginRecovery(commands, true)
    }
  }

  #emitActiveAttack(commands: EnemyCommand[]): void {
    if (this.#phase !== 'attack') return
    const attackElapsed = this.#elapsed - this.#phaseStartedAt
    if (this.#kind === 'moss-wolf' && !this.#activeHitboxEmitted && attackElapsed >= 0.08) {
      this.#activeHitboxEmitted = true
      commands.push({
        type: 'activate-hitbox',
        attackId: this.#attackId(),
        area: this.#wolfAttackArea(),
        damage: 3,
        duration: 0.12,
      })
      return
    }
    if (this.#kind === 'green-wing-moth' && this.#attack === 'dive' && !this.#activeHitboxEmitted && attackElapsed >= 0.1) {
      this.#activeHitboxEmitted = true
      commands.push({
        type: 'activate-hitbox',
        attackId: this.#attackId(),
        area: this.#mothDiveArea(),
        damage: 3,
        duration: 0.13,
      })
      return
    }
    if (this.#kind === 'green-wing-moth' && this.#attack === 'spirit-orb' && !this.#projectilesEmitted) {
      this.#projectilesEmitted = true
      const target = this.#sampledTarget ?? this.#position
      const direction = target.x < this.#position.x ? -1 : 1
      for (const offset of [-70, 70]) {
        commands.push({
          type: 'spawn-projectile',
          attackId: this.#attackId(),
          origin: { x: this.#position.x, y: target.y + offset },
          velocity: { x: direction * 230, y: 0 },
          radius: 18,
          damage: 3,
          duration: 3,
        })
      }
    }
  }

  #updateVelocity(): void {
    if (this.#phase === 'select-position') {
      this.#velocity = normalizedVelocity(this.#position, this.#selectedPosition, this.#kind === 'moss-wolf' ? 120 : 100)
    } else if (this.#phase === 'attack' && this.#attackDestination) {
      this.#velocity = normalizedVelocity(this.#position, this.#attackDestination, this.#kind === 'moss-wolf' ? 900 : 620)
    } else if (this.#phase === 'recovery' && this.#kind === 'green-wing-moth') {
      this.#velocity = normalizedVelocity(this.#position, this.#selectedPosition, 180)
    } else {
      this.#velocity = { x: 0, y: 0 }
    }
  }

  #integrate(deltaSeconds: number, bounds: BattleRect): void {
    this.#updateVelocity()
    const nextX = this.#position.x + this.#velocity.x * deltaSeconds
    const nextY = this.#position.y + this.#velocity.y * deltaSeconds
    if (this.#phase === 'select-position' && distance(this.#position, this.#selectedPosition) <= Math.hypot(
      this.#velocity.x * deltaSeconds,
      this.#velocity.y * deltaSeconds,
    )) {
      this.#position = { ...this.#selectedPosition }
      return
    }
    if (this.#phase === 'attack' && this.#attackDestination && distance(this.#position, this.#attackDestination) <= Math.hypot(
      this.#velocity.x * deltaSeconds,
      this.#velocity.y * deltaSeconds,
    )) {
      this.#position = { ...this.#attackDestination }
      this.#velocity = { x: 0, y: 0 }
      return
    }
    this.#position.x = clamp(nextX, bounds.minX, bounds.maxX)
    this.#position.y = this.#kind === 'moss-wolf' ? this.#groundY : clamp(nextY, bounds.minY, bounds.maxY)
  }

  #advanceSubstep(context: EnemyContext, deltaSeconds: number, commands: EnemyCommand[]): void {
    this.#elapsed = Math.round((this.#elapsed + deltaSeconds) * 1e12) / 1e12
    while (this.#nextDecisionAt <= this.#elapsed + DECISION_EPSILON) {
      this.#runDecision(context, commands)
      this.#nextDecisionAt = Math.round((this.#nextDecisionAt + DECISION_INTERVAL_SECONDS) * 1e12) / 1e12
    }
    this.#emitActiveAttack(commands)
    this.#integrate(deltaSeconds, context.battleBounds)
  }

  #step(context: EnemyContext, deltaSeconds: number): readonly EnemyCommand[] {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return Object.freeze([])
    validateContext(context)
    const clampedDelta = Math.min(deltaSeconds, MAX_EXTERNAL_DELTA_SECONDS)
    const substeps = Math.max(1, Math.ceil(clampedDelta / MAX_SUBSTEP_SECONDS - DECISION_EPSILON))
    const substepDelta = clampedDelta / substeps
    const commands: EnemyCommand[] = []
    for (let index = 0; index < substeps; index += 1) this.#advanceSubstep(context, substepDelta, commands)
    this.#updateVelocity()
    commands.push({ type: 'move', velocity: this.#velocity })
    const targetX = this.#sampledTarget?.x ?? context.player.position.x
    commands.push({ type: 'face', direction: targetX < this.#position.x ? -1 : 1 })
    return freezeCommands(commands)
  }

  #interrupt(now: number): readonly EnemyCommand[] {
    if (!Number.isFinite(now)) throw new TypeError('now must be finite')
    if (now + DECISION_EPSILON < this.#elapsed || this.#phase === 'death' || this.#phase === 'interrupted') {
      return Object.freeze([])
    }
    this.#setPhase('interrupted')
    this.#velocity = { x: 0, y: 0 }
    this.#sampledTarget = null
    this.#attackDestination = null
    return freezeCommands([
      { type: 'move', velocity: { x: 0, y: 0 } },
      { type: 'animate', action: this.#animationName('interrupted') },
    ])
  }

  #hurt(now: number): readonly EnemyCommand[] {
    if (!Number.isFinite(now)) throw new TypeError('now must be finite')
    if (now + DECISION_EPSILON < this.#elapsed || this.#phase === 'death' || this.#phase === 'hurt') {
      return Object.freeze([])
    }
    this.#setPhase('hurt')
    this.#velocity = { x: 0, y: 0 }
    this.#sampledTarget = null
    this.#attackDestination = null
    return freezeCommands([
      { type: 'move', velocity: { x: 0, y: 0 } },
      { type: 'animate', action: this.#animationName('hurt') },
    ])
  }

  #defeat(now: number): readonly EnemyCommand[] {
    if (!Number.isFinite(now)) throw new TypeError('now must be finite')
    if (this.#phase === 'death') return Object.freeze([])
    this.#setPhase('death')
    this.#velocity = { x: 0, y: 0 }
    this.#sampledTarget = null
    this.#attackDestination = null
    return freezeCommands([
      { type: 'move', velocity: { x: 0, y: 0 } },
      { type: 'animate', action: this.#animationName('death') },
    ])
  }
}

export function createEnemyBrain(
  kind: OrdinaryEnemyKind,
  id: number,
  spawn: Point2,
  seed: number,
): EnemyBrainState {
  if (kind !== 'moss-wolf' && kind !== 'green-wing-moth') throw new TypeError('kind must be moss-wolf or green-wing-moth')
  if (!Number.isSafeInteger(id) || id < 0) throw new TypeError('id must be a non-negative safe integer')
  if (!isFinitePoint(spawn)) throw new TypeError('spawn must contain finite supported coordinates')
  if (!Number.isFinite(seed) || !Number.isInteger(seed) || seed < 0 || seed > MAX_UINT32) {
    throw new TypeError('seed must be a finite uint32 integer')
  }
  return constructBrain(kind, id, spawn, seed)
}

export function stepEnemyBrain(
  state: EnemyBrainState,
  context: EnemyContext,
  deltaSeconds: number,
): readonly EnemyCommand[] {
  return advanceBrain(requireBrain(state), context, deltaSeconds)
}

export function interruptEnemyBrain(state: EnemyBrainState, now: number): readonly EnemyCommand[] {
  return interruptBrain(requireBrain(state), now)
}

export function hurtEnemyBrain(state: EnemyBrainState, now: number): readonly EnemyCommand[] {
  return hurtBrain(requireBrain(state), now)
}

export function defeatEnemyBrain(state: EnemyBrainState, now: number): readonly EnemyCommand[] {
  return defeatBrain(requireBrain(state), now)
}
