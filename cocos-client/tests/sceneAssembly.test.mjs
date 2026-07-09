import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
    'advanceToNextStageFromPanel',
  ]) {
    assert.equal(guide.includes(marker), true, `scene assembly guide should mention ${marker}`)
  }
})
