import assert from 'node:assert/strict'
import test from 'node:test'

import {
  balancedPolicy,
  greedyPolicy,
  safePolicy,
  simulateDungeon,
} from '../tools/simulate-pursuit-dungeon.mjs'

test('one hundred seeded policy runs always reach a terminal result without invalid state', () => {
  const reports = Array.from({ length: 100 }, (_, seed) => {
    const policy = seed % 3 === 0 ? safePolicy : seed % 3 === 1 ? balancedPolicy : greedyPolicy
    return simulateDungeon(seed, policy)
  })

  assert.equal(reports.every((report) => ['extracted', 'defeated'].includes(report.phase)), true)
  assert.equal(reports.filter((_, seed) => seed % 3 === 0).every((report) => report.earlyExtraction), true)
  assert.equal(reports.filter((_, seed) => seed % 3 === 2).every((report) => report.bossDefeated), true)
  assert.equal(reports.every((report) => report.minimumDoorCurrency >= 0), true)
  assert.equal(reports.every((report) => report.rewardCommitCount <= 1), true)
  assert.equal(reports.every((report) => report.escapePathAlwaysAvailable), true)
  assert.equal(reports.every((report) => report.usedProductionSession), true)
  assert.equal(reports.every((report) => report.checkpointRestoreCount >= 1), true)
  assert.ok(new Set(reports.map((report) => report.simulationFingerprint)).size >= 20)
})

test('policies produce their intended observable routes and evidence', () => {
  const safe = simulateDungeon(30, safePolicy)
  const balanced = simulateDungeon(31, balancedPolicy)
  const greedy = simulateDungeon(32, greedyPolicy)

  assert.equal(safe.exitKind, 'damaged')
  assert.equal(safe.visitedRoomIds.includes('f2-damaged-exit'), true)
  assert.equal(balanced.searchCount >= 3, true)
  assert.equal(balanced.paidDoorCount >= 1, true)
  assert.equal(balanced.pursuitEncounters >= 1, true)
  assert.equal(balanced.obtainedArtifactOrAttachment, true)
  assert.equal(greedy.altarActivated, true)
  assert.equal(greedy.bossDefeated, true)
  assert.equal(greedy.visitedRoomIds.includes('f3-sword-vault'), true)
  assert.equal(greedy.exitKind, 'full')
  for (const report of [safe, balanced, greedy]) {
    assert.ok(report.pressurePhases.length > 0)
    assert.ok(report.terminalReason)
    assert.equal(report.rewardCommitCount, 1)
  }
})
