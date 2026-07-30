import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const base64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function compressScriptUuid(uuid) {
  const hex = uuid.replaceAll('-', '')
  let compressed = hex.slice(0, 5)
  for (let index = 5; index < hex.length; index += 3) {
    const value = Number.parseInt(hex.slice(index, index + 3), 16)
    compressed += base64[value >> 6] + base64[value & 63]
  }
  return compressed
}

test('scene assembly guide documents battle node bindings', () => {
  const guide = readFileSync(resolve('docs/scene-assembly.md'), 'utf8')

  for (const marker of [
    'BattleRuntimeController',
    'StageClearPanelController',
    'NodePoolController',
    'stageClearPanel',
    'bossSkillEffectPool',
    'damageNumberPool',
    'soulOrbPool',
    'FlyingSwordSkill',
    'battleRuntime',
    'sword',
    'advanceToNextStageFromPanel',
  ]) {
    assert.equal(guide.includes(marker), true, `scene assembly guide should mention ${marker}`)
  }
})

test('main battle serializes PortraitBattleBootstrap on the existing BattleRoot', () => {
  const scene = JSON.parse(readFileSync(resolve('assets/Scenes/MainBattle.scene'), 'utf8'))
  const metaPath = resolve('assets/Scripts/Game/PortraitBattleBootstrap.ts.meta')
  assert.equal(existsSync(metaPath), true, 'PortraitBattleBootstrap.ts.meta should exist')

  const scriptUuid = JSON.parse(readFileSync(metaPath, 'utf8')).uuid
  const battleRootIndex = scene.findIndex((entry) => entry?.__type__ === 'cc.Node' && entry._name === 'BattleRoot')
  assert.notEqual(battleRootIndex, -1, 'existing BattleRoot node should remain in the scene')

  const componentIds = scene[battleRootIndex]._components.map((component) => component.__id__)
  const classId = compressScriptUuid(scriptUuid)
  const bootstrap = componentIds.map((id) => scene[id]).find((component) => component?.__type__ === classId)
  assert.ok(bootstrap, `BattleRoot should reference PortraitBattleBootstrap class ID ${classId}`)
  assert.deepEqual(bootstrap.node, { __id__: battleRootIndex })
})

test('main battle serializes stable dual-mode dungeon markers with world active', () => {
  const scene = JSON.parse(readFileSync(resolve('assets/Scenes/MainBattle.scene'), 'utf8'))
  const nodes = new Map(
    scene
      .map((entry, index) => [entry, index])
      .filter(([entry]) => entry?.__type__ === 'cc.Node')
      .map(([entry, index]) => [entry._name, { entry, index }]),
  )

  for (const name of [
    'DualModeGameController',
    'WorldRoot',
    'DungeonRoot',
    'DungeonFloor1',
    'DungeonFloor2',
    'DungeonFloor3',
    'DungeonRoomLabel',
    'DungeonInteractButton',
  ]) {
    assert.ok(nodes.has(name), `MainBattle.scene should serialize ${name}`)
  }

  const sceneRoot = scene[1]
  const worldRoot = nodes.get('WorldRoot')
  const dungeonRoot = nodes.get('DungeonRoot')
  assert.equal(worldRoot.entry._active, true)
  assert.equal(dungeonRoot.entry._active, false)
  assert.deepEqual(worldRoot.entry._parent, { __id__: 1 })
  assert.deepEqual(dungeonRoot.entry._parent, { __id__: 1 })
  assert.ok(sceneRoot._children.some((child) => child.__id__ === worldRoot.index))
  assert.ok(sceneRoot._children.some((child) => child.__id__ === dungeonRoot.index))

  for (const name of ['DungeonFloor1', 'DungeonFloor2', 'DungeonFloor3', 'DungeonRoomLabel', 'DungeonInteractButton']) {
    assert.deepEqual(nodes.get(name).entry._parent, { __id__: dungeonRoot.index }, `${name} should be under DungeonRoot`)
  }
})

test('scene blueprint documents runtime-owned dual-mode dungeon assembly', () => {
  const blueprint = JSON.parse(readFileSync(resolve('assets/Data/scene-blueprint.json'), 'utf8'))
  const byPath = new Map(blueprint.nodes.map((node) => [node.path, node]))

  assert.equal(blueprint.scene.notes.includes('runtime authority'), true)
  assert.equal(byPath.get('Canvas').children.includes('WorldRoot'), true)
  assert.equal(byPath.get('Canvas').children.includes('DungeonRoot'), true)
  assert.deepEqual(byPath.get('Canvas/WorldRoot').bindings.dualModeController, 'Canvas/DualModeGameController')
  assert.equal(byPath.get('Canvas/DungeonRoot').active, false)
  assert.deepEqual(byPath.get('Canvas/DungeonRoot').children, [
    'DungeonFloor1',
    'DungeonFloor2',
    'DungeonFloor3',
    'DungeonRoomLabel',
    'DungeonStatusLabel',
    'DungeonInteractButton',
    'DungeonRunController',
  ])
  assert.deepEqual(byPath.get('Canvas/WorldRoot/BattleRoot/HudLayer/StageClearPanel').size, { width: 472, height: 214 })
  assert.equal(byPath.get('Canvas/WorldRoot/BattleRoot/HudLayer/BottomNavigation/DungeonEntryButton').components.includes('Button'), true)
  assert.equal(byPath.get('Canvas/DungeonRoot/DungeonInteractButton').components.includes('Button'), true)
  assert.deepEqual(byPath.get('Canvas/DualModeGameController').bindings, {
    worldRoot: 'Canvas/WorldRoot',
    dungeonRoot: 'Canvas/DungeonRoot',
    dungeonRun: 'Canvas/DungeonRoot/DungeonRunController',
  })
})

test('scene blueprint documents the runtime-owned world stage selection page', () => {
  const blueprint = JSON.parse(readFileSync(resolve('assets/Data/scene-blueprint.json'), 'utf8'))
  const byPath = new Map(blueprint.nodes.map((node) => [node.path, node]))
  const root = byPath.get('Canvas/WorldRoot/WorldStageSelectRoot')
  const header = byPath.get('Canvas/WorldRoot/WorldStageSelectRoot/WorldStageHeader')
  const grid = byPath.get('Canvas/WorldRoot/WorldStageSelectRoot/WorldStageGrid')

  assert.equal(root.active, false)
  assert.equal(root.runtimeGenerated, true)
  assert.deepEqual(root.children, ['WorldStageHeader', 'WorldStageGrid', 'WorldStageStatusLabel'])
  assert.equal(header.children.includes('WorldStageCloseButton'), true)
  assert.deepEqual(grid.children, Array.from({ length: 10 }, (_, index) => `WorldStageItem${index + 1}`))
  assert.equal(byPath.get('Canvas/WorldRoot/BattleRoot/HudLayer/BottomNavigation/WorldStageEntryButton').components.includes('Button'), true)

  for (let stageId = 1; stageId <= 10; stageId += 1) {
    const item = byPath.get(`Canvas/WorldRoot/WorldStageSelectRoot/WorldStageGrid/WorldStageItem${stageId}`)
    assert.equal(item.components.includes('Button'), true)
    assert.equal(item.size.height, 132)
    assert.ok(item.cornerRadius <= 8)
  }

  const serializedNames = new Set(
    JSON.parse(readFileSync(resolve('assets/Scenes/MainBattle.scene'), 'utf8'))
      .filter((entry) => entry?.__type__ === 'cc.Node')
      .map((entry) => entry._name),
  )
  assert.equal(serializedNames.has('WorldStageSelectRoot'), false)
  assert.match(blueprint.scene.notes, /WorldStageSelectRoot.*runtime-generated/)
})

test('resources Data copies deep-equal their authority JSON files', () => {
  for (const file of ['cultivation-design.json', 'animation-atlas.json']) {
    const authority = JSON.parse(readFileSync(resolve('assets/Data', file), 'utf8'))
    const resourcePath = resolve('assets/resources/Data', file)
    assert.equal(existsSync(resourcePath), true, `resources/Data/${file} should exist`)
    assert.deepEqual(JSON.parse(readFileSync(resourcePath, 'utf8')), authority)
  }
})

test('portrait bootstrap fills the visible height without stretching the whole scene', () => {
  const source = readFileSync(resolve('assets/Scripts/Game/PortraitBattleBootstrap.ts'), 'utf8')

  assert.match(source, /computeBattleViewportState\(/)
  assert.match(source, /const visibleHeight = layout\.visibleHeight/)
  assert.match(source, /const backgroundScale = visibleHeight \/ HEIGHT/)
  assert.match(source, /const backgroundWidth = WIDTH \* backgroundScale/)
  assert.match(source, /createNode\('Canvas', this\.node, WIDTH, visibleHeight\)/)
  assert.match(source, /configureInputLayer\(inputLayer, layout\)/)
  assert.match(source, /topHud\.setPosition\(0, this\.topHudY\(layout\), 0\)/)
  assert.match(source, /const dungeonEntryLayout = computeDungeonEntryNavLayout\(layout\.navigationTop, NAV_HEIGHT\)/)
  assert.match(source, /bottomNavigation\.setPosition\(0, dungeonEntryLayout\.navigation\.centerY, 0\)/)
  assert.doesNotMatch(source, /setScale\([^,]+,\s*visibleHeight \/ HEIGHT/)
})

test('portrait bootstrap relayouts visible-height UI when the canvas resizes', () => {
  const source = readFileSync(resolve('assets/Scripts/Game/PortraitBattleBootstrap.ts'), 'utf8')

  assert.match(source, /view\.on\('canvas-resize',\s*this\.onCanvasResize,\s*this\)/)
  assert.match(source, /view\.off\('canvas-resize',\s*this\.onCanvasResize,\s*this\)/)
  assert.match(source, /createDefaultViewportMetricsProvider\(/)
  assert.match(source, /const initialMetrics = this\.viewportMetricsProvider\.read\(\)/)
  assert.match(source, /const initialLayout = this\.applyViewportMetrics\(initialMetrics\)/)
  assert.match(source, /this\.assembleScene\(initialLayout\)/)
  assert.match(source, /this\.viewportMetricsProvider\.subscribe\(\(metrics\) => this\.relayoutVisibleArea\(metrics\)\)/)
  assert.match(source, /this\.viewportMetricsCleanup\?\.\(\)/)
  assert.match(source, /this\.viewportMetricsProvider\?\.destroy\(\)/)
  assert.match(source, /private appliedLayout: BattleLayout \| null = null/)
  assert.match(source, /private relayoutVisibleArea\(metrics: Readonly<ViewportMetrics>\)/)
  assert.match(source, /const layout = this\.applyViewportMetrics\(metrics\)/)
  assert.match(source, /private onCanvasResize\(\)[\s\S]*const metrics = this\.viewportMetricsProvider\?\.read\(\)[\s\S]*this\.relayoutVisibleArea\(metrics\)/)
  assert.match(source, /computeBattleViewportState\(\{/)
  assert.match(source, /previousMode: this\.resolutionMode \?\? undefined/)
  assert.match(source, /previousLayout: this\.appliedLayout/)
  assert.match(source, /this\.resolutionMode = state\.resolution\.mode/)
  assert.match(source, /this\.appliedLayout = state\.layout/)
  assert.match(source, /for \(const node of this\.fullHeightNodes\)/)
  assert.match(source, /this\.resizeNode\(node, WIDTH, visibleHeight\)/)
  assert.match(source, /this\.resizeNode\(this\.farBackground, backgroundWidth, visibleHeight\)/)
  assert.match(source, /this\.resizeNode\(this\.midBackground, backgroundWidth, visibleHeight\)/)
  assert.match(source, /this\.configureInputLayer\(this\.inputLayer, layout\)/)
  assert.match(source, /this\.topHud\?\.setPosition\(0, this\.topHudY\(layout\), 0\)/)
  assert.match(source, /this\.bossHud\?\.setPosition\(0, this\.bossHudY\(layout\), 0\)/)
  assert.match(source, /this\.bottomNavigation\?\.setPosition\(0, layout\.navigationTop - NAV_HEIGHT \/ 2, 0\)/)
  assert.match(source, /this\.playerController\?\.configureBounds\(layout\.movement\)/)
  assert.match(source, /this\.battleInput\?\.configure\(layout\.movement, this\.movementCoordinateSpace\)/)
  assert.doesNotMatch(source, /resizeNode\(this\.player/)
  const relayoutBody = source.match(/private relayoutVisibleArea\(metrics: Readonly<ViewportMetrics>\) \{([\s\S]*?)\n  \}/)?.[1] ?? ''
  const applyMetricsBody = source.match(/private applyViewportMetrics\(metrics: Readonly<ViewportMetrics>\): BattleLayout \{([\s\S]*?)\n  \}/)?.[1] ?? ''
  assert.doesNotMatch(relayoutBody, /\.read\(\)/)
  assert.doesNotMatch(applyMetricsBody, /\.read\(\)/)
  assert.equal((source.match(/viewportMetricsProvider(?:\?\.|\.)read\(\)/g) ?? []).length, 2)
})

test('portrait bootstrap routes all animation requests through the player controller arbiter', () => {
  const source = readFileSync(resolve('assets/Scripts/Game/PortraitBattleBootstrap.ts'), 'utf8')
  const skillSource = readFileSync(resolve('assets/Scripts/Game/FlyingSwordSkill.ts'), 'utf8')

  assert.match(source, /player\.node\.on\('player-animation-requested',\s*\(action: string\) => animator\.play\(action\)/)
  assert.match(source, /createFlyingSword\(effectLayer, runtime, controller/)
  assert.match(source, /skillNode\.on\('player-action-requested',[\s\S]*controller\.requestPresentationAction\(action, 'flying-sword'\)/)
  assert.match(source, /skillNode\.on\('player-action-completed',[\s\S]*controller\.completePresentationAction\(/)
  assert.doesNotMatch(source, /skillNode\.on\('player-action-requested',[\s\S]{0,100}animator\.play/)
  assert.match(skillSource, /this\.node\.emit\('player-action-requested', command\.action\)/)
})

test('portrait bootstrap uses centralized layout dimensions for player and navigation visuals', () => {
  const source = readFileSync(resolve('assets/Scripts/Game/PortraitBattleBootstrap.ts'), 'utf8')
  assert.match(source, /PLAYER_FRAME_WIDTH/)
  assert.match(source, /PLAYER_FRAME_HEIGHT/)
  assert.match(source, /PLAYER_DISPLAY_SCALE/)
  assert.match(source, /BATTLE_NAVIGATION_HEIGHT/)
  assert.match(source, /BATTLE_TOP_HUD_RESERVE/)
  assert.doesNotMatch(source, /const NAV_HEIGHT = 104|const TOP_HUD_RESERVE = 210/)
})

test('portrait bootstrap stops runtime binding after ready, failed, or destroyed states', () => {
  const source = readFileSync(resolve('assets/Scripts/Game/PortraitBattleBootstrap.ts'), 'utf8')

  assert.match(source, /type RuntimeLoadState =/)
  assert.match(source, /status: 'loading'/)
  assert.match(source, /status: 'ready'/)
  assert.match(source, /status: 'failed'/)
  assert.match(source, /if \(this\.destroyed \|\| state\.status === 'failed'\)/)
  assert.match(source, /if \(state\.status !== 'ready'\) return/)
  assert.match(source, /skill\.battleRuntime = state\.runtime/)
  assert.match(source, /private stopRuntimeBinding\(.*\)/)
  assert.match(source, /this\.unschedule\(bindRuntime\)/)
  assert.match(source, /onDestroy\(\)[\s\S]*this\.destroyed = true[\s\S]*this\.stopRuntimeBinding\(\)/)
})
