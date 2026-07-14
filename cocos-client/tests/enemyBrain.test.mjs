import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createEnemyBrain,
  defeatEnemyBrain,
  EnemyBrainState,
  interruptEnemyBrain,
  stepEnemyBrain,
} from '../assets/Scripts/Combat/EnemyBrain.ts'

const bounds = Object.freeze({ minX: -360, maxX: 360, minY: -140, maxY: 240 })

function context(now, player = { x: 0, y: -80 }, neighbors = []) {
  return {
    now,
    player: { id: 'player', position: player, alive: true },
    neighbors,
    battleBounds: bounds,
  }
}

function advance(brain, seconds, partition = [1 / 60], playerAt = () => ({ x: 0, y: -80 }), neighbors = []) {
  const commands = []
  let now = brain.elapsed
  let index = 0
  while (now + 1e-10 < seconds) {
    const delta = Math.min(partition[index % partition.length], seconds - now)
    now += delta
    commands.push(...stepEnemyBrain(brain, context(now, playerAt(now), neighbors), delta))
    index += 1
    assert.ok(index < 100000)
  }
  return commands
}

function traceUntil(brain, predicate, limit = 8, playerAt, neighbors = []) {
  const trace = [brain.phaseLabel]
  const commands = []
  let now = 0
  while (!predicate(brain, commands)) {
    now += 1 / 60
    const frame = stepEnemyBrain(brain, context(now, playerAt?.(now), neighbors), 1 / 60)
    commands.push(...frame)
    if (trace.at(-1) !== brain.phaseLabel) trace.push(brain.phaseLabel)
    assert.ok(now < limit, `brain did not reach expected phase; trace=${trace.join(',')}`)
  }
  return { trace, commands, now }
}

function assertDeepFrozen(value) {
  if (value === null || typeof value !== 'object') return
  assert.equal(Object.isFrozen(value), true)
  for (const nested of Object.values(value)) assertDeepFrozen(nested)
}

test('wolf follows the exact chain, samples its telegraph target, overshoots, and recovers after a miss', () => {
  const wolf = createEnemyBrain('moss-wolf', 1, { x: 260, y: -80 }, 123)
  let telegraphPlayer = null
  let attackPlayer = null
  const result = traceUntil(
    wolf,
    (brain) => brain.phase === 'recovery',
    8,
    (now) => {
      if (wolf.phase === 'select-position' || wolf.phase === 'telegraph') {
        telegraphPlayer ??= { x: -20, y: 90 }
        return telegraphPlayer
      }
      if (wolf.phase === 'attack') {
        attackPlayer ??= { x: 310, y: 200 }
        return attackPlayer
      }
      return { x: 0, y: -80 }
    },
  )

  assert.deepEqual(result.trace, ['spawn', 'select-position', 'telegraph', 'attack', 'recovery'])
  const telegraph = result.commands.find((command) => command.type === 'show-telegraph')
  const hitbox = result.commands.find((command) => command.type === 'activate-hitbox')
  assert.equal(telegraph.attackId.startsWith('wolf-pounce:'), true)
  assert.ok(telegraph.duration >= 0.4)
  assert.equal(telegraph.area.minY, -104)
  assert.equal(telegraph.area.maxY, -56)
  assert.deepEqual(wolf.sampledTarget, { x: telegraphPlayer.x, y: -80 })
  assert.ok(Math.abs(wolf.attackDestination.x - telegraphPlayer.x) >= 70)
  assert.equal(wolf.attackDestination.y, -80)
  assert.equal(hitbox.attackId, telegraph.attackId)
  assert.ok(hitbox.duration > 0 && hitbox.duration < wolf.attackDuration)
  assert.equal(result.commands.some((command) => command.type === 'animate' && command.action === 'wolf-crouch'), true)
  assert.equal(result.commands.some((command) => command.type === 'animate' && command.action === 'wolf-pounce'), true)
  assert.equal(result.commands.some((command) => command.type === 'animate' && command.action === 'wolf-brake'), true)
  assert.equal(result.commands.some((command) => command.type === 'contact-damage'), false)
  assert.equal(wolf.position.y, -80)
})

test('wolf flank selection stays on the ground and separates from living neighbors', () => {
  const neighbors = [
    { id: 2, position: { x: 90, y: -80 }, alive: true },
    { id: 3, position: { x: -90, y: -80 }, alive: true },
    { id: 4, position: { x: 280, y: -80 }, alive: false },
  ]
  const wolf = createEnemyBrain('moss-wolf', 5, { x: 300, y: -80 }, 5)
  traceUntil(wolf, (brain) => brain.phase === 'telegraph', 6, undefined, neighbors)

  assert.equal(wolf.position.y, -80)
  assert.equal(wolf.selectedPosition.y, -80)
  for (const neighbor of neighbors.filter((entry) => entry.alive)) {
    assert.ok(Math.abs(wolf.selectedPosition.x - neighbor.position.x) >= 72)
  }
})

test('moth alternates dive and spirit-orb with readable air-lane attacks and a projectile gap', () => {
  const moth = createEnemyBrain('green-wing-moth', 2, { x: 260, y: 150 }, 99)
  const labels = [moth.phaseLabel]
  const commands = []
  let now = 0
  while (!labels.includes('attack:spirit-orb')) {
    now += 1 / 60
    const frame = stepEnemyBrain(moth, context(now), 1 / 60)
    commands.push(...frame)
    if (labels.at(-1) !== moth.phaseLabel) labels.push(moth.phaseLabel)
    assert.ok(now < 10, labels.join(','))
  }

  assert.deepEqual(labels.slice(0, 7), [
    'spawn',
    'select-position',
    'telegraph:dive',
    'attack:dive',
    'recovery',
    'telegraph:spirit-orb',
    'attack:spirit-orb',
  ])
  const telegraphs = commands.filter((command) => command.type === 'show-telegraph')
  assert.deepEqual(telegraphs.map((command) => command.attackId.split(':')[0]), ['moth-dive', 'moth-spirit-orb'])
  assert.equal(telegraphs.every((command) => command.duration >= 0.4), true)
  const diveHitboxes = commands.filter((command) => command.type === 'activate-hitbox')
  assert.equal(diveHitboxes.length, 1)
  assert.equal(diveHitboxes[0].attackId.startsWith('moth-dive:'), true)
  const projectiles = commands.filter((command) => command.type === 'spawn-projectile')
  assert.equal(projectiles.length, 2)
  const [lower, upper] = projectiles.toSorted((a, b) => a.origin.y - b.origin.y)
  assert.ok(upper.origin.y - upper.radius - (lower.origin.y + lower.radius) >= 72)
  assert.equal(commands.some((command) => command.type === 'animate' && command.action === 'moth-dive'), true)
  assert.equal(commands.some((command) => command.type === 'animate' && command.action === 'moth-spirit-orb'), true)
  assert.equal(commands.some((command) => /wing-node|fake-wing/.test(command.action ?? '')), false)
})

test('moth selection remains in its bounded air lane and separates from neighbors', () => {
  const neighbors = [
    { id: 10, position: { x: 80, y: 150 }, alive: true },
    { id: 11, position: { x: -80, y: 170 }, alive: true },
  ]
  const moth = createEnemyBrain('green-wing-moth', 7, { x: 300, y: 180 }, 7)
  traceUntil(moth, (brain) => brain.phase === 'telegraph', 6, undefined, neighbors)

  assert.ok(moth.selectedPosition.y >= 40)
  assert.ok(moth.selectedPosition.y <= 220)
  for (const neighbor of neighbors) {
    assert.ok(Math.hypot(
      moth.selectedPosition.x - neighbor.position.x,
      moth.selectedPosition.y - neighbor.position.y,
    ) >= 80)
  }
})

test('100 brains use deterministic five-bucket decision staggering at 10Hz', () => {
  const brains = Array.from({ length: 100 }, (_, index) => createEnemyBrain(
    index % 2 ? 'moss-wolf' : 'green-wing-moth',
    index + 1,
    { x: 300, y: index % 2 ? -80 : 160 },
    index,
  ))
  const offsets = brains.map((brain) => brain.nextDecisionAt)
  assert.deepEqual([...new Set(offsets)], [0.02, 0.04, 0.06, 0.08, 0])
  for (const offset of new Set(offsets)) assert.equal(offsets.filter((value) => value === offset).length, 20)

  let now = 0
  const decisionsPerFrame = []
  for (let frame = 0; frame < 60; frame += 1) {
    now += 1 / 60
    let decisions = 0
    for (const brain of brains) {
      const before = brain.decisionCount
      stepEnemyBrain(brain, context(now), 1 / 60)
      decisions += brain.decisionCount - before
    }
    decisionsPerFrame.push(decisions)
  }
  assert.ok(Math.max(...decisionsPerFrame) <= 20)
  assert.equal(brains.every((brain) => brain.decisionCount >= 8 && brain.decisionCount <= 11), true)

  const clones = Array.from({ length: 100 }, (_, index) => createEnemyBrain(
    index % 2 ? 'moss-wolf' : 'green-wing-moth',
    index + 1,
    { x: 300, y: index % 2 ? -80 : 160 },
    index,
  ))
  advance(clones[36], 1, [0.25])
  assert.deepEqual(clones[36].snapshot(), brains[36].snapshot())
})

test('partitioned simulation is deterministic and movement commands update every frame', () => {
  const coarse = createEnemyBrain('moss-wolf', 8, { x: 300, y: -80 }, 0xffffffff)
  const fine = createEnemyBrain('moss-wolf', 8, { x: 300, y: -80 }, 0xffffffff)
  const coarseCommands = advance(coarse, 2, [0.25])
  advance(fine, 2, [1 / 60])

  assert.deepEqual(coarse.snapshot(), fine.snapshot())
  assert.equal(coarseCommands.filter((command) => command.type === 'move').length, 8)
  assert.equal(advance(coarse, 2.1, [0.05]).filter((command) => command.type === 'move').length, 2)
})

test('invalid creation and context values are rejected while invalid dt is inert and capped', () => {
  for (const seed of [-1, 0.5, Number.NaN, Infinity, 0x100000000]) {
    assert.throws(() => createEnemyBrain('moss-wolf', 1, { x: 0, y: 0 }, seed), /uint32/)
  }
  for (const spawn of [{ x: NaN, y: 0 }, { x: 0, y: Infinity }]) {
    assert.throws(() => createEnemyBrain('moss-wolf', 1, spawn, 1), /finite/)
  }
  assert.throws(() => createEnemyBrain('bamboo-warden', 1, { x: 0, y: 0 }, 1), /kind/)

  const brain = createEnemyBrain('moss-wolf', 1, { x: 0, y: -80 }, 1)
  const initial = brain.snapshot()
  for (const delta of [0, -1, NaN, -Infinity]) {
    assert.deepEqual(stepEnemyBrain(brain, context(0), delta), [])
    assert.deepEqual(brain.snapshot(), initial)
  }
  assert.throws(() => stepEnemyBrain(brain, context(NaN), 1 / 60), /now must be finite/)
  assert.throws(() => stepEnemyBrain(brain, context(1, { x: Infinity, y: 0 }), 1 / 60), /player position/)

  const capped = createEnemyBrain('moss-wolf', 1, { x: 0, y: -80 }, 1)
  const quarter = createEnemyBrain('moss-wolf', 1, { x: 0, y: -80 }, 1)
  stepEnemyBrain(capped, context(10), 10)
  stepEnemyBrain(quarter, context(0.25), 0.25)
  assert.deepEqual(capped.snapshot(), quarter.snapshot())
})

test('authority cannot be forged and outputs are recursively immutable defensive values', () => {
  const brain = createEnemyBrain('moss-wolf', 1, { x: 100, y: -80 }, 1)
  assert.ok(brain instanceof EnemyBrainState)
  assert.deepEqual(Object.keys(brain), [])
  const commands = stepEnemyBrain(brain, context(1 / 60), 1 / 60)
  assertDeepFrozen(commands)
  assert.throws(() => commands.push({ type: 'move', velocity: { x: 0, y: 0 } }), TypeError)
  assert.throws(() => { commands[0].velocity.x = 100 }, TypeError)
  assert.throws(() => stepEnemyBrain({ ...brain }, context(1 / 60), 1 / 60), /EnemyBrainState/)
  assert.throws(() => interruptEnemyBrain({ ...brain }, 0), /EnemyBrainState/)
  assert.throws(() => defeatEnemyBrain({ ...brain }, 0), /EnemyBrainState/)
})

test('interrupt and defeat enter distinct terminal presentation branches without damage', () => {
  const interrupted = createEnemyBrain('moss-wolf', 1, { x: 100, y: -80 }, 1)
  const interruption = interruptEnemyBrain(interrupted, 0.1)
  assert.equal(interrupted.phase, 'interrupted')
  assert.equal(interruption.some((command) => command.type === 'animate' && command.action === 'wolf-interrupted'), true)
  assert.equal(interruption.some((command) => command.type === 'activate-hitbox'), false)

  const defeated = createEnemyBrain('green-wing-moth', 2, { x: 100, y: 120 }, 2)
  const death = defeatEnemyBrain(defeated, 0.2)
  assert.equal(defeated.phase, 'death')
  assert.equal(death.some((command) => command.type === 'animate' && command.action === 'moth-death'), true)
  assert.deepEqual(stepEnemyBrain(defeated, context(1), 0.25).filter(
    (command) => command.type !== 'move' && command.type !== 'face',
  ), [])
})
