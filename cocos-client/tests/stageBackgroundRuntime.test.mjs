import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

import { StageBackgroundRuntime } from '../tools/stage-background-runtime.mjs'
import { stageVisualFor } from '../tools/stage-visual-catalog.mjs'

const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`

async function loadStageResourceController() {
  const ccUrl = moduleUrl(`
    export class Asset {}
    export class SpriteFrame {}
    export class Texture2D {}
    export const resources = { load() {} }
  `)
  const runtimeUrl = moduleUrl(`
    export class StageResourceRuntime {
      constructor() {}
      activate() { return true }
      prefetch(plan) {
        globalThis.__stageResourcePrefetches.push(plan.stageId)
        return true
      }
      destroy() {}
    }
  `)
  const catalogUrl = moduleUrl(`
    export const WORLD_STAGE_COUNT = 10
    export const stageResourcePlanFor = (stageId) => ({ stageId, assets: [] })
  `)
  const backgroundUrl = moduleUrl('export class StageBackgroundController {}')
  const source = readFileSync(new URL('../assets/Scripts/Game/StageResourceController.ts', import.meta.url), 'utf8')
  let javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  javascript = javascript
    .replace("from 'cc'", `from '${ccUrl}'`)
    .replace("from '../Core/StageResourceRuntime'", `from '${runtimeUrl}'`)
    .replace("from '../Core/StageVisualCatalog'", `from '${catalogUrl}'`)
    .replace("from './StageBackgroundController'", `from '${backgroundUrl}'`)
  return import(moduleUrl(javascript))
}

function createHarness() {
  const pending = new Map()
  const applied = []
  const released = []
  const warnings = []
  const actions = []
  const runtime = new StageBackgroundRuntime({
    load(path, resolve, reject) {
      const requests = pending.get(path) ?? []
      requests.push({ resolve, reject })
      pending.set(path, requests)
    },
    apply(visual, far, mid) {
      applied.push({ stageId: visual.stageId, far, mid })
    },
    release(path, resource) {
      released.push({ path, resource })
      actions.push(`release:${resource.name}`)
    },
    clear() {
      actions.push('clear')
    },
    warn(path) {
      warnings.push(path)
    },
  })

  const request = (path, index = 0) => pending.get(path)?.[index]
  return { runtime, applied, released, warnings, actions, request }
}

function resource(name) {
  return { name }
}

test('rapid stage 1 to 2 to 3 only applies stage 3 and releases late assets', () => {
  const harness = createHarness()
  const stage1 = stageVisualFor(1)
  const stage2 = stageVisualFor(2)
  const stage3 = stageVisualFor(3)

  harness.runtime.request(stage1)
  harness.runtime.request(stage2)
  harness.runtime.request(stage3)

  const stage1Far = resource('stage1-far')
  const stage1Mid = resource('stage1-mid')
  const stage2Far = resource('stage2-far')
  const stage3Far = resource('stage3-far')
  harness.request(stage1.farPath).resolve(stage1Far)
  harness.request(stage2.farPath).resolve(stage2Far)
  harness.request(stage1.midPath).resolve(stage1Mid)
  harness.request(stage3.farPath).resolve(stage3Far)

  assert.deepEqual(harness.applied, [{ stageId: 3, far: stage3Far, mid: null }])
  assert.deepEqual(harness.released, [
    { path: stage1.farPath, resource: stage1Far },
    { path: stage2.farPath, resource: stage2Far },
    { path: stage1.midPath, resource: stage1Mid },
  ])
  assert.equal(harness.released.some(({ resource: value }) => value === stage3Far), false)
})

test('returning to stage 1 loads far and mid before applying and releases stage 3', () => {
  const harness = createHarness()
  const stage1 = stageVisualFor(1)
  const stage3 = stageVisualFor(3)
  const stage3Far = resource('stage3-far')

  harness.runtime.request(stage3)
  harness.request(stage3.farPath).resolve(stage3Far)
  harness.runtime.request(stage1)
  const stage1Far = resource('stage1-far')
  const stage1Mid = resource('stage1-mid')
  harness.request(stage1.farPath).resolve(stage1Far)
  assert.deepEqual(harness.applied.map(({ stageId }) => stageId), [3])
  harness.request(stage1.midPath).resolve(stage1Mid)

  assert.deepEqual(harness.applied.at(-1), { stageId: 1, far: stage1Far, mid: stage1Mid })
  assert.deepEqual(harness.released, [{ path: stage3.farPath, resource: stage3Far }])
})

test('stage 1 mid failure applies loaded far as a safe fallback', () => {
  const harness = createHarness()
  const stage1 = stageVisualFor(1)
  const stage1Far = resource('stage1-far')

  harness.runtime.request(stage1)
  harness.request(stage1.farPath).resolve(stage1Far)
  harness.request(stage1.midPath).reject(new Error('mid failed'))

  assert.deepEqual(harness.applied, [{ stageId: 1, far: stage1Far, mid: null }])
  assert.deepEqual(harness.warnings, [stage1.midPath])
  assert.deepEqual(harness.released, [])
})

test('far failure keeps the last valid background active', () => {
  const harness = createHarness()
  const stage2 = stageVisualFor(2)
  const stage3 = stageVisualFor(3)
  const stage2Far = resource('stage2-far')

  harness.runtime.request(stage2)
  harness.request(stage2.farPath).resolve(stage2Far)
  harness.runtime.request(stage3)
  harness.request(stage3.farPath).reject(new Error('far failed'))

  assert.deepEqual(harness.applied, [{ stageId: 2, far: stage2Far, mid: null }])
  assert.equal(harness.released.some(({ resource: value }) => value === stage2Far), false)
  assert.deepEqual(harness.warnings, [stage3.farPath])
})

test('destroy releases active and resolved pending assets once, then releases late success', () => {
  const harness = createHarness()
  const stage1 = stageVisualFor(1)
  const stage2 = stageVisualFor(2)
  const stage2Far = resource('stage2-far')
  const pendingFar = resource('pending-stage1-far')
  const lateMid = resource('late-stage1-mid')

  harness.runtime.request(stage2)
  harness.request(stage2.farPath).resolve(stage2Far)
  harness.runtime.request(stage1)
  harness.request(stage1.farPath).resolve(pendingFar)
  harness.runtime.destroy()
  harness.runtime.destroy()
  harness.request(stage1.midPath).resolve(lateMid)

  assert.equal(harness.runtime.snapshot().destroyed, true)
  assert.equal(harness.runtime.snapshot().requestedStageId, null)
  assert.deepEqual(harness.released, [
    { path: stage1.farPath, resource: pendingFar },
    { path: stage2.farPath, resource: stage2Far },
    { path: stage1.midPath, resource: lateMid },
  ])
  assert.deepEqual(harness.actions, [
    'release:pending-stage1-far',
    'clear',
    'release:stage2-far',
    'release:late-stage1-mid',
  ])
  assert.equal(new Set(harness.released.map(({ resource: value }) => value)).size, harness.released.length)
})

test('stage resource controller prefetches stages 9 and 10 then stops at the catalog boundary', async () => {
  const { StageResourceController } = await loadStageResourceController()
  globalThis.__stageResourcePrefetches = []
  try {
    const controller = new StageResourceController({ showStage() {} })

    assert.equal(controller.prefetchNext(8), true)
    assert.equal(controller.prefetchNext(9), true)
    assert.equal(controller.prefetchNext(10), false)
    assert.deepEqual(globalThis.__stageResourcePrefetches, [9, 10])
  } finally {
    delete globalThis.__stageResourcePrefetches
  }
})

test('stage catalog owns the final prefetch boundary', async () => {
  const catalog = await import('../tools/stage-visual-catalog.mjs')
  assert.equal(catalog.WORLD_STAGE_COUNT, 10)
})

test('stage resource controller delegates background first and owns only its resource runtime', () => {
  const source = readFileSync(new URL('../assets/Scripts/Game/StageResourceController.ts', import.meta.url), 'utf8')
  const activateBody = source.match(/activate\(stageId: number\)[\s\S]*?\n  }/)?.[0] ?? ''

  assert.ok(activateBody.indexOf('backgroundController.showStage(stageId)') >= 0)
  assert.ok(activateBody.indexOf('runtime.activate(stageResourcePlanFor(stageId))') > activateBody.indexOf('backgroundController.showStage(stageId)'))
  assert.match(source, /new StageResourceRuntime<Asset>/)
  assert.match(source, /asset\.kind === 'spriteFrame' \? SpriteFrame : Texture2D/)
  assert.match(source, /loaded\.addRef\(\)/)
  assert.match(source, /release: \(_asset, resource\) => resource\.decRef\(\)/)
  assert.match(source, /WORLD_STAGE_COUNT/)
  assert.match(source, /if \(stageId < 1 \|\| stageId >= WORLD_STAGE_COUNT\) return false/)
  assert.doesNotMatch(source, /stageId >= 8/)
  assert.match(source, /prefetch\(stageResourcePlanFor\(stageId \+ 1\)\)/)
  assert.match(source, /destroy\(\)[\s\S]*this\.runtime\.destroy\(\)/)
  assert.doesNotMatch(source, /backgroundController\.destroy\(\)/)
})
