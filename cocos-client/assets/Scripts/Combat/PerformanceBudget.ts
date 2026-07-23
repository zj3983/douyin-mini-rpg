export type VfxQuality = 'full' | 'reduced' | 'minimal'

export interface PerformanceBudget {
  quality: VfxQuality
  frameSamples: number[]
  healthyWindows: number
}

export interface VfxFeaturePolicy {
  particles: boolean
  debris: boolean
  longTrails: boolean
  swordBody: boolean
  actorSilhouette: boolean
  telegraph: boolean
}

const WINDOW_SIZE = 300
const DEGRADE_P95_MS = 20
const RECOVER_P95_MS = 17
const RECOVER_WINDOWS = 2

export function createPerformanceBudget(initialQuality: VfxQuality = 'full'): PerformanceBudget {
  return {
    quality: initialQuality,
    frameSamples: [],
    healthyWindows: 0,
  }
}

function normalizeFrameMs(frameMs: number): number {
  if (!Number.isFinite(frameMs)) return DEGRADE_P95_MS
  return Math.max(0, frameMs)
}

function percentile95(samples: readonly number[]): number {
  if (samples.length === 0) return 0
  const sorted = [...samples].sort((left, right) => left - right)
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)
  return sorted[index]
}

function degrade(quality: VfxQuality): VfxQuality {
  if (quality === 'full') return 'reduced'
  if (quality === 'reduced') return 'minimal'
  return 'minimal'
}

function recover(quality: VfxQuality): VfxQuality {
  if (quality === 'minimal') return 'reduced'
  if (quality === 'reduced') return 'full'
  return 'full'
}

export function updateVfxQuality(state: PerformanceBudget, frameMs: number): VfxQuality {
  state.frameSamples.push(normalizeFrameMs(frameMs))
  if (state.frameSamples.length < WINDOW_SIZE) return state.quality

  const p95 = percentile95(state.frameSamples)
  state.frameSamples.length = 0

  if (p95 > DEGRADE_P95_MS) {
    state.quality = degrade(state.quality)
    state.healthyWindows = 0
    return state.quality
  }

  if (p95 <= RECOVER_P95_MS) {
    state.healthyWindows += 1
    if (state.healthyWindows >= RECOVER_WINDOWS) {
      state.quality = recover(state.quality)
      state.healthyWindows = 0
    }
    return state.quality
  }

  state.healthyWindows = 0
  return state.quality
}

export function vfxFeaturePolicy(quality: VfxQuality): VfxFeaturePolicy {
  const full = quality === 'full'
  return {
    particles: full,
    debris: full,
    longTrails: full,
    swordBody: true,
    actorSilhouette: true,
    telegraph: true,
  }
}
