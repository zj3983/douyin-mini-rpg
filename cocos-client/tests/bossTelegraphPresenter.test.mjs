import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'
import ts from 'typescript'

import {
  createBambooWardenBrain,
  setBossHealthRatio,
  stepBambooWarden,
} from '../assets/Scripts/Combat/BossBrain.ts'
import { findCreatorCommand, findCreatorTypeDeclarations } from '../tools/check-cocos-build-readiness.mjs'

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

const creatorCommand = process.env.COCOS_CREATOR_PATH ?? findCreatorCommand()
const creatorCcPath = findCreatorTypeDeclarations(creatorCommand)

function creatorSemanticDiagnostics() {
  const presenterPath = resolve('assets/Scripts/Game/BossTelegraphPresenter.ts')
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
  return ts.getPreEmitDiagnostics(program)
    .filter((diagnostic) => diagnostic.file && resolve(diagnostic.file.fileName) === presenterPath)
    .map((diagnostic) => ({
      code: diagnostic.code,
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    }))
}

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
    const refCountBefore = this.refCount
    this.decRefCalls += 1
    this.refCount -= 1
    if (autoRelease && this.refCount === 0) this.destroyed = true
    globalThis.__bossVfxLifecycleEvents?.push({
      type: 'dec-ref',
      frameId: this.id,
      refCountBefore,
      refCountAfter: this.refCount,
      destroyed: this.destroyed,
      activeSpriteFrames: globalThis.__bossVfxActiveFramesSnapshot?.() ?? [],
    })
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
  setLayerLayout(width, height, layout, vertical) {}
}
`

async function loadPresenter({ failedPaths = [], deferred = false } = {}) {
  const loadedPaths = []
  const releaseCalls = []
  const lifecycleEvents = []
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
  globalThis.__bossVfxLifecycleEvents = lifecycleEvents
  globalThis.__bossVfxActiveFramesSnapshot = null
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
    lifecycleEvents,
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
    setterCalls: { position: 0, scale: 0, rotation: 0 },
    position: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    eulerAngles: { x: 0, y: 0, z: 0 },
    size: { width: 1, height: 1 },
    setPosition(x, y, z) {
      this.setterCalls.position += 1
      Object.assign(this.position, { x, y, z })
    },
    setScale(x, y, z) {
      this.setterCalls.scale += 1
      Object.assign(this.scale, { x, y, z })
    },
    setRotationFromEuler(x, y, z) {
      this.setterCalls.rotation += 1
      Object.assign(this.eulerAngles, { x, y, z })
    },
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
    layoutCalls: [],
    resetVisual: () => {
      const before = frameIds(this)
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
      globalThis.__bossVfxLifecycleEvents?.push({
        type: 'reset-visual',
        before,
        after: frameIds(this),
      })
    },
    setLayerFrames: (main, accent, particle) => {
      this.mainShape.spriteFrame = main
      this.accent.spriteFrame = accent
      this.particleNear.spriteFrame = particle
      this.particleFar.spriteFrame = particle
      this.controller.frameCalls.push([main, accent, particle])
    },
    setLayerLayout: (width, height, layout, vertical) => {
      for (const field of LAYER_FIELDS) {
        const spec = layout.layers[field]
        const orientedWidth = vertical ? height : width
        const uncappedWidth = Math.max(spec.minWidth, orientedWidth * spec.widthScale)
        Object.assign(this.layers[field].node.size, {
          width: vertical && layout.vertical
            ? Math.min(uncappedWidth, orientedWidth * layout.vertical.maxLongAxisRatio)
            : uncappedWidth,
          height: Math.max(spec.minHeight, (vertical ? width : height) * spec.heightScale),
        })
      }
      this.controller.layoutCalls.push({ width, height, layout, vertical })
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
    globalThis.__bossVfxLifecycleEvents?.push({
      type: 'despawn',
      frameIds: frameIds(node),
      nodeActive: node.active,
      poolActiveCount: this.active.size,
    })
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

function layerColors(node) {
  return Object.fromEntries(LAYER_FIELDS.map((field) => {
    const { r, g, b, a } = node.layers[field].color
    return [field, { r, g, b, a }]
  }))
}

function layerWriteCounts(node) {
  return Object.fromEntries(LAYER_FIELDS.map((field) => {
    const layer = node.layers[field]
    return [field, {
      color: layer.colorAssignments,
      position: layer.node.setterCalls.position,
      rotation: layer.node.setterCalls.rotation,
      scale: layer.node.setterCalls.scale,
    }]
  }))
}

function layerWriteDeltas(node, before) {
  const after = layerWriteCounts(node)
  return Object.fromEntries(LAYER_FIELDS.map((field) => [field, {
    color: after[field].color - before[field].color,
    position: after[field].position - before[field].position,
    rotation: after[field].rotation - before[field].rotation,
    scale: after[field].scale - before[field].scale,
  }]))
}

function assertLayerWrites(counts, expected, message) {
  for (const field of ['color', 'position', 'rotation', 'scale']) {
    assert.equal(counts[field], expected, `${message} ${field}`)
  }
}

function rootAndGraphics(node) {
  return {
    position: { ...node.position },
    size: { ...node.transform.size },
    graphics: structuredClone(node.graphics.calls),
  }
}

function pooledVisualState(node) {
  return {
    colors: layerColors(node),
    frames: frameIds(node),
    geometry: layerGeometry(node),
    root: rootAndGraphics(node),
    visibility: layerVisibility(node),
  }
}

function assertNear(actual, expected, tolerance = 1e-6, message = '') {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message || 'value'}: expected ${expected} +/- ${tolerance}, received ${actual}`,
  )
}

function visibleLayerYEnvelope(node, field) {
  const layer = node.layers[field].node
  const radians = layer.eulerAngles.z * Math.PI / 180
  const halfY = (
    Math.abs(Math.sin(radians)) * layer.size.width * Math.abs(layer.scale.x)
    + Math.abs(Math.cos(radians)) * layer.size.height * Math.abs(layer.scale.y)
  ) * 0.5
  const centerY = node.position.y + layer.position.y
  return { minY: centerY - halfY, maxY: centerY + halfY }
}

function assertVisibleSafeGap(upperNode, lowerNode, label) {
  for (const field of LAYER_FIELDS) {
    const upper = visibleLayerYEnvelope(upperNode, field)
    const lower = visibleLayerYEnvelope(lowerNode, field)
    assert.ok(upper.minY - lower.maxY > 0, `${label} ${field} visible gap`)
  }
}

function collectRealBossRoarCommands() {
  const enemyId = 97
  const position = { x: 0, y: 0 }
  const battleBounds = { minX: -360, maxX: 360, minY: -420, maxY: 420 }
  for (let seed = 0; seed < 256; seed += 1) {
    const boss = createBambooWardenBrain(enemyId, position, seed)
    const commands = []
    while (boss.elapsed < 2.5) {
      const deltaTime = Math.min(0.05, 2.5 - boss.elapsed)
      commands.push(...stepBambooWarden(boss, {
        now: boss.elapsed + deltaTime,
        player: { id: 'player', position: { x: -120, y: 0 }, alive: true },
        neighbors: [],
        battleBounds,
      }, deltaTime))
    }
    const warnings = commands.filter((command) => command.type === 'show-telegraph' && command.danger?.kind === 'roar-sector')
    const impacts = commands.filter((command) => command.type === 'activate-hitbox' && command.danger?.kind === 'roar-sector')
    if (warnings.length === 5 && impacts.length === 15) return { enemyId, impacts, warnings }
  }
  assert.fail('no deterministic seed emitted one complete real Boss roar')
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

function createPresenterScenario(BossTelegraphPresenter, capacity) {
  const presenter = new BossTelegraphPresenter()
  const pool = new TelegraphPool(capacity)
  presenter.telegraphPool = pool
  return { pool, presenter }
}

function activeWarningVisuals(presenter) {
  const visuals = []
  for (const group of presenter.groups.values()) visuals.push(...group.visuals)
  return visuals
}

function latestWarningVisual(presenter) {
  return activeWarningVisuals(presenter).at(-1) ?? null
}

function latestImpactVisual(presenter) {
  return presenter.impacts.at(-1) ?? null
}

function activeImpactVisuals(presenter) {
  return [...presenter.impacts]
}

function impactCommand(entry, authorityId, duration, attackId = authorityId) {
  return {
    type: 'activate-hitbox',
    attackId,
    telegraphId: authorityId,
    area: entry.area,
    damage: 8,
    duration,
    danger: entry.danger,
  }
}

function startImpactScenario(
  presenter,
  entry,
  {
    attackId = entry.id === 'roar-wave' ? `${entry.attackId}:wave:0` : entry.attackId,
    authorityId = entry.attackId,
    duration = 1,
    quality = 'full',
  } = {},
) {
  assert.equal(presenter.present(telegraph(authorityId, entry.area, entry.danger, authorityId), quality), true)
  const command = impactCommand(entry, authorityId, duration, attackId)
  presenter.activate(3, 7, command, quality)
  presenter.update(0.8)
  const visual = latestImpactVisual(presenter)
  assert.ok(visual, `${entry.id} impact visual`)
  return { command, node: visual.node, visual }
}

function motionRenderSnapshot(node) {
  return {
    colors: layerColors(node),
    geometry: layerGeometry(node),
  }
}

function primeImpactAuthority(presenter, entry, authorityId, quality = 'full') {
  startImpactScenario(presenter, entry, {
    attackId: entry.id === 'roar-wave' ? `${authorityId}:wave:0:bootstrap` : `${authorityId}:bootstrap`,
    authorityId,
    duration: 0.001,
    quality,
  })
  presenter.update(0.001)
  presenter.update(0.001)
  assert.equal(presenter.visibleImpactCount, 0, `${entry.id} bootstrap impact expires`)
}

test('Boss telegraph presenter passes Creator semantic TypeScript compilation', {
  skip: creatorCcPath ? false : 'Cocos Creator declarations are not installed',
}, () => {
  assert.deepEqual(creatorSemanticDiagnostics(), [])
})

test('visible VFX snapshot preserves the actual first phase-two cast when lastAttack is already the second', async () => {
  const { BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY } = await loadPresenter()
  const presenter = new BossTelegraphPresenter()
  presenter.telegraphPool = new TelegraphPool(BOSS_HAZARD_POOL_CAPACITY)
  const boss = createBambooWardenBrain(7, { x: 260, y: 40 }, 0)
  setBossHealthRatio(boss, 0.49)
  const expected = { telegraph: [], impact: [] }
  const pairAttacks = new Map()

  for (let frame = 0; frame < 2; frame += 1) {
    const deltaSeconds = 0.25
    const commands = stepBambooWarden(boss, {
      now: boss.elapsed + deltaSeconds,
      player: { id: 'player', position: { x: -120, y: 0 }, alive: true },
      neighbors: [],
      battleBounds: { minX: -360, maxX: 360, minY: -420, maxY: 420 },
    }, deltaSeconds)
    deliverBossCommands(presenter, commands, expected, pairAttacks)
  }

  const brain = boss.snapshot()
  const entries = presenter.visibleVfxEntries()
  assert.equal(brain.phaseNumber, 2)
  assert.equal(brain.attackSequence, 2)
  assert.ok(entries.length > 0)
  assert.ok(entries.every((entry) => entry.phase === 'telegraph'))
  assert.ok(entries.every((entry) => entry.skill !== brain.lastAttack))
  assert.ok(entries.every((entry) => entry.sequence === 1))
  assert.ok(entries.every((entry) => entry.attackId.startsWith(`${entry.skill}:7:1`)))
  assert.ok(entries.every((entry) => entry.authorityId.startsWith(`${entry.skill}:7:1`)))
  assert.equal(Object.isFrozen(entries), true)
  assert.ok(entries.every(Object.isFrozen))
  assert.throws(() => { entries[0].skill = brain.lastAttack }, TypeError)
})

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
  const warningVisuals = activeWarningVisuals(presenter)
  assert.equal(warningNodes.length, 3)
  assert.deepEqual(
    warningNodes.map((node) => visualIdForFrame(node.mainShape.spriteFrame)),
    PROFILE_CASES.map(({ id }) => id),
  )
  for (const [index, node] of warningNodes.entries()) {
    const entry = PROFILE_CASES[index]
    assert.deepEqual(frameIds(node), [...entry.paths, entry.paths[2]], `${entry.id} warning frames`)
    assert.deepEqual(node.controller.frameCalls.at(-1).map((frame) => frame?.id ?? null), entry.paths)
    assert.deepEqual(node.controller.layoutCalls.at(-1), {
      width: entry.area.maxX - entry.area.minX,
      height: entry.area.maxY - entry.area.minY,
      layout: warningVisuals[index].profile.layout,
      vertical: false,
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
    assert.ok(node.controller.layoutCalls.length > 0)
    assert.equal(node.graphics.lineWidth, 4)
    assert.ok(node.graphics.calls.some((call) => call.type === 'stroke'))
  }
})

test('profile layouts overscan child sprites while authority roots and Graphics remain unchanged', async () => {
  const { BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY } = await loadPresenter()
  const { pool, presenter } = createPresenterScenario(BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY)
  presenter.onLoad()

  for (const entry of PROFILE_CASES) presenter.present(telegraph(entry.attackId, entry.area, entry.danger))
  const visuals = activeWarningVisuals(presenter)
  const nodes = [...pool.active]

  for (const [index, node] of nodes.entries()) {
    const entry = PROFILE_CASES[index]
    const root = rootAndGraphics(node)
    const child = layerGeometry(node)
    assert.deepEqual(root.position, {
      x: (entry.area.minX + entry.area.maxX) / 2,
      y: (entry.area.minY + entry.area.maxY) / 2,
      z: 0,
    })
    assert.deepEqual(root.size, {
      width: entry.area.maxX - entry.area.minX,
      height: entry.area.maxY - entry.area.minY,
    })
    assert.ok(root.graphics.some((call) => call.type === 'stroke'))
    assert.equal(root.graphics.some((call) => ['rect', 'fill', 'circle', 'ellipse'].includes(call.type)), false)
    assert.ok(child.mainShape.size.width > root.size.width || child.mainShape.size.height > root.size.height)
    assert.strictEqual(visuals[index].profile.layout, node.controller.layoutCalls.at(-1).layout)
  }

  const spikeRoot = rootAndGraphics(nodes[1])
  const spike = layerGeometry(nodes[1])
  assert.ok(spike.mainShape.size.width >= 112 && spike.mainShape.size.height >= 112)
  assert.ok(spike.mainShape.size.width > spikeRoot.size.width)
  assert.ok(spike.mainShape.size.height > spikeRoot.size.height)
  assert.ok(spike.accent.size.height < spike.mainShape.size.height, 'ground dust stays compact at the base')
})

test('roar sector layout keeps top and bottom horizontal and rotates left and right vertically', async () => {
  const { BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY } = await loadPresenter()
  const { pool, presenter } = createPresenterScenario(BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY)
  presenter.onLoad()
  const sectors = [
    ['top', { minX: -100, maxX: 100, minY: 80, maxY: 130 }],
    ['bottom', { minX: -100, maxX: 100, minY: -130, maxY: -80 }],
    ['right', { minX: 80, maxX: 130, minY: -100, maxY: 100 }],
    ['left-upper', { minX: -130, maxX: -80, minY: 10, maxY: 100 }],
  ]
  for (const [sector, area] of sectors) {
    presenter.present(telegraph(`mountain-roar:7:orientation:${sector}`, area, {
      kind: 'roar-sector', waveIndex: -1, radius: 190, sector,
      safeGap: { sector: 'left', centerAngle: Math.PI, width: Math.PI / 3 },
    }))
  }

  const nodes = [...pool.active]
  assert.deepEqual(nodes.map((node) => node.controller.layoutCalls.at(-1).vertical), [false, false, true, true])
  assert.deepEqual(nodes.map((node) => node.mainShape.node.eulerAngles.z), [0, 0, 90, 90])
  assert.ok(nodes[0].mainShape.node.size.width > nodes[0].mainShape.node.size.height)
  assert.ok(nodes[2].mainShape.node.size.width > nodes[2].mainShape.node.size.height, 'vertical sector uses a horizontal source before rotation')
})

test('no-danger right and left roar impacts recover vertical layout and retain the safe gap', async () => {
  const { BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY } = await loadPresenter()
  const { presenter } = createPresenterScenario(BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY)
  presenter.onLoad()
  const radius = 80
  const gapHalf = radius * 0.34
  const areas = {
    right: { minX: radius - 21, maxX: radius + 21, minY: -radius, maxY: radius },
    'left-upper': { minX: -radius - 21, maxX: -radius + 21, minY: gapHalf, maxY: radius },
    'left-lower': { minX: -radius - 21, maxX: -radius + 21, minY: -radius, maxY: -gapHalf },
  }

  for (const [sector, area] of Object.entries(areas)) {
    const authorityId = `mountain-roar:7:11:sector:${sector}`
    presenter.present(telegraph(authorityId, area, {
      kind: 'roar-sector',
      waveIndex: -1,
      radius,
      sector,
      safeGap: { sector: 'left', centerAngle: Math.PI, width: Math.PI / 3 },
    }, authorityId))
    presenter.activate(3, 7, {
      type: 'activate-hitbox',
      attackId: `mountain-roar:7:11:wave:0:sector:${sector}`,
      telegraphId: authorityId,
      area,
      damage: 6,
      duration: 0.12,
    })
  }
  presenter.update(0.8)

  const impacts = Object.fromEntries(presenter.impacts.map((impact) => [impact.attackId.split(':').at(-1), impact]))
  for (const sector of Object.keys(areas)) {
    const impact = impacts[sector]
    assert.ok(impact, `${sector} impact`)
    assert.equal(impact.node.controller.layoutCalls.at(-1).vertical, true, `${sector} vertical layout`)
    assert.equal(impact.node.mainShape.node.eulerAngles.z, 90, `${sector} vertical orientation`)
  }
  const authorityRoots = presenter.impacts.map((impact) => rootAndGraphics(impact.node))
  assertVisibleSafeGap(impacts['left-upper'].node, impacts['left-lower'].node, 'no-danger impact initial')
  presenter.update(0.001)
  for (const deltaTime of [0.03, 0.03, 0.03, 0.029999]) presenter.update(deltaTime)
  assertVisibleSafeGap(impacts['left-upper'].node, impacts['left-lower'].node, 'no-danger impact peak')
  assert.deepEqual(presenter.impacts.map((impact) => rootAndGraphics(impact.node)), authorityRoots)
  assert.ok(presenter.impacts.every((impact) => impact.phase.progress === 1), 'all impacts reach the 1.18 peak envelope')
})

test('real Boss roar child rectangles preserve the left safe gap through warning and impact peak', async () => {
  const { BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY } = await loadPresenter()
  const roar = collectRealBossRoarCommands()
  const radii = [...new Set(roar.impacts.map((command) => command.danger.radius))].toSorted((a, b) => a - b)
  assert.deepEqual(radii, [80, 135, 190], 'test follows the current authoritative ROAR_WAVE_RADII')

  const realWarnings = roar.warnings.filter((command) => command.danger.sector.startsWith('left'))
  assert.equal(realWarnings.length, 2)
  const warningScenario = createPresenterScenario(BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY)
  warningScenario.presenter.onLoad()
  for (const command of realWarnings) {
    warningScenario.presenter.present({
      ...command,
      enemyId: roar.enemyId,
      telegraphId: command.telegraphId ?? command.attackId,
      visibleAt: command.eventTime ?? 0,
      activationNotBefore: command.activatesAt ?? (command.eventTime ?? 0) + command.duration,
      generation: 3,
    })
  }
  const warningNodes = [...warningScenario.pool.active].toSorted((left, right) => right.position.y - left.position.y)
  const [warningUpper, warningLower] = warningNodes
  const warningUpperCommand = realWarnings.find((command) => command.danger.sector === 'left-upper')
  const warningLowerCommand = realWarnings.find((command) => command.danger.sector === 'left-lower')
  assert.deepEqual(rootAndGraphics(warningUpper).position, {
    x: (warningUpperCommand.area.minX + warningUpperCommand.area.maxX) * 0.5,
    y: (warningUpperCommand.area.minY + warningUpperCommand.area.maxY) * 0.5,
    z: 0,
  })
  assert.deepEqual(rootAndGraphics(warningLower).position, {
    x: (warningLowerCommand.area.minX + warningLowerCommand.area.maxX) * 0.5,
    y: (warningLowerCommand.area.minY + warningLowerCommand.area.maxY) * 0.5,
    z: 0,
  })
  assert.deepEqual(rootAndGraphics(warningUpper).size, {
    width: warningUpperCommand.area.maxX - warningUpperCommand.area.minX,
    height: warningUpperCommand.area.maxY - warningUpperCommand.area.minY,
  })
  assert.deepEqual(rootAndGraphics(warningLower).size, {
    width: warningLowerCommand.area.maxX - warningLowerCommand.area.minX,
    height: warningLowerCommand.area.maxY - warningLowerCommand.area.minY,
  })
  assertNear(
    warningUpperCommand.area.minY - warningLowerCommand.area.maxY,
    warningUpperCommand.danger.radius * 0.68,
    1e-9,
    'warning authority safe gap',
  )
  assert.deepEqual(warningUpperCommand.danger.safeGap, warningLowerCommand.danger.safeGap)
  const warningRoots = warningNodes.map(rootAndGraphics)
  assertVisibleSafeGap(warningUpper, warningLower, 'initial warning')
  warningScenario.presenter.update(0.4)
  assertVisibleSafeGap(warningUpper, warningLower, 'mid warning')
  warningScenario.presenter.update(0.399)
  assertVisibleSafeGap(warningUpper, warningLower, 'critical warning')
  assert.deepEqual(warningNodes.map(rootAndGraphics), warningRoots)

  const topCommand = roar.warnings.find((command) => command.danger.sector === 'top')
  const topScenario = createPresenterScenario(BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY)
  topScenario.presenter.onLoad()
  topScenario.presenter.present({
    ...topCommand,
    enemyId: roar.enemyId,
    telegraphId: topCommand.telegraphId ?? topCommand.attackId,
    visibleAt: topCommand.eventTime ?? 0,
    activationNotBefore: topCommand.activatesAt ?? (topCommand.eventTime ?? 0) + topCommand.duration,
    generation: 3,
  })
  const topNode = [...topScenario.pool.active][0]
  assert.equal(topNode.controller.layoutCalls.at(-1).vertical, false)
  assert.ok(topNode.mainShape.node.size.width > topNode.transform.size.width, 'real top wave keeps width overscan')
  assert.ok(topNode.mainShape.node.size.height > topNode.transform.size.height, 'real top wave keeps broad thickness')

  for (const radius of radii) {
    const pair = roar.impacts.filter((command) => (
      command.danger.radius === radius && command.danger.sector.startsWith('left')
    ))
    assert.equal(pair.length, 2, `radius ${radius} real impact pair`)
    const upperCommand = pair.find((command) => command.danger.sector === 'left-upper')
    const lowerCommand = pair.find((command) => command.danger.sector === 'left-lower')
    const authorityGap = upperCommand.area.minY - lowerCommand.area.maxY
    assertNear(authorityGap, radius * 0.68, 1e-9, `radius ${radius} authority safe gap`)

    const { pool, presenter } = createPresenterScenario(BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY)
    presenter.onLoad()
    for (const command of realWarnings) {
      presenter.present({
        ...command,
        enemyId: roar.enemyId,
        telegraphId: command.telegraphId ?? command.attackId,
        visibleAt: command.eventTime ?? 0,
        activationNotBefore: command.activatesAt ?? (command.eventTime ?? 0) + command.duration,
        generation: 3,
      })
    }
    for (const command of pair) presenter.activate(3, roar.enemyId, command)
    presenter.update(0.8)

    const impactNodes = [...pool.active].toSorted((left, right) => right.position.y - left.position.y)
    const [upperNode, lowerNode] = impactNodes
    const impactRoots = impactNodes.map(rootAndGraphics)
    assert.deepEqual(rootAndGraphics(upperNode).size, {
      width: upperCommand.area.maxX - upperCommand.area.minX,
      height: upperCommand.area.maxY - upperCommand.area.minY,
    })
    assert.deepEqual(rootAndGraphics(lowerNode).size, {
      width: lowerCommand.area.maxX - lowerCommand.area.minX,
      height: lowerCommand.area.maxY - lowerCommand.area.minY,
    })
    assert.ok(upperNode.mainShape.node.size.height > upperNode.transform.size.width, `radius ${radius} broad thickness`)
    assertVisibleSafeGap(upperNode, lowerNode, `radius ${radius} impact progress 0`)
    presenter.update(0.001)
    for (const [index, deltaTime] of [0.03, 0.03, 0.03, 0.029999].entries()) {
      presenter.update(deltaTime)
      assertVisibleSafeGap(upperNode, lowerNode, `radius ${radius} impact step ${index + 1}`)
      assert.deepEqual(impactNodes.map(rootAndGraphics), impactRoots)
    }
    assert.equal(presenter.impacts[0].phase.progress, 1, `radius ${radius} reaches the 1.18 peak envelope`)
  }
})

test('standard warning main starts visibly at alpha 90 or higher and brightens toward critical', async () => {
  const { BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY } = await loadPresenter()
  const { presenter } = createPresenterScenario(BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY)
  presenter.onLoad()
  presenter.present(telegraph(PROFILE_CASES[0].attackId, PROFILE_CASES[0].area, PROFILE_CASES[0].danger))
  const node = latestWarningVisual(presenter).node
  const initial = node.mainShape.color.a
  assert.ok(initial >= 90, `initial main alpha ${initial}`)
  presenter.update(0.6)
  assert.ok(node.mainShape.color.a > initial)
})

test('pooled reset restores overscan size and sector rotation state before reuse', async () => {
  const { BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY } = await loadPresenter()
  const { pool, presenter } = createPresenterScenario(BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY)
  presenter.onLoad()
  const roar = PROFILE_CASES[2]
  presenter.present(telegraph(`${roar.attackId}:left`, roar.area, { ...roar.danger, sector: 'left-upper' }))
  const node = [...pool.active][0]
  assert.equal(node.mainShape.node.eulerAngles.z, 90)
  assert.ok(node.mainShape.node.size.width > 1)

  presenter.cancelEnemy(3, 7)
  for (const field of LAYER_FIELDS) {
    assert.deepEqual(node.layers[field].node.size, { width: 1, height: 1 })
    assert.deepEqual(node.layers[field].node.eulerAngles, { x: 0, y: 0, z: 0 })
  }

  presenter.present(telegraph(PROFILE_CASES[0].attackId, PROFILE_CASES[0].area, PROFILE_CASES[0].danger))
  assert.strictEqual([...pool.active][0], node)
  assert.equal(node.mainShape.node.eulerAngles.z, -4, 'fixed sweep pose is not contaminated by pooled roar rotation')
})

test('warning motion becomes critical with distinct skill transforms while root geometry and Graphics stay static', async () => {
  const { BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY } = await loadPresenter()
  const presenter = new BossTelegraphPresenter()
  const pool = new TelegraphPool(BOSS_HAZARD_POOL_CAPACITY)
  presenter.telegraphPool = pool
  presenter.onLoad()

  for (const entry of PROFILE_CASES) {
    assert.equal(presenter.present(telegraph(entry.attackId, entry.area, entry.danger), 'full'), true)
  }

  const visuals = activeWarningVisuals(presenter)
  const nodes = visuals.map((visual) => visual.node)
  const staticStates = nodes.map(rootAndGraphics)
  const initialGeometry = nodes.map(layerGeometry)
  const initialAlpha = nodes.map((node) => node.mainShape.color.a)
  assert.ok(visuals.every((visual) => visual.phase.progress === 0 && visual.phase.phase === 'warning'))

  const [sweepInitial, spikeInitial, roarInitial] = initialGeometry
  const sweepWidth = PROFILE_CASES[0].area.maxX - PROFILE_CASES[0].area.minX
  const spikeHeight = PROFILE_CASES[1].area.maxY - PROFILE_CASES[1].area.minY
  assertNear(sweepInitial.mainShape.position.x, sweepWidth * -0.08, 1e-6, 'sweep warning starts gathered left')
  assertNear(sweepInitial.mainShape.scale.x, 0.86, 1e-6, 'sweep warning starts narrow')
  assert.ok(sweepInitial.accent.position.x < sweepInitial.mainShape.position.x, 'sweep accent starts behind the blade')
  assertNear(spikeInitial.mainShape.position.y, spikeHeight * -0.12, 1e-6, 'spike warning starts below ground line')
  assertNear(spikeInitial.accent.scale.x, 0.72, 1e-6, 'spike dust starts gathered')
  assertNear(roarInitial.mainShape.scale.x, 0.9, 1e-6, 'roar pressure starts compressed')
  assert.ok(roarInitial.particleNear.eulerAngles.z < 0 && roarInitial.particleFar.eulerAngles.z > 0)

  presenter.update(0.52)
  const warningGeometry = nodes.map(layerGeometry)
  const warningAlpha = nodes.map((node) => node.mainShape.color.a)
  assert.ok(visuals.every((visual) => visual.phase.progress === 0.65 && visual.phase.phase === 'warning'))

  presenter.update(0.08)
  const criticalGeometry = nodes.map(layerGeometry)
  assert.ok(visuals.every((visual) => visual.phase.progress === 0.75 && visual.phase.phase === 'critical'))

  for (const [index, node] of nodes.entries()) {
    assert.deepEqual(rootAndGraphics(node), staticStates[index], `${PROFILE_CASES[index].id} static authority geometry`)
    assert.notDeepEqual(warningGeometry[index], initialGeometry[index], `${PROFILE_CASES[index].id} moves during warning`)
    assert.notDeepEqual(criticalGeometry[index], warningGeometry[index], `${PROFILE_CASES[index].id} intensifies at critical`)
    assert.ok(warningAlpha[index] > initialAlpha[index], `${PROFILE_CASES[index].id} warning alpha rises`)
    assert.ok(node.mainShape.color.a > warningAlpha[index], `${PROFILE_CASES[index].id} critical alpha rises visibly`)
  }

  assert.ok(criticalGeometry[0].mainShape.position.x > warningGeometry[0].mainShape.position.x)
  assert.ok(criticalGeometry[0].mainShape.scale.x > warningGeometry[0].mainShape.scale.x)
  assert.ok(criticalGeometry[0].particleNear.position.x > warningGeometry[0].particleNear.position.x)
  assert.ok(criticalGeometry[0].particleFar.position.x < warningGeometry[0].particleFar.position.x)
  assert.ok(criticalGeometry[1].mainShape.position.y > warningGeometry[1].mainShape.position.y)
  assert.ok(criticalGeometry[1].accent.scale.x > warningGeometry[1].accent.scale.x)
  assert.ok(criticalGeometry[1].particleNear.position.y > warningGeometry[1].particleNear.position.y)
  assert.ok(criticalGeometry[2].mainShape.scale.x > warningGeometry[2].mainShape.scale.x)
  assert.ok(criticalGeometry[2].accent.scale.x > warningGeometry[2].accent.scale.x)
  assert.ok(criticalGeometry[2].particleNear.eulerAngles.z < warningGeometry[2].particleNear.eulerAngles.z)
  assert.ok(criticalGeometry[2].particleFar.eulerAngles.z > warningGeometry[2].particleFar.eulerAngles.z)
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
  const warningGeometry = [full, reduced, minimal].map(layerGeometry)

  presenter.update(0.4)
  assert.deepEqual([full, reduced, minimal].map((node) => layerVisibility(node)), warningVisibility)
  for (const [index, node] of [full, reduced, minimal].entries()) {
    assert.notDeepEqual(layerGeometry(node).mainShape, warningGeometry[index].mainShape, `${qualities[index]} visible warning main transforms`)
  }

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
  presenter.update(0.4)
  const impacts = [...pool.active]
  assert.equal(presenter.visibleImpactCount, 3)
  assert.deepEqual(impacts.map((node) => layerVisibility(node)), warningVisibility)
  assert.ok(impacts.every((node) => node.graphics.calls.some((call) => call.type === 'stroke')))
  const impactGeometry = impacts.map(layerGeometry)
  presenter.update(0.03)
  assert.deepEqual(impacts.map(layerGeometry), impactGeometry, 'fresh impact frame does not advance motion')
  presenter.update(0.03)
  assert.deepEqual(impacts.map((node) => layerVisibility(node)), warningVisibility)
  for (const [index, node] of impacts.entries()) {
    assert.notDeepEqual(layerGeometry(node).mainShape, impactGeometry[index].mainShape, `${qualities[index]} visible impact main transforms`)
  }
})

test('reduced and minimal steady-state updates write only enabled warning and impact layers', async () => {
  const { BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY } = await loadPresenter()
  const entry = PROFILE_CASES[0]

  for (const quality of ['reduced', 'minimal']) {
    const { pool, presenter } = createPresenterScenario(BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY)
    presenter.onLoad()
    const authorityId = `bamboo-sweep:7:hidden-writes:${quality}:impact`
    const impact = startImpactScenario(presenter, entry, {
      attackId: authorityId,
      authorityId,
      duration: 0.18,
      quality,
    })
    const warningId = `bamboo-sweep:7:hidden-writes:${quality}:warning`
    assert.equal(presenter.present(telegraph(warningId, entry.area, entry.danger), quality), true)
    const warning = latestWarningVisual(presenter)
    assert.ok(warning, `${quality} warning visual`)

    const scenarios = [
      { expectedWrites: 119, label: `${quality} impact`, node: impact.node },
      { expectedWrites: 120, label: `${quality} warning`, node: warning.node },
    ]
    const before = scenarios.map(({ node }) => ({
      graphics: structuredClone(node.graphics.calls),
      writes: layerWriteCounts(node),
    }))

    for (let index = 0; index < 120; index += 1) presenter.update(0.00025)

    for (const [scenarioIndex, scenario] of scenarios.entries()) {
      const { expectedWrites, label, node } = scenario
      const deltas = layerWriteDeltas(node, before[scenarioIndex].writes)
      assertLayerWrites(deltas.mainShape, expectedWrites, `${label} main`)
      if (quality === 'reduced') {
        assertLayerWrites(deltas.accent, expectedWrites, `${label} accent`)
        assertLayerWrites(deltas.particleNear, expectedWrites, `${label} particleNear`)
        assertLayerWrites(deltas.particleFar, 0, `${label} particleFar`)
      } else {
        assertLayerWrites(deltas.accent, 0, `${label} accent`)
        assertLayerWrites(deltas.particleNear, 0, `${label} particleNear`)
        assertLayerWrites(deltas.particleFar, 0, `${label} particleFar`)
      }
      assert.equal(node.active, true, `${label} root remains active`)
      assert.deepEqual(layerVisibility(node).mainShape, { active: true, enabled: true }, `${label} main remains active`)
      assert.ok(node.graphics.calls.some((call) => call.type === 'stroke'), `${label} Graphics remains active`)
      assert.deepEqual(node.graphics.calls, before[scenarioIndex].graphics, `${label} Graphics stays static`)
    }
  }
})

test('steady-state phase updates avoid Color construction resource loads and component lookups while reusing cached objects', async () => {
  const { BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY, loadedPaths } = await loadPresenter()
  const presenter = new BossTelegraphPresenter()
  const pool = new TelegraphPool(BOSS_HAZARD_POOL_CAPACITY)
  presenter.telegraphPool = pool
  presenter.onLoad()
  const entry = PROFILE_CASES[0]
  presenter.present(telegraph(entry.attackId, entry.area, entry.danger), 'full')

  const node = [...pool.active][0]
  const visual = latestWarningVisual(presenter)
  assert.ok(visual)
  const phaseOutput = visual.phase
  const reusableColors = LAYER_FIELDS.map((field) => node.layers[field].lastAssignedInput)
  const reusableVectors = LAYER_FIELDS.map((field) => ({
    position: node.layers[field].node.position,
    rotation: node.layers[field].node.eulerAngles,
    scale: node.layers[field].node.scale,
  }))
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
  assert.deepEqual(phaseOutput, { progress: 0, phase: 'warning', intensity: 0.58, travel: 0 })
  assert.strictEqual(visual.controller, node.controller)
  for (const field of LAYER_FIELDS) assert.strictEqual(visual[field], node.layers[field])

  presenter.update(0.2)
  assert.strictEqual(visual.phase, phaseOutput)
  assert.deepEqual(phaseOutput, { progress: 0.25, phase: 'warning', intensity: 0.64, travel: 0 })
  assert.notEqual(node.mainShape.color.a, before.alpha)
  presenter.update(0.4)
  assert.strictEqual(visual.phase, phaseOutput)
  assert.deepEqual(phaseOutput, { progress: 0.75, phase: 'critical', intensity: 0.792, travel: 0.167 })
  for (let index = 0; index < 120; index += 1) presenter.update(0.0005)

  for (const [index, field] of LAYER_FIELDS.entries()) {
    assert.strictEqual(node.layers[field].lastAssignedInput, reusableColors[index], `${field} color identity`)
    assert.strictEqual(node.layers[field].node.position, reusableVectors[index].position, `${field} position identity`)
    assert.strictEqual(node.layers[field].node.eulerAngles, reusableVectors[index].rotation, `${field} rotation identity`)
    assert.strictEqual(node.layers[field].node.scale, reusableVectors[index].scale, `${field} scale identity`)
  }
  assert.equal(globalThis.__bossColorAllocations, before.colorAllocations)
  assert.equal(loadedPaths.length, before.loadedPathCount)
  assert.equal(node.componentLookups, before.lookups)
  assert.deepEqual({ ...node.graphics.strokeColor }, before.stroke)
  assert.deepEqual(node.position, before.position)
  assert.deepEqual(node.transform.size, before.size)
  assert.notDeepEqual(layerGeometry(node), before.layerGeometry)
  assert.deepEqual(node.graphics.calls, before.graphics)
})

test('sweep impact crosses 82 percent of the area with a trailing accent and end dissipation', async () => {
  const { BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY } = await loadPresenter()
  const { presenter } = createPresenterScenario(BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY)
  presenter.onLoad()
  const entry = PROFILE_CASES[0]
  const authorityId = 'bamboo-sweep:7:motion'
  const { node, visual: impact } = startImpactScenario(presenter, entry, {
    attackId: authorityId,
    authorityId,
    duration: 1,
  })

  const width = entry.area.maxX - entry.area.minX
  const staticState = rootAndGraphics(node)
  const start = layerGeometry(node)
  assert.deepEqual(impact.phase, { progress: 0, phase: 'warning', intensity: 0.58, travel: 0 })
  assert.equal(impact.remaining, 1)
  assertNear(impact.width, width)
  assertNear(start.mainShape.position.x, width * -0.41, 1e-6, 'sweep impact start')
  assertNear(start.accent.position.x, start.mainShape.position.x - width * 0.12, 1e-6, 'sweep accent trails')

  presenter.update(0.4)
  assert.equal(impact.remaining, 1, 'fresh impact keeps its initial progress for one presenter update')
  assert.deepEqual(layerGeometry(node), start)

  presenter.update(0.5)
  const middle = layerGeometry(node)
  const middleAlpha = node.mainShape.color.a
  assertNear(middle.mainShape.position.x, 0, 1e-6, 'sweep impact midpoint')
  assertNear(middle.accent.position.x, width * -0.12, 1e-6, 'sweep midpoint accent trail')
  assert.ok(middle.particleNear.position.x < start.particleNear.position.x)
  assert.ok(middle.particleFar.position.x < start.particleFar.position.x)

  presenter.update(0.4999)
  const end = layerGeometry(node)
  assert.equal(impact.phase.progress, 1)
  assertNear(end.mainShape.position.x, width * 0.41, 1e-6, 'sweep impact end')
  assertNear(end.accent.position.x, end.mainShape.position.x - width * 0.12, 1e-6, 'sweep end accent trail')
  assert.ok(node.mainShape.color.a < middleAlpha, 'sweep alpha dissipates near the end')
  assert.ok(end.mainShape.scale.x < middle.mainShape.scale.x, 'sweep scale dissipates near the end')
  assert.deepEqual(rootAndGraphics(node), staticState)
  assert.equal(presenter.visibleImpactCount, 1)

  presenter.update(0.001)
  assert.equal(presenter.visibleImpactCount, 0, 'sweep keeps the existing post-fresh expiry')
})

test('spike impact rises with eased dust expansion and two scale beats', async () => {
  const { BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY } = await loadPresenter()
  const { presenter } = createPresenterScenario(BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY)
  presenter.onLoad()
  const entry = PROFILE_CASES[1]
  const authorityId = 'ground-spikes:7:motion:marker:0'
  const { node, visual: impact } = startImpactScenario(presenter, entry, {
    attackId: authorityId,
    authorityId,
    duration: 1,
  })

  const height = entry.area.maxY - entry.area.minY
  const staticState = rootAndGraphics(node)
  const start = layerGeometry(node)
  assert.deepEqual(impact.phase, { progress: 0, phase: 'warning', intensity: 0.58, travel: 0 })
  assertNear(impact.height, height)
  assertNear(start.mainShape.position.y, height * -0.38, 1e-6, 'spike impact start')
  assertNear(start.accent.scale.x, 0.55, 1e-6, 'spike dust start width')

  presenter.update(0.2)
  assert.deepEqual(layerGeometry(node), start, 'fresh spike frame is stable')
  presenter.update(0.25)
  const firstBeat = layerGeometry(node)
  presenter.update(0.25)
  const valley = layerGeometry(node)
  presenter.update(0.25)
  const secondBeat = layerGeometry(node)

  assert.ok(firstBeat.mainShape.scale.y > valley.mainShape.scale.y, 'first eruption beat resolves before midpoint')
  assert.ok(secondBeat.mainShape.scale.y > valley.mainShape.scale.y, 'second eruption beat follows midpoint')
  assert.ok(valley.mainShape.position.y > height * (-0.38 + 0.46 * 0.5), 'spike rise uses an ease-out curve')
  assert.ok(secondBeat.particleNear.position.x < 0 && secondBeat.particleFar.position.x > 0)
  assert.ok(secondBeat.particleNear.position.y > start.particleNear.position.y)
  assert.ok(secondBeat.particleFar.position.y > start.particleFar.position.y)

  presenter.update(0.2499)
  const end = layerGeometry(node)
  assert.equal(impact.phase.progress, 1)
  assertNear(end.mainShape.position.y, height * 0.08, 1e-6, 'spike impact end')
  assertNear(end.accent.scale.x, 1.2, 1e-6, 'spike dust end width')
  assert.deepEqual(rootAndGraphics(node), staticState)
  assert.equal(presenter.visibleImpactCount, 1)
})

test('roar impacts expand from .72 to 1.18 with parsed wave signatures and staggered fading', async () => {
  const { BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY } = await loadPresenter()
  const { presenter } = createPresenterScenario(BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY)
  presenter.onLoad()
  const entry = PROFILE_CASES[2]
  const authorityId = 'mountain-roar:7:motion'
  const roarCommand = (wave) => ({
    type: 'activate-hitbox',
    attackId: `${authorityId}:wave:${wave}:sector:top`,
    telegraphId: authorityId,
    area: entry.area,
    damage: 6,
    duration: 1,
  })

  startImpactScenario(presenter, entry, {
    attackId: `${authorityId}:wave:0:sector:top`,
    authorityId,
    duration: 1,
  })
  presenter.activate(3, 7, roarCommand(1))
  presenter.activate(3, 7, roarCommand(2))
  presenter.activate(3, 7, roarCommand('not-a-number'))

  const impacts = activeImpactVisuals(presenter)
  const nodes = impacts.map((impact) => impact.node)
  const staticStates = nodes.map(rootAndGraphics)
  const initialGeometry = nodes.map(layerGeometry)
  assert.deepEqual(impacts.map((impact) => impact.waveIndex), [0, 1, 2, 0])
  assert.ok(impacts.every((impact) => impact.phase.progress === 0))
  for (const geometry of initialGeometry) {
    assertNear(geometry.mainShape.scale.x, 0.72, 1e-6, 'roar main initial expansion')
    assertNear(geometry.accent.scale.x, 0.72, 1e-6, 'roar accent initial expansion')
  }

  presenter.update(0.2)
  assert.deepEqual(nodes.map(layerGeometry), initialGeometry, 'all fresh roar waves keep progress zero')
  presenter.update(0.5)

  const moving = nodes.map(layerGeometry)
  const alphas = nodes.map((node) => node.mainShape.color.a)
  assert.ok(alphas[0] < alphas[1] && alphas[1] < alphas[2], 'older roar waves fade faster at equal progress')
  assert.equal(alphas[3], alphas[0], 'invalid wave index uses the safe wave-zero fallback')
  assert.deepEqual(moving[3], moving[0], 'fallback motion matches wave zero')
  assert.equal(new Set(moving.slice(0, 3).map((geometry) => JSON.stringify({
    near: geometry.particleNear,
    far: geometry.particleFar,
    mainRotation: geometry.mainShape.eulerAngles.z,
  }))).size, 3, 'wave 0, 1, and 2 have distinct motion signatures')
  for (const geometry of moving) {
    assert.ok(geometry.particleNear.eulerAngles.z * geometry.particleFar.eulerAngles.z < 0)
    assert.ok(geometry.particleNear.position.x < 0 && geometry.particleFar.position.x > 0)
  }

  presenter.update(0.4999)
  for (const [index, node] of nodes.entries()) {
    const end = layerGeometry(node)
    assertNear(end.mainShape.scale.x, 1.18, 1e-6, `roar ${index} main end expansion`)
    assertNear(end.accent.scale.x, 1.18, 1e-6, `roar ${index} accent end expansion`)
    assert.deepEqual(rootAndGraphics(node), staticStates[index])
    assert.equal(node.graphics.calls.some((call) => call.type === 'circle'), false)
  }
  assert.equal(presenter.visibleImpactCount, 4)
})

test('production impact durations render motion and dissipation at 60 and 30 fps in both update orders', async () => {
  const { BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY } = await loadPresenter()
  const timingCases = [
    { duration: 0.18, entry: PROFILE_CASES[0] },
    { duration: 0.14, entry: PROFILE_CASES[1] },
    { duration: 0.12, entry: PROFILE_CASES[2] },
  ]

  for (const { duration, entry } of timingCases) {
    for (const deltaSeconds of [1 / 60, 1 / 30]) {
      for (const updateOrder of ['presenter-first', 'enemy-first']) {
        const label = `${entry.id} duration=${duration} dt=${deltaSeconds} order=${updateOrder}`
        const { pool, presenter } = createPresenterScenario(BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY)
        const authorityId = `${entry.attackId}:realistic:${deltaSeconds}:${updateOrder}`
        primeImpactAuthority(presenter, entry, authorityId)
        const attackId = entry.id === 'roar-wave'
          ? `${authorityId}:wave:0:sector:top`
          : authorityId
        const command = impactCommand(entry, authorityId, duration, attackId)

        if (updateOrder === 'presenter-first') presenter.update(deltaSeconds)
        presenter.activate(3, 7, command)
        const visual = latestImpactVisual(presenter)
        assert.ok(visual, `${label} activation creates impact`)
        const node = visual.node
        const initial = motionRenderSnapshot(node)
        const initialGeometry = JSON.stringify(initial.geometry)
        const initialAlpha = node.mainShape.color.a
        assert.equal(presenter.visibleImpactCount, 1, `${label} initial impact visible`)
        assert.equal(node.active, true, `${label} initial root active`)
        assert.deepEqual(layerVisibility(node).mainShape, { active: true, enabled: true }, `${label} initial main visible`)
        assert.ok(initialAlpha > 0, `${label} initial alpha rendered`)
        assert.ok(node.graphics.calls.some((call) => call.type === 'stroke'), `${label} initial Graphics rendered`)

        if (updateOrder === 'enemy-first') presenter.update(deltaSeconds)
        else presenter.update(deltaSeconds)
        assert.equal(visual.remaining, duration, `${label} fresh update preserves duration`)
        assert.deepEqual(motionRenderSnapshot(node), initial, `${label} fresh update preserves initial rendered state`)

        let elapsed = 0
        let movingRendered = false
        let dissipatingRendered = false
        for (let frame = 0; frame < 20 && presenter.visibleImpactCount > 0; frame += 1) {
          pool.frame += 1
          presenter.update(deltaSeconds)
          elapsed += deltaSeconds
          if (presenter.visibleImpactCount === 0) {
            assert.ok(elapsed + 1e-9 >= duration, `${label} cannot despawn before duration`)
            break
          }
          assert.ok(elapsed < duration + 1e-9, `${label} remains only before expiry`)
          const rendered = motionRenderSnapshot(node)
          if (JSON.stringify(rendered.geometry) !== initialGeometry) movingRendered = true
          if (node.mainShape.color.a < initialAlpha) dissipatingRendered = true
        }

        assert.equal(movingRendered, true, `${label} has a subsequent moving rendered state`)
        assert.equal(dissipatingRendered, true, `${label} has a later dissipating rendered state`)
        assert.equal(presenter.visibleImpactCount, 0, `${label} eventually despawns`)
        assert.equal(pool.active.size, 0, `${label} returns node to pool`)
      }
    }
  }
})

test('warning and impact steady-state updates reuse phase colors and layer vectors without runtime lookups', async () => {
  const { BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY, loadedPaths } = await loadPresenter()
  const { presenter } = createPresenterScenario(BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY)
  presenter.onLoad()
  const sweep = PROFILE_CASES[0]
  const spike = PROFILE_CASES[1]
  const authorityId = 'bamboo-sweep:7:steady-impact'

  const impact = startImpactScenario(presenter, sweep, {
    attackId: authorityId,
    authorityId,
    duration: 0.18,
  })
  presenter.present(telegraph('ground-spikes:7:steady-warning', spike.area, spike.danger))
  const warning = latestWarningVisual(presenter)
  assert.ok(warning)

  const visualStates = [impact.visual, warning]
  const nodes = visualStates.map((visual) => visual.node)
  const phases = visualStates.map((visual) => visual.phase)
  const colors = nodes.map((node) => LAYER_FIELDS.map((field) => node.layers[field].lastAssignedInput))
  const vectors = nodes.map((node) => LAYER_FIELDS.map((field) => ({
    position: node.layers[field].node.position,
    rotation: node.layers[field].node.eulerAngles,
    scale: node.layers[field].node.scale,
  })))
  const staticStates = nodes.map(rootAndGraphics)
  const before = {
    colorAllocations: globalThis.__bossColorAllocations,
    loadedPathCount: loadedPaths.length,
    lookups: nodes.map((node) => node.componentLookups),
  }

  for (let index = 0; index < 120; index += 1) presenter.update(0.0005)

  for (const [visualIndex, visual] of visualStates.entries()) {
    assert.strictEqual(visual.phase, phases[visualIndex], `visual ${visualIndex} phase identity`)
    assert.deepEqual(rootAndGraphics(nodes[visualIndex]), staticStates[visualIndex])
    assert.equal(nodes[visualIndex].componentLookups, before.lookups[visualIndex])
    for (const [layerIndex, field] of LAYER_FIELDS.entries()) {
      assert.strictEqual(nodes[visualIndex].layers[field].lastAssignedInput, colors[visualIndex][layerIndex], `${field} color identity`)
      assert.strictEqual(nodes[visualIndex].layers[field].node.position, vectors[visualIndex][layerIndex].position, `${field} position identity`)
      assert.strictEqual(nodes[visualIndex].layers[field].node.eulerAngles, vectors[visualIndex][layerIndex].rotation, `${field} rotation identity`)
      assert.strictEqual(nodes[visualIndex].layers[field].node.scale, vectors[visualIndex][layerIndex].scale, `${field} scale identity`)
    }
  }
  assert.equal(globalThis.__bossColorAllocations, before.colorAllocations)
  assert.equal(loadedPaths.length, before.loadedPathCount)
  assert.ok(visualStates[0].phase.progress > 0, 'impact phase advances after its fresh update')
  assert.ok(visualStates[1].phase.progress > 0, 'warning phase advances')
})

test('twenty-seven mixed warning impact pool cycles restore every transform color and frame state', async () => {
  const { BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY } = await loadPresenter()
  const { pool, presenter } = createPresenterScenario(BossTelegraphPresenter, BOSS_HAZARD_POOL_CAPACITY)
  presenter.onLoad()
  const qualities = ['full', 'reduced', 'minimal']
  const warningBaselines = new Map()
  const impactBaselines = new Map()

  for (let cycle = 0; cycle < 27; cycle += 1) {
    const entry = PROFILE_CASES[cycle % PROFILE_CASES.length]
    const quality = qualities[Math.floor(cycle / PROFILE_CASES.length) % qualities.length]
    const authorityId = `${entry.attackId}:pool-cycle:${cycle}`
    const warning = telegraph(authorityId, entry.area, entry.danger, authorityId)
    assert.equal(presenter.present(warning, quality), true)

    const warningVisual = latestWarningVisual(presenter)
    assert.ok(warningVisual)
    const warningNode = warningVisual.node
    const warningKey = `${entry.id}:${quality}`
    const warningState = pooledVisualState(warningNode)
    assert.equal(warningVisual.phase.progress, 0)
    assert.notDeepEqual(warningState.geometry.mainShape, {
      position: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      eulerAngles: { x: 0, y: 0, z: 0 },
      size: warningState.geometry.mainShape.size,
    }, `${warningKey} warning receives a motion pose`)
    if (warningBaselines.has(warningKey)) assert.deepEqual(warningState, warningBaselines.get(warningKey), `${warningKey} warning state`)
    else warningBaselines.set(warningKey, warningState)

    presenter.update(0.2)
    const impactAttackId = entry.id === 'roar-wave'
      ? `${authorityId}:wave:0:sector:top`
      : authorityId
    presenter.activate(3, 7, {
      type: 'activate-hitbox',
      attackId: impactAttackId,
      telegraphId: authorityId,
      area: entry.area,
      damage: 8,
      duration: 0.18,
      danger: entry.danger,
    }, quality)
    presenter.update(0.6)

    const impactVisual = latestImpactVisual(presenter)
    assert.ok(impactVisual)
    const impactNode = impactVisual.node
    const impactState = pooledVisualState(impactNode)
    const impactKey = `${entry.id}:${quality}`
    assert.equal(impactVisual.phase.progress, 0)
    assert.notDeepEqual(impactState.geometry.mainShape, {
      position: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      eulerAngles: { x: 0, y: 0, z: 0 },
      size: impactState.geometry.mainShape.size,
    }, `${impactKey} impact receives a motion pose`)
    if (impactBaselines.has(impactKey)) assert.deepEqual(impactState, impactBaselines.get(impactKey), `${impactKey} impact state`)
    else impactBaselines.set(impactKey, impactState)

    presenter.update(0.03)
    presenter.update(0.03)
    presenter.cancelEnemy(3, 7)
    assert.equal(pool.active.size, 0, `cycle ${cycle} active pool`)
    assert.equal(presenter.visibleTelegraphCount, 0, `cycle ${cycle} telegraphs`)
    assert.equal(presenter.visibleImpactCount, 0, `cycle ${cycle} impacts`)
    assert.deepEqual(frameIds(impactNode), [null, null, null, null], `cycle ${cycle} reset frames`)
    for (const field of LAYER_FIELDS) {
      assert.deepEqual(impactNode.layers[field].node.position, { x: 0, y: 0, z: 0 }, `cycle ${cycle} ${field} position`)
      assert.deepEqual(impactNode.layers[field].node.scale, { x: 1, y: 1, z: 1 }, `cycle ${cycle} ${field} scale`)
      assert.deepEqual(impactNode.layers[field].node.eulerAngles, { x: 0, y: 0, z: 0 }, `cycle ${cycle} ${field} rotation`)
      assert.equal(impactNode.layers[field].color.a, 0, `cycle ${cycle} ${field} alpha`)
    }
  }

  assert.equal(warningBaselines.size, 9)
  assert.equal(impactBaselines.size, 9)
  assert.equal(pool.nodes.length, 1, 'the same pooled node survives every mixed cycle')
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

test('destroy resets and despawns active layers before releasing final owned frame references', async () => {
  const {
    BossTelegraphPresenter,
    BOSS_HAZARD_POOL_CAPACITY,
    frames,
    lifecycleEvents,
  } = await loadPresenter()
  const presenter = new BossTelegraphPresenter()
  const pool = new TelegraphPool(BOSS_HAZARD_POOL_CAPACITY)
  presenter.telegraphPool = pool
  presenter.onLoad()
  const entry = PROFILE_CASES[0]

  presenter.present(telegraph(entry.attackId, entry.area, entry.danger), 'full')
  const warningNode = [...pool.active][0]
  assert.deepEqual(frameIds(warningNode), [...entry.paths, entry.paths[2]])
  assert.ok([...frames.values()].every((frame) => frame.refCount === 1 && !frame.destroyed))

  globalThis.__bossVfxActiveFramesSnapshot = () => (
    [...pool.active].flatMap((node) => frameIds(node).filter(Boolean))
  )
  const destroyStart = lifecycleEvents.length
  try {
    presenter.onDestroy()
    const destroyEvents = lifecycleEvents.slice(destroyStart)
    const resetIndex = destroyEvents.findIndex((event) => event.type === 'reset-visual')
    const despawnIndex = destroyEvents.findIndex((event) => event.type === 'despawn')
    const finalReleaseIndex = destroyEvents.findIndex((event) => (
      event.type === 'dec-ref' && event.refCountAfter === 0 && event.destroyed
    ))

    assert.ok(resetIndex >= 0, 'active warning layers are reset during destruction')
    assert.ok(despawnIndex > resetIndex, 'the reset completes before the node is despawned')
    assert.ok(finalReleaseIndex > despawnIndex, 'owned frames are released after node cleanup')
    assert.deepEqual(destroyEvents[resetIndex].before, [...entry.paths, entry.paths[2]])
    assert.deepEqual(destroyEvents[resetIndex].after, [null, null, null, null])
    assert.deepEqual(destroyEvents[despawnIndex], {
      type: 'despawn',
      frameIds: [null, null, null, null],
      nodeActive: false,
      poolActiveCount: 0,
    })
    const releases = destroyEvents.filter((event) => event.type === 'dec-ref')
    assert.equal(releases.length, RESOURCE_PATHS.length)
    assert.ok(releases.every((event) => (
      event.refCountBefore === 1
      && event.refCountAfter === 0
      && event.destroyed
      && event.activeSpriteFrames.length === 0
    )))
    assert.equal(pool.active.size, 0)
    assert.deepEqual(frameIds(warningNode), [null, null, null, null])
  } finally {
    globalThis.__bossVfxActiveFramesSnapshot = null
  }
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
  const [presenterSource, runtimeSource, hazardControllerSource] = await Promise.all([
    readFile(new URL('../assets/Scripts/Game/BossTelegraphPresenter.ts', import.meta.url), 'utf8'),
    readFile(new URL('../assets/Scripts/Game/BattleRuntimeController.ts', import.meta.url), 'utf8'),
    readFile(new URL('../assets/Scripts/Game/BossHazardVisualController.ts', import.meta.url), 'utf8'),
  ])
  const retiredTerm = new RegExp(['talis', 'man'].join(''), 'i')

  for (const source of [presenterSource, runtimeSource, hazardControllerSource, controllerSource]) {
    assert.doesNotMatch(source, retiredTerm)
  }
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
  assert.deepEqual(presenter.visibleVfxEntries().map(({ attackId, authorityId, sequence, skill, phase }) => ({
    attackId,
    authorityId,
    sequence,
    skill,
    phase,
  })), [{
    attackId: 'bamboo-sweep:7:1',
    authorityId: 'bamboo-sweep:7:1',
    sequence: 1,
    skill: 'bamboo-sweep',
    phase: 'telegraph',
  }])
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
  assert.deepEqual(presenter.visibleVfxEntries().map(({ attackId, authorityId, sequence, skill, phase }) => ({
    attackId,
    authorityId,
    sequence,
    skill,
    phase,
  })), [{
    attackId: 'bamboo-sweep:7:1',
    authorityId: 'bamboo-sweep:7:1',
    sequence: 1,
    skill: 'bamboo-sweep',
    phase: 'impact',
  }])
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
