import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import ts from 'typescript'

const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const clone = (value) => JSON.parse(JSON.stringify(value))

async function loadController() {
  const ccUrl = moduleUrl(`
    export class Component { constructor() { this.node = { emit() {} } } }
    export class JsonAsset {}
    export class Label { constructor() { this.string = '' } }
    export const _decorator = {
      ccclass: () => (value) => value,
      property: () => () => undefined,
    }
  `)
  const sessionUrl = pathToFileURL(resolve('assets/Scripts/Core/Dungeon/DungeonSession.ts')).href
  const notificationUrl = pathToFileURL(resolve('assets/Scripts/Core/Progression/BestEffortNotification.ts')).href
  const source = readFileSync(resolve('assets/Scripts/Game/DungeonRunController.ts'), 'utf8')
  let javascript = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, experimentalDecorators: true },
  }).outputText
  javascript = javascript
    .replace("from 'cc'", `from '${ccUrl}'`)
    .replace("from '../Core/Dungeon/DungeonSession.ts'", `from '${sessionUrl}'`)
    .replace("from '../Core/Progression/BestEffortNotification.ts'", `from '${notificationUrl}'`)
  return import(moduleUrl(javascript))
}

function loadProfile() {
  return JSON.parse(readFileSync(resolve('assets/resources/Data/dual-mode-slice.json'), 'utf8'))
}

function createReadyController(DungeonRunController) {
  const controller = new DungeonRunController()
  controller.profileData = { json: loadProfile() }
  return controller
}

test('controller exposes the Task 7 dungeon session port after profile data is ready', async () => {
  const { DungeonRunController } = await loadController()
  const controller = new DungeonRunController()
  assert.equal(controller.isReady(), false)
  controller.profileData = { json: loadProfile() }
  assert.equal(controller.isReady(), true)
  assert.equal(controller.begin(17), true)
  const checkpoint = controller.checkpoint()
  assert.equal(checkpoint.runId, 'mist-vault-17')

  const restored = createReadyController(DungeonRunController)
  assert.equal(restored.restore(checkpoint), true)
  assert.deepEqual(restored.checkpoint(), checkpoint)
  checkpoint.map.revealedRoomIds.push('forged-room')
  assert.equal(restored.checkpoint().map.revealedRoomIds.includes('forged-room'), false)
})

test('commands commit only after one authoritative checkpoint callback accepts the candidate', async () => {
  const { DungeonRunController } = await loadController()
  const controller = createReadyController(DungeonRunController)
  assert.equal(controller.begin(3), true)
  const before = controller.checkpoint()
  const attempts = []
  controller.onCheckpoint = (checkpoint) => {
    attempts.push(clone(checkpoint))
    checkpoint.doorCurrency = 999
    return false
  }

  const rejected = controller.applyCommand({ type: 'choose-exit', exitId: 'f1-entry-to-forest' })
  assert.equal(rejected.accepted, false)
  assert.equal(rejected.reason, 'checkpoint-rejected')
  assert.deepEqual(controller.checkpoint(), before)
  assert.equal(attempts.length, 1)

  controller.onCheckpoint = (checkpoint) => {
    attempts.push(clone(checkpoint))
    return true
  }
  const accepted = controller.applyCommand({ type: 'choose-exit', exitId: 'f1-entry-to-forest' })
  assert.equal(accepted.accepted, true)
  assert.equal(controller.checkpoint().map.currentRoomId, 'f1-forest-combat')
  assert.equal(attempts.length, 2)
})

test('run events are immutable notifications and pressure pauses under map, choice, or component pause', async () => {
  const { DungeonRunController } = await loadController()
  const controller = createReadyController(DungeonRunController)
  assert.equal(controller.begin(5), true)
  controller.onCheckpoint = () => true
  const notified = []
  controller.onRunEvent = (event) => {
    notified.push(clone(event))
    if ('roomId' in event) event.roomId = 'forged-room'
    if ('loot' in event && event.loot[0]) event.loot[0].amount = 999
  }
  controller.applyCommand({ type: 'choose-exit', exitId: 'f1-entry-to-forest' })
  controller.applyCommand({ type: 'search' })
  assert.equal(controller.checkpoint().map.currentRoomId, 'f1-forest-combat')
  assert.deepEqual(controller.checkpoint().carriedLoot, [{ itemId: 'spirit-ore', amount: 2 }])
  assert.equal(notified.some((event) => event.type === 'room-entered'), true)
  assert.equal(notified.some((event) => event.type === 'room-searched'), true)

  const elapsed = () => controller.checkpoint().pressure.elapsedSeconds
  const initial = elapsed()
  controller.setMapOverlayOpen(true)
  controller.update(1)
  assert.equal(elapsed(), initial)
  controller.setMapOverlayOpen(false)
  controller.setChoiceOverlayOpen(true)
  controller.update(1)
  assert.equal(elapsed(), initial)
  controller.setChoiceOverlayOpen(false)
  controller.setPaused(true)
  controller.update(1)
  assert.equal(elapsed(), initial)
  controller.setPaused(false)
  controller.update(1)
  assert.ok(elapsed() > initial)
})

test('sixty smooth frames advance pressure in memory with a bounded checkpoint cadence', async () => {
  const { DungeonRunController } = await loadController()
  const controller = createReadyController(DungeonRunController)
  assert.equal(controller.begin(31), true)
  const checkpoints = []
  controller.onCheckpoint = (checkpoint) => {
    checkpoints.push(clone(checkpoint))
    return true
  }
  for (let frame = 0; frame < 60; frame += 1) controller.update(1 / 60)
  assert.ok(Math.abs(controller.checkpoint().pressure.elapsedSeconds - 1) < 0.000001)
  assert.ok(checkpoints.length >= 1)
  assert.ok(checkpoints.length <= 3, `checkpoint count ${checkpoints.length}`)
})

test('checkpoint cadence retries a failed due frame without assigning its candidate', async () => {
  const { DungeonRunController } = await loadController()
  const controller = createReadyController(DungeonRunController)
  assert.equal(controller.begin(32), true)
  let accepts = false
  let attempts = 0
  controller.onCheckpoint = () => {
    attempts += 1
    return accepts
  }
  for (let frame = 0; frame < 29; frame += 1) controller.update(1 / 60)
  const beforeDueFrame = controller.checkpoint().pressure.elapsedSeconds
  controller.update(1 / 60)
  assert.equal(attempts, 1)
  assert.equal(controller.checkpoint().pressure.elapsedSeconds, beforeDueFrame)
  accepts = true
  controller.update(1 / 60)
  assert.equal(attempts, 2)
  assert.ok(controller.checkpoint().pressure.elapsedSeconds > beforeDueFrame)
})

test('run events bypass cadence and checkpoint immediately', async () => {
  const { DungeonRunController } = await loadController()
  const source = createReadyController(DungeonRunController)
  assert.equal(source.begin(33), true)
  const checkpoint = source.checkpoint()
  checkpoint.pressure.elapsedSeconds = 119.95
  const controller = createReadyController(DungeonRunController)
  assert.equal(controller.restore(checkpoint), true)
  const saved = []
  const events = []
  controller.onCheckpoint = (value) => { saved.push(clone(value)); return true }
  controller.onRunEvent = (event) => events.push(clone(event))
  controller.update(0.1)
  assert.equal(saved.length, 1)
  assert.equal(saved[0].pressure.phase, 'restless')
  assert.equal(events.some((event) => event.type === 'pressure-phase-changed'), true)
})

test('map, choice, and component pause reject every command and battle mutation', async () => {
  const { DungeonRunController } = await loadController()
  const controller = createReadyController(DungeonRunController)
  assert.equal(controller.begin(34), true)
  controller.onCheckpoint = () => true
  const pauseModes = [
    ['map', (value) => controller.setMapOverlayOpen(value)],
    ['choice', (value) => controller.setChoiceOverlayOpen(value)],
    ['component', (value) => controller.setPaused(value)],
  ]
  for (const [name, setPaused] of pauseModes) {
    setPaused(true)
    const before = controller.checkpoint()
    assert.equal(controller.applyCommand({ type: 'search' }).reason, 'paused', name)
    assert.equal(controller.handleEffectiveDamage({ sourceRole: 'boss', effectiveDamage: 10 }).reason, 'paused', name)
    assert.equal(controller.handleBattleCompleted({ type: 'player-defeated' }).reason, 'paused', name)
    assert.deepEqual(controller.checkpoint(), before, name)
    setPaused(false)
  }
})

test('effective elite damage interrupts extraction atomically and battle damage targets the pursuer', async () => {
  const { DungeonRunController } = await loadController()
  const controller = createReadyController(DungeonRunController)
  controller.onCheckpoint = () => true
  assert.equal(controller.begin(9), true)
  for (const exitId of ['f1-entry-to-forest', 'f1-forest-to-floor2', 'f2-bridge-to-exit']) {
    assert.equal(controller.applyCommand({ type: 'choose-exit', exitId }).accepted, true)
  }
  assert.equal(controller.applyCommand({ type: 'begin-extraction' }).accepted, true)
  assert.equal(controller.checkpoint().phase, 'extracting')
  assert.equal(controller.handleEffectiveDamage({ sourceRole: 'ordinary', effectiveDamage: 10 }).accepted, false)
  assert.equal(controller.checkpoint().phase, 'extracting')
  assert.equal(controller.handleEffectiveDamage({ sourceRole: 'elite', effectiveDamage: 0 }).accepted, false)
  assert.equal(controller.checkpoint().phase, 'extracting')
  assert.equal(controller.handleEffectiveDamage({ sourceRole: 'elite', effectiveDamage: 10 }).accepted, true)
  assert.equal(controller.checkpoint().phase, 'exploring')

  for (let index = 0; index < 1201; index += 1) controller.update(0.1)
  assert.equal(controller.checkpoint().pursuer.phase, 'first-hunt')
  const beforeShield = controller.checkpoint().pursuer.shield
  const hit = controller.handleBattleCompleted({ type: 'pursuer-damage', effectiveDamage: 20 })
  assert.equal(hit.accepted, true)
  assert.ok(controller.checkpoint().pursuer.shield < beforeShield)
})

test('terminal extraction is manually acknowledged and carries a cloned authoritative result', async () => {
  const { DungeonRunController } = await loadController()
  const controller = createReadyController(DungeonRunController)
  controller.onCheckpoint = () => true
  assert.equal(controller.begin(11), true)
  for (const exitId of ['f1-entry-to-forest', 'f1-forest-to-floor2', 'f2-bridge-to-exit']) {
    controller.applyCommand({ type: 'choose-exit', exitId })
  }
  controller.applyCommand({ type: 'begin-extraction' })
  const terminal = []
  const notified = []
  controller.onRunEvent = (event) => notified.push(clone(event))
  controller.onTerminalResult = (result) => {
    terminal.push(clone(result))
    result.loot.push({ itemId: 'forged', amount: 99 })
    return false
  }
  for (let index = 0; index < 40; index += 1) controller.update(0.1)
  assert.equal(controller.checkpoint().phase, 'extracted')
  assert.equal(controller.hasRun(), true)
  assert.equal(terminal.length, 0)
  assert.equal(notified.some((event) => event.type === 'extraction-completed'), true)
  assert.equal(controller.acknowledgeTerminalResult(), false)
  assert.equal(terminal.length, 1)
  assert.equal(controller.hasRun(), true)

  controller.onTerminalResult = () => true
  assert.equal(controller.acknowledgeTerminalResult(), true)
  assert.equal(controller.hasRun(), false)
})

test('pending extraction settlement locks every late gameplay mutation until acknowledgement', async () => {
  const { DungeonRunController } = await loadController()
  const controller = createReadyController(DungeonRunController)
  const saved = []
  controller.onCheckpoint = (checkpoint) => {
    saved.push(clone(checkpoint))
    return true
  }
  assert.equal(controller.begin(35), true)
  for (const exitId of ['f1-entry-to-forest', 'f1-forest-to-floor2', 'f2-bridge-to-exit']) {
    assert.equal(controller.applyCommand({ type: 'choose-exit', exitId }).accepted, true)
  }
  assert.equal(controller.applyCommand({ type: 'begin-extraction' }).accepted, true)
  for (let index = 0; index < 40; index += 1) controller.update(0.1)

  const terminalCheckpoint = controller.checkpoint()
  const saveCount = saved.length
  assert.equal(terminalCheckpoint.phase, 'extracted')
  const lateMutations = [
    controller.handleBattleCompleted({ type: 'player-defeated' }),
    controller.handleBattleCompleted({ type: 'pursuer-damage', effectiveDamage: 40 }),
    controller.applyCommand({ type: 'abandon' }),
    controller.handleEffectiveDamage({ sourceRole: 'boss', effectiveDamage: 25 }),
  ]
  for (const result of lateMutations) {
    assert.deepEqual(result, { accepted: false, reason: 'terminal-pending', events: [] })
    assert.deepEqual(controller.checkpoint(), terminalCheckpoint)
  }
  controller.update(1)
  assert.deepEqual(controller.checkpoint(), terminalCheckpoint)
  assert.equal(saved.length, saveCount)

  const delivered = []
  controller.onTerminalResult = (result) => {
    delivered.push(clone(result))
    return true
  }
  assert.equal(controller.acknowledgeTerminalResult(), true)
  assert.deepEqual(delivered, [{
    type: 'dungeon-extracted',
    runId: terminalCheckpoint.runId,
    loot: terminalCheckpoint.carriedLoot,
    exitKind: terminalCheckpoint.extraction.roomId === loadProfile().finalExtractionRoomId ? 'full' : 'damaged',
    explorationRate: Number((new Set(terminalCheckpoint.map.revealedRoomIds).size / loadProfile().rooms.length).toFixed(6)),
    bossDefeated: false,
  }])
  assert.equal(controller.hasRun(), false)
})

test('dual-mode controller uses V4 storage, binds checkpoint and terminal callbacks, and repairs failed restore', () => {
  const source = readFileSync(resolve('assets/Scripts/Game/DualModeGameController.ts'), 'utf8')
  assert.match(source, /cultivation-save-v4/)
  assert.match(source, /cultivation-save-v3/)
  assert.match(source, /onCheckpoint/)
  assert.match(source, /onTerminalResult/)
  assert.match(source, /recoverDungeonRestoreFailure/)
  assert.match(source, /handleDungeonCheckpoint/)
  assert.match(source, /handleDungeonDefeated/)
  assert.match(source, /handleDungeonAbandoned/)
})
