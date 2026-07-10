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

  assert.match(source, /const visibleSize = view\.getVisibleSize\(\)/)
  assert.match(source, /const visibleHeight = Math\.max\(HEIGHT, visibleSize\.height\)/)
  assert.match(source, /const backgroundScale = visibleHeight \/ HEIGHT/)
  assert.match(source, /const backgroundWidth = WIDTH \* backgroundScale/)
  assert.match(source, /createNode\('Canvas', this\.node, WIDTH, visibleHeight\)/)
  assert.match(source, /createNode\('InputLayer', battleRoot, WIDTH, visibleHeight - NAV_HEIGHT\)/)
  assert.match(source, /inputLayer\.setPosition\(0, NAV_HEIGHT \/ 2, 0\)/)
  assert.match(source, /topHud\.setPosition\(0, visibleHeight \/ 2 - TOP_HUD_OFFSET, 0\)/)
  assert.match(source, /bottomNavigation\.setPosition\(0, -visibleHeight \/ 2 \+ NAV_HEIGHT \/ 2, 0\)/)
  assert.doesNotMatch(source, /setScale\([^,]+,\s*visibleHeight \/ HEIGHT/)
})

test('portrait bootstrap bridges flying sword action events to the player animator', () => {
  const source = readFileSync(resolve('assets/Scripts/Game/PortraitBattleBootstrap.ts'), 'utf8')

  assert.match(source, /createFlyingSword\(effectLayer, runtime, animator/)
  assert.match(source, /skillNode\.on\('player-action-requested',\s*\(action: string\) => animator\.play\(action\)/)
  assert.match(source, /skillNode\.on\('player-action-ended',\s*\(\) => animator\.play\('sword_ride'\)/)
})
