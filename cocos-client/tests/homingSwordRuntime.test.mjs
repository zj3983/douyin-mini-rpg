import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import {
  HOMING_SWORD_RUNTIME_VERSION,
  beginSwordReturn,
  createHomingSword,
  recordSwordHit,
  selectNearestTarget,
  stepHomingSword,
} from '../tools/homing-sword-runtime.mjs'

const config = { speed: 10, maxTurnRadians: Math.PI / 2, maxOutboundDistance: 20, returnRadius: 1 }
const target = (id, x, y, alive = true) => ({ id, position: { x, y }, alive })

function finiteState(state) {
  return [state.position.x, state.position.y, state.velocity.x, state.velocity.y, state.distanceTravelled]
    .every(Number.isFinite)
}

test('selects nearest alive finite target with deterministic id tie break', () => {
  const targets = [target('z', 1, 0), target('a', -1, 0), target('dead', 0, 0, false), target('bad', NaN, 0)]
  assert.equal(selectNearestTarget({ x: 0, y: 0 }, targets)?.id, 'a')
  assert.equal(selectNearestTarget({ x: 0, y: 0 }, targets, new Set(['a']))?.id, 'z')
})

test('homes from a high player position toward a ground target', () => {
  const state = createHomingSword({ x: 0, y: 100 }, { x: 1, y: 0 }, config)
  stepHomingSword(state, 1, [target('ground', 10, 0)], { x: 0, y: 100 })
  assert.equal(state.targetId, 'ground')
  assert.ok(state.velocity.y < 0)
  assert.ok(finiteState(state))
})

test('bounds angular steering per step', () => {
  const state = createHomingSword({ x: 0, y: 0 }, { x: 1, y: 0 }, { ...config, maxTurnRadians: Math.PI / 4 })
  stepHomingSword(state, 1, [target('up', 0, 100)], { x: 0, y: 0 })
  assert.ok(Math.abs(Math.atan2(state.velocity.y, state.velocity.x) - Math.PI / 4) < 1e-9)
})

test('retargets when the current target dies and reports the change', () => {
  const state = createHomingSword({ x: 0, y: 0 }, { x: 1, y: 0 }, config)
  stepHomingSword(state, 0.1, [target('a', 5, 0), target('b', 8, 0)], { x: 0, y: 0 })
  const result = stepHomingSword(state, 0.1, [target('a', 5, 0, false), target('b', 8, 0)], { x: 0, y: 0 })
  assert.equal(result.previousTargetId, 'a')
  assert.equal(result.nextTargetId, 'b')
  assert.equal(result.targetChanged, true)
})

test('clamps outbound movement at max distance and transitions to return', () => {
  const state = createHomingSword({ x: 0, y: 0 }, { x: 1, y: 0 }, config)
  const result = stepHomingSword(state, 100, [], { x: 0, y: 0 })
  assert.deepEqual(state.position, { x: 20, y: 0 })
  assert.equal(state.distanceTravelled, 20)
  assert.equal(state.phase, 'returning')
  assert.equal(result.previousPhase, 'outbound')
  assert.equal(result.nextPhase, 'returning')
})

test('returning tracks a moved player and finishes within radius without overshoot', () => {
  const state = createHomingSword({ x: 0, y: 0 }, { x: 1, y: 0 }, config)
  stepHomingSword(state, 2, [], { x: 0, y: 0 })
  const result = stepHomingSword(state, 100, [], { x: 5, y: 5 })
  assert.equal(state.phase, 'finished')
  assert.ok(Math.hypot(state.position.x - 5, state.position.y - 5) <= config.returnRadius + 1e-9)
  assert.deepEqual(result.nextPosition, state.position)
  assert.ok(finiteState(state))
})

test('records each valid hit only once across the full cast', () => {
  const state = createHomingSword({ x: 0, y: 0 }, { x: 1, y: 0 }, config)
  assert.equal(recordSwordHit(state, 'enemy'), true)
  beginSwordReturn(state)
  assert.equal(recordSwordHit(state, 'enemy'), false)
  assert.equal(recordSwordHit(state, ''), false)
  assert.equal(recordSwordHit(state, null), false)
  assert.deepEqual(state.hitIds, ['enemy'])
})

test('return is idempotent and invalid delta does not move or create NaN', () => {
  const state = createHomingSword({ x: NaN, y: 2 }, { x: Infinity, y: 0 }, config)
  assert.ok(finiteState(state))
  const before = structuredClone(state)
  stepHomingSword(state, -1, [], { x: 0, y: 0 })
  stepHomingSword(state, NaN, [], { x: 0, y: 0 })
  assert.deepEqual(state, before)
  assert.equal(beginSwordReturn(state), true)
  assert.equal(beginSwordReturn(state), false)
})

async function loadTypeScriptRuntime() {
  const source = await readFile(new URL('../assets/Scripts/Core/HomingSwordRuntime.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /from ['"]cc['"]|require\(['"]cc['"]\)/)
  assert.match(source, new RegExp(`HOMING_SWORD_RUNTIME_VERSION\\s*=\\s*['\"]${HOMING_SWORD_RUNTIME_VERSION}['\"]`))
  const executable = stripTypeScriptTypes(source, { mode: 'transform' })
  return import(`data:text/javascript;base64,${Buffer.from(executable).toString('base64')}`)
}

function parityTrace(runtime) {
  const state = runtime.createHomingSword({ x: 0, y: 100 }, { x: 1, y: 0 }, config)
  const trace = [structuredClone(state)]
  trace.push(runtime.stepHomingSword(state, 0.25, [target('b', 10, 0), target('a', -10, 0)], { x: 0, y: 100 }))
  trace.push(runtime.recordSwordHit(state, 'a'))
  trace.push(runtime.stepHomingSword(state, 0.25, [target('a', -10, 0, false), target('b', 10, 0)], { x: 2, y: 80 }))
  trace.push(runtime.stepHomingSword(state, 100, [], { x: 2, y: 80 }))
  trace.push(runtime.stepHomingSword(state, 100, [], { x: 5, y: 90 }))
  trace.push(runtime.recordSwordHit(state, 'a'))
  trace.push(structuredClone(state))
  return trace
}

test('TypeScript and ESM runtimes execute the same homing cast identically', async () => {
  const tsRuntime = await loadTypeScriptRuntime()
  const esmRuntime = await import('../tools/homing-sword-runtime.mjs')
  assert.deepEqual(parityTrace(tsRuntime), parityTrace(esmRuntime))
})
