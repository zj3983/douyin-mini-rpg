import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { checkCocosBuildReadiness, requiredDualModeAssets } from '../tools/check-cocos-build-readiness.mjs'

function metaConvention(path) {
  if (path.endsWith('.png.meta') || path.endsWith('.webp.meta')) return { importer: 'image', ver: '1.0.27' }
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
        ...(path.endsWith('.png.meta') || path.endsWith('.webp.meta')
          ? { subMetas: { f9941: { importer: 'sprite-frame', name: 'spriteFrame' } } }
          : {}),
      }))
      uuidIndex += 1
    }
  }
  contents.set('assets/Scenes/MainBattle.scene', JSON.stringify(validScene()))
  contents.set('assets/Data/scene-blueprint.json', JSON.stringify(validBlueprint()))
  contents.set('assets/resources/Data/dual-mode-slice.json', JSON.stringify(validDungeonProfile()))
  return contents
}

function validScene() {
  const names = [
    'SharedCombatRoot',
    'SharedActorLayer',
    'SharedEffectLayer',
    'SharedDropLayer',
    'SharedInputLayer',
    'WorldRoot',
    'WorldLayer',
    'WorldHudLayer',
    'DualModeGameController',
    'DungeonRoot',
    'DungeonWorldLayer',
    'DungeonHud',
    'DungeonRunController',
  ]
  return [
    { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
    { __type__: 'cc.Scene', _name: 'MainBattle', _children: names.map((_, index) => ({ __id__: index + 2 })) },
    ...names.map((name) => ({
      __type__: 'cc.Node',
      _name: name,
      _parent: { __id__: 1 },
      _children: [],
      _components: [],
    })),
  ]
}

function validBlueprint() {
  const nodes = [
    { path: 'Canvas/SharedCombatRoot', components: ['UITransform'] },
    { path: 'Canvas/SharedCombatRoot/SharedActorLayer', components: ['UITransform'] },
    { path: 'Canvas/SharedCombatRoot/SharedEffectLayer', components: ['UITransform'] },
    { path: 'Canvas/SharedCombatRoot/SharedDropLayer', components: ['UITransform'] },
    { path: 'Canvas/SharedCombatRoot/SharedInputLayer', components: ['UITransform'] },
    { path: 'Canvas/WorldRoot', components: ['UITransform'] },
    { path: 'Canvas/WorldRoot/WorldLayer', components: ['UITransform'] },
    { path: 'Canvas/WorldRoot/WorldHudLayer', components: ['UITransform'] },
    { path: 'Canvas/DungeonRoot', components: ['UITransform', 'DungeonRunPresenter', 'DungeonResourceController'] },
    { path: 'Canvas/DungeonRoot/DungeonWorldLayer', components: ['UITransform'] },
    { path: 'Canvas/DungeonRoot/DungeonHud', components: ['UITransform'] },
    {
      path: 'Canvas/DungeonRoot/DungeonRunController',
      components: ['DungeonRunController'],
      bindings: {
        profileData: 'resources/Data/dual-mode-slice.json',
        presenter: 'Canvas/DungeonRoot',
        battleRuntime: 'Canvas/SharedCombatRoot/Runtime',
      },
    },
    {
      path: 'Canvas/DualModeGameController',
      components: ['DualModeGameController'],
      bindings: {
        worldRoot: 'Canvas/WorldRoot',
        dungeonRoot: 'Canvas/DungeonRoot',
        dungeonRun: 'Canvas/DungeonRoot/DungeonRunController',
      },
    },
    {
      path: 'Canvas/SharedCombatRoot/Runtime',
      components: ['BattleRuntimeController'],
      bindings: {
        designData: 'design', stageClearPanel: 'clear', enemySpawner: 'spawner', soulOrbPool: 'soul',
        damageNumberPool: 'damage', bossSkillEffectPool: 'boss', dualMode: 'dual',
      },
    },
    { path: 'Canvas/SharedCombatRoot/SharedActorLayer/EnemySpawner', components: ['EnemySpawner'] },
    {
      path: 'Canvas/SharedCombatRoot/SharedEffectLayer/FlyingSwordSkill',
      components: ['FlyingSwordSkill'],
      bindings: { battleRuntime: 'runtime', sword: 'sword' },
    },
    { path: 'Canvas/WorldRoot/WorldHudLayer/StageClearPanel', components: ['StageClearPanelController'] },
    { path: 'Canvas/SharedCombatRoot/SharedDropLayer/SoulOrbPool', components: ['NodePoolController'] },
  ]
  return { scene: { name: 'MainBattle' }, nodes }
}

function validDungeonProfile() {
  return JSON.parse(readFileSync(new URL('../assets/resources/Data/dual-mode-slice.json', import.meta.url), 'utf8'))
}

test('source build readiness reports editor and import blockers without requiring built output', () => {
  const report = checkCocosBuildReadiness({
    projectRoot: process.cwd(),
    creatorCommand: '',
    files: new Set(),
  })

  assert.equal(report.ready, false)
  assert.equal(report.blockers.some((blocker) => blocker.includes('Cocos Creator')), true)
  assert.equal(report.blockers.some((blocker) => blocker.includes('assets/Scenes')), true)
  assert.equal(report.blockers.some((blocker) => blocker.includes('settings')), true)
  assert.equal(report.blockers.some((blocker) => blocker.includes('build/web-mobile')), false)
})

test('build readiness passes when editor and every required imported runtime asset exist', () => {
  const contents = validRequiredContents()
  const report = checkCocosBuildReadiness({
    projectRoot: process.cwd(),
    creatorCommand: 'D:/CocosCreator/CocosCreator.exe',
    files: new Set([
      ...requiredDualModeAssets,
      'settings/v2/packages/builder.json',
    ]),
    readFile: (path) => contents.get(path),
  })

  assert.equal(report.ready, true, report.blockers.join('\n'))
  assert.deepEqual(report.blockers, [])
})

test('build readiness contract includes the pursuit runtime, presenter, catalog, and every dungeon image', () => {
  for (const path of [
    'assets/Scripts/Core/Dungeon/DungeonPressureRuntime.ts',
    'assets/Scripts/Core/Dungeon/PursuitBossRuntime.ts',
    'assets/Scripts/Game/DungeonRunPresenter.ts',
    'assets/Scripts/Game/DungeonResourceController.ts',
    'assets/resources/Data/dungeon-encounters.json',
    ...[1, 2, 3].flatMap((floor) => [
      `assets/resources/Assets/Dungeon/MistBamboo/Floor${floor}/far.webp`,
      `assets/resources/Assets/Dungeon/MistBamboo/Floor${floor}/mid.webp`,
    ]),
    'assets/resources/Assets/Dungeon/MistBamboo/Effects/pursuit_edge.png',
    'assets/resources/Assets/Dungeon/MistBamboo/Effects/extraction_array.png',
  ]) {
    assert.ok(requiredDualModeAssets.includes(path), path)
    assert.ok(requiredDualModeAssets.includes(`${path}.meta`), `${path}.meta`)
  }
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

test('build readiness blocks invalid and duplicate asset meta UUIDs', () => {
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
  assert.ok(report.blockers.some((blocker) => blocker.includes('duplicate asset meta UUID')))
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

test('build readiness blocks malformed required PNG metadata', () => {
  const pngPath = 'assets/resources/Assets/World/MysticSpring/far.png.meta'
  const cases = [
    [
      'wrong importer',
      (meta) => ({ ...meta, importer: 'directory' }),
      `${pngPath} must use importer image version 1.0.27`,
    ],
    [
      'wrong version',
      (meta) => ({ ...meta, ver: '1.0.26' }),
      `${pngPath} must use importer image version 1.0.27`,
    ],
    [
      'missing sprite frame',
      (meta) => ({ ...meta, subMetas: { texture: { importer: 'texture' } } }),
      `${pngPath} must contain at least one sprite-frame subMeta`,
    ],
  ]

  for (const [name, mutate, expectedBlocker] of cases) {
    const contents = validRequiredContents()
    contents.set(pngPath, JSON.stringify(mutate(JSON.parse(contents.get(pngPath)))))
    const report = checkCocosBuildReadiness({
      projectRoot: process.cwd(),
      creatorCommand: 'D:/CocosCreator/3.8.8/CocosCreator.exe',
      files: new Set([...requiredDualModeAssets, 'settings/v2/packages/builder.json', 'build/web-mobile/index.html']),
      readFile: (path) => contents.get(path),
    })

    assert.ok(report.blockers.some((blocker) => blocker.includes(expectedBlocker)), name)
  }
})

test('build readiness blocks parseable but structurally invalid scene, blueprint, and dungeon profile', () => {
  const cases = [
    ['assets/Scenes/MainBattle.scene', { not: 'a Cocos scene array' }, 'Cocos scene array'],
    ['assets/Scenes/MainBattle.scene', [{ __type__: 'cc.SceneAsset', scene: { __id__: 99 } }], 'invalid __id__ reference'],
    ['assets/Data/scene-blueprint.json', { scene: {}, nodes: [] }, 'scene blueprint'],
    ['assets/resources/Data/dual-mode-slice.json', { ...validDungeonProfile(), entryRoomId: 'missing' }, 'dungeon profile'],
  ]
  for (const [path, value, marker] of cases) {
    const contents = validRequiredContents()
    contents.set(path, JSON.stringify(value))
    const report = checkCocosBuildReadiness({
      projectRoot: process.cwd(),
      creatorCommand: 'D:/CocosCreator/3.8.8/CocosCreator.exe',
      files: new Set([...requiredDualModeAssets, 'settings/v2/packages/builder.json', 'build/web-mobile/index.html']),
      readFile: (file) => contents.get(file),
    })
    assert.ok(report.blockers.some((blocker) => blocker.includes(marker)), `${path} should report ${marker}`)
  }
})

test('build readiness detects duplicate UUIDs in non-required injected asset metas', () => {
  const contents = validRequiredContents()
  const requiredMeta = 'assets/Scripts/Core/GameContent.ts.meta'
  const extraMeta = 'assets/Optional/Unrelated.prefab.meta'
  contents.set(extraMeta, JSON.stringify({
    ver: '1.1.40',
    importer: 'prefab',
    uuid: JSON.parse(contents.get(requiredMeta)).uuid,
  }))
  const report = checkCocosBuildReadiness({
    projectRoot: process.cwd(),
    creatorCommand: 'D:/CocosCreator/3.8.8/CocosCreator.exe',
    files: new Set([...requiredDualModeAssets, extraMeta, 'settings/v2/packages/builder.json', 'build/web-mobile/index.html']),
    readFile: (file) => contents.get(file),
  })

  assert.ok(report.blockers.some((blocker) => blocker.includes(extraMeta) && blocker.includes('duplicate asset meta UUID')))
})
