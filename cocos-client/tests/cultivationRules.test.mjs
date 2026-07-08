import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
