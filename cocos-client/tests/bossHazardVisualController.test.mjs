import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const ccSource = `
export const _decorator = {
  ccclass: () => (target) => target,
  property: (...args) => args.length >= 2 ? undefined : () => undefined,
}
export class Component {
  node = null
}
export class Color {
  constructor(r = 0, g = 0, b = 0, a = 255) {
    this.r = r
    this.g = g
    this.b = b
    this.a = a
  }
}
export class Graphics extends Component {
  calls = []
  clear() { this.calls.push('clear') }
}
export class Sprite extends Component {
  spriteFrame = null
  _color = new Color()
  get color() { return this._color }
  set color(value) { this._color = new Color(value.r, value.g, value.b, value.a) }
}
export class SpriteFrame {}
export class Prefab {}
export function instantiate(prefab) { return prefab }
export class UITransform extends Component {
  contentSize = { width: 0, height: 0 }
  setContentSize(width, height) { this.contentSize = { width, height } }
}
export class Node {
  constructor(name = '') {
    this.name = name
    this.parent = null
    this.children = []
    this.active = true
    this.scale = { x: 1, y: 1, z: 1 }
    this.angle = 0
    this.components = new Map()
    this.listeners = new Map()
  }
  addComponent(Type) {
    const component = new Type()
    component.node = this
    this.components.set(Type, component)
    return component
  }
  getComponent(Type) { return this.components.get(Type) ?? null }
  addChild(child) {
    child.parent = this
    this.children.push(child)
  }
  on(event, callback, context) {
    const listeners = this.listeners.get(event) ?? []
    listeners.push({ callback, context })
    this.listeners.set(event, listeners)
  }
  emit(event, ...args) {
    for (const listener of this.listeners.get(event) ?? []) {
      listener.callback.call(listener.context, ...args)
    }
  }
  listenerCount(event) { return this.listeners.get(event)?.length ?? 0 }
  setScale(x, y, z) { this.scale = { x, y, z } }
  setRotationFromEuler(_x, _y, z) { this.angle = z }
}
`

async function loadRuntime() {
  const [controllerSource, poolableSource, nodePoolSource, poolingSource] = await Promise.all([
    readFile(new URL('../assets/Scripts/Game/BossHazardVisualController.ts', import.meta.url), 'utf8'),
    readFile(new URL('../assets/Scripts/Game/PoolableActor.ts', import.meta.url), 'utf8'),
    readFile(new URL('../assets/Scripts/Game/NodePoolController.ts', import.meta.url), 'utf8'),
    readFile(new URL('../assets/Scripts/Core/PoolingRuntime.ts', import.meta.url), 'utf8'),
  ])
  const transpile = source => ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      experimentalDecorators: true,
    },
  }).outputText
  const ccUrl = `data:text/javascript;base64,${Buffer.from(ccSource).toString('base64')}`
  const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
  const poolingUrl = moduleUrl(transpile(poolingSource))
  const poolableUrl = moduleUrl(transpile(poolableSource).replace("from 'cc'", `from '${ccUrl}'`))
  const nodePoolUrl = moduleUrl(
    transpile(nodePoolSource)
      .replace("from 'cc'", `from '${ccUrl}'`)
      .replace("from '../Core/PoolingRuntime'", `from '${poolingUrl}'`)
      .replace("from './PoolableActor'", `from '${poolableUrl}'`),
  )
  const controllerUrl = moduleUrl(transpile(controllerSource).replace("from 'cc'", `from '${ccUrl}'`))
  const [controllerRuntime, poolableRuntime, nodePoolRuntime, cc] = await Promise.all([
    import(controllerUrl),
    import(poolableUrl),
    import(nodePoolUrl),
    import(ccUrl),
  ])
  return { ...controllerRuntime, ...poolableRuntime, ...nodePoolRuntime, cc }
}

function createHarness(cc, Controller, PoolableActor) {
  const node = new cc.Node('BossSkillEffect')
  node.addComponent(cc.UITransform).setContentSize(1, 1)
  const graphics = node.addComponent(cc.Graphics)
  const talismanNode = new cc.Node('Talisman')
  const transform = talismanNode.addComponent(cc.UITransform)
  const sprite = talismanNode.addComponent(cc.Sprite)
  node.addChild(talismanNode)
  const controller = node.addComponent(Controller)
  controller.graphics = graphics
  controller.talisman = sprite
  node.addComponent(PoolableActor)
  node.on('pool-despawned', controller.resetVisual, controller)
  controller.resetVisual()
  return { controller, graphics, node, sprite, talismanNode, transform }
}

test('twenty sweep spike roar despawn cycles restore the pooled visual state', async () => {
  const { BossHazardVisualController, NodePoolController, PoolableActor, cc } = await loadRuntime()
  const poolRoot = new cc.Node('BossEffectPool')
  const pool = poolRoot.addComponent(NodePoolController)
  pool.configure('boss-effect', 1)
  pool.setFactory(() => createHarness(cc, BossHazardVisualController, PoolableActor).node)
  const firstNode = pool.spawn()
  const persistentTalisman = firstNode.children[0]
  const graphics = firstNode.getComponent(cc.Graphics)
  const sprite = persistentTalisman.getComponent(cc.Sprite)

  assert.equal(firstNode.listenerCount('pool-despawned'), 1)
  assert.equal(firstNode.children.length, 1)
  assert.strictEqual(firstNode.children[0], persistentTalisman)

  for (let cycle = 0; cycle < 20; cycle += 1) {
    const node = cycle === 0 ? firstNode : pool.spawn()
    assert.strictEqual(node, firstNode)

    for (const hazard of ['sweep', 'spike', 'roar']) {
      graphics.calls.push(hazard)
      sprite.spriteFrame = { hazard, cycle }
      sprite.color = new cc.Color(cycle, 80, 120, 230)
      persistentTalisman.setScale(1.5, 0.7, 2)
      persistentTalisman.setRotationFromEuler(0, 0, 15 + cycle)
    }

    const clearCount = graphics.calls.filter(call => call === 'clear').length
    pool.despawn(node)

    assert.equal(graphics.calls.at(-1), 'clear')
    assert.equal(graphics.calls.filter(call => call === 'clear').length, clearCount + 1)
    assert.equal(sprite.spriteFrame, null)
    assert.equal(sprite.color.a, 0)
    assert.deepEqual(persistentTalisman.scale, { x: 1, y: 1, z: 1 })
    assert.equal(persistentTalisman.angle, 0)
    assert.equal(node.listenerCount('pool-despawned'), 1)
    assert.equal(node.children.length, 1)
    assert.strictEqual(node.children[0], persistentTalisman)
  }
})

test('setTalisman assigns its frame and color and clamps dimensions to 112', async () => {
  const { BossHazardVisualController, PoolableActor, cc } = await loadRuntime()
  const harness = createHarness(cc, BossHazardVisualController, PoolableActor)
  const frame = { id: 'sweep-frame' }
  const color = new cc.Color(141, 232, 218, 190)

  harness.controller.setTalisman(frame, color, 180, 96)

  assert.strictEqual(harness.sprite.spriteFrame, frame)
  assert.notStrictEqual(harness.sprite.color, color)
  assert.deepEqual(
    [harness.sprite.color.r, harness.sprite.color.g, harness.sprite.color.b, harness.sprite.color.a],
    [141, 232, 218, 190],
  )
  color.r = 0
  color.g = 0
  color.b = 0
  color.a = 0
  assert.deepEqual(
    [harness.sprite.color.r, harness.sprite.color.g, harness.sprite.color.b, harness.sprite.color.a],
    [141, 232, 218, 190],
  )
  assert.deepEqual(harness.transform.contentSize, { width: 112, height: 96 })
})

test('setTalisman clamps height independently when width is below 112', async () => {
  const { BossHazardVisualController, PoolableActor, cc } = await loadRuntime()
  const harness = createHarness(cc, BossHazardVisualController, PoolableActor)

  harness.controller.setTalisman(new cc.SpriteFrame(), new cc.Color(255, 255, 255, 255), 96, 180)

  assert.deepEqual(harness.transform.contentSize, { width: 96, height: 112 })
})

test('controller methods are null-safe when optional visual bindings are absent', async () => {
  const { BossHazardVisualController, cc } = await loadRuntime()
  const controller = new cc.Node('UnboundHazard').addComponent(BossHazardVisualController)

  assert.doesNotThrow(() => controller.resetVisual())
  assert.doesNotThrow(() => controller.setTalisman(null, { r: 255, g: 255, b: 255, a: 255 }, 200, 200))
})

test('bootstrap builds one persistent talisman child and resets it on real pool despawn', async () => {
  const source = await readFile(new URL('../assets/Scripts/Game/PortraitBattleBootstrap.ts', import.meta.url), 'utf8')
  const factory = source.match(/private createBossEffectNode\(\) \{([\s\S]*?)\n  \}/)?.[1]

  assert.ok(factory, 'missing createBossEffectNode factory')
  assert.match(source, /import \{ BossHazardVisualController \} from '\.\/BossHazardVisualController'/)
  assert.match(factory, /const graphics = node\.addComponent\(Graphics\)/)
  assert.equal((factory.match(/new Node\('Talisman'\)/g) ?? []).length, 1)
  assert.match(factory, /talismanNode\.addComponent\(UITransform\)/)
  assert.match(factory, /talismanNode\.addComponent\(Sprite\)/)
  assert.match(factory, /node\.addComponent\(BossHazardVisualController\)/)
  assert.match(factory, /visual\.graphics = graphics/)
  assert.match(factory, /visual\.talisman = talisman/)
  assert.match(factory, /node\.addComponent\(PoolableActor\)/)
  assert.match(factory, /node\.on\('pool-despawned', visual\.resetVisual, visual\)/)
  assert.match(factory, /visual\.resetVisual\(\)/)
  assert.match(source, /BOSS_HAZARD_POOL_CAPACITY/)
})
