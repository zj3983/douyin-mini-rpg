import { _decorator, Button, Component, Label } from 'cc'
import {
  createWorldRegion,
  selectWorldStage,
  type WorldRegion,
  type WorldRegionStage,
  type WorldStageSelection,
} from '../Core/World/WorldRegion.ts'
import {
  createWorldStageSelectionNotification,
  createWorldStageSelectionViewModel,
  renderWorldStageSelectionViewModel,
} from './WorldStageSelectionViewModel.ts'

const { ccclass } = _decorator

interface WorldStageSelectionContext {
  readonly region: WorldRegion
  readonly progress: number
}

interface DisplayWorldStage extends WorldRegionStage {
  readonly name?: string
}

@ccclass('WorldStageSelectController')
export class WorldStageSelectController extends Component {
  private selectionContext: WorldStageSelectionContext | null = null

  bind(
    stages: readonly DisplayWorldStage[],
    highestClearedStage: number,
    buttons: readonly (Button | null | undefined)[],
    labels: readonly (Label | null | undefined)[],
    badges: readonly (Label | null | undefined)[] = [],
    locks: readonly (Label | null | undefined)[] = [],
  ) {
    let region: WorldRegion | null = null
    try {
      region = createWorldRegion('bound-world-region', stages)
    } catch {
      region = null
    }

    this.selectionContext = region ? { region, progress: highestClearedStage } : null
    const viewModel = region ? createWorldStageSelectionViewModel(region, highestClearedStage) : []
    renderWorldStageSelectionViewModel(viewModel, buttons, labels)
    const bindingCount = Math.max(stages.length, labels.length, badges.length, locks.length)
    for (let index = 0; index < bindingCount; index += 1) {
      const stage = region ? stages[index] : undefined
      const item = viewModel[index]
      const label = labels[index]
      const badge = badges[index]
      const lock = locks[index]
      if (label) label.string = stage && item ? `第${stage.id}关  ${stage.name?.trim() || `未命名关卡`}` : ''
      if (badge) badge.string = item?.encounter === 'elite'
        ? '精英'
        : item?.encounter === 'region-boss' ? '区域Boss' : ''
      if (lock) lock.string = item && !item.interactable ? '锁定' : ''
    }
  }

  select(stageId: number): boolean {
    if (!this.selectionContext) return false
    const selection: WorldStageSelection = selectWorldStage(
      this.selectionContext.region,
      this.selectionContext.progress,
      stageId,
    )
    const notification = createWorldStageSelectionNotification(selection, stageId)
    this.node.emit(notification.eventName, notification.payload)
    return notification.accepted
  }
}
