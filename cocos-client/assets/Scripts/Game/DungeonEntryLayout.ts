import { BATTLE_NAVIGATION_HEIGHT } from '../Combat/BattleLayout.ts'

export interface DungeonEntryNavLayout {
  readonly navigation: Readonly<{ centerY: number; minY: number; maxY: number }>
  readonly label: Readonly<{ centerY: number; minY: number; maxY: number; height: number }>
  readonly status: Readonly<{ centerY: number; minY: number; maxY: number; height: number }>
}

const LABEL_HEIGHT = 44
const STATUS_HEIGHT = 24
const TRACK_PADDING = 8

export function computeDungeonEntryNavLayout(navigationTop: number): Readonly<DungeonEntryNavLayout> {
  const safeNavigationTop = Number.isFinite(navigationTop) ? navigationTop : 0
  const navigation = Object.freeze({
    centerY: safeNavigationTop - BATTLE_NAVIGATION_HEIGHT / 2,
    minY: safeNavigationTop - BATTLE_NAVIGATION_HEIGHT,
    maxY: safeNavigationTop,
  })
  const labelMinY = navigation.minY + TRACK_PADDING
  const label = Object.freeze({
    centerY: labelMinY + LABEL_HEIGHT / 2,
    minY: labelMinY,
    maxY: labelMinY + LABEL_HEIGHT,
    height: LABEL_HEIGHT,
  })
  const statusMaxY = navigation.maxY - TRACK_PADDING
  const status = Object.freeze({
    centerY: statusMaxY - STATUS_HEIGHT / 2,
    minY: statusMaxY - STATUS_HEIGHT,
    maxY: statusMaxY,
    height: STATUS_HEIGHT,
  })
  return Object.freeze({ navigation, label, status })
}
