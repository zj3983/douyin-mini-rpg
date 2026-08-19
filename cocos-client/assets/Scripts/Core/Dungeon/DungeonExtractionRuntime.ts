export const EXTRACTION_CHANNEL_SECONDS = 3

export interface DungeonExtractionState {
  phase: 'idle' | 'channeling' | 'completed'
  roomId: string | null
  progressSeconds: number
}

export type ExtractionAdvanceResult =
  | { type: 'inactive' }
  | { type: 'progressed'; progressSeconds: number }
  | { type: 'extraction-completed'; roomId: string }

export type ExtractionInterruptResult =
  | { type: 'inactive' }
  | { type: 'ignored' }
  | { type: 'extraction-interrupted'; reason: 'elite-damage' | 'boss-damage' }

function isCanonicalId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim()
}

function assertFiniteNonnegative(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`${name} must be a finite nonnegative number`)
  }
}

function assertValidExtractionState(value: unknown): asserts value is DungeonExtractionState {
  if (!value || typeof value !== 'object') throw new TypeError('Extraction state must be an object')
  const state = value as DungeonExtractionState
  assertFiniteNonnegative(state.progressSeconds, 'progressSeconds')

  if (state.phase === 'idle') {
    if (state.roomId !== null || state.progressSeconds !== 0) {
      throw new TypeError('Idle extraction state is inconsistent')
    }
    return
  }
  if (state.phase === 'channeling') {
    if (!isCanonicalId(state.roomId) || state.progressSeconds >= EXTRACTION_CHANNEL_SECONDS) {
      throw new TypeError('Channeling extraction state is inconsistent')
    }
    return
  }
  if (state.phase === 'completed') {
    if (!isCanonicalId(state.roomId) || state.progressSeconds !== EXTRACTION_CHANNEL_SECONDS) {
      throw new TypeError('Completed extraction state is inconsistent')
    }
    return
  }
  throw new TypeError('Extraction phase is invalid')
}

export function createDungeonExtraction(): DungeonExtractionState {
  return { phase: 'idle', roomId: null, progressSeconds: 0 }
}

export function startExtraction(state: DungeonExtractionState, roomId: string): boolean {
  assertValidExtractionState(state)
  if (!isCanonicalId(roomId)) throw new TypeError('Extraction room ID must be canonical')
  if (state.phase !== 'idle') return false

  state.phase = 'channeling'
  state.roomId = roomId
  state.progressSeconds = 0
  return true
}

export function advanceExtraction(
  state: DungeonExtractionState,
  deltaSeconds: number,
): ExtractionAdvanceResult {
  assertValidExtractionState(state)
  assertFiniteNonnegative(deltaSeconds, 'deltaSeconds')
  if (state.phase !== 'channeling') return { type: 'inactive' }

  const nextProgress = Number((state.progressSeconds + deltaSeconds).toFixed(12))
  if (!Number.isFinite(nextProgress)) throw new TypeError('Extraction progress overflowed')
  if (nextProgress < EXTRACTION_CHANNEL_SECONDS) {
    state.progressSeconds = nextProgress
    return { type: 'progressed', progressSeconds: nextProgress }
  }

  const roomId = state.roomId
  if (roomId === null) throw new TypeError('Channeling extraction room is missing')
  state.phase = 'completed'
  state.progressSeconds = EXTRACTION_CHANNEL_SECONDS
  return { type: 'extraction-completed', roomId }
}

export function interruptExtraction(
  state: DungeonExtractionState,
  hit: { sourceRole: 'ordinary' | 'elite' | 'boss'; effectiveDamage: number },
): ExtractionInterruptResult {
  assertValidExtractionState(state)
  if (!hit || !['ordinary', 'elite', 'boss'].includes(hit.sourceRole)) {
    throw new TypeError('Extraction hit role is invalid')
  }
  if (!Number.isFinite(hit.effectiveDamage)) throw new TypeError('Effective damage must be finite')
  if (state.phase !== 'channeling') return { type: 'inactive' }
  if (hit.effectiveDamage <= 0 || hit.sourceRole === 'ordinary') return { type: 'ignored' }

  const reason = `${hit.sourceRole}-damage` as 'elite-damage' | 'boss-damage'
  state.phase = 'idle'
  state.roomId = null
  state.progressSeconds = 0
  return { type: 'extraction-interrupted', reason }
}

export function snapshotDungeonExtraction(state: DungeonExtractionState): DungeonExtractionState {
  assertValidExtractionState(state)
  return { phase: state.phase, roomId: state.roomId, progressSeconds: state.progressSeconds }
}

export function restoreDungeonExtraction(value: unknown): DungeonExtractionState {
  assertValidExtractionState(value)
  return snapshotDungeonExtraction(value)
}
