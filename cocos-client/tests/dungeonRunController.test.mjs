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
    export const extractRun = () => ({ ok: false, loot: [] })
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

test('throwing dungeon observers cannot change interaction results or block later notifications', async () => {
  const { DungeonRunController } = await loadController()
  const controller = new DungeonRunController()
  const attempted = []
  controller.node = {
    emit(eventName) {
      attempted.push(eventName)
      throw new Error(`observer failed for ${eventName}`)
    },
  }
  controller.profileData = { json: {} }
  assert.equal(controller.begin(1), true)

  const searched = { type: 'searched', roomId: 'entry', loot: [{ itemId: 'ore', amount: 1 }], doorCurrencyGranted: 1 }
  const moved = { type: 'moved', fromRoomId: 'entry', roomId: 'next' }
  globalThis.__dungeonInteractionResults = [searched, moved]

  assert.deepEqual(controller.interact(), searched)
  assert.deepEqual(controller.interact(), moved)
  assert.deepEqual(attempted, ['dungeon-run-began', 'dungeon-loot-found', 'dungeon-room-changed'])
  delete globalThis.__dungeonInteractionResults
})
