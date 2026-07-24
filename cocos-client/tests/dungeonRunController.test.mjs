import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import ts from 'typescript'

const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`

async function loadController() {
  const ccUrl = moduleUrl(`
    export class Component {}
    export class JsonAsset {}
    export class Label {}
    export const _decorator = {
      ccclass: () => (value) => value,
      property: () => () => undefined,
    }
  `)
  const sessionUrl = moduleUrl(`
    export const createDungeonSession = () => ({
      id: 'run-1',
      profile: { id: 'profile', entryRoomId: 'entry', extractionRoomId: 'gate', rooms: [] },
      phase: 'exploring',
      currentRoomId: 'entry',
      doorCurrency: 0,
      searchedRoomIds: [],
      carriedLoot: [],
    })
    export const extractRun = () => globalThis.__dungeonExtractionResult ?? ({ ok: false, loot: [] })
  `)
  const interactionUrl = moduleUrl(`
    export const interactDungeonRun = () => globalThis.__dungeonInteractionResults.shift()
  `)
  const notificationUrl = pathToFileURL(resolve('assets/Scripts/Core/Progression/BestEffortNotification.ts')).href
  const source = readFileSync(resolve('assets/Scripts/Game/DungeonRunController.ts'), 'utf8')
  let javascript = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      experimentalDecorators: true,
    },
  }).outputText
  javascript = javascript
    .replace("from 'cc'", `from '${ccUrl}'`)
    .replace("from '../Core/Dungeon/DungeonSession.ts'", `from '${sessionUrl}'`)
    .replace("from '../Core/Dungeon/DungeonInteraction.ts'", `from '${interactionUrl}'`)
    .replace("from '../Core/Progression/BestEffortNotification.ts'", `from '${notificationUrl}'`)
  return import(moduleUrl(javascript))
}

test('throwing presentation and analytics observers cannot change committed interaction results', async () => {
  const { DungeonRunController } = await loadController()
  const controller = new DungeonRunController()
  const attempted = []
  const timeline = []
  controller.node = {
    emit(eventName) {
      attempted.push(eventName)
      timeline.push(`analytics:${eventName}`)
      throw new Error(`observer failed for ${eventName}`)
    },
  }
  controller.profileData = { json: {} }
  const presentationChanges = []
  controller.onRunChanged = (snapshot, change) => {
    presentationChanges.push({ hasSnapshot: snapshot !== null, type: change.type })
    timeline.push(`presentation:${change.type}`)
    if (snapshot) snapshot.doorCurrency = 999
    if (change.type === 'searched' && change.loot[0]) change.loot[0].amount = 999
    throw new Error(`presentation failed for ${change.type}`)
  }
  assert.equal(controller.begin(1), true)

  const searched = { type: 'searched', roomId: 'entry', loot: [{ itemId: 'ore', amount: 1 }], doorCurrencyGranted: 1 }
  const moved = { type: 'moved', fromRoomId: 'entry', roomId: 'next' }
  globalThis.__dungeonInteractionResults = [searched, moved]

  assert.deepEqual(controller.interact(), searched)
  assert.deepEqual(controller.interact(), moved)
  assert.deepEqual(searched.loot, [{ itemId: 'ore', amount: 1 }])
  assert.equal(controller.cancelRun(), true)
  assert.equal(controller.begin(2), true)
  globalThis.__dungeonExtractionResult = { ok: true, loot: [{ itemId: 'ore', amount: 1 }] }
  controller.onExtractionRequested = () => true
  assert.equal(controller.extract(), true)
  assert.deepEqual(attempted, [
    'dungeon-run-began',
    'dungeon-loot-found',
    'dungeon-room-changed',
    'dungeon-run-began',
    'dungeon-extracted',
  ])
  assert.deepEqual(presentationChanges, [
    { hasSnapshot: true, type: 'began' },
    { hasSnapshot: true, type: 'searched' },
    { hasSnapshot: true, type: 'moved' },
    { hasSnapshot: false, type: 'cancelled' },
    { hasSnapshot: true, type: 'began' },
    { hasSnapshot: false, type: 'extracted' },
  ])
  assert.ok(timeline.indexOf('presentation:searched') < timeline.indexOf('analytics:dungeon-loot-found'))
  assert.ok(timeline.indexOf('presentation:moved') < timeline.indexOf('analytics:dungeon-room-changed'))
  assert.ok(timeline.indexOf('presentation:extracted') < timeline.indexOf('analytics:dungeon-extracted'))
  delete globalThis.__dungeonInteractionResults
  delete globalThis.__dungeonExtractionResult
})
