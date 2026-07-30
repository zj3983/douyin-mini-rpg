import {
  selectWorldStage,
  type WorldEncounterKind,
  type WorldRegion,
  type WorldStageSelection,
} from '../Core/World/WorldRegion.ts'

export interface WorldStageSelectionItem {
  readonly stageId: number
  readonly encounter: WorldEncounterKind
  readonly label: string
  readonly interactable: boolean
}

export interface WorldStageButtonBinding {
  interactable: boolean
}

export interface WorldStageLabelBinding {
  string: string
}

export type WorldStageSelectionNotification =
  | {
    readonly eventName: 'world-stage-selected'
    readonly payload: Readonly<{ stageId: number }>
    readonly accepted: true
  }
  | {
    readonly eventName: 'world-stage-selection-rejected'
    readonly payload: Readonly<{ stageId: number; reason: 'locked-stage' | 'unknown-stage' }>
    readonly accepted: false
  }

export function createWorldStageSelectionViewModel(
  region: WorldRegion,
  highestClearedStage: number,
): readonly Readonly<WorldStageSelectionItem>[] {
  return Object.freeze(region.stages.map((stage) => Object.freeze({
    stageId: stage.id,
    encounter: stage.encounter,
    label: `第${stage.id}关 [${stage.encounter}]`,
    interactable: selectWorldStage(region, highestClearedStage, stage.id).ok,
  })))
}

export function renderWorldStageSelectionViewModel(
  viewModel: readonly Readonly<WorldStageSelectionItem>[],
  buttons: readonly (WorldStageButtonBinding | null | undefined)[],
  labels: readonly (WorldStageLabelBinding | null | undefined)[],
) {
  const bindingCount = Math.max(viewModel.length, buttons.length, labels.length)
  for (let index = 0; index < bindingCount; index += 1) {
    const item = viewModel[index]
    const button = buttons[index]
    const label = labels[index]
    if (button) button.interactable = item?.interactable ?? false
    if (label) label.string = item?.label ?? ''
  }
}

export function createWorldStageSelectionNotification(
  selection: WorldStageSelection,
  requestedStageId: number,
): WorldStageSelectionNotification {
  if (selection.ok) {
    return Object.freeze({
      eventName: 'world-stage-selected',
      payload: Object.freeze({ stageId: selection.stageId }),
      accepted: true,
    })
  }
  return Object.freeze({
    eventName: 'world-stage-selection-rejected',
    payload: Object.freeze({ stageId: requestedStageId, reason: selection.reason }),
    accepted: false,
  })
}
