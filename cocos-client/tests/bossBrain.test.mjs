import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import * as bossBrainModule from '../assets/Scripts/Combat/BossBrain.ts'

import {
  BossBrainState,
  createBambooWardenBrain,
  defeatBambooWarden,
  hurtBambooWarden,
  interruptBambooWarden,
  setBossHealthRatio,
  setBambooWardenPosition,
  stepBambooWarden,
} from '../assets/Scripts/Combat/BossBrain.ts'
import {
  computeBattleLayout,
  computeBossVisualPlacement,
} from '../assets/Scripts/Combat/BattleLayout.ts'
import {
  consumeEnemyCombatCommand,
  createEnemyCombatResolverAdapter,
  drainEnemyCombatDamage,
  drainEnemyTelegraphs,
  enemyCombatAdapterSnapshot,
  pauseEnemyCombatResolverAdapter,
  removeEnemyCombatActor,
  resetEnemyCombatResolverAdapter,
  stepEnemyCombatResolverAdapter,
  upsertEnemyCombatActor,
  upsertPlayerCombatActor,
} from '../assets/Scripts/Game/EnemyCombatResolverAdapter.ts'

const bounds = Object.freeze({ minX: -360, maxX: 360, minY: -220, maxY: 300 })
const spawn = Object.freeze({ x: 230, y: 40 })

function context(now, player = { x: -40, y: 20 }, playerMotion) {
  return {
    now,
    player: { id: 'player', position: player, alive: true },
    ...(playerMotion ? { playerMotion } : {}),
    neighbors: [],
    battleBounds: bounds,
  }
}

function advanceTrace(brain, target, partition = [1 / 60], playerAt = () => ({ x: -40, y: 20 })) {
  const trace = []
  let index = 0
  while (brain.elapsed + 1e-10 < target) {
    const delta = Math.min(partition[index % partition.length], target - brain.elapsed)
    const fromTime = brain.elapsed
    const now = brain.elapsed + delta
    const commands = stepBambooWarden(brain, context(now, playerAt(now), {
      fromTime,
      fromPosition: playerAt(fromTime),
      toTime: now,
      toPosition: playerAt(now),
    }), delta)
    for (const command of commands) trace.push({ at: command.eventTime ?? brain.elapsed, command })
    index += 1
    assert.ok(index < 100000, 'boss simulation did not converge')
  }
  return trace
}

function attackKind(command) {
  return command.attackId?.split(':')[0] ?? null
}

function attackInstance(command) {
  return command.attackId?.split(':').slice(0, 3).join(':') ?? null
}

function seedForFirstAttack(expected, id = 7) {
  for (let seed = 0; seed < 256; seed += 1) {
    const brain = createBambooWardenBrain(id, spawn, seed)
    const first = advanceTrace(brain, 0.75).find(({ command }) => command.type === 'show-telegraph')
    if (first && attackKind(first.command) === expected) return seed
  }
  assert.fail(`no deterministic seed selected ${expected}`)
}

function assertDeepFrozen(value) {
  if (value === null || typeof value !== 'object') return
  assert.equal(Object.isFrozen(value), true)
  for (const nested of Object.values(value)) assertDeepFrozen(nested)
}

test('bamboo sweep keeps a full 0.8 second warning, vertical escapes, active window, and recovery', () => {
  const brain = createBambooWardenBrain(7, spawn, seedForFirstAttack('bamboo-sweep'))
  const trace = advanceTrace(brain, 3)
  const telegraph = trace.find(({ command }) => command.type === 'show-telegraph' && attackKind(command) === 'bamboo-sweep')
  const active = trace.find(({ command }) => command.type === 'activate-hitbox' && attackKind(command) === 'bamboo-sweep')
  const recovery = trace.find(({ command }) => command.type === 'animate' && command.action === 'boss-recovery')

  assert.ok(telegraph)
  assert.equal(telegraph.command.duration, 0.8)
  assert.equal(telegraph.command.danger.kind, 'sweep')
  assert.equal(telegraph.command.danger.escape, 'vertical')
  assert.ok(telegraph.command.area.minY - bounds.minY >= 60)
  assert.ok(bounds.maxY - telegraph.command.area.maxY >= 60)
  assert.ok(active)
  assert.equal(active.command.attackId, telegraph.command.attackId)
  assert.ok(active.at + 1e-9 >= telegraph.at + telegraph.command.duration)
  assert.ok(active.command.duration > 0)
  assert.ok(recovery?.at > active.at)
})

test('bamboo sweep active reuses the exact telegraphed area after the player escapes vertically', () => {
  const brain = createBambooWardenBrain(70, spawn, seedForFirstAttack('bamboo-sweep', 70))
  const telegraphTrace = advanceTrace(brain, 0.65, [0.25], () => ({ x: -40, y: -120 }))
  const telegraph = telegraphTrace.find(({ command }) => command.type === 'show-telegraph')?.command
  assert.ok(telegraph)

  const activeTrace = advanceTrace(brain, 1.35, [0.25], () => ({ x: -40, y: 220 }))
  const active = activeTrace.find(({ command }) => command.type === 'activate-hitbox')?.command
  assert.ok(active)
  assert.equal(active.attackId, telegraph.attackId)
  assert.deepEqual(active.area, telegraph.area)
  assert.equal(220 > telegraph.area.maxY, true, 'escaped player must remain outside the warned sweep')

  const generation = 70
  const adapter = createEnemyCombatResolverAdapter(generation)
  upsertEnemyCombatActor(adapter, { generation, enemyId: 70, position: spawn, radius: 70, alive: true })
  upsertPlayerCombatActor(adapter, { generation, position: { x: -40, y: -120 }, radius: 24, alive: true })
  consumeEnemyCombatCommand(adapter, generation, 70, telegraph)
  upsertPlayerCombatActor(adapter, { generation, position: { x: -40, y: 220 }, radius: 24, alive: true })
  consumeEnemyCombatCommand(adapter, generation, 70, active)
  for (let index = 0; index < 5; index += 1) stepEnemyCombatResolverAdapter(adapter, 0.25)
  assert.deepEqual(drainEnemyCombatDamage(adapter), [])
})

test('ground spikes place three ordered foot markers before activating them in the same order', () => {
  const brain = createBambooWardenBrain(8, spawn, seedForFirstAttack('ground-spikes', 8))
  const playerAt = (now) => ({ x: -180 + now * 70, y: -90 + now * 20 })
  const trace = advanceTrace(brain, 3.5, [1 / 60], playerAt)
  const markers = trace.filter(({ command }) => command.type === 'show-telegraph' && command.danger?.kind === 'spike')
  const active = trace.filter(({ command }) => command.type === 'activate-hitbox' && command.danger?.kind === 'spike')

  assert.deepEqual(markers.slice(0, 3).map(({ command }) => command.danger.markerIndex), [0, 1, 2])
  assert.deepEqual(active.slice(0, 3).map(({ command }) => command.danger.markerIndex), [0, 1, 2])
  assert.equal(markers.slice(0, 3).every(({ command }) => command.duration >= 0.8), true)
  assert.ok(active[0].at >= markers[2].at)
  assert.ok(trace.indexOf(active[0]) > trace.indexOf(markers[2]))
  for (let index = 0; index < 3; index += 1) {
    assert.equal(active[index].command.attackId, markers[index].command.attackId)
    assert.deepEqual(active[index].command.area, markers[index].command.area)
  }
})

test('mountain roar expands ordered rings while preserving one explicit safe angular gap', () => {
  const brain = createBambooWardenBrain(9, spawn, seedForFirstAttack('mountain-roar', 9))
  const trace = advanceTrace(brain, 3.5)
  const telegraphs = trace.filter(({ command }) => command.type === 'show-telegraph' && command.danger?.kind === 'roar-sector')
  const active = trace.filter(({ command }) => command.type === 'activate-hitbox' && command.danger?.kind === 'roar-sector')

  assert.ok(telegraphs.length >= 4)
  assert.equal(telegraphs.every(({ command }) => command.duration >= 0.8), true)
  const gaps = new Set(telegraphs.map(({ command }) => JSON.stringify(command.danger.safeGap)))
  assert.equal(gaps.size, 1)
  const waveRadii = [...new Map(active.map(({ command }) => [command.danger.waveIndex, command.danger.radius])).values()]
  assert.deepEqual(waveRadii, waveRadii.toSorted((left, right) => left - right))
  assert.ok(waveRadii.length >= 3)
  assert.ok(new Set(active.map(({ command }) => command.danger.sector)).size >= 4)
  assert.equal(active.some(({ command }) => command.danger.sector === command.danger.safeGap.sector), false)
})

test('mountain roar active sectors reuse telegraph-time snapshots after a resize', () => {
  const brain = createBambooWardenBrain(86, spawn, seedForFirstAttack('mountain-roar', 86))
  const beforeResize = advanceTrace(brain, 0.7, [0.25])
  const telegraphTop = beforeResize.find(({ command }) => (
    command.type === 'show-telegraph'
    && command.danger?.kind === 'roar-sector'
    && command.danger.sector === 'top'
  ))?.command
  assert.ok(telegraphTop)

  setBambooWardenPosition(brain, { x: 40, y: -120 })
  const resizedBounds = { minX: -260, maxX: 260, minY: -180, maxY: 220 }
  const resizedContext = (now) => ({
    now,
    player: { id: 'player', position: { x: -40, y: 20 }, alive: true },
    neighbors: [],
    battleBounds: resizedBounds,
  })
  const afterResize = []
  while (brain.elapsed < 1.8) {
    const delta = Math.min(0.25, 1.8 - brain.elapsed)
    const commands = stepBambooWarden(brain, resizedContext(brain.elapsed + delta), delta)
    afterResize.push(...commands)
  }
  const activeTop = afterResize.find((command) => (
    command.type === 'activate-hitbox'
    && command.danger?.kind === 'roar-sector'
    && command.danger.waveIndex === 2
    && command.danger.sector === 'top'
  ))
  assert.ok(activeTop)
  assert.deepEqual(activeTop.area, telegraphTop.area)
})

test('phase two schedules two distinct attacks without shortening warnings and cooldowns prevent immediate repeats', () => {
  const brain = createBambooWardenBrain(10, spawn, 31)
  setBossHealthRatio(brain, 0.49)
  const trace = advanceTrace(brain, 16, [0.019])
  const telegraphs = trace.filter(({ command }) => command.type === 'show-telegraph')
  const instances = []
  for (const entry of telegraphs) {
    const instance = attackInstance(entry.command)
    if (instances.at(-1)?.id !== instance) instances.push({ id: instance, kind: attackKind(entry.command), at: entry.at })
  }

  assert.equal(brain.phaseNumber, 2)
  assert.ok(instances.length >= 6)
  assert.notEqual(instances[0].kind, instances[1].kind)
  assert.ok(instances[1].at - instances[0].at < 0.8, 'phase-two pair should overlap full telegraphs')
  assert.equal(telegraphs.every(({ command }) => command.duration >= 0.8), true)
  for (let index = 1; index < instances.length; index += 1) {
    assert.notEqual(instances[index].kind, instances[index - 1].kind)
  }
  const cooldowns = brain.snapshot().cooldowns
  assert.deepEqual(Object.keys(cooldowns).sort(), ['bamboo-sweep', 'ground-spikes', 'mountain-roar'])
  assert.equal(Object.values(cooldowns).every(Number.isFinite), true)
})

test('fixed seed and inputs emit identical complete command structures across reasonable frame partitions', () => {
  const partitions = [[1 / 60], [0.019], [0.07], [0.25], [0.033, 0.011, 0.023]]
  const runs = partitions.map((partition) => {
    const brain = createBambooWardenBrain(11, spawn, 0x9e3779b9)
    setBossHealthRatio(brain, 0.42)
    return { brain, commands: advanceTrace(brain, 12.5, partition).map((entry) => entry.command) }
  })
  const reference = runs[0]

  for (const run of runs.slice(1)) {
    assert.deepEqual(run.commands, reference.commands)
    assert.deepEqual(run.brain.snapshot(), reference.brain.snapshot())
  }
  for (const command of reference.commands) assertDeepFrozen(command)
  assert.ok(reference.commands.some((command) => command.type === 'activate-hitbox'))
})

test('authoritative event sampling keeps all three attacks and phase two deterministic on a moving trajectory', () => {
  const partitions = [[1 / 60], [0.019], [0.25], [0.033, 0.011, 0.023]]
  const playerAt = (time) => ({ x: -240 + time * 31, y: -130 + time * 43 })
  const scenarios = [
    { id: 71, seed: seedForFirstAttack('bamboo-sweep', 71), phaseTwo: false, target: 3.5 },
    { id: 72, seed: seedForFirstAttack('ground-spikes', 72), phaseTwo: false, target: 3.5 },
    { id: 73, seed: seedForFirstAttack('mountain-roar', 73), phaseTwo: false, target: 3.5 },
    { id: 74, seed: 31, phaseTwo: true, target: 12.5 },
  ]

  for (const scenario of scenarios) {
    const runs = partitions.map((partition) => {
      const brain = createBambooWardenBrain(scenario.id, spawn, scenario.seed)
      if (scenario.phaseTwo) setBossHealthRatio(brain, 0.42)
      return advanceTrace(brain, scenario.target, partition, playerAt).map(({ command }) => command)
    })
    for (const commands of runs.slice(1)) assert.deepEqual(commands, runs[0])
  }
})

test('nonlinear player motion locks every Boss attack to identical tactical cells across frame partitions', () => {
  const partitions = [[1 / 60], [0.019], [0.25]]
  const phases = [0, 0.31, 1.1]
  const scenarios = [
    { id: 81, seed: seedForFirstAttack('bamboo-sweep', 81), phaseTwo: false, target: 3.5 },
    { id: 82, seed: seedForFirstAttack('ground-spikes', 82), phaseTwo: false, target: 3.5 },
    { id: 83, seed: seedForFirstAttack('mountain-roar', 83), phaseTwo: false, target: 3.5 },
    { id: 84, seed: 31, phaseTwo: true, target: 10.5 },
    { id: 85, seed: 0x12345678, phaseTwo: true, target: 10.5 },
  ]

  for (const phase of phases) {
    const playerAt = (time) => ({
      x: -80 + Math.cos(time * 1.3 + phase * 0.7) * 96,
      y: -100 + Math.sin(time * 1.7 + phase) * 120,
    })
    for (const scenario of scenarios) {
      const runs = partitions.map((partition) => {
        const brain = createBambooWardenBrain(scenario.id, spawn, scenario.seed)
        if (scenario.phaseTwo) setBossHealthRatio(brain, 0.42)
        return advanceTrace(brain, scenario.target, partition, playerAt).map(({ command }) => command)
      })
      for (const commands of runs.slice(1)) assert.deepEqual(commands, runs[0])

      const cellSize = bossBrainModule.BAMBOO_WARDEN_TARGET_GRID?.cellSize
      assert.equal(cellSize, 48)
      for (const command of runs[0]) {
        if (command.type === 'show-telegraph' && command.danger?.kind === 'spike') {
          assert.equal(Number.isInteger(command.danger.center.x / cellSize), true)
          assert.equal(Number.isInteger(command.danger.center.y / cellSize), true)
        }
        if (command.type === 'show-telegraph' && command.danger?.kind === 'sweep') {
          const centerY = (command.area.minY + command.area.maxY) / 2
          assert.equal(Number.isInteger(centerY / cellSize), true)
        }
      }
    }
  }
})

test('Boss tactical grid uses fixed in-bounds centers and breaks exact half-cell ties toward the positive axis', () => {
  assert.equal(typeof bossBrainModule.quantizeBambooWardenTarget, 'function')
  const gridBounds = { minX: -96, maxX: 96, minY: -96, maxY: 96 }
  const lock = bossBrainModule.quantizeBambooWardenTarget

  assert.deepEqual(lock({ x: 23.999, y: -24.001 }, gridBounds), { x: 0, y: -48 })
  assert.deepEqual(lock({ x: 24, y: -24 }, gridBounds), { x: 48, y: 0 })
  assert.deepEqual(lock({ x: 24.001, y: -23.999 }, gridBounds), { x: 48, y: 0 })
  assert.deepEqual(lock({ x: 500, y: -500 }, gridBounds), { x: 96, y: -96 })
})

test('live adapter preserves at least 0.8 seconds of visible Boss warning for coarse and uneven frames', () => {
  for (const partition of [[1 / 60], [0.019], [0.25], [0.033, 0.011, 0.023]]) {
    const generation = 80
    const enemyId = 75
    const brain = createBambooWardenBrain(enemyId, spawn, seedForFirstAttack('bamboo-sweep', enemyId))
    const adapter = createEnemyCombatResolverAdapter(generation)
    upsertEnemyCombatActor(adapter, { generation, enemyId, position: spawn, radius: 70, alive: true })
    upsertPlayerCombatActor(adapter, { generation, position: { x: -40, y: 20 }, radius: 24, alive: true })
    let telegraph = null
    let damage = null
    let index = 0

    while (brain.elapsed < 3 && !damage) {
      const delta = partition[index % partition.length]
      const commands = stepBambooWarden(brain, context(brain.elapsed + delta), delta)
      for (const command of commands) {
        if (command.type === 'activate-hitbox') {
          const position = {
            x: (command.area.minX + command.area.maxX) / 2,
            y: (command.area.minY + command.area.maxY) / 2,
          }
          upsertPlayerCombatActor(adapter, { generation, position, radius: 24, alive: true })
        }
        consumeEnemyCombatCommand(adapter, generation, enemyId, command)
      }
      telegraph ??= drainEnemyTelegraphs(adapter).find((event) => event.attackId.startsWith('bamboo-sweep')) ?? null
      stepEnemyCombatResolverAdapter(adapter, delta)
      damage = drainEnemyCombatDamage(adapter).find((event) => event.attackId.startsWith('bamboo-sweep')) ?? null
      index += 1
    }

    assert.ok(telegraph)
    assert.ok(damage)
    assert.ok(telegraph.activationNotBefore + 1e-10 >= telegraph.visibleAt + 0.8)
    assert.ok(damage.at + 1e-10 >= telegraph.activationNotBefore, JSON.stringify({ partition, telegraph, damage }))
  }
})

test('live resolver delivers Boss damage only after a real brain active command', () => {
  const generation = 21
  const enemyId = 12
  const brain = createBambooWardenBrain(enemyId, spawn, seedForFirstAttack('bamboo-sweep', enemyId))
  const adapter = createEnemyCombatResolverAdapter(generation)
  upsertEnemyCombatActor(adapter, { generation, enemyId, position: spawn, radius: 70, alive: true })
  let playerPosition = { x: -40, y: 20 }
  upsertPlayerCombatActor(adapter, { generation, position: playerPosition, radius: 24, alive: true })
  let activeSeen = false
  let damageBeforeActive = 0
  let damageAfterActive = 0

  while (brain.elapsed < 3 && damageAfterActive === 0) {
    const delta = 1 / 60
    const commands = stepBambooWarden(brain, context(brain.elapsed + delta, playerPosition), delta)
    for (const command of commands) {
      if (command.type === 'activate-hitbox') {
        activeSeen = true
        playerPosition = {
          x: (command.area.minX + command.area.maxX) / 2,
          y: (command.area.minY + command.area.maxY) / 2,
        }
        upsertPlayerCombatActor(adapter, { generation, position: playerPosition, radius: 24, alive: true })
      }
      consumeEnemyCombatCommand(adapter, generation, enemyId, command)
    }
    stepEnemyCombatResolverAdapter(adapter, delta)
    const damage = drainEnemyCombatDamage(adapter).length
    if (activeSeen) damageAfterActive += damage
    else damageBeforeActive += damage
  }

  assert.equal(damageBeforeActive, 0)
  assert.equal(activeSeen, true)
  assert.equal(damageAfterActive, 1)
  const deliveredTelegraphs = drainEnemyTelegraphs(adapter)
  assert.ok(deliveredTelegraphs.length > 0)
  assert.equal(deliveredTelegraphs.every((event) => event.danger?.kind === 'sweep'), true)
  assertDeepFrozen(deliveredTelegraphs)
})

test('Boss interruption policy, freeze, death, generation reset, and pool removal leave no attacks behind', () => {
  const generation = 30
  const enemyId = 13
  const brain = createBambooWardenBrain(enemyId, spawn, seedForFirstAttack('bamboo-sweep', enemyId))
  advanceTrace(brain, 0.65)
  const phaseBefore = brain.phase
  assert.deepEqual(interruptBambooWarden(brain, brain.elapsed), [])
  assert.equal(brain.phase, phaseBefore)

  advanceTrace(brain, 1.6)
  assert.equal(brain.phase, 'recovery')
  const hurt = hurtBambooWarden(brain, brain.elapsed)
  assert.equal(brain.phase, 'hurt')
  assert.equal(hurt.some((command) => command.type === 'animate' && command.action === 'boss-hurt'), true)

  const adapter = createEnemyCombatResolverAdapter(generation)
  upsertPlayerCombatActor(adapter, { generation, position: { x: 0, y: 0 }, radius: 24, alive: true })
  upsertEnemyCombatActor(adapter, { generation, enemyId, position: spawn, radius: 70, alive: true })
  consumeEnemyCombatCommand(adapter, generation, enemyId, {
    type: 'activate-hitbox',
    attackId: 'bamboo-sweep:13:pool',
    area: { minX: -30, maxX: 30, minY: -30, maxY: 30 },
    damage: 8,
    duration: 3,
  })
  assert.equal(enemyCombatAdapterSnapshot(adapter).hitboxCount, 1)
  assert.equal(pauseEnemyCombatResolverAdapter(adapter, generation, true), true)
  assert.equal(enemyCombatAdapterSnapshot(adapter).hitboxCount, 0)
  stepEnemyCombatResolverAdapter(adapter, 0.25)
  assert.deepEqual(drainEnemyCombatDamage(adapter), [])

  const death = defeatBambooWarden(brain, brain.elapsed)
  assert.equal(brain.phase, 'death')
  assert.equal(death.some((command) => command.type === 'animate' && command.action === 'boss-death'), true)
  assert.deepEqual(advanceTrace(brain, brain.elapsed + 1).map(({ command }) => command), [])
  assert.equal(removeEnemyCombatActor(adapter, generation, enemyId), true)
  assert.equal(resetEnemyCombatResolverAdapter(adapter, generation + 1), generation + 1)
  assert.equal(consumeEnemyCombatCommand(adapter, generation, enemyId, death[0]), false)
  assert.equal(enemyCombatAdapterSnapshot(adapter).hitboxCount, 0)
})

test('phase-two overlap cannot be interrupted while the paired attack is still telegraphing or active', () => {
  const enemyId = 15
  const brain = createBambooWardenBrain(enemyId, spawn, seedForFirstAttack('bamboo-sweep', enemyId))
  setBossHealthRatio(brain, 0.49)
  advanceTrace(brain, 1.4)

  assert.equal(brain.phase, 'recovery')
  assert.deepEqual(interruptBambooWarden(brain, brain.elapsed), [])
  assert.deepEqual(hurtBambooWarden(brain, brain.elapsed), [])
  const remaining = advanceTrace(brain, 2.3).map(({ command }) => command)
  assert.ok(remaining.some((command) => command.type === 'activate-hitbox'))
})

test('Boss placement preserves frame aspect and keeps the complete frame inside every actor safe rect', () => {
  const viewports = [
    { cssWidth: 390, cssHeight: 844, topInsetPx: 47, bottomInsetPx: 34 },
    { cssWidth: 360, cssHeight: 800, topInsetPx: 0, bottomInsetPx: 0 },
    { cssWidth: 412, cssHeight: 915, topInsetPx: 30, bottomInsetPx: 24 },
  ]
  for (const viewport of viewports) {
    const layout = computeBattleLayout({ designWidth: 750, ...viewport })
    const placement = computeBossVisualPlacement(layout, { width: 768, height: 960 })
    const ratio = placement.visualSize.width / placement.visualSize.height
    assert.ok(Math.abs(ratio - 768 / 960) < 1e-12)
    assert.ok(placement.visualSize.width <= layout.bossMaxVisualBounds.width)
    assert.ok(placement.visualSize.height <= layout.bossMaxVisualBounds.height)
    assert.ok(placement.position.x - placement.visualSize.width / 2 >= layout.actorSafeRect.minX - 1e-9)
    assert.ok(placement.position.x + placement.visualSize.width / 2 <= layout.actorSafeRect.maxX + 1e-9)
    assert.ok(placement.position.y - placement.visualSize.height / 2 >= layout.actorSafeRect.minY - 1e-9)
    assert.ok(placement.position.y + placement.visualSize.height / 2 <= layout.actorSafeRect.maxY + 1e-9)
    assertDeepFrozen(placement)
  }
})

test('Cocos wiring uses layout authority, the live command adapter, and visual-only facing', () => {
  const spawner = readFileSync(new URL('../assets/Scripts/Game/EnemySpawner.ts', import.meta.url), 'utf8')
  const bootstrap = readFileSync(new URL('../assets/Scripts/Game/PortraitBattleBootstrap.ts', import.meta.url), 'utf8')
  const runtime = readFileSync(new URL('../assets/Scripts/Game/BattleRuntimeController.ts', import.meta.url), 'utf8')
  const controller = readFileSync(new URL('../assets/Scripts/Game/EnemyController.ts', import.meta.url), 'utf8')
  const visual = readFileSync(new URL('../assets/Scripts/Game/EnemyVisualController.ts', import.meta.url), 'utf8')
  const meta = JSON.parse(readFileSync(new URL('../assets/Scripts/Combat/BossBrain.ts.meta', import.meta.url), 'utf8'))

  assert.doesNotMatch(spawner, /bossSpawnX|bossScale\s*=/)
  assert.match(spawner, /configureBattleLayout/)
  assert.match(spawner, /computeBossVisualPlacement/)
  assert.match(spawner, /animationManifest[\s\S]*frameSize/)
  assert.match(bootstrap, /enemySpawner\.configureBattleLayout\(layout\)/)
  assert.match(bootstrap, /enemy-visual-frame-ready/)
  assert.doesNotMatch(runtime, /tickBossSkillRuntime|boss-skill:/)
  assert.match(controller, /createBambooWardenBrain/)
  assert.match(controller, /stepBambooWarden/)
  assert.match(runtime, /consumeEnemyCombatCommand/)
  assert.match(visual, /const visualNode = this\.animator\?\.targetSprite\?\.node/)
  assert.doesNotMatch(controller, /this\.node\.setScale\([^)]*facing/)
  assert.equal(meta.importer, 'typescript')
  assert.match(meta.uuid, /^[0-9a-f-]{36}$/)
})

test('Boss state authority validates inputs and cannot be forged', () => {
  const brain = createBambooWardenBrain(14, spawn, 0xffffffff)
  assert.ok(brain instanceof BossBrainState)
  assert.deepEqual(Object.keys(brain), [])
  assert.throws(() => stepBambooWarden({ ...brain }, context(0.1), 0.1), /BossBrainState/)
  assert.throws(() => createBambooWardenBrain(-1, spawn, 1), /id/)
  assert.throws(() => createBambooWardenBrain(1, { x: Infinity, y: 0 }, 1), /spawn/)
  assert.throws(() => createBambooWardenBrain(1, spawn, -1), /seed/)
  assert.throws(() => setBossHealthRatio(brain, Number.NaN), /ratio/)
  assert.deepEqual(stepBambooWarden(brain, context(0), 0), [])
})
