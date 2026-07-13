export interface StageOneCombatConfig {
  readonly stageId: number
  readonly durationSeconds: number
  readonly phaseStarts: { readonly mowing: number; readonly pressure: number; readonly boss: number }
  readonly activeEnemyCap: number
  readonly spawnCadenceSeconds: { readonly intro: number; readonly mowing: number; readonly pressure: number }
  readonly bossId: 'bamboo-warden'
  readonly settlementAutoContinueSeconds: number
}

const MINIMUM_SPAWN_CADENCE_SECONDS = 1 / 120

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function requirePositiveSafeInteger(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive safe integer`)
  }
  return value
}

function requireFiniteNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${name} must be finite`)
  }
  return value
}

function requireSpawnCadence(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < MINIMUM_SPAWN_CADENCE_SECONDS) {
    throw new Error(`${name} must be at least 1/120 second`)
  }
  return value
}

function requirePositiveFiniteNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be positive and finite`)
  }
  return value
}

export function parseStageOneConfig(value: unknown): StageOneCombatConfig {
  if (!isRecord(value)) throw new Error('config must be an object')

  const stageId = requirePositiveSafeInteger(value.stageId, 'stageId')
  const durationSeconds = requirePositiveSafeInteger(value.durationSeconds, 'durationSeconds')
  const activeEnemyCap = requirePositiveSafeInteger(value.activeEnemyCap, 'activeEnemyCap')
  if (activeEnemyCap > 18) throw new Error('activeEnemyCap must be at most 18')
  if (value.bossId !== 'bamboo-warden') throw new Error('bossId must be bamboo-warden')

  if (!isRecord(value.phaseStarts)) throw new Error('phaseStarts must be an object')
  const mowing = requireFiniteNumber(value.phaseStarts.mowing, 'phaseStarts.mowing')
  const pressure = requireFiniteNumber(value.phaseStarts.pressure, 'phaseStarts.pressure')
  const boss = requireFiniteNumber(value.phaseStarts.boss, 'phaseStarts.boss')
  if (!(0 < mowing && mowing < pressure && pressure < boss && boss < durationSeconds)) {
    throw new Error('phaseStarts must satisfy 0 < mowing < pressure < boss < durationSeconds')
  }

  if (!isRecord(value.spawnCadenceSeconds)) throw new Error('spawnCadenceSeconds must be an object')
  const intro = requireSpawnCadence(value.spawnCadenceSeconds.intro, 'spawnCadenceSeconds.intro')
  const mowingCadence = requireSpawnCadence(value.spawnCadenceSeconds.mowing, 'spawnCadenceSeconds.mowing')
  const pressureCadence = requireSpawnCadence(value.spawnCadenceSeconds.pressure, 'spawnCadenceSeconds.pressure')
  const settlementAutoContinueSeconds = requirePositiveFiniteNumber(
    value.settlementAutoContinueSeconds,
    'settlementAutoContinueSeconds',
  )

  return Object.freeze({
    stageId,
    durationSeconds,
    phaseStarts: Object.freeze({ mowing, pressure, boss }),
    activeEnemyCap,
    spawnCadenceSeconds: Object.freeze({ intro, mowing: mowingCadence, pressure: pressureCadence }),
    bossId: 'bamboo-warden' as const,
    settlementAutoContinueSeconds,
  })
}
