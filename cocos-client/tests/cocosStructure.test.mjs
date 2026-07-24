import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const requiredComponents = [
  ['assets/Scripts/Game/StageDirector.ts', 'class StageDirector'],
  ['assets/Scripts/Game/EnemyController.ts', 'class EnemyController'],
  ['assets/Scripts/Game/DungeonRunController.ts', 'class DungeonRunController'],
  ['assets/Scripts/Game/DualModeGameController.ts', 'class DualModeGameController'],
  ['assets/Scripts/Game/SoulOrbController.ts', 'class SoulOrbController'],
  ['assets/Scripts/Game/AssetBindingController.ts', 'class AssetBindingController'],
  ['assets/Scripts/Game/AtlasAnimator.ts', 'class AtlasAnimator'],
  ['assets/Scripts/Game/NodePoolController.ts', 'class NodePoolController'],
  ['assets/Scripts/Game/PoolableActor.ts', 'class PoolableActor'],
  ['assets/Scripts/Game/EnemySpawner.ts', 'class EnemySpawner'],
  ['assets/Scripts/Game/EnemyVisualController.ts', 'class EnemyVisualController'],
  ['assets/Scripts/Core/VisualResetRuntime.ts', 'interface VisualResetState'],
  ['assets/Scripts/Game/BattleRuntimeController.ts', 'class BattleRuntimeController'],
  ['assets/Scripts/Game/CombatAudioController.ts', 'class CombatAudioController'],
  ['assets/Scripts/Game/DamageNumberController.ts', 'class DamageNumberController'],
  ['assets/Scripts/Game/StageClearPanelController.ts', 'class StageClearPanelController'],
  ['assets/Scripts/Game/BattleHudController.ts', 'class BattleHudController'],
  ['assets/Scripts/Game/PortraitBattleBootstrap.ts', 'class PortraitBattleBootstrap'],
]

function readSource(file) {
  const path = resolve(file)
  return existsSync(path) ? readFileSync(path, 'utf8') : ''
}

function extractBlock(source, marker) {
  const markerIndex = source.indexOf(marker)
  assert.notEqual(markerIndex, -1, `missing source marker: ${marker}`)
  const openIndex = marker.endsWith('{')
    ? markerIndex + marker.length - 1
    : source.indexOf('{', markerIndex + marker.length)
  assert.notEqual(openIndex, -1, `missing block after source marker: ${marker}`)

  let depth = 0
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') depth -= 1
    if (depth === 0) return source.slice(openIndex + 1, index)
  }
  assert.fail(`unterminated block after source marker: ${marker}`)
}

function countOccurrences(source, marker) {
  return source.split(marker).length - 1
}

function assertStatementOrder(source, markers) {
  let previousIndex = -1
  for (const marker of markers) {
    const index = source.indexOf(marker)
    assert.ok(index > previousIndex, `${marker} should occur after the previous statement`)
    previousIndex = index
  }
}

test('Cocos game layer has dedicated battle-loop components', () => {
  for (const [file, marker] of requiredComponents) {
    const source = readFileSync(resolve(file), 'utf8')
    assert.equal(source.includes(marker), true, `${file} should define ${marker}`)
  }
})

test('battle runtime controller exposes boss stage hooks', () => {
  const source = readFileSync(resolve('assets/Scripts/Game/BattleRuntimeController.ts'), 'utf8')

  assert.equal(source.includes('enemySpawner'), true)
  assert.equal(source.includes('enemyNodes'), true)
  assert.equal(source.includes('spawnRuntimeEnemy'), true)
  assert.equal(source.includes('enemy-hit'), true)
  assert.equal(source.includes('enemy-defeated'), true)
  assert.equal(source.includes('despawnEnemy'), true)
  assert.equal(source.includes('this.enemySpawner?.spawnEnemy(enemy)'), true)
  assert.equal(source.includes('update(deltaTime'), true)
  assert.equal(source.includes('trySpawnBoss'), true)
  assert.equal(source.includes('tickBossSkill'), false)
  assert.equal(source.includes('consumeEnemyCombatCommand'), true)
  assert.equal(source.includes('claimStageClearRuntime'), true)
  assert.equal(source.includes('bossSkillEffectPool'), true)
  assert.equal(source.includes('stageClearPanel'), true)
  assert.equal(source.includes('showResult'), true)
  assert.equal(source.includes('advanceToStage'), true)
  assert.equal(source.includes('advanceToNextStageFromPanel'), true)
})

test('dual-mode Cocos controllers delegate progression and dungeon rules to Core', () => {
  const dungeon = readSource('assets/Scripts/Game/DungeonRunController.ts')
  const dualMode = readSource('assets/Scripts/Game/DualModeGameController.ts')
  const runtime = readSource('assets/Scripts/Core/Progression/DualModeRuntime.ts')
  const world = readSource('assets/Scripts/Game/BattleRuntimeController.ts')

  assert.match(dungeon, /Core\/Dungeon\/DungeonSession/)
  assert.match(dungeon, /Core\/Dungeon\/DungeonInteraction/)
  assert.match(dungeon, /Core\/Dungeon\/DungeonTypes/)
  assert.match(dungeon, /Core\/Progression\/BestEffortNotification/)
  assert.doesNotMatch(dungeon, /CultivationRuntime|resolveDungeonFloor/)
  assert.doesNotMatch(dungeon, /\.\.\/Combat\//)
  assert.match(dungeon, /@property\(JsonAsset\)\s*profileData/)
  assert.match(dungeon, /@property\(Label\)\s*roomLabel/)
  assert.match(dungeon, /createDungeonSession\(/)
  assert.match(dungeon, /emitBestEffort\('dungeon-run-began'/)
  assert.match(dungeon, /interactDungeonRun\(this\.run\)/)
  assert.doesNotMatch(dungeon, /grantDoorCurrency|doorCurrency\s*[+\-*/]?=/)
  assert.match(dungeon, /extractRun\(/)
  assert.match(dungeon, /emitBestEffort\('dungeon-room-changed'/)
  assert.match(dungeon, /emitBestEffort\('dungeon-loot-found'/)
  assert.match(dungeon, /emitBestEffort\('dungeon-extracted'/)
  assert.equal(countOccurrences(dungeon, 'this.node.emit('), 1)
  const safeEmit = extractBlock(dungeon, 'private emitBestEffort(')
  assert.match(safeEmit, /notifyBestEffort/)
  assert.match(safeEmit, /this\.node\.emit\(notification\.eventName/)
  const interact = extractBlock(dungeon, 'interact():')
  assert.doesNotMatch(interact, /this\.node\.emit/)
  assertStatementOrder(interact, ['const result = interactDungeonRun(this.run)', 'this.emitBestEffort', 'return result'])

  assert.match(dualMode, /Core\/Progression\/DualModeRuntime/)
  assert.match(dualMode, /Core\/Progression\/SaveRepository/)
  assert.doesNotMatch(dualMode, /\.\.\/Combat\//)
  assert.doesNotMatch(dualMode, /applyWorldBossClear|consumeDungeonPass|applyExtractionLoot/)
  assert.doesNotMatch(dualMode, /DEFAULT_DUNGEON_SEED/)
  assert.doesNotMatch(dualMode, /spiritStones\s*[+-]=|dungeonPasses\s*[+-]=/)
  assert.match(dualMode, /createJsonSaveRepository\(sys\.localStorage,\s*'cultivation-save-v3'\)/)
  assert.match(dualMode, /createDualModeRuntime\(/)
  assert.match(dualMode, /save-persist-failed/)
  assert.match(dualMode, /eventName:\s*'player-save-changed'/)
  assert.match(runtime, /applyWorldBossClear/)
  assert.match(runtime, /applyExtractionLoot/)
  assert.match(runtime, /consumeDungeonPass/)
  assert.doesNotMatch(runtime, /Core\/Battle|structuredClone|\.flatMap\(|Object\.values\(/)

  assert.match(world, /emit\('world-stage-cleared'/)
  assert.match(world, /rewardId:\s*`world-\$\{this\.stageNumber\}-generation-\$\{this\.stageGeneration\}`/)
})

test('dungeon begin commits before best-effort observer notification', () => {
  const source = readSource('assets/Scripts/Game/DungeonRunController.ts')
  const begin = extractBlock(source, 'begin(seed: number)')

  assert.doesNotMatch(begin, /this\.run = null/)
  assert.equal(countOccurrences(begin, 'this.run = nextRun'), 1)
  assertStatementOrder(begin, [
    'if (this.run) return false',
    'if (!this.profileData) return false',
    'nextRun = createDungeonSession',
    'this.run = nextRun',
    'this.refreshRoomLabel()',
    "this.emitBestEffort('dungeon-run-began'",
    'return true',
  ])
  const committed = begin.slice(begin.indexOf('this.run = nextRun'))
  assert.match(committed, /this\.emitBestEffort\('dungeon-run-began'/)
  assert.doesNotMatch(committed.slice(committed.indexOf('this.emitBestEffort')), /return false/)
})

test('dungeon extraction uses a direct authority callback and isolates post-commit notifications', () => {
  const source = readSource('assets/Scripts/Game/DungeonRunController.ts')
  const preview = extractBlock(source, 'previewRunId(seed: number)')
  const cancel = extractBlock(source, 'cancelRun()')
  const extract = extractBlock(source, 'extract()')

  assert.match(source, /hasRun\(\)/)
  assert.match(preview, /createDungeonSession\(/)
  assert.doesNotMatch(preview, /this\.run\s*=/)
  assertStatementOrder(cancel, ['if (!this.run) return false', 'this.run = null', 'this.refreshRoomLabel()'])
  assert.match(source, /onExtractionRequested[\s\S]*DungeonExtractionEvent[\s\S]*boolean/)
  assert.doesNotMatch(source, /acknowledged/)
  assert.match(extract, /try\s*{[\s\S]*onExtractionRequested\(request\)[\s\S]*}\s*catch\s*{[\s\S]*restoreExtraction\(run\)[\s\S]*return false/)
  assert.match(extract, /if \(!accepted\)[\s\S]*restoreExtraction\(run\)[\s\S]*return false/)
  assert.match(extract, /const notification:[\s\S]*loot: request\.loot\.map/)
  assert.match(extract, /this\.emitBestEffort\('dungeon-extracted', notification\)/)
  assertStatementOrder(extract, [
    'const run = this.run',
    'const result = extractRun(run)',
    'const request:',
    'onExtractionRequested(request)',
    'if (!accepted)',
    'this.run = null',
    'this.refreshRoomLabel()',
    'const notification:',
    "this.emitBestEffort('dungeon-extracted', notification)",
    'return true',
  ])
})

test('world clear emits exactly once inside the successful claimed-result branch', () => {
  const source = readSource('assets/Scripts/Game/BattleRuntimeController.ts')
  const finishStage = extractBlock(source, 'private finishStage()')
  const acceptedClaim = extractBlock(finishStage, 'if (result?.ok && result.result)')

  assert.equal(countOccurrences(source, "emit('world-stage-cleared'"), 1)
  assert.equal(countOccurrences(finishStage, "emit('world-stage-cleared'"), 1)
  assert.equal(countOccurrences(acceptedClaim, "emit('world-stage-cleared'"), 1)
  assert.match(acceptedClaim, /stageClearPanel\?\.showResult\(result\.result\)/)
  assertStatementOrder(finishStage, [
    'markBattleAttemptCleared(this.attemptState)',
    'claimStageClearRuntime(this.runtime)',
    'if (result?.ok && result.result)',
  ])
  assertStatementOrder(acceptedClaim, [
    'this.stageClearPanel?.showResult(result.result)',
    "this.node.emit('world-stage-cleared'",
  ])
})

test('dual-mode bootstrap wires direct extraction authority, live events, and cleanup', () => {
  const source = readSource('assets/Scripts/Game/PortraitBattleBootstrap.ts')
  const onDestroy = extractBlock(source, 'onDestroy()')
  const runtimeSetupStart = source.indexOf("const runtimeNode = this.createNode('Runtime', parent)")
  const runtimeSetupEnd = source.indexOf("const designPath = 'Data/cultivation-design'", runtimeSetupStart)
  assert.ok(runtimeSetupStart >= 0 && runtimeSetupEnd > runtimeSetupStart)
  const runtimeSetup = source.slice(runtimeSetupStart, runtimeSetupEnd)
  const profileLoad = extractBlock(source, 'resources.load(profilePath, JsonAsset, (error, asset) => {')

  assert.match(source, /DualModeGameController/)
  assert.match(source, /DungeonRunController/)
  assert.match(source, /createNode\('WorldRoot'/)
  assert.match(source, /createNode\('DungeonRoot'/)
  assert.match(source, /dungeonRoot\.active = false/)
  assert.match(source, /Data\/dual-mode-slice/)
  assert.match(runtimeSetup, /runtimeNode\.on\('battle-stage-changed',\s*this\.onStageChanged,\s*this\)/)
  assert.match(runtimeSetup, /runtimeNode\.on\('world-stage-cleared',\s*dualMode\.handleWorldCleared,\s*dualMode\)/)
  assert.match(source, /dungeonRun\.onExtractionRequested\s*=\s*this\.dungeonExtractionRequest/)
  assert.match(source, /dualMode\.handleDungeonExtracted\(payload\)/)
  assert.match(onDestroy, /runtimeNode\?\.off\('battle-stage-changed',\s*this\.onStageChanged,\s*this\)/)
  assert.match(onDestroy, /runtimeNode\?\.off\('world-stage-cleared',\s*this\.dualModeController\?\.handleWorldCleared,\s*this\.dualModeController\)/)
  assert.match(onDestroy, /onExtractionRequested\s*=\s*null/)
  assertStatementOrder(profileLoad, ['if (this.destroyed) return', 'dungeonRun.profileData = asset'])
})

test('dual-mode Cocos adapter reflects transactional runtime mode and returns extraction authority', () => {
  const source = readSource('assets/Scripts/Game/DualModeGameController.ts')
  const worldHandler = extractBlock(source, 'handleWorldCleared(payload: unknown)')
  const enterDungeon = extractBlock(source, 'enterDungeon(seed?: number)')
  const rejectedEntry = extractBlock(enterDungeon, 'if (!result.ok)')
  const extractionHandler = extractBlock(source, 'handleDungeonExtracted(payload: unknown)')
  const committedExtraction = extractionHandler.slice(extractionHandler.indexOf("this.applyMode('world')"))
  const saveSnapshot = extractBlock(source, '\n  getSaveSnapshot()')
  const reject = extractBlock(source, 'private reject(eventName: string, reason: string)')
  const notify = extractBlock(source, 'private notifyAll(notifications:')

  assert.match(worldHandler, /runtime\?\.handleWorldCleared\(payload\)/)
  assert.match(enterDungeon, /runtime\.enterDungeon\(seed\)/)
  assert.doesNotMatch(enterDungeon, /repository\?\.save|this\.save\s*=/)
  assertStatementOrder(enterDungeon, [
    'if (!this.runtime)',
    'this.runtime.enterDungeon(seed)',
    'if (!result.ok)',
    "this.applyMode('dungeon')",
    "eventName: 'player-save-changed'",
    "eventName: 'dungeon-entry-accepted'",
    'this.notifyAll(notifications)',
    'return true',
  ])
  assertStatementOrder(rejectedEntry, [
    'this.applyMode(this.runtime.getMode())',
    "this.reject('dungeon-entry-rejected'",
  ])
  assertStatementOrder(extractionHandler, [
    'this.runtime?.handleDungeonExtracted(payload)',
    'if (!result.ok)',
    "this.applyMode('world')",
    'return true',
  ])
  assertStatementOrder(committedExtraction, [
    "this.applyMode('world')",
    "eventName: 'player-save-changed'",
    "eventName: 'dungeon-extraction-accepted'",
    'this.notifyAll(notifications)',
    'return true',
  ])
  for (const handler of [worldHandler, enterDungeon, extractionHandler, reject]) {
    assert.doesNotMatch(handler, /node\.emit\(/)
  }
  assert.match(source, /Core\/Progression\/BestEffortNotification/)
  assert.match(notify, /notifyBestEffort\(notifications/)
  assert.equal(countOccurrences(source, 'this.node.emit('), 1)
  assertStatementOrder(reject, [
    "eventName: 'save-persist-failed'",
    'notifications.push({ eventName, payload: { reason } })',
    'this.notifyAll(notifications)',
    'return false',
  ])
  assert.match(source, /save-persist-rollback-failed/)
  assert.doesNotMatch(source, /acknowledged|acknowledgeExtraction/)
  assert.doesNotMatch(readSource('assets/Scripts/Core/Progression/DualModeRuntime.ts'), /acknowledged|acknowledgeExtraction/)
  assert.match(saveSnapshot, /runtime\?\.getSaveSnapshot\(\)/)
  assert.doesNotMatch(saveSnapshot, /return this\.save\b/)
})

test('enemy spawner only maps runtime spawns to pooled nodes', () => {
  const source = readFileSync(resolve('assets/Scripts/Game/EnemySpawner.ts'), 'utf8')

  assert.equal(source.includes('spawnEnemy'), true)
  assert.equal(source.includes('despawnEnemy'), true)
  assert.equal(source.includes('configureBattleLayout'), true)
  assert.equal(source.includes('bossSpawnX'), false)
  assert.equal(source.includes('bossY'), false)
  assert.equal(source.includes('bossScale'), false)
  assert.equal(source.includes('computeBossVisualPlacement'), true)
  assert.equal(source.includes('nextSpawn'), false)
  assert.equal(source.includes('createBattleRuntime'), false)
})

test('enemy visual controller reacts to hit and defeat events', () => {
  const source = readFileSync(resolve('assets/Scripts/Game/EnemyVisualController.ts'), 'utf8')

  assert.equal(source.includes('enemy-hit'), true)
  assert.equal(source.includes('enemy-defeated'), true)
  assert.equal(source.includes("applyActionState('hurt')"), true)
  assert.equal(source.includes("applyActionState('death')"), true)
  assert.equal(source.includes('enemy-visual-hit'), true)
  assert.equal(source.includes('enemy-visual-death'), true)
})

test('portrait battle input converts touch target coordinates before requesting authoritative movement', () => {
  const source = readSource('assets/Scripts/Game/BattleInputController.ts')

  assert.match(source, /import\s*{[^}]*EventTouch[^}]*UITransform[^}]*}\s*from\s*'cc'/s)
  assert.match(source, /import type\s*{[^}]*BattleRect[^}]*}\s*from\s*'\.\.\/Combat\/CombatTypes\.ts'/s)
  assert.match(source, /Node\.EventType\.TOUCH_START/)
  assert.match(source, /Node\.EventType\.TOUCH_MOVE/)
  assert.match(source, /Node\.EventType\.TOUCH_END/)
  assert.match(source, /\.on\(Node\.EventType\.TOUCH_START,\s*this\.onTouchTarget/)
  assert.match(source, /\.on\(Node\.EventType\.TOUCH_MOVE,\s*this\.onTouchTarget/)
  assert.match(source, /\.on\(Node\.EventType\.TOUCH_END,\s*this\.onTouchTarget/)
  assert.match(source, /\.off\(Node\.EventType\.TOUCH_START,\s*this\.onTouchTarget/)
  assert.match(source, /\.off\(Node\.EventType\.TOUCH_MOVE,\s*this\.onTouchTarget/)
  assert.match(source, /\.off\(Node\.EventType\.TOUCH_END,\s*this\.onTouchTarget/)
  assert.match(source, /getUILocation\(\)/)
  assert.match(source, /public configure\(bounds: BattleRect, coordinateSpace: UITransform\)/)
  assert.match(source, /private coordinateSpace: UITransform \| null = null/)
  assert.match(source, /coordinateSpace\.convertToNodeSpaceAR\(new Vec3\(/)
  assert.match(source, /player\.requestMovementInCoordinateSpace\(/)
  assert.doesNotMatch(source, /public (?:minX|maxX|minY|maxY)/)
  assert.doesNotMatch(source, /clampBattleTarget|convertToWorldSpaceAR/)

  assert.match(source, /player\.requestMovementInCoordinateSpace\(location, \(point\) => \{[\s\S]*coordinateSpace\.convertToNodeSpaceAR/)
})

test('portrait battle input rebinds the actual subscribed node without duplicates', () => {
  const source = readSource('assets/Scripts/Game/BattleInputController.ts')

  assert.match(source, /private subscribedNode:\s*Node\s*\|\s*null\s*=\s*null/)
  assert.match(source, /public bindInputArea\(inputArea:\s*UITransform\s*\|\s*null\)/)
  assert.match(source, /this\.unsubscribeInputNode\(\)[\s\S]*this\.inputArea = inputArea/)
  assert.match(source, /if \(this\.inputEnabled\) this\.subscribeInputNode\(\)/)
  assert.match(source, /this\.bounds && this\.player && this\.coordinateSpace/)
  assert.match(source, /if \(!node \|\| this\.subscribedNode === node\) return/)
  assert.match(source, /this\.subscribedNode\.off\(Node\.EventType\.TOUCH_START/)
  assert.match(source, /this\.subscribedNode\.off\(Node\.EventType\.TOUCH_MOVE/)
  assert.match(source, /this\.subscribedNode\.off\(Node\.EventType\.TOUCH_END/)
  assert.match(source, /this\.subscribedNode = null/)
})

test('player movement uses the encapsulated motor and emits motion transitions', () => {
  const source = readSource('assets/Scripts/Game/PlayerController.ts')

  assert.match(source, /from '\.\.\/Combat\/PlayerMotor\.ts'/)
  assert.match(source, /public configureMovement\(spawn: Point2, speed: number, bounds: BattleRect\)/)
  assert.match(source, /public requestMovement\(target: Point2\)/)
  assert.match(source, /public configureBounds\(bounds: BattleRect\)/)
  assert.match(source, /requestMoveInCoordinateSpace/)
  assert.match(source, /requestPlayerAction/)
  assert.match(source, /stopPlayerMotor/)
  assert.match(source, /resetPlayerMotor/)
  assert.match(source, /stepPlayerMotor\(/)
  assert.match(source, /if \(frame\.distanceMoved > 0\)[\s\S]*this\.syncNodePosition\(frame\.position\)/)
  assert.match(source, /configureBounds\(bounds: BattleRect\)[\s\S]*this\.syncNodePosition\(after\)/)
  assert.match(source, /emit\('player-animation-requested'/)
  assert.doesNotMatch(source, /private movementEnabled|private movementSpawn/)
  assert.doesNotMatch(source, /Date\.now/)
  assert.doesNotMatch(source, /Vec3\.lerp/)
  assert.match(source, /emit\('player-motion-changed', moving\)/)
  assert.match(source, /setPlayerMotionPresentation\(this\.motor, moving\)/)
  assert.doesNotMatch(source, /setPlayerFallbackAction/)
})

test('flying sword delegates timing and flight to artifact runtime commands', () => {
  const source = readSource('assets/Scripts/Game/FlyingSwordSkill.ts')
  const artifact = readSource('assets/Scripts/Combat/ArtifactRuntime.ts')

  assert.match(source, /from '\.\.\/Combat\/ArtifactRuntime\.ts'/)
  assert.match(source, /createArtifactRuntime\(/)
  assert.match(source, /stepArtifact\(this\.artifact,/)
  assert.match(source, /resetArtifact\(this\.artifact, generation\)/)
  assert.match(artifact, /createHomingSword\(/)
  assert.match(artifact, /stepHomingSwordCast\(/)
  assert.match(artifact, /state\.activePaths\.forEach\(\(path\) => activePaths\.push\(path\)\)/)
  assert.doesNotMatch(artifact, /Array\.from\(state\.activePaths\.values\(\)\)/)
  assert.doesNotMatch(artifact, /\[\.\.\.state\.activePaths\.values\(\)\]/)
  assert.match(source, /getLivingSwordTargets\(\)/)
  assert.match(source, /getCurrentPlayerPosition\(\)/)
  assert.match(source, /getBattleBounds\(\)/)
  assert.match(source, /resolveArtifactSwordHit\(command\.targetId\)/)
  assert.doesNotMatch(source, /createFlyingSwordPath|castFlyingSwordPass|getPath\(|timeline\.progress/)
  assert.match(source, /if \(!this\.battleRuntime \|\| !this\.artifact\) return/)
  assert.match(source, /emit\('sword-cast-started',\s*{ phase: 'handSeal' }\)/)
  assert.match(source, /if \(this\.battleRuntime\.isBattleFrozen\(\)\)[\s\S]*this\.cancelCast\(false\)/)
  assert.match(source, /onDisable\(\)[\s\S]*this\.cancelCast\(true\)/)
  assert.match(source, /case 'despawn-sword':[\s\S]*finishCast\(\)[\s\S]*emit\('player-action-completed'\)/)
  assert.match(source, /private cancelCast\(forceComplete: boolean\)[\s\S]*this\.visiblePathId = null[\s\S]*this\.hideSword\(\)/)
  const cancelBody = source.match(/private cancelCast\(forceComplete: boolean\) \{([\s\S]*?)\n  \}/)?.[1] ?? ''
  assert.match(cancelBody, /if \(this\.casting \|\| forceComplete\)/)
  assert.match(cancelBody, /emit\('player-action-completed'/)
  assert.doesNotMatch(cancelBody, /sword_ride/)
  assert.match(source, /setRotationFromEuler\(/)
})

test('enemy visual lifecycle owns exactly-once event wiring', () => {
  const source = readSource('assets/Scripts/Game/EnemyVisualController.ts')

  assert.match(source, /private eventsBound = false/)
  assert.match(source, /if \(this\.eventsBound\) return/)
  assert.match(source, /if \(!this\.eventsBound\) return/)
  assert.match(source, /this\.eventsBound = true/)
  assert.match(source, /this\.eventsBound = false/)
})

test('flying sword has a definition for every private method it calls', () => {
  const source = readSource('assets/Scripts/Game/FlyingSwordSkill.ts')
  const definitions = new Set(
    [...source.matchAll(/^  (?:private )?(\w+)\([^)]*\)\s*\{/gm)].map((match) => match[1]),
  )
  const calls = [...source.matchAll(/this\.(\w+)\(/g)].map((match) => match[1])
  const undefinedCalls = [...new Set(calls.filter((name) => !definitions.has(name)))]

  assert.deepEqual(undefinedCalls, [])
})

test('battle runtime exposes copied live snapshots and de-duplicated swept hits', () => {
  const source = readSource('assets/Scripts/Game/BattleRuntimeController.ts')
  const artifact = readSource('assets/Scripts/Combat/ArtifactRuntime.ts')

  assert.match(source, /getLivingSwordTargets\(\)/)
  assert.match(source, /return snapshotLivingSwordTargets\(this\.runtime\?\.enemies \?\? \[\]\)/)
  assert.match(source, /getCurrentPlayerPosition\(\)/)
  assert.match(source, /return \{ x: position\.x, y: position\.y \}/)
  assert.match(source, /resolveArtifactSwordHit\(targetId: string\)/)
  assert.match(source, /resolveHomingSwordSegment\(state:\s*HomingSwordState,\s*segment:\s*HomingSwordSegment,\s*phase:\s*HomingSwordPhase\)/)
  assert.match(source, /segmentHitEnemiesAlongPath\(/)
  assert.match(artifact, /recordGeometricSwordHits\(path\.state, ids, phase\)/)
  assert.match(source, /resolveArtifactSwordHit\(targetId: string\)[\s\S]*applyFlyingSwordPathHit\(/)
  assert.doesNotMatch(source, /castFlyingSword(?:Pass)?\(/)
  assert.doesNotMatch(source, /createFlyingSwordPath|createPlayerSwordPath|buildArcPath|arcHeight|swordStartX|swordEndX|swordY/)
})

test('battle runtime routes combat feedback through performance quality gates', () => {
  const runtime = readSource('assets/Scripts/Game/BattleRuntimeController.ts')
  const skill = readSource('assets/Scripts/Game/FlyingSwordSkill.ts')

  assert.match(runtime, /from '\.\.\/Combat\/FeedbackTimeline\.ts'/)
  assert.match(runtime, /from '\.\.\/Combat\/PerformanceBudget\.ts'/)
  assert.match(runtime, /createPerformanceBudget\(\)/)
  assert.match(runtime, /updateVfxQuality\(this\.vfxBudget,\s*deltaTime \* 1000\)/)
  assert.match(runtime, /private currentVfxQuality/)
  assert.match(runtime, /presentCombatFeedback\(feedbackFor\(/)
  assert.match(runtime, /type: 'damage-resolved'/)
  assert.match(runtime, /type: 'guard-broken'/)
  assert.match(runtime, /this\.node\.emit\('combat-feedback-requested'/)
  assert.match(skill, /emit\('combat-feedback-requested'/)
  assert.match(skill, /type: 'artifact-cast'/)
})

test('combat audio controller plays catalog bgm and scheduled feedback cues', () => {
  const source = readSource('assets/Scripts/Game/CombatAudioController.ts')
  const bootstrap = readSource('assets/Scripts/Game/PortraitBattleBootstrap.ts')

  assert.match(source, /AudioClip/)
  assert.match(source, /AudioSource/)
  assert.match(source, /resources\.load\('Data\/audio-catalog'/)
  assert.match(source, /resources\.load\(entry\.resource,\s*AudioClip/)
  assert.match(source, /playOneShot\(clip,\s*volume\)/)
  assert.match(source, /scheduleOnce\(/)
  assert.match(source, /request\.atMs \/ 1000/)
  assert.match(source, /combat-feedback-requested/)
  assert.match(source, /startBgm\('mist-bamboo'\)/)
  assert.match(source, /musicSource\.loop = true/)
  assert.match(bootstrap, /CombatAudioController/)
  assert.match(bootstrap, /combatAudioController\?\.bindFeedbackSource\(runtimeNode\)/)
  assert.match(bootstrap, /combatAudioController\?\.bindFeedbackSource\(skillNode\)/)
})

test('portrait bootstrap assembles the approved compact playable scene', () => {
  const source = readSource('assets/Scripts/Game/PortraitBattleBootstrap.ts')
  const stageVisualCatalog = readSource('assets/Scripts/Core/StageVisualCatalog.ts')

  assert.match(source, /const WIDTH = BATTLE_DESIGN_WIDTH/)
  assert.match(source, /const HEIGHT = BATTLE_MIN_VISIBLE_HEIGHT/)
  assert.match(source, /computeBattleViewportState/)
  assert.match(source, /ResolutionPolicy\.FIXED_WIDTH/)
  assert.match(source, /ResolutionPolicy\.SHOW_ALL/)
  assert.match(source, /onLoad\(\)[\s\S]*this\.applyViewportMetrics\(initialMetrics\)/)
  assert.match(source, /private relayoutVisibleArea\(metrics: Readonly<ViewportMetrics>\)[\s\S]*this\.applyViewportMetrics\(metrics\)/)
  assert.match(source, /addComponent\(Camera\)/)
  assert.match(source, /camera\.projection = Camera\.ProjectionType\.ORTHO/)
  assert.match(source, /camera\.visibility = UI_LAYER/)
  assert.match(source, /canvas\.cameraComponent = camera/)
  for (const name of [
    'Canvas', 'BattleRoot', 'WorldLayer', 'FarBackground', 'MidBackground',
    'ActorLayer', 'Player', 'EnemySpawner', 'EffectLayer', 'FlyingSwordSkill',
    'Sword', 'DropLayer', 'InputLayer', 'HudLayer', 'TopHud', 'BossHud',
    'BottomNavigation', 'StageClearPanel',
  ]) {
    assert.match(source, new RegExp(`['\"]${name}['\"]`), `bootstrap should create ${name}`)
  }

  assert.match(source, /stageResourceController = new StageResourceController\(this\.stageBackgroundController\)/)
  assert.match(source, /stageResourceController\.activate\(1\)/)
  assert.doesNotMatch(source, /createWorld\([\s\S]*?prefetchNext\(1\)[\s\S]*?private createPlayer/)
  assert.match(stageVisualCatalog, /Assets\/World\/MistBamboo\/far\/spriteFrame/)
  assert.match(stageVisualCatalog, /Assets\/World\/MistBamboo\/mid\/spriteFrame/)
  assert.match(source, /Assets\/Skills\/FlyingSword\/sword-projectile-v2\/spriteFrame/)
  assert.match(source, /qinglan-sword-cultivator/)
  assert.doesNotMatch(source, /action-strip\/texture\.png/)
  assert.match(source, /animator\.animationManifest = asset/)
  assert.match(source, /createNode\('BarVisual',\s*fill\.node/)
  assert.match(source, /setPosition\(-210,\s*-80/)
  assert.match(source, /controller\.replayPresentationAction\(\)/)
  assert.match(source, /bindInputArea\(/)
  assert.match(source, /schedule\(bindRuntime\)/)
  assert.match(source, /unschedule\(bindRuntime\)/)
  assert.match(source, /skill\.battleRuntime = state\.runtime[\s\S]*stageResourceController\?\.prefetchNext\(this\.currentStageId\)/)
  assert.match(source, /onStageChanged[\s\S]*currentStageId = payload\.stageId[\s\S]*stageResourceController\?\.activate\(payload\.stageId\)[\s\S]*stageResourceController\?\.prefetchNext\(payload\.stageId\)/)
  assert.match(source, /stageResourceController\?\.activate\(payload\.stageId\)\s+if \(!this\.battleOperational\) return\s+this\.stageResourceController\?\.prefetchNext\(payload\.stageId\)/)
  assert.match(source, /stageResourceController\?\.destroy\(\)[\s\S]*stageBackgroundController\?\.destroy\(\)/)
  assert.match(source, /Sprite\.SizeMode\.CUSTOM/)
  assert.match(source, /new UITransform|addComponent\(UITransform\)/)

  for (const label of ['战斗', '副本', '抽卡', '装备', '背包', '法宝']) {
    assert.equal(source.includes(label), true, `bottom navigation should include ${label}`)
  }

  assert.doesNotMatch(source, /Joystick|joystick|AttackButton|NormalAttack|SkillButton|skill button/)
  assert.doesNotMatch(source, /skill\.arcHeight|runtime\.swordArcHeight/)
})

test('battle HUD is null-safe and clamps every progress bar', () => {
  const source = readSource('assets/Scripts/Game/BattleHudController.ts')

  for (const field of [
    'realmLabel', 'stageLabel', 'healthBar', 'manaBar', 'soulBar',
    'soulLabel', 'bossRoot', 'bossNameLabel', 'bossHealthBar',
  ]) {
    assert.match(source, new RegExp(`${field}[^\\n]*\\| null = null`), `${field} should be nullable`)
  }
  for (const method of ['updateHero', 'updateStage', 'updateSoul', 'showBoss', 'hideBoss']) {
    assert.match(source, new RegExp(`${method}\\(`), `HUD should expose ${method}`)
  }
  assert.match(source, /Math\.min\(1,\s*Math\.max\(0,/)
  assert.match(source, /normalizeSoulHudCount\(current, required\)/)
  assert.match(source, /`魂 \$\{display\.current\}\/\$\{display\.required\}`/)
  assert.match(source, /bossRoot\.active = false/)
})

test('stage clear panel renders reward fields and next stage action', () => {
  const source = readFileSync(resolve('assets/Scripts/Game/StageClearPanelController.ts'), 'utf8')

  assert.equal(source.includes('titleLabel'), true)
  assert.equal(source.includes('rewardLabel'), true)
  assert.equal(source.includes('nextStageButton'), true)
  assert.equal(source.includes('nextStageTarget'), true)
  assert.equal(source.includes('spiritStones'), true)
  assert.equal(source.includes('artifactEssence'), true)
  assert.equal(source.includes('dungeonPass'), true)
})
