export interface Vec2 {
  x: number
  y: number
}

export interface BattleBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export function vecAdd(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y }
}

export function vecSub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y }
}

export function vecScale(a: Vec2, scalar: number): Vec2 {
  return { x: a.x * scalar, y: a.y * scalar }
}

export function vecDistance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function vecNormalize(a: Vec2): Vec2 {
  const length = Math.hypot(a.x, a.y)
  if (length === 0 || !Number.isFinite(length)) return { x: 1, y: 0 }
  return { x: a.x / length, y: a.y / length }
}

export function vecAngle(a: Vec2): number {
  return Math.atan2(a.y, a.x)
}

export function angleDiff(a: number, b: number): number {
  let diff = a - b
  while (diff > Math.PI) diff -= Math.PI * 2
  while (diff < -Math.PI) diff += Math.PI * 2
  return diff
}

export function isFiniteVec(a: Vec2): boolean {
  return Number.isFinite(a.x) && Number.isFinite(a.y)
}

export function clampVecToBounds(point: Vec2, bounds: BattleBounds): Vec2 {
  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, point.x)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY, point.y)),
  }
}

export function distancePointToSegment(point: Vec2, from: Vec2, to: Vec2): number {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const lengthSq = dx * dx + dy * dy
  const rawT = lengthSq === 0 ? 0 : ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSq
  const t = Math.max(0, Math.min(1, rawT))
  return Math.hypot(point.x - (from.x + dx * t), point.y - (from.y + dy * t))
}

export interface FanSpec {
  origin: Vec2
  directionRadians: number
  radius: number
  halfAngleRadians: number
}

export function pointInFan(point: Vec2, fan: FanSpec): boolean {
  if (vecDistance(point, fan.origin) > fan.radius) return false
  const angle = vecAngle(vecSub(point, fan.origin))
  return Math.abs(angleDiff(angle, fan.directionRadians)) < fan.halfAngleRadians
}

export interface RingBandSpec {
  center: Vec2
  innerRadius: number
  outerRadius: number
  gapCenterRadians: number
  gapHalfAngleRadians: number
}

export function pointInRingBand(point: Vec2, ring: RingBandSpec): boolean {
  const distance = vecDistance(point, ring.center)
  if (distance < ring.innerRadius || distance > ring.outerRadius) return false
  const angle = vecAngle(vecSub(point, ring.center))
  return Math.abs(angleDiff(angle, ring.gapCenterRadians)) > ring.gapHalfAngleRadians
}

export function quadBezierPoint(from: Vec2, control: Vec2, to: Vec2, t: number): Vec2 {
  const u = 1 - t
  return {
    x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
    y: u * u * from.y + 2 * u * t * control.y + t * t * to.y,
  }
}

export function quadBezierLength(from: Vec2, control: Vec2, to: Vec2): number {
  let length = 0
  let previous = from
  for (let index = 1; index <= 16; index += 1) {
    const point = quadBezierPoint(from, control, to, index / 16)
    length += vecDistance(previous, point)
    previous = point
  }
  return length
}
