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

@ccclass('WorldStageSelectController')
export class WorldStageSelectController extends Component {
  private selectionContext: WorldStageSelectionContext | null = null

  bind(
    stages: readonly WorldRegionStage[],
    highestClearedStage: number,
    buttons: readonly (Button | null | undefined)[],
    labels: readonly (Label | null | undefined)[],
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
