import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const LAYER_BINDINGS = Object.freeze([
  Object.freeze({ field: 'mainShape', name: 'MainShape', nodeVariable: 'mainShapeNode' }),
  Object.freeze({ field: 'accent', name: 'Accent', nodeVariable: 'accentNode' }),
  Object.freeze({ field: 'particleNear', name: 'ParticleNear', nodeVariable: 'particleNearNode' }),
  Object.freeze({ field: 'particleFar', name: 'ParticleFar', nodeVariable: 'particleFarNode' }),
])

const ccSource = `
export const _decorator = {
  ccclass: () => (target) => target,
  property: (...args) => args.length >= 2 ? undefined : () => undefined,
}
export const mockStats = { colors: 0, nodes: 0, sprites: 0 }
export class Component {
  node = null
  enabled = true
}
export class Color {
  constructor(r = 0, g = 0, b = 0, a = 255) {
    mockStats.colors += 1
    this.set(r, g, b, a)
  }
  set(r = 0, g = 0, b = 0, a = 255) {
    if (typeof r === 'object') {
      this.r = r.r
      this.g = r.g
      this.b = r.b
      this.a = r.a
      return this
    }
    this.r = r
    this.g = g
    this.b = b
    this.a = a
    return this
  }
}
export class Graphics extends Component {
  calls = []
  clear() { this.calls.push('clear') }
}
export class Sprite extends Component {
  constructor() {
    super()
    mockStats.sprites += 1
    this.spriteFrame = null
    this._color = new Color()
  }
  get color() { return this._color }
  set color(value) { this._color.set(value) }
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
    mockStats.nodes += 1
    this.name = name
    this.parent = null
    this.children = []
    this.active = true
    this.layer = 0
    this.position = { x: 0, y: 0, z: 0 }
    this.scale = { x: 1, y: 1, z: 1 }
    this.eulerAngles = { x: 0, y: 0, z: 0 }
    this.angle = 0
    this.components = []
    this.listeners = new Map()
  }
  addComponent(Type) {
    const component = new Type()
    component.node = this
    this.components.push(component)
    return component
  }
  getComponent(Type) { return this.components.find(component => component instanceof Type) ?? null }
  addChild(child) {
    if (child.parent === this) return
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
  setPosition(x, y, z) { this.position = { x, y, z } }
  setScale(x, y, z) { this.scale = { x, y, z } }
  setRotationFromEuler(x, y, z) {
    this.eulerAngles = { x, y, z }
    this.angle = z
  }
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
  node.layer = 1 << 25
  node.addComponent(cc.UITransform).setContentSize(1, 1)
  const graphics = node.addComponent(cc.Graphics)
  const layers = {}

  for (const { field, name } of LAYER_BINDINGS) {
    const layerNode = new cc.Node(name)
    layerNode.layer = node.layer
    const transform = layerNode.addComponent(cc.UITransform)
    transform.setContentSize(1, 1)
    const sprite = layerNode.addComponent(cc.Sprite)
    node.addChild(layerNode)
    layers[field] = { node: layerNode, sprite, transform }
  }

  const controller = node.addComponent(Controller)
  controller.graphics = graphics
  for (const { field } of LAYER_BINDINGS) controller[field] = layers[field].sprite
  node.addComponent(PoolableActor)
  node.on('pool-despawned', controller.resetVisual, controller)
  controller.resetVisual()
  return { controller, graphics, layers, node }
}

function componentCount(node) {
  return node.components.length + node.children.reduce((total, child) => total + componentCount(child), 0)
}

function rgba(color) {
  return { r: color.r, g: color.g, b: color.b, a: color.a }
}

test('twenty sweep spike roar despawn cycles fully reset four fixed layers without allocations', async () => {
  const { BossHazardVisualController, NodePoolController, PoolableActor, cc } = await loadRuntime()
  const poolRoot = new cc.Node('BossEffectPool')
  const pool = poolRoot.addComponent(NodePoolController)
  pool.configure('boss-effect', 1)
  pool.setFactory(() => createHarness(cc, BossHazardVisualController, PoolableActor).node)
  const firstNode = pool.spawn()
  const graphics = firstNode.getComponent(cc.Graphics)
  const persistentLayers = LAYER_BINDINGS.map(({ field, name }) => {
    const layerNode = firstNode.children.find(child => child.name === name)
    return {
      field,
      node: layerNode,
      sprite: layerNode.getComponent(cc.Sprite),
      transform: layerNode.getComponent(cc.UITransform),
    }
  })
  const persistentColors = persistentLayers.map(({ sprite }) => sprite.color)
  const stableComponentCount = componentCount(firstNode)
  const stableNodeCount = cc.mockStats.nodes
  const stableSpriteCount = cc.mockStats.sprites

  assert.equal(firstNode.listenerCount('pool-despawned'), 1)
  assert.equal(firstNode.children.length, 4)
  assert.deepEqual(firstNode.children.map(child => child.name), LAYER_BINDINGS.map(({ name }) => name))
  assert.equal(stableComponentCount, 12)
  assert.equal(stableSpriteCount, 4)

  for (let cycle = 0; cycle < 20; cycle += 1) {
    const node = cycle === 0 ? firstNode : pool.spawn()
    assert.strictEqual(node, firstNode)

    for (const [hazardIndex, hazard] of ['sweep', 'spike', 'roar'].entries()) {
      graphics.calls.push(hazard)
      for (const [layerIndex, layer] of persistentLayers.entries()) {
        layer.sprite.spriteFrame = { hazard, cycle, layer: layer.field }
        layer.sprite.color = new cc.Color(
          20 + layerIndex * 40,
          40 + hazardIndex * 50,
          80 + cycle,
          110 + layerIndex * 30,
        )
        layer.transform.setContentSize(
          30 + layerIndex * 17 + hazardIndex,
          14 + layerIndex * 11 + cycle,
        )
        layer.node.setPosition(layerIndex * 9 + 1, hazardIndex * -7 - 1, cycle + layerIndex)
        layer.node.setScale(1.1 + layerIndex * 0.2, 0.7 + hazardIndex * 0.1, 1.5 + cycle * 0.01)
        layer.node.setRotationFromEuler(layerIndex + 2, hazardIndex + 3, 15 + cycle + layerIndex)
        layer.node.active = (cycle + layerIndex + hazardIndex) % 2 === 0
        layer.sprite.enabled = (cycle + layerIndex + hazardIndex) % 3 !== 0
      }
    }

    assert.equal(new Set(persistentLayers.map(({ node: layerNode }) => layerNode.active)).size, 2)
    const clearCount = graphics.calls.filter(call => call === 'clear').length
    const colorCountBeforeReset = cc.mockStats.colors
    pool.despawn(node)

    assert.equal(node.active, false)
    assert.equal(graphics.calls.at(-1), 'clear')
    assert.equal(graphics.calls.filter(call => call === 'clear').length, clearCount + 1)
    for (const [index, layer] of persistentLayers.entries()) {
      assert.equal(layer.sprite.spriteFrame, null, layer.field)
      assert.deepEqual(rgba(layer.sprite.color), { r: 255, g: 255, b: 255, a: 0 }, layer.field)
      assert.strictEqual(layer.sprite.color, persistentColors[index], `${layer.field} color identity`)
      assert.deepEqual(layer.transform.contentSize, { width: 1, height: 1 }, layer.field)
      assert.deepEqual(layer.node.position, { x: 0, y: 0, z: 0 }, layer.field)
      assert.deepEqual(layer.node.scale, { x: 1, y: 1, z: 1 }, layer.field)
      assert.deepEqual(layer.node.eulerAngles, { x: 0, y: 0, z: 0 }, layer.field)
      assert.equal(layer.node.active, false, layer.field)
      assert.equal(layer.sprite.enabled, true, layer.field)
      assert.strictEqual(node.children[index], layer.node, layer.field)
    }
    assert.equal(cc.mockStats.colors, colorCountBeforeReset)
    assert.equal(cc.mockStats.nodes, stableNodeCount)
    assert.equal(cc.mockStats.sprites, stableSpriteCount)
    assert.equal(componentCount(node), stableComponentCount)
    assert.equal(node.listenerCount('pool-despawned'), 1)
    assert.equal(node.children.length, 4)
  }
})

test('setLayerFrames binds main accent and one shared particle frame to four layers', async () => {
  const { BossHazardVisualController, PoolableActor, cc } = await loadRuntime()
  const harness = createHarness(cc, BossHazardVisualController, PoolableActor)
  const main = { id: 'main' }
  const accent = { id: 'accent' }
  const particle = { id: 'particle' }

  harness.controller.setLayerFrames(main, accent, particle)

  assert.strictEqual(harness.layers.mainShape.sprite.spriteFrame, main)
  assert.strictEqual(harness.layers.accent.sprite.spriteFrame, accent)
  assert.strictEqual(harness.layers.particleNear.sprite.spriteFrame, particle)
  assert.strictEqual(harness.layers.particleFar.sprite.spriteFrame, particle)

  harness.controller.setLayerFrames(null, null, null)
  for (const { field } of LAYER_BINDINGS) {
    assert.equal(harness.layers[field].sprite.spriteFrame, null, field)
  }
})

test('setLayerSizes keeps every fixed layer positive and bounded for rectangular skill areas', async () => {
  const { BossHazardVisualController, PoolableActor, cc } = await loadRuntime()
  const harness = createHarness(cc, BossHazardVisualController, PoolableActor)
  const stableNodeCount = cc.mockStats.nodes
  const stableSpriteCount = cc.mockStats.sprites
  const factors = {
    mainShape: 1,
    accent: 0.9,
    particleNear: 0.7,
    particleFar: 0.5,
  }
  const cases = [
    { hazard: 'sweep-like', width: 280, height: 72 },
    { hazard: 'spike-like', width: 84, height: 196 },
    { hazard: 'roar-like', width: 320, height: 48 },
    { hazard: 'very-small', width: 0.25, height: 0.5 },
  ]

  for (const { hazard, width, height } of cases) {
    harness.controller.setLayerSizes(width, height)
    for (const { field } of LAYER_BINDINGS) {
      const size = harness.layers[field].transform.contentSize
      assert.ok(Number.isFinite(size.width) && size.width > 0, `${hazard} ${field} width`)
      assert.ok(Number.isFinite(size.height) && size.height > 0, `${hazard} ${field} height`)
      assert.ok(size.width <= width, `${hazard} ${field} width must stay inside root geometry`)
      assert.ok(size.height <= height, `${hazard} ${field} height must stay inside root geometry`)
      assert.equal(size.width, width * factors[field], `${hazard} ${field} width factor`)
      assert.equal(size.height, height * factors[field], `${hazard} ${field} height factor`)
      assert.ok(
        Math.abs((size.width / size.height) - (width / height)) < 1e-12,
        `${hazard} ${field} rectangular ratio`,
      )
    }
  }

  harness.controller.setLayerSizes(0, Number.NaN)
  for (const { field } of LAYER_BINDINGS) {
    const size = harness.layers[field].transform.contentSize
    assert.ok(Number.isFinite(size.width) && size.width > 0, `${field} invalid width fallback`)
    assert.ok(Number.isFinite(size.height) && size.height > 0, `${field} invalid height fallback`)
  }
  assert.equal(cc.mockStats.nodes, stableNodeCount)
  assert.equal(cc.mockStats.sprites, stableSpriteCount)
})

test('controller methods are null-safe when optional visual bindings are absent', async () => {
  const { BossHazardVisualController, cc } = await loadRuntime()
  const controller = new cc.Node('UnboundHazard').addComponent(BossHazardVisualController)

  assert.doesNotThrow(() => controller.resetVisual())
  assert.doesNotThrow(() => controller.setLayerFrames(null, null, null))
  assert.doesNotThrow(() => controller.setLayerSizes(200, 80))
})

test('bootstrap builds and binds exactly four persistent sprite children', async () => {
  const source = await readFile(new URL('../assets/Scripts/Game/PortraitBattleBootstrap.ts', import.meta.url), 'utf8')
  const controllerSource = await readFile(new URL('../assets/Scripts/Game/BossHazardVisualController.ts', import.meta.url), 'utf8')
  const factory = source.match(/private createBossEffectNode\(\) \{([\s\S]*?)\n  \}/)?.[1]

  assert.ok(factory, 'missing createBossEffectNode factory')
  assert.match(source, /import \{ BossHazardVisualController \} from '\.\/BossHazardVisualController'/)
  assert.match(factory, /const graphics = node\.addComponent\(Graphics\)/)
  assert.equal((factory.match(/\.addComponent\(Sprite\)/g) ?? []).length, 4)
  assert.equal((factory.match(/node\.addChild\(/g) ?? []).length, 4)
  for (const { field, name, nodeVariable } of LAYER_BINDINGS) {
    assert.equal((factory.match(new RegExp(`new Node\\('${name}'\\)`, 'g')) ?? []).length, 1, name)
    assert.match(factory, new RegExp(`${nodeVariable}\\.layer = UI_LAYER`), name)
    assert.match(factory, new RegExp(`${nodeVariable}\\.addComponent\\(UITransform\\)`), name)
    assert.match(factory, new RegExp(`const ${field} = ${nodeVariable}\\.addComponent\\(Sprite\\)`), name)
    assert.equal((factory.match(new RegExp(`node\\.addChild\\(${nodeVariable}\\)`, 'g')) ?? []).length, 1, name)
    assert.match(factory, new RegExp(`visual\\.${field} = ${field}`), name)
    assert.match(
      controllerSource,
      new RegExp(`@property\\(Sprite\\)\\s+${field}: Sprite \\| null = null`),
      `${field} property`,
    )
  }
  assert.doesNotMatch(factory, /Talisman|talisman/)
  assert.doesNotMatch(controllerSource, /Talisman|talisman/)
  assert.match(factory, /node\.addComponent\(BossHazardVisualController\)/)
  assert.match(factory, /visual\.graphics = graphics/)
  assert.match(factory, /node\.addComponent\(PoolableActor\)/)
  assert.match(factory, /node\.on\('pool-despawned', visual\.resetVisual, visual\)/)
  assert.match(factory, /visual\.resetVisual\(\)/)
  assert.match(source, /BOSS_HAZARD_POOL_CAPACITY/)
})
