import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyBossDamage,
  createBoss,
  roarHitsPlayer,
  sweepHitsPlayer,
  tickBoss,
} from '../assets/Scripts/Core/Battle/BossBrain.ts'
import { createSeededRandom } from '../assets/Scripts/Core/Battle/Random.ts'

const config = {
  spawn: { x: 420, y: -40 }, anchor: { x: 170, y: -20 },
  maxHp: 1500, radius: 56, moveSpeed: 60, entrySeconds: 1.5, idleSeconds: 1.1,
  decisionHz: 8, phaseTwoHpFraction: 0.5,
  sweep: { telegraph: 0.8, active: 0.25, recovery: 0.7, radius: 260, halfAngleRadians: 0.9, damage: 24 },
  spikes: { count: 3, interval: 0.35, markerDelay: 0.7, radius: 60, damage: 20, recovery: 0.6 },
  roar: { telegraph: 0.9, waveSpeed: 420, bandWidth: 70, maxRadius: 520, gapHalfAngleRadians: 0.55, damage: 28, recovery: 0.8 },
}
const ctxFor = (extras = {}) => ({
  playerPosition: { x: 0, y: -20 }, playerAlive: true, random: createSeededRandom(9), deltaTime: 1 / 60, ...extras,
})
function run(boss, seconds, extras = {}) {
  const events = []
  for (let tick = 0; tick < seconds * 60; tick += 1) events.push(...tickBoss(boss, config, ctxFor(extras)))
  return events
}

test('boss walks in during entry, then cycles all three skills', () => {
  const boss = createBoss(100, config)
  const events = run(boss, 20)
  const telegraphed = events.filter((event) => event.type === 'boss-telegraph').map((event) => event.skill)
  assert.deepEqual([...new Set(telegraphed)].sort(), ['bamboo-sweep', 'earth-spikes', 'mountain-roar'])
})

test('sweep only hits inside the fan during active frames', () => {
  const boss = createBoss(100, config)
  boss.state = 'telegraph'
  boss.currentSkill = 'bamboo-sweep'
  boss.sweepFan = { origin: { x: 170, y: -20 }, directionRadians: Math.PI, radius: 260, halfAngleRadians: 0.9 }
  assert.equal(sweepHitsPlayer(boss, { x: 0, y: -20 }, 24), false, 'no damage during telegraph')
  boss.state = 'attack'
  assert.equal(sweepHitsPlayer(boss, { x: 0, y: -20 }, 24), true)
  assert.equal(sweepHitsPlayer(boss, { x: 170, y: 200 }, 24), false, 'outside the fan angle')
})

test('earth spikes erupt after their delay, never at spawn', () => {
  const boss = createBoss(100, config)
  boss.state = 'attack'
  boss.currentSkill = 'earth-spikes'
  boss.clock = 10
  const events = run(boss, 0.1)
  const marker = events.find((event) => event.type === 'boss-spike-marker')?.marker
  assert.ok(marker, 'first marker spawns immediately in the attack state')
  assert.ok(marker.eruptAt > 10, 'eruption is always delayed')
  assert.equal(events.some((event) => event.type === 'boss-spike-erupt'), false)
})

test('roar wave hits the band but never the safe gap', () => {
  const boss = createBoss(100, config)
  boss.state = 'attack'
  boss.currentSkill = 'mountain-roar'
  boss.roarWave = { center: { x: 170, y: -20 }, radius: 200, bandWidth: 70, gapCenterRadians: 0, gapHalfAngleRadians: 0.55, didHit: false }
  assert.equal(roarHitsPlayer(boss, { x: 170, y: 180 }, 24), true)
  assert.equal(roarHitsPlayer(boss, { x: 370, y: -20 }, 24), false, 'player inside the gap is safe')
  assert.equal(roarHitsPlayer(boss, { x: 170, y: 500 }, 24), false, 'outside the band')
})

test('phase two queues a second skill without shortening telegraphs', () => {
  const boss = createBoss(100, config)
  const result = applyBossDamage(boss, 800)
  assert.equal(result.enteredPhaseTwo, true)
  assert.equal(boss.phase, 2)
  const events = run(boss, 6)
  const telegraphs = events.filter((event) => event.type === 'boss-telegraph')
  assert.ok(telegraphs.length >= 2, 'phase two pairs skills')
  assert.equal(config.sweep.telegraph, 0.8)
})

test('boss damage never interrupts skill states; death is terminal', () => {
  const boss = createBoss(100, config)
  boss.state = 'attack'
  boss.currentSkill = 'bamboo-sweep'
  applyBossDamage(boss, 100)
  assert.equal(boss.state, 'attack')
  const result = applyBossDamage(boss, 9999)
  assert.equal(result.killed, true)
  assert.equal(boss.alive, false)
  assert.equal(boss.state, 'death')
})
