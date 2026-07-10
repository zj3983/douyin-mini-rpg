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
  segmentHitEnemiesAlongPath,
  spawnBoss,
  tickBossSkill,
} from '../tools/battle-runtime.mjs'

function defeatOrdinaryEnemies(runtime, count = 12) {
  for (let index = 0; index < count; index += 1) {
    const spawn = nextSpawn(runtime, 1.1)
    assert.equal(spawn.ok, true)
    assert.equal(defeatEnemy(runtime, spawn.enemy.id), true)
  }
}

test('battle runtime spawns themed enemies from stage profile', () => {
  const runtime = createBattleRuntime({ stageId: 3, heroAttack: 40 })

  const first = nextSpawn(runtime, 1.1)
  const second = nextSpawn(runtime, 1.1)

  assert.equal(first.ok, true)
  assert.equal(first.enemy.theme, 'flame-cave')
  assert.equal(second.ok, true)
  assert.equal(runtimeStats(runtime).aliveEnemies, 2)
})

test('battle runtime skips spawning when the stage has no ordinary enemy profile', () => {
  const runtime = createBattleRuntime({ stageId: 1, heroAttack: 40 })
  runtime.stage = { ...runtime.stage, enemies: [runtime.stage.boss] }
  runtime.spawnTimer = 0.4

  assert.deepEqual(nextSpawn(runtime, 1.1), { ok: false, enemy: null })
  assert.equal(runtime.spawnTimer, 0.4)
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

test('flying sword can damage a living enemy once outbound and once on return', () => {
  const runtime = createBattleRuntime({ stageId: 1, heroAttack: 35 })
  const enemy = nextSpawn(runtime, 1.1).enemy
  enemy.position = { x: 120, y: 0 }

  const outbound = applyFlyingSwordHit(runtime, {
    pierce: 1,
    damageScale: 1,
    path: { from: { x: 0, y: 0 }, to: { x: 260, y: 0 }, width: 18 },
  })
  const returning = applyFlyingSwordHit(runtime, {
    pierce: 1,
    damageScale: 1,
    path: { from: { x: 260, y: 0 }, to: { x: 0, y: 0 }, width: 18 },
  })

  assert.equal(outbound.hitCount, 1)
  assert.equal(returning.hitCount, 1)
  assert.equal(returning.damageEvents[0].remainingHp, 30)
  assert.equal(enemy.hp, 30)
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

test('bounded flying sword arc hits ground and flying lanes without hitting outside the path', () => {
  const runtime = createBattleRuntime({ stageId: 1, heroAttack: 60 })
  const ground = nextSpawn(runtime, 1.1).enemy
  const flying = nextSpawn(runtime, 1.1).enemy
  const outside = nextSpawn(runtime, 1.1).enemy
  ground.position = { x: -120, y: -52 }
  flying.position = { x: 150, y: 76 }
  outside.position = { x: 150, y: 245 }

  const hits = segmentHitEnemiesAlongPath(runtime, {
    points: [
      { x: -180, y: -30 },
      { x: 40, y: 28 },
      { x: 150, y: 74 },
      { x: 300, y: -30 },
    ],
    width: 20,
    pierce: 6,
  })

  assert.deepEqual(hits.map((enemy) => enemy.id), [ground.id, flying.id])
})

test('polyline sword path only returns each enemy once per pass', () => {
  const runtime = createBattleRuntime({ stageId: 1, heroAttack: 60 })
  const enemy = nextSpawn(runtime, 1.1).enemy
  enemy.position = { x: 100, y: 20 }

  const hits = segmentHitEnemiesAlongPath(runtime, {
    points: [{ x: 0, y: 0 }, { x: 100, y: 20 }, { x: 200, y: 0 }],
    width: 16,
    pierce: 6,
  })

  assert.deepEqual(hits.map((entry) => entry.id), [enemy.id])
})

test('stage becomes boss-ready only after 12 ordinary defeats', () => {
  const runtime = createBattleRuntime({ stageId: 1, heroAttack: 80 })

  assert.equal(runtime.defeatTarget, 12)
  assert.equal(runtime.maxAliveEnemies, 18)
  assert.equal(runtimeStats(runtime).bossReady, false)
  assert.equal(spawnBoss(runtime).ok, false)

  defeatOrdinaryEnemies(runtime, 11)
  assert.equal(runtimeStats(runtime).bossReady, false)
  assert.equal(spawnBoss(runtime).ok, false)

  defeatOrdinaryEnemies(runtime, 1)
  assert.equal(runtimeStats(runtime).bossReady, true)
  assert.equal(nextSpawn(runtime, 1.1).ok, false)
  assert.equal(spawnBoss(runtime).ok, true)
})

test('ordinary spawning stops at the alive enemy cap', () => {
  const runtime = createBattleRuntime({ stageId: 2, heroAttack: 80 })

  for (let index = 0; index < 18; index += 1) {
    assert.equal(nextSpawn(runtime, 1.1).ok, true)
  }

  assert.equal(runtimeStats(runtime).aliveEnemies, 18)
  assert.equal(nextSpawn(runtime, 1.1).ok, false)

  assert.equal(defeatEnemy(runtime, runtime.enemies[0].id), true)
  assert.equal(nextSpawn(runtime, 1.1).ok, true)
  assert.equal(runtimeStats(runtime).aliveEnemies, 18)
})

test('world stage can spawn one boss from its stage profile', () => {
  const runtime = createBattleRuntime({ stageId: 1, heroAttack: 80 })
  defeatOrdinaryEnemies(runtime)

  const first = spawnBoss(runtime)
  const second = spawnBoss(runtime)

  assert.equal(first.ok, true)
  assert.equal(first.enemy.role, 'boss')
  assert.equal(first.enemy.profileId, 'bamboo-warden')
  assert.equal(first.enemy.hp, 520)
  assert.equal(second.ok, false)
  assert.equal(nextSpawn(runtime, 1.1).ok, false)
  assert.equal(runtimeStats(runtime).bossAlive, true)
})

test('boss casts timed skill events while alive', () => {
  const runtime = createBattleRuntime({ stageId: 3, heroAttack: 80 })
  defeatOrdinaryEnemies(runtime)
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
  defeatOrdinaryEnemies(runtime)
  spawnBoss(runtime)

  const hit = applyFlyingSwordHit(runtime, { pierce: 1, damageScale: 2 })

  assert.equal(hit.stageClear, true)
  assert.equal(runtimeStats(runtime).stageCleared, true)
  assert.equal(runtimeStats(runtime).defeatedEnemies, 12)
  assert.equal(runtimeStats(runtime).soulDrops, 13)
  assert.equal(nextSpawn(runtime, 1.1).ok, false)
})

test('stage clear reward can only be claimed once after boss defeat', () => {
  const runtime = createBattleRuntime({ stageId: 4, heroAttack: 520 })
  defeatOrdinaryEnemies(runtime)
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
