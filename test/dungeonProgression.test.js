import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DEFAULT_DUNGEON_MAX_FLOORS,
  dungeonFloorKillGoal,
  dungeonFloorMaterialGoal,
  dungeonFloorName,
  dungeonFloorPlan,
  dungeonFloorRoute,
} from '../src/dungeonProgression.ts'

const beginnerDungeon = {
  killGoal: 10,
  materialGoal: 3,
  unlockLevel: 1,
}

const advancedDungeon = {
  killGoal: 16,
  materialGoal: 6,
  unlockLevel: 48,
}

test('dungeons default to five readable floors with a final boss floor', () => {
  assert.equal(DEFAULT_DUNGEON_MAX_FLOORS, 5)
  assert.deepEqual(
    Array.from({ length: DEFAULT_DUNGEON_MAX_FLOORS }, (_, index) => dungeonFloorName(index + 1)),
    ['外层', '灵脉层', '精英层', '藏宝层', '守门层'],
  )

  const floorPlans = Array.from({ length: DEFAULT_DUNGEON_MAX_FLOORS }, (_, index) => dungeonFloorPlan(beginnerDungeon, index + 1))
  assert.deepEqual(floorPlans.map((plan) => plan.role), ['clear', 'key', 'elite', 'treasure', 'boss'])
  assert.equal(floorPlans[2].eliteBias > floorPlans[0].eliteBias, true)
  assert.equal(floorPlans[3].rewardMultiplier > floorPlans[1].rewardMultiplier, true)
  assert.equal(floorPlans[4].requiresBoss, true)
})

test('floor goals scale gently across five floors and keep beginner dungeons playable', () => {
  assert.deepEqual(
    Array.from({ length: DEFAULT_DUNGEON_MAX_FLOORS }, (_, index) => dungeonFloorKillGoal(beginnerDungeon, index + 1)),
    [3, 4, 5, 5, 6],
  )
  assert.deepEqual(
    Array.from({ length: DEFAULT_DUNGEON_MAX_FLOORS }, (_, index) => dungeonFloorMaterialGoal(beginnerDungeon, index + 1)),
    [2, 3, 3, 4, 4],
  )
})

test('high tier dungeons ask for more kills and keys without changing the five floor structure', () => {
  assert.deepEqual(
    Array.from({ length: DEFAULT_DUNGEON_MAX_FLOORS }, (_, index) => dungeonFloorKillGoal(advancedDungeon, index + 1)),
    [5, 6, 7, 8, 9],
  )
  assert.deepEqual(
    Array.from({ length: DEFAULT_DUNGEON_MAX_FLOORS }, (_, index) => dungeonFloorMaterialGoal(advancedDungeon, index + 1)),
    [4, 5, 5, 6, 7],
  )
})

test('floor route exposes compact labels and hints for dungeon cards', () => {
  const route = dungeonFloorRoute(beginnerDungeon)

  assert.deepEqual(route.map((floor) => floor.label), ['外层', '灵脉', '精英', '藏宝', 'Boss'])
  assert.deepEqual(route.map((floor) => floor.floor), [1, 2, 3, 4, 5])
  assert.equal(route[0].hint, '清怪推进')
  assert.equal(route[2].hint, '精英压境')
  assert.equal(route[3].hint, '材料增幅')
  assert.equal(route[4].hint, '守门结算')
  assert.equal(route[4].requiresBoss, true)
})
