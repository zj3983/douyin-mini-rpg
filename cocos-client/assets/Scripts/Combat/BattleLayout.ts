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

export interface VisualFrameSize {
  readonly width: number
  readonly height: number
}

export interface BossVisualPlacement {
  readonly position: Readonly<Point2>
  readonly visualSize: Readonly<VisualFrameSize>
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

export function computeBossVisualPlacement(
  layout: Pick<BattleLayout, 'actorSafeRect' | 'bossSpawn' | 'bossMaxVisualBounds'>,
  frameSize: VisualFrameSize,
): Readonly<BossVisualPlacement> {
  const width = frameSize?.width
  const height = frameSize?.height
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new TypeError('frameSize width and height must be finite and positive')
  }
  const maxWidth = Math.min(
    layout.bossMaxVisualBounds.width,
    layout.actorSafeRect.maxX - layout.actorSafeRect.minX,
  )
  const maxHeight = Math.min(
    layout.bossMaxVisualBounds.height,
    layout.actorSafeRect.maxY - layout.actorSafeRect.minY,
  )
  const scale = Math.min(maxWidth / width, maxHeight / height)
  const visualSize = Object.freeze({ width: width * scale, height: height * scale })
  const halfWidth = visualSize.width / 2
  const halfHeight = visualSize.height / 2
  const position = Object.freeze({
    x: Math.max(
      layout.actorSafeRect.minX + halfWidth,
      Math.min(layout.actorSafeRect.maxX - halfWidth, layout.bossSpawn.x),
    ),
    y: Math.max(
      layout.actorSafeRect.minY + halfHeight,
      Math.min(layout.actorSafeRect.maxY - halfHeight, layout.bossSpawn.y),
    ),
  })
  return Object.freeze({ position, visualSize })
}

export function computeOrdinaryEnemySpawn(
  layout: Pick<BattleLayout, 'actorSafeRect'>,
  visualSize: VisualFrameSize,
  laneY: number,
): Readonly<Point2> {
  const width = visualSize?.width
  const height = visualSize?.height
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new TypeError('visualSize width and height must be finite and positive')
  }
  if (!Number.isFinite(laneY)) throw new TypeError('laneY must be finite')
  const bounds = layout.actorSafeRect
  if (width > bounds.maxX - bounds.minX || height > bounds.maxY - bounds.minY) {
    throw new RangeError('ordinary enemy visual must fit inside the actor safe rect')
  }
  const halfWidth = width * 0.5
  const halfHeight = height * 0.5
  return Object.freeze({
    x: bounds.maxX - halfWidth,
    y: Math.max(bounds.minY + halfHeight, Math.min(bounds.maxY - halfHeight, laneY)),
  })
}
