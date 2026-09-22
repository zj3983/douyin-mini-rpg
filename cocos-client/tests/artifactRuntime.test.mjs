import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createArtifactRuntime,
  resetArtifact,
  setArtifactLevel,
  stepArtifact,
} from '../assets/Scripts/Combat/ArtifactRuntime.ts'

const bounds = { minX: -360, maxX: 360, minY: -260, maxY: 260 }
const target = (id, x, y, alive = true) => ({ id, position: { x, y }, alive })
const context = (targets, ownerPosition = { x: 0, y: 0 }, now = 0) => ({
  now,
  ownerPosition,
  targets,
  battleBounds: bounds,
})

function commandsOf(type, commands) {
  return commands.filter((command) => command.type === type)
}

function advance(runtime, targets, frames = 1, delta = 1 / 30, ownerPosition = { x: 0, y: 0 }) {
  const commands = []
  for (let index = 0; index < frames; index += 1) {
    commands.push(...stepArtifact(runtime, context(targets, ownerPosition, index * delta), delta))
  }
  return commands
}

test('flying sword selects the nearest alive target and starts with a hand seal', () => {
  const runtime = createArtifactRuntime({ artifactId: 'flying-sword', level: 1, ownerId: 'player' })

  const commands = stepArtifact(runtime, context([
    target('far', 240, 0),
    target('near', 90, 0),
    target('dead', 10, 0, false),
  ]), 1 / 60)

  assert.equal(commands[0].type, 'animate-owner')
  assert.equal(commands[0].action, 'hand_seal')
  assert.equal(commandsOf('spawn-sword', commands)[0].targetId, 'near')
})

test('level-one flying sword reaches a distant boss instead of returning early', () => {
  const runtime = createArtifactRuntime({ artifactId: 'flying-sword', level: 1, ownerId: 'player' })
  const boss = target('boss', 230, 220)

  const commands = advance(runtime, [boss], 240, 1 / 60, { x: -210, y: -80 })

  assert.ok(commandsOf('resolve-sword-hit', commands)
    .some((command) => command.targetId === 'boss' && command.phase === 'outbound'))
})

test('outbound sword steering is curved and remains above the battle floor at close range', () => {
  const runtime = createArtifactRuntime({ artifactId: 'flying-sword', level: 1, ownerId: 'player' })
  stepArtifact(runtime, context([target('close', 24, -180)]), 1 / 60)

  const moves = advance(runtime, [target('close', 24, -180)], 5)
    .filter((command) => command.type === 'move-sword')
  assert.ok(moves.length >= 2)
  const angles = moves.map((command) => Math.atan2(command.to.y - command.from.y, command.to.x - command.from.x))
  assert.ok(angles.some((angle, index) => index > 0 && Math.abs(angle - angles[index - 1]) > 0.001))
  assert.ok(moves.every((command) => command.to.y >= bounds.minY + 38))
})

test('outbound and returning phases can pierce each target once per phase', () => {
  const runtime = createArtifactRuntime({ artifactId: 'flying-sword', level: 1, ownerId: 'player' })
  const targets = [target('a', 80, 0), target('b', 155, 0)]

  const commands = advance(runtime, targets, 180)
  const hits = commandsOf('resolve-sword-hit', commands)
  const hitKeys = hits.map((hit) => `${hit.pathId}:${hit.phase}:${hit.targetId}`)
  const semanticHitKeys = hits.map((hit) => `${hit.phase}:${hit.targetId}`)
  assert.equal(new Set(hitKeys).size, hitKeys.length)
  assert.ok(semanticHitKeys.includes('outbound:a'))
  assert.ok(semanticHitKeys.includes('outbound:b'))
  assert.ok(semanticHitKeys.includes('returning:a'))
  assert.ok(semanticHitKeys.includes('returning:b'))
})

test('flying sword mutates only at artifact levels six, twelve, and eighteen', () => {
  const runtime = createArtifactRuntime({ artifactId: 'flying-sword', level: 1, ownerId: 'player' })

  setArtifactLevel(runtime, 5)
  assert.equal(stepArtifact(runtime, context([target('a', 120, 0)]), 1 / 60)
    .filter((command) => command.type === 'spawn-sword').length, 1)

  resetArtifact(runtime, 2)
  setArtifactLevel(runtime, 6)
  assert.equal(stepArtifact(runtime, context([target('a', 120, 0), target('b', 150, 25), target('c', 180, -25)]), 1 / 60)
    .filter((command) => command.type === 'spawn-sword').length, 3)

  resetArtifact(runtime, 3)
  setArtifactLevel(runtime, 12)
  assert.ok(advance(runtime, [target('a', 140, 0)], 80)
    .some((command) => command.type === 'move-sword' && command.phase === 'orbit'))

  resetArtifact(runtime, 4)
  setArtifactLevel(runtime, 18)
  const spawns = stepArtifact(runtime, context([target('a', 150, 0), target('b', 170, 50), target('c', 170, -50)]), 1 / 60)
    .filter((command) => command.type === 'spawn-sword')
  assert.ok(spawns.length >= 5)
  assert.equal(runtime.level, 18)
})

test('reset rejects stale generations and clears active paths only for current work', () => {
  const runtime = createArtifactRuntime({ artifactId: 'flying-sword', level: 6, ownerId: 'player' })
  stepArtifact(runtime, context([target('a', 120, 0)]), 1 / 60)
  assert.ok(runtime.activePaths.size > 0)

  resetArtifact(runtime, 0)
  assert.ok(runtime.activePaths.size > 0)
  assert.equal(runtime.generation, 1)

  resetArtifact(runtime, 2)
  assert.equal(runtime.activePaths.size, 0)
  assert.equal(runtime.generation, 2)
})
