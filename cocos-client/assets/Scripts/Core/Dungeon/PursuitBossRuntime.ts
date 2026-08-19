import type { PursuitBossPhase } from './DungeonTypes'

export interface PursuitBossConfig {
  firstShield: number
  secondShield: number
  finalHealth: number
}

export interface PursuitBossState {
  phase: PursuitBossPhase
  shield: number
  finalHealth: number
  altarUnlocked: boolean
  firstShieldMax: number
  secondShieldMax: number
  finalHealthMax: number
}

export type PursuitBossDamageEvent =
  | { type: 'pursuer-shield-damaged'; remaining: number }
  | { type: 'pursuer-health-damaged'; remaining: number }
  | { type: 'pursuer-repelled'; phase: 'first-repelled' | 'second-repelled' }
  | { type: 'pursuer-defeated' }

export type PursuitBossDamageResult =
  | { ok: true; event: PursuitBossDamageEvent }
  | { ok: false; reason: 'invalid-damage' | 'not-damageable' }

export type BeginSecondHuntResult =
  | {
      ok: true
      event: { type: 'route-seal-requested'; reason: 'second-hunt-started'; hunt: 2 }
    }
  | { ok: false; reason: 'invalid-phase' }

export type BeginFinalFightResult =
  | { ok: true }
  | { ok: false; reason: 'altar-locked' | 'invalid-phase' }

const PHASES: ReadonlySet<PursuitBossPhase> = new Set([
  'dormant',
  'first-hunt',
  'first-repelled',
  'second-hunt',
  'second-repelled',
  'true-form-locked',
  'final-fight',
  'defeated',
])

function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0
}

function isNonNegativeSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0
}

function assertValidState(state: PursuitBossState): void {
  if (!state || typeof state !== 'object') throw new TypeError('Pursuit Boss state must be an object')
  if (!PHASES.has(state.phase)) throw new TypeError('Pursuit Boss phase is invalid')
  if (!isPositiveSafeInteger(state.firstShieldMax)) throw new TypeError('First shield maximum is invalid')
  if (!isPositiveSafeInteger(state.secondShieldMax)) throw new TypeError('Second shield maximum is invalid')
  if (!isPositiveSafeInteger(state.finalHealthMax)) throw new TypeError('Final health maximum is invalid')
  if (!isNonNegativeSafeInteger(state.shield)) throw new TypeError('Pursuit Boss shield is invalid')
  if (!isNonNegativeSafeInteger(state.finalHealth)) throw new TypeError('Pursuit Boss health is invalid')
  if (typeof state.altarUnlocked !== 'boolean') throw new TypeError('Altar state is invalid')
  if (state.finalHealth > state.finalHealthMax) throw new TypeError('Pursuit Boss health exceeds its maximum')

  const finalHealthIsFull = state.finalHealth === state.finalHealthMax
  switch (state.phase) {
    case 'dormant':
    case 'first-repelled':
    case 'second-repelled':
      if (state.shield !== 0 || !finalHealthIsFull || state.altarUnlocked) {
        throw new TypeError('Pursuit Boss state is inconsistent with its phase')
      }
      return
    case 'first-hunt':
      if (state.shield <= 0 || state.shield > state.firstShieldMax || !finalHealthIsFull || state.altarUnlocked) {
        throw new TypeError('First hunt state is invalid')
      }
      return
    case 'second-hunt':
      if (state.shield <= 0 || state.shield > state.secondShieldMax || !finalHealthIsFull || state.altarUnlocked) {
        throw new TypeError('Second hunt state is invalid')
      }
      return
    case 'true-form-locked':
      if (state.shield !== 0 || !finalHealthIsFull || !state.altarUnlocked) {
        throw new TypeError('Locked true-form state is invalid')
      }
      return
    case 'final-fight':
      if (state.shield !== 0 || state.finalHealth <= 0 || !state.altarUnlocked) {
        throw new TypeError('Final fight state is invalid')
      }
      return
    case 'defeated':
      if (state.shield !== 0 || state.finalHealth !== 0 || !state.altarUnlocked) {
        throw new TypeError('Defeated pursuit Boss state is invalid')
      }
  }
}

export function createPursuitBoss(config: PursuitBossConfig): PursuitBossState {
  if (
    !config ||
    !isPositiveSafeInteger(config.firstShield) ||
    !isPositiveSafeInteger(config.secondShield) ||
    !isPositiveSafeInteger(config.finalHealth)
  ) {
    throw new TypeError('Pursuit Boss configuration must contain positive safe integers')
  }

  return {
    phase: 'dormant',
    shield: 0,
    finalHealth: config.finalHealth,
    altarUnlocked: false,
    firstShieldMax: config.firstShield,
    secondShieldMax: config.secondShield,
    finalHealthMax: config.finalHealth,
  }
}

export function beginFirstHunt(state: PursuitBossState): boolean {
  assertValidState(state)
  if (state.phase !== 'dormant') return false
  state.phase = 'first-hunt'
  state.shield = state.firstShieldMax
  return true
}

export function beginSecondHunt(state: PursuitBossState): BeginSecondHuntResult {
  assertValidState(state)
  if (state.phase !== 'first-repelled') return { ok: false, reason: 'invalid-phase' }
  state.phase = 'second-hunt'
  state.shield = state.secondShieldMax
  return {
    ok: true,
    event: { type: 'route-seal-requested', reason: 'second-hunt-started', hunt: 2 },
  }
}

export function unlockTrueForm(state: PursuitBossState, roomId: string): boolean {
  assertValidState(state)
  if (roomId !== 'f3-altar' || state.phase !== 'second-repelled') return false
  state.phase = 'true-form-locked'
  state.altarUnlocked = true
  return true
}

export function beginFinalFight(state: PursuitBossState): BeginFinalFightResult {
  assertValidState(state)
  if (state.phase === 'second-repelled') return { ok: false, reason: 'altar-locked' }
  if (state.phase !== 'true-form-locked' || !state.altarUnlocked) {
    return { ok: false, reason: 'invalid-phase' }
  }
  state.phase = 'final-fight'
  return { ok: true }
}

export function damagePursuer(state: PursuitBossState, amount: number): PursuitBossDamageResult {
  assertValidState(state)
  if (!isPositiveSafeInteger(amount)) return { ok: false, reason: 'invalid-damage' }

  if (state.phase === 'first-hunt' || state.phase === 'second-hunt') {
    const repelledPhase = state.phase === 'first-hunt' ? 'first-repelled' : 'second-repelled'
    state.shield = Math.max(0, state.shield - amount)
    if (state.shield > 0) {
      return { ok: true, event: { type: 'pursuer-shield-damaged', remaining: state.shield } }
    }
    state.phase = repelledPhase
    return { ok: true, event: { type: 'pursuer-repelled', phase: repelledPhase } }
  }

  if (state.phase !== 'final-fight') return { ok: false, reason: 'not-damageable' }
  state.finalHealth = Math.max(0, state.finalHealth - amount)
  if (state.finalHealth > 0) {
    return { ok: true, event: { type: 'pursuer-health-damaged', remaining: state.finalHealth } }
  }
  state.phase = 'defeated'
  return { ok: true, event: { type: 'pursuer-defeated' } }
}

export function snapshotPursuitBoss(state: PursuitBossState): PursuitBossState {
  assertValidState(state)
  return {
    phase: state.phase,
    shield: state.shield,
    finalHealth: state.finalHealth,
    altarUnlocked: state.altarUnlocked,
    firstShieldMax: state.firstShieldMax,
    secondShieldMax: state.secondShieldMax,
    finalHealthMax: state.finalHealthMax,
  }
}
