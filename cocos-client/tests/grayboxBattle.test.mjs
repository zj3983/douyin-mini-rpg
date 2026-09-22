import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { greedyPolicy, simulateDungeon } from '../tools/simulate-pursuit-dungeon.mjs'
import {
  advanceDungeonRun,
  applyDungeonCommand,
  checkpointDungeonRun,
  createDungeonSession,
  restoreDungeonSession,
} from '../assets/Scripts/Core/Dungeon/DungeonSession.ts'
import { createDualModeRuntime } from '../assets/Scripts/Core/Progression/DualModeRuntime.ts'
import { createDefaultSave, migratePlayerSave } from '../assets/Scripts/Core/Progression/PlayerSave.ts'

const read = (path) => readFileSync(resolve(path), 'utf8')

test('graybox controller remains available as a battle-core diagnostic scene', () => {
  const source = read('assets/Scripts/Game/GrayboxBattleController.ts')
  assert.match(source, /class GrayboxBattleController/)
  assert.match(source, /createBattleSession\(STAGE_ONE/)
  assert.match(source, /tickBattleSession\(this\.session, deltaTime\)/)
  assert.match(source, /Node\.EventType\.TOUCH_END/)
  assert.match(source, /drawTelegraphs/)
  assert.match(source, /requestSettleContinue/)
  assert.match(source, /rebuildSession/)
})

test('portrait bootstrap assembles the complete dungeon presenter and shared combat runtime', () => {
  const source = read('assets/Scripts/Game/PortraitBattleBootstrap.ts')
  for (const name of ['SharedCombatRoot', 'SharedActorLayer', 'SharedEffectLayer', 'SharedDropLayer', 'WorldRoot', 'DungeonRoot', 'DungeonEntryButton']) {
    assert.match(source, new RegExp(`createNode\\('${name}'|createLabel\\('${name}'`), `missing ${name}`)
  }
  assert.match(source, /dungeonRoot\.addComponent\(DungeonRunPresenter\)/)
  assert.match(source, /dungeonEntryNode\.addComponent\(Button\)/)
  assert.match(source, /dungeonEntryNode\.on\(Button\.EventType\.CLICK,\s*this\.enterDungeonFromWorld,\s*this\)/)
  assert.match(source, /dualModeController\?\.enterDungeon\(\)/)
  assert.match(source, /dungeonRun\.onRunEvent = \(event\) => this\.onDungeonRunEvent\(event\)/)
  assert.match(source, /presenter\.onCommandRequested = \(command\) => this\.applyDungeonCommand\(command\)/)
  assert.doesNotMatch(source, /createDungeonFloor|DungeonInteractButton/)
  assert.doesNotMatch(source, /querySelector|createElement/)
})

test('dungeon command authority remains in the Core session', () => {
  assert.equal(existsSync(resolve('assets/Scripts/Core/Dungeon/DungeonInteraction.ts')), true)
  const controller = read('assets/Scripts/Game/DungeonRunController.ts')
  assert.match(controller, /applyDungeonCommand/)
  assert.match(controller, /this\.mutate\(\(candidate\) => applyDungeonCommand\(candidate, command\)\)/)
  assert.doesNotMatch(controller, /grantDoorCurrency|doorCurrency\s*[+\-*/]?=/)
})

test('bootstrap refreshes dungeon UI through typed run events and explicit commands', () => {
  const source = read('assets/Scripts/Game/PortraitBattleBootstrap.ts')
  assert.match(source, /dungeonRun\.onRunEvent = \(event\) => this\.onDungeonRunEvent\(event\)/)
  assert.match(source, /private applyDungeonCommand\(command: DungeonCommand\)/)
  assert.match(source, /this\.refreshDungeonPresentation\(\)/)
  assert.doesNotMatch(source, /dungeonNode\.on\('dungeon-(?:run-began|room-changed|loot-found|extracted)'/)
})

test('dual and dungeon adapters stay isolated from the legacy battle layer', () => {
  for (const file of [
    'assets/Scripts/Game/DungeonRunController.ts',
    'assets/Scripts/Game/DualModeGameController.ts',
    'assets/Scripts/Core/Dungeon/DungeonSession.ts',
    'assets/Scripts/Core/Progression/DualModeRuntime.ts',
  ]) {
    const source = read(file)
    assert.doesNotMatch(source, /Core\/Battle/)
    assert.doesNotMatch(source, /(?:\.\.\/)+Combat\//)
    assert.doesNotMatch(source, /querySelector|createElement/)
  }
})

test('greedy policy completes the authored three-floor Boss route exactly once', () => {
  const report = simulateDungeon(88, greedyPolicy)
  assert.equal(report.phase, 'extracted')
  assert.equal(report.bossDefeated, true)
  assert.equal(report.visitedRoomIds.includes('f3-sword-vault'), true)
  assert.equal(report.exitKind, 'full')
  assert.equal(report.rewardCommitCount, 1)
})

test('production dungeon extraction commits its reward ledger exactly once through DualModeRuntime', () => {
  const profile = JSON.parse(read('assets/resources/Data/dual-mode-slice.json'))
  let run = null
  const dungeon = {
    isReady: () => true,
    hasRun: () => run !== null,
    currentRunId: () => run?.id ?? null,
    previewRunId: (seed) => createDungeonSession(profile, seed).id,
    begin(seed) {
      if (run) return false
      run = createDungeonSession(profile, seed)
      return true
    },
    restore(checkpoint) {
      if (run) return false
      run = restoreDungeonSession(profile, checkpoint)
      return true
    },
    checkpoint: () => run ? checkpointDungeonRun(run) : null,
    cancelRun() {
      if (!run) return false
      run = null
      return true
    },
    isExtractedRun: (runId) => run?.id === runId && run.phase === 'extracted',
    extractedLoot: (runId) => run?.id === runId && run.phase === 'extracted'
      ? structuredClone(run.carriedLoot)
      : null,
  }
  const saved = []
  const runtime = createDualModeRuntime({
    initialSave: createDefaultSave(),
    repository: { save: (value) => saved.push(migratePlayerSave(value)) },
    dungeon,
  })
  assert.equal(runtime.enterDungeon(188).ok, true)
  for (const exitId of ['f1-entry-to-forest', 'f1-forest-to-floor2', 'f2-bridge-to-exit']) {
    assert.equal(applyDungeonCommand(run, { type: 'choose-exit', exitId }).accepted, true)
    assert.equal(runtime.handleDungeonCheckpoint(checkpointDungeonRun(run)).ok, true)
  }
  assert.equal(applyDungeonCommand(run, { type: 'begin-extraction' }).accepted, true)
  for (let frame = 0; frame < 40; frame += 1) advanceDungeonRun(run, 0.1, { paused: false })
  assert.equal(run.phase, 'extracted')

  const payload = { runId: run.id, loot: structuredClone(run.carriedLoot) }
  assert.equal(runtime.handleDungeonExtracted(payload).ok, true)
  const savesAfterAcceptance = saved.length
  assert.deepEqual(runtime.handleDungeonExtracted(payload), { ok: false, reason: 'no-active-run' })
  assert.equal(saved.length, savesAfterAcceptance)
  assert.equal(runtime.getSaveSnapshot().rewardLedger.filter((entry) => entry === 'mist-vault-188').length, 1)
})
