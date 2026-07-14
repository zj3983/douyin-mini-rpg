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

export const BATTLE_DESIGN_WIDTH = 750
export const BATTLE_MIN_VISIBLE_HEIGHT = 1334
export const BATTLE_NAVIGATION_HEIGHT = 104
export const BATTLE_TOP_HUD_RESERVE = 210
export const PLAYER_FRAME_WIDTH = 320
export const PLAYER_FRAME_HEIGHT = 512
export const PLAYER_DISPLAY_SCALE = 0.45

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
  const designWidth = finiteDimension(input?.designWidth, BATTLE_DESIGN_WIDTH)
  const cssWidth = finiteDimension(input?.cssWidth, designWidth)
  const fallbackCssHeight = BATTLE_MIN_VISIBLE_HEIGHT * cssWidth / designWidth
  const cssHeight = finiteDimension(input?.cssHeight, fallbackCssHeight)
  const projectedHeight = designWidth * cssHeight / cssWidth
  const minimumVisibleHeight = BATTLE_MIN_VISIBLE_HEIGHT * designWidth / BATTLE_DESIGN_WIDTH
  const visibleHeight = Math.max(
    BATTLE_MIN_VISIBLE_HEIGHT,
    minimumVisibleHeight,
    Number.isFinite(projectedHeight) && projectedHeight > 0 ? projectedHeight : BATTLE_MIN_VISIBLE_HEIGHT,
  )
  const designPerCssPixel = designWidth / cssWidth
  const maxInset = visibleHeight * 0.15
  const topInset = Math.min(finiteInset(input?.topInsetPx) * designPerCssPixel, maxInset)
  const bottomInset = Math.min(finiteInset(input?.bottomInsetPx) * designPerCssPixel, maxInset)
  const widthScale = designWidth / BATTLE_DESIGN_WIDTH
  const navigationHeight = Math.min(BATTLE_NAVIGATION_HEIGHT * widthScale, visibleHeight * 0.12)
  const topHudReserve = Math.min(BATTLE_TOP_HUD_RESERVE * widthScale, visibleHeight * 0.22)
  const visibleMinY = -visibleHeight / 2
  const visibleMaxY = visibleHeight / 2
  const navigationTop = visibleMinY + bottomInset + navigationHeight
  const actorMinY = navigationTop
  const actorMaxY = visibleMaxY - topInset - topHudReserve
  const actorHeight = actorMaxY - actorMinY
  const playerHalfWidth = PLAYER_FRAME_WIDTH * PLAYER_DISPLAY_SCALE * widthScale / 2
  const playerHalfHeight = PLAYER_FRAME_HEIGHT * PLAYER_DISPLAY_SCALE * widthScale / 2
  const actorSafeRect = frozenRect(-designWidth / 2, designWidth / 2, actorMinY, actorMaxY)
  const movement = frozenRect(
    actorSafeRect.minX + playerHalfWidth,
    actorSafeRect.maxX - playerHalfWidth,
    actorSafeRect.minY + playerHalfHeight,
    actorSafeRect.maxY - playerHalfHeight,
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
