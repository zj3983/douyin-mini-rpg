import test from 'node:test'
import assert from 'node:assert/strict'
import { createBattleSession, tickBattleSession } from '../assets/Scripts/Core/Battle/BattleSession.ts'
import { setMoveTarget } from '../assets/Scripts/Core/Battle/PlayerMotor.ts'
import { pointInFan } from '../assets/Scripts/Core/Battle/Geometry.ts'
import { createSeededRandom } from '../assets/Scripts/Core/Battle/Random.ts'
import { STAGE_ONE } from '../assets/Scripts/Core/Battle/StageOneConfig.ts'

function dodgeTarget(session, botRandom) {
  const player = session.player.position
  const boss = session.boss
  if (boss && boss.alive) {
    if (boss.sweepFan && (boss.state === 'telegraph' || boss.state === 'attack') && pointInFan(player, boss.sweepFan)) {
      const escape = boss.sweepFan.directionRadians + (boss.sweepFan.halfAngleRadians + 0.6)
      return {
        x: boss.sweepFan.origin.x + Math.cos(escape) * 260,
        y: boss.sweepFan.origin.y + Math.sin(escape) * 260,
      }
    }
    for (const marker of boss.spikes) {
      if (marker.resolved || marker.erupted) continue
      if (Math.hypot(player.x - marker.position.x, player.y - marker.position.y) < marker.radius + 40) {
        return { x: marker.position.x + 180, y: player.y + botRandom.pick([-1, 1]) * 120 }
      }
    }
    if (boss.roarWave) {
      const wave = boss.roarWave
      const distance = Math.hypot(player.x - wave.center.x, player.y - wave.center.y)
      if (Math.abs(distance - wave.radius) < wave.bandWidth + 80) {
        return {
          x: wave.center.x + Math.cos(wave.gapCenterRadians) * Math.max(140, distance),
          y: wave.center.y + Math.sin(wave.gapCenterRadians) * Math.max(140, distance),
        }
      }
    }
  }
  for (const enemy of session.enemies) {
    if (!enemy.alive || enemy.state !== 'telegraph') continue
    if (Math.hypot(player.x - enemy.position.x, player.y - enemy.position.y) < 200) {
      return { x: player.x, y: player.y + (player.y > enemy.position.y ? 180 : -180) }
    }
  }
  return null
}

function nearestEnemyDistance(session) {
  let best = Infinity
  for (const enemy of session.enemies) {
    if (!enemy.alive) continue
    best = Math.min(best, Math.hypot(enemy.position.x - session.player.position.x, enemy.position.y - session.player.position.y))
  }
  return best
}

function runSimulation(seed) {
  const session = createBattleSession(STAGE_ONE, seed)
  const botRandom = createSeededRandom(seed * 1000 + 1)
  let thinkTimer = 0
  let bossEntryElapsed = null
  let clearedElapsed = null
  let maxAlive = 0
  const eventCounts = {}

  for (let tick = 0; tick < 120 * 60; tick += 1) {
    tickBattleSession(session, 1 / 60)
    for (const event of session.events.splice(0)) eventCounts[event.type] = (eventCounts[event.type] ?? 0) + 1
    if (bossEntryElapsed === null && (session.phase === 'boss-entry' || session.phase === 'boss')) {
      bossEntryElapsed = session.elapsed
    }
    maxAlive = Math.max(maxAlive, session.enemies.filter((enemy) => enemy.alive).length)

    thinkTimer -= 1 / 60
    if (thinkTimer <= 0 && session.player.alive) {
      thinkTimer = 0.2
      const dodge = dodgeTarget(session, botRandom)
      if (dodge) {
        setMoveTarget(session.player, dodge)
      } else if (nearestEnemyDistance(session) > 230) {
        setMoveTarget(session.player, {
          x: session.player.position.x + botRandom.range(40, 140),
          y: session.player.position.y + botRandom.range(-140, 140),
        })
      }
    }

    if (session.phase === 'cleared') {
      clearedElapsed = session.elapsed
      break
    }
    if (session.phase === 'defeated') break
  }

  return { session, bossEntryElapsed, clearedElapsed, maxAlive, eventCounts }
}

test('seeded bot clears stage one within 90 seconds with boss entry near 60s', () => {
  const result = runSimulation(7)
  assert.equal(result.session.phase, 'cleared')
  assert.ok(result.bossEntryElapsed !== null, 'boss entry should happen')
  assert.ok(result.bossEntryElapsed >= 55 && result.bossEntryElapsed <= 65, `boss entry at ${result.bossEntryElapsed}s`)
  assert.ok(result.clearedElapsed !== null && result.clearedElapsed <= 90, `cleared at ${result.clearedElapsed}s`)
  assert.ok(result.maxAlive <= 18)
  assert.ok(result.session.player.hp > 0, 'bot should survive')
})

test('same seed produces identical outcomes', () => {
  const a = runSimulation(11)
  const b = runSimulation(11)
  assert.deepEqual(
    { phase: a.session.phase, playerHp: a.session.player.hp, souls: a.session.souls.length, events: a.eventCounts },
    { phase: b.session.phase, playerHp: b.session.player.hp, souls: b.session.souls.length, events: b.eventCounts },
  )
})
