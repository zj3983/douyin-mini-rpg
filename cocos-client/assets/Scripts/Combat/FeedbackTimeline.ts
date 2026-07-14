import type { CombatEvent, Point2 } from './CombatTypes.ts'
import { vfxFeaturePolicy } from './PerformanceBudget.ts'
import type { VfxQuality } from './PerformanceBudget.ts'

export type FeedbackKind =
  | 'cast-cue'
  | 'sword-trail'
  | 'impact'
  | 'hit-stop'
  | 'camera-kick'
  | 'damage-number'
  | 'audio-cue'
  | 'debris'

export interface FeedbackRequest {
  kind: FeedbackKind
  atMs: number
  strength: number
  durationMs: number
  key?: string
  position?: Point2
}

export type FeedbackEvent =
  | CombatEvent
  | {
    type: 'artifact-cast'
    artifactId: string
    actorId: string
    at: number
    target?: Point2
  }
  | {
    type: 'guard-broken'
    targetRank: 'ordinary' | 'elite' | 'boss'
    targetId: string
    at: number
  }

const CAST_MS = 0
const LAUNCH_MS = 62
const IMPACT_MS = 142
const RETURN_AUDIO_MS = 196

function pointOrZero(point: Point2 | undefined): Point2 {
  return {
    x: Number.isFinite(point?.x) ? point.x : 0,
    y: Number.isFinite(point?.y) ? point.y : 0,
  }
}

function request(input: FeedbackRequest): FeedbackRequest {
  return {
    ...input,
    atMs: Math.max(0, Math.round(input.atMs)),
    strength: Math.max(0, input.strength),
    durationMs: Math.max(0, Math.round(input.durationMs)),
  }
}

function castFeedback(event: Extract<FeedbackEvent, { type: 'artifact-cast' }>, quality: VfxQuality): FeedbackRequest[] {
  const target = pointOrZero(event.target)
  const policy = vfxFeaturePolicy(quality)
  const requests: FeedbackRequest[] = [
    request({ kind: 'cast-cue', key: 'hand-seal-light', atMs: CAST_MS, strength: 1, durationMs: 110 }),
    request({ kind: 'audio-cue', key: 'hand-seal', atMs: CAST_MS, strength: 0.7, durationMs: 0 }),
    request({ kind: 'sword-trail', key: 'flying-sword-body', atMs: LAUNCH_MS, strength: 1, durationMs: quality === 'full' ? 220 : 140, position: target }),
    request({ kind: 'audio-cue', key: 'sword-launch', atMs: LAUNCH_MS, strength: 0.86, durationMs: 0 }),
    request({ kind: 'impact', key: 'sword-arc-impact', atMs: IMPACT_MS, strength: quality === 'minimal' ? 0.78 : 1, durationMs: 92, position: target }),
    request({ kind: 'hit-stop', key: 'sword-hit-stop', atMs: IMPACT_MS, strength: 1, durationMs: 42 }),
    request({ kind: 'damage-number', key: 'damage-rise', atMs: IMPACT_MS + 18, strength: 1, durationMs: 460, position: target }),
    request({ kind: 'audio-cue', key: 'sword-return', atMs: RETURN_AUDIO_MS, strength: 0.68, durationMs: 0 }),
  ]

  if (policy.debris) {
    requests.push(request({ kind: 'debris', key: 'spark-fragments', atMs: IMPACT_MS, strength: 0.72, durationMs: 180, position: target }))
  }

  return requests
}

function damageFeedback(event: Extract<CombatEvent, { type: 'damage-resolved' }>, quality: VfxQuality): FeedbackRequest[] {
  return [
    request({ kind: 'impact', key: 'light-hit', atMs: 0, strength: quality === 'full' ? 0.42 : 0.3, durationMs: 48 }),
    request({ kind: 'damage-number', key: 'damage-rise', atMs: 20, strength: 0.7, durationMs: 420 }),
    request({ kind: 'hit-stop', key: 'micro-hit-stop', atMs: 0, strength: 0.4, durationMs: Math.min(38, Math.max(18, Math.round(event.amount / 4))) }),
  ]
}

function breakFeedback(event: Extract<FeedbackEvent, { type: 'guard-broken' }>): FeedbackRequest[] {
  const strength = event.targetRank === 'boss' ? 5 : event.targetRank === 'elite' ? 2 : 0
  const requests: FeedbackRequest[] = [
    request({ kind: 'impact', key: `${event.targetRank}-guard-break`, atMs: 0, strength: Math.max(1, strength), durationMs: 140 }),
    request({ kind: 'audio-cue', key: `${event.targetRank}-break`, atMs: 0, strength: 0.9, durationMs: 0 }),
  ]
  if (strength > 0) {
    requests.push(request({ kind: 'camera-kick', key: `${event.targetRank}-break-kick`, atMs: 0, strength, durationMs: event.targetRank === 'boss' ? 90 : 60 }))
  }
  return requests
}

export function feedbackFor(event: FeedbackEvent, quality: VfxQuality): FeedbackRequest[] {
  switch (event.type) {
    case 'artifact-cast':
      return castFeedback(event, quality)
    case 'damage-resolved':
      return damageFeedback(event, quality)
    case 'guard-broken':
      return breakFeedback(event)
    default:
      return []
  }
}
