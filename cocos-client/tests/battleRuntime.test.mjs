import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyFlyingSwordHit,
  createBattleRuntime,
  defeatEnemy,
  nextSpawn,
  runtimeStats,
} from '../tools/battle-runtime.mjs'

test('battle runtime spawns themed enemies from stage profile', () => {
  const runtime = createBattleRuntime({ stageId: 3, heroAttack: 40 })

  const first = nextSpawn(runtime, 1.1)
  const second = nextSpawn(runtime, 1.1)

  assert.equal(first.ok, true)
  assert.equal(first.enemy.theme, 'flame-cave')
  assert.equal(second.ok, true)
  assert.equal(runtimeStats(runtime).aliveEnemies, 2)
})

test('flying sword pierces multiple enemies and queues soul drops on defeat', () => {
  const runtime = createBattleRuntime({ stageId: 1, heroAttack: 120 })
  nextSpawn(runtime, 1.1)
  nextSpawn(runtime, 1.1)

  const hit = applyFlyingSwordHit(runtime, { pierce: 2, damageScale: 1 })

  assert.equal(hit.hitCount, 2)
  assert.equal(runtimeStats(runtime).aliveEnemies, 0)
  assert.equal(runtimeStats(runtime).soulDrops, 2)
})

test('defeated enemy can only drop once', () => {
  const runtime = createBattleRuntime({ stageId: 1, heroAttack: 120 })
  const spawn = nextSpawn(runtime, 1.1)

  defeatEnemy(runtime, spawn.enemy.id)
  defeatEnemy(runtime, spawn.enemy.id)

  assert.equal(runtimeStats(runtime).soulDrops, 1)
})
