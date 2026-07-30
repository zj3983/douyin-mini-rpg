import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'
import { createDualModeRuntime } from '../assets/Scripts/Core/Progression/DualModeRuntime.ts'
import { createDefaultSave } from '../assets/Scripts/Core/Progression/PlayerSave.ts'
import {
  createWorldRegion,
  selectWorldStage,
} from '../assets/Scripts/Core/World/WorldRegion.ts'

const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`

function ccHarnessUrl() {
  return moduleUrl(`
    export class Component {
      constructor() { this.node = { emit() {} } }
      unscheduleAllCallbacks() {}
      scheduleOnce() {}
    }
    export class Node {}
    export class JsonAsset {}
    export class Button { static EventType = { CLICK: 'click' }; constructor() { this.interactable = true; this.node = { on() {}, off() {} } } }
    export class Label { constructor() { this.string = '' } }
    export class Vec3 { static ZERO = { x: 0, y: 0, z: 0 } }
    export const _decorator = {
      ccclass: () => (Type) => Type,
      property: () => () => {},
    }
  `)
}

function runtimeDependenciesUrl() {
  return moduleUrl(`
    export class BattleHudController {}
    export class BattleInputController {}
    export class BossTelegraphPresenter {}
    export class DamageNumberController {}
    export class EnemyController {}
    export class EnemySpawner {}
    export class NodePoolController {}
    export class PlayerController {}
    export class SoulOrbController {}
    export class StageClearPanelController {}
    export function stageProfileFromDesign(design, stageNumber) {
      if (!Number.isSafeInteger(stageNumber) || stageNumber < 1) throw new Error('Unknown world stage')
      const stage = design.worldStages.find((entry) => entry.id === stageNumber)
      if (!stage) throw new Error('Unknown world stage')
      return { ...stage, enemies: [...stage.enemies], boss: stage.enemies.find((enemy) => enemy.role === 'boss') }
    }
    export function createWorldRewardSessionId() { return 'test-session' }
    export function worldRewardId() { return 'test-reward' }
    export function createBattleAttemptState() { return { generation: 0, stageNumber: 1, status: 'active' } }
    export function beginBattleAttempt(_state, stageNumber) { return { generation: 1, stageNumber, status: 'active' } }
    export function createBattleFreezeState() { return {} }
    export function createContactDamageGate() { return { health: 220, maxHealth: 220 } }
    export function createEnemyCombatResolverAdapter() { return {} }
    export function createPerformanceBudget() { return {} }
    export function createStageFlow() { return { phase: 'clearing' } }
    export function createStageSettlementState() { return {} }
    export function createBattleRuntime(stage) { return { stage, enemies: [], defeatTarget: 12 } }
    export function rebuildBattleFreeze() {}
    export function resetEnemyCombatResolverAdapter() {}
    export function stageVisualFor(stageId) { return { stageId, backgroundId: 'stage-' + stageId, theme: 'test' } }
    export function updateVfxQuality() { return 'full' }
    export function canProcessBattleAction() { return true }
    export function applyDirectDamage() { return {} }
    export function applyFlyingSwordPathHit() { return { hitCount: 0, damageEvents: [], defeatedEnemyIds: [], stageClear: false } }
    export function advanceBossDefeatFlow() { return {} }
    export function advanceOrdinaryDefeatFlow() { return {} }
    export function claimStageClear() { return null }
    export function completeBossSettlement() { return false }
    export function freezeBattle() {}
    export function isBattleAttemptCallbackCurrent() { return false }
    export function markBattleAttemptCleared() { return false }
    export function markBattleAttemptDefeated() { return false }
    export function nextSpawn() { return { ok: false } }
    export function rollbackSpawnedEnemy() { return false }
    export function retryBossSpawnFlow() { return {} }
    export function scheduleBossSettlement() { return null }
    export function segmentHitEnemiesAlongPath() { return [] }
    export function spawnBoss() { return { ok: false } }
    export function markPlayerDefeated() { return { changed: false } }
    export function recordGeometricSwordHits() { return [] }
    export function snapshotLivingSwordTargets() { return [] }
    export function feedbackFor() { return [] }
    export function cancelEnemyCombatActorAttacks() {}
    export function consumeEnemyCombatCommand() {}
    export function drainEnemyCombatDamage() { return [] }
    export function drainEnemyTelegraphs() { return [] }
    export function pauseEnemyCombatResolverAdapter() {}
    export function removeEnemyCombatActor() {}
    export function stepEnemyCombatResolverAdapter() {}
    export function upsertEnemyCombatActor() {}
    export function upsertPlayerCombatActor() {}
  `)
}

async function loadBattleRuntimeController() {
  const source = readFileSync(resolve('assets/Scripts/Game/BattleRuntimeController.ts'), 'utf8')
  let javascript = ts.transpileModule(source, {
    compilerOptions: {
      experimentalDecorators: true,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
  const ccUrl = ccHarnessUrl()
  const dependencyUrl = runtimeDependenciesUrl()
  javascript = javascript
    .replaceAll("from 'cc'", `from '${ccUrl}'`)
    .replace(/from ['"]\.\.[^'"]+['"]/g, `from '${dependencyUrl}'`)
    .replace(/from ['"]\.[^'"]+['"]/g, `from '${dependencyUrl}'`)
  return (await import(moduleUrl(javascript))).BattleRuntimeController
}

function stage(id) {
  return {
    id,
    name: `Stage ${id}`,
    encounter: id === 10 ? 'region-boss' : [4, 7].includes(id) ? 'elite' : 'normal',
    enemies: [{ id: `boss-${id}`, name: `Boss ${id}`, role: 'boss' }],
  }
}

const region = createWorldRegion('test-region', Array.from({ length: 10 }, (_, index) => ({
  id: index + 1,
  encounter: index === 9 ? 'region-boss' : [3, 6].includes(index) ? 'elite' : 'normal',
})))

test('invalid stage advance leaves the active runtime intact', async () => {
  const BattleRuntimeController = await loadBattleRuntimeController()
  const controller = new BattleRuntimeController()
  const activeRuntime = { stage: stage(1), enemies: [{ id: 1 }] }
  let hideCalls = 0
  controller.designData = { json: { worldStages: Array.from({ length: 10 }, (_, index) => stage(index + 1)) } }
  controller.stageNumber = 1
  controller.runtime = activeRuntime
  controller.bossTelegraphPresenter = {
    hideAll() { hideCalls += 1 },
    resetGeneration() {},
  }

  let result
  assert.doesNotThrow(() => { result = controller.advanceToStage(11) })

  assert.deepEqual(result, { ok: false, stageNumber: 1, reason: 'unknown-stage' })
  assert.equal(controller.runtime, activeRuntime)
  assert.equal(controller.stageNumber, 1)
  assert.equal(hideCalls, 0)
})

test('failed world-clear persistence keeps the next stage inaccessible', async () => {
  const BattleRuntimeController = await loadBattleRuntimeController()
  const runtime = createDualModeRuntime({
    initialSave: createDefaultSave(),
    repository: { save() { throw new Error('storage unavailable') } },
    dungeon: {
      hasRun: () => false,
      currentRunId: () => null,
      previewRunId: () => null,
      begin: () => false,
      cancelRun: () => false,
      isExtractedRun: () => false,
      extractedLoot: () => null,
    },
  })
  const controller = new BattleRuntimeController()
  let rebuildCalls = 0
  let recycleCalls = 0
  controller.stageNumber = 1
  controller.runtime = { stage: stage(1), enemies: [] }
  controller.designData = { json: { worldStages: Array.from({ length: 10 }, (_, index) => stage(index + 1)) } }
  controller.canAdvanceToStage = (stageId) => selectWorldStage(
    region,
    runtime.getSaveSnapshot().world.highestClearedStage,
    stageId,
  ).ok
  controller.recycleAllEnemies = () => { recycleCalls += 1 }
  controller.rebuildRuntime = () => { rebuildCalls += 1; controller.stageNumber = 2 }

  assert.deepEqual(
    runtime.handleWorldCleared({ stage: 1, rewardId: 'world-1-persist-failure' }),
    { ok: false, reason: 'save-persist-failed' },
  )
  const result = controller.advanceToStage(2)

  assert.deepEqual(result, { ok: false, stageNumber: 1, reason: 'locked-stage' })
  assert.equal(runtime.getSaveSnapshot().world.highestClearedStage, 0)
  assert.equal(controller.stageNumber, 1)
  assert.equal(recycleCalls, 0)
  assert.equal(rebuildCalls, 0)
})

test('stage ten panel exposes region completion and never continues to stage eleven', async () => {
  const source = readFileSync(resolve('assets/Scripts/Game/StageClearPanelController.ts'), 'utf8')
  let javascript = ts.transpileModule(source, {
    compilerOptions: {
      experimentalDecorators: true,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
  javascript = javascript.replace("from 'cc'", `from '${ccHarnessUrl()}'`)
  const { StageClearPanelController } = await import(moduleUrl(javascript))
  const panel = new StageClearPanelController()
  panel.panelRoot = { active: false }
  panel.titleLabel = { string: '' }
  panel.rewardLabel = { string: '' }
  panel.nextStageLabel = { string: '' }
  panel.nextStageButton = { interactable: false }
  const continued = []
  panel.onContinue = (result) => { continued.push(result); return true }
  const result = {
    title: '第10关突破',
    stageId: 10,
    action: { kind: 'region-complete' },
    reward: { spiritStones: 80, dungeonPasses: 1 },
  }

  panel.showResult(result)
  panel.handleContinue()

  assert.equal(panel.nextStageLabel.string, '区域完成')
  assert.deepEqual(continued, [result])
  assert.doesNotMatch(panel.nextStageLabel.string, /11/)
})

test('bootstrap gates continue with the current persisted save snapshot', () => {
  const source = readFileSync(resolve('assets/Scripts/Game/PortraitBattleBootstrap.ts'), 'utf8')

  assert.match(source, /runtime\.canAdvanceToStage\s*=\s*\(stageId\)/)
  assert.match(source, /dualMode\.getHighestClearedWorldStage\(\)/)
  assert.match(source, /selectWorldStage\(/)
  assert.doesNotMatch(source, /onContinue\s*=\s*\(nextStageId\)\s*=>\s*runtime\.advanceToStage\(nextStageId\)/)
})
