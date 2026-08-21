import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

import {
  createBambooWardenBrain,
  setBossHealthRatio,
  stepBambooWarden,
} from '../assets/Scripts/Combat/BossBrain.ts'

const LAYER_FIELDS = Object.freeze(['mainShape', 'accent', 'particleNear', 'particleFar'])
const RESOURCE_PATHS = Object.freeze([
  'Assets/Skills/BossDomain/sweep_arc/spriteFrame',
  'Assets/Skills/BossDomain/sweep_trail/spriteFrame',
  'Assets/Skills/BossDomain/leaf_particle/spriteFrame',
  'Assets/Skills/BossDomain/spike_cluster/spriteFrame',
  'Assets/Skills/BossDomain/ground_dust/spriteFrame',
  'Assets/Skills/BossDomain/impact_spark/spriteFrame',
  'Assets/Skills/BossDomain/roar_wave/spriteFrame',
])
const PROFILE_CASES = Object.freeze([
  Object.freeze({
    id: 'sweep-arc',
    attackId: 'bamboo-sweep:7:visual',
    area: Object.freeze({ minX: -180, maxX: 140, minY: -60, maxY: 52 }),
    danger: Object.freeze({ kind: 'sweep', escape: 'vertical', origin: Object.freeze({ x: 210, y: 24 }), arcDegrees: 120 }),
    paths: Object.freeze([
      'Assets/Skills/BossDomain/sweep_arc/spriteFrame',
      'Assets/Skills/BossDomain/sweep_trail/spriteFrame',
      'Assets/Skills/BossDomain/leaf_particle/spriteFrame',
    ]),
  }),
  Object.freeze({
    id: 'spike-eruption',
    attackId: 'ground-spikes:7:visual:marker:0',
    area: Object.freeze({ minX: 20, maxX: 84, minY: -140, maxY: -76 }),
    danger: Object.freeze({ kind: 'spike', markerIndex: 0, center: Object.freeze({ x: 52, y: -108 }) }),
    paths: Object.freeze([
      'Assets/Skills/BossDomain/spike_cluster/spriteFrame',
      'Assets/Skills/BossDomain/ground_dust/spriteFrame',
      'Assets/Skills/BossDomain/impact_spark/spriteFrame',
    ]),
  }),
  Object.freeze({
    id: 'roar-wave',
    attackId: 'mountain-roar:7:visual:sector:top',
    area: Object.freeze({ minX: -90, maxX: 90, minY: 120, maxY: 190 }),
    danger: Object.freeze({
      kind: 'roar-sector',
      waveIndex: -1,
      radius: 190,
      sector: 'top',
      safeGap: Object.freeze({ sector: 'left', centerAngle: Math.PI, width: Math.PI / 3 }),
    }),
    paths: Object.freeze([
      'Assets/Skills/BossDomain/roar_wave/spriteFrame',
      'Assets/Skills/BossDomain/ground_dust/spriteFrame',
      'Assets/Skills/BossDomain/leaf_particle/spriteFrame',
    ]),
  }),
])

const ccSource = `
export const _decorator = {
  ccclass: () => (target) => target,
  property: (...args) => args.length >= 2 ? undefined : () => undefined,
}
export class Component { constructor() { this.node = { isValid: true }; this.isValid = true } }
export class Node {}
export class UITransform {}
export class Graphics {}
export class Sprite {}
export class Color {
  constructor(r = 0, g = 0, b = 0, a = 0) {
    globalThis.__bossColorAllocations = (globalThis.__bossColorAllocations ?? 0) + 1
    this.set(r, g, b, a)
  }
  set(r, g, b, a) { Object.assign(this, { r, g, b, a }); return this }
}
export class SpriteFrame {
  constructor(id = '') {
    this.id = id
    this.refCount = 0
    this.destroyed = false
    this.addRefCalls = 0
    this.decRefCalls = 0
  }
  addRef() {
    if (this.destroyed) throw new Error('cannot acquire a destroyed SpriteFrame')
    this.addRefCalls += 1
    this.refCount += 1
    return this
  }
  decRef(autoRelease = false) {
    if (this.refCount <= 0) throw new Error('SpriteFrame reference underflow')
    this.decRefCalls += 1
    this.refCount -= 1
    if (autoRelease && this.refCount === 0) this.destroyed = true
    return this
  }
}
export const resources = {
  load(path, Type, callback) { globalThis.__bossTelegraphResources.load(path, Type, callback) },
  release(path, Type) { globalThis.__bossTelegraphResources.release(path, Type) },
}
`

const controllerSource = `
export class BossHazardVisualController {
  resetVisual() {
    this.mainShape = null
    this.accent = null
    this.particleNear = null
    this.particleFar = null
  }
  setLayerFrames(main, accent, particle) {}
  setLayerSizes(width, height) {}
}
`

async function loadPresenter({ failedPaths = [], deferred = false } = {}) {
  const loadedPaths = []
  const releaseCalls = []
  const pendingLoads = []
  const frames = new Map()
  const failed = new Set(failedPaths)
  const frameFor = (path, Type) => {
    const cached = frames.get(path)
    if (cached && !cached.destroyed) return cached
    const frame = new Type(path)
    frames.set(path, frame)
    return frame
  }
  globalThis.__bossColorAllocations = 0
  globalThis.__bossTelegraphResources = {
    load(path, Type, callback) {
      loadedPaths.push(path)
      const pending = { path, Type, callback }
      if (deferred) pendingLoads.push(pending)
      else callback(failed.has(path) ? new Error(`missing ${path}`) : null, failed.has(path) ? null : frameFor(path, Type))
    },
    release(path, Type) {
      releaseCalls.push({ path, Type })
      const frame = frames.get(path)
      if (frame) {
        frame.refCount = 0
        frame.destroyed = true
      }
    },
  }
  const source = await readFile(new URL('../assets/Scripts/Game/BossTelegraphPresenter.ts', import.meta.url), 'utf8')
  let executable = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, experimentalDecorators: true },
  }).outputText
  const moduleUrl = (text) => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`
  executable = executable
    .replace("from 'cc'", `from '${moduleUrl(ccSource)}'`)
    .replace("from '../Combat/BossBrain.ts'", `from '${new URL('../assets/Scripts/Combat/BossBrain.ts', import.meta.url).href}'`)
    .replace("from '../Core/BossTelegraphVisualProfile.ts'", `from '${new URL('../assets/Scripts/Core/BossTelegraphVisualProfile.ts', import.meta.url).href}'`)
    .replace("from './BossHazardVisualController'", `from '${moduleUrl(controllerSource)}'`)
    .replace("from './NodePoolController'", `from '${moduleUrl('export class NodePoolController {}')}'`)
  return {
    ...await import(moduleUrl(executable)),
    loadedPaths,
    releaseCalls,
    frames,
    completeLoad(path, error = null, pathIndex = 0) {
      let remaining = pathIndex
      const index = pendingLoads.findIndex((pending) => {
        if (pending.path !== path) return false
        if (remaining > 0) {
          remaining -= 1
          return false
        }
        return true
      })
      assert.notEqual(index, -1, `pending resource ${path}`)
      const [pending] = pendingLoads.splice(index, 1)
      pending.callback(error, error ? null : frameFor(path, pending.Type))
    },
  }
}

function createSpriteMock(name) {
  let visibleColor = { r: 255, g: 255, b: 255, a: 0 }
  const node = {
    name,
    active: false,
    position: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    eulerAngles: { x: 0, y: 0, z: 0 },
    size: { width: 1, height: 1 },
    setPosition(x, y, z) { Object.assign(this.position, { x, y, z }) },
    setScale(x, y, z) { Object.assign(this.scale, { x, y, z }) },
    setRotationFromEuler(x, y, z) { Object.assign(this.eulerAngles, { x, y, z }) },
  }
  return {
    name,
    node,
    enabled: true,
    spriteFrame: null,
    colorAssignments: 0,
    lastAssignedInput: null,
    previousAssignedInput: null,
    get color() {
      return {
        ...visibleColor,
        set(r, g, b, a) { Object.assign(this, { r, g, b, a }); return this },
      }
    },
    set color(value) {
      this.colorAssignments += 1
      this.previousAssignedInput = this.lastAssignedInput
      this.lastAssignedInput = value
      visibleColor = { r: value.r, g: value.g, b: value.b, a: value.a }
    },
  }
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
    moveTo(x, y) { this.calls.push({ type: 'moveTo', x, y }) },
    lineTo(x, y) { this.calls.push({ type: 'lineTo', x, y }) },
    circle(x, y, radius) { this.calls.push({ type: 'circle', x, y, radius }) },
    ellipse(x, y, radiusX, radiusY) { this.calls.push({ type: 'ellipse', x, y, radiusX, radiusY }) },
    stroke() { this.calls.push({ type: 'stroke' }) },
  }
  mainShape = createSpriteMock('MainShape')
  accent = createSpriteMock('Accent')
  particleNear = createSpriteMock('ParticleNear')
  particleFar = createSpriteMock('ParticleFar')
  layers = {
    mainShape: this.mainShape,
    accent: this.accent,
    particleNear: this.particleNear,
    particleFar: this.particleFar,
  }
  componentLookups = 0
  controller = {
    mainShape: this.mainShape,
    accent: this.accent,
    particleNear: this.particleNear,
    particleFar: this.particleFar,
    frameCalls: [],
    sizeCalls: [],
    resetVisual: () => {
      for (const layer of Object.values(this.layers)) {
        layer.spriteFrame = null
        layer.color = { r: 255, g: 255, b: 255, a: 0 }
        layer.enabled = true
        layer.node.active = false
        layer.node.setPosition(0, 0, 0)
        layer.node.setScale(1, 1, 1)
        layer.node.setRotationFromEuler(0, 0, 0)
        Object.assign(layer.node.size, { width: 1, height: 1 })
      }
    },
    setLayerFrames: (main, accent, particle) => {
      this.mainShape.spriteFrame = main
      this.accent.spriteFrame = accent
      this.particleNear.spriteFrame = particle
      this.particleFar.spriteFrame = particle
      this.controller.frameCalls.push([main, accent, particle])
    },
    setLayerSizes: (width, height) => {
      const factors = { mainShape: 1, accent: 0.9, particleNear: 0.7, particleFar: 0.5 }
      for (const field of LAYER_FIELDS) {
        Object.assign(this.layers[field].node.size, {
          width: width * factors[field],
          height: height * factors[field],
        })
      }
      this.controller.sizeCalls.push({ width, height })
    },
  }
  setPosition(x, y, z) { this.position = { x, y, z } }
  getComponent(Type) {
    this.componentLookups += 1
    if (Type.name === 'UITransform') return this.transform
    if (Type.name === 'Graphics') return this.graphics
    if (Type.name === 'BossHazardVisualController') return this.controller
    return null
  }
}

class TelegraphPool {
  constructor(capacity) { this.capacity = capacity }
  active = new Set()
  nodes = []
  activationLog = []
  maxActive = 0
  frame = 0
  sameFrameImpactDespawns = 0
  spawn() {
    if (this.active.size >= this.capacity) return null
    const node = this.nodes.find((candidate) => !this.active.has(candidate)) ?? new TelegraphNode()
    if (!this.nodes.includes(node)) this.nodes.push(node)
    return node
  }
  activateNode(node) {
    node.active = true
    this.active.add(node)
    this.maxActive = Math.max(this.maxActive, this.active.size)
    const { x, y } = node.position
    const { width, height } = node.transform.size
    const phase = node.graphics.lineWidth === 4 ? 'impact' : 'telegraph'
    this.activationLog.push({
      kind: phase,
      area: { minX: x - width / 2, maxX: x + width / 2, minY: y - height / 2, maxY: y + height / 2 },
    })
    node.hazardKind = phase
    node.activatedFrame = this.frame
  }
  despawn(node) {
    if (node.hazardKind === 'impact' && node.activatedFrame === this.frame) this.sameFrameImpactDespawns += 1
    node.active = false
    this.active.delete(node)
  }
  despawnAll() { for (const node of [...this.active]) this.despawn(node) }
}

function areaKey(area) {
  return [area.minX, area.maxX, area.minY, area.maxY].map((value) => Math.round(value * 1e9) / 1e9).join(':')
}

function visualIdForFrame(frame) {
  if (frame?.id.includes('spike_cluster')) return 'spike-eruption'
  if (frame?.id.includes('roar_wave')) return 'roar-wave'
  if (frame?.id.includes('sweep_arc')) return 'sweep-arc'
  return null
}

function frameIds(node) {
  return LAYER_FIELDS.map((field) => node.layers[field].spriteFrame?.id ?? null)
}

function layerVisibility(node) {
  return Object.fromEntries(LAYER_FIELDS.map((field) => [field, {
    active: node.layers[field].node.active,
    enabled: node.layers[field].enabled,
  }]))
}

function layerGeometry(node) {
  return Object.fromEntries(LAYER_FIELDS.map((field) => {
    const layer = node.layers[field]
    return [field, {
      position: { ...layer.node.position },
      scale: { ...layer.node.scale },
      eulerAngles: { ...layer.node.eulerAngles },
      size: { ...layer.node.size },
    }]
  }))
}

function commandAttack(command) {
  if (!('attackId' in command)) return null
  if (command.attackId.startsWith('mountain-roar:')) return 'mountain-roar'
  if (command.attackId.startsWith('ground-spikes:')) return 'ground-spikes'
  if (command.attackId.startsWith('bamboo-sweep:')) return 'bamboo-sweep'
  return null
}

function deliverBossCommands(presenter, commands, expected, pairAttacks) {
  for (const command of commands) {
    const attack = commandAttack(command)
    if (attack) {
      const sequence = Number(command.attackId.split(':')[2])
      const pairIndex = Math.floor((sequence - 1) / 2)
      const attacks = pairAttacks.get(pairIndex) ?? new Set()
      attacks.add(attack)
      pairAttacks.set(pairIndex, attacks)
    }
    if (command.type === 'show-telegraph' && command.danger) {
      expected.telegraph.push(areaKey(command.area))
      presenter.present({
        enemyId: 7,
        attackId: command.attackId,
        telegraphId: command.telegraphId ?? command.attackId,
        area: command.area,
        duration: command.duration,
        visibleAt: command.eventTime ?? 0,
        activationNotBefore: command.activatesAt ?? (command.eventTime ?? 0) + command.duration,
        generation: 1,
        danger: command.danger,
      })
    } else if (command.type === 'activate-hitbox' && command.danger) {
      expected.impact.push(areaKey(command.area))
      presenter.activate(1, 7, command)
    }
  }
}

async function runPeakSimulation(BossTelegraphPresenter, capacity, seed, deltaSeconds, updateOrder) {
  const pool = new TelegraphPool(capacity)
  const presenter = new BossTelegraphPresenter()
  presenter.telegraphPool = pool
  const boss = createBambooWardenBrain(7, { x: 260, y: 40 }, seed)
  setBossHealthRatio(boss, 0.49)
  const expected = { telegraph: [], impact: [] }
  const pairAttacks = new Map()
  const frameCount = Math.ceil(9 / deltaSeconds)
  for (let frame = 0; frame < frameCount; frame += 1) {
    pool.frame = frame
    const context = {
      now: boss.elapsed + deltaSeconds,
      player: { id: 'player', position: { x: -120, y: Math.sin(frame * deltaSeconds * 1.7) * 120 }, alive: true },
      neighbors: [],
      battleBounds: { minX: -360, maxX: 360, minY: -420, maxY: 420 },
    }
    if (updateOrder === 'presenter-first') presenter.update(deltaSeconds)
    deliverBossCommands(presenter, stepBambooWarden(boss, context, deltaSeconds), expected, pairAttacks)
    if (updateOrder === 'enemy-first') presenter.update(deltaSeconds)
  }
  for (let index = 0; index < 5; index += 1) presenter.update(0.25)
  const actual = {
    telegraph: pool.activationLog.filter((entry) => entry.kind === 'telegraph').map((entry) => areaKey(entry.area)),
    impact: pool.activationLog.filter((entry) => entry.kind === 'impact').map((entry) => areaKey(entry.area)),
  }
  assert.equal(actual.telegraph.length, expected.telegraph.length, `telegraph count seed=${seed} dt=${deltaSeconds} order=${updateOrder}`)
  assert.equal(actual.impact.length, expected.impact.length, `impact count seed=${seed} dt=${deltaSeconds} order=${updateOrder}`)
  assert.deepEqual(actual.telegraph.toSorted(), expected.telegraph.toSorted(), `telegraph omission seed=${seed} dt=${deltaSeconds} order=${updateOrder}`)
  assert.deepEqual(actual.impact.toSorted(), expected.impact.toSorted(), `impact omission seed=${seed} dt=${deltaSeconds} order=${updateOrder}`)
  assert.equal(pool.sameFrameImpactDespawns, 0, `impact hidden before render seed=${seed} dt=${deltaSeconds} order=${updateOrder}`)
  assert.ok(pool.maxActive <= capacity)
  const pairs = new Set([...pairAttacks.values()].flatMap((attacks) => {
    if (!attacks.has('mountain-roar')) return []
    if (attacks.has('ground-spikes')) return ['roar+spikes']
    if (attacks.has('bamboo-sweep')) return ['roar+sweep']
    return []
  }))
  return { pairs, peak: pool.maxActive }
}

function telegraph(attackId, area, danger, telegraphId = attackId) {
  return { enemyId: 7, attackId, telegraphId, area, duration: 0.8, visibleAt: 0, activationNotBefore: 0.8, generation: 3, danger }
}

test('preloads seven unique resources once and maps all profile layers for warnings and impacts', async () => {
  const { BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY, frames, loadedPaths } = await loadPresenter()
  const presenter = new BossTelegraphPresenter()
  const pool = new TelegraphPool(BOSS_HAZARD_POOL_CAPACITY)
  presenter.telegraphPool = pool
  presenter.onLoad()
  presenter.onLoad()

  assert.deepEqual(loadedPaths, RESOURCE_PATHS)
  assert.equal(new Set(loadedPaths).size, 7)
  assert.equal(frames.size, 7)
  assert.ok([...frames.values()].every((frame) => frame.refCount === 1 && frame.addRefCalls === 1))

  for (const entry of PROFILE_CASES) {
    assert.equal(presenter.present(telegraph(entry.attackId, entry.area, entry.danger), 'full'), true, entry.id)
  }

  const warningNodes = [...pool.active]
  assert.equal(warningNodes.length, 3)
  assert.deepEqual(
    warningNodes.map((node) => visualIdForFrame(node.mainShape.spriteFrame)),
    PROFILE_CASES.map(({ id }) => id),
  )
  for (const [index, node] of warningNodes.entries()) {
    const entry = PROFILE_CASES[index]
    assert.deepEqual(frameIds(node), [...entry.paths, entry.paths[2]], `${entry.id} warning frames`)
    assert.deepEqual(node.controller.frameCalls.at(-1).map((frame) => frame?.id ?? null), entry.paths)
    assert.deepEqual(node.controller.sizeCalls.at(-1), {
      width: entry.area.maxX - entry.area.minX,
      height: entry.area.maxY - entry.area.minY,
    })
    assert.equal(areaKey({
      minX: node.position.x - node.transform.size.width / 2,
      maxX: node.position.x + node.transform.size.width / 2,
      minY: node.position.y - node.transform.size.height / 2,
      maxY: node.position.y + node.transform.size.height / 2,
    }), areaKey(entry.area), `${entry.id} authority geometry`)
    assert.ok(node.graphics.calls.length > 0, `${entry.id} has linework`)
    assert.equal(
      node.graphics.calls.some((call) => ['rect', 'fill', 'circle', 'ellipse'].includes(call.type)),
      false,
      `${entry.id} stays open and glyph-free`,
    )
  }
  assert.equal(
    new Set(warningNodes.map((node) => JSON.stringify(node.graphics.calls))).size,
    3,
    'sweep, spike, and roar Graphics signatures differ',
  )

  for (const entry of PROFILE_CASES) {
    presenter.activate(3, 7, {
      type: 'activate-hitbox',
      attackId: entry.attackId,
      telegraphId: entry.attackId,
      area: entry.area,
      damage: 8,
      duration: 0.18,
      danger: entry.danger,
    }, 'full')
  }
  presenter.update(0.8)

  const impactNodes = [...pool.active]
  assert.equal(presenter.visibleTelegraphCount, 0)
  assert.equal(presenter.visibleImpactCount, 3)
  assert.equal(impactNodes.length, 3)
  for (const [index, node] of impactNodes.entries()) {
    const entry = PROFILE_CASES[index]
    assert.deepEqual(frameIds(node), [...entry.paths, entry.paths[2]], `${entry.id} impact frames`)
    assert.deepEqual(node.controller.frameCalls.at(-1).map((frame) => frame?.id ?? null), entry.paths)
    assert.deepEqual(node.controller.sizeCalls.at(-1), {
      width: entry.area.maxX - entry.area.minX,
      height: entry.area.maxY - entry.area.minY,
    })
    assert.equal(node.graphics.lineWidth, 4)
    assert.ok(node.graphics.calls.some((call) => call.type === 'stroke'))
  }
})

test('full reduced and minimal quality select the required four-layer visibility', async () => {
  const { BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY } = await loadPresenter()
  const presenter = new BossTelegraphPresenter()
  const pool = new TelegraphPool(BOSS_HAZARD_POOL_CAPACITY)
  presenter.telegraphPool = pool
  presenter.onLoad()
  const qualities = ['full', 'reduced', 'minimal']

  for (const [index, quality] of qualities.entries()) {
    const entry = PROFILE_CASES[index]
    assert.equal(presenter.present(telegraph(entry.attackId, entry.area, entry.danger), quality), true)
  }

  const [full, reduced, minimal] = [...pool.active]
  assert.deepEqual(layerVisibility(full), {
    mainShape: { active: true, enabled: true },
    accent: { active: true, enabled: true },
    particleNear: { active: true, enabled: true },
    particleFar: { active: true, enabled: true },
  })
  assert.deepEqual(layerVisibility(reduced), {
    mainShape: { active: true, enabled: true },
    accent: { active: true, enabled: true },
    particleNear: { active: true, enabled: true },
    particleFar: { active: false, enabled: false },
  })
  assert.deepEqual(layerVisibility(minimal), {
    mainShape: { active: true, enabled: true },
    accent: { active: false, enabled: false },
    particleNear: { active: false, enabled: false },
    particleFar: { active: false, enabled: false },
  })
  for (const node of [full, reduced, minimal]) {
    assert.ok(node.graphics.calls.some((call) => call.type === 'stroke'))
    assert.ok(node.mainShape.spriteFrame)
  }
  const warningVisibility = [full, reduced, minimal].map((node) => structuredClone(layerVisibility(node)))

  for (const [index, quality] of qualities.entries()) {
    const entry = PROFILE_CASES[index]
    presenter.activate(3, 7, {
      type: 'activate-hitbox',
      attackId: entry.attackId,
      telegraphId: entry.attackId,
      area: entry.area,
      damage: 8,
      duration: 0.18,
      danger: entry.danger,
    }, quality)
  }
  presenter.update(0.8)
  const impacts = [...pool.active]
  assert.equal(presenter.visibleImpactCount, 3)
  assert.deepEqual(impacts.map((node) => layerVisibility(node)), warningVisibility)
  assert.ok(impacts.every((node) => node.graphics.calls.some((call) => call.type === 'stroke')))
})

test('boss phase changes cached layer alpha without geometry drift or update-time allocations and lookups', async () => {
  const { BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY, loadedPaths } = await loadPresenter()
  const presenter = new BossTelegraphPresenter()
  const pool = new TelegraphPool(BOSS_HAZARD_POOL_CAPACITY)
  presenter.telegraphPool = pool
  presenter.onLoad()
  const entry = PROFILE_CASES[0]
  presenter.present(telegraph(entry.attackId, entry.area, entry.danger), 'full')

  const node = [...pool.active][0]
  const visual = [...presenter.groups.values()][0].visuals[0]
  const phaseOutput = visual.phase
  const reusableColors = LAYER_FIELDS.map((field) => node.layers[field].lastAssignedInput)
  const before = {
    alpha: node.mainShape.color.a,
    colorAllocations: globalThis.__bossColorAllocations,
    graphics: structuredClone(node.graphics.calls),
    layerGeometry: layerGeometry(node),
    loadedPathCount: loadedPaths.length,
    lookups: node.componentLookups,
    position: { ...node.position },
    size: { ...node.transform.size },
    stroke: { ...node.graphics.strokeColor },
  }
  assert.deepEqual(phaseOutput, { progress: 0, phase: 'warning', intensity: 0.32, travel: 0 })
  assert.strictEqual(visual.controller, node.controller)
  for (const field of LAYER_FIELDS) assert.strictEqual(visual[field], node.layers[field])

  presenter.update(0.2)
  assert.strictEqual(visual.phase, phaseOutput)
  assert.deepEqual(phaseOutput, { progress: 0.25, phase: 'warning', intensity: 0.44, travel: 0 })
  assert.notEqual(node.mainShape.color.a, before.alpha)
  presenter.update(0.4)
  assert.strictEqual(visual.phase, phaseOutput)
  assert.deepEqual(phaseOutput, { progress: 0.75, phase: 'critical', intensity: 0.75, travel: 0.167 })
  for (let index = 0; index < 120; index += 1) presenter.update(0.0005)

  for (const [index, field] of LAYER_FIELDS.entries()) {
    assert.strictEqual(node.layers[field].lastAssignedInput, reusableColors[index], `${field} color identity`)
  }
  assert.equal(globalThis.__bossColorAllocations, before.colorAllocations)
  assert.equal(loadedPaths.length, before.loadedPathCount)
  assert.equal(node.componentLookups, before.lookups)
  assert.deepEqual({ ...node.graphics.strokeColor }, before.stroke)
  assert.deepEqual(node.position, before.position)
  assert.deepEqual(node.transform.size, before.size)
  assert.deepEqual(layerGeometry(node), before.layerGeometry)
  assert.deepEqual(node.graphics.calls, before.graphics)
})

test('deferred preload affects subsequent warnings only and never retrofits an active warning', async () => {
  const sweepPath = RESOURCE_PATHS[0]
  const { BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY, completeLoad } = await loadPresenter({ deferred: true })
  const presenter = new BossTelegraphPresenter()
  const pool = new TelegraphPool(BOSS_HAZARD_POOL_CAPACITY)
  presenter.telegraphPool = pool
  presenter.onLoad()
  const danger = { kind: 'sweep', escape: 'vertical', origin: { x: 0, y: 0 }, arcDegrees: 120 }

  presenter.present(telegraph('bamboo-sweep:7:deferred:before', { minX: -80, maxX: 80, minY: -30, maxY: 30 }, danger))
  const first = [...pool.active][0]
  assert.deepEqual(frameIds(first), [null, null, null, null])
  assert.ok(first.graphics.calls.some((call) => call.type === 'stroke'))

  completeLoad(sweepPath)
  assert.deepEqual(frameIds(first), [null, null, null, null], 'completed preload does not retrofit an active warning')
  presenter.present(telegraph('bamboo-sweep:7:deferred:after', { minX: -70, maxX: 70, minY: 40, maxY: 100 }, danger))
  const second = [...pool.active][1]
  assert.deepEqual(frameIds(second), [sweepPath, null, null, null])
})

test('deferred success after destruction preserves another presenter ownership for all seven paths', async () => {
  const { BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY, completeLoad, frames, releaseCalls } = await loadPresenter({ deferred: true })
  const oldPresenter = new BossTelegraphPresenter()
  const newPresenter = new BossTelegraphPresenter()
  oldPresenter.telegraphPool = new TelegraphPool(BOSS_HAZARD_POOL_CAPACITY)
  newPresenter.telegraphPool = new TelegraphPool(BOSS_HAZARD_POOL_CAPACITY)
  oldPresenter.onLoad()
  newPresenter.onLoad()

  oldPresenter.onDestroy()
  for (const path of RESOURCE_PATHS) completeLoad(path, null, 1)
  for (const path of RESOURCE_PATHS) completeLoad(path)

  assert.equal(oldPresenter.vfxFrames.size, 0)
  assert.equal(newPresenter.vfxFrames.size, 7)
  for (const path of RESOURCE_PATHS) {
    const sharedFrame = frames.get(path)
    assert.strictEqual(newPresenter.vfxFrames.get(path), sharedFrame)
    assert.equal(sharedFrame.refCount, 1, `${path} new presenter ownership`)
    assert.equal(sharedFrame.destroyed, false, `${path} late callback cannot destroy shared resource`)
    assert.equal(sharedFrame.addRefCalls, 2, `${path} acquisition count`)
    assert.equal(sharedFrame.decRefCalls, 1, `${path} late cleanup count`)
  }
  assert.deepEqual(releaseCalls, [])
  assert.equal(oldPresenter.present(telegraph('bamboo-sweep:7:destroyed', { minX: -20, maxX: 20, minY: -20, maxY: 20 }, { kind: 'sweep' })), false)

  newPresenter.onDestroy()
  for (const frame of frames.values()) {
    assert.equal(frame.refCount, 0)
    assert.equal(frame.destroyed, true)
    assert.equal(frame.addRefCalls, 2)
    assert.equal(frame.decRefCalls, 2)
  }
})

test('late preload success with no owner is safely acquired and released for all seven paths', async () => {
  const { BossTelegraphPresenter, completeLoad, frames, releaseCalls } = await loadPresenter({ deferred: true })
  const presenter = new BossTelegraphPresenter()

  presenter.onLoad()
  presenter.onDestroy()
  for (const path of RESOURCE_PATHS) completeLoad(path)

  assert.equal(frames.size, 7)
  for (const frame of frames.values()) {
    assert.equal(frame.refCount, 0)
    assert.equal(frame.destroyed, true)
    assert.equal(frame.addRefCalls, 1)
    assert.equal(frame.decRefCalls, 1)
  }
  assert.deepEqual(releaseCalls, [])
})

test('two presenters acquire independent ownership of all seven shared frames', async () => {
  const { BossTelegraphPresenter, frames, releaseCalls } = await loadPresenter()
  const first = new BossTelegraphPresenter()
  const second = new BossTelegraphPresenter()

  first.onLoad()
  second.onLoad()
  assert.equal(frames.size, 7)
  for (const path of RESOURCE_PATHS) {
    const sharedFrame = frames.get(path)
    assert.strictEqual(first.vfxFrames.get(path), sharedFrame)
    assert.strictEqual(second.vfxFrames.get(path), sharedFrame)
    assert.equal(sharedFrame.refCount, 2)
    assert.equal(sharedFrame.addRefCalls, 2)
  }

  first.onDestroy()
  for (const frame of frames.values()) {
    assert.equal(frame.refCount, 1)
    assert.equal(frame.destroyed, false)
    assert.equal(frame.decRefCalls, 1)
  }

  second.onDestroy()
  for (const frame of frames.values()) {
    assert.equal(frame.refCount, 0)
    assert.equal(frame.destroyed, true)
    assert.equal(frame.decRefCalls, 2)
  }
  assert.deepEqual(releaseCalls, [])
})

test('repeated destroy decrements each successfully held frame exactly once', async () => {
  const { BossTelegraphPresenter, frames, releaseCalls } = await loadPresenter()
  const presenter = new BossTelegraphPresenter()

  presenter.onLoad()
  const heldFrames = [...frames.values()]
  assert.equal(heldFrames.length, 7)
  assert.ok(heldFrames.every((frame) => frame.refCount === 1))

  presenter.onDestroy()
  presenter.onDestroy()

  assert.ok(heldFrames.every((frame) => frame.refCount === 0 && frame.destroyed))
  assert.ok(heldFrames.every((frame) => frame.addRefCalls === 1 && frame.decRefCalls === 1))
  assert.deepEqual(releaseCalls, [])
})

test('missing optional frames retain Graphics and the complete warning impact lifecycle without references', async () => {
  const missingPaths = [RESOURCE_PATHS[4], RESOURCE_PATHS[5]]
  const { BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY, frames, loadedPaths, releaseCalls } = await loadPresenter({ failedPaths: missingPaths })
  const presenter = new BossTelegraphPresenter()
  const pool = new TelegraphPool(BOSS_HAZARD_POOL_CAPACITY)
  presenter.telegraphPool = pool
  presenter.onLoad()
  assert.deepEqual(loadedPaths, RESOURCE_PATHS)
  for (const path of missingPaths) assert.equal(frames.has(path), false)
  const area = { minX: -28, maxX: 28, minY: -90, maxY: -34 }
  const warning = telegraph('ground-spikes:7:missing:marker:0', area, { kind: 'spike', markerIndex: 0, center: { x: 0, y: -62 } })

  presenter.present(warning)
  const warningNode = [...pool.active][0]
  assert.deepEqual(frameIds(warningNode), [RESOURCE_PATHS[3], null, null, null])
  assert.ok(warningNode.graphics.calls.some((call) => call.type === 'stroke'))
  presenter.activate(3, 7, { type: 'activate-hitbox', attackId: warning.attackId, telegraphId: warning.telegraphId, area, damage: 8, duration: 0.18 })
  presenter.update(0.8)
  assert.equal(presenter.visibleTelegraphCount, 0)
  assert.equal(presenter.visibleImpactCount, 1)
  const impactNode = [...pool.active][0]
  assert.deepEqual(frameIds(impactNode), [RESOURCE_PATHS[3], null, null, null])
  assert.ok(impactNode.graphics.calls.some((call) => call.type === 'stroke'))
  assert.equal(impactNode.graphics.calls.some((call) => ['rect', 'fill', 'circle', 'ellipse'].includes(call.type)), false)
  presenter.update(0.18)
  presenter.update(0.18)
  assert.equal(presenter.visibleImpactCount, 0)
  presenter.onDestroy()
  assert.ok([...frames.values()].every((frame) => frame.refCount === 0 && frame.decRefCalls === 1))
  assert.deepEqual(releaseCalls, [])
})

test('activate before present preserves the pending command quality through warning activation', async () => {
  const { BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY } = await loadPresenter()
  const presenter = new BossTelegraphPresenter()
  const pool = new TelegraphPool(BOSS_HAZARD_POOL_CAPACITY)
  presenter.telegraphPool = pool
  presenter.onLoad()
  presenter.resetGeneration(3)
  const entry = PROFILE_CASES[0]
  const warning = telegraph(entry.attackId, entry.area, entry.danger)

  presenter.activate(3, 7, {
    type: 'activate-hitbox',
    attackId: warning.attackId,
    telegraphId: warning.telegraphId,
    area: warning.area,
    damage: 8,
    duration: 0.18,
    danger: warning.danger,
  }, 'minimal')
  assert.equal(presenter.visibleImpactCount, 0)
  assert.equal(presenter.present(warning, 'full'), true)
  assert.equal(presenter.visibleTelegraphCount, 1)

  presenter.update(0.8)
  assert.equal(presenter.visibleTelegraphCount, 0)
  assert.equal(presenter.visibleImpactCount, 1)
  const impact = [...pool.active][0]
  assert.deepEqual(layerVisibility(impact), {
    mainShape: { active: true, enabled: true },
    accent: { active: false, enabled: false },
    particleNear: { active: false, enabled: false },
    particleFar: { active: false, enabled: false },
  })
})

test('impact danger selects the visual profile ahead of a disagreeing attack id prefix', async () => {
  const spikePath = RESOURCE_PATHS[3]
  const { BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY } = await loadPresenter()
  const presenter = new BossTelegraphPresenter()
  const pool = new TelegraphPool(BOSS_HAZARD_POOL_CAPACITY)
  presenter.telegraphPool = pool
  presenter.onLoad()
  const area = { minX: -32, maxX: 32, minY: -32, maxY: 32 }
  const warning = telegraph('bamboo-sweep:7:danger-authority', area, { kind: 'sweep' })

  presenter.present(warning)
  presenter.activate(3, 7, {
    type: 'activate-hitbox',
    attackId: warning.attackId,
    telegraphId: warning.telegraphId,
    area,
    damage: 8,
    duration: 0.18,
    danger: { kind: 'spike', markerIndex: 0, center: { x: 0, y: 0 } },
  })
  presenter.update(0.8)

  const impact = [...pool.active][0]
  assert.equal(impact.mainShape.spriteFrame.id, spikePath)
})

test('presenter uses only layered phase contracts and BattleRuntime forwards adaptive quality', async () => {
  const [presenterSource, runtimeSource] = await Promise.all([
    readFile(new URL('../assets/Scripts/Game/BossTelegraphPresenter.ts', import.meta.url), 'utf8'),
    readFile(new URL('../assets/Scripts/Game/BattleRuntimeController.ts', import.meta.url), 'utf8'),
  ])
  const retiredTerm = new RegExp(['talis', 'man'].join(''), 'i')

  assert.doesNotMatch(presenterSource, retiredTerm)
  assert.doesNotMatch(controllerSource, retiredTerm)
  assert.match(presenterSource, /bossVfxPhase/)
  assert.match(presenterSource, /type BossVfxPhaseOutput/)
  assert.match(presenterSource, /import type \{ VfxQuality \}/)
  assert.match(presenterSource, /present\(delivery: EnemyTelegraphDelivery, quality: VfxQuality = 'full'\)/)
  assert.match(presenterSource, /activate\(generation: number, enemyId: number, command: ActiveHitboxCommand, quality: VfxQuality = 'full'\)/)
  assert.match(
    runtimeSource,
    /bossTelegraphPresenter\?\.activate\(this\.stageGeneration, enemyId, command, this\.currentVfxQuality\)/,
  )
  assert.match(
    runtimeSource,
    /bossTelegraphPresenter\?\.present\(telegraph, this\.currentVfxQuality\)/,
  )
})

test('Cocos presenter executes show-visible-active-hidden and cancel/reset lifecycle using authoritative areas', async () => {
  const { BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY } = await loadPresenter()
  assert.equal(BOSS_HAZARD_POOL_CAPACITY, 18)
  const pool = new TelegraphPool(BOSS_HAZARD_POOL_CAPACITY)
  const presenter = new BossTelegraphPresenter()
  presenter.telegraphPool = pool
  const area = { minX: -120, maxX: 180, minY: -40, maxY: 68 }
  const warning = telegraph('bamboo-sweep:7:1', area, { kind: 'sweep', escape: 'vertical', origin: { x: 230, y: 40 }, arcDegrees: 120 })

  assert.equal(presenter.present(warning), true)
  assert.equal(presenter.visibleTelegraphCount, 1)
  const warningNode = [...pool.active][0]
  assert.deepEqual(warningNode.position, { x: 30, y: 14, z: 0 })
  assert.deepEqual(warningNode.transform.size, { width: 300, height: 108 })
  assert.equal(warningNode.graphics.calls.some((call) => call.type === 'rect' || call.type === 'fill'), false)
  assert.ok(warningNode.graphics.calls.some((call) => call.type === 'lineTo'))

  presenter.update(0.4)
  presenter.activate(3, 7, { type: 'activate-hitbox', attackId: warning.attackId, telegraphId: warning.telegraphId, area, damage: 8, duration: 0.18 })
  assert.equal(presenter.visibleTelegraphCount, 1, 'active cannot hide a warning before 0.8 visible seconds')
  presenter.update(0.39)
  assert.equal(presenter.visibleTelegraphCount, 1)
  presenter.update(0.01)
  assert.equal(presenter.visibleTelegraphCount, 0)
  assert.equal(presenter.visibleImpactCount, 1)
  presenter.update(0.18)
  assert.equal(presenter.visibleImpactCount, 1, 'a new impact survives its first presenter update so either component order renders it')
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
  const { BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY } = await loadPresenter()
  const pool = new TelegraphPool(BOSS_HAZARD_POOL_CAPACITY)
  const presenter = new BossTelegraphPresenter()
  presenter.telegraphPool = pool
  const sectors = ['top', 'bottom', 'right', 'left-upper', 'left-lower']
  for (const [index, sector] of sectors.entries()) {
    assert.equal(presenter.present(telegraph(`mountain-roar:7:3:sector:${sector}`, { minX: index * 20, maxX: index * 20 + 42, minY: -100, maxY: 100 }, { kind: 'roar-sector', waveIndex: -1, radius: 190, sector, safeGap: { sector: 'left', centerAngle: Math.PI, width: Math.PI / 3 } }, 'mountain-roar:7:3')), true)
  }
  assert.equal(presenter.visibleTelegraphCount, 5)
  assert.equal(BOSS_HAZARD_POOL_CAPACITY, 18)
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
  assert.match(bootstrap, /BOSS_HAZARD_POOL_CAPACITY/)
})

test('Boss hazard capacity covers all three roar waves plus the paired spike attack and rejects undersized pools', async () => {
  const { BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY } = await loadPresenter()
  assert.equal(BOSS_HAZARD_POOL_CAPACITY, 18)
  const presenter = new BossTelegraphPresenter()
  presenter.telegraphPool = new TelegraphPool(BOSS_HAZARD_POOL_CAPACITY - 1)
  assert.throws(
    () => presenter.present(telegraph('bamboo-sweep:7:capacity', { minX: -20, maxX: 20, minY: -20, maxY: 20 }, { kind: 'sweep', escape: 'vertical', origin: { x: 0, y: 0 }, arcDegrees: 120 })),
    /Boss hazard pool invariant.*18/,
  )

  const exhaustedPool = new TelegraphPool(BOSS_HAZARD_POOL_CAPACITY)
  for (let index = 0; index < BOSS_HAZARD_POOL_CAPACITY; index += 1) exhaustedPool.active.add(new TelegraphNode())
  const exhaustedPresenter = new BossTelegraphPresenter()
  exhaustedPresenter.telegraphPool = exhaustedPool
  assert.throws(
    () => exhaustedPresenter.present(telegraph('bamboo-sweep:7:exhausted', { minX: -20, maxX: 20, minY: -20, maxY: 20 }, { kind: 'sweep', escape: 'vertical', origin: { x: 0, y: 0 }, arcDegrees: 120 })),
    /Boss hazard pool invariant: exhausted 18 nodes for bamboo-sweep:7:exhausted/,
  )

  const peakPool = new TelegraphPool(BOSS_HAZARD_POOL_CAPACITY)
  const peakPresenter = new BossTelegraphPresenter()
  peakPresenter.telegraphPool = peakPool
  const roarAuthority = 'mountain-roar:7:peak'
  for (let sector = 0; sector < 5; sector += 1) {
    peakPresenter.present(telegraph(`${roarAuthority}:sector:${sector}`, { minX: sector * 10, maxX: sector * 10 + 8, minY: 100, maxY: 108 }, { kind: 'roar-sector', waveIndex: -1, radius: 190, sector: String(sector), safeGap: { sector: 'left', centerAngle: Math.PI, width: Math.PI / 3 } }, roarAuthority))
  }
  for (let marker = 0; marker < 3; marker += 1) {
    peakPresenter.present(telegraph(`ground-spikes:7:peak:marker:${marker}`, { minX: marker * 10, maxX: marker * 10 + 8, minY: -108, maxY: -100 }, { kind: 'spike', markerIndex: marker, center: { x: marker * 10 + 4, y: -104 } }))
  }
  const roarImpact = (wave, sector) => ({ type: 'activate-hitbox', attackId: `${roarAuthority}:wave:${wave}:sector:${sector}`, telegraphId: roarAuthority, area: { minX: sector * 10, maxX: sector * 10 + 8, minY: wave * 10, maxY: wave * 10 + 8 }, damage: 6, duration: 0.12 })
  for (let sector = 0; sector < 5; sector += 1) peakPresenter.activate(3, 7, roarImpact(0, sector))
  peakPresenter.update(0.8)
  for (let wave = 1; wave < 3; wave += 1) {
    for (let sector = 0; sector < 5; sector += 1) peakPresenter.activate(3, 7, roarImpact(wave, sector))
  }
  assert.equal(peakPresenter.visibleTelegraphCount, 3)
  assert.equal(peakPresenter.visibleImpactCount, 15)
  assert.equal(peakPool.maxActive, BOSS_HAZARD_POOL_CAPACITY)
})

test('bounded Boss hazard pool presents every phase-two command across seeds partitions and update orders', async () => {
  const { BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY } = await loadPresenter()
  const coveredPairs = new Set()
  let observedPeak = 0
  for (const deltaSeconds of [1 / 60, 0.019, 0.25]) {
    for (const updateOrder of ['presenter-first', 'enemy-first']) {
      for (let seed = 0; seed < 256; seed += 1) {
        const result = await runPeakSimulation(BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY, seed, deltaSeconds, updateOrder)
        observedPeak = Math.max(observedPeak, result.peak)
        for (const pair of result.pairs) coveredPairs.add(pair)
      }
    }
  }
  assert.deepEqual([...coveredPairs].sort(), ['roar+spikes', 'roar+sweep'])
  assert.ok(observedPeak >= 13, `expected to cover the reviewed coarse-frame peak, observed ${observedPeak}`)
})
