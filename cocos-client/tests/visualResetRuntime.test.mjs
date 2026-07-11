import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import * as esmRuntime from '../tools/visual-reset-runtime.mjs'
import {
  acceptAnimationLoad,
  acceptManifestLoad,
  beginAnimationLoad,
  beginManifestLoad,
  bindVisualListeners,
  createVisualResetState,
  prepareVisualForPool,
  resetVisualForSpawn,
  setVisualActionState,
  visualResetCommands,
} from '../tools/visual-reset-runtime.mjs'

test('twenty pooled spawn cycles restore the canonical monster visual state', () => {
  let state = createVisualResetState()

  for (let cycle = 0; cycle < 20; cycle += 1) {
    state = {
      ...state,
      localPosition: { x: cycle + 1, y: -cycle, z: 7 },
      localScale: { x: 2, y: 0.4, z: 3 },
      rotation: { x: 11, y: 22, z: 180 },
      opacity: 0,
      color: { r: 12, g: 34, b: 56, a: 78 },
      facing: 1,
      action: cycle % 2 ? 'death' : 'hurt',
      frameIndex: 9,
      defeated: true,
      hit: true,
      attacking: true,
      playing: true,
    }

    state = prepareVisualForPool(state)
    state = resetVisualForSpawn(state, { actorId: `monster-${cycle}`, facing: -1 })

    assert.deepEqual(state.localPosition, { x: 0, y: 0, z: 0 })
    assert.deepEqual(state.localScale, { x: 1, y: 1, z: 1 })
    assert.deepEqual(state.rotation, { x: 0, y: 0, z: 0 })
    assert.equal(state.opacity, 255)
    assert.deepEqual(state.color, { r: 255, g: 255, b: 255, a: 255 })
    assert.equal(state.facing, -1)
    assert.equal(state.action, 'move')
    assert.equal(state.frameIndex, 0)
    assert.equal(state.defeated, false)
    assert.equal(state.hit, false)
    assert.equal(state.attacking, false)
    assert.equal(state.actorId, `monster-${cycle}`)
  }
})

test('animation load tokens reject stale actor and action resources', () => {
  let state = resetVisualForSpawn(createVisualResetState(), { actorId: 'moss-wolf', facing: -1 })
  const wolf = beginAnimationLoad(state, 'moss-wolf', 'death')
  state = wolf.state
  const moth = beginAnimationLoad(state, 'green-wing-moth', 'move')
  state = moth.state

  assert.equal(acceptAnimationLoad(state, wolf.token), false)
  assert.equal(acceptAnimationLoad(state, moth.token), true)

  const hurt = beginAnimationLoad(state, 'green-wing-moth', 'hurt')
  assert.equal(acceptAnimationLoad(hurt.state, moth.token), false)
  assert.equal(acceptAnimationLoad(hurt.state, hurt.token), true)

  const pooled = prepareVisualForPool(hurt.state)
  assert.equal(acceptAnimationLoad(pooled, hurt.token), false)
})

test('pooled manifest callback is rejected while the next spawn callback is accepted', () => {
  let state = resetVisualForSpawn(createVisualResetState(), { actorId: 'moss-wolf', facing: -1 })
  const stale = beginManifestLoad(state)
  state = prepareVisualForPool(state)

  assert.equal(acceptManifestLoad(state, stale), false)

  state = resetVisualForSpawn(state, { actorId: 'green-wing-moth', facing: -1 })
  const current = beginManifestLoad(state)
  assert.equal(acceptManifestLoad(state, stale), false)
  assert.equal(acceptManifestLoad(state, current), true)
})

test('canonical commands consumed by the controller reset every visual field for 20 cycles', () => {
  let state = createVisualResetState()
  for (let cycle = 0; cycle < 20; cycle += 1) {
    state = setVisualActionState(state, cycle % 2 ? 'death' : 'hurt')
    state = prepareVisualForPool({
      ...state,
      localPosition: { x: 8, y: 9, z: 10 },
      localScale: { x: 3, y: 4, z: 5 },
      rotation: { x: 30, y: 60, z: 90 },
      opacity: 17,
      color: { r: 1, g: 2, b: 3, a: 4 },
      frameIndex: 7,
    })
    state = resetVisualForSpawn(state, { actorId: `actor-${cycle}`, facing: -1 })
    const commands = visualResetCommands(state)

    assert.deepEqual(commands, {
      position: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      rotation: { x: 0, y: 0, z: 0 },
      color: { r: 255, g: 255, b: 255, a: 255 },
      actorId: `actor-${cycle}`,
      action: 'move',
      frameIndex: 0,
      defeated: false,
      hit: false,
      attacking: false,
    })
  }
})

test('visual listener binding is idempotent across pool lifecycle cycles', () => {
  let state = createVisualResetState()
  for (let cycle = 0; cycle < 20; cycle += 1) {
    const first = bindVisualListeners(state)
    const duplicate = bindVisualListeners(first.state)
    assert.equal(first.bound, true)
    assert.equal(duplicate.bound, false)
    state = prepareVisualForPool(duplicate.state)
    assert.equal(state.listenersBound, false)
  }
})

test('TypeScript and executable mirrors produce the same pooled lifecycle trace', async () => {
  const source = await readFile(new URL('../assets/Scripts/Core/VisualResetRuntime.ts', import.meta.url), 'utf8')
  const executable = stripTypeScriptTypes(source, { mode: 'transform' })
  const tsRuntime = await import(`data:text/javascript;base64,${Buffer.from(executable).toString('base64')}`)

  assert.deepEqual(parityTrace(tsRuntime), parityTrace(esmRuntime))
})

function parityTrace(runtime) {
  let state = runtime.createVisualResetState()
  const trace = []
  for (let cycle = 0; cycle < 20; cycle += 1) {
    state = runtime.prepareVisualForPool({ ...state, action: 'death', frameIndex: 8, opacity: 0 })
    state = runtime.resetVisualForSpawn(state, { actorId: `actor-${cycle}`, facing: -1 })
    const request = runtime.beginAnimationLoad(state, state.actorId, cycle % 2 ? 'move' : 'attack')
    state = request.state
    trace.push({ state, accepted: runtime.acceptAnimationLoad(state, request.token) })
  }
  return trace
}
