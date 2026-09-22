import test from 'node:test'
import assert from 'node:assert/strict'
import { createBattleSession, requestSettleContinue, tickBattleSession } from '../assets/Scripts/Core/Battle/BattleSession.ts'
import { applyBossDamage, createBoss } from '../assets/Scripts/Core/Battle/BossBrain.ts'
import { STAGE_ONE } from '../assets/Scripts/Core/Battle/StageOneConfig.ts'

function tickSeconds(session, seconds) {
  for (let tick = 0; tick < Math.round(seconds * 60); tick += 1) tickBattleSession(session, 1 / 60)
}

test('session flows opening -> waves -> drain -> boss-entry -> boss', () => {
  const session = createBattleSession(STAGE_ONE, 7)
  assert.equal(session.phase, 'opening')
  tickSeconds(session, 1.2)
  assert.equal(session.phase, 'waves')
  tickSeconds(session, 57)
  assert.ok(['drain', 'boss-entry', 'boss'].includes(session.phase), `unexpected phase ${session.phase}`)
  tickSeconds(session, 4)
  assert.equal(session.phase, 'boss')
  assert.ok(session.boss)
})

test('wave spawning never exceeds the 18-enemy cap', () => {
  const session = createBattleSession(STAGE_ONE, 7)
  let maxAlive = 0
  for (let tick = 0; tick < 60 * 60; tick += 1) {
    tickBattleSession(session, 1 / 60)
    maxAlive = Math.max(maxAlive, session.enemies.filter((enemy) => enemy.alive).length)
  }
  assert.ok(maxAlive <= 18)
})

test('settlement continue is idempotent against the 3-second auto-continue race', () => {
  const manual = createBattleSession(STAGE_ONE, 7)
  manual.phase = 'settle'
  manual.settleElapsed = 0
  assert.equal(requestSettleContinue(manual), true)
  assert.equal(manual.phase, 'cleared')
  assert.equal(requestSettleContinue(manual), false)

  const auto = createBattleSession(STAGE_ONE, 7)
  auto.phase = 'settle'
  tickSeconds(auto, 3.1)
  assert.equal(auto.phase, 'cleared')
  assert.equal(auto.events.filter((event) => event.type === 'cleared').length, 1)
})

test('player defeat freezes the session', () => {
  const session = createBattleSession(STAGE_ONE, 7)
  session.player.hp = 0
  session.player.alive = false
  tickBattleSession(session, 1 / 60)
  assert.equal(session.phase, 'defeated')
  const before = session.elapsed
  tickBattleSession(session, 1 / 60)
  assert.equal(session.elapsed, before)
  assert.equal(session.events.filter((event) => event.type === 'defeated').length, 1)
})

test('boss death settles the session exactly once', () => {
  const session = createBattleSession(STAGE_ONE, 7)
  session.phase = 'boss'
  session.boss = createBoss(999, STAGE_ONE.boss)
  applyBossDamage(session.boss, 99999)
  tickBattleSession(session, 1 / 60)
  assert.equal(session.phase, 'settle')
  tickBattleSession(session, 1 / 60)
  assert.equal(session.events.filter((event) => event.type === 'settle').length, 1)
})
