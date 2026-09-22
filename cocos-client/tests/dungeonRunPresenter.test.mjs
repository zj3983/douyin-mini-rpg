import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import ts from 'typescript'
import { findCreatorCommand, findCreatorTypeDeclarations } from '../tools/check-cocos-build-readiness.mjs'

const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`

function creatorSemanticDiagnostics(creatorCcPath) {
  const presenterPath = resolve('assets/Scripts/Game/DungeonRunPresenter.ts')
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
  host.resolveModuleNames = (moduleNames, containingFile) => moduleNames.map((moduleName) => {
    if (moduleName === 'cc') return { resolvedFileName: creatorCcPath, extension: ts.Extension.Dts }
    return ts.resolveModuleName(moduleName, containingFile, options, host).resolvedModule
  })
  const program = ts.createProgram([presenterPath], options, host)
  return ts.getPreEmitDiagnostics(program).map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
}

async function loadPresenter() {
  const ccUrl = moduleUrl(`
    export class Renderable2D {}
    export class Component { constructor() { this.node = null } }
    export class JsonAsset {}
    export class Node {
      constructor(name = '') { this.name = name; this.active = true; this.layer = 0; this.children = []; this.components = []; this.listeners = new Map(); this._parent = null; this.position = { x: 0, y: 0, z: 0 }; this.destroyed = false }
      set parent(value) { if (this._parent === value) return; if (this._parent) this._parent.children = this._parent.children.filter((child) => child !== this); this._parent = value; if (value && !value.children.includes(this)) value.children.push(this) }
      get parent() { return this._parent }
      addChild(node) { node.parent = this }
      addComponent(Type) { const component = new Type(); component.node = this; this.components.push(component); return component }
      getComponent(Type) { return this.components.find((component) => component instanceof Type) ?? null }
      getChildByName(name) { return this.children.find((child) => child.name === name) ?? null }
      setPosition(x, y, z = 0) { this.position = { x, y, z } }
      on(eventName, callback, target) { const entries = this.listeners.get(eventName) ?? []; entries.push({ callback, target }); this.listeners.set(eventName, entries) }
      off(eventName, callback, target) { const entries = this.listeners.get(eventName) ?? []; this.listeners.set(eventName, entries.filter((entry) => entry.callback !== callback || entry.target !== target)) }
      emit(eventName, payload) { for (const entry of [...(this.listeners.get(eventName) ?? [])]) entry.callback.call(entry.target, payload) }
      listenerCount(eventName) { return (this.listeners.get(eventName) ?? []).length }
      destroy() { this.destroyed = true; this.active = false; this.listeners.clear(); this.parent = null }
    }
    export class UITransform { constructor() { this.width = 0; this.height = 0; this.anchorX = 0.5; this.anchorY = 0.5 } setContentSize(width, height) { this.width = width; this.height = height } setAnchorPoint(x, y) { this.anchorX = x; this.anchorY = y } }
    export class Label extends Renderable2D { static Overflow = { SHRINK: 2 }; constructor() { super(); this.string = ''; this.fontSize = 0; this.lineHeight = 0; this.color = null; this.overflow = null } }
    export class SpriteFrame {}
    export class Sprite extends Renderable2D { static SizeMode = { CUSTOM: 0 }; constructor() { super(); this.spriteFrame = null; this.sizeMode = Sprite.SizeMode.CUSTOM } }
    export class Graphics extends Renderable2D { constructor() { super(); this.drawCount = 0 } clear() {} roundRect() { this.drawCount += 1 } rect() { this.drawCount += 1 } fill() {} stroke() {} }
    export class Button { static EventType = { CLICK: 'click' }; constructor() { this.interactable = true; this.node = null } click() { if (!this.interactable) return false; this.node.emit(Button.EventType.CLICK); return true } }
    export class Color { constructor(r, g, b, a = 255) { Object.assign(this, { r, g, b, a }) } }
    export const HorizontalTextAlignment = { LEFT: 0, CENTER: 1 }
    export const VerticalTextAlignment = { CENTER: 0 }
    export const Layers = { Enum: { UI_2D: 1 } }
    const storage = new Map()
    export const sys = { localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null },
      setItem(key, value) { storage.set(key, String(value)) },
      removeItem(key) { storage.delete(key) },
      clear() { storage.clear() },
    } }
    export const _decorator = { ccclass: () => (value) => value, property: () => () => undefined }
  `)
  const source = readFileSync(resolve('assets/Scripts/Game/DungeonRunPresenter.ts'), 'utf8')
  let javascript = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, experimentalDecorators: true },
  }).outputText
  javascript = javascript
    .replace("from 'cc'", `from '${ccUrl}'`)
    .replace("from './DungeonLayout.ts'", `from '${new URL('../assets/Scripts/Game/DungeonLayout.ts', import.meta.url).href}'`)
  const presenterModule = await import(moduleUrl(javascript))
  const sessionUrl = pathToFileURL(resolve('assets/Scripts/Core/Dungeon/DungeonSession.ts')).href
  const notificationUrl = pathToFileURL(resolve('assets/Scripts/Core/Progression/BestEffortNotification.ts')).href
  const controllerSource = readFileSync(resolve('assets/Scripts/Game/DungeonRunController.ts'), 'utf8')
  let controllerJavascript = ts.transpileModule(controllerSource, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, experimentalDecorators: true },
  }).outputText
  controllerJavascript = controllerJavascript
    .replace("from 'cc'", `from '${ccUrl}'`)
    .replace("from '../Core/Dungeon/DungeonSession.ts'", `from '${sessionUrl}'`)
    .replace("from '../Core/Progression/BestEffortNotification.ts'", `from '${notificationUrl}'`)
  const controllerUrl = moduleUrl(controllerJavascript)
  const controllerModule = await import(controllerUrl)

  const dualModeSource = readFileSync(resolve('assets/Scripts/Game/DualModeGameController.ts'), 'utf8')
  let dualModeJavascript = ts.transpileModule(dualModeSource, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, experimentalDecorators: true },
  }).outputText
  dualModeJavascript = dualModeJavascript
    .replace("from 'cc'", `from '${ccUrl}'`)
    .replace("from '../Core/Progression/DualModeRuntime.ts'", `from '${pathToFileURL(resolve('assets/Scripts/Core/Progression/DualModeRuntime.ts')).href}'`)
    .replace("from '../Core/Progression/PlayerSave.ts'", `from '${pathToFileURL(resolve('assets/Scripts/Core/Progression/PlayerSave.ts')).href}'`)
    .replace("from '../Core/Progression/SaveRepository.ts'", `from '${pathToFileURL(resolve('assets/Scripts/Core/Progression/SaveRepository.ts')).href}'`)
    .replace("from '../Core/Progression/BestEffortNotification.ts'", `from '${notificationUrl}'`)
    .replace("from './DungeonRunController'", `from '${controllerUrl}'`)
  const dualModeModule = await import(moduleUrl(dualModeJavascript))
  return { ...presenterModule, ...controllerModule, ...dualModeModule, ...await import(ccUrl) }
}

function createHarness(api, options = {}) {
  const root = new api.Node('DungeonPresenterRoot')
  const actor = new api.Node('SharedActorLayer')
  const effect = new api.Node('SharedEffectLayer')
  const drop = new api.Node('SharedDropLayer')
  const input = new api.Node('SharedInputLayer')
  const player = new api.Node('Player')
  player.setPosition(120, 40, 0)
  actor.addChild(player)
  const controllerCalls = []
  const acknowledgeCalls = []
  const acknowledgeResults = [...(options.acknowledgeResults ?? [true])]
  const controller = options.controller ?? {
    setMapOverlayOpen(open) { controllerCalls.push(open) },
    acknowledgeTerminalResult() {
      acknowledgeCalls.push(true)
      return acknowledgeResults.shift() ?? false
    },
  }
  const presenter = new api.DungeonRunPresenter()
  presenter.node = root
  presenter.sharedActorLayer = actor
  presenter.sharedEffectLayer = effect
  presenter.sharedDropLayer = drop
  presenter.sharedInputLayer = input
  presenter.playerTarget = player
  presenter.pickupCapacity = options.pickupCapacity ?? 3
  presenter.toastCapacity = options.toastCapacity ?? 2
  const sharedPauseCalls = []
  presenter.onSharedCombatPauseChanged = (paused) => sharedPauseCalls.push(paused)
  presenter.bindController(controller)
  if (options.viewportBeforeLoad) presenter.configureViewport(options.viewportBeforeLoad)
  presenter.onLoad()
  if (!options.viewportBeforeLoad) {
    presenter.configureViewport(options.viewport ?? { cssWidth: 390, cssHeight: 844, topInsetPx: 47, bottomInsetPx: 34, leftInsetPx: 0, rightInsetPx: 0 })
  }
  return { presenter, root, actor, effect, drop, input, player, controllerCalls, acknowledgeCalls, sharedPauseCalls }
}

function label(api, node, childName) {
  return node.getChildByName(childName).getComponent(api.Label)
}

const creatorCommand = process.env.COCOS_CREATOR_PATH ?? findCreatorCommand()
const creatorCcPath = findCreatorTypeDeclarations(creatorCommand)

test('dungeon presenter passes Cocos Creator 3.8.8 semantic compilation', {
  skip: creatorCcPath ? false : 'Cocos Creator declarations are not installed',
}, () => {
  assert.deepEqual(creatorSemanticDiagnostics(creatorCcPath), [])
})

test('deferred onLoad preserves viewport metrics configured while the dungeon root is inactive', async () => {
  const api = await loadPresenter()
  const viewport = { cssWidth: 844, cssHeight: 390, topInsetPx: 0, bottomInsetPx: 20, leftInsetPx: 0, rightInsetPx: 0 }
  const { presenter } = createHarness(api, { viewportBeforeLoad: viewport })
  const layout = presenter.getLayoutSnapshot()
  assert.ok(Math.abs(layout.physicalScale - 390 / 1334) < 0.000001)
  assert.ok(layout.width > 2800)
})

test('presenter builds visible Cocos HUD, controls, and safe-area layout instead of empty nodes', async () => {
  const api = await loadPresenter()
  const { presenter, root } = createHarness(api)
  for (const name of api.DUNGEON_NODE_NAMES) {
    const node = root.getChildByName(name)
    assert.ok(node, name)
    assert.ok(node.getComponent(api.UITransform), `${name}: transform`)
  }
  const hud = root.getChildByName('DungeonHud')
  assert.equal(hud.children.filter((node) => node.getComponent(api.Label)).length, 4)
  presenter.presentHud({ health: 88, floor: 2, pressure: 121, carriedLootCount: 6, attack: 999, realm: 'ignored' })
  assert.equal(label(api, hud, 'DungeonHealthLabel').string, '生命 88')
  assert.equal(label(api, hud, 'DungeonFloorLabel').string, '第2层')
  assert.equal(label(api, hud, 'DungeonPressureLabel').string, '压力 121')
  assert.equal(label(api, hud, 'DungeonLootLabel').string, '携带 6')
  assert.equal(hud.children.some((node) => node.getComponent(api.Label)?.string.includes('999')), false)

  const layout = presenter.getLayoutSnapshot()
  const settlementTransform = root.getChildByName('DungeonSettlement').getComponent(api.UITransform)
  assert.ok(settlementTransform.height <= layout.safeRect.height * 0.7 + 0.001)
  for (const name of ['DungeonMapButton', 'DungeonMapCloseButton', 'DungeonSettlementCloseButton']) {
    const node = name === 'DungeonMapButton'
      ? root.getChildByName(name)
      : name === 'DungeonMapCloseButton'
        ? root.getChildByName('DungeonMapOverlay').getChildByName(name)
        : root.getChildByName('DungeonSettlement').getChildByName(name)
    const transform = node.getComponent(api.UITransform)
    assert.ok(transform.width * layout.physicalScale >= 44, `${name}: width`)
    assert.ok(transform.height * layout.physicalScale >= 44, `${name}: height`)
    assert.ok(node.getComponent(api.Button), `${name}: button`)
  }
  for (const [parentName, childName] of [
    ['DungeonMapButton', 'DungeonMapButtonLabel'],
    ['DungeonInteractionHint', 'DungeonInteractionLabel'],
    ['DungeonPursuitWarning', 'DungeonPursuitWarningLabel'],
    ['DungeonFinalBossBar', 'DungeonFinalBossLabel'],
  ]) {
    const transform = root.getChildByName(parentName).getChildByName(childName).getComponent(api.UITransform)
    assert.ok(transform.width > 0 && transform.height > 0, `${childName}: visible content size`)
  }
})

test('map buttons toggle the real overlay and controller pause, then unbind on destroy', async () => {
  const api = await loadPresenter()
  const { presenter, root, input, controllerCalls, sharedPauseCalls } = createHarness(api)
  const mapButton = root.getChildByName('DungeonMapButton')
  const overlay = root.getChildByName('DungeonMapOverlay')
  const closeButton = overlay.getChildByName('DungeonMapCloseButton')
  assert.equal(overlay.active, false)
  mapButton.getComponent(api.Button).click()
  assert.equal(overlay.active, true)
  assert.equal(input.active, false)
  assert.deepEqual(controllerCalls, [true])
  assert.deepEqual(sharedPauseCalls, [true])
  closeButton.getComponent(api.Button).click()
  assert.equal(overlay.active, false)
  assert.equal(input.active, true)
  assert.deepEqual(controllerCalls, [true, false])
  assert.deepEqual(sharedPauseCalls, [true, false])
  mapButton.getComponent(api.Button).click()
  assert.equal(input.active, false)
  presenter.onDestroy()
  assert.equal(input.active, true)
  assert.deepEqual(sharedPauseCalls, [true, false, true, false])
  assert.equal(mapButton.listenerCount(api.Button.EventType.CLICK), 0)
  assert.equal(closeButton.listenerCount(api.Button.EventType.CLICK), 0)
})

test('dungeon command bar sends explicit search, door, altar, and extraction commands', async () => {
  const api = await loadPresenter()
  const { presenter, root } = createHarness(api)
  const commands = []
  presenter.onCommandRequested = (command) => commands.push(command)
  presenter.setAvailableExit(null)

  const bar = root.getChildByName('DungeonCommandBar')
  const search = bar.getChildByName('DungeonSearchButton')
  const door = bar.getChildByName('DungeonDoorButton')
  const altar = bar.getChildByName('DungeonAltarButton')
  const extraction = bar.getChildByName('DungeonExtractionButton')
  assert.equal(door.active, false)

  search.getComponent(api.Button).click()
  altar.getComponent(api.Button).click()
  extraction.getComponent(api.Button).click()
  presenter.setAvailableExit('f1-entry-to-forest')
  assert.equal(door.active, true)
  door.getComponent(api.Button).click()

  assert.deepEqual(commands, [
    { type: 'search' },
    { type: 'activate-altar' },
    { type: 'begin-extraction' },
    { type: 'choose-exit', exitId: 'f1-entry-to-forest' },
  ])
  presenter.onDestroy()
  assert.equal(search.listenerCount(api.Button.EventType.CLICK), 0)
  assert.equal(door.listenerCount(api.Button.EventType.CLICK), 0)
  assert.equal(altar.listenerCount(api.Button.EventType.CLICK), 0)
  assert.equal(extraction.listenerCount(api.Button.EventType.CLICK), 0)
})

test('SharedDropLayer owns a bounded moving pickup node pool that recycles nodes', async () => {
  const api = await loadPresenter()
  const { presenter, drop, player } = createHarness(api, { pickupCapacity: 3 })
  presenter.presentRunEvent({ type: 'room-searched', roomId: 'cache', doorCurrencyGranted: 0, loot: [{ itemId: 'mist-herb', amount: 5 }] }, { x: -120, y: -40 })
  assert.equal(drop.children.length, 3)
  assert.equal(drop.children.filter((node) => node.active).length, 3)
  assert.equal(drop.children.every((node) => node.getComponent(api.Graphics)?.drawCount > 0), true)
  const first = drop.children[0]
  const before = { ...first.position }
  presenter.update(0.1)
  assert.ok(first.position.x > before.x)
  assert.ok(first.position.y > before.y)
  for (let index = 0; index < 120; index += 1) presenter.update(0.1)
  assert.equal(drop.children.filter((node) => node.active).length, 0)
  presenter.presentRunEvent({ type: 'room-searched', roomId: 'next', doorCurrencyGranted: 0, loot: [{ itemId: 'ore', amount: 1 }] }, { x: 0, y: 0 })
  assert.equal(drop.children.length, 3)
  assert.equal(drop.children.filter((node) => node.active).length, 1)
  assert.equal(drop.children.find((node) => node.active), first)
  assert.equal(player.position.x, 120)
})

test('equipment toasts are visible, bounded, timed, and reuse their nodes', async () => {
  const api = await loadPresenter()
  const { presenter, root } = createHarness(api, { toastCapacity: 2 })
  presenter.presentRunEvent({ type: 'room-searched', roomId: 'cache', doorCurrencyGranted: 0, loot: [
    { itemId: 'flying-sword', amount: 1 },
    { itemId: 'jade-guard', amount: 1 },
    { itemId: 'thunder-seal', amount: 1 },
  ] })
  const toastLayer = root.getChildByName('DungeonToastLayer')
  assert.equal(toastLayer.children.length, 2)
  assert.equal(toastLayer.children.filter((node) => node.active).length, 2)
  for (const toast of toastLayer.children) {
    const text = toast.getChildByName('DungeonToastLabel').getComponent(api.Label).string
    assert.match(text, /图标/)
    assert.match(text, /(史诗|传说|玄品|灵品)/)
    assert.ok(text.length > 6)
  }
  const first = toastLayer.children[0]
  presenter.update(2)
  assert.equal(toastLayer.children.filter((node) => node.active).length, 0)
  presenter.presentRunEvent({ type: 'room-searched', roomId: 'again', doorCurrencyGranted: 0, loot: [{ itemId: 'spirit-vessel', amount: 1 }] })
  assert.equal(toastLayer.children.length, 2)
  assert.equal(toastLayer.children.find((node) => node.active), first)
})

test('pursuit warning precedes the final Boss bar and settlement closes only by button', async () => {
  const api = await loadPresenter()
  const { presenter, root, acknowledgeCalls } = createHarness(api, { acknowledgeResults: [false, true] })
  const warning = root.getChildByName('DungeonPursuitWarning')
  const bossBar = root.getChildByName('DungeonFinalBossBar')
  presenter.presentRunEvent({ type: 'pursuer-hunt-started', hunt: 1 })
  assert.equal(warning.active, true)
  assert.equal(bossBar.active, false)
  presenter.presentRunEvent({ type: 'altar-activated', roomId: 'f3-altar' })
  assert.equal(warning.active, false)
  assert.equal(bossBar.active, true)

  presenter.presentRunEvent({ type: 'extraction-completed', exitKind: 'damaged', explorationRate: 0.625, bossDefeated: false, loot: [], retainedLoot: [] })
  const settlement = root.getChildByName('DungeonSettlement')
  const body = label(api, settlement, 'DungeonSettlementBody').string
  assert.equal(settlement.active, true)
  assert.match(body, /受损撤离/)
  assert.match(body, /63%/)
  assert.match(body, /Boss 未击败/)
  presenter.update(10)
  assert.equal(settlement.active, true)
  settlement.getChildByName('DungeonSettlementCloseButton').getComponent(api.Button).click()
  assert.equal(settlement.active, true)
  assert.equal(acknowledgeCalls.length, 1)
  settlement.getChildByName('DungeonSettlementCloseButton').getComponent(api.Button).click()
  assert.equal(settlement.active, false)
  assert.equal(acknowledgeCalls.length, 2)
})

test('defeat and abandon events use manual terminal settlement states', async () => {
  const api = await loadPresenter()
  const { presenter, root } = createHarness(api, { acknowledgeResults: [false] })
  const settlement = root.getChildByName('DungeonSettlement')
  presenter.presentRunEvent({ type: 'dungeon-defeated', retainedLoot: [{ itemId: 'ore', amount: 1 }] })
  assert.equal(settlement.active, true)
  assert.match(label(api, settlement, 'DungeonSettlementTitle').string, /战败/)
  presenter.presentRunEvent({ type: 'dungeon-abandoned', retainedLoot: [] })
  assert.match(label(api, settlement, 'DungeonSettlementTitle').string, /放弃/)
  presenter.update(30)
  assert.equal(settlement.active, true)
})

test('controller, presenter, and DualMode keep terminal checkpoint until manual settlement acknowledgement', async () => {
  const api = await loadPresenter()
  api.sys.localStorage.clear()
  const run = new api.DungeonRunController()
  run.profileData = { json: JSON.parse(readFileSync(resolve('assets/resources/Data/dual-mode-slice.json'), 'utf8')) }
  const worldRoot = new api.Node('WorldRoot')
  const dungeonRoot = new api.Node('DungeonRoot')
  const dualMode = new api.DualModeGameController()
  dualMode.node = new api.Node('DualMode')
  dualMode.worldRoot = worldRoot
  dualMode.dungeonRoot = dungeonRoot
  dualMode.dungeonRun = run
  dualMode.onLoad()
  assert.equal(dualMode.enterDungeon(77), true)

  const { presenter, root } = createHarness(api, { controller: run })
  run.onRunEvent = (event) => presenter.presentRunEvent(event)
  for (const exitId of ['f1-entry-to-forest', 'f1-forest-to-floor2', 'f2-bridge-to-exit']) {
    assert.equal(run.applyCommand({ type: 'choose-exit', exitId }).accepted, true)
  }
  assert.equal(run.applyCommand({ type: 'begin-extraction' }).accepted, true)
  for (let index = 0; index < 40; index += 1) run.update(0.1)

  const settlement = root.getChildByName('DungeonSettlement')
  assert.equal(settlement.active, true)
  assert.equal(worldRoot.active, false)
  assert.equal(dungeonRoot.active, true)
  assert.equal(dualMode.getSaveSnapshot().dungeon.activeRun.checkpoint.phase, 'extracted')
  settlement.getChildByName('DungeonSettlementCloseButton').getComponent(api.Button).click()
  assert.equal(settlement.active, false)
  assert.equal(worldRoot.active, true)
  assert.equal(dungeonRoot.active, false)
  assert.equal(dualMode.getSaveSnapshot().dungeon.activeRun, null)
  assert.equal(run.hasRun(), false)
})
