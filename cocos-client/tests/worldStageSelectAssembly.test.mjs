import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import ts from 'typescript'
import {
  findCreatorCommand,
  findCreatorTypeDeclarations,
} from '../tools/check-cocos-build-readiness.mjs'
import { createDefaultSave } from '../assets/Scripts/Core/Progression/PlayerSave.ts'
import { stageVisualFor } from '../assets/Scripts/Core/StageVisualCatalog.ts'
import {
  createWorldRegion,
  selectWorldStage,
} from '../assets/Scripts/Core/World/WorldRegion.ts'
import { applyWorldBossClear } from '../assets/Scripts/Core/World/WorldRewards.ts'

const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`

async function loadAssemblerHarness() {
  const ccUrl = moduleUrl(`
    export class Renderable2D {}
    export class Node {
      constructor(name = '') { this.name = name; this.active = true; this.layer = 0; this.listeners = new Map(); this.children = []; this.components = []; this._parent = null; this.position = { x: 0, y: 0, z: 0 } }
      set parent(value) { if (this._parent === value) return; if (this._parent) this._parent.children = this._parent.children.filter((child) => child !== this); this._parent = value; if (value && !value.children.includes(this)) value.children.push(this) }
      get parent() { return this._parent }
      addComponent(Type) {
        const component = new Type()
        if (component instanceof Renderable2D && this.components.some((entry) => entry instanceof Renderable2D)) throw new Error("Can't add renderable component")
        component.node = this
        this.components.push(component)
        return component
      }
      getComponent(Type) { return this.components.find((component) => component instanceof Type) ?? null }
      getChildByName(name) { return this.children.find((child) => child.name === name) ?? null }
      setPosition(x, y, z = 0) { this.position = { x, y, z } }
      on(eventName, callback, target) { const listeners = this.listeners.get(eventName) ?? []; listeners.push({ callback, target }); this.listeners.set(eventName, listeners) }
      off(eventName, callback, target) { const listeners = this.listeners.get(eventName) ?? []; this.listeners.set(eventName, listeners.filter((entry) => entry.callback !== callback || entry.target !== target)) }
      emit(eventName, payload) { for (const entry of [...(this.listeners.get(eventName) ?? [])]) entry.callback.call(entry.target, payload) }
      listenerCount(eventName) { return (this.listeners.get(eventName) ?? []).length }
    }
    export class Component { constructor() { this.node = null } }
    export class Button {
      static EventType = { CLICK: 'click' }
      constructor() { this.interactable = true; this.node = null }
      click() { if (!this.interactable) return false; this.node.emit(Button.EventType.CLICK); return true }
    }
    export class Label extends Renderable2D { static Overflow = { SHRINK: 2 }; constructor() { super(); this.string = ''; this.fontSize = 0; this.lineHeight = 0; this.color = null } }
    export class Color { constructor(r, g, b, a) { Object.assign(this, { r, g, b, a }) } }
    export class Graphics extends Renderable2D { clear() {} roundRect() {} fill() {} stroke() {} rect() {} circle() {} }
    export class UITransform { constructor() { this.width = 0; this.height = 0; this.anchorX = 0.5; this.anchorY = 0.5 } setContentSize(width, height) { this.width = width; this.height = height } setAnchorPoint(x, y) { this.anchorX = x; this.anchorY = y } }
    export class Mask extends Renderable2D {
      static Type = { GRAPHICS_RECT: 0, GRAPHICS_ELLIPSE: 1, GRAPHICS_STENCIL: 2, SPRITE_STENCIL: 3 }
      constructor() { super(); this.type = Mask.Type.GRAPHICS_RECT }
    }
    export class ScrollView { constructor() { this.content = null; this.horizontal = true; this.vertical = true; this.elastic = true; this.inertia = true } }
    export const HorizontalTextAlignment = { LEFT: 0, CENTER: 1 }
    export const Layers = { Enum: { UI_2D: 1 } }
    export const VerticalTextAlignment = { CENTER: 0 }
  `)
  const controllerUrl = moduleUrl(`
    import { Component } from '${ccUrl}'
    export class WorldStageSelectController extends Component {
      bind(stages, highest, buttons, labels, badges, locks) {
        this.buttons = buttons
        buttons.forEach((button, index) => { button.interactable = index <= highest })
        this.selectable = buttons.map((button) => button.interactable)
        labels.forEach((label, index) => { label.string = stages[index] ? '第' + stages[index].id + '关 ' + stages[index].name : '' })
        badges.forEach((badge, index) => { badge.string = stages[index]?.encounter === 'elite' ? '精英' : stages[index]?.encounter === 'region-boss' ? '区域Boss' : '' })
        locks.forEach((lock, index) => { lock.string = buttons[index]?.interactable ? '' : '锁定' })
      }
      select(stageId) {
        if (!this.selectable?.[stageId - 1]) { this.node.emit('world-stage-selection-rejected', { stageId, reason: 'locked-stage' }); return false }
        this.node.emit('world-stage-selected', { stageId }); return true
      }
    }
  `)
  const source = readFileSync(resolve('assets/Scripts/Game/WorldStageSelectPageAssembler.ts'), 'utf8')
  let javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  javascript = javascript
    .replace("from 'cc'", `from '${ccUrl}'`)
    .replace("from './WorldStageSelectController'", `from '${controllerUrl}'`)
    .replace("from './WorldStageSelectLayout.ts'", `from '${new URL('../assets/Scripts/Game/WorldStageSelectLayout.ts', import.meta.url).href}'`)
  return { ...await import(moduleUrl(javascript)), ...await import(ccUrl) }
}

function creatorSemanticDiagnostics(creatorCcPath) {
  const assemblerPath = resolve('assets/Scripts/Game/WorldStageSelectPageAssembler.ts')
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
  const program = ts.createProgram([assemblerPath], options, host)
  return ts.getPreEmitDiagnostics(program).map((diagnostic) => {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    if (!diagnostic.file || diagnostic.start === undefined) return message
    const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
    return `${diagnostic.file.fileName}:${position.line + 1}:${position.character + 1} ${message}`
  })
}

test('Creator declarations are derived from a discovered non-default installation', () => {
  const root = mkdtempSync(join(tmpdir(), 'creator-custom-install-'))
  try {
    const creatorCommand = join(root, 'custom', 'Creator', 'CocosCreator.exe')
    const declarationPath = join(root, 'custom', 'Creator', 'resources', 'resources', '3d', 'engine', 'bin', '.declarations', 'cc.d.ts')
    mkdirSync(dirname(creatorCommand), { recursive: true })
    mkdirSync(dirname(declarationPath), { recursive: true })
    writeFileSync(creatorCommand, '')
    writeFileSync(declarationPath, 'export declare const version: string')

    assert.equal(findCreatorCommand([creatorCommand]), creatorCommand)
    assert.equal(findCreatorTypeDeclarations(creatorCommand), declarationPath)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

const creatorCommand = process.env.COCOS_CREATOR_PATH ?? findCreatorCommand()
const creatorCcPath = findCreatorTypeDeclarations(creatorCommand)

test('world stage assembler passes Creator 3.8.8 semantic compilation', {
  skip: creatorCcPath ? false : 'Cocos Creator declarations are not installed',
}, () => {
  assert.deepEqual(creatorSemanticDiagnostics(creatorCcPath), [])
})

test('real world stage assembler builds scroll hierarchy and routes selection safely', async () => {
  const { Button, Label, Layers, Mask, Node, Renderable2D, ScrollView, UITransform, buildWorldStageSelectPage } = await loadAssemblerHarness()
  const parent = new Node('WorldRoot')
  const battle = new Node('BattleRoot')
  battle.parent = parent
  const entry = new Node('WorldStageEntryButton')
  entry.parent = battle
  entry.addComponent(Button)
  const stages = Array.from({ length: 10 }, (_, index) => ({ id: index + 1, name: `云路${index + 1}`, encounter: index === 9 ? 'region-boss' : [3, 6].includes(index) ? 'elite' : 'normal' }))
  const selected = []
  const visualStages = []
  let nextResult = { ok: true, stageNumber: 4 }
  const runtimeEvents = new Node('Runtime')
  runtimeEvents.on('battle-stage-changed', ({ stageId }) => visualStages.push(stageId))
  const page = buildWorldStageSelectPage({
    parent,
    battleRoot: battle,
    entryNode: entry,
    metrics: { cssWidth: 390, cssHeight: 844, topInsetPx: 47, bottomInsetPx: 34, leftInsetPx: 0, rightInsetPx: 0 },
    getHighestClearedWorldStage: () => 3,
    advanceToStage(stageId) { selected.push(stageId); if (nextResult.ok) runtimeEvents.emit('battle-stage-changed', { stageId }); return nextResult },
  })
  page.bind(stages)
  page.bind(stages)

  const root = parent.getChildByName('WorldStageSelectRoot')
  const header = root.getChildByName('WorldStageHeader')
  const close = header.getChildByName('WorldStageCloseButton')
  const scrollNode = root.getChildByName('WorldStageScrollView')
  const viewport = scrollNode.getChildByName('WorldStageViewport')
  const content = viewport.getChildByName('WorldStageContent')
  const grid = content.getChildByName('WorldStageGrid')
  const items = Array.from({ length: 10 }, (_, index) => grid.getChildByName(`WorldStageItem${index + 1}`))
  const status = root.getChildByName('WorldStageStatusLabel').getComponent(Label)

  assert.equal(root.active, false)
  const assembledNodes = []
  const visit = (node) => {
    assembledNodes.push(node)
    node.children.forEach(visit)
  }
  visit(root)
  assert.ok(assembledNodes.length > 40)
  assert.equal(
    assembledNodes.every((node) => node.layer === Layers.Enum.UI_2D),
    true,
    'root and every recursively assembled child must be visible to the UI camera',
  )
  assert.equal(
    assembledNodes.every((node) => node.components.filter((component) => component instanceof Renderable2D).length <= 1),
    true,
  )
  assert.ok(scrollNode.getComponent(ScrollView))
  assert.ok(viewport.getComponent(Mask))
  assert.equal(scrollNode.getComponent(ScrollView).content, content)
  assert.equal(scrollNode.getComponent(ScrollView).horizontal, false)
  assert.equal(scrollNode.getComponent(ScrollView).vertical, true)
  assert.equal(items.every(Boolean), true)
  assert.equal(items[4].getChildByName('WorldStageItem5Lock').getComponent(Label).string, '锁定')
  assert.equal(items[4].getComponent(Button).interactable, true, 'locked item must accept a tap for rejection feedback')
  const eliteBadgeRoot = items[3].getChildByName('WorldStageItem4BadgeRoot')
  const eliteBadgeLabel = eliteBadgeRoot?.getChildByName('WorldStageItem4BadgeLabel')
  assert.ok(eliteBadgeRoot)
  assert.ok(eliteBadgeLabel?.getComponent(Label))
  assert.equal(eliteBadgeRoot.getComponent(Label), null)
  assert.equal(close.listenerCount(Button.EventType.CLICK), 1)
  assert.equal(root.listenerCount('world-stage-selected'), 1)
  assert.equal(items.every((item) => item.listenerCount(Button.EventType.CLICK) === 1), true)

  const disabledProbe = new Node('DisabledButtonProbe')
  const disabledButton = disabledProbe.addComponent(Button)
  let disabledClicks = 0
  disabledProbe.on(Button.EventType.CLICK, () => { disabledClicks += 1 })
  disabledButton.interactable = false
  assert.equal(disabledButton.click(), false)
  assert.equal(disabledClicks, 0)

  page.open()
  assert.equal(items[3].getComponent(Button).click(), true)
  assert.deepEqual(selected, [4])
  assert.deepEqual(visualStages, [4])
  assert.equal(root.active, false)
  assert.equal(battle.active, true)

  page.open()
  nextResult = { ok: false, stageNumber: 3 }
  assert.equal(items[2].getComponent(Button).click(), true)
  assert.deepEqual(selected, [4, 3])
  assert.deepEqual(visualStages, [4])
  assert.equal(root.active, true)
  assert.notEqual(status.string, '')

  assert.equal(items[4].getComponent(Button).click(), true)
  assert.deepEqual(selected, [4, 3])
  assert.match(status.string, /未解锁/)

  page.relayout({ cssWidth: 844, cssHeight: 390, topInsetPx: 0, bottomInsetPx: 21, leftInsetPx: 44, rightInsetPx: 44 })
  const scale = Math.min(844 / 750, 390 / 1334)
  assert.ok(Math.abs(root.getComponent(UITransform).width * scale - 844) < 0.001)
  assert.ok(content.getComponent(UITransform).height > viewport.getComponent(UITransform).height)

  assert.equal(close.getComponent(Button).click(), true)
  assert.equal(root.active, false)
  assert.equal(battle.active, true)
  page.destroy()
  assert.equal(close.listenerCount(Button.EventType.CLICK), 0)
  assert.equal(root.listenerCount('world-stage-selected'), 0)
  assert.equal(items.every((item) => item.listenerCount(Button.EventType.CLICK) === 0), true)
})

test('mobile stage entry owns the selector overlay lifecycle at every supported viewport', async () => {
  const { Button, Label, Node, buildWorldStageSelectPage } = await loadAssemblerHarness()
  const stages = Array.from({ length: 10 }, (_, index) => ({
    id: index + 1,
    name: `World ${index + 1}`,
    encounter: index === 9 ? 'region-boss' : [3, 6].includes(index) ? 'elite' : 'normal',
  }))
  const viewports = [
    { cssWidth: 360, cssHeight: 780, topInsetPx: 0, bottomInsetPx: 0, leftInsetPx: 0, rightInsetPx: 0 },
    { cssWidth: 390, cssHeight: 844, topInsetPx: 47, bottomInsetPx: 34, leftInsetPx: 0, rightInsetPx: 0 },
    { cssWidth: 430, cssHeight: 932, topInsetPx: 47, bottomInsetPx: 34, leftInsetPx: 0, rightInsetPx: 0 },
    { cssWidth: 844, cssHeight: 390, topInsetPx: 0, bottomInsetPx: 21, leftInsetPx: 44, rightInsetPx: 44 },
  ]

  for (const metrics of viewports) {
    const parent = new Node(`WorldRoot-${metrics.cssWidth}x${metrics.cssHeight}`)
    const battle = new Node('BattleRoot')
    battle.parent = parent
    const entry = new Node('WorldStageEntryButton')
    entry.parent = battle
    const entryButton = entry.addComponent(Button)
    const page = buildWorldStageSelectPage({
      parent,
      battleRoot: battle,
      entryNode: entry,
      metrics,
      getHighestClearedWorldStage: () => 0,
      advanceToStage: () => ({ ok: true }),
    })
    page.bind(stages)

    const root = parent.getChildByName('WorldStageSelectRoot')
    const header = root.getChildByName('WorldStageHeader')
    const close = header.getChildByName('WorldStageCloseButton').getComponent(Button)
    const grid = root
      .getChildByName('WorldStageScrollView')
      .getChildByName('WorldStageViewport')
      .getChildByName('WorldStageContent')
      .getChildByName('WorldStageGrid')
    const items = Array.from({ length: 10 }, (_, index) => grid.getChildByName(`WorldStageItem${index + 1}`))
    const badgeText = (stageId) => items[stageId - 1]
      .getChildByName(`WorldStageItem${stageId}BadgeRoot`)
      .getChildByName(`WorldStageItem${stageId}BadgeLabel`)
      .getComponent(Label)
      .string
    const lockText = (stageId) => items[stageId - 1]
      .getChildByName(`WorldStageItem${stageId}Lock`)
      .getComponent(Label)
      .string

    assert.equal(entry.listenerCount(Button.EventType.CLICK), 1, `${metrics.cssWidth}x${metrics.cssHeight}: entry binding`)
    assert.equal(entryButton.click(), true)
    assert.equal(root.active, true, `${metrics.cssWidth}x${metrics.cssHeight}: selector opens`)
    assert.equal(battle.active, false, `${metrics.cssWidth}x${metrics.cssHeight}: combat hidden`)
    assert.equal(lockText(1), '', `${metrics.cssWidth}x${metrics.cssHeight}: stage 1 unlocked`)
    assert.equal(items.slice(1).every((_, index) => lockText(index + 2) !== ''), true, `${metrics.cssWidth}x${metrics.cssHeight}: later stages locked`)
    assert.notEqual(badgeText(4), '', `${metrics.cssWidth}x${metrics.cssHeight}: stage 4 elite badge`)
    assert.notEqual(badgeText(7), '', `${metrics.cssWidth}x${metrics.cssHeight}: stage 7 elite badge`)
    assert.notEqual(badgeText(10), '', `${metrics.cssWidth}x${metrics.cssHeight}: stage 10 Boss badge`)

    assert.equal(close.click(), true)
    assert.equal(root.active, false, `${metrics.cssWidth}x${metrics.cssHeight}: selector closes`)
    assert.equal(battle.active, true, `${metrics.cssWidth}x${metrics.cssHeight}: combat restored`)
    page.destroy()
    assert.equal(entry.listenerCount(Button.EventType.CLICK), 0, `${metrics.cssWidth}x${metrics.cssHeight}: entry cleanup`)
  }
})

test('complete region mobile smoke preserves authored parallax, exact unlocks, and revisit idempotency', () => {
  const design = JSON.parse(readFileSync(resolve('assets/Data/cultivation-design.json'), 'utf8'))
  const stages = design.worldStages
  const region = createWorldRegion('mist-frontier', stages.map(({ id, encounter }) => ({ id, encounter })))
  const visuals = stages.map(({ id }) => stageVisualFor(id))

  assert.equal(stages.length, 10)
  assert.equal(new Set(stages.map(({ background }) => background)).size, 10)
  assert.equal(new Set(visuals.map(({ backgroundId }) => backgroundId)).size, 10)
  assert.equal(new Set(visuals.map(({ farPath }) => farPath)).size, 10)
  assert.deepEqual(
    stages.filter(({ encounter }) => encounter === 'elite').map(({ id }) => id),
    [4, 7],
  )
  assert.deepEqual(
    stages.filter(({ encounter }) => encounter === 'region-boss').map(({ id }) => id),
    [10],
  )

  for (const visual of visuals) {
    for (const resourcePath of [visual.farPath, visual.midPath].filter(Boolean)) {
      const stem = resolve('assets/resources', resourcePath.replace('/spriteFrame', ''))
      const imagePath = ['.png', '.webp'].map((extension) => `${stem}${extension}`).find(existsSync)
      assert.ok(imagePath, `stage ${visual.stageId}: missing ${resourcePath}`)
      assert.ok(existsSync(`${imagePath}.meta`), `stage ${visual.stageId}: missing metadata for ${resourcePath}`)
    }
  }

  for (const stageId of [9, 10]) {
    const visual = visuals[stageId - 1]
    assert.notEqual(visual.midPath, null, `stage ${stageId}: parallax midground`)
    for (const resourcePath of [visual.farPath, visual.midPath]) {
      const metaPath = resolve('assets/resources', resourcePath.replace('/spriteFrame', '.png.meta'))
      const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
      const spriteFrame = meta.subMetas.f9941.userData
      if (resourcePath === visual.midPath) {
        assert.equal(spriteFrame.trimType, 'none', `stage ${stageId}: ${resourcePath} must keep its full canvas`)
      }
      assert.equal(spriteFrame.width, spriteFrame.rawWidth, `stage ${stageId}: ${resourcePath} width seam`)
      assert.equal(spriteFrame.height, spriteFrame.rawHeight, `stage ${stageId}: ${resourcePath} height seam`)
    }
  }

  assert.deepEqual(selectWorldStage(region, 0, 1), { ok: true, stageId: 1 })
  assert.deepEqual(selectWorldStage(region, 0, 2), { ok: false, reason: 'locked-stage' })
  for (let highestCleared = 1; highestCleared < 10; highestCleared += 1) {
    assert.deepEqual(
      selectWorldStage(region, highestCleared, highestCleared + 1),
      { ok: true, stageId: highestCleared + 1 },
    )
    if (highestCleared + 2 <= 10) {
      assert.deepEqual(
        selectWorldStage(region, highestCleared, highestCleared + 2),
        { ok: false, reason: 'locked-stage' },
      )
    }
  }

  const firstClear = applyWorldBossClear(createDefaultSave(), { stage: 4, rewardId: 'world-4-run-1' })
  const revisit = applyWorldBossClear(firstClear.save, { stage: 2, rewardId: 'world-4-run-1' })
  assert.equal(revisit.save.world.highestClearedStage, 4)
  assert.deepEqual(revisit.granted, { dungeonPasses: 0, spiritStones: 0 })
  assert.equal(revisit.save.rewardLedger.filter((rewardId) => rewardId === 'world-4-run-1').length, 1)
  assert.equal(revisit.save.inventory.dungeonPasses, firstClear.save.inventory.dungeonPasses)
  assert.equal(revisit.save.spiritStones, firstClear.save.spiritStones)
})

test('world stage assembler targets the same UI layer rendered by the bootstrap camera', () => {
  const assembler = readFileSync(resolve('assets/Scripts/Game/WorldStageSelectPageAssembler.ts'), 'utf8')
  const bootstrap = readFileSync(resolve('assets/Scripts/Game/PortraitBattleBootstrap.ts'), 'utf8')

  assert.match(assembler, /const UI_LAYER = Layers\.Enum\.UI_2D/)
  assert.match(assembler, /function createNode[\s\S]*node\.layer = UI_LAYER[\s\S]*return node/)
  assert.match(assembler, /options\.entryNode\.on\(Button\.EventType\.CLICK, this\.open, this\)/)
  assert.match(assembler, /this\.options\.entryNode\.off\(Button\.EventType\.CLICK, this\.open, this\)/)
  assert.match(bootstrap, /const UI_LAYER = Layers\.Enum\.UI_2D/)
  assert.match(bootstrap, /camera\.visibility = UI_LAYER/)
  assert.match(bootstrap, /if \(!this\.worldStageEntryNode\) throw new Error/)
  assert.doesNotMatch(bootstrap, /worldStageEntryNode\?\.(?:on|off)\(Button\.EventType\.CLICK/)
})
