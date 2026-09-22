export type DungeonEncounterStart = () => boolean
export type DungeonEncounterRecovery = () => void

export interface DungeonEncounterRetryState {
  key: string | null
  recoveryApplied: boolean
  nextAttemptAtMs: number
}

export interface DungeonEncounterRetryOptions {
  key: string
  nowMs: number
  retryDelayMs: number
  start: DungeonEncounterStart
  recover: DungeonEncounterRecovery
}

export interface DungeonEncounterRetryResult {
  attempted: boolean
  started: boolean
}

export function createDungeonEncounterRetryState(): DungeonEncounterRetryState {
  return { key: null, recoveryApplied: false, nextAttemptAtMs: 0 }
}

export function resetDungeonEncounterRetryState(state: DungeonEncounterRetryState): void {
  state.key = null
  state.recoveryApplied = false
  state.nextAttemptAtMs = 0
}

export function retryDungeonEncounterStart(
  state: DungeonEncounterRetryState,
  options: DungeonEncounterRetryOptions,
): DungeonEncounterRetryResult {
  const nowMs = Number.isFinite(options.nowMs) ? Math.max(0, options.nowMs) : 0
  const retryDelayMs = Number.isFinite(options.retryDelayMs) ? Math.max(0, options.retryDelayMs) : 0
  if (state.key !== options.key) {
    state.key = options.key
    state.recoveryApplied = false
    state.nextAttemptAtMs = 0
  }
  if (nowMs < state.nextAttemptAtMs) return { attempted: false, started: false }

  let started = false
  try {
    started = options.start()
  } catch {
    started = false
  }
  if (started) {
    resetDungeonEncounterRetryState(state)
    return { attempted: true, started: true }
  }

  if (!state.recoveryApplied) {
    state.recoveryApplied = true
    options.recover()
  }
  state.nextAttemptAtMs = nowMs + retryDelayMs
  return { attempted: true, started: false }
}
