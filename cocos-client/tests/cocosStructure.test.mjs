import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const requiredComponents = [
  ['assets/Scripts/Game/StageDirector.ts', 'class StageDirector'],
  ['assets/Scripts/Game/EnemyController.ts', 'class EnemyController'],
  ['assets/Scripts/Game/DungeonRunController.ts', 'class DungeonRunController'],
  ['assets/Scripts/Game/SoulOrbController.ts', 'class SoulOrbController'],
]

test('Cocos game layer has dedicated battle-loop components', () => {
  for (const [file, marker] of requiredComponents) {
    const source = readFileSync(resolve(file), 'utf8')
    assert.equal(source.includes(marker), true, `${file} should define ${marker}`)
  }
})
