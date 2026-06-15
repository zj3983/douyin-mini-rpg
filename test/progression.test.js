import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import {
  characterTechniqueCatalog,
  techniqueProgressForCharacter,
  techniqueProgressTotal,
  techniqueSpecsForCharacter,
} from '../src/progression.ts'

test('each character has three profession-specific soul evolution cards', () => {
  for (const characterId of ['sword', 'thunder', 'flame', 'wood']) {
    const specs = techniqueSpecsForCharacter(characterId)
    assert.equal(specs.length, 3, `${characterId} should have three technique cards`)
    assert.deepEqual(new Set(specs.map((spec) => spec.id)).size, specs.length)

    for (const spec of specs) {
      assert.match(spec.id, new RegExp(`^tech-${characterId}-`))
      assert.equal(typeof spec.key, 'string')
      assert.equal(typeof spec.title, 'string')
      assert.match(spec.color, /^#[0-9a-f]{6}$/i)
      assert.match(spec.iconBase, /^(blade|sweep|orbit|chain|nova|quick|flame|guard|shield|gate)$/)
      assert.match(spec.art, /^\/assets\/generated\/evolution-tech-[a-z-]+\.(png|svg)$/)
    }
  }
})

test('non-sword classes do not reuse sword-only technique cards', () => {
  const swordIds = new Set(characterTechniqueCatalog.sword.map((spec) => spec.id))
  for (const characterId of ['thunder', 'flame', 'wood']) {
    const overlap = techniqueSpecsForCharacter(characterId).filter((spec) => swordIds.has(spec.id))
    assert.deepEqual(overlap, [], `${characterId} should not reuse sword technique ids`)
  }
})

test('profession technique art files exist for every soul evolution card', () => {
  for (const specs of Object.values(characterTechniqueCatalog)) {
    for (const spec of specs) {
      const filePath = join(process.cwd(), 'public', spec.art.replace(/^\/+/, ''))
      assert.equal(existsSync(filePath), true, `${spec.art} should exist`)
    }
  }
})

test('technique progress summarizes the active character routes', () => {
  const progress = techniqueProgressForCharacter('thunder', { thunderMark: 2, thunderEcho: 6 }, 6)

  assert.deepEqual(progress.map((item) => item.id), ['tech-thunder-mark', 'tech-thunder-echo', 'tech-thunder-cloud'])
  assert.equal(progress[0].level, 2)
  assert.equal(progress[0].maxLevel, 6)
  assert.equal(progress[0].percent, 33)
  assert.equal(progress[0].label, '2/6')
  assert.equal(progress[1].capped, true)
  assert.equal(progress[1].percent, 100)
  assert.equal(progress[2].level, 0)
  assert.equal(progress[2].capped, false)
})

test('technique progress total rolls active character routes into one battle label', () => {
  const total = techniqueProgressTotal('flame', { flameFocus: 2, flameSea: 1, thunderMark: 6 }, 6)

  assert.deepEqual(total, {
    level: 3,
    maxLevel: 18,
    percent: 17,
    label: '3/18',
  })
})
