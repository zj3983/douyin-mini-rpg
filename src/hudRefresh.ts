export function nextHudRefresh(timer: number, dt: number, interval: number) {
  const safeInterval = Math.max(0.016, Number(interval) || 0.1)
  const safeDt = Math.max(0, Number(dt) || 0)
  const safeTimer = Number.isFinite(timer) ? timer : 0
  const nextTimer = safeTimer - safeDt
  if (nextTimer > 0) {
    return {
      refresh: false,
      timer: Number(nextTimer.toFixed(6)),
    }
  }
  return {
    refresh: true,
    timer: safeInterval,
  }
}
