import test from 'node:test'
import assert from 'node:assert/strict'
import { notifyBestEffort } from '../assets/Scripts/Core/Progression/BestEffortNotification.ts'

test('best-effort notifications preserve order and continue after listener exceptions', () => {
  const attempted = []

  assert.doesNotThrow(() => notifyBestEffort(['first', 'second', 'third'], (notification) => {
    attempted.push(notification)
    if (notification !== 'third') throw new Error(`failed ${notification}`)
  }))

  assert.deepEqual(attempted, ['first', 'second', 'third'])
})

test('best-effort notifications tolerate an empty sequence', () => {
  let calls = 0
  assert.doesNotThrow(() => notifyBestEffort([], () => {
    calls += 1
  }))
  assert.equal(calls, 0)
})
