export type WorldEncounterKind = 'normal' | 'elite' | 'region-boss'

export interface WorldRegionStage {
  readonly id: number
  readonly encounter: WorldEncounterKind
}

export interface WorldRegion {
  readonly id: string
  readonly stages: readonly WorldRegionStage[]
}

export type WorldStageSelection =
  | { readonly ok: true; readonly stageId: number }
  | { readonly ok: false; readonly reason: 'locked-stage' | 'unknown-stage' }

const WORLD_ENCOUNTER_KINDS: readonly WorldEncounterKind[] = ['normal', 'elite', 'region-boss']

function canonicalProgress(value: number): number {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0
}

function canonicalRequestedStage(value: number): number | null {
  return Number.isFinite(value) && Number.isInteger(value) && value >= 1 ? value : null
}

export function createWorldRegion(id: string, stages: readonly WorldRegionStage[]): WorldRegion {
  const safeId = id.trim()
  if (!safeId) throw new Error('World region ID is required.')
  if (stages.length !== 10) throw new Error('A world region must contain exactly ten stages.')

  const copy = Array.from({ length: 10 }, (_, index) => {
    const stage = stages[index]
    if (!stage) throw new Error(`Missing world region stage: ${index + 1}.`)
    if (stage.id !== index + 1) {
      throw new Error('World region stages must be ordered from one to ten.')
    }
    if (!WORLD_ENCOUNTER_KINDS.includes(stage.encounter)) {
      throw new Error(`Unknown world encounter: ${stage.encounter}`)
    }
    return Object.freeze({ id: stage.id, encounter: stage.encounter })
  })

  if (copy.filter((stage) => stage.encounter === 'elite').length !== 2) {
    throw new Error('A world region must contain exactly two elite encounters.')
  }
  const bosses = copy.filter((stage) => stage.encounter === 'region-boss')
  if (bosses.length !== 1 || bosses[0].id !== 10) {
    throw new Error('Stage ten must be the only regional Boss encounter.')
  }

  return Object.freeze({ id: safeId, stages: Object.freeze(copy) })
}

export function highestSelectableStage(highestClearedStage: number, region: WorldRegion): number {
  return Math.min(region.stages.length, canonicalProgress(highestClearedStage) + 1)
}

export function selectWorldStage(
  region: WorldRegion,
  highestClearedStage: number,
  requestedStage: number,
): WorldStageSelection {
  const stageId = canonicalRequestedStage(requestedStage)
  if (stageId === null || !region.stages.some((stage) => stage.id === stageId)) {
    return Object.freeze({ ok: false, reason: 'unknown-stage' })
  }
  if (stageId > highestSelectableStage(highestClearedStage, region)) {
    return Object.freeze({ ok: false, reason: 'locked-stage' })
  }
  return Object.freeze({ ok: true, stageId })
}
