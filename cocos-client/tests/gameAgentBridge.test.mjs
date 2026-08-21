import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('Cocos dungeon agent bridge is query-gated and removed during teardown', async () => {
  const source = await readFile(new URL('../assets/Scripts/Game/PortraitBattleBootstrap.ts', import.meta.url), 'utf8')

  assert.match(source, /URLSearchParams[\s\S]+?query\.has\('gameAgent'\)/)
  assert.match(source, /__M3_DUNGEON_AGENT__/)
  assert.match(source, /snapshot:\s*\(\)/)
  assert.match(source, /bossCombatStatus:\s*\(\)/)
  assert.match(source, /resourceStatus:\s*\(\)/)
  assert.match(source, /uiLayout:\s*\(\)/)
  assert.match(source, /command:\s*\(command/)
  assert.match(source, /completeEncounter:/)
  assert.match(source, /advance:\s*\(seconds/)
  assert.match(source, /delete agentGlobal\.__M3_DUNGEON_AGENT__/)
})

test('Battle runtime forwards presenter-owned visible VFX identities with Boss state', async () => {
  const source = await readFile(new URL('../assets/Scripts/Game/BattleRuntimeController.ts', import.meta.url), 'utf8')

  assert.match(source, /getBossAgentSnapshot\(\)/)
  assert.match(source, /bossCombatSnapshot\(\)/)
  assert.match(source, /stageGeneration/)
  assert.match(source, /currentVfxQuality/)
  assert.match(source, /visibleTelegraphCount/)
  assert.match(source, /visibleImpactCount/)
  assert.match(source, /visibleVfxEntries/)
  assert.match(source, /visibleVfx/)
  assert.match(source, /Object\.freeze/)
})

test('dungeon agent verifies real controls and drives Boss evidence from bridge state', async () => {
  const source = await readFile(new URL('../../scripts/game-agent.mjs', import.meta.url), 'utf8')
  assert.match(source, /bridgeCall\('uiLayout'\)/)
  assert.match(source, /page\.mouse\.click/)
  assert.match(source, /真实按钮进入首个房间/)
  assert.match(source, /measureDetailedFrames\([^)]*,\s*'[^']*战斗[^']*'\)/)
  assert.match(source, /性能采样阶段/)
  assert.match(source, /bridgeCall\('bossCombatStatus'\)/)
  assert.match(source, /reviewBossSkillEvidence/)
  assert.match(source, /reviewBossEvidenceCapture/)
  assert.match(source, /reviewBossFinalInvariant/)
  assert.match(source, /buildDungeonAgentArtifacts/)
  assert.match(source, /greedy-boss-bamboo-sweep-telegraph/)
  assert.match(source, /greedy-boss-ground-spikes-active/)
  assert.match(source, /greedy-boss-mountain-roar-active/)
  assert.match(source, /maxGameElapsedSeconds:\s*25/)
  assert.match(source, /60_000/)
  assert.match(source, /await capturePendingBossScreenshot[\s\S]+?await bridgeCall\('bossCombatStatus'\)[\s\S]+?reviewBossEvidenceCapture/)
  assert.match(source, /finally\s*\{[\s\S]+?await writeDungeonAgentArtifacts\(route, failure\)/)
  assert.doesNotMatch(source, /bossSkillCapturePlan/)
  assert.doesNotMatch(source, /captureTasks|Promise\.all\(capture/)
  assert.doesNotMatch(source, /brain\?*\.lastAttack|brain\.lastAttack/)
})
