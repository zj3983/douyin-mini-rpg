import test from 'node:test'
import assert from 'node:assert/strict'
import { checkCocosBuildReadiness } from '../tools/check-cocos-build-readiness.mjs'

test('build readiness reports missing Cocos export blockers', () => {
  const report = checkCocosBuildReadiness({
    projectRoot: process.cwd(),
    creatorCommand: '',
    files: new Set(),
  })

  assert.equal(report.ready, false)
  assert.equal(report.blockers.some((blocker) => blocker.includes('Cocos Creator')), true)
  assert.equal(report.blockers.some((blocker) => blocker.includes('assets/Scenes')), true)
  assert.equal(report.blockers.some((blocker) => blocker.includes('settings')), true)
  assert.equal(report.blockers.some((blocker) => blocker.includes('build/web-mobile')), true)
})

test('build readiness passes when editor and every required imported runtime asset exist', () => {
  const required = [
    'assets/Scenes/MainBattle.scene',
    'assets/Scenes/MainBattle.scene.meta',
    'assets/Data/scene-blueprint.json',
    'assets/Data/scene-blueprint.json.meta',
    'assets/resources/Data/dual-mode-slice.json',
    'assets/resources/Data/dual-mode-slice.json.meta',
    'assets/Scripts/Core/Dungeon.meta',
    'assets/Scripts/Core/Dungeon/DungeonInteraction.ts',
    'assets/Scripts/Core/Dungeon/DungeonInteraction.ts.meta',
    'assets/Scripts/Core/Dungeon/DungeonSession.ts',
    'assets/Scripts/Core/Dungeon/DungeonSession.ts.meta',
    'assets/Scripts/Core/Dungeon/DungeonTypes.ts',
    'assets/Scripts/Core/Dungeon/DungeonTypes.ts.meta',
    'assets/Scripts/Core/GameContent.ts',
    'assets/Scripts/Core/GameContent.ts.meta',
    'assets/Scripts/Core/Loadout.meta',
    'assets/Scripts/Core/Loadout/LoadoutRules.ts',
    'assets/Scripts/Core/Loadout/LoadoutRules.ts.meta',
    'assets/Scripts/Core/Progression.meta',
    'assets/Scripts/Core/Progression/BestEffortNotification.ts',
    'assets/Scripts/Core/Progression/BestEffortNotification.ts.meta',
    'assets/Scripts/Core/Progression/DualModeRuntime.ts',
    'assets/Scripts/Core/Progression/DualModeRuntime.ts.meta',
    'assets/Scripts/Core/Progression/PlayerSave.ts',
    'assets/Scripts/Core/Progression/PlayerSave.ts.meta',
    'assets/Scripts/Core/Progression/SaveRepository.ts',
    'assets/Scripts/Core/Progression/SaveRepository.ts.meta',
    'assets/Scripts/Core/World.meta',
    'assets/Scripts/Core/World/WorldRewards.ts',
    'assets/Scripts/Core/World/WorldRewards.ts.meta',
    'assets/Scripts/Game/DungeonRunController.ts',
    'assets/Scripts/Game/DungeonRunController.ts.meta',
    'assets/Scripts/Game/DualModeGameController.ts',
    'assets/Scripts/Game/DualModeGameController.ts.meta',
  ]
  const report = checkCocosBuildReadiness({
    projectRoot: process.cwd(),
    creatorCommand: 'D:/CocosCreator/CocosCreator.exe',
    files: new Set([
      ...required,
      'settings/v2/packages/builder.json',
      'build/web-mobile/index.html',
    ]),
  })

  assert.equal(report.ready, true)
  assert.deepEqual(report.blockers, [])
})

test('build readiness names missing dual-mode scripts, data, scenes, and meta imports', () => {
  const report = checkCocosBuildReadiness({
    projectRoot: process.cwd(),
    creatorCommand: 'D:/CocosCreator/3.8.8/CocosCreator.exe',
    files: new Set([
      'assets/Scenes/MainBattle.scene',
      'settings/v2/packages/builder.json',
      'build/web-mobile/index.html',
    ]),
  })

  assert.equal(report.ready, false)
  assert.equal(report.blockers.some((blocker) => blocker.includes('dual-mode-slice.json.meta')), true)
  assert.equal(report.blockers.some((blocker) => blocker.includes('DungeonSession.ts.meta')), true)
  assert.equal(report.blockers.some((blocker) => blocker.includes('DungeonInteraction.ts.meta')), true)
  assert.equal(report.blockers.some((blocker) => blocker.includes('LoadoutRules.ts.meta')), true)
  assert.equal(report.blockers.some((blocker) => blocker.includes('GameContent.ts.meta')), true)
  assert.equal(report.blockers.some((blocker) => blocker.includes('BestEffortNotification.ts.meta')), true)
  assert.equal(report.blockers.some((blocker) => blocker.includes('WorldRewards.ts.meta')), true)
  assert.equal(report.blockers.some((blocker) => blocker.includes('DualModeGameController.ts.meta')), true)
  assert.equal(report.blockers.some((blocker) => blocker.includes('scene-blueprint.json.meta')), true)
})
