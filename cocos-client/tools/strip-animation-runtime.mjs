export function frameIndexAtTime({ elapsed, framesPerSecond, frameCount, loop }) {
  const safeFrameCount = Math.max(1, Math.floor(frameCount))
  const safeFps = Math.max(1, framesPerSecond)
  const rawIndex = Math.floor(Math.max(0, elapsed) * safeFps)
  return loop ? rawIndex % safeFrameCount : Math.min(safeFrameCount - 1, rawIndex)
}

export function shouldAdvanceAnimation({ visible, distanceToCamera, maxActiveDistance, accumulatedTime, updateInterval }) {
  if (!visible) return false
  if (distanceToCamera > maxActiveDistance) return false
  return accumulatedTime >= updateInterval
}

export function resourcePathForPng(assetPath) {
  const resourcePath = assetPath.replace(/\.png$/, '')
  return resourcePath.endsWith('/texture') ? resourcePath : `${resourcePath}/texture`
}
