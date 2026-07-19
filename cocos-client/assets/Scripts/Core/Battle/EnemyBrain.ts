import { clampVecToBounds, vecAdd, vecDistance, vecNormalize, vecScale, vecSub } from './Geometry.ts'
import type { BattleBounds, Vec2 } from './Geometry.ts'
import type { SeededRandom } from './Random.ts'

export type EnemyKind = 'wolf' | 'moth'
export type EnemyStateName = 'spawn' | 'select-position' | 'telegraph' | 'attack' | 'recovery' | 'hurt' | 'death'

export interface WolfBehavior {
  kind: 'wolf'
  maxHp: number
  radius: number
  moveSpeed: number
  flankOffsetY: number
  postOffsetX: number
  pounceRange: number
  telegraphSeconds: number
  pounceSpeed: number
  pounceSeconds: number
  recoverySeconds: number
  whiffRecoverySeconds: number
  touchDamage: number
  decisionHz: number
  spawnSeconds: number
}

export interface MothBehavior {
  kind: 'moth'
  maxHp: number
  radius: number
  moveSpeed: number
  altitudeMin: number
  altitudeMax: number
  postOffsetX: number
  attackRange: number
  minSeparation: number
  telegraphSeconds: number
  diveSpeed: number
  diveSeconds: number
  projectileSpeed: number
  projectileRadius: number
  projectileDamage: number
  touchDamage: number
  recoverySeconds: number
  decisionHz: number
  spawnSeconds: number
}

export type EnemyBehavior = WolfBehavior | MothBehavior

export interface EnemyEntity {
  id: number
  kind: EnemyKind
  behavior: EnemyBehavior
  position: Vec2
  hp: number
  maxHp: number
  radius: number
  alive: boolean
  state: EnemyStateName
  stateElapsed: number
  post: Vec2
  attackDirection: Vec2
  attackDidHit: boolean
  recoveryDuration: number
  nextMothAttack: 'dive' | 'bolt'
  decisionRemaining: number
  deathElapsed: number
}

export type EnemyEvent =
  | { type: 'enemy-state'; enemyId: number; state: EnemyStateName }
  | { type: 'pounce-start'; enemyId: number; from: Vec2; direction: Vec2 }
  | { type: 'dive-start'; enemyId: number; from: Vec2; direction: Vec2 }
  | { type: 'moth-bolt'; enemyId: number; from: Vec2; direction: Vec2; speed: number; radius: number; damage: number }

export interface EnemyTickContext {
  playerPosition: Vec2
  playerAlive: boolean
  enemies: readonly EnemyEntity[]
  bounds: BattleBounds
  random: SeededRandom
  deltaTime: number
}

export const HURT_SECONDS = 0.25

export function createEnemy(id: number, behavior: EnemyBehavior, spawn: Vec2, random: SeededRandom): EnemyEntity {
  return {
    id,
    kind: behavior.kind,
    behavior,
    position: { ...spawn },
    hp: behavior.maxHp,
    maxHp: behavior.maxHp,
    radius: behavior.radius,
    alive: true,
    state: 'spawn',
    stateElapsed: 0,
    post: { ...spawn },
    attackDirection: { x: -1, y: 0 },
    attackDidHit: false,
    recoveryDuration: behavior.recoverySeconds,
    nextMothAttack: 'bolt',
    decisionRemaining: random.range(0, 1 / behavior.decisionHz),
    deathElapsed: 0,
  }
}

function enterState(enemy: EnemyEntity, state: EnemyStateName, events: EnemyEvent[]) {
  enemy.state = state
  enemy.stateElapsed = 0
  events.push({ type: 'enemy-state', enemyId: enemy.id, state })
}

function moveToward(enemy: EnemyEntity, target: Vec2, speed: number, deltaTime: number) {
  const offset = vecSub(target, enemy.position)
  const distance = Math.hypot(offset.x, offset.y)
  if (distance === 0) return
  const step = Math.min(distance, speed * deltaTime)
  enemy.position = vecAdd(enemy.position, vecScale(offset, step / distance))
}

function choosePost(enemy: EnemyEntity, ctx: EnemyTickContext) {
  const behavior = enemy.behavior
  const side = ctx.random.pick([-1, 1] as const)
  if (behavior.kind === 'wolf') {
    enemy.post = clampVecToBounds({
      x: ctx.playerPosition.x + side * behavior.postOffsetX,
      y: ctx.playerPosition.y + ctx.random.pick([-1, 1] as const) * behavior.flankOffsetY,
    }, ctx.bounds)
    return
  }
  let post = clampVecToBounds({
    x: ctx.playerPosition.x + side * behavior.postOffsetX,
    y: ctx.random.range(behavior.altitudeMin, behavior.altitudeMax),
  }, ctx.bounds)
  for (const other of ctx.enemies) {
    if (other.id === enemy.id || !other.alive || other.kind !== 'moth') continue
    const gap = vecDistance(post, other.position)
    if (gap > 0 && gap < behavior.minSeparation) {
      post = clampVecToBounds(
        vecAdd(post, vecScale(vecNormalize(vecSub(post, other.position)), behavior.minSeparation - gap)),
        ctx.bounds,
      )
    }
  }
  enemy.post = post
}

function attackRangeOf(behavior: EnemyBehavior): number {
  return behavior.kind === 'wolf' ? behavior.pounceRange : behavior.attackRange
}

function beginTelegraph(enemy: EnemyEntity, ctx: EnemyTickContext, events: EnemyEvent[]) {
  enemy.attackDirection = vecNormalize(vecSub(ctx.playerPosition, enemy.position))
  enterState(enemy, 'telegraph', events)
}

function beginAttack(enemy: EnemyEntity, ctx: EnemyTickContext, events: EnemyEvent[]) {
  enemy.attackDirection = vecNormalize(vecSub(ctx.playerPosition, enemy.position))
  enemy.attackDidHit = false
  enterState(enemy, 'attack', events)
  if (enemy.behavior.kind === 'wolf') {
    events.push({ type: 'pounce-start', enemyId: enemy.id, from: { ...enemy.position }, direction: { ...enemy.attackDirection } })
    return
  }
  if (enemy.nextMothAttack === 'bolt') {
    events.push({
      type: 'moth-bolt',
      enemyId: enemy.id,
      from: { ...enemy.position },
      direction: { ...enemy.attackDirection },
      speed: enemy.behavior.projectileSpeed,
      radius: enemy.behavior.projectileRadius,
      damage: enemy.behavior.projectileDamage,
    })
  } else {
    events.push({ type: 'dive-start', enemyId: enemy.id, from: { ...enemy.position }, direction: { ...enemy.attackDirection } })
  }
}

function endAttack(enemy: EnemyEntity, events: EnemyEvent[]) {
  const behavior = enemy.behavior
  if (behavior.kind === 'moth') {
    enemy.nextMothAttack = enemy.nextMothAttack === 'bolt' ? 'dive' : 'bolt'
  }
  enemy.recoveryDuration = !enemy.attackDidHit && behavior.kind === 'wolf'
    ? behavior.whiffRecoverySeconds
    : behavior.recoverySeconds
  enterState(enemy, 'recovery', events)
}

export function tickEnemy(enemy: EnemyEntity, ctx: EnemyTickContext): EnemyEvent[] {
  const events: EnemyEvent[] = []
  if (enemy.state === 'death') {
    enemy.deathElapsed += ctx.deltaTime
    return events
  }
  if (!enemy.alive) return events

  enemy.stateElapsed += ctx.deltaTime
  enemy.decisionRemaining -= ctx.deltaTime
  const behavior = enemy.behavior

  switch (enemy.state) {
    case 'spawn':
      if (enemy.stateElapsed >= behavior.spawnSeconds) enterState(enemy, 'select-position', events)
      break
    case 'select-position': {
      if (enemy.decisionRemaining <= 0) {
        enemy.decisionRemaining = 1 / behavior.decisionHz
        choosePost(enemy, ctx)
      }
      moveToward(enemy, enemy.post, behavior.moveSpeed, ctx.deltaTime)
      if (ctx.playerAlive && vecDistance(enemy.position, ctx.playerPosition) <= attackRangeOf(behavior)) {
        beginTelegraph(enemy, ctx, events)
      }
      break
    }
    case 'telegraph':
      if (enemy.stateElapsed >= behavior.telegraphSeconds) beginAttack(enemy, ctx, events)
      break
    case 'attack': {
      const isBolt = behavior.kind === 'moth' && enemy.nextMothAttack === 'bolt'
      if (isBolt) {
        if (enemy.stateElapsed >= 0.2) endAttack(enemy, events)
        break
      }
      const dashSpeed = behavior.kind === 'wolf' ? behavior.pounceSpeed : behavior.diveSpeed
      const dashSeconds = behavior.kind === 'wolf' ? behavior.pounceSeconds : behavior.diveSeconds
      enemy.position = vecAdd(enemy.position, vecScale(enemy.attackDirection, dashSpeed * ctx.deltaTime))
      if (enemy.stateElapsed >= dashSeconds) endAttack(enemy, events)
      break
    }
    case 'recovery':
      if (enemy.stateElapsed >= enemy.recoveryDuration) {
        enemy.attackDidHit = false
        enterState(enemy, 'select-position', events)
      }
      break
    case 'hurt':
      if (enemy.stateElapsed >= HURT_SECONDS) enterState(enemy, 'recovery', events)
      break
  }

  return events
}

export function interruptEnemy(enemy: EnemyEntity): boolean {
  if (!enemy.alive) return false
  if (enemy.state === 'spawn' || enemy.state === 'hurt' || enemy.state === 'death') return false
  enemy.state = 'hurt'
  enemy.stateElapsed = 0
  return true
}

export function killEnemy(enemy: EnemyEntity): boolean {
  if (!enemy.alive) return false
  enemy.alive = false
  enemy.state = 'death'
  enemy.stateElapsed = 0
  enemy.deathElapsed = 0
  return true
}

export function enemyBodyHitsPlayer(enemy: EnemyEntity, playerPosition: Vec2, playerRadius: number): boolean {
  if (!enemy.alive || enemy.state !== 'attack' || enemy.attackDidHit) return false
  if (enemy.behavior.kind === 'moth' && enemy.nextMothAttack === 'bolt') return false
  return vecDistance(enemy.position, playerPosition) <= enemy.radius + playerRadius
}
