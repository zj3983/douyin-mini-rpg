import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

import { StageResourceRuntime } from '../tools/stage-resource-runtime.mjs'

const asset = (path, kind = 'texture') => Object.freeze({ path, kind })
const plan = (stageId, names = ['background', 'monster-a', 'monster-b', 'monster-c']) => Object.freeze({
  stageId,
  assets: Object.freeze(names.map((name) => asset(`stage-${stageId}/${name}`, name === 'background' ? 'spriteFrame' : 'texture'))),
})

function createHarness(Runtime = StageResourceRuntime) {
  const actions = []
  const pending = new Map()
  const released = new Set()
  const runtime = new Runtime({
    load(descriptor, resolve, reject) {
      actions.push(`load:${descriptor.path}:${descriptor.kind}`)
      const requests = pending.get(descriptor.path) ?? []
      requests.push({ descriptor, resolve, reject })
      pending.set(descriptor.path, requests)
    },
    release(descriptor, resource) {
      assert.equal(released.has(resource), false, `${resource.name} released more than once`)
      released.add(resource)
      actions.push(`release:${descriptor.path}:${resource.name}`)
    },
    ready(stageId) {
      actions.push(`ready:${stageId}`)
    },
    warn(descriptor) {
      actions.push(`warn:${descriptor.path}`)
    },
  })

  const request = (path, index = 0) => pending.get(path)?.[index]
  const resolve = (descriptor, index = 0, name = `${descriptor.path}#${index}`) => {
    const resource = { name }
    request(descriptor.path, index).resolve(resource)
    return resource
  }
  const resolvePlan = (stagePlan, requestIndex = 0) => stagePlan.assets.map((descriptor) => resolve(descriptor, requestIndex))
  const reject = (descriptor, index = 0, message = 'failed') => request(descriptor.path, index).reject(new Error(message))
  return { runtime, actions, pending, released, request, resolve, resolvePlan, reject }
}

test('activate stage 1 only requests stage 1 and runtime never prefetches implicitly', () => {
  const harness = createHarness()
  const stage1 = plan(1)

  assert.equal(harness.runtime.activate(stage1), true)
  assert.deepEqual(
    harness.actions,
    stage1.assets.map(({ path, kind }) => `load:${path}:${kind}`),
  )
  harness.resolvePlan(stage1)

  assert.deepEqual(harness.runtime.snapshot(), {
    activeStageId: 1,
    prefetchedStageId: null,
    pendingStageIds: [],
    retainedStageIds: [1],
    destroyed: false,
  })
  assert.equal(harness.actions.includes('ready:1'), true)
  assert.equal(harness.actions.some((action) => action.includes('stage-2/')), false)
})

test('explicit prefetch waits for the caller and loads stage 2 background plus three monster atlases', () => {
  const harness = createHarness()
  const stage1 = plan(1)
  const stage2 = plan(2)

  harness.runtime.activate(stage1)
  harness.resolvePlan(stage1)
  const beforePrefetch = harness.actions.length
  assert.equal(harness.runtime.prefetch(stage2), true)

  assert.deepEqual(
    harness.actions.slice(beforePrefetch),
    stage2.assets.map(({ path, kind }) => `load:${path}:${kind}`),
  )
  harness.resolvePlan(stage2)
  assert.equal(harness.actions.includes('ready:2'), false)
  assert.equal(harness.runtime.snapshot().prefetchedStageId, 2)
})

test('activating a completed prefetch reuses it without load and then stage 3 can prefetch', () => {
  const harness = createHarness()
  const stages = [1, 2, 3].map((stageId) => plan(stageId))

  harness.runtime.activate(stages[0])
  harness.resolvePlan(stages[0])
  harness.runtime.prefetch(stages[1])
  harness.resolvePlan(stages[1])
  const loadsBeforeActivate = harness.actions.filter((action) => action.startsWith('load:')).length

  assert.equal(harness.runtime.activate(stages[1]), true)
  assert.equal(harness.actions.filter((action) => action.startsWith('load:')).length, loadsBeforeActivate)
  assert.equal(harness.actions.filter((action) => action === 'ready:2').length, 1)
  assert.equal(harness.runtime.prefetch(stages[2]), true)
  assert.deepEqual(harness.runtime.snapshot().pendingStageIds, [3])
})

test('activating a completed prefetch immediately releases the previous active stage', () => {
  const harness = createHarness()
  const stages = [1, 2, 3].map((stageId) => plan(stageId))

  harness.runtime.activate(stages[0]); harness.resolvePlan(stages[0])
  harness.runtime.prefetch(stages[1]); harness.resolvePlan(stages[1])
  const loadsBeforeActivate = harness.actions.filter((action) => action.startsWith('load:')).length

  harness.runtime.activate(stages[1])
  assert.equal(harness.actions.filter((action) => action.startsWith('load:')).length, loadsBeforeActivate)
  assert.deepEqual(harness.runtime.snapshot().retainedStageIds, [2])
  assert.equal(harness.actions.filter((action) => action.startsWith('release:stage-1/')).length, 4)

  harness.runtime.prefetch(stages[2]); harness.reject(stages[2].assets[0])
  assert.deepEqual(harness.runtime.snapshot().retainedStageIds, [2])
  assert.equal(harness.actions.filter((action) => action.startsWith('release:stage-1/')).length, 4)
})

test('completed next-stage prefetch prunes older resources and retains active plus next', () => {
  const harness = createHarness()
  const stages = [1, 2, 3, 4].map((stageId) => plan(stageId))

  harness.runtime.activate(stages[0]); harness.resolvePlan(stages[0])
  harness.runtime.prefetch(stages[1]); harness.resolvePlan(stages[1])
  harness.runtime.activate(stages[1])
  harness.runtime.prefetch(stages[2]); harness.resolvePlan(stages[2])
  harness.runtime.activate(stages[2])
  assert.deepEqual(harness.runtime.snapshot().retainedStageIds, [3])
  assert.equal(harness.actions.filter((action) => action.startsWith('release:stage-1/')).length, 4)

  harness.runtime.prefetch(stages[3]); harness.resolvePlan(stages[3])
  assert.deepEqual(harness.runtime.snapshot().retainedStageIds, [3, 4])
  assert.equal(harness.actions.filter((action) => action.startsWith('release:stage-2/')).length, 4)
})

test('failed optional prefetch never becomes ready and required activation retries every asset', () => {
  const harness = createHarness()
  const stage1 = plan(1)
  const stage2 = plan(2)

  harness.runtime.activate(stage1); harness.resolvePlan(stage1)
  harness.runtime.prefetch(stage2)
  harness.resolve(stage2.assets[0])
  harness.reject(stage2.assets[1])
  harness.resolve(stage2.assets[2])
  harness.resolve(stage2.assets[3])

  assert.equal(harness.runtime.snapshot().activeStageId, 1)
  assert.equal(harness.runtime.snapshot().prefetchedStageId, null)
  assert.equal(harness.actions.includes('ready:2'), false)
  assert.equal(harness.runtime.activate(stage2), true)
  assert.equal(harness.actions.filter((action) => action.startsWith('load:stage-2/')).length, 8)
})

test('optional prefetch can finish before an in-flight required activation without cancelling it', () => {
  const harness = createHarness()
  const stage1 = plan(1)
  const stage2 = plan(2)

  harness.runtime.activate(stage1)
  assert.equal(harness.runtime.prefetch(stage2), true)
  harness.resolvePlan(stage2)
  harness.resolvePlan(stage1)

  assert.deepEqual(harness.runtime.snapshot(), {
    activeStageId: 1,
    prefetchedStageId: 2,
    pendingStageIds: [],
    retainedStageIds: [1, 2],
    destroyed: false,
  })
  assert.equal(harness.actions.filter((action) => action === 'ready:1').length, 1)
  assert.equal(harness.actions.includes('ready:2'), false)
  assert.equal(harness.actions.some((action) => action.startsWith('release:')), false)
})

test('prefetch after a failed optional load never cancels the required retry', () => {
  const harness = createHarness()
  const stage2 = plan(2)
  const stage3 = plan(3)

  harness.runtime.prefetch(stage2)
  harness.reject(stage2.assets[0])
  assert.equal(harness.runtime.activate(stage2), true)
  assert.equal(harness.runtime.prefetch(stage3), true)
  harness.resolvePlan(stage2, 1)

  assert.equal(harness.actions.filter((action) => action === 'ready:2').length, 1)
  assert.equal(harness.runtime.snapshot().activeStageId, 2)
  harness.resolvePlan(stage3)
  assert.deepEqual(harness.runtime.snapshot().retainedStageIds, [2, 3])
  assert.equal(harness.runtime.snapshot().prefetchedStageId, 3)
})

test('required completion releases the previous active stage when optional prefetch completes first', () => {
  const harness = createHarness()
  const stages = [1, 2, 3].map((stageId) => plan(stageId))

  harness.runtime.activate(stages[0]); harness.resolvePlan(stages[0])
  harness.runtime.prefetch(stages[1]); harness.reject(stages[1].assets[0])
  harness.runtime.activate(stages[1])
  harness.runtime.prefetch(stages[2]); harness.resolvePlan(stages[2])
  assert.deepEqual(harness.runtime.snapshot().retainedStageIds, [1, 3])

  harness.resolvePlan(stages[1], 1)
  assert.deepEqual(harness.runtime.snapshot().retainedStageIds, [2, 3])
  assert.equal(harness.runtime.snapshot().activeStageId, 2)
  assert.equal(harness.runtime.snapshot().prefetchedStageId, 3)
  assert.equal(harness.actions.filter((action) => action.startsWith('release:stage-1/')).length, 4)
})

test('required completion releases the previous active stage before optional prefetch completes', () => {
  const harness = createHarness()
  const stages = [1, 2, 3].map((stageId) => plan(stageId))

  harness.runtime.activate(stages[0]); harness.resolvePlan(stages[0])
  harness.runtime.prefetch(stages[1]); harness.reject(stages[1].assets[0])
  harness.runtime.activate(stages[1])
  harness.runtime.prefetch(stages[2])

  harness.resolvePlan(stages[1], 1)
  assert.deepEqual(harness.runtime.snapshot().retainedStageIds, [2])
  assert.equal(harness.actions.filter((action) => action.startsWith('release:stage-1/')).length, 4)

  harness.resolvePlan(stages[2])
  assert.deepEqual(harness.runtime.snapshot().retainedStageIds, [2, 3])
  assert.equal(harness.runtime.snapshot().activeStageId, 2)
  assert.equal(harness.runtime.snapshot().prefetchedStageId, 3)
  assert.equal(harness.actions.filter((action) => action.startsWith('release:stage-1/')).length, 4)
})

test('activate promotes an in-flight prefetch for the same plan without duplicate loads', () => {
  const harness = createHarness()
  const stage2 = plan(2)

  harness.runtime.prefetch(stage2)
  const loadsBeforeActivate = harness.actions.filter((action) => action.startsWith('load:')).length
  assert.equal(harness.runtime.activate(stage2), true)
  assert.equal(harness.actions.filter((action) => action.startsWith('load:')).length, loadsBeforeActivate)
  harness.resolvePlan(stage2)

  assert.equal(harness.runtime.snapshot().activeStageId, 2)
  assert.equal(harness.runtime.snapshot().prefetchedStageId, null)
  assert.equal(harness.actions.filter((action) => action === 'ready:2').length, 1)
})

test('required failure keeps the old active stage and preserves valid pending next-stage work for retry', () => {
  const harness = createHarness()
  const stages = [1, 2, 3].map((stageId) => plan(stageId))

  harness.runtime.activate(stages[0]); harness.resolvePlan(stages[0])
  harness.runtime.activate(stages[1])
  harness.runtime.prefetch(stages[2])
  assert.deepEqual(harness.runtime.snapshot().pendingStageIds, [2, 3])
  const optionalLoaded = harness.resolve(stages[2].assets[0])
  harness.reject(stages[1].assets[0])

  assert.equal(harness.runtime.snapshot().activeStageId, 1)
  assert.deepEqual(harness.runtime.snapshot().retainedStageIds, [1])
  assert.equal(harness.actions.some((action) => action.startsWith('release:stage-1/')), false)
  assert.equal(harness.actions.includes('ready:3'), false)
  assert.equal(harness.runtime.activate(stages[1]), true)
  assert.equal(harness.released.has(optionalLoaded), false)
  harness.resolvePlan(stages[1], 1)
  const completedOptional = stages[2].assets.slice(1).map((descriptor) => harness.resolve(descriptor))

  assert.equal(harness.runtime.snapshot().activeStageId, 2)
  assert.deepEqual(harness.runtime.snapshot().retainedStageIds, [2, 3])
  assert.equal(harness.actions.filter((action) => action.startsWith('release:stage-1/')).length, 4)
  assert.equal(harness.actions.includes('ready:3'), false)
  assert.equal(harness.released.has(optionalLoaded), false)
  assert.equal(completedOptional.every((resource) => harness.released.has(resource)), false)
})

test('cross-stage activation drops a stale prefetch and retains a concurrently completed next stage', () => {
  const harness = createHarness()
  const stages = [1, 2, 3, 4].map((stageId) => plan(stageId))

  harness.runtime.activate(stages[0]); harness.resolvePlan(stages[0])
  harness.runtime.prefetch(stages[1]); harness.resolvePlan(stages[1])
  harness.runtime.activate(stages[2])

  assert.deepEqual(harness.runtime.snapshot().retainedStageIds, [1])
  assert.equal(harness.actions.filter((action) => action.startsWith('release:stage-2/')).length, 4)

  harness.runtime.prefetch(stages[3])
  harness.resolvePlan(stages[2])
  harness.resolvePlan(stages[3])

  assert.deepEqual(harness.runtime.snapshot().retainedStageIds, [3, 4])
  assert.equal(harness.actions.filter((action) => action.startsWith('release:stage-1/')).length, 4)
  assert.equal(harness.actions.filter((action) => action.startsWith('release:stage-2/')).length, 4)
})

test('required retry preserves its completed next-stage prefetch but not an older stale prefetch', () => {
  const harness = createHarness()
  const stages = [1, 2, 3, 4].map((stageId) => plan(stageId))

  harness.runtime.activate(stages[0]); harness.resolvePlan(stages[0])
  harness.runtime.prefetch(stages[1]); harness.resolvePlan(stages[1])
  harness.runtime.activate(stages[2])
  harness.runtime.prefetch(stages[3]); harness.resolvePlan(stages[3])
  harness.reject(stages[2].assets[0])

  assert.deepEqual(harness.runtime.snapshot().retainedStageIds, [1, 4])
  assert.equal(harness.actions.filter((action) => action.startsWith('release:stage-2/')).length, 4)
  const loadsBeforeRetry = harness.actions.filter((action) => action.startsWith('load:stage-4/')).length

  harness.runtime.activate(stages[2]); harness.resolvePlan(stages[2], 1)
  assert.equal(harness.actions.filter((action) => action.startsWith('load:stage-4/')).length, loadsBeforeRetry)
  assert.deepEqual(harness.runtime.snapshot().retainedStageIds, [3, 4])
  assert.equal(harness.actions.filter((action) => action.startsWith('release:stage-1/')).length, 4)
  assert.equal(harness.actions.filter((action) => action.startsWith('release:stage-2/')).length, 4)
})

test('failed required activation preserves active stage, warns once, and can retry', () => {
  const harness = createHarness()
  const stage1 = plan(1)
  const stage2 = plan(2)

  harness.runtime.activate(stage1); harness.resolvePlan(stage1)
  harness.runtime.activate(stage2)
  harness.resolve(stage2.assets[0])
  harness.reject(stage2.assets[1])
  harness.reject(stage2.assets[2])
  harness.reject(stage2.assets[3])

  assert.equal(harness.runtime.snapshot().activeStageId, 1)
  assert.equal(harness.actions.filter((action) => action.startsWith('warn:')).length, 1)
  assert.equal(harness.runtime.activate(stage2), true)
  harness.resolvePlan(stage2, 1)
  assert.equal(harness.runtime.snapshot().activeStageId, 2)
})

test('rapid changes, stale callbacks, and destroy release every successful load exactly once', () => {
  const harness = createHarness()
  const stages = [1, 2, 3].map((stageId) => plan(stageId))

  harness.runtime.activate(stages[0])
  const stage1First = harness.resolve(stages[0].assets[0])
  harness.runtime.activate(stages[1])
  const stage2First = harness.resolve(stages[1].assets[0])
  harness.runtime.activate(stages[2])
  const staleStage1 = stages[0].assets.slice(1).map((descriptor) => harness.resolve(descriptor))
  const staleStage2 = stages[1].assets.slice(1).map((descriptor) => harness.resolve(descriptor))
  const stage3First = harness.resolve(stages[2].assets[0])
  harness.runtime.destroy()
  harness.runtime.destroy()
  const lateStage3 = stages[2].assets.slice(1).map((descriptor) => harness.resolve(descriptor))

  const successful = [stage1First, stage2First, ...staleStage1, ...staleStage2, stage3First, ...lateStage3]
  assert.equal(harness.released.size, successful.length)
  assert.equal(successful.every((resource) => harness.released.has(resource)), true)
  assert.equal(harness.runtime.snapshot().destroyed, true)
  assert.equal(harness.runtime.activate(plan(4)), false)
  assert.equal(harness.runtime.prefetch(plan(4)), false)
})

test('stage 4 remains active without any implicit stage 5 request', () => {
  const harness = createHarness()
  const stage4 = plan(4)

  harness.runtime.activate(stage4)
  harness.resolvePlan(stage4)

  assert.equal(harness.actions.some((action) => action.includes('stage-5/')), false)
  assert.equal(harness.runtime.snapshot().activeStageId, 4)
})

async function loadTypeScriptRuntime() {
  const source = readFileSync(new URL('../assets/Scripts/Core/StageResourceRuntime.ts', import.meta.url), 'utf8')
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`)
}

function runParitySequence(Runtime) {
  const harness = createHarness(Runtime)
  const stages = [1, 2, 3, 4].map((stageId) => plan(stageId))
  harness.runtime.activate(stages[0])
  harness.runtime.prefetch(stages[1]); harness.resolvePlan(stages[1]); harness.resolvePlan(stages[0])
  harness.runtime.activate(stages[1])
  harness.runtime.activate(stages[2])
  harness.runtime.prefetch(stages[3]); harness.resolve(stages[3].assets[0])
  harness.reject(stages[2].assets[2])
  harness.runtime.activate(stages[2]); harness.resolvePlan(stages[2], 1)
  stages[3].assets.slice(1).forEach((descriptor) => harness.resolve(descriptor))
  return { snapshot: harness.runtime.snapshot(), actions: harness.actions }
}

test('TypeScript and ESM runtimes produce identical snapshots and adapter actions', async () => {
  const { StageResourceRuntime: TypeScriptRuntime } = await loadTypeScriptRuntime()
  assert.deepEqual(runParitySequence(TypeScriptRuntime), runParitySequence(StageResourceRuntime))
})
