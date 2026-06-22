import test from 'node:test'
import assert from 'node:assert/strict'

import {
  skillAnnouncementText,
  wildBossHp,
  wildBossSpawnOffset,
  wildEnemyHpMultiplier,
  wildEnemyTarget,
  wildInnateCooldownMultiplier,
  wildSkillDamageMultiplier,
  wildSpawnDistance,
} from '../src/combatTuning.ts'

test('wild combat keeps enough enemies in the early stage for continuous fighting', () => {
  assert.equal(wildEnemyTarget(1), 8)
  assert.equal(wildEnemyTarget(4), 9)
  assert.equal(wildEnemyTarget(12), 10)
})

test('wild spawn distance keeps first-screen enemies closer than the old offscreen range', () => {
  assert.equal(wildSpawnDistance(266, 0), 190)
  assert.equal(wildSpawnDistance(266, 1), 280)
  assert.equal(wildSpawnDistance(500, 0.5), 335)
})

test('wild enemy hp multiplier makes early monsters faster to clear without nerfing later stages', () => {
  assert.equal(wildEnemyHpMultiplier(1), 0.755)
  assert.equal(wildEnemyHpMultiplier(4), 0.86)
  assert.equal(wildEnemyHpMultiplier(12), 1)
})

test('skill announcement text changes on repeated casts so playtest agent can count skill feedback', () => {
  assert.equal(skillAnnouncementText('御剑术', '本命术发动', 1), '御剑术｜本命术发动 #1')
  assert.equal(skillAnnouncementText('御剑术', '本命术发动', 2), '御剑术｜本命术发动 #2')
})

test('wild first boss is close and killable during a short new-player playtest', () => {
  assert.equal(wildBossHp(1, 1), 298)
  assert.equal(wildBossHp(3, 8), 474)
  assert.equal(wildBossSpawnOffset(1), 298)
  assert.equal(wildBossSpawnOffset(12), 386)
})

test('wild early innate skills fire faster and hit harder to create mowing rhythm', () => {
  assert.equal(wildInnateCooldownMultiplier(1), 0.46)
  assert.equal(wildInnateCooldownMultiplier(5), 0.62)
  assert.equal(wildInnateCooldownMultiplier(12), 0.9)
  assert.equal(wildSkillDamageMultiplier(1), 1.7)
  assert.equal(wildSkillDamageMultiplier(5), 1.5)
  assert.equal(wildSkillDamageMultiplier(12), 1.15)
})
