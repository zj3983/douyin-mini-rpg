import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyFlyingSwordHit,
  createBattleRuntime,
  defeatEnemy,
  nextSpawn,
  runtimeStats,
  segmentHitEnemies,
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

test('flying sword geometry only hits enemies near the sword path', () => {
  const runtime = createBattleRuntime({ stageId: 1, heroAttack: 60 })
  const close = nextSpawn(runtime, 1.1).enemy
  const far = nextSpawn(runtime, 1.1).enemy

  close.position = { x: 120, y: 12 }
  close.radius = 32
  far.position = { x: 120, y: 120 }
  far.radius = 32

  const hits = segmentHitEnemies(runtime, {
    from: { x: 0, y: 0 },
    to: { x: 260, y: 0 },
    width: 18,
    pierce: 4,
  })

  assert.deepEqual(hits.map((enemy) => enemy.id), [close.id])
})

test('flying sword geometry respects pierce order along path', () => {
  const runtime = createBattleRuntime({ stageId: 1, heroAttack: 60 })
  const near = nextSpawn(runtime, 1.1).enemy
  const far = nextSpawn(runtime, 1.1).enemy

  far.position = { x: 220, y: 0 }
  far.radius = 32
  near.position = { x: 80, y: 0 }
  near.radius = 32

  const hits = segmentHitEnemies(runtime, {
    from: { x: 0, y: 0 },
    to: { x: 260, y: 0 },
    width: 12,
    pierce: 1,
  })

  assert.deepEqual(hits.map((enemy) => enemy.id), [near.id])
})
