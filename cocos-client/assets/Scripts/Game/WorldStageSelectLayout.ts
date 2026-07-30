export interface WorldStageSelectRect {
  readonly centerX: number
  readonly centerY: number
  readonly width: number
  readonly height: number
}

export interface WorldStageSelectLayout {
  readonly width: number
  readonly height: number
  readonly columns: 2
  readonly itemCornerRadius: number
  readonly itemTitleWidth: number
  readonly badgeWidth: number
  readonly header: WorldStageSelectRect
  readonly grid: WorldStageSelectRect
  readonly closeButton: WorldStageSelectRect
  readonly status: WorldStageSelectRect
  readonly items: readonly WorldStageSelectRect[]
}

const DEFAULT_WIDTH = 750
const DEFAULT_HEIGHT = 1334
const HORIZONTAL_MARGIN = 36
const HEADER_HEIGHT = 96
const HEADER_TOP_MARGIN = 48
const HEADER_GRID_GAP = 28
const ITEM_HEIGHT = 132
const COLUMN_GAP = 18
const ROW_GAP = 16
const STATUS_HEIGHT = 40
const GRID_STATUS_GAP = 24

function dimension(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function rect(centerX: number, centerY: number, width: number, height: number): WorldStageSelectRect {
  return Object.freeze({ centerX, centerY, width, height })
}

export function computeWorldStageSelectLayout(width: number, height: number): WorldStageSelectLayout {
  const safeWidth = dimension(width, DEFAULT_WIDTH)
  const safeHeight = dimension(height, DEFAULT_HEIGHT)
  const gridWidth = safeWidth - HORIZONTAL_MARGIN * 2
  const itemWidth = (gridWidth - COLUMN_GAP) / 2
  const gridHeight = ITEM_HEIGHT * 5 + ROW_GAP * 4
  const headerCenterY = safeHeight / 2 - HEADER_TOP_MARGIN - HEADER_HEIGHT / 2
  const gridTop = headerCenterY - HEADER_HEIGHT / 2 - HEADER_GRID_GAP
  const gridCenterY = gridTop - gridHeight / 2
  const columnOffset = (itemWidth + COLUMN_GAP) / 2
  const rowStride = ITEM_HEIGHT + ROW_GAP
  const items = Object.freeze(Array.from({ length: 10 }, (_, index) => {
    const column = index % 2
    const row = Math.floor(index / 2)
    return rect(
      column === 0 ? -columnOffset : columnOffset,
      gridTop - ITEM_HEIGHT / 2 - row * rowStride,
      itemWidth,
      ITEM_HEIGHT,
    )
  }))
  const header = rect(0, headerCenterY, gridWidth, HEADER_HEIGHT)
  const grid = rect(0, gridCenterY, gridWidth, gridHeight)
  const closeButton = rect(
    header.centerX + header.width / 2 - 32,
    header.centerY,
    64,
    64,
  )
  const status = rect(0, gridCenterY - gridHeight / 2 - GRID_STATUS_GAP - STATUS_HEIGHT / 2, gridWidth, STATUS_HEIGHT)

  return Object.freeze({
    width: safeWidth,
    height: safeHeight,
    columns: 2 as const,
    itemCornerRadius: 6,
    itemTitleWidth: itemWidth - 132,
    badgeWidth: 76,
    header,
    grid,
    closeButton,
    status,
    items,
  })
}
