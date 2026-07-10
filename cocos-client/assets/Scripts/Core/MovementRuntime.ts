export interface Point2 {
  x: number
  y: number
}

export interface BattleBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export function clampBattleTarget(point: Point2, bounds: BattleBounds): Point2 {
  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, point.x)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY, point.y)),
  }
}

export function stepTowardTarget(current: Point2, target: Point2, speed: number, deltaTime: number) {
  const dx = target.x - current.x
  const dy = target.y - current.y
  const distance = Math.hypot(dx, dy)
  if (distance === 0) return { position: { ...current }, distanceMoved: 0, arrived: true }
  const step = Math.min(distance, Math.max(0, speed * deltaTime))
  return {
    position: { x: current.x + dx / distance * step, y: current.y + dy / distance * step },
    distanceMoved: step,
    arrived: step >= distance,
  }
}
