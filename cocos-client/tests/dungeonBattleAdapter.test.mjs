import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import ts from 'typescript'

const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`

async function loadBattleRuntime() {
  const source = readFileSync(resolve('assets/Scripts/Core/BattleRuntime.ts'), 'utf8')
  const dependencyUrl = moduleUrl(`
    export function completeDrain() { return { command: null } }
    export function recordBossDefeat() { return { changed: false, command: null } }
    export function recordOrdinaryDefeat() { return { changed: false, command: null } }
  `)
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText.replace(/from ['"]\.[^'"]+['"]/g, `from '${dependencyUrl}'`)
  return import(moduleUrl(javascript))
}

function profile(id, role = 'ground') {
  return { id, name: id, role, theme: 'mist-bamboo' }
}

function stage() {
  const boss = profile('world-boss', 'boss')
  return {
    id: 1,
    name: 'World Stage',
    theme: 'mist-bamboo',
    background: 'world-stage',
    encounter: 'normal',
    enemies: [profile('moss-wolf'), boss],
    boss,
  }
}

test('battle runtime keeps world defaults and accepts strict dungeon limits', async () => {
  const { createBattleRuntime } = await loadBattleRuntime()
  const world = createBattleRuntime(stage(), 44)
  assert.equal(world.defeatTarget, 12)
  assert.equal(world.maxAliveEnemies, 18)

  const dungeon = createBattleRuntime(stage(), 44, { defeatTarget: 7, maxAlive: 9 })
  assert.equal(dungeon.defeatTarget, 7)
  assert.equal(dungeon.maxAliveEnemies, 9)

  for (const options of [
    { defeatTarget: 0, maxAlive: 1 },
    { defeatTarget: 1.5, maxAlive: 1 },
    { defeatTarget: Number.MAX_SAFE_INTEGER + 1, maxAlive: 1 },
    { defeatTarget: 1, maxAlive: 0 },
    { defeatTarget: 1, maxAlive: 19 },
    { defeatTarget: 1, maxAlive: Number.NaN },
  ]) {
    assert.throws(() => createBattleRuntime(stage(), 44, options), /defeatTarget|maxAlive/)
  }
})

function createCcModule() {
  return moduleUrl(`
    export const ccCalls = { unschedule: 0 }
    export class Component {
      constructor() {
        this._scheduled = []
        this.node = { events: [], emit(name, ...args) { this.events.push([name, ...args]) } }
      }
      unscheduleAllCallbacks() { ccCalls.unschedule += 1; this._scheduled.length = 0 }
      scheduleOnce(callback, delay = 0) { this._scheduled.push({ callback, delay }) }
    }
    export class JsonAsset {}
    export class Node {}
    export class Vec3 {
      constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z }
      clone() { return new Vec3(this.x, this.y, this.z) }
      static ZERO = new Vec3()
    }
    export const _decorator = {
      ccclass: () => (Type) => Type,
      property: (...args) => args.length >= 2 ? undefined : () => undefined,
    }
  `)
}

function createDependencyModule() {
  return moduleUrl(`
    export const calls = {
      createRuntime: [], resetResolver: [], removeActor: [], pauseResolver: [],
      worldAdvanceOrdinary: 0, worldAdvanceBoss: 0, worldClaim: 0, worldReward: 0,
    }
    export function resetCalls() {
      for (const key of Object.keys(calls)) Array.isArray(calls[key]) ? calls[key].length = 0 : calls[key] = 0
    }
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
    export function createWorldRewardSessionId() { return 'world-session' }
    export function worldRewardId() { calls.worldReward += 1; return 'world-reward' }
    export function createBattleAttemptState(generation = 0, stageNumber = 1) { return { generation, stageNumber, status: 'active' } }
    export function beginBattleAttempt(state, stageNumber) { return { generation: state.generation + 1, stageNumber, status: 'active' } }
    export function markBattleAttemptCleared(state) { if (state.status !== 'active') return false; state.status = 'cleared'; return true }
    export function markBattleAttemptDefeated(state) { if (state.status !== 'active') return false; state.status = 'defeated'; return true }
    export function isBattleAttemptCallbackCurrent(state, generation, status) { return state.generation === generation && state.status === status }
    export function createBattleFreezeState() { return { frozen: false } }
    export function freezeBattle(state) { state.frozen = true }
    export function rebuildBattleFreeze(state) { state.frozen = false }
    export function canProcessBattleAction(state) { return !state.frozen }
    export function createContactDamageGate({ maxHealth }) { return { health: maxHealth, maxHealth, cooldown: 0, cooldownRemaining: 0 } }
    export function applyDirectDamage(gate, damage) { if (gate.health <= 0) return false; gate.health = Math.max(0, gate.health - damage); return true }
    export function createPerformanceBudget() { return {} }
    export function updateVfxQuality() { return 'full' }
    export function createStageSettlementState(generation) { return { generation, pending: false, settled: false } }
    export function scheduleBossSettlement() { return null }
    export function completeBossSettlement() { return false }
    export function createStageFlow(target, generation) { return { target, generation, phase: 'clearing' } }
    export function markPlayerDefeated(flow) { flow.phase = 'defeated'; return { changed: true } }
    export function createBattleRuntime(stage, heroAttack, options = {}) {
      calls.createRuntime.push({ stage: structuredClone(stage), heroAttack, options: structuredClone(options) })
      return {
        stage, heroAttack, spawnTimer: 0, spawnInterval: 1,
        defeatTarget: options.defeatTarget ?? 12, maxAliveEnemies: options.maxAlive ?? 18,
        nextEnemyId: 1, enemies: [], soulDrops: [], bossSpawned: false,
        stageCleared: false, stageClearClaimed: false,
      }
    }
    export function nextSpawn() { return { ok: false, enemy: null } }
    export function spawnBoss() { return { ok: false, enemy: null } }
    export function rollbackSpawnedEnemy(runtime, enemyId) {
      const index = runtime.enemies.findIndex((enemy) => enemy.id === enemyId)
      if (index < 0) return false
      runtime.enemies.splice(index, 1)
      return true
    }
    export function advanceOrdinaryDefeatFlow() { calls.worldAdvanceOrdinary += 1; return { retiredEnemyIds: [], bossSpawn: null } }
    export function advanceBossDefeatFlow() { calls.worldAdvanceBoss += 1; return { settle: true } }
    export function claimStageClear() { calls.worldClaim += 1; return { ok: true, result: { action: { kind: 'continue', stageId: 2 } } } }
    export function retryBossSpawnFlow() { return { bossSpawn: null } }
    export function applyFlyingSwordPathHit() { return { hitCount: 0, damageEvents: [], defeatedEnemyIds: [], stageClear: false } }
    export function segmentHitEnemiesAlongPath() { return [] }
    export function snapshotLivingSwordTargets(enemies) { return enemies }
    export function recordGeometricSwordHits() { return [] }
    export function stageProfileFromDesign() { throw new Error('not used') }
    export function stageVisualFor(stageId) { return { stageId, backgroundId: 'world', theme: 'world' } }
    export function feedbackFor() { return [] }
    export function createEnemyCombatResolverAdapter(generation) { return { generation } }
    export function resetEnemyCombatResolverAdapter(adapter, generation) { adapter.generation = generation; calls.resetResolver.push(generation) }
    export function pauseEnemyCombatResolverAdapter(_adapter, generation, paused) { calls.pauseResolver.push([generation, paused]) }
    export function removeEnemyCombatActor(_adapter, generation, enemyId) { calls.removeActor.push([generation, enemyId]) }
    export function cancelEnemyCombatActorAttacks() {}
    export function consumeEnemyCombatCommand() {}
    export function drainEnemyCombatDamage() { return [] }
    export function drainEnemyTelegraphs() { return [] }
    export function stepEnemyCombatResolverAdapter() {}
    export function upsertEnemyCombatActor() {}
    export function upsertPlayerCombatActor() {}
  `)
}

async function loadController() {
  const source = readFileSync(resolve('assets/Scripts/Game/BattleRuntimeController.ts'), 'utf8')
  const ccUrl = createCcModule()
  const dependencyUrl = createDependencyModule()
  let javascript = ts.transpileModule(source, {
    compilerOptions: {
      experimentalDecorators: true,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
  javascript = javascript
    .replaceAll("from 'cc'", `from '${ccUrl}'`)
    .replace(/from ['"]\.\.[^'"]+['"]/g, `from '${dependencyUrl}'`)
    .replace(/from ['"]\.[^'"]+['"]/g, `from '${dependencyUrl}'`)
  const [controllerModule, dependencies, cc] = await Promise.all([
    import(moduleUrl(javascript)),
    import(dependencyUrl),
    import(ccUrl),
  ])
  return { BattleRuntimeController: controllerModule.BattleRuntimeController, dependencies, cc }
}

function request(overrides = {}) {
  return {
    id: 'room:1',
    seed: 1,
    enemies: [profile('moss-wolf')],
    defeatTarget: 2,
    maxAlive: 5,
    boss: null,
    completion: 'clear-room',
    ...overrides,
  }
}

function fakeNode(id = 1) {
  return {
    id,
    activeInHierarchy: true,
    position: { x: 12, y: 34, z: 0, clone() { return { ...this } } },
    events: [],
    emit(name, ...args) { this.events.push([name, ...args]) },
    on() {}, off() {}, getComponent() { return null },
  }
}

function attachDefeatedEnemy(controller, enemyProfile, enemyId) {
  const enemy = {
    id: enemyId,
    profile: structuredClone(enemyProfile),
    hp: 0,
    position: { x: 12, y: 34 },
    radius: enemyProfile.role === 'boss' ? 70 : 34,
    alive: false,
    dropped: true,
  }
  const node = fakeNode(enemyId)
  controller.runtime.enemies.push(enemy)
  controller.enemyNodes.set(enemyId, node)
  controller.enemyByNode.set(node, enemy)
  controller.handleEnemyDefeat(enemyId)
  return { enemy, node }
}

function controllerHarness(Controller) {
  const controller = new Controller()
  const despawned = []
  const poolCalls = { soul: 0, damage: 0, boss: 0 }
  const telegraph = { hidden: 0, resets: [], cancelled: [], hideAll() { this.hidden += 1 }, resetGeneration(value) { this.resets.push(value) }, cancelEnemy(generation, id) { this.cancelled.push([generation, id]) } }
  controller.enemySpawner = {
    spawned: [],
    spawnEnemy(enemy) { const node = fakeNode(enemy.id); this.spawned.push([enemy, node]); return node },
    despawnEnemy(node) { despawned.push(node) },
    canSpawn() { return true },
  }
  controller.bossTelegraphPresenter = telegraph
  controller.soulOrbPool = { spawn() { return null }, despawnAll() { poolCalls.soul += 1 } }
  controller.damageNumberPool = { spawn() { return null }, despawnAll() { poolCalls.damage += 1 } }
  controller.bossSkillEffectPool = { despawnAll() { poolCalls.boss += 1 } }
  controller.stageClearPanel = {
    results: 0, defeats: 0,
    hide() {}, showResult() { this.results += 1 }, showDefeat() { this.defeats += 1 },
  }
  controller.hud = { updateStage() {}, updateSoul() {}, updateHero() {}, hideBoss() {}, showBoss() {} }
  controller.battleInput = { enabled: [], setInputEnabled(value) { this.enabled.push(value) } }
  controller.playerNode = {
    activeInHierarchy: true,
    position: { x: 0, y: 0 },
    events: [], emit(name, ...args) { this.events.push([name, ...args]) }, getComponent() { return null },
  }
  return { controller, despawned, poolCalls, telegraph }
}

test('begin passes limits into the shared battle runtime and rejects malformed requests atomically', async () => {
  const { BattleRuntimeController, dependencies } = await loadController()
  const { controller } = controllerHarness(BattleRuntimeController)
  const beforeGeneration = controller.stageGeneration

  assert.equal(controller.beginDungeonEncounter(request()), true)
  assert.deepEqual(dependencies.calls.createRuntime.at(-1).options, { defeatTarget: 2, maxAlive: 5 })
  assert.equal(controller.runtime.defeatTarget, 2)
  assert.equal(controller.runtime.maxAliveEnemies, 5)
  assert.equal(controller.isDungeonEncounterActive(), true)

  const activeRuntime = controller.runtime
  const activeGeneration = controller.stageGeneration
  assert.equal(controller.beginDungeonEncounter(request({ id: 'bad', maxAlive: 19 })), false)
  assert.equal(controller.runtime, activeRuntime)
  assert.equal(controller.stageGeneration, activeGeneration)
  assert.ok(activeGeneration > beforeGeneration)
})

test('ordinary dungeon completion fires exactly once with an isolated result', async () => {
  const { BattleRuntimeController } = await loadController()
  const { controller } = controllerHarness(BattleRuntimeController)
  const results = []
  controller.onDungeonEncounterCompleted = (result) => results.push(result)
  controller.beginDungeonEncounter(request())

  attachDefeatedEnemy(controller, profile('moss-wolf'), 11)
  assert.equal(results.length, 0)
  attachDefeatedEnemy(controller, profile('moss-wolf'), 12)
  const completion = controller._scheduled.at(-1).callback
  completion()
  completion()

  assert.equal(results.length, 1)
  assert.deepEqual(results[0], {
    requestId: 'room:1',
    completion: 'clear-room',
    defeatedEnemyIds: [11, 12],
  })
  assert.equal(controller.isDungeonEncounterActive(), false)
  results[0].defeatedEnemyIds.push(999)
  assert.deepEqual(controller.lastDungeonBattleResult?.defeatedEnemyIds ?? [11, 12], [11, 12])
})

test('pursuit and final boss return their requested completion without world settlement', async () => {
  const { BattleRuntimeController, dependencies } = await loadController()
  const { controller } = controllerHarness(BattleRuntimeController)
  const results = []
  controller.onDungeonEncounterCompleted = (result) => results.push(result)
  const boss = profile('mist-bamboo-emperor', 'boss')

  for (const completion of ['repel', 'kill']) {
    assert.equal(controller.beginDungeonEncounter(request({
      id: `boss:${completion}`,
      enemies: [],
      defeatTarget: 1,
      maxAlive: 1,
      boss,
      completion,
    })), true)
    const runtimeBoss = controller.runtime.enemies[0]
    runtimeBoss.alive = false
    runtimeBoss.dropped = true
    controller.handleEnemyDefeat(runtimeBoss.id)
    controller._scheduled.at(-1).callback()
  }

  assert.deepEqual(results.map((result) => result.completion), ['repel', 'kill'])
  assert.equal(dependencies.calls.worldAdvanceBoss, 0)
  assert.equal(dependencies.calls.worldClaim, 0)
  assert.equal(dependencies.calls.worldReward, 0)
  assert.equal(controller.stageClearPanel.results, 0)
})

test('changing rooms fully cleans the old generation and stale callbacks are ignored', async () => {
  const { BattleRuntimeController, dependencies, cc } = await loadController()
  const { controller, despawned, poolCalls, telegraph } = controllerHarness(BattleRuntimeController)
  const results = []
  controller.onDungeonEncounterCompleted = (result) => results.push(result)
  controller.beginDungeonEncounter(request({ defeatTarget: 1 }))
  const oldGeneration = controller.stageGeneration
  attachDefeatedEnemy(controller, profile('moss-wolf'), 21)
  const staleCompletion = controller._scheduled.at(-1).callback

  assert.equal(controller.beginDungeonEncounter(request({ id: 'room:2', seed: 2 })), true)
  assert.ok(controller.stageGeneration > oldGeneration)
  assert.ok(despawned.length >= 1)
  assert.equal(controller.enemyNodes.size, 0)
  assert.equal(controller.enemyByNode.size, 0)
  assert.ok(dependencies.calls.resetResolver.includes(controller.stageGeneration))
  assert.ok(telegraph.hidden >= 1)
  assert.ok(poolCalls.soul >= 1 && poolCalls.damage >= 1 && poolCalls.boss >= 1)
  assert.ok(cc.ccCalls.unschedule >= 1)

  staleCompletion()
  assert.deepEqual(results, [])

  const generationBeforeWrongCancel = controller.stageGeneration
  assert.equal(controller.cancelDungeonEncounter('wrong-id'), false)
  assert.equal(controller.stageGeneration, generationBeforeWrongCancel)
  assert.equal(controller.cancelDungeonEncounter('room:2'), true)
  assert.equal(controller.isDungeonEncounterActive(), false)
})

test('dungeon defeat emits authority event without a world defeat panel', async () => {
  const { BattleRuntimeController } = await loadController()
  const { controller } = controllerHarness(BattleRuntimeController)
  controller.beginDungeonEncounter(request())
  controller.damageGate.health = 1
  controller.applyResolvedPlayerDamage(10)

  assert.equal(controller.playerNode.events.some(([name]) => name === 'player-defeated'), true)
  for (const scheduled of [...controller._scheduled]) scheduled.callback()
  assert.equal(controller.stageClearPanel.defeats, 0)
})

test('controller exposes only the four approved dungeon integration APIs', () => {
  const source = readFileSync(resolve('assets/Scripts/Game/BattleRuntimeController.ts'), 'utf8')
  for (const marker of [
    'beginDungeonEncounter(request:',
    'cancelDungeonEncounter(requestId:',
    'isDungeonEncounterActive()',
    'onDungeonEncounterCompleted:',
  ]) assert.equal(source.includes(marker), true, `missing ${marker}`)
  assert.match(source, /if \(this\.activeDungeonRequest\)[\s\S]*nextSpawn/)
  assert.match(source, /if \(this\.activeDungeonRequest\)[\s\S]*completeDungeonEncounter/)
  assert.match(source, /if \(this\.activeDungeonRequest\)[\s\S]*player-defeated/)
})
