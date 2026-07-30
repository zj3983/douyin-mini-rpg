export interface WorldStageSelectRect {
  readonly centerX: number
  readonly centerY: number
  readonly width: number
  readonly height: number
}

export interface WorldStageSelectLayoutInput {
  readonly cssWidth: number
  readonly cssHeight: number
  readonly topInsetPx: number
  readonly bottomInsetPx: number
  readonly leftInsetPx: number
  readonly rightInsetPx: number
}

export interface WorldStageSelectLayout {
  readonly width: number
  readonly height: number
  readonly physicalScale: number
  readonly columns: 2 | 3
  readonly itemHeight: number
  readonly itemCornerRadius: number
  readonly itemTitleWidth: number
  readonly badgeWidth: number
  readonly safeRect: WorldStageSelectRect
  readonly header: WorldStageSelectRect
  readonly scrollView: WorldStageSelectRect
  readonly viewport: WorldStageSelectRect
  readonly content: WorldStageSelectRect
  readonly grid: WorldStageSelectRect
  readonly closeButton: WorldStageSelectRect
  readonly status: WorldStageSelectRect
  readonly scrollRange: number
  readonly items: readonly WorldStageSelectRect[]
}

const DESIGN_WIDTH = 750
const DESIGN_HEIGHT = 1334
const MAX_DIMENSION = 1_000_000

function dimension(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? Math.min(value, MAX_DIMENSION) : fallback
}

function inset(value: number, maximum: number): number {
  return Number.isFinite(value) && value > 0 ? Math.min(value, maximum) : 0
}

function rect(centerX: number, centerY: number, width: number, height: number): WorldStageSelectRect {
  return Object.freeze({ centerX, centerY, width, height })
}

export function computeWorldStageSelectLayout(input: WorldStageSelectLayoutInput): WorldStageSelectLayout {
  const cssWidth = dimension(input?.cssWidth, DESIGN_WIDTH)
  const cssHeight = dimension(input?.cssHeight, DESIGN_HEIGHT)
  const physicalScale = Math.min(cssWidth / DESIGN_WIDTH, cssHeight / DESIGN_HEIGHT)
  const width = cssWidth / physicalScale
  const height = cssHeight / physicalScale
  const px = (value: number) => value / physicalScale
  const topInset = px(inset(input?.topInsetPx, cssHeight))
  const bottomInset = px(inset(input?.bottomInsetPx, cssHeight))
  const leftInset = px(inset(input?.leftInsetPx, cssWidth))
  const rightInset = px(inset(input?.rightInsetPx, cssWidth))
  const safeLeft = -width / 2 + leftInset
  const safeRight = width / 2 - rightInset
  const safeTop = height / 2 - topInset
  const safeBottom = -height / 2 + bottomInset
  const safeWidth = Math.max(px(280), safeRight - safeLeft)
  const safeHeight = Math.max(px(240), safeTop - safeBottom)
  const safeCenterX = (safeLeft + safeRight) / 2
  const safeCenterY = (safeTop + safeBottom) / 2
  const columns: 2 | 3 = cssWidth > cssHeight ? 3 : 2
  const horizontalMargin = px(16)
  const columnGap = px(12)
  const rowGap = px(10)
  const headerHeight = px(72)
  const headerTopGap = px(8)
  const headerScrollGap = px(12)
  const statusHeight = px(28)
  const statusBottomGap = px(12)
  const scrollStatusGap = px(8)
  const itemHeight = px(68)
  const closeSize = px(48)
  const contentWidth = Math.max(px(248), safeWidth - horizontalMargin * 2)
  const itemWidth = (contentWidth - columnGap * (columns - 1)) / columns
  const rows = Math.ceil(10 / columns)
  const contentHeight = itemHeight * rows + rowGap * (rows - 1)
  const header = rect(
    safeCenterX,
    safeTop - headerTopGap - headerHeight / 2,
    contentWidth,
    headerHeight,
  )
  const status = rect(
    safeCenterX,
    safeBottom + statusBottomGap + statusHeight / 2,
    contentWidth,
    statusHeight,
  )
  const scrollTop = header.centerY - header.height / 2 - headerScrollGap
  const scrollBottom = status.centerY + status.height / 2 + scrollStatusGap
  const scrollHeight = Math.max(px(96), scrollTop - scrollBottom)
  const scrollView = rect(safeCenterX, scrollBottom + scrollHeight / 2, contentWidth, scrollHeight)
  const content = rect(0, -contentHeight / 2, contentWidth, contentHeight)
  const itemStrideX = itemWidth + columnGap
  const items = Object.freeze(Array.from({ length: 10 }, (_, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    return rect(
      -contentWidth / 2 + itemWidth / 2 + column * itemStrideX,
      -itemHeight / 2 - row * (itemHeight + rowGap),
      itemWidth,
      itemHeight,
    )
  }))
  const badgeWidth = px(44)
  const itemTitleWidth = itemWidth - px(20 + 6 + 44)

  return Object.freeze({
    width,
    height,
    physicalScale,
    columns,
    itemHeight,
    itemCornerRadius: px(6),
    itemTitleWidth,
    badgeWidth,
    safeRect: rect(safeCenterX, safeCenterY, safeWidth, safeHeight),
    header,
    scrollView,
    viewport: scrollView,
    content,
    grid: content,
    closeButton: rect(
      header.centerX + header.width / 2 - closeSize / 2,
      header.centerY,
      closeSize,
      closeSize,
    ),
    status,
    scrollRange: Math.max(0, contentHeight - scrollHeight),
    items,
  })
}
