export interface StageOneCombatConfig {
  stageId: number
  durationSeconds: number
  phaseStarts: { mowing: number; pressure: number; boss: number }
  activeEnemyCap: number
  spawnCadenceSeconds: { intro: number; mowing: number; pressure: number }
  bossId: 'bamboo-warden'
  settlementAutoContinueSeconds: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function requireFiniteInteger(value: unknown, name: string, positive: boolean): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value) || (positive && value <= 0)) {
    throw new Error(`${name} must be a ${positive ? 'positive ' : ''}finite integer`)
  }
  return value
}

function requireFiniteNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${name} must be finite`)
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

  const stageId = requireFiniteInteger(value.stageId, 'stageId', false)
  const durationSeconds = requireFiniteInteger(value.durationSeconds, 'durationSeconds', true)
  const activeEnemyCap = requireFiniteInteger(value.activeEnemyCap, 'activeEnemyCap', true)
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
  const intro = requirePositiveFiniteNumber(value.spawnCadenceSeconds.intro, 'spawnCadenceSeconds.intro')
  const mowingCadence = requirePositiveFiniteNumber(value.spawnCadenceSeconds.mowing, 'spawnCadenceSeconds.mowing')
  const pressureCadence = requirePositiveFiniteNumber(value.spawnCadenceSeconds.pressure, 'spawnCadenceSeconds.pressure')
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
