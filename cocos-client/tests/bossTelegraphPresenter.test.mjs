import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

import {
  createBambooWardenBrain,
  setBossHealthRatio,
  stepBambooWarden,
} from '../assets/Scripts/Combat/BossBrain.ts'

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
    .replace("from '../Combat/BossBrain.ts'", `from '${new URL('../assets/Scripts/Combat/BossBrain.ts', import.meta.url).href}'`)
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
    this.activationLog.push({
      kind: node.graphics.fillColor.r === 238 ? 'impact' : 'telegraph',
      area: { minX: x - width / 2, maxX: x + width / 2, minY: y - height / 2, maxY: y + height / 2 },
    })
    node.hazardKind = node.graphics.fillColor.r === 238 ? 'impact' : 'telegraph'
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
