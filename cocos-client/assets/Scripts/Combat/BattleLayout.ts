import type { BattleRect, Point2 } from './CombatTypes.ts'

export interface LayoutInput {
  designWidth: number
  cssWidth: number
  cssHeight: number
  topInsetPx: number
  bottomInsetPx: number
}

export interface BattleLayout {
  visibleHeight: number
  movement: BattleRect
  actorSafeRect: BattleRect
  bossSpawn: Point2
  bossMaxVisualBounds: { width: number; height: number }
  navigationTop: number
}

const DEFAULT_DESIGN_WIDTH = 750
const MIN_VISIBLE_HEIGHT = 1334
const MAX_DIMENSION = 1_000_000

function finiteDimension(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback
  return Math.min(Math.max(value, 1), MAX_DIMENSION)
}

function finiteInset(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.min(value, MAX_DIMENSION) : 0
}

function frozenRect(minX: number, maxX: number, minY: number, maxY: number): BattleRect {
  return Object.freeze({ minX, maxX, minY, maxY })
}

export function computeBattleLayout(input: LayoutInput): BattleLayout {
  const designWidth = finiteDimension(input?.designWidth, DEFAULT_DESIGN_WIDTH)
  const cssWidth = finiteDimension(input?.cssWidth, designWidth)
  const fallbackCssHeight = MIN_VISIBLE_HEIGHT * cssWidth / designWidth
  const cssHeight = finiteDimension(input?.cssHeight, fallbackCssHeight)
  const projectedHeight = designWidth * cssHeight / cssWidth
  const visibleHeight = Math.max(
    MIN_VISIBLE_HEIGHT,
    Number.isFinite(projectedHeight) && projectedHeight > 0 ? projectedHeight : MIN_VISIBLE_HEIGHT,
  )
  const designPerCssPixel = designWidth / cssWidth
  const maxInset = visibleHeight * 0.15
  const topInset = Math.min(finiteInset(input?.topInsetPx) * designPerCssPixel, maxInset)
  const bottomInset = Math.min(finiteInset(input?.bottomInsetPx) * designPerCssPixel, maxInset)
  const widthScale = designWidth / DEFAULT_DESIGN_WIDTH
  const navigationHeight = Math.min(104 * widthScale, visibleHeight * 0.12)
  const topHudReserve = Math.min(210 * widthScale, visibleHeight * 0.22)
  const visibleMinY = -visibleHeight / 2
  const visibleMaxY = visibleHeight / 2
  const navigationTop = visibleMinY + bottomInset + navigationHeight
  const actorMinY = navigationTop
  const actorMaxY = visibleMaxY - topInset - topHudReserve
  const actorHeight = actorMaxY - actorMinY
  const movementBottomGap = Math.min(56 * widthScale, actorHeight * 0.15)
  const movementTopGap = Math.min(48 * widthScale, actorHeight * 0.15)
  const horizontalMovementGap = 55 * widthScale
  const actorSafeRect = frozenRect(-designWidth / 2, designWidth / 2, actorMinY, actorMaxY)
  const movement = frozenRect(
    actorSafeRect.minX + horizontalMovementGap,
    actorSafeRect.maxX - horizontalMovementGap,
    actorSafeRect.minY + movementBottomGap,
    actorSafeRect.maxY - movementTopGap,
  )
  const bossWidth = Math.min(260 * widthScale, designWidth * 0.7)
  const bossHeight = Math.min(420 * widthScale, actorHeight * 0.65)
  const bossEdgeGap = Math.min(24 * widthScale, (designWidth - bossWidth) * 0.1)
  const bossTopGap = Math.min(24 * widthScale, (actorHeight - bossHeight) * 0.1)
  const bossMaxVisualBounds = Object.freeze({ width: bossWidth, height: bossHeight })
  const bossSpawn = Object.freeze({
    x: actorSafeRect.maxX - bossWidth / 2 - bossEdgeGap,
    y: actorSafeRect.maxY - bossHeight / 2 - bossTopGap,
  })

  return Object.freeze({
    visibleHeight,
    movement,
    actorSafeRect,
    bossSpawn,
    bossMaxVisualBounds,
    navigationTop,
  })
}
