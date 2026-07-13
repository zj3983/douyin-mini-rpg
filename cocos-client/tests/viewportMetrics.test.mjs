import test from 'node:test'
import assert from 'node:assert/strict'
import { createViewportMetricsProvider } from '../assets/Scripts/Game/ViewportMetrics.ts'

function createEventTarget(initial = {}) {
  const handlers = new Map()
  const addCounts = new Map()
  const removeCounts = new Map()
  return {
    ...initial,
    addEventListener(type, listener) {
      addCounts.set(type, (addCounts.get(type) ?? 0) + 1)
      const listeners = handlers.get(type) ?? new Set()
      listeners.add(listener)
      handlers.set(type, listeners)
    },
    removeEventListener(type, listener) {
      removeCounts.set(type, (removeCounts.get(type) ?? 0) + 1)
      handlers.get(type)?.delete(listener)
    },
    emit(type) {
      for (const listener of handlers.get(type) ?? []) listener()
    },
    listenerCount(type) { return handlers.get(type)?.size ?? 0 },
    addCount(type) { return addCounts.get(type) ?? 0 },
    removeCount(type) { return removeCounts.get(type) ?? 0 },
  }
}

test('Douyin system info has priority and converts safe area edges to insets', () => {
  let browserProbeCalls = 0
  const provider = createViewportMetricsProvider({
    tt: {
      getSystemInfoSync: () => ({
        windowWidth: 390,
        windowHeight: 844,
        safeArea: { top: 47, bottom: 810 },
      }),
    },
    browserWindow: createEventTarget({ innerWidth: 999, innerHeight: 999, visualViewport: null }),
    probeBrowserSafeArea: () => {
      browserProbeCalls += 1
      return { top: 10, bottom: 10 }
    },
    getFrameSize: () => ({ width: 360, height: 780 }),
  })

  assert.deepEqual(provider.read(), {
    cssWidth: 390,
    cssHeight: 844,
    topInsetPx: 47,
    bottomInsetPx: 34,
    source: 'douyin',
  })
  assert.equal(browserProbeCalls, 0)
})

test('Douyin safe area values are finite-clamped without rejecting valid dimensions', () => {
  const provider = createViewportMetricsProvider({
    tt: {
      getSystemInfoSync: () => ({
        windowWidth: 430,
        windowHeight: 932,
        safeArea: { top: -20, bottom: Infinity },
      }),
    },
    browserWindow: null,
    getFrameSize: () => ({ width: 360, height: 780 }),
  })

  assert.deepEqual(provider.read(), {
    cssWidth: 430,
    cssHeight: 932,
    topInsetPx: 0,
    bottomInsetPx: 0,
    source: 'douyin',
  })
})

test('browser metrics combine mocked CSS env insets with visual viewport geometry', () => {
  const visualViewport = createEventTarget({ width: 390, height: 700, offsetTop: 20 })
  const browserWindow = createEventTarget({ innerWidth: 390, innerHeight: 844, visualViewport })
  const provider = createViewportMetricsProvider({
    tt: null,
    browserWindow,
    probeBrowserSafeArea: () => ({ top: 10, bottom: 12 }),
    getFrameSize: () => ({ width: 360, height: 780 }),
  })

  const metrics = provider.read()
  assert.deepEqual(metrics, {
    cssWidth: 390,
    cssHeight: 700,
    topInsetPx: 30,
    bottomInsetPx: 136,
    source: 'browser',
  })
  assert.equal(Object.isFrozen(metrics), true)
})

test('invalid platform and browser dimensions fall back to Cocos frame with zero insets', () => {
  const provider = createViewportMetricsProvider({
    tt: { getSystemInfoSync: () => ({ windowWidth: NaN, windowHeight: 0 }) },
    browserWindow: createEventTarget({ innerWidth: Infinity, innerHeight: -1, visualViewport: null }),
    probeBrowserSafeArea: () => ({ top: 99, bottom: 99 }),
    getFrameSize: () => ({ width: 360, height: 780 }),
  })

  assert.deepEqual(provider.read(), {
    cssWidth: 360,
    cssHeight: 780,
    topInsetPx: 0,
    bottomInsetPx: 0,
    source: 'cocos',
  })
})

test('resize listeners register once across window visual viewport and Douyin then clean up', () => {
  const visualViewport = createEventTarget({ width: 390, height: 700, offsetTop: 20 })
  const browserWindow = createEventTarget({ innerWidth: 390, innerHeight: 844, visualViewport })
  let ttListener = null
  let ttOnCount = 0
  let ttOffCount = 0
  const tt = {
    getSystemInfoSync: () => ({ windowWidth: 390, windowHeight: 844 }),
    onWindowResize(listener) { ttOnCount += 1; ttListener = listener },
    offWindowResize(listener) {
      ttOffCount += 1
      if (ttListener === listener) ttListener = null
    },
  }
  const provider = createViewportMetricsProvider({
    tt,
    browserWindow,
    getFrameSize: () => ({ width: 360, height: 780 }),
  })
  let notifications = 0
  const listener = () => { notifications += 1 }

  const firstCleanup = provider.subscribe(listener)
  const duplicateCleanup = provider.subscribe(listener)
  assert.equal(browserWindow.addCount('resize'), 1)
  assert.equal(visualViewport.addCount('resize'), 1)
  assert.equal(visualViewport.addCount('scroll'), 1)
  assert.equal(ttOnCount, 1)

  browserWindow.emit('resize')
  visualViewport.emit('resize')
  visualViewport.emit('scroll')
  ttListener?.()
  assert.equal(notifications, 4)

  firstCleanup()
  duplicateCleanup()
  assert.equal(browserWindow.listenerCount('resize'), 0)
  assert.equal(visualViewport.listenerCount('resize'), 0)
  assert.equal(visualViewport.listenerCount('scroll'), 0)
  assert.equal(browserWindow.removeCount('resize'), 1)
  assert.equal(visualViewport.removeCount('resize'), 1)
  assert.equal(visualViewport.removeCount('scroll'), 1)
  assert.equal(ttOffCount, 1)

  provider.destroy()
  assert.equal(ttOffCount, 1)
})
