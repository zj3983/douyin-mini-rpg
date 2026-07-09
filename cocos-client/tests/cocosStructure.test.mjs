import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const requiredComponents = [
  ['assets/Scripts/Game/StageDirector.ts', 'class StageDirector'],
  ['assets/Scripts/Game/EnemyController.ts', 'class EnemyController'],
  ['assets/Scripts/Game/DungeonRunController.ts', 'class DungeonRunController'],
  ['assets/Scripts/Game/SoulOrbController.ts', 'class SoulOrbController'],
  ['assets/Scripts/Game/AssetBindingController.ts', 'class AssetBindingController'],
  ['assets/Scripts/Game/StripAnimator.ts', 'class StripAnimator'],
  ['assets/Scripts/Game/ActorAnimationBinder.ts', 'class ActorAnimationBinder'],
  ['assets/Scripts/Game/AtlasAnimator.ts', 'class AtlasAnimator'],
  ['assets/Scripts/Game/NodePoolController.ts', 'class NodePoolController'],
  ['assets/Scripts/Game/PoolableActor.ts', 'class PoolableActor'],
  ['assets/Scripts/Game/EnemySpawner.ts', 'class EnemySpawner'],
  ['assets/Scripts/Game/BattleRuntimeController.ts', 'class BattleRuntimeController'],
]

test('Cocos game layer has dedicated battle-loop components', () => {
  for (const [file, marker] of requiredComponents) {
    const source = readFileSync(resolve(file), 'utf8')
    assert.equal(source.includes(marker), true, `${file} should define ${marker}`)
  }
})
