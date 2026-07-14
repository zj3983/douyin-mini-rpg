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
export class Node {}
export class UITransform {}
export class Graphics {}
export class Color { constructor(r = 0, g = 0, b = 0, a = 0) { Object.assign(this, { r, g, b, a }) } }
`

async function loadPresenter() {
  const source = await readFile(new URL('../assets/Scripts/Game/BossTelegraphPresenter.ts', import.meta.url), 'utf8')
  let executable = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, experimentalDecorators: true },
  }).outputText
  const moduleUrl = (text) => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`
  executable = executable
    .replace("from 'cc'", `from '${moduleUrl(ccSource)}'`)
    .replace("from './NodePoolController'", `from '${moduleUrl('export class NodePoolController {}')}'`)
  return import(moduleUrl(executable))
}

class TelegraphNode {
  active = false
  position = { x: 0, y: 0, z: 0 }
  transform = { size: null, setContentSize: (width, height) => { this.transform.size = { width, height } } }
  graphics = {
    calls: [],
    clear() { this.calls = [] },
    rect(x, y, width, height) { this.calls.push({ type: 'rect', x, y, width, height }) },
    fill() { this.calls.push({ type: 'fill' }) },
    stroke() { this.calls.push({ type: 'stroke' }) },
  }
  setPosition(x, y, z) { this.position = { x, y, z } }
  getComponent(Type) {
    if (Type.name === 'UITransform') return this.transform
    if (Type.name === 'Graphics') return this.graphics
    return null
  }
}

class TelegraphPool {
  constructor(capacity) { this.capacity = capacity }
  active = new Set()
  nodes = []
  spawn() {
    if (this.active.size >= this.capacity) return null
    const node = this.nodes.find((candidate) => !this.active.has(candidate)) ?? new TelegraphNode()
    if (!this.nodes.includes(node)) this.nodes.push(node)
    return node
  }
  activateNode(node) { node.active = true; this.active.add(node) }
  despawn(node) { node.active = false; this.active.delete(node) }
  despawnAll() { for (const node of [...this.active]) this.despawn(node) }
}

function telegraph(attackId, area, danger, telegraphId = attackId) {
  return { enemyId: 7, attackId, telegraphId, area, duration: 0.8, visibleAt: 0, activationNotBefore: 0.8, generation: 3, danger }
}

test('Cocos presenter executes show-visible-active-hidden and cancel/reset lifecycle using authoritative areas', async () => {
  const { BossTelegraphPresenter, BOSS_TELEGRAPH_POOL_CAPACITY } = await loadPresenter()
  assert.equal(BOSS_TELEGRAPH_POOL_CAPACITY, 12)
  const pool = new TelegraphPool(BOSS_TELEGRAPH_POOL_CAPACITY)
  const presenter = new BossTelegraphPresenter()
  presenter.telegraphPool = pool
  const area = { minX: -120, maxX: 180, minY: -40, maxY: 68 }
  const warning = telegraph('bamboo-sweep:7:1', area, { kind: 'sweep', escape: 'vertical', origin: { x: 230, y: 40 }, arcDegrees: 120 })

  assert.equal(presenter.present(warning), true)
  assert.equal(presenter.visibleTelegraphCount, 1)
  const warningNode = [...pool.active][0]
  assert.deepEqual(warningNode.position, { x: 30, y: 14, z: 0 })
  assert.deepEqual(warningNode.transform.size, { width: 300, height: 108 })
  assert.deepEqual(warningNode.graphics.calls[0], { type: 'rect', x: -150, y: -54, width: 300, height: 108 })
  assert.equal(warningNode.graphics.calls.some((call) => call.type === 'circle'), false)

  presenter.update(0.4)
  presenter.activate(3, 7, { type: 'activate-hitbox', attackId: warning.attackId, telegraphId: warning.telegraphId, area, damage: 8, duration: 0.18 })
  assert.equal(presenter.visibleTelegraphCount, 1, 'active cannot hide a warning before 0.8 visible seconds')
  presenter.update(0.39)
  assert.equal(presenter.visibleTelegraphCount, 1)
  presenter.update(0.01)
  assert.equal(presenter.visibleTelegraphCount, 0)
  assert.equal(presenter.visibleImpactCount, 1)
  presenter.update(0.18)
  assert.equal(presenter.visibleImpactCount, 0)

  for (let index = 0; index < 3; index += 1) {
    presenter.present(telegraph(`ground-spikes:7:2:marker:${index}`, { minX: index * 60, maxX: index * 60 + 56, minY: -80, maxY: -24 }, { kind: 'spike', markerIndex: index, center: { x: index * 60 + 28, y: -52 } }))
  }
  assert.equal(presenter.visibleTelegraphCount, 3)
  presenter.cancelEnemy(3, 7)
  assert.equal(presenter.visibleTelegraphCount, 0)
  assert.equal(pool.active.size, 0)

  presenter.present(warning)
  presenter.resetGeneration(4)
  assert.equal(pool.active.size, 0)
  presenter.present({ ...warning, generation: 4 })
  presenter.hideAll()
  assert.equal(pool.active.size, 0)

  presenter.present({ ...warning, generation: 4 })
  presenter.update(0.4)
  presenter.present({ ...warning, generation: 4, attackId: 'ground-spikes:7:9:marker:0', telegraphId: 'ground-spikes:7:9:marker:0' })
  presenter.update(0.4)
  presenter.recoverEnemy(4, 7)
  assert.equal(presenter.visibleTelegraphCount, 1, 'one attack recovery cannot hide a newer overlapping warning')
  presenter.onDisable()
  assert.equal(pool.active.size, 0)
})

test('roar sectors fit the planned pool and preserve the explicit safe gap without decorative rings', async () => {
  const { BossTelegraphPresenter, BOSS_TELEGRAPH_POOL_CAPACITY } = await loadPresenter()
  const pool = new TelegraphPool(BOSS_TELEGRAPH_POOL_CAPACITY)
  const presenter = new BossTelegraphPresenter()
  presenter.telegraphPool = pool
  const sectors = ['top', 'bottom', 'right', 'left-upper', 'left-lower']
  for (const [index, sector] of sectors.entries()) {
    assert.equal(presenter.present(telegraph(`mountain-roar:7:3:sector:${sector}`, { minX: index * 20, maxX: index * 20 + 42, minY: -100, maxY: 100 }, { kind: 'roar-sector', waveIndex: -1, radius: 190, sector, safeGap: { sector: 'left', centerAngle: Math.PI, width: Math.PI / 3 } }, 'mountain-roar:7:3')), true)
  }
  assert.equal(presenter.visibleTelegraphCount, 5)
  assert.ok(BOSS_TELEGRAPH_POOL_CAPACITY >= 12)
  assert.equal(pool.nodes.every((node) => node.graphics.calls.every((call) => call.type !== 'circle')), true)

  const firstWave = {
    type: 'activate-hitbox',
    attackId: 'mountain-roar:7:3:wave:0:sector:top',
    telegraphId: 'mountain-roar:7:3',
    area: { minX: -40, maxX: 40, minY: 60, maxY: 102 },
    damage: 6,
    duration: 0.12,
  }
  presenter.activate(3, 7, firstWave)
  presenter.update(0.8)
  assert.equal(presenter.visibleTelegraphCount, 0)
  assert.equal(presenter.visibleImpactCount, 1)
  presenter.activate(3, 7, { ...firstWave, attackId: 'mountain-roar:7:3:wave:1:sector:top' })
  assert.equal(presenter.visibleImpactCount, 2, 'later waves remain visible after the shared warning is consumed')
  presenter.cancelEnemy(3, 7)
  assert.equal(pool.active.size, 0)

  const bootstrap = await readFile(new URL('../assets/Scripts/Game/PortraitBattleBootstrap.ts', import.meta.url), 'utf8')
  assert.match(bootstrap, /BOSS_TELEGRAPH_POOL_CAPACITY/)
})
