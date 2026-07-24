import test from 'node:test'
import assert from 'node:assert/strict'
import * as battleLayout from '../assets/Scripts/Combat/BattleLayout.ts'
import { createViewportMetricsProvider } from '../assets/Scripts/Game/ViewportMetrics.ts'

const selectBattleResolution = battleLayout.selectBattleResolution
const computeBattleViewportState = battleLayout.computeBattleViewportState
const computeDungeonEntryNavLayout = battleLayout.computeDungeonEntryNavLayout

test('portrait viewports keep the fixed-width dynamic-height policy', () => {
  assert.equal(typeof selectBattleResolution, 'function')

  const first = selectBattleResolution({ cssWidth: 390, cssHeight: 844 })
  const second = selectBattleResolution({ cssWidth: 430, cssHeight: 932 })

  assert.deepEqual(first, {
    designWidth: 750,
    designHeight: 1334,
    mode: 'fixed-width',
  })
  assert.strictEqual(second, first)
})

test('dungeon entry label and status use nonoverlapping tracks entirely inside the safe nav cell', () => {
  assert.equal(typeof computeDungeonEntryNavLayout, 'function')
  for (const viewport of [
    { cssWidth: 390, cssHeight: 844, bottomInsetPx: 34 },
    { cssWidth: 430, cssHeight: 932, bottomInsetPx: 21 },
    { cssWidth: 750, cssHeight: 1334, bottomInsetPx: 0 },
  ]) {
    const layout = battleLayout.computeBattleLayout({
      designWidth: 750,
      topInsetPx: 0,
      ...viewport,
    })
    const entry = computeDungeonEntryNavLayout(layout.navigationTop)
    const visibleBottom = -layout.visibleHeight / 2

    assert.equal(entry.navigation.maxY, layout.navigationTop)
    assert.ok(entry.navigation.minY > visibleBottom)
    assert.ok(entry.label.minY >= entry.navigation.minY)
    assert.ok(entry.label.maxY <= entry.navigation.maxY)
    assert.ok(entry.status.minY >= entry.navigation.minY)
    assert.ok(entry.status.maxY <= entry.navigation.maxY)
    assert.ok(entry.label.maxY < entry.status.minY)
    assert.ok(entry.status.maxY <= layout.actorSafeRect.minY)
  }
})

test('landscape viewports show the complete portrait battle canvas', () => {
  assert.equal(typeof selectBattleResolution, 'function')

  const resolution = selectBattleResolution({ cssWidth: 844, cssHeight: 390 })

  assert.deepEqual(resolution, {
    designWidth: 750,
    designHeight: 1334,
    mode: 'show-all',
  })
  assert.equal(Object.isFrozen(resolution), true)
})

test('portrait viewports wider than the battle canvas aspect show the complete canvas', () => {
  const resolution = selectBattleResolution({ cssWidth: 768, cssHeight: 1024 })

  assert.deepEqual(resolution, {
    designWidth: 750,
    designHeight: 1334,
    mode: 'show-all',
  })
})

test('transient invalid resize dimensions retain the previous valid mode', () => {
  assert.equal(typeof selectBattleResolution, 'function')

  const resolution = selectBattleResolution({
    cssWidth: 0,
    cssHeight: Number.NaN,
    previousMode: 'show-all',
  })

  assert.deepEqual(resolution, {
    designWidth: 750,
    designHeight: 1334,
    mode: 'show-all',
  })
  assert.ok(resolution.designWidth > 0)
  assert.ok(resolution.designHeight > 0)
})

test('provider fallback dimensions do not erase the last valid landscape orientation', () => {
  assert.equal(typeof selectBattleResolution, 'function')
  const frame = { width: 844, height: 390 }
  const provider = createViewportMetricsProvider({
    tt: null,
    browserWindow: null,
    getFrameSize: () => frame,
  })
  let previousMode
  const selectFromProvider = () => {
    const metrics = provider.read()
    const resolution = selectBattleResolution({
      cssWidth: metrics.cssWidth,
      cssHeight: metrics.cssHeight,
      viewportSizeValid: metrics.viewportSizeValid,
      previousMode,
    })
    previousMode = resolution.mode
    return resolution.mode
  }

  const modes = [selectFromProvider()]
  frame.width = 0
  frame.height = 0
  modes.push(selectFromProvider())
  frame.width = 844
  frame.height = 390
  modes.push(selectFromProvider())

  assert.deepEqual(modes, ['show-all', 'show-all', 'show-all'])
})

test('provider fallback dimensions preserve the last applied portrait layout', () => {
  const frame = { width: 390, height: 844 }
  const provider = createViewportMetricsProvider({
    tt: null,
    browserWindow: null,
    getFrameSize: () => frame,
  })
  let previousLayout
  const computeFromProvider = () => {
    const metrics = provider.read()
    const layout = battleLayout.computeBattleLayout({
      designWidth: 750,
      cssWidth: metrics.cssWidth,
      cssHeight: metrics.cssHeight,
      topInsetPx: metrics.topInsetPx,
      bottomInsetPx: metrics.bottomInsetPx,
      viewportSizeValid: metrics.viewportSizeValid,
      previousLayout,
    })
    previousLayout = layout
    return layout
  }
  const keyLayout = (layout) => ({
    visibleHeight: layout.visibleHeight,
    navigationTop: layout.navigationTop,
    actorSafeRect: layout.actorSafeRect,
    movement: layout.movement,
    bossSpawn: layout.bossSpawn,
  })

  const portrait = computeFromProvider()
  frame.width = 0
  frame.height = 0
  const invalid = computeFromProvider()
  frame.width = 390
  frame.height = 844
  const restored = computeFromProvider()

  assert.strictEqual(invalid, portrait)
  assert.deepEqual(keyLayout(invalid), keyLayout(portrait))
  assert.deepEqual(keyLayout(restored), keyLayout(portrait))
})

test('an initially invalid viewport still produces a safe bootstrap layout', () => {
  const provider = createViewportMetricsProvider({
    tt: null,
    browserWindow: null,
    getFrameSize: () => ({ width: 0, height: 0 }),
  })
  const metrics = provider.read()
  const layout = battleLayout.computeBattleLayout({
    designWidth: 750,
    cssWidth: metrics.cssWidth,
    cssHeight: metrics.cssHeight,
    topInsetPx: metrics.topInsetPx,
    bottomInsetPx: metrics.bottomInsetPx,
    viewportSizeValid: metrics.viewportSizeValid,
    previousLayout: null,
  })

  assert.equal(layout.visibleHeight, 1334)
  assert.ok(layout.movement.minX < layout.movement.maxX)
  assert.ok(layout.movement.minY < layout.movement.maxY)
  assert.equal(Number.isFinite(layout.navigationTop), true)
  assert.equal(Number.isFinite(layout.bossSpawn.x), true)
  assert.equal(Number.isFinite(layout.bossSpawn.y), true)
})

test('changing metrics snapshots produce matching resolution and applied layout state', () => {
  assert.equal(typeof computeBattleViewportState, 'function')
  const snapshots = [
    {
      cssWidth: 390,
      cssHeight: 844,
      topInsetPx: 20,
      bottomInsetPx: 0,
      viewportSizeValid: true,
    },
    {
      cssWidth: 844,
      cssHeight: 390,
      topInsetPx: 20,
      bottomInsetPx: 0,
      viewportSizeValid: true,
    },
  ]
  let readCount = 0
  const provider = { read: () => snapshots[readCount++] }
  let currentState
  const relayout = () => {
    const metrics = provider.read()
    currentState = computeBattleViewportState({
      designWidth: 750,
      ...metrics,
      previousMode: currentState?.resolution.mode,
      previousLayout: currentState?.layout,
    })
    return currentState
  }

  const portrait = relayout()
  const landscape = relayout()
  const expectedLandscapeInset = 20 * 1334 / 390

  assert.equal(readCount, 2)
  assert.equal(portrait.resolution.mode, 'fixed-width')
  assert.equal(portrait.layout.visibleHeight, 750 * 844 / 390)
  assert.equal(landscape.resolution.mode, 'show-all')
  assert.equal(landscape.layout.visibleHeight, 1334)
  assert.ok(Math.abs(landscape.layout.actorSafeRect.maxY - (667 - 210 - expectedLandscapeInset)) < 1e-9)
  assert.equal(Object.isFrozen(landscape), true)
})
