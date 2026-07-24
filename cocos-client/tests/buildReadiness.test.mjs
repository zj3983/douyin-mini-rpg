import test from 'node:test'
import assert from 'node:assert/strict'
import { checkCocosBuildReadiness, requiredDualModeAssets } from '../tools/check-cocos-build-readiness.mjs'

function metaConvention(path) {
  if (path.endsWith('.scene.meta')) return { importer: 'scene', ver: '1.1.50' }
  if (path.endsWith('.json.meta')) return { importer: 'json', ver: '2.0.1' }
  if (path.endsWith('.ts.meta')) return { importer: 'typescript', ver: '4.0.24' }
  return { importer: 'directory', ver: '1.2.0' }
}

function validRequiredContents() {
  const contents = new Map()
  let uuidIndex = 1
  for (const path of requiredDualModeAssets) {
    if (path.endsWith('.meta')) {
      const convention = metaConvention(path)
      contents.set(path, JSON.stringify({
        ...convention,
        imported: true,
        uuid: `00000000-0000-4000-8000-${String(uuidIndex).padStart(12, '0')}`,
      }))
      uuidIndex += 1
    } else if (path.endsWith('.scene') || path.endsWith('.json')) {
      contents.set(path, '{}')
    }
  }
  return contents
}

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
  const contents = validRequiredContents()
  const report = checkCocosBuildReadiness({
    projectRoot: process.cwd(),
    creatorCommand: 'D:/CocosCreator/CocosCreator.exe',
    files: new Set([
      ...requiredDualModeAssets,
      'settings/v2/packages/builder.json',
      'build/web-mobile/index.html',
    ]),
    readFile: (path) => contents.get(path),
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

test('build readiness blocks malformed required scene, blueprint, data, and meta JSON', () => {
  for (const malformedPath of [
    'assets/Scenes/MainBattle.scene',
    'assets/Data/scene-blueprint.json',
    'assets/resources/Data/dual-mode-slice.json',
    'assets/Scripts/Core/Dungeon/DungeonSession.ts.meta',
  ]) {
    const contents = validRequiredContents()
    contents.set(malformedPath, '{')
    const report = checkCocosBuildReadiness({
      projectRoot: process.cwd(),
      creatorCommand: 'D:/CocosCreator/3.8.8/CocosCreator.exe',
      files: new Set([...requiredDualModeAssets, 'settings/v2/packages/builder.json', 'build/web-mobile/index.html']),
      readFile: (path) => contents.get(path),
    })
    assert.ok(report.blockers.some((blocker) => blocker.includes(`${malformedPath} contains malformed JSON`)))
  }
})

test('build readiness blocks invalid and duplicate required meta UUIDs', () => {
  const contents = validRequiredContents()
  const firstPath = 'assets/Scripts/Core/Dungeon/DungeonSession.ts.meta'
  const secondPath = 'assets/Scripts/Core/Dungeon/DungeonTypes.ts.meta'
  const first = JSON.parse(contents.get(firstPath))
  contents.set(firstPath, JSON.stringify({ ...first, uuid: 'not-a-uuid' }))
  contents.set(secondPath, JSON.stringify({ ...JSON.parse(contents.get(secondPath)), uuid: first.uuid }))
  contents.set('assets/Scripts/Core/GameContent.ts.meta', JSON.stringify({
    ...JSON.parse(contents.get('assets/Scripts/Core/GameContent.ts.meta')),
    uuid: first.uuid,
  }))

  const report = checkCocosBuildReadiness({
    projectRoot: process.cwd(),
    creatorCommand: 'D:/CocosCreator/3.8.8/CocosCreator.exe',
    files: new Set([...requiredDualModeAssets, 'settings/v2/packages/builder.json', 'build/web-mobile/index.html']),
    readFile: (path) => contents.get(path),
  })
  assert.ok(report.blockers.some((blocker) => blocker.includes(`${firstPath} has a missing or invalid UUID`)))
  assert.ok(report.blockers.some((blocker) => blocker.includes('duplicate required meta UUID')))
})

test('build readiness blocks missing or wrong meta importer and version fields', () => {
  const contents = validRequiredContents()
  const wrongImporter = 'assets/Scripts/Core/Dungeon/DungeonSession.ts.meta'
  const missingImporter = 'assets/Scripts/Core/Loadout.meta'
  contents.set(wrongImporter, JSON.stringify({ ...JSON.parse(contents.get(wrongImporter)), importer: 'json', ver: '2.0.1' }))
  const missing = JSON.parse(contents.get(missingImporter))
  delete missing.importer
  delete missing.ver
  contents.set(missingImporter, JSON.stringify(missing))

  const report = checkCocosBuildReadiness({
    projectRoot: process.cwd(),
    creatorCommand: 'D:/CocosCreator/3.8.8/CocosCreator.exe',
    files: new Set([...requiredDualModeAssets, 'settings/v2/packages/builder.json', 'build/web-mobile/index.html']),
    readFile: (path) => contents.get(path),
  })
  assert.ok(report.blockers.some((blocker) => blocker.includes(`${wrongImporter} must use importer typescript version 4.0.24`)))
  assert.ok(report.blockers.some((blocker) => blocker.includes(`${missingImporter} must use importer directory version 1.2.0`)))
})
