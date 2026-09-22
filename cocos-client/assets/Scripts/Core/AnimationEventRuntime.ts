export interface AnimationEventMarker {
  name: string
  at: number
}

export interface AnimationTimeRange {
  previousElapsed: number
  elapsed: number
  duration: number
  loop: boolean
}

export interface AnimationEventCrossingInput extends AnimationTimeRange {
  markers: readonly AnimationEventMarker[]
  maxCatchUpCycles?: number
}

export function actionDuration(frameCount: number, fps: number): number {
  if (!Number.isFinite(frameCount) || !Number.isFinite(fps) || frameCount <= 0 || fps <= 0) {
    return 0
  }
  return frameCount / fps
}

export function markersCrossed({
  markers,
  previousElapsed,
  elapsed,
  duration,
  loop,
  maxCatchUpCycles,
}: AnimationEventCrossingInput): AnimationEventMarker[] {
  if (
    !Number.isFinite(previousElapsed)
    || !Number.isFinite(elapsed)
    || !Number.isFinite(duration)
    || elapsed <= previousElapsed
    || duration <= 0
  ) {
    return []
  }

  const crossed: AnimationEventMarker[] = []
  let firstCycle = loop ? Math.max(0, Math.floor(previousElapsed / duration)) : 0
  const lastCycle = loop ? Math.max(0, Math.floor(elapsed / duration)) : 0
  if (loop && typeof maxCatchUpCycles === 'number' && Number.isFinite(maxCatchUpCycles) && maxCatchUpCycles > 0) {
    const catchUpCycles = Math.max(1, Math.floor(maxCatchUpCycles))
    firstCycle = Math.max(firstCycle, lastCycle - catchUpCycles + 1)
  }

  for (let cycle = firstCycle; cycle <= lastCycle; cycle += 1) {
    for (const marker of markers) {
      const markerElapsed = (cycle + marker.at) * duration
      if (markerElapsed > previousElapsed && markerElapsed <= elapsed && (loop || markerElapsed <= duration)) {
        crossed.push(marker)
      }
    }
  }

  return crossed
}

export function actionCompleted({
  previousElapsed,
  elapsed,
  duration,
  loop,
}: AnimationTimeRange): boolean {
  return !loop
    && Number.isFinite(previousElapsed)
    && Number.isFinite(elapsed)
    && Number.isFinite(duration)
    && duration > 0
    && elapsed > previousElapsed
    && previousElapsed < duration
    && elapsed >= duration
}
