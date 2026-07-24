import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createDungeonSession, extractRun } from '../assets/Scripts/Core/Dungeon/DungeonSession.ts'
import { interactDungeonRun } from '../assets/Scripts/Core/Dungeon/DungeonInteraction.ts'
import { createDualModeRuntime } from '../assets/Scripts/Core/Progression/DualModeRuntime.ts'
import { createDefaultSave } from '../assets/Scripts/Core/Progression/PlayerSave.ts'

const read = (path) => readFileSync(resolve(path), 'utf8')

test('graybox controller wires the new battle core to cocos nodes', () => {
  const source = read('assets/Scripts/Game/GrayboxBattleController.ts')

  assert.match(source, /class GrayboxBattleController/)
  assert.match(source, /createBattleSession\(STAGE_ONE/)
  assert.match(source, /tickBattleSession\(this\.session, deltaTime\)/)
  assert.match(source, /Node\.EventType\.TOUCH_END/)
  assert.match(source, /convertToNodeSpaceAR/)
  assert.match(source, /setMoveTarget\(this\.session\.player/)
  assert.match(source, /requestSettleContinue/)
  assert.match(source, /Graphics/)
  assert.match(source, /update\(deltaTime: number\)/)
})

test('graybox controller renders telegraphs, settlement countdown, and defeat restart', () => {
  const source = read('assets/Scripts/Game/GrayboxBattleController.ts')

  assert.match(source, /drawTelegraphs/)
  assert.match(source, /sweepFan/)
  assert.match(source, /roarWave/)
  assert.match(source, /settleElapsed/)
  assert.match(source, /rebuildSession/)
  assert.match(source, /'settle'/)
  assert.match(source, /'defeated'/)
  assert.match(source, /'enemy-death'/)
})

test('portrait bootstrap assembles and wires the dungeon graybox through real Buttons', () => {
  const source = read('assets/Scripts/Game/PortraitBattleBootstrap.ts')

  for (const name of ['DungeonRoomLabel', 'DungeonStatusLabel', 'DungeonInteractButton', 'DungeonEntryButton']) {
    assert.match(source, new RegExp(`createNode\\('${name}'|createLabel\\('${name}'`), `missing ${name}`)
  }
  assert.match(source, /createDungeonFloor\(\s*dungeonRoot,\s*1,/)
  assert.match(source, /createDungeonFloor\(\s*dungeonRoot,\s*2,/)
  assert.match(source, /createDungeonFloor\(\s*dungeonRoot,\s*3,/)
  assert.match(source, /createNode\(`DungeonFloor\$\{floor\}`/)
  assert.match(source, /dungeonEntryNode\.addComponent\(Button\)/)
  assert.match(source, /dungeonInteractNode\.addComponent\(Button\)/)
  assert.match(source, /dungeonEntryNode\.on\(Button\.EventType\.CLICK,\s*this\.enterDungeonFromWorld,\s*this\)/)
  assert.match(source, /dungeonInteractNode\.on\(Button\.EventType\.CLICK,\s*this\.interactWithDungeon,\s*this\)/)
  assert.match(source, /dualModeController\?\.enterDungeon\(\)/)
  assert.match(source, /dungeonRun\.interact\(\)/)
  assert.match(source, /getRunSnapshot\(\)/)
  assert.match(source, /graphics\.clear\(\)/)
  assert.match(source, /graphics\.rect\(-WIDTH \/ 2, -visibleHeight \/ 2, WIDTH, visibleHeight\)/)
  assert.match(source, /dungeon-entry-rejected/)
  assert.match(source, /dungeonRun\.onRunChanged = this\.dungeonPresentationCallback/)
  assert.match(source, /visibleHeight/)
  assert.doesNotMatch(source, /document\.|window\.|querySelector|createElement/)
  assert.doesNotMatch(source, /applyWorldBossClear|consumeDungeonPass|applyExtractionLoot/)
  assert.doesNotMatch(source, /grantDoorCurrency|searchCurrentRoom|\.moveTo\(|doorCurrency\s*[+\-*/]?=|dungeonPasses\s*[+\-]=|carriedLoot\.push|inventory\.[a-zA-Z]+\s*[+\-]=/)
})

test('dungeon interaction authority exists in Core', () => {
  assert.equal(existsSync(resolve('assets/Scripts/Core/Dungeon/DungeonInteraction.ts')), true)
  const controller = read('assets/Scripts/Game/DungeonRunController.ts')
  assert.match(controller, /Core\/Dungeon\/DungeonInteraction/)
  assert.match(controller, /interactDungeonRun\(this\.run\)/)
  assert.doesNotMatch(controller, /grantDoorCurrency|doorCurrency\s*[+\-*/]?=/)
})

test('bootstrap refreshes dungeon UI through the direct controller callback, not analytics listener order', () => {
  const source = read('assets/Scripts/Game/PortraitBattleBootstrap.ts')

  assert.match(source, /dungeonRun\.onRunChanged = this\.dungeonPresentationCallback/)
  assert.match(source, /this\.refreshDungeonPresentation\([^)]*,\s*snapshot\)/)
  assert.match(source, /if \(this\.dungeonRunController\?\.onRunChanged === this\.dungeonPresentationCallback\)/)
  assert.doesNotMatch(source, /dungeonNode\.on\('dungeon-(?:run-began|room-changed|loot-found|extracted)'/)
})

test('dual and dungeon adapters stay isolated from legacy battle and new combat modules', () => {
  for (const file of [
    'assets/Scripts/Game/DungeonRunController.ts',
    'assets/Scripts/Game/DualModeGameController.ts',
    'assets/Scripts/Core/Dungeon/DungeonSession.ts',
    'assets/Scripts/Core/Progression/DualModeRuntime.ts',
  ]) {
    const source = read(file)
    assert.doesNotMatch(source, /Core\/Battle/)
    assert.doesNotMatch(source, /(?:\.\.\/)+Combat\//)
    assert.doesNotMatch(source, /document\.|window\.|querySelector|createElement/)
  }
})

test('world boss pass supports a searched three-floor extraction persisted exactly once', () => {
  const profile = JSON.parse(read('assets/resources/Data/dual-mode-slice.json'))
  let run = null
  const saved = []
  const dungeon = {
    hasRun: () => run !== null,
    currentRunId: () => run?.id ?? null,
    previewRunId: (seed) => createDungeonSession(profile, seed).id,
    begin(seed) {
      if (run) return false
      run = createDungeonSession(profile, seed)
      return true
    },
    cancelRun() {
      if (!run) return false
      run = null
      return true
    },
    isExtractedRun: (runId) => run?.id === runId && run.phase === 'extracted',
    extractedLoot: (runId) => run?.id === runId && run.phase === 'extracted'
      ? run.carriedLoot.map((item) => ({ ...item }))
      : null,
  }
  const runtime = createDualModeRuntime({
    initialSave: createDefaultSave(),
    repository: { load: () => null, save: (save) => saved.push(structuredClone(save)) },
    dungeon,
  })

  assert.equal(runtime.handleWorldCleared({ stage: 1, rewardId: 'world-boss-loop' }).ok, true)
  assert.equal(runtime.enterDungeon(88).ok, true)
  const visited = [run.currentRoomId]
  for (let click = 0; click < 20; click += 1) {
    const result = interactDungeonRun(run)
    assert.notEqual(result.type, 'blocked')
    if (result.type === 'moved') visited.push(result.roomId)
    if (result.type === 'extraction-requested') break
  }
  assert.deepEqual(visited, ['f1-entry', 'f1-combat', 'f1-store', 'f2-alchemy', 'f2-elite', 'f3-boss', 'f3-gate'])
  assert.equal(interactDungeonRun(run).type, 'extraction-requested')
  const extraction = extractRun(run)
  assert.equal(extraction.ok, true)
  const accepted = runtime.handleDungeonExtracted({ runId: run.id, loot: extraction.loot })
  assert.equal(accepted.ok, true)

  const save = runtime.getSaveSnapshot()
  assert.equal(save.inventory.artifacts['flying-sword'], 1)
  assert.equal(save.inventory.materials['spirit-ore'], 2)
  assert.equal(save.inventory.materials['mist-herb'], 2)
  assert.equal(save.rewardLedger.filter((id) => id === run.id).length, 1)
  assert.deepEqual(runtime.handleDungeonExtracted({ runId: run.id, loot: extraction.loot }), {
    ok: false,
    reason: 'no-active-run',
  })
  assert.equal(saved.length, 3)
})
