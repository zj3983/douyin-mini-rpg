import type { DungeonPressurePhase } from './DungeonTypes.ts'

export const MAX_FRAME_DELTA_SECONDS = 0.1
export const RESTLESS_AT_SECONDS = 120
export const FRENZY_AT_SECONDS = 240

export interface DungeonPressureState {
  elapsedSeconds: number
  phase: DungeonPressurePhase
}

export interface DungeonPressurePhaseChangedEvent {
  type: 'pressure-phase-changed'
  phase: DungeonPressurePhase
}

export interface DungeonPressureResult {
  events: DungeonPressurePhaseChangedEvent[]
}

const PHASES: DungeonPressurePhase[] = ['calm', 'restless', 'frenzy']

function assertValidSeconds(seconds: number, name: string): void {
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new TypeError(`${name} must be a finite nonnegative number`)
  }
}

function assertValidState(state: DungeonPressureState): void {
  assertValidSeconds(state.elapsedSeconds, 'elapsedSeconds')
  if (state.phase !== pressurePhaseAt(state.elapsedSeconds)) {
    throw new TypeError('pressure phase does not match elapsedSeconds')
  }
}

function addSeconds(elapsedSeconds: number, seconds: number): number {
  return Math.round((elapsedSeconds + seconds) * 1_000_000_000) / 1_000_000_000
}

function eventsBetween(
  from: DungeonPressurePhase,
  to: DungeonPressurePhase,
): DungeonPressurePhaseChangedEvent[] {
  const fromIndex = PHASES.indexOf(from)
  const toIndex = PHASES.indexOf(to)
  return PHASES.slice(fromIndex + 1, toIndex + 1).map((phase) => ({
    type: 'pressure-phase-changed',
    phase,
  }))
}

function applyElapsedSeconds(
  state: DungeonPressureState,
  seconds: number,
): DungeonPressurePhaseChangedEvent[] {
  const nextElapsedSeconds = addSeconds(state.elapsedSeconds, seconds)
  const nextPhase = pressurePhaseAt(nextElapsedSeconds)
  const events = eventsBetween(state.phase, nextPhase)

  state.elapsedSeconds = nextElapsedSeconds
  state.phase = nextPhase
  return events
}

export function pressurePhaseAt(seconds: number): DungeonPressurePhase {
  assertValidSeconds(seconds, 'seconds')
  if (seconds >= FRENZY_AT_SECONDS) return 'frenzy'
  if (seconds >= RESTLESS_AT_SECONDS) return 'restless'
  return 'calm'
}

export function createDungeonPressure(): DungeonPressureState {
  return { elapsedSeconds: 0, phase: 'calm' }
}

export function advanceDungeonPressure(
  state: DungeonPressureState,
  deltaSeconds: number,
  paused: boolean,
): DungeonPressureResult {
  assertValidState(state)
  if (paused) return { events: [] }
  assertValidSeconds(deltaSeconds, 'deltaSeconds')
  return {
    events: applyElapsedSeconds(state, Math.min(deltaSeconds, MAX_FRAME_DELTA_SECONDS)),
  }
}

export function applySearchPressure(
  state: DungeonPressureState,
  seconds: 12 | 20,
): DungeonPressureResult {
  assertValidState(state)
  if (seconds !== 12 && seconds !== 20) {
    throw new TypeError('search pressure must be 12 or 20 seconds')
  }
  return { events: applyElapsedSeconds(state, seconds) }
}

export function snapshotDungeonPressure(state: DungeonPressureState): DungeonPressureState {
  assertValidState(state)
  return { elapsedSeconds: state.elapsedSeconds, phase: state.phase }
}
