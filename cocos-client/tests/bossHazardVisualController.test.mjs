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
  color = new Color()
}
export class SpriteFrame {}
export class UITransform extends Component {
  contentSize = { width: 0, height: 0 }
  setContentSize(width, height) { this.contentSize = { width, height } }
}
export class Node {
  constructor(name = '') {
    this.name = name
    this.parent = null
    this.children = []
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
  setScale(x, y, z) { this.scale = { x, y, z } }
  setRotationFromEuler(_x, _y, z) { this.angle = z }
}
`

async function loadRuntime() {
  const source = await readFile(new URL('../assets/Scripts/Game/BossHazardVisualController.ts', import.meta.url), 'utf8')
  let executable = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      experimentalDecorators: true,
    },
  }).outputText
  const ccUrl = `data:text/javascript;base64,${Buffer.from(ccSource).toString('base64')}`
  executable = executable.replace("from 'cc'", `from '${ccUrl}'`)
  const [controllerRuntime, cc] = await Promise.all([
    import(`data:text/javascript;base64,${Buffer.from(executable).toString('base64')}`),
    import(ccUrl),
  ])
  return { ...controllerRuntime, cc }
}

function createHarness(cc, Controller) {
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
  node.on('pool-despawned', controller.resetVisual, controller)
  controller.resetVisual()
  return { controller, graphics, node, sprite, talismanNode, transform }
}

test('twenty sweep spike roar despawn cycles restore the pooled visual state', async () => {
  const { BossHazardVisualController, cc } = await loadRuntime()
  const harness = createHarness(cc, BossHazardVisualController)
  const persistentTalisman = harness.talismanNode

  assert.equal(harness.node.children.length, 1)
  assert.strictEqual(harness.node.children[0], persistentTalisman)

  for (let cycle = 0; cycle < 20; cycle += 1) {
    for (const hazard of ['sweep', 'spike', 'roar']) {
      harness.graphics.calls.push(hazard)
      harness.sprite.spriteFrame = { hazard, cycle }
      harness.sprite.color = { r: cycle, g: 80, b: 120, a: 230 }
      harness.talismanNode.setScale(1.5, 0.7, 2)
      harness.talismanNode.setRotationFromEuler(0, 0, 15 + cycle)
    }

    harness.node.emit('pool-despawned', cycle)

    assert.equal(harness.graphics.calls.at(-1), 'clear')
    assert.equal(harness.sprite.spriteFrame, null)
    assert.equal(harness.sprite.color.a, 0)
    assert.deepEqual(harness.talismanNode.scale, { x: 1, y: 1, z: 1 })
    assert.equal(harness.talismanNode.angle, 0)
    assert.equal(harness.node.children.length, 1)
    assert.strictEqual(harness.node.children[0], persistentTalisman)
  }
})

test('setTalisman assigns its frame and color and clamps dimensions to 112', async () => {
  const { BossHazardVisualController, cc } = await loadRuntime()
  const harness = createHarness(cc, BossHazardVisualController)
  const frame = { id: 'sweep-frame' }
  const color = { r: 141, g: 232, b: 218, a: 190 }

  harness.controller.setTalisman(frame, color, 180, 96)

  assert.strictEqual(harness.sprite.spriteFrame, frame)
  assert.strictEqual(harness.sprite.color, color)
  assert.deepEqual(harness.transform.contentSize, { width: 112, height: 96 })
})

test('setTalisman clamps height independently when width is below 112', async () => {
  const { BossHazardVisualController, cc } = await loadRuntime()
  const harness = createHarness(cc, BossHazardVisualController)

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
