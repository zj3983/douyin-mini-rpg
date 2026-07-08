import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { stageProfile, dungeonRunPlan, resolveDungeonFloor } from '../tools/cultivation-runtime.mjs'

const data = JSON.parse(readFileSync(resolve('assets/Data/cultivation-design.json'), 'utf8'))

test('level ups only grant base character stats', () => {
  assert.deepEqual(data.levelUp.allowedStats, ['attack', 'health', 'mana'])
  assert.equal(data.levelUp.cardsCanGrantBaseStats, false)
})

test('artifact progression owns skill mutation and has an explicit cap', () => {
  assert.equal(data.artifacts.maxLevel, 18)
  assert.equal(data.artifacts.mutationLevels.length >= 3, true)
  assert.deepEqual(data.artifacts.mutationLevels, [6, 12, 18])
})

test('dungeon loop is the source for artifact unlocks and gacha tickets', () => {
  assert.equal(data.dungeons.dailyEntries, 3)
  assert.equal(data.dungeons.drops.gachaTickets, true)
  assert.equal(data.dungeons.drops.artifacts, true)
  assert.equal(data.worldBoss.dropsDungeonPasses, true)
})

test('first Cocos milestone is a side-scrolling xianxia survivor loop', () => {
  assert.equal(data.prototype.camera, 'side-scrolling')
  assert.equal(data.prototype.playerMount, 'flying-sword')
  assert.equal(data.prototype.basicAttack, false)
  assert.equal(data.prototype.defaultSkill, '御剑术')
})

test('world stages have distinct xianxia backgrounds and matching enemies', () => {
  assert.equal(data.worldStages.length >= 4, true)

  const backgroundIds = new Set(data.worldStages.map((stage) => stage.background))
  assert.equal(backgroundIds.size, data.worldStages.length)

  for (const stage of data.worldStages) {
    assert.equal(stage.enemies.length >= 3, true)
    assert.equal(stage.enemies.every((enemy) => enemy.theme === stage.theme), true)
    assert.equal(stage.enemies.some((enemy) => enemy.role === 'boss'), true)
  }
})

test('dungeons are multi-floor runs with evacuation and boss artifact drops', () => {
  assert.equal(data.dungeons.floorsPerDungeon, 5)
  assert.equal(data.dungeons.canEvacuateAfterMaterialPickup, true)
  assert.equal(data.dungeons.list.length >= 4, true)

  for (const dungeon of data.dungeons.list) {
    assert.equal(dungeon.floors.length, data.dungeons.floorsPerDungeon)
    assert.equal(dungeon.floors.at(-1).boss, true)
    assert.equal(Boolean(dungeon.bossArtifact), true)
    assert.equal(dungeon.rewards.gachaTickets, true)
    assert.equal(dungeon.rewards.artifactEssence, true)
  }
})

test('runtime picks a stage profile by world stage number', () => {
  const stage = stageProfile(3)

  assert.equal(stage.name, '赤焰裂谷')
  assert.equal(stage.background, 'red-flame-ravine')
  assert.equal(stage.enemies.some((enemy) => enemy.role === 'flying'), true)
  assert.equal(stage.boss.name, '地火巨妖')
})

test('runtime plans dungeon floors and resolves extraction rewards', () => {
  const dungeon = dungeonRunPlan('mist-bamboo-secret')
  const extract = resolveDungeonFloor(dungeon, 2, { extracted: true, bossKilled: false })
  const clear = resolveDungeonFloor(dungeon, 5, { extracted: false, bossKilled: true })

  assert.equal(dungeon.name, '雾竹秘境')
  assert.equal(extract.status, 'extracted')
  assert.equal(extract.reward.material, '青竹髓')
  assert.equal(extract.reward.artifact, undefined)
  assert.equal(clear.status, 'cleared')
  assert.equal(clear.reward.artifact, '青霜御剑匣')
  assert.equal(clear.reward.gachaTickets > extract.reward.gachaTickets, true)
})
