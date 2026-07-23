import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const ccSource = `
export const _decorator = {
  ccclass: () => (target) => target,
  property: (...args) => args.length >= 2 ? undefined : () => undefined,
}
export class Component {}
export class Color {
  constructor(r = 0, g = 0, b = 0, a = 255) {
    this.r = r
    this.g = g
    this.b = b
    this.a = a
  }
}
export class Graphics {
  calls = []
  clear() { this.calls.push('clear') }
}
export class Sprite {
  constructor(node = null) {
    this.node = node
    this.spriteFrame = null
    this.color = new Color()
  }
}
export class SpriteFrame {}
export class UITransform {
  contentSize = { width: 0, height: 0 }
  setContentSize(width, height) { this.contentSize = { width, height } }
}
`

class MockNode {
  constructor(transform) {
    this.transform = transform
    this.scale = { x: 4, y: 5, z: 6 }
    this.angle = 37
  }

  getComponent(Type) {
    return Type.name === 'UITransform' ? this.transform : null
  }

  setScale(x, y, z) {
    this.scale = { x, y, z }
  }

  setRotationFromEuler(_x, _y, z) {
    this.angle = z
  }
}

async function loadController() {
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
  return import(`data:text/javascript;base64,${Buffer.from(executable).toString('base64')}`)
}

function createHarness(Controller) {
  const transform = {
    contentSize: { width: 0, height: 0 },
    setContentSize(width, height) { this.contentSize = { width, height } },
  }
  const node = new MockNode(transform)
  const graphics = { calls: [], clear() { this.calls.push('clear') } }
  const sprite = {
    node,
    spriteFrame: null,
    color: { r: 255, g: 255, b: 255, a: 255 },
  }
  const controller = new Controller()
  controller.graphics = graphics
  controller.talisman = sprite
  return { controller, graphics, node, sprite, transform }
}

test('twenty sweep spike roar despawn cycles restore the pooled visual state', async () => {
  const { BossHazardVisualController } = await loadController()
  const harness = createHarness(BossHazardVisualController)

  for (let cycle = 0; cycle < 20; cycle += 1) {
    for (const hazard of ['sweep', 'spike', 'roar']) {
      harness.graphics.calls.push(hazard)
      harness.sprite.spriteFrame = { hazard, cycle }
      harness.sprite.color = { r: cycle, g: 80, b: 120, a: 230 }
      harness.node.scale = { x: 1.5, y: 0.7, z: 2 }
      harness.node.angle = 15 + cycle
    }

    harness.controller.resetVisual()

    assert.equal(harness.graphics.calls.at(-1), 'clear')
    assert.equal(harness.sprite.spriteFrame, null)
    assert.equal(harness.sprite.color.a, 0)
    assert.deepEqual(harness.node.scale, { x: 1, y: 1, z: 1 })
    assert.equal(harness.node.angle, 0)
  }
})

test('setTalisman assigns its frame and color and clamps dimensions to 112', async () => {
  const { BossHazardVisualController } = await loadController()
  const harness = createHarness(BossHazardVisualController)
  const frame = { id: 'sweep-frame' }
  const color = { r: 141, g: 232, b: 218, a: 190 }

  harness.controller.setTalisman(frame, color, 180, 96)

  assert.strictEqual(harness.sprite.spriteFrame, frame)
  assert.strictEqual(harness.sprite.color, color)
  assert.deepEqual(harness.transform.contentSize, { width: 112, height: 96 })
})

test('controller methods are null-safe when optional visual bindings are absent', async () => {
  const { BossHazardVisualController } = await loadController()
  const controller = new BossHazardVisualController()

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
