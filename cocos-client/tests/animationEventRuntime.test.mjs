import test from 'node:test'
import assert from 'node:assert/strict'

import * as productionRuntime from '../assets/Scripts/Core/AnimationEventRuntime.ts'
import * as mirrorRuntime from '../tools/animation-event-runtime.mjs'

const implementations = [
  ['Node mirror', mirrorRuntime],
  ['production TypeScript', productionRuntime],
]

const markers = [
  { name: 'prepare', at: 0.25 },
  { name: 'release', at: 0.6 },
]

for (const [implementationName, runtime] of implementations) {
  test(`${implementationName}: actionDuration derives seconds from frame count and fps`, () => {
    assert.equal(runtime.actionDuration(12, 8), 1.5)
    assert.equal(runtime.actionDuration(0, 8), 0)
    assert.equal(runtime.actionDuration(12, 0), 0)
  })

  test(`${implementationName}: markersCrossed reports a marker crossed during normal advancement`, () => {
    assert.deepEqual(
      runtime.markersCrossed({ markers, previousElapsed: 0.1, elapsed: 0.3, duration: 1, loop: false }),
      [markers[0]],
    )
  })

  test(`${implementationName}: markersCrossed reports every marker crossed when frames are skipped`, () => {
    assert.deepEqual(
      runtime.markersCrossed({ markers, previousElapsed: 0.1, elapsed: 0.65, duration: 1, loop: false }),
      markers,
    )
  })

  test(`${implementationName}: markersCrossed handles loop wrap and every crossed loop in marker order`, () => {
    assert.deepEqual(
      runtime.markersCrossed({ markers, previousElapsed: 0.8, elapsed: 2.3, duration: 1, loop: true }),
      [markers[0], markers[1], markers[0]],
    )
  })

  test(`${implementationName}: markersCrossed bounds long-gap catch-up to recent cycles`, () => {
    let cycleIterations = 0
    const countedMarkers = new Proxy(markers, {
      get(target, property, receiver) {
        if (property === Symbol.iterator) {
          return () => {
            cycleIterations += 1
            return target[Symbol.iterator]()
          }
        }
        return Reflect.get(target, property, receiver)
      },
    })

    assert.deepEqual(
      runtime.markersCrossed({
        markers: countedMarkers,
        previousElapsed: 0.1,
        elapsed: 1_000.7,
        duration: 1,
        loop: true,
        maxCatchUpCycles: 2,
      }),
      [markers[0], markers[1], markers[0], markers[1]],
    )
    assert.equal(cycleIterations, 2)
  })

  test(`${implementationName}: markersCrossed returns none without forward advancement or valid duration`, () => {
    assert.deepEqual(
      runtime.markersCrossed({ markers, previousElapsed: 0.5, elapsed: 0.5, duration: 1, loop: true }),
      [],
    )
    assert.deepEqual(
      runtime.markersCrossed({ markers, previousElapsed: 0.5, elapsed: 0.4, duration: 1, loop: true }),
      [],
    )
    assert.deepEqual(
      runtime.markersCrossed({ markers, previousElapsed: 0, elapsed: 1, duration: 0, loop: true }),
      [],
    )
  })

  test(`${implementationName}: actionCompleted reports only the first non-loop duration crossing`, () => {
    assert.equal(runtime.actionCompleted({ previousElapsed: 0.9, elapsed: 1, duration: 1, loop: false }), true)
    assert.equal(runtime.actionCompleted({ previousElapsed: 0.9, elapsed: 1.1, duration: 1, loop: false }), true)
    assert.equal(runtime.actionCompleted({ previousElapsed: 1, elapsed: 1.4, duration: 1, loop: false }), false)
    assert.equal(runtime.actionCompleted({ previousElapsed: 0.9, elapsed: 1.1, duration: 1, loop: true }), false)
    assert.equal(runtime.actionCompleted({ previousElapsed: 0, elapsed: 1, duration: 0, loop: false }), false)
  })
}
