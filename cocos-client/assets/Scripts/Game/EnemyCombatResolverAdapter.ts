import type { BattleRect, Point2 } from '../Combat/CombatTypes.ts'
import {
  cancelCombatSourceAttacks,
  createCombatResolver,
  drainDamageEvents,
  openHitbox,
  registerHurtbox,
  removeHurtbox,
  resetCombatResolverGeneration,
  spawnProjectile,
  stepCombatResolver,
  updateHurtbox,
} from '../Combat/CombatResolver.ts'
import type { CombatResolver, CombatResolverSnapshot } from '../Combat/CombatResolver.ts'
import type { EnemyCommand, EnemyDangerDescriptor } from '../Combat/EnemyBrain.ts'

export interface CombatActorUpdate {
  readonly generation: number
  readonly position: Readonly<Point2>
  readonly radius: number
  readonly alive: boolean
}

export interface EnemyCombatActorUpdate extends CombatActorUpdate {
  readonly enemyId: number
}

export interface EnemyTelegraphDelivery {
  readonly enemyId: number
  readonly attackId: string
  readonly telegraphId: string
  readonly area: Readonly<BattleRect>
  readonly duration: number
  readonly visibleAt: number
  readonly activationNotBefore: number
  readonly generation: number
  readonly danger?: Readonly<EnemyDangerDescriptor>
}

export interface EnemyCombatDamage {
  readonly enemyId: number
  readonly sourceId: string
  readonly attackId: string
  readonly attackInstanceId: number
  readonly amount: number
  readonly at: number
  readonly generation: number
  readonly delivery: 'hitbox' | 'projectile'
}

const ADAPTER_TOKEN = Symbol('EnemyCombatResolverAdapter')
const PLAYER_ACTOR_ID = 'player'
const MAX_TELEGRAPHS = 128
const MAX_PENDING_HITBOXES = 128
const MAX_EXTERNAL_DELTA_SECONDS = 0.25
const TIME_EPSILON = 1e-10

interface PendingEnemyHitbox {
  readonly order: number
  readonly sourceId: string
  readonly authorityKey: string
  readonly opensAt: number
  readonly command: Extract<EnemyCommand, { readonly type: 'activate-hitbox' }>
}

let constructAdapter: (generation: number) => EnemyCombatResolverAdapter
let updatePlayer: (adapter: EnemyCombatResolverAdapter, update: CombatActorUpdate) => boolean
let updateEnemy: (adapter: EnemyCombatResolverAdapter, update: EnemyCombatActorUpdate) => boolean
let removeEnemy: (adapter: EnemyCombatResolverAdapter, generation: number, enemyId: number) => boolean
let cancelEnemyAttacks: (adapter: EnemyCombatResolverAdapter, generation: number, enemyId: number) => boolean
let pauseAdapter: (adapter: EnemyCombatResolverAdapter, generation: number, paused: boolean) => boolean
let consumeCommand: (
  adapter: EnemyCombatResolverAdapter,
  generation: number,
  enemyId: number,
  command: EnemyCommand,
) => boolean
let advanceAdapter: (adapter: EnemyCombatResolverAdapter, deltaSeconds: number) => void
let drainAdapterDamage: (adapter: EnemyCombatResolverAdapter) => readonly EnemyCombatDamage[]
let drainAdapterTelegraphs: (adapter: EnemyCombatResolverAdapter) => readonly EnemyTelegraphDelivery[]
let resetAdapter: (adapter: EnemyCombatResolverAdapter, generation: number) => number

function isGeneration(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0
}

function isEnemyId(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function requireActorUpdate(update: CombatActorUpdate): void {
  if (!isGeneration(update?.generation)) throw new TypeError('generation must be a positive safe integer')
  if (!update.position || !Number.isFinite(update.position.x) || !Number.isFinite(update.position.y)) {
    throw new TypeError('position must contain finite coordinates')
  }
  if (!Number.isFinite(update.radius) || update.radius <= 0) throw new TypeError('radius must be finite and positive')
  if (typeof update.alive !== 'boolean') throw new TypeError('alive must be boolean')
}

function actorArea(position: Readonly<Point2>, radius: number): BattleRect {
  return {
    minX: position.x - radius,
    maxX: position.x + radius,
    minY: position.y - radius,
    maxY: position.y + radius,
  }
}

function enemyActorId(enemyId: number): string {
  return `enemy:${enemyId}`
}

function enemyIdFromSource(sourceId: string): number | null {
  if (!sourceId.startsWith('enemy:')) return null
  const enemyId = Number(sourceId.slice('enemy:'.length))
  return isEnemyId(enemyId) ? enemyId : null
}

function telegraphAuthorityKey(sourceId: string, telegraphId: string): string {
  return `${sourceId}\u0000${telegraphId}`
}

function roundTime(value: number): number {
  return Math.round(value * 1e9) / 1e9
}

function freezeArea(area: Readonly<BattleRect>): Readonly<BattleRect> {
  return Object.freeze({ minX: area.minX, maxX: area.maxX, minY: area.minY, maxY: area.maxY })
}

function freezeDanger(danger: Readonly<EnemyDangerDescriptor> | undefined): Readonly<EnemyDangerDescriptor> | undefined {
  if (!danger) return undefined
  if (danger.kind === 'sweep') {
    return Object.freeze({ ...danger, origin: Object.freeze({ ...danger.origin }) })
  }
  if (danger.kind === 'spike') {
    return Object.freeze({ ...danger, center: Object.freeze({ ...danger.center }) })
  }
  return Object.freeze({ ...danger, safeGap: Object.freeze({ ...danger.safeGap }) })
}

function requireAdapter(value: EnemyCombatResolverAdapter): EnemyCombatResolverAdapter {
  if (!(value instanceof EnemyCombatResolverAdapter)) {
    throw new TypeError('adapter must be an EnemyCombatResolverAdapter')
  }
  return value
}

export class EnemyCombatResolverAdapter {
  #resolver: CombatResolver
  #generation: number
  #registeredActors = new Set<string>()
  #telegraphs: EnemyTelegraphDelivery[] = []
  #telegraphActivationTimes = new Map<string, number>()
  #pendingHitboxes: PendingEnemyHitbox[] = []
  #pendingOrder = 0
  #paused = false

  private constructor(token: symbol, generation: number) {
    if (token !== ADAPTER_TOKEN) {
      throw new TypeError('EnemyCombatResolverAdapter must be created by createEnemyCombatResolverAdapter')
    }
    this.#resolver = createCombatResolver()
    this.#generation = generation
    if (generation !== this.#resolver.generation) resetCombatResolverGeneration(this.#resolver, generation)
  }

  static {
    constructAdapter = (generation) => new EnemyCombatResolverAdapter(ADAPTER_TOKEN, generation)
    updatePlayer = (adapter, update) => adapter.#upsertActor(PLAYER_ACTOR_ID, update)
    updateEnemy = (adapter, update) => adapter.#upsertActor(enemyActorId(update.enemyId), update)
    removeEnemy = (adapter, generation, enemyId) => adapter.#removeEnemy(generation, enemyId)
    cancelEnemyAttacks = (adapter, generation, enemyId) => adapter.#cancelEnemyAttacks(generation, enemyId)
    pauseAdapter = (adapter, generation, paused) => adapter.#setPaused(generation, paused)
    consumeCommand = (adapter, generation, enemyId, command) => adapter.#consume(generation, enemyId, command)
    advanceAdapter = (adapter, deltaSeconds) => adapter.#step(deltaSeconds)
    drainAdapterDamage = (adapter) => adapter.#drainDamage()
    drainAdapterTelegraphs = (adapter) => adapter.#drainTelegraphs()
    resetAdapter = (adapter, generation) => adapter.#reset(generation)
  }

  get generation(): number { return this.#generation }

  snapshot(): Readonly<CombatResolverSnapshot> {
    return this.#resolver.snapshot()
  }

  #isCurrent(generation: number): boolean {
    return generation === this.#generation
  }

  #upsertActor(actorId: string, update: CombatActorUpdate): boolean {
    requireActorUpdate(update)
    if (!this.#isCurrent(update.generation)) return false
    const area = actorArea(update.position, update.radius)
    if (this.#registeredActors.has(actorId)) {
      return updateHurtbox(this.#resolver, actorId, { area, alive: update.alive, generation: update.generation })
    }
    const registered = registerHurtbox(this.#resolver, {
      actorId,
      teamId: actorId === PLAYER_ACTOR_ID ? 'player' : 'enemy',
      area,
      alive: update.alive,
      generation: update.generation,
    })
    if (registered) this.#registeredActors.add(actorId)
    return registered
  }

  #removeEnemy(generation: number, enemyId: number): boolean {
    if (!isGeneration(generation)) throw new TypeError('generation must be a positive safe integer')
    if (!isEnemyId(enemyId)) throw new TypeError('enemyId must be a non-negative safe integer')
    if (!this.#isCurrent(generation)) return false
    const actorId = enemyActorId(enemyId)
    this.#registeredActors.delete(actorId)
    this.#discardSourceAuthority(actorId)
    return removeHurtbox(this.#resolver, actorId, generation)
  }

  #cancelEnemyAttacks(generation: number, enemyId: number): boolean {
    if (!isGeneration(generation)) throw new TypeError('generation must be a positive safe integer')
    if (!isEnemyId(enemyId)) throw new TypeError('enemyId must be a non-negative safe integer')
    if (!this.#isCurrent(generation)) return false
    const sourceId = enemyActorId(enemyId)
    if (!this.#registeredActors.has(sourceId)) return false
    const pendingCount = this.#pendingHitboxes.length
    this.#discardSourceAuthority(sourceId)
    return cancelCombatSourceAttacks(this.#resolver, sourceId, generation)
      || this.#pendingHitboxes.length !== pendingCount
  }

  #setPaused(generation: number, paused: boolean): boolean {
    if (!isGeneration(generation)) throw new TypeError('generation must be a positive safe integer')
    if (typeof paused !== 'boolean') throw new TypeError('paused must be boolean')
    if (!this.#isCurrent(generation)) return false
    this.#paused = paused
    if (!paused) return true
    for (const actorId of this.#registeredActors) {
      if (actorId !== PLAYER_ACTOR_ID) cancelCombatSourceAttacks(this.#resolver, actorId, generation)
    }
    drainDamageEvents(this.#resolver)
    this.#telegraphs = []
    this.#telegraphActivationTimes.clear()
    this.#pendingHitboxes = []
    return true
  }

  #discardSourceAuthority(sourceId: string): void {
    const prefix = `${sourceId}\u0000`
    for (const key of this.#telegraphActivationTimes.keys()) {
      if (key.startsWith(prefix)) this.#telegraphActivationTimes.delete(key)
    }
    this.#pendingHitboxes = this.#pendingHitboxes.filter((pending) => pending.sourceId !== sourceId)
  }

  #openHitbox(sourceId: string, command: Extract<EnemyCommand, { readonly type: 'activate-hitbox' }>): boolean {
    return openHitbox(this.#resolver, {
      sourceId,
      attackId: command.attackId,
      area: command.area,
      damage: command.damage,
      duration: command.duration,
      generation: this.#generation,
    }) !== null
  }

  #consume(generation: number, enemyId: number, command: EnemyCommand): boolean {
    if (!isGeneration(generation)) throw new TypeError('generation must be a positive safe integer')
    if (!isEnemyId(enemyId)) throw new TypeError('enemyId must be a non-negative safe integer')
    if (!this.#isCurrent(generation)) return false
    const sourceId = enemyActorId(enemyId)
    if (this.#paused || !this.#registeredActors.has(sourceId)) return false
    switch (command.type) {
      case 'show-telegraph':
        if (this.#telegraphs.length >= MAX_TELEGRAPHS) throw new RangeError('telegraph capacity exceeded')
        const visibleAt = roundTime(this.#resolver.snapshot().elapsed)
        const activationNotBefore = roundTime(visibleAt + command.duration)
        const telegraphId = command.telegraphId ?? command.attackId
        const authorityKey = telegraphAuthorityKey(sourceId, telegraphId)
        this.#telegraphActivationTimes.set(
          authorityKey,
          Math.max(this.#telegraphActivationTimes.get(authorityKey) ?? 0, activationNotBefore),
        )
        this.#telegraphs.push({
          enemyId,
          attackId: command.attackId,
          telegraphId,
          area: freezeArea(command.area),
          duration: command.duration,
          visibleAt,
          activationNotBefore,
          generation,
          ...(command.danger ? { danger: freezeDanger(command.danger) } : {}),
        })
        return true
      case 'activate-hitbox': {
        const authorityKey = telegraphAuthorityKey(sourceId, command.telegraphId ?? command.attackId)
        const activationNotBefore = this.#telegraphActivationTimes.get(authorityKey)
        const now = this.#resolver.snapshot().elapsed
        if (activationNotBefore !== undefined && activationNotBefore > now + TIME_EPSILON) {
          if (this.#pendingHitboxes.length >= MAX_PENDING_HITBOXES) {
            throw new RangeError('pending hitbox capacity exceeded')
          }
          this.#pendingHitboxes.push(Object.freeze({
            order: this.#pendingOrder++,
            sourceId,
            authorityKey,
            opensAt: activationNotBefore,
            command,
          }))
          this.#pendingHitboxes.sort((left, right) => left.opensAt - right.opensAt || left.order - right.order)
          return true
        }
        this.#telegraphActivationTimes.delete(authorityKey)
        return this.#openHitbox(sourceId, command)
      }
      case 'spawn-projectile':
        return spawnProjectile(this.#resolver, {
          sourceId,
          attackId: command.attackId,
          origin: command.origin,
          velocity: command.velocity,
          radius: command.radius,
          damage: command.damage,
          duration: command.duration,
          generation,
        }) !== null
      case 'move':
      case 'face':
      case 'animate':
        return false
    }
  }

  #step(deltaSeconds: number): void {
    if (this.#paused) return
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
      stepCombatResolver(this.#resolver, deltaSeconds)
      return
    }
    const target = roundTime(this.#resolver.snapshot().elapsed + Math.min(deltaSeconds, MAX_EXTERNAL_DELTA_SECONDS))
    while (this.#pendingHitboxes.length > 0 && this.#pendingHitboxes[0].opensAt <= target + TIME_EPSILON) {
      const opensAt = Math.max(this.#resolver.snapshot().elapsed, this.#pendingHitboxes[0].opensAt)
      const advance = opensAt - this.#resolver.snapshot().elapsed
      if (advance > TIME_EPSILON) stepCombatResolver(this.#resolver, advance)
      const due: PendingEnemyHitbox[] = []
      while (this.#pendingHitboxes.length > 0 && this.#pendingHitboxes[0].opensAt <= opensAt + TIME_EPSILON) {
        due.push(this.#pendingHitboxes.shift() as PendingEnemyHitbox)
      }
      for (const pending of due) {
        if (this.#registeredActors.has(pending.sourceId)) this.#openHitbox(pending.sourceId, pending.command)
        this.#telegraphActivationTimes.delete(pending.authorityKey)
      }
    }
    const remaining = target - this.#resolver.snapshot().elapsed
    if (remaining > TIME_EPSILON) stepCombatResolver(this.#resolver, remaining)
  }

  #drainDamage(): readonly EnemyCombatDamage[] {
    const damage: EnemyCombatDamage[] = []
    for (const event of drainDamageEvents(this.#resolver)) {
      if (event.targetId !== PLAYER_ACTOR_ID) continue
      const enemyId = enemyIdFromSource(event.sourceId)
      if (enemyId === null) continue
      damage.push(Object.freeze({
        enemyId,
        sourceId: event.sourceId,
        attackId: event.attackId,
        attackInstanceId: event.attackInstanceId,
        amount: event.amount,
        at: event.at,
        generation: event.generation,
        delivery: event.delivery,
      }))
    }
    return Object.freeze(damage)
  }

  #drainTelegraphs(): readonly EnemyTelegraphDelivery[] {
    const queued = this.#telegraphs
    this.#telegraphs = []
    return Object.freeze(queued.map((event) => Object.freeze({
      ...event,
      area: freezeArea(event.area),
      ...(event.danger ? { danger: freezeDanger(event.danger) } : {}),
    })))
  }

  #reset(generation: number): number {
    if (!isGeneration(generation) || generation < this.#generation) {
      throw new TypeError('generation must be a positive safe integer no lower than current generation')
    }
    if (generation === this.#generation) return this.#generation
    this.#generation = resetCombatResolverGeneration(this.#resolver, generation)
    this.#registeredActors.clear()
    this.#telegraphs = []
    this.#telegraphActivationTimes.clear()
    this.#pendingHitboxes = []
    this.#pendingOrder = 0
    this.#paused = false
    return this.#generation
  }
}

export function createEnemyCombatResolverAdapter(generation: number): EnemyCombatResolverAdapter {
  if (!isGeneration(generation)) throw new TypeError('generation must be a positive safe integer')
  return constructAdapter(generation)
}

export function upsertPlayerCombatActor(
  adapter: EnemyCombatResolverAdapter,
  update: CombatActorUpdate,
): boolean {
  return updatePlayer(requireAdapter(adapter), update)
}

export function upsertEnemyCombatActor(
  adapter: EnemyCombatResolverAdapter,
  update: EnemyCombatActorUpdate,
): boolean {
  if (!isEnemyId(update?.enemyId)) throw new TypeError('enemyId must be a non-negative safe integer')
  return updateEnemy(requireAdapter(adapter), update)
}

export function removeEnemyCombatActor(
  adapter: EnemyCombatResolverAdapter,
  generation: number,
  enemyId: number,
): boolean {
  return removeEnemy(requireAdapter(adapter), generation, enemyId)
}

export function cancelEnemyCombatActorAttacks(
  adapter: EnemyCombatResolverAdapter,
  generation: number,
  enemyId: number,
): boolean {
  return cancelEnemyAttacks(requireAdapter(adapter), generation, enemyId)
}

export function pauseEnemyCombatResolverAdapter(
  adapter: EnemyCombatResolverAdapter,
  generation: number,
  paused: boolean,
): boolean {
  return pauseAdapter(requireAdapter(adapter), generation, paused)
}

export function consumeEnemyCombatCommand(
  adapter: EnemyCombatResolverAdapter,
  generation: number,
  enemyId: number,
  command: EnemyCommand,
): boolean {
  return consumeCommand(requireAdapter(adapter), generation, enemyId, command)
}

export function stepEnemyCombatResolverAdapter(
  adapter: EnemyCombatResolverAdapter,
  deltaSeconds: number,
): void {
  advanceAdapter(requireAdapter(adapter), deltaSeconds)
}

export function drainEnemyCombatDamage(
  adapter: EnemyCombatResolverAdapter,
): readonly EnemyCombatDamage[] {
  return drainAdapterDamage(requireAdapter(adapter))
}

export function drainEnemyTelegraphs(
  adapter: EnemyCombatResolverAdapter,
): readonly EnemyTelegraphDelivery[] {
  return drainAdapterTelegraphs(requireAdapter(adapter))
}

export function resetEnemyCombatResolverAdapter(
  adapter: EnemyCombatResolverAdapter,
  generation: number,
): number {
  return resetAdapter(requireAdapter(adapter), generation)
}

export function enemyCombatAdapterSnapshot(
  adapter: EnemyCombatResolverAdapter,
): Readonly<CombatResolverSnapshot> {
  return requireAdapter(adapter).snapshot()
}
