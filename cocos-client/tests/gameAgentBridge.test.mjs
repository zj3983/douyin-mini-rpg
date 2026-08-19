import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('Cocos dungeon agent bridge is query-gated and removed during teardown', async () => {
  const source = await readFile(new URL('../assets/Scripts/Game/PortraitBattleBootstrap.ts', import.meta.url), 'utf8')

  assert.match(source, /URLSearchParams[\s\S]+?query\.has\('gameAgent'\)/)
  assert.match(source, /__M3_DUNGEON_AGENT__/)
  assert.match(source, /snapshot:\s*\(\)/)
  assert.match(source, /resourceStatus:\s*\(\)/)
  assert.match(source, /uiLayout:\s*\(\)/)
  assert.match(source, /command:\s*\(command/)
  assert.match(source, /completeEncounter:/)
  assert.match(source, /advance:\s*\(seconds/)
  assert.match(source, /delete agentGlobal\.__M3_DUNGEON_AGENT__/)
})

test('dungeon agent verifies real canvas controls and samples active combat frames', async () => {
  const source = await readFile(new URL('../../scripts/game-agent.mjs', import.meta.url), 'utf8')
  assert.match(source, /bridgeCall\('uiLayout'\)/)
  assert.match(source, /page\.mouse\.click/)
  assert.match(source, /真实按钮进入首个房间/)
  assert.match(source, /measureDetailedFrames\([^)]*,\s*'[^']*战斗[^']*'\)/)
  assert.match(source, /性能采样阶段/)
})
