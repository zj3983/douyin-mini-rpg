import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyFlyingSwordHit,
  claimStageClear,
  createBattleRuntime,
  defeatEnemy,
  nextSpawn,
  runtimeStats,
  segmentHitEnemies,
  spawnBoss,
  tickBossSkill,
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
  assert.deepEqual(hit.damageEvents.map((event) => event.damage), [120, 120])
  assert.equal(hit.defeatedEnemyIds.length, 2)
  assert.equal(runtimeStats(runtime).aliveEnemies, 0)
  assert.equal(runtimeStats(runtime).soulDrops, 2)
})

test('flying sword hit reports nonlethal damage without soul drops', () => {
  const runtime = createBattleRuntime({ stageId: 1, heroAttack: 35 })
  nextSpawn(runtime, 1.1)

  const hit = applyFlyingSwordHit(runtime, { pierce: 1, damageScale: 1 })

  assert.equal(hit.hitCount, 1)
  assert.deepEqual(hit.damageEvents.map((event) => event.damage), [35])
  assert.deepEqual(hit.defeatedEnemyIds, [])
  assert.equal(runtimeStats(runtime).aliveEnemies, 1)
  assert.equal(runtimeStats(runtime).soulDrops, 0)
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

test('world stage can spawn one boss from its stage profile', () => {
  const runtime = createBattleRuntime({ stageId: 1, heroAttack: 80 })

  const first = spawnBoss(runtime)
  const second = spawnBoss(runtime)

  assert.equal(first.ok, true)
  assert.equal(first.enemy.role, 'boss')
  assert.equal(first.enemy.profileId, 'bamboo-warden')
  assert.equal(first.enemy.hp, 520)
  assert.equal(second.ok, false)
  assert.equal(runtimeStats(runtime).bossAlive, true)
})

test('boss casts timed skill events while alive', () => {
  const runtime = createBattleRuntime({ stageId: 3, heroAttack: 80 })
  const boss = spawnBoss(runtime).enemy

  const early = tickBossSkill(runtime, 1.2)
  const cast = tickBossSkill(runtime, 1.4)

  assert.equal(early.ok, false)
  assert.equal(cast.ok, true)
  assert.equal(cast.event.enemyId, boss.id)
  assert.equal(cast.event.skillId, 'flame-cave-boss-skill')
  assert.equal(cast.event.damage, 18)
})

test('defeating the world boss clears the stage', () => {
  const runtime = createBattleRuntime({ stageId: 1, heroAttack: 260 })
  spawnBoss(runtime)

  const hit = applyFlyingSwordHit(runtime, { pierce: 1, damageScale: 2 })

  assert.equal(hit.stageClear, true)
  assert.equal(runtimeStats(runtime).stageCleared, true)
  assert.equal(runtimeStats(runtime).soulDrops, 1)
})

test('stage clear reward can only be claimed once after boss defeat', () => {
  const runtime = createBattleRuntime({ stageId: 4, heroAttack: 520 })
  spawnBoss(runtime)
  applyFlyingSwordHit(runtime, { pierce: 1, damageScale: 1 })

  const first = claimStageClear(runtime)
  const second = claimStageClear(runtime)

  assert.equal(first.ok, true)
  assert.equal(first.result.stageId, 4)
  assert.equal(first.result.nextStageId, 5)
  assert.equal(first.result.reward.spiritStones, 260)
  assert.equal(first.result.reward.artifactEssence, 6)
  assert.equal(first.result.reward.dungeonPass.name, '星门残券')
  assert.equal(second.ok, false)
  assert.equal(second.reason, 'already-claimed')
})
