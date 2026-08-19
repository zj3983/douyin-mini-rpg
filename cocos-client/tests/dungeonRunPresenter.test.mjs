import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'

const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const clone = (value) => JSON.parse(JSON.stringify(value))

async function loadPresenter() {
  const ccUrl = moduleUrl(`
    export class Component {}
    export class Node {
      constructor(name = '') { this.name = name; this.children = []; this.parent = null; this.active = true }
      addChild(node) { node.parent = this; this.children.push(node) }
      removeFromParent() { if (this.parent) this.parent.children = this.parent.children.filter((n) => n !== this); this.parent = null }
      destroy() { this.destroyed = true; this.removeFromParent() }
    }
    export const _decorator = { ccclass: () => (value) => value, property: () => () => undefined }
  `)
  const source = readFileSync(resolve('assets/Scripts/Game/DungeonRunPresenter.ts'), 'utf8')
  let javascript = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, experimentalDecorators: true },
  }).outputText
  javascript = javascript.replace("from 'cc'", `from '${ccUrl}'`)
  return import(moduleUrl(javascript))
}

function sharedLayers() {
  return { actor: { name: 'SharedActorLayer' }, effect: { name: 'SharedEffectLayer' }, drop: { name: 'SharedDropLayer' }, input: { name: 'SharedInputLayer' } }
}

test('presenter hierarchy contains only dungeon UI and keeps shared combat ownership external', async () => {
  const { DUNGEON_NODE_NAMES, DungeonPresenterModel } = await loadPresenter()
  assert.deepEqual(DUNGEON_NODE_NAMES, ['DungeonWorldLayer', 'DungeonHud', 'DungeonPressureBar', 'DungeonMapButton', 'DungeonMapOverlay', 'DungeonInteractionHint', 'DungeonPursuitWarning', 'DungeonSettlement'])
  const layers = sharedLayers()
  const model = new DungeonPresenterModel(layers)
  assert.equal(model.sharedLayers.actor, layers.actor)
  assert.equal(model.sharedLayers.effect, layers.effect)
  assert.equal(model.sharedLayers.drop, layers.drop)
  assert.equal(model.sharedLayers.input, layers.input)
  assert.equal(model.createdCombatRuntimeCount, 0)
})

test('HUD stays minimal, map pauses, and pursuit warning precedes final Boss visibility', async () => {
  const { DungeonPresenterModel } = await loadPresenter()
  const model = new DungeonPresenterModel(sharedLayers())
  model.presentHud({ health: 88, floor: 2, pressure: 121, carriedLootCount: 6, attack: 999, realm: 'ignored' })
  assert.deepEqual(model.snapshot().hud, { health: 88, floor: 2, pressure: 121, carriedLootCount: 6 })
  model.setMapOpen(true)
  assert.equal(model.snapshot().paused, true)
  model.consumeEvent({ type: 'pursuer-hunt-started', hunt: 1 })
  assert.equal(model.snapshot().pursuitWarningVisible, true)
  assert.equal(model.snapshot().bossBarVisible, false)
  model.consumeEvent({ type: 'altar-activated', roomId: 'f3-altar' })
  assert.equal(model.snapshot().bossBarVisible, true)
})

test('loot pickups are pooled and bounded while equipment uses a brief identity toast', async () => {
  const { DungeonPresenterModel } = await loadPresenter()
  const model = new DungeonPresenterModel(sharedLayers(), { maxPickups: 3 })
  model.consumeEvent({ type: 'room-searched', roomId: 'cache', doorCurrencyGranted: 0, loot: [{ itemId: 'mist-herb', amount: 4 }, { itemId: 'flying-sword', amount: 1 }, { itemId: 'jade-guard', amount: 1 }] })
  const state = model.snapshot()
  assert.equal(state.pickups.length, 3)
  assert.equal(state.pickups.every((pickup) => pickup.attractingToPlayer), true)
  assert.deepEqual(state.toasts.map((toast) => toast.itemId), ['flying-sword', 'jade-guard'])
  assert.equal(state.toasts.every((toast) => toast.icon !== '' && toast.rarity !== '' && toast.name !== ''), true)
  model.releasePickup(state.pickups[0].id)
  model.consumeEvent({ type: 'room-searched', roomId: 'next', doorCurrencyGranted: 0, loot: [{ itemId: 'ore', amount: 2 }] })
  assert.equal(model.snapshot().pickups.length, 3)
})

test('settlement is manual, distinguishes exits, and destroy clears callbacks and pending work', async () => {
  const { DungeonPresenterModel } = await loadPresenter()
  const model = new DungeonPresenterModel(sharedLayers())
  model.consumeEvent({ type: 'extraction-completed', exitKind: 'damaged', explorationRate: 0.625, bossDefeated: false, loot: [], retainedLoot: [] })
  assert.deepEqual(model.snapshot().settlement, { visible: true, exitKind: 'damaged', explorationRate: 0.625, bossDefeated: false, manualClose: true })
  assert.equal(model.pendingScheduleCount, 0)
  model.onPauseChanged = () => undefined
  model.onMapClosed = () => undefined
  model.destroy()
  const state = model.snapshot()
  assert.equal(state.destroyed, true)
  assert.equal(model.onPauseChanged, null)
  assert.equal(model.onMapClosed, null)
  assert.equal(model.pendingScheduleCount, 0)
  assert.deepEqual(clone(state.pickups), [])
})
