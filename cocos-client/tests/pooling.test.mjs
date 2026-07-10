import test from 'node:test'
import assert from 'node:assert/strict'
import { createPoolState, despawnFromPool, spawnFromPool, poolStats } from '../tools/pooling-runtime.mjs'
import * as poolingRuntime from '../tools/pooling-runtime.mjs'

test('pool spawn reuses inactive objects before creating new ones', () => {
  const pool = createPoolState('soul-orb', 2)

  const first = spawnFromPool(pool)
  const second = spawnFromPool(pool)
  despawnFromPool(pool, first.id)
  const third = spawnFromPool(pool)

  assert.equal(third.id, first.id)
  assert.equal(poolStats(pool).created, 2)
  assert.equal(poolStats(pool).active, 2)
})

test('pool caps created objects and reports overflow', () => {
  const pool = createPoolState('monster', 1)

  const first = spawnFromPool(pool)
  const second = spawnFromPool(pool)

  assert.equal(first.ok, true)
  assert.equal(second.ok, false)
  assert.equal(poolStats(pool).overflow, 1)
})

test('pool can despawn every active object and reuse them later', () => {
  assert.equal(typeof poolingRuntime.despawnAllFromPool, 'function')
  const pool = createPoolState('soul-orb', 3)
  const first = spawnFromPool(pool)
  const second = spawnFromPool(pool)
  spawnFromPool(pool)

  assert.deepEqual(poolingRuntime.despawnAllFromPool(pool), [first.id, second.id, 3])
  assert.equal(poolStats(pool).active, 0)
  assert.equal(poolStats(pool).created, 3)
  assert.equal(spawnFromPool(pool).id, first.id)
})
