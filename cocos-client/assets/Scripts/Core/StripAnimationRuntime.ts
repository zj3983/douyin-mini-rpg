export interface FrameIndexInput {
  elapsed: number
  framesPerSecond: number
  frameCount: number
  loop: boolean
}

export interface AnimationAdvanceInput {
  visible: boolean
  distanceToCamera: number
  maxActiveDistance: number
  accumulatedTime: number
  updateInterval: number
}

export function frameIndexAtTime(input: FrameIndexInput) {
  const safeFrameCount = Math.max(1, Math.floor(input.frameCount))
  const safeFps = Math.max(1, input.framesPerSecond)
  const rawIndex = Math.floor(Math.max(0, input.elapsed) * safeFps)
  return input.loop ? rawIndex % safeFrameCount : Math.min(safeFrameCount - 1, rawIndex)
}

export function shouldAdvanceAnimation(input: AnimationAdvanceInput) {
  if (!input.visible) return false
  if (input.distanceToCamera > input.maxActiveDistance) return false
  return input.accumulatedTime >= input.updateInterval
}

export function resourcePathForPng(assetPath: string) {
  return assetPath.replace(/\.png$/, '')
}
