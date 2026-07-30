import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  createWorldStageSelectionNotification,
  createWorldStageSelectionViewModel,
  renderWorldStageSelectionViewModel,
} from '../assets/Scripts/Game/WorldStageSelectionViewModel.ts'
import {
  createWorldRegion,
  selectWorldStage,
} from '../assets/Scripts/Core/World/WorldRegion.ts'

function validStages() {
  return Array.from({ length: 10 }, (_, index) => {
    const id = index + 1
    return {
      id,
      encounter: id === 10 ? 'region-boss' : [4, 7].includes(id) ? 'elite' : 'normal',
    }
  })
}

function validRegion() {
  return createWorldRegion('mist-frontier', validStages())
}

function readSource(file) {
  return readFileSync(resolve(file), 'utf8')
}

test('view model renders all encounter kinds and delegates unlocking to Core', () => {
  const view = createWorldStageSelectionViewModel(validRegion(), 3)

  assert.equal(view.length, 10)
  assert.deepEqual(
    view.map(({ stageId, encounter, interactable }) => ({ stageId, encounter, interactable })),
    [
      { stageId: 1, encounter: 'normal', interactable: true },
      { stageId: 2, encounter: 'normal', interactable: true },
      { stageId: 3, encounter: 'normal', interactable: true },
      { stageId: 4, encounter: 'elite', interactable: true },
      { stageId: 5, encounter: 'normal', interactable: false },
      { stageId: 6, encounter: 'normal', interactable: false },
      { stageId: 7, encounter: 'elite', interactable: false },
      { stageId: 8, encounter: 'normal', interactable: false },
      { stageId: 9, encounter: 'normal', interactable: false },
      { stageId: 10, encounter: 'region-boss', interactable: false },
    ],
  )
  for (const item of view) {
    assert.match(item.label, new RegExp(`第${item.stageId}关`))
    assert.match(item.label, new RegExp(item.encounter))
  }
})

test('view model preserves Core numeric boundary behavior', () => {
  const region = validRegion()

  for (const progress of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
    const view = createWorldStageSelectionViewModel(region, progress)
    assert.deepEqual(view.map((item) => item.interactable), [true, false, false, false, false, false, false, false, false, false])
  }
  assert.equal(createWorldStageSelectionViewModel(region, 99).every((item) => item.interactable), true)
})

test('selection notification describes accepted, locked, and unknown Core results', () => {
  const region = validRegion()

  assert.deepEqual(
    createWorldStageSelectionNotification(selectWorldStage(region, 3, 4), 4),
    { eventName: 'world-stage-selected', payload: { stageId: 4 }, accepted: true },
  )
  assert.deepEqual(
    createWorldStageSelectionNotification(selectWorldStage(region, 3, 5), 5),
    { eventName: 'world-stage-selection-rejected', payload: { stageId: 5, reason: 'locked-stage' }, accepted: false },
  )
  assert.deepEqual(
    createWorldStageSelectionNotification(selectWorldStage(region, 10, 11), 11),
    { eventName: 'world-stage-selection-rejected', payload: { stageId: 11, reason: 'unknown-stage' }, accepted: false },
  )
})

test('rendering tolerates uneven bindings and repeated calls clear stale state', () => {
  const view = createWorldStageSelectionViewModel(validRegion(), 3)
  const buttons = Array.from({ length: 11 }, () => ({ interactable: true }))
  const labels = Array.from({ length: 11 }, () => ({ string: 'stale' }))

  assert.doesNotThrow(() => renderWorldStageSelectionViewModel(view, buttons.slice(0, 2), labels.slice(0, 1)))
  assert.deepEqual(buttons.slice(0, 2).map((button) => button.interactable), [true, true])
  assert.match(labels[0].string, /第1关/)

  renderWorldStageSelectionViewModel(view, buttons, labels)
  assert.equal(buttons[10].interactable, false)
  assert.equal(labels[10].string, '')

  renderWorldStageSelectionViewModel([], buttons, labels)
  assert.equal(buttons.every((button) => button.interactable === false), true)
  assert.equal(labels.every((label) => label.string === ''), true)
})

test('world stage controller is a read-only Cocos adapter with resilient binding', () => {
  const source = readSource('assets/Scripts/Game/WorldStageSelectController.ts')

  assert.match(source, /from '\.\.\/Core\/World\/WorldRegion\.ts'/)
  assert.match(source, /createWorldRegion\(/)
  assert.match(source, /selectWorldStage\(/)
  assert.match(source, /bind\(\s*stages:/)
  assert.match(source, /try\s*\{[\s\S]*createWorldRegion[\s\S]*\}\s*catch\s*\{/)
  assert.match(source, /renderWorldStageSelectionViewModel\(viewModel, buttons, labels\)/)
  assert.doesNotMatch(source, /Button\.EventType\.CLICK|\.node\.on\(|\.node\.off\(/)

  assert.match(source, /this\.node\.emit\(notification\.eventName, notification\.payload\)/)
  assert.match(source, /return notification\.accepted/)
  assert.doesNotMatch(source, /localStorage|SaveRepository|rewardLedger|BattleRuntimeController/)
  assert.doesNotMatch(source, /highestClearedStage\s*=/)
  assert.doesNotMatch(source, /\.active\s*=|hide\(|close\(/)
})

test('dual mode controller exposes only the scalar world progress value', () => {
  const source = readSource('assets/Scripts/Game/DualModeGameController.ts')
  const getter = source.match(/getHighestClearedWorldStage\(\): number\s*\{([\s\S]*?)\n  \}/)?.[1] ?? ''

  assert.notEqual(getter, '')
  assert.match(getter, /const save = this\.runtime\?\.getSaveSnapshot\(\) \?\? createDefaultSave\(\)/)
  assert.match(getter, /return save\.world\.highestClearedStage/)
  assert.doesNotMatch(getter, /return save\b(?!\.world\.highestClearedStage)/)
})
