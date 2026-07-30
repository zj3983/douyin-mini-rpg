import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
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

const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`

async function loadController() {
  const ccUrl = moduleUrl(`
    export class Component { constructor() { this.node = { emit() {} } } }
    export class Button { constructor() { this.interactable = true } }
    export class Label { constructor() { this.string = '' } }
    export const _decorator = { ccclass: () => (value) => value }
  `)
  const source = readSource('assets/Scripts/Game/WorldStageSelectController.ts')
  let javascript = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      experimentalDecorators: true,
      strictNullChecks: false,
    },
  }).outputText
  javascript = javascript
    .replace("from 'cc'", `from '${ccUrl}'`)
    .replace(
      "from '../Core/World/WorldRegion.ts'",
      `from '${pathToFileURL(resolve('assets/Scripts/Core/World/WorldRegion.ts')).href}'`,
    )
    .replace(
      "from './WorldStageSelectionViewModel.ts'",
      `from '${pathToFileURL(resolve('assets/Scripts/Game/WorldStageSelectionViewModel.ts')).href}'`,
    )
  return {
    ...await import(moduleUrl(javascript)),
    ...await import(ccUrl),
  }
}

function cocosSemanticDiagnostics() {
  const controllerPath = resolve('assets/Scripts/Game/WorldStageSelectController.ts')
  const ccDeclarationPath = resolve('tests/.virtual/cc.d.ts')
  const ccDeclaration = `
    export const _decorator: {
      ccclass(name: string): <T extends Function>(target: T) => T | void
    }
    export class Node { emit(eventName: string, payload?: unknown): void }
    export class Component { node: Node }
    export class Button { interactable: boolean }
    export class Label { string: string }
  `
  const options = {
    allowImportingTsExtensions: true,
    experimentalDecorators: true,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    skipLibCheck: true,
    strict: false,
    strictNullChecks: false,
    target: ts.ScriptTarget.ES2022,
  }
  const host = ts.createCompilerHost(options)
  const normalizedCcPath = ccDeclarationPath.replaceAll('\\', '/')
  const isCcDeclaration = (path) => path.replaceAll('\\', '/') === normalizedCcPath
  const getSourceFile = host.getSourceFile.bind(host)
  host.fileExists = (path) => isCcDeclaration(path) || ts.sys.fileExists(path)
  host.readFile = (path) => isCcDeclaration(path) ? ccDeclaration : ts.sys.readFile(path)
  host.getSourceFile = (path, languageVersion, onError, shouldCreateNewSourceFile) => isCcDeclaration(path)
    ? ts.createSourceFile(path, ccDeclaration, languageVersion, true)
    : getSourceFile(path, languageVersion, onError, shouldCreateNewSourceFile)
  host.resolveModuleNames = (moduleNames, containingFile) => moduleNames.map((moduleName) => {
    if (moduleName === 'cc') {
      return { resolvedFileName: ccDeclarationPath, extension: ts.Extension.Dts }
    }
    return ts.resolveModuleName(moduleName, containingFile, options, host).resolvedModule
  })

  const program = ts.createProgram([controllerPath], options, host)
  return ts.getPreEmitDiagnostics(program).map((diagnostic) => {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    if (!diagnostic.file || diagnostic.start === undefined) return message
    const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
    return `${diagnostic.file.fileName}:${position.line + 1}:${position.character + 1} ${message}`
  })
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

test('world stage controller compiles with Cocos strictNullChecks disabled', () => {
  assert.deepEqual(cocosSemanticDiagnostics(), [])
})

test('unbound controller selection is silent and returns false', async () => {
  const { WorldStageSelectController } = await loadController()
  const controller = new WorldStageSelectController()
  const emitted = []
  controller.node = { emit: (eventName, payload) => emitted.push({ eventName, payload }) }

  assert.equal(controller.select(1), false)
  assert.deepEqual(emitted, [])
})

test('controller bind and select execute against Core with exact event payloads', async () => {
  const { Button, Label, WorldStageSelectController } = await loadController()
  const controller = new WorldStageSelectController()
  const emitted = []
  controller.node = { emit: (eventName, payload) => emitted.push({ eventName, payload }) }
  const buttons = Array.from({ length: 10 }, () => new Button())
  const labels = Array.from({ length: 10 }, () => new Label())

  controller.bind(validStages(), 3, buttons, labels)
  assert.deepEqual(buttons.map((button) => button.interactable), [true, true, true, true, false, false, false, false, false, false])
  assert.equal(labels.every((label, index) => label.string.includes(`第${index + 1}关`)), true)
  assert.equal(controller.select(4), true)
  assert.equal(controller.select(5), false)
  assert.equal(controller.select(11), false)
  assert.deepEqual(emitted, [
    { eventName: 'world-stage-selected', payload: { stageId: 4 } },
    { eventName: 'world-stage-selection-rejected', payload: { stageId: 5, reason: 'locked-stage' } },
    { eventName: 'world-stage-selection-rejected', payload: { stageId: 11, reason: 'unknown-stage' } },
  ])
})

test('controller tolerates short bindings and repeat bind resets authority and stale views', async () => {
  const { Button, Label, WorldStageSelectController } = await loadController()
  const controller = new WorldStageSelectController()
  const emitted = []
  controller.node = { emit: (eventName, payload) => emitted.push({ eventName, payload }) }
  const buttons = Array.from({ length: 10 }, () => new Button())
  const labels = Array.from({ length: 10 }, () => new Label())

  assert.doesNotThrow(() => controller.bind(validStages(), 10, buttons.slice(0, 2), labels.slice(0, 1)))
  assert.deepEqual(buttons.slice(0, 2).map((button) => button.interactable), [true, true])
  assert.match(labels[0].string, /第1关/)

  controller.bind(validStages(), 0, buttons, labels)
  assert.deepEqual(buttons.map((button) => button.interactable), [true, false, false, false, false, false, false, false, false, false])
  assert.equal(controller.select(1), true)
  assert.deepEqual(emitted, [{ eventName: 'world-stage-selected', payload: { stageId: 1 } }])
  assert.doesNotThrow(() => controller.bind(validStages().slice(0, 9), 10, buttons, labels))
  assert.equal(buttons.every((button) => button.interactable === false), true)
  assert.equal(labels.every((label) => label.string === ''), true)
  assert.equal(controller.select(1), false)
  assert.equal(emitted.length, 1)
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
