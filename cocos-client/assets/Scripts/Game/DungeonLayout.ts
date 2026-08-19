import type { ViewportMetrics } from './ViewportMetrics.ts'

export interface DungeonUiRect {
  readonly centerX: number
  readonly centerY: number
  readonly width: number
  readonly height: number
}

export interface DungeonLayout {
  readonly width: number
  readonly height: number
  readonly physicalScale: number
  readonly safeRect: DungeonUiRect
  readonly battleRect: DungeonUiRect
  readonly hud: DungeonUiRect
  readonly mapButton: DungeonUiRect
  readonly interaction: DungeonUiRect
  readonly settlement: DungeonUiRect
  readonly fontSizes: Readonly<{
    hud: 24
    hint: 26
    settlementTitle: 34
    settlementBody: 24
  }>
}

const DESIGN_WIDTH = 750
const DESIGN_HEIGHT = 1334
const MAX_DIMENSION = 1_000_000
const FONT_SIZES = Object.freeze({ hud: 24, hint: 26, settlementTitle: 34, settlementBody: 24 } as const)

function dimension(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? Math.min(value, MAX_DIMENSION) : fallback
}

function inset(value: number, maximum: number): number {
  return Number.isFinite(value) && value > 0 ? Math.min(value, maximum) : 0
}

function rect(centerX: number, centerY: number, width: number, height: number): DungeonUiRect {
  return Object.freeze({ centerX, centerY, width, height })
}

export function computeDungeonLayout(metrics: Pick<ViewportMetrics,
  'cssWidth' | 'cssHeight' | 'topInsetPx' | 'bottomInsetPx' | 'leftInsetPx' | 'rightInsetPx'>,
): DungeonLayout {
  const cssWidth = dimension(metrics?.cssWidth, DESIGN_WIDTH)
  const cssHeight = dimension(metrics?.cssHeight, DESIGN_HEIGHT)
  const physicalScale = cssWidth / DESIGN_WIDTH
  const width = DESIGN_WIDTH
  const height = cssHeight / physicalScale
  const px = (value: number) => value / physicalScale
  const safeLeft = -width / 2 + px(inset(metrics?.leftInsetPx, cssWidth))
  const safeRight = width / 2 - px(inset(metrics?.rightInsetPx, cssWidth))
  const safeTop = height / 2 - px(inset(metrics?.topInsetPx, cssHeight))
  const safeBottom = -height / 2 + px(inset(metrics?.bottomInsetPx, cssHeight))
  const safeWidth = Math.max(px(44), safeRight - safeLeft)
  const safeHeight = Math.max(px(44), safeTop - safeBottom)
  const safeCenterX = (safeLeft + safeRight) / 2
  const safeCenterY = (safeTop + safeBottom) / 2
  const margin = Math.min(px(16), safeWidth * 0.04)
  const minimumTouch = px(44)
  const mapSize = Math.max(minimumTouch, Math.min(px(56), safeHeight * 0.18))
  const hudHeight = Math.max(px(64), Math.min(px(94), safeHeight * 0.2))
  const interactionHeight = Math.max(minimumTouch, Math.min(px(72), safeHeight * 0.18))
  const settlementWidth = Math.max(minimumTouch, Math.min(safeWidth - margin * 2, px(650)))
  const settlementHeight = Math.max(
    minimumTouch,
    Math.min(safeHeight * 0.7, px(620)),
  )
  const hudWidth = Math.max(minimumTouch, safeWidth - margin * 3 - mapSize)
  const hudTop = safeTop - margin
  const hud = rect(safeLeft + margin + hudWidth / 2, hudTop - hudHeight / 2, hudWidth, hudHeight)
  const mapButton = rect(safeRight - margin - mapSize / 2, hudTop - mapSize / 2, mapSize, mapSize)
  const interactionWidth = Math.max(minimumTouch, Math.min(safeWidth - margin * 2, px(520)))
  const interaction = rect(safeCenterX, safeBottom + margin + interactionHeight / 2, interactionWidth, interactionHeight)
  const battleTop = Math.min(hud.centerY - hud.height / 2, mapButton.centerY - mapButton.height / 2) - margin
  const battleBottom = interaction.centerY + interaction.height / 2 + margin
  const battleRect = rect(safeCenterX, (battleTop + battleBottom) / 2, safeWidth, Math.max(0, battleTop - battleBottom))

  return Object.freeze({
    width,
    height,
    physicalScale,
    safeRect: rect(safeCenterX, safeCenterY, safeWidth, safeHeight),
    battleRect,
    hud,
    mapButton,
    interaction,
    settlement: rect(safeCenterX, safeCenterY, settlementWidth, settlementHeight),
    fontSizes: FONT_SIZES,
  })
}
