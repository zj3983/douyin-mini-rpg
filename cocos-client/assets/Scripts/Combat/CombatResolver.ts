import type { BattleRect, Point2 } from './CombatTypes.ts'

export interface CombatResolverOptions {
  readonly maxHurtboxes?: number
  readonly maxHitboxes?: number
  readonly maxProjectiles?: number
  readonly maxDamageEvents?: number
  readonly maxHitRecords?: number
}

export interface HurtboxRegistration {
  readonly actorId: string
  readonly teamId?: string
  readonly area: Readonly<BattleRect>
  readonly alive?: boolean
  readonly generation: number
}

export interface HurtboxUpdate {
  readonly area?: Readonly<BattleRect>
  readonly alive?: boolean
  readonly generation: number
}

export interface HitboxRegistration {
  readonly sourceId: string
  readonly attackId: string
  readonly area: Readonly<BattleRect>
  readonly damage: number
  readonly duration: number
  readonly generation: number
}

export interface ProjectileRegistration {
  readonly sourceId: string
  readonly attackId: string
  readonly origin: Readonly<Point2>
  readonly velocity: Readonly<Point2>
  readonly radius: number
  readonly damage: number
  readonly duration: number
  readonly generation: number
}

export interface DamageEvent {
  readonly type: 'damage'
  readonly sourceId: string
  readonly targetId: string
  readonly attackId: string
  readonly attackInstanceId: number
  readonly amount: number
  readonly at: number
  readonly generation: number
  readonly delivery: 'hitbox' | 'projectile'
}

export interface CombatResolverSnapshot {
  readonly generation: number
  readonly elapsed: number
  readonly hurtboxCount: number
  readonly hitboxCount: number
  readonly projectileCount: number
  readonly queuedDamageCount: number
  readonly hitRecordCount: number
}

interface MutableHurtbox {
  actorId: string
  teamId: string | null
  area: BattleRect
  alive: boolean
  generation: number
}

interface MutableAttack {
  instanceId: number
  sourceId: string
  attackId: string
  damage: number
  expiresAt: number
  generation: number
  hitTargets: Set<string>
}

interface MutableHitbox extends MutableAttack {
  area: BattleRect
  openedAt: number
}

interface MutableProjectile extends MutableAttack {
  position: Point2
  velocity: Point2
  radius: number
}

interface ResolverCapacities {
  maxHurtboxes: number
  maxHitboxes: number
  maxProjectiles: number
  maxDamageEvents: number
  maxHitRecords: number
}

const RESOLVER_TOKEN = Symbol('CombatResolver')
const MAX_EXTERNAL_DELTA_SECONDS = 0.25
const MAX_SUBSTEP_SECONDS = 1 / 60
const STEP_EPSILON = 1e-12
const COORDINATE_LIMIT = 10_000_000
const DEFAULT_CAPACITIES: Readonly<ResolverCapacities> = Object.freeze({
  maxHurtboxes: 64,
  maxHitboxes: 64,
  maxProjectiles: 128,
  maxDamageEvents: 256,
  maxHitRecords: 4096,
})

let constructResolver: (capacities: ResolverCapacities) => CombatResolver
let addHurtbox: (resolver: CombatResolver, registration: HurtboxRegistration) => boolean
let changeHurtbox: (resolver: CombatResolver, actorId: string, update: HurtboxUpdate) => boolean
let deleteHurtbox: (resolver: CombatResolver, actorId: string, generation: number) => boolean
let cancelAttacks: (resolver: CombatResolver, sourceId: string, generation: number) => boolean
let addHitbox: (resolver: CombatResolver, registration: HitboxRegistration) => number | null
let deleteHitbox: (resolver: CombatResolver, instanceId: number, generation: number) => boolean
let addProjectile: (resolver: CombatResolver, registration: ProjectileRegistration) => number | null
let advanceResolver: (resolver: CombatResolver, deltaSeconds: number) => void
let drainResolver: (resolver: CombatResolver) => readonly DamageEvent[]
let resetResolver: (resolver: CombatResolver, generation?: number) => number

function isSafePositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0
}

function isGeneration(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0
}

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= COORDINATE_LIMIT
}

function isFinitePoint(value: unknown): value is Point2 {
  if (value === null || typeof value !== 'object') return false
  const point = value as Point2
  return isFiniteCoordinate(point.x) && isFiniteCoordinate(point.y)
}

function isFiniteArea(value: unknown): value is BattleRect {
  if (value === null || typeof value !== 'object') return false
  const area = value as BattleRect
  return isFiniteCoordinate(area.minX)
    && isFiniteCoordinate(area.maxX)
    && isFiniteCoordinate(area.minY)
    && isFiniteCoordinate(area.maxY)
    && area.minX <= area.maxX
    && area.minY <= area.maxY
}

function requireArea(value: unknown): asserts value is BattleRect {
  if (!isFiniteArea(value)) throw new TypeError('area must contain finite ordered coordinates')
}

function requireIdentifier(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 256) {
    throw new TypeError(`${label} must be a non-empty bounded string`)
  }
}

function requireDamage(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new TypeError('damage must be finite and positive')
  }
}

function requireDuration(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new TypeError('duration must be finite and positive')
  }
}

function cloneArea(area: BattleRect): BattleRect {
  return { minX: area.minX, maxX: area.maxX, minY: area.minY, maxY: area.maxY }
}

function overlap(a: BattleRect, b: BattleRect): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY
}

function segmentEntryTime(from: Point2, to: Point2, area: BattleRect, radius: number): number | null {
  const expanded = {
    minX: area.minX - radius,
    maxX: area.maxX + radius,
    minY: area.minY - radius,
    maxY: area.maxY + radius,
  }
  const dx = to.x - from.x
  const dy = to.y - from.y
  let entry = 0
  let exit = 1
  for (const [origin, delta, min, max] of [
    [from.x, dx, expanded.minX, expanded.maxX],
    [from.y, dy, expanded.minY, expanded.maxY],
  ] as const) {
    if (Math.abs(delta) <= STEP_EPSILON) {
      if (origin < min || origin > max) return null
      continue
    }
    const first = (min - origin) / delta
    const second = (max - origin) / delta
    const near = Math.min(first, second)
    const far = Math.max(first, second)
    entry = Math.max(entry, near)
    exit = Math.min(exit, far)
    if (entry > exit) return null
  }
  return entry >= 0 && entry <= 1 ? entry : null
}

function freezeDamageEvent(event: DamageEvent): DamageEvent {
  return Object.freeze({ ...event })
}

function requireResolver(value: CombatResolver): CombatResolver {
  if (!(value instanceof CombatResolver)) throw new TypeError('resolver must be a CombatResolver')
  return value
}

export class CombatResolver {
  #generation = 1
  #elapsed = 0
  #hurtboxes = new Map<string, MutableHurtbox>()
  #hitboxes = new Map<number, MutableHitbox>()
  #projectiles = new Map<number, MutableProjectile>()
  #inactiveSources = new Set<string>()
  #damageEvents: DamageEvent[] = []
  #hitRecordCount = 0
  #nextAttackInstanceId = 1
  #capacities: ResolverCapacities

  private constructor(token: symbol, capacities: ResolverCapacities) {
    if (token !== RESOLVER_TOKEN) throw new TypeError('CombatResolver must be created by createCombatResolver')
    this.#capacities = capacities
  }

  static {
    constructResolver = (capacities) => new CombatResolver(RESOLVER_TOKEN, capacities)
    addHurtbox = (resolver, registration) => resolver.#registerHurtbox(registration)
    changeHurtbox = (resolver, actorId, update) => resolver.#updateHurtbox(actorId, update)
    deleteHurtbox = (resolver, actorId, generation) => resolver.#removeHurtbox(actorId, generation)
    cancelAttacks = (resolver, sourceId, generation) => resolver.#cancelRegisteredSourceAttacks(sourceId, generation)
    addHitbox = (resolver, registration) => resolver.#openHitbox(registration)
    deleteHitbox = (resolver, instanceId, generation) => resolver.#closeHitbox(instanceId, generation)
    addProjectile = (resolver, registration) => resolver.#spawnProjectile(registration)
    advanceResolver = (resolver, deltaSeconds) => resolver.#step(deltaSeconds)
    drainResolver = (resolver) => resolver.#drainDamageEvents()
    resetResolver = (resolver, generation) => resolver.#resetGeneration(generation)
  }

  get generation(): number { return this.#generation }
  get elapsed(): number { return this.#elapsed }

  snapshot(): Readonly<CombatResolverSnapshot> {
    return Object.freeze({
      generation: this.#generation,
      elapsed: this.#elapsed,
      hurtboxCount: this.#hurtboxes.size,
      hitboxCount: this.#hitboxes.size,
      projectileCount: this.#projectiles.size,
      queuedDamageCount: this.#damageEvents.length,
      hitRecordCount: this.#hitRecordCount,
    })
  }

  #isCurrent(generation: number): boolean {
    return generation === this.#generation
  }

  #registerHurtbox(registration: HurtboxRegistration): boolean {
    if (!isGeneration(registration?.generation)) throw new TypeError('generation must be a positive safe integer')
    if (!this.#isCurrent(registration.generation)) return false
    requireIdentifier(registration.actorId, 'actorId')
    if (registration.teamId !== undefined) requireIdentifier(registration.teamId, 'teamId')
    requireArea(registration.area)
    if (registration.alive !== undefined && typeof registration.alive !== 'boolean') {
      throw new TypeError('alive must be boolean')
    }
    if (this.#hurtboxes.has(registration.actorId)) throw new Error('hurtbox is already registered')
    if (this.#hurtboxes.size >= this.#capacities.maxHurtboxes) throw new RangeError('hurtbox capacity exceeded')
    this.#hurtboxes.set(registration.actorId, {
      actorId: registration.actorId,
      teamId: registration.teamId ?? null,
      area: cloneArea(registration.area),
      alive: registration.alive ?? true,
      generation: registration.generation,
    })
    if (registration.alive ?? true) this.#inactiveSources.delete(registration.actorId)
    else this.#inactiveSources.add(registration.actorId)
    return true
  }

  #updateHurtbox(actorId: string, update: HurtboxUpdate): boolean {
    if (!isGeneration(update?.generation)) throw new TypeError('generation must be a positive safe integer')
    if (!this.#isCurrent(update.generation)) return false
    requireIdentifier(actorId, 'actorId')
    const hurtbox = this.#hurtboxes.get(actorId)
    if (!hurtbox || hurtbox.generation !== this.#generation) return false
    if (update.area !== undefined) {
      requireArea(update.area)
      hurtbox.area = cloneArea(update.area)
    }
    if (update.alive !== undefined) {
      if (typeof update.alive !== 'boolean') throw new TypeError('alive must be boolean')
      hurtbox.alive = update.alive
      if (update.alive) this.#inactiveSources.delete(actorId)
      else {
        this.#inactiveSources.add(actorId)
        this.#cancelSourceAttacks(actorId)
      }
    }
    return true
  }

  #removeHurtbox(actorId: string, generation: number): boolean {
    if (!isGeneration(generation)) throw new TypeError('generation must be a positive safe integer')
    if (!this.#isCurrent(generation)) return false
    requireIdentifier(actorId, 'actorId')
    const removed = this.#hurtboxes.delete(actorId)
    this.#inactiveSources.add(actorId)
    this.#cancelSourceAttacks(actorId)
    return removed
  }

  #openHitbox(registration: HitboxRegistration): number | null {
    if (!isGeneration(registration?.generation)) throw new TypeError('generation must be a positive safe integer')
    if (!this.#isCurrent(registration.generation)) return null
    requireIdentifier(registration.sourceId, 'sourceId')
    requireIdentifier(registration.attackId, 'attackId')
    requireArea(registration.area)
    requireDamage(registration.damage)
    requireDuration(registration.duration)
    if (this.#inactiveSources.has(registration.sourceId)) return null
    if (this.#hitboxes.size >= this.#capacities.maxHitboxes) throw new RangeError('hitbox capacity exceeded')
    const instanceId = this.#nextAttackInstanceId
    this.#nextAttackInstanceId += 1
    this.#hitboxes.set(instanceId, {
      instanceId,
      sourceId: registration.sourceId,
      attackId: registration.attackId,
      area: cloneArea(registration.area),
      damage: registration.damage,
      openedAt: this.#elapsed,
      expiresAt: this.#elapsed + registration.duration,
      generation: registration.generation,
      hitTargets: new Set(),
    })
    return instanceId
  }

  #closeHitbox(instanceId: number, generation: number): boolean {
    if (!isGeneration(generation)) throw new TypeError('generation must be a positive safe integer')
    if (!this.#isCurrent(generation)) return false
    if (!Number.isSafeInteger(instanceId) || instanceId <= 0) return false
    const hitbox = this.#hitboxes.get(instanceId)
    if (!hitbox) return false
    this.#hitRecordCount -= hitbox.hitTargets.size
    this.#hitboxes.delete(instanceId)
    return true
  }

  #spawnProjectile(registration: ProjectileRegistration): number | null {
    if (!isGeneration(registration?.generation)) throw new TypeError('generation must be a positive safe integer')
    if (!this.#isCurrent(registration.generation)) return null
    requireIdentifier(registration.sourceId, 'sourceId')
    requireIdentifier(registration.attackId, 'attackId')
    if (!isFinitePoint(registration.origin)) throw new TypeError('origin must contain finite supported coordinates')
    if (!isFinitePoint(registration.velocity)) throw new TypeError('velocity must contain finite supported coordinates')
    if (!Number.isFinite(registration.radius) || registration.radius < 0) throw new TypeError('radius must be finite and non-negative')
    requireDamage(registration.damage)
    requireDuration(registration.duration)
    if (this.#inactiveSources.has(registration.sourceId)) return null
    if (this.#projectiles.size >= this.#capacities.maxProjectiles) throw new RangeError('projectile capacity exceeded')
    const instanceId = this.#nextAttackInstanceId
    this.#nextAttackInstanceId += 1
    this.#projectiles.set(instanceId, {
      instanceId,
      sourceId: registration.sourceId,
      attackId: registration.attackId,
      position: { ...registration.origin },
      velocity: { ...registration.velocity },
      radius: registration.radius,
      damage: registration.damage,
      expiresAt: this.#elapsed + registration.duration,
      generation: registration.generation,
      hitTargets: new Set(),
    })
    return instanceId
  }

  #recordDamage(attack: MutableAttack, targetId: string, at: number, delivery: 'hitbox' | 'projectile'): void {
    if (attack.hitTargets.has(targetId)) return
    if (this.#damageEvents.length >= this.#capacities.maxDamageEvents) {
      throw new RangeError('damage event capacity exceeded')
    }
    if (this.#hitRecordCount >= this.#capacities.maxHitRecords) throw new RangeError('hit record capacity exceeded')
    attack.hitTargets.add(targetId)
    this.#hitRecordCount += 1
    this.#damageEvents.push({
      type: 'damage',
      sourceId: attack.sourceId,
      targetId,
      attackId: attack.attackId,
      attackInstanceId: attack.instanceId,
      amount: attack.damage,
      at: Math.round(at * 1e12) / 1e12,
      generation: this.#generation,
      delivery,
    })
  }

  #cancelSourceAttacks(sourceId: string): void {
    for (const [id, hitbox] of this.#hitboxes) {
      if (hitbox.sourceId !== sourceId) continue
      this.#hitRecordCount -= hitbox.hitTargets.size
      this.#hitboxes.delete(id)
    }
    for (const [id, projectile] of this.#projectiles) {
      if (projectile.sourceId !== sourceId) continue
      this.#hitRecordCount -= projectile.hitTargets.size
      this.#projectiles.delete(id)
    }
  }

  #cancelRegisteredSourceAttacks(sourceId: string, generation: number): boolean {
    if (!isGeneration(generation)) throw new TypeError('generation must be a positive safe integer')
    if (!this.#isCurrent(generation)) return false
    requireIdentifier(sourceId, 'sourceId')
    const source = this.#hurtboxes.get(sourceId)
    if (!source || source.generation !== this.#generation || !source.alive) return false
    this.#cancelSourceAttacks(sourceId)
    return true
  }

  #resolveHitboxes(substepStart: number): void {
    const hurtboxes = [...this.#hurtboxes.values()]
      .filter((hurtbox) => hurtbox.alive && hurtbox.generation === this.#generation)
      .sort((a, b) => a.actorId.localeCompare(b.actorId))
    for (const hitbox of this.#hitboxes.values()) {
      if (
        hitbox.generation !== this.#generation
        || hitbox.expiresAt <= substepStart + STEP_EPSILON
        || this.#inactiveSources.has(hitbox.sourceId)
      ) continue
      const sourceTeam = this.#hurtboxes.get(hitbox.sourceId)?.teamId ?? null
      for (const hurtbox of hurtboxes) {
        if (
          hurtbox.actorId === hitbox.sourceId
          || (sourceTeam !== null && hurtbox.teamId === sourceTeam)
          || !overlap(hitbox.area, hurtbox.area)
        ) continue
        this.#recordDamage(hitbox, hurtbox.actorId, Math.max(substepStart, hitbox.openedAt), 'hitbox')
      }
    }
  }

  #resolveProjectiles(substepStart: number, deltaSeconds: number): void {
    const hurtboxes = [...this.#hurtboxes.values()]
      .filter((hurtbox) => hurtbox.alive && hurtbox.generation === this.#generation)
    for (const projectile of this.#projectiles.values()) {
      if (
        projectile.generation !== this.#generation
        || projectile.expiresAt <= substepStart + STEP_EPSILON
        || this.#inactiveSources.has(projectile.sourceId)
      ) continue
      const from = { ...projectile.position }
      const activeDelta = Math.min(deltaSeconds, projectile.expiresAt - substepStart)
      const to = {
        x: from.x + projectile.velocity.x * activeDelta,
        y: from.y + projectile.velocity.y * activeDelta,
      }
      const collisions: Array<{ targetId: string; entry: number }> = []
      const sourceTeam = this.#hurtboxes.get(projectile.sourceId)?.teamId ?? null
      for (const hurtbox of hurtboxes) {
        if (
          hurtbox.actorId === projectile.sourceId
          || (sourceTeam !== null && hurtbox.teamId === sourceTeam)
          || projectile.hitTargets.has(hurtbox.actorId)
        ) continue
        const entry = segmentEntryTime(from, to, hurtbox.area, projectile.radius)
        if (entry !== null) collisions.push({ targetId: hurtbox.actorId, entry })
      }
      collisions.sort((a, b) => a.entry - b.entry || a.targetId.localeCompare(b.targetId))
      for (const collision of collisions) {
        this.#recordDamage(
          projectile,
          collision.targetId,
          substepStart + collision.entry * activeDelta,
          'projectile',
        )
      }
      projectile.position = to
    }
  }

  #purgeExpired(): void {
    for (const [id, hitbox] of this.#hitboxes) {
      if (hitbox.expiresAt <= this.#elapsed + STEP_EPSILON) {
        this.#hitRecordCount -= hitbox.hitTargets.size
        this.#hitboxes.delete(id)
      }
    }
    for (const [id, projectile] of this.#projectiles) {
      if (projectile.expiresAt <= this.#elapsed + STEP_EPSILON) {
        this.#hitRecordCount -= projectile.hitTargets.size
        this.#projectiles.delete(id)
      }
    }
  }

  #step(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return
    const clampedDelta = Math.min(deltaSeconds, MAX_EXTERNAL_DELTA_SECONDS)
    const substeps = Math.max(1, Math.ceil(clampedDelta / MAX_SUBSTEP_SECONDS - STEP_EPSILON))
    const substepDelta = clampedDelta / substeps
    for (let index = 0; index < substeps; index += 1) {
      const substepStart = this.#elapsed
      this.#resolveHitboxes(substepStart)
      this.#resolveProjectiles(substepStart, substepDelta)
      this.#elapsed = Math.round((this.#elapsed + substepDelta) * 1e12) / 1e12
      this.#purgeExpired()
    }
  }

  #drainDamageEvents(): readonly DamageEvent[] {
    const events = this.#damageEvents
    this.#damageEvents = []
    return Object.freeze(events.map(freezeDamageEvent))
  }

  #resetGeneration(generation?: number): number {
    const next = generation ?? this.#generation + 1
    if (!isGeneration(next) || next < this.#generation) {
      throw new TypeError('generation must be a positive safe integer no lower than current generation')
    }
    if (next === this.#generation) return this.#generation
    this.#generation = next
    this.#elapsed = 0
    this.#hurtboxes.clear()
    this.#hitboxes.clear()
    this.#projectiles.clear()
    this.#inactiveSources.clear()
    this.#damageEvents = []
    this.#hitRecordCount = 0
    this.#nextAttackInstanceId = 1
    return this.#generation
  }
}

export function createCombatResolver(options: CombatResolverOptions = {}): CombatResolver {
  const capacities: ResolverCapacities = {
    maxHurtboxes: options.maxHurtboxes ?? DEFAULT_CAPACITIES.maxHurtboxes,
    maxHitboxes: options.maxHitboxes ?? DEFAULT_CAPACITIES.maxHitboxes,
    maxProjectiles: options.maxProjectiles ?? DEFAULT_CAPACITIES.maxProjectiles,
    maxDamageEvents: options.maxDamageEvents ?? DEFAULT_CAPACITIES.maxDamageEvents,
    maxHitRecords: options.maxHitRecords ?? DEFAULT_CAPACITIES.maxHitRecords,
  }
  for (const [name, value] of Object.entries(capacities)) {
    if (!isSafePositiveInteger(value)) throw new TypeError(`${name} must be a positive safe integer`)
  }
  return constructResolver(capacities)
}

export function registerHurtbox(resolver: CombatResolver, registration: HurtboxRegistration): boolean {
  return addHurtbox(requireResolver(resolver), registration)
}

export function updateHurtbox(resolver: CombatResolver, actorId: string, update: HurtboxUpdate): boolean {
  return changeHurtbox(requireResolver(resolver), actorId, update)
}

export function removeHurtbox(resolver: CombatResolver, actorId: string, generation = resolver.generation): boolean {
  return deleteHurtbox(requireResolver(resolver), actorId, generation)
}

export function cancelCombatSourceAttacks(
  resolver: CombatResolver,
  sourceId: string,
  generation = resolver.generation,
): boolean {
  return cancelAttacks(requireResolver(resolver), sourceId, generation)
}

export function openHitbox(resolver: CombatResolver, registration: HitboxRegistration): number | null {
  return addHitbox(requireResolver(resolver), registration)
}

export function closeHitbox(resolver: CombatResolver, attackInstanceId: number, generation = resolver.generation): boolean {
  return deleteHitbox(requireResolver(resolver), attackInstanceId, generation)
}

export function spawnProjectile(resolver: CombatResolver, registration: ProjectileRegistration): number | null {
  return addProjectile(requireResolver(resolver), registration)
}

export function stepCombatResolver(resolver: CombatResolver, deltaSeconds: number): void {
  advanceResolver(requireResolver(resolver), deltaSeconds)
}

export function drainDamageEvents(resolver: CombatResolver): readonly DamageEvent[] {
  return drainResolver(requireResolver(resolver))
}

export function resetCombatResolverGeneration(resolver: CombatResolver, generation?: number): number {
  return resetResolver(requireResolver(resolver), generation)
}
