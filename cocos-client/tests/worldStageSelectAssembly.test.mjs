import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'

const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`

async function loadAssemblerHarness() {
  const ccUrl = moduleUrl(`
    export class Node {
      constructor(name = '') { this.name = name; this.active = true; this.layer = 0; this.listeners = new Map(); this.children = []; this.components = []; this._parent = null; this.position = { x: 0, y: 0, z: 0 } }
      set parent(value) { if (this._parent === value) return; if (this._parent) this._parent.children = this._parent.children.filter((child) => child !== this); this._parent = value; if (value && !value.children.includes(this)) value.children.push(this) }
      get parent() { return this._parent }
      addComponent(Type) { const component = new Type(); component.node = this; this.components.push(component); return component }
      getComponent(Type) { return this.components.find((component) => component instanceof Type) ?? null }
      getChildByName(name) { return this.children.find((child) => child.name === name) ?? null }
      setPosition(x, y, z = 0) { this.position = { x, y, z } }
      on(eventName, callback, target) { const listeners = this.listeners.get(eventName) ?? []; listeners.push({ callback, target }); this.listeners.set(eventName, listeners) }
      off(eventName, callback, target) { const listeners = this.listeners.get(eventName) ?? []; this.listeners.set(eventName, listeners.filter((entry) => entry.callback !== callback || entry.target !== target)) }
      emit(eventName, payload) { for (const entry of [...(this.listeners.get(eventName) ?? [])]) entry.callback.call(entry.target, payload) }
      listenerCount(eventName) { return (this.listeners.get(eventName) ?? []).length }
    }
    export class Component { constructor() { this.node = null } }
    export class Button { static EventType = { CLICK: 'click' }; constructor() { this.interactable = true } }
    export class Label { static Overflow = { SHRINK: 2 }; constructor() { this.string = ''; this.fontSize = 0; this.lineHeight = 0; this.color = null } }
    export class Color { constructor(r, g, b, a) { Object.assign(this, { r, g, b, a }) } }
    export class Graphics { clear() {} roundRect() {} fill() {} stroke() {} rect() {} circle() {} }
    export class UITransform { constructor() { this.width = 0; this.height = 0; this.anchorX = 0.5; this.anchorY = 0.5 } setContentSize(width, height) { this.width = width; this.height = height } setAnchorPoint(x, y) { this.anchorX = x; this.anchorY = y } }
    export class Mask { static Type = { RECT: 0 }; constructor() { this.type = Mask.Type.RECT } }
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
        labels.forEach((label, index) => { label.string = stages[index] ? '第' + stages[index].id + '关 ' + stages[index].name : '' })
        badges.forEach((badge, index) => { badge.string = stages[index]?.encounter === 'elite' ? '精英' : stages[index]?.encounter === 'region-boss' ? '区域Boss' : '' })
        locks.forEach((lock, index) => { lock.string = buttons[index]?.interactable ? '' : '锁定' })
      }
      select(stageId) {
        if (!this.buttons?.[stageId - 1]?.interactable) { this.node.emit('world-stage-selection-rejected', { stageId, reason: 'locked-stage' }); return false }
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

test('real world stage assembler builds scroll hierarchy and routes selection safely', async () => {
  const { Button, Label, Layers, Mask, Node, ScrollView, UITransform, buildWorldStageSelectPage } = await loadAssemblerHarness()
  const parent = new Node('WorldRoot')
  const battle = new Node('BattleRoot')
  battle.parent = parent
  const stages = Array.from({ length: 10 }, (_, index) => ({ id: index + 1, name: `云路${index + 1}`, encounter: index === 9 ? 'region-boss' : [3, 6].includes(index) ? 'elite' : 'normal' }))
  const selected = []
  const visualStages = []
  let nextResult = { ok: true, stageNumber: 4 }
  const runtimeEvents = new Node('Runtime')
  runtimeEvents.on('battle-stage-changed', ({ stageId }) => visualStages.push(stageId))
  const page = buildWorldStageSelectPage({
    parent,
    battleRoot: battle,
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
  assert.ok(scrollNode.getComponent(ScrollView))
  assert.ok(viewport.getComponent(Mask))
  assert.equal(scrollNode.getComponent(ScrollView).content, content)
  assert.equal(scrollNode.getComponent(ScrollView).horizontal, false)
  assert.equal(scrollNode.getComponent(ScrollView).vertical, true)
  assert.equal(items.every(Boolean), true)
  assert.equal(items[4].getChildByName('WorldStageItem5Lock').getComponent(Label).string, '锁定')
  assert.equal(close.listenerCount(Button.EventType.CLICK), 1)
  assert.equal(root.listenerCount('world-stage-selected'), 1)
  assert.equal(items.every((item) => item.listenerCount(Button.EventType.CLICK) === 1), true)

  page.open()
  items[3].emit(Button.EventType.CLICK)
  assert.deepEqual(selected, [4])
  assert.deepEqual(visualStages, [4])
  assert.equal(root.active, false)
  assert.equal(battle.active, true)

  page.open()
  nextResult = { ok: false, stageNumber: 3 }
  items[2].emit(Button.EventType.CLICK)
  assert.deepEqual(selected, [4, 3])
  assert.deepEqual(visualStages, [4])
  assert.equal(root.active, true)
  assert.notEqual(status.string, '')

  items[4].emit(Button.EventType.CLICK)
  assert.deepEqual(selected, [4, 3])
  assert.match(status.string, /未解锁/)

  page.relayout({ cssWidth: 844, cssHeight: 390, topInsetPx: 0, bottomInsetPx: 21, leftInsetPx: 44, rightInsetPx: 44 })
  const scale = Math.min(844 / 750, 390 / 1334)
  assert.ok(Math.abs(root.getComponent(UITransform).width * scale - 844) < 0.001)
  assert.ok(content.getComponent(UITransform).height > viewport.getComponent(UITransform).height)

  close.emit(Button.EventType.CLICK)
  assert.equal(root.active, false)
  assert.equal(battle.active, true)
  page.destroy()
  assert.equal(close.listenerCount(Button.EventType.CLICK), 0)
  assert.equal(root.listenerCount('world-stage-selected'), 0)
  assert.equal(items.every((item) => item.listenerCount(Button.EventType.CLICK) === 0), true)
})

test('world stage assembler targets the same UI layer rendered by the bootstrap camera', () => {
  const assembler = readFileSync(resolve('assets/Scripts/Game/WorldStageSelectPageAssembler.ts'), 'utf8')
  const bootstrap = readFileSync(resolve('assets/Scripts/Game/PortraitBattleBootstrap.ts'), 'utf8')

  assert.match(assembler, /const UI_LAYER = Layers\.Enum\.UI_2D/)
  assert.match(assembler, /function createNode[\s\S]*node\.layer = UI_LAYER[\s\S]*return node/)
  assert.match(bootstrap, /const UI_LAYER = Layers\.Enum\.UI_2D/)
  assert.match(bootstrap, /camera\.visibility = UI_LAYER/)
})
