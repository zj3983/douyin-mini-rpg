import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { findCharacter, findArtifact, monstersForTheme, skillsForCharacter } from '../tools/asset-catalog-runtime.mjs'

const catalog = JSON.parse(readFileSync(resolve('assets/Data/asset-catalog.json'), 'utf8'))

test('character catalog defines portraits, motion sets, artifacts, and innate skills', () => {
  assert.equal(catalog.characters.length >= 4, true)

  for (const character of catalog.characters) {
    assert.equal(Boolean(character.portrait), true)
    assert.equal(Boolean(character.combatSprite), true)
    assert.deepEqual(Object.keys(character.motions), ['idle', 'move', 'cast', 'hurt'])
    assert.equal(Boolean(character.innateSkill), true)
    assert.equal(Boolean(character.startingArtifact), true)
  }
})

test('monster catalog is grouped by scene theme and includes animation slots', () => {
  assert.equal(catalog.monsters.length >= 12, true)

  for (const monster of catalog.monsters) {
    assert.equal(Boolean(monster.theme), true)
    assert.equal(Boolean(monster.sprite), true)
    assert.deepEqual(Object.keys(monster.motions), ['idle', 'move', 'attack', 'hurt', 'death'])
    assert.equal(Boolean(monster.skillCue), true)
  }
})

test('skill catalog separates icon, projectile, impact, and full-screen effect assets', () => {
  assert.equal(catalog.skills.length >= 6, true)

  for (const skill of catalog.skills) {
    assert.equal(Boolean(skill.icon), true)
    assert.equal(Boolean(skill.projectile), true)
    assert.equal(Boolean(skill.impact), true)
    assert.equal(Boolean(skill.fullScreen), true)
  }
})

test('artifact catalog uses consistent rarity colors and source dungeons', () => {
  const rarityColors = new Map()

  for (const artifact of catalog.artifacts) {
    assert.equal(Boolean(artifact.icon), true)
    assert.equal(Boolean(artifact.sourceDungeon), true)
    if (!rarityColors.has(artifact.rarity)) {
      rarityColors.set(artifact.rarity, artifact.color)
    }
    assert.equal(artifact.color, rarityColors.get(artifact.rarity))
  }
})

test('asset runtime resolves character, skills, monsters, and artifact sources', () => {
  const character = findCharacter('qinglan-sword-cultivator')
  const skills = skillsForCharacter(character.id)
  const monsters = monstersForTheme('flame-cave')
  const artifact = findArtifact(character.startingArtifact)

  assert.equal(character.name, '青岚剑修')
  assert.equal(skills[0].id, 'flying-sword-art')
  assert.equal(monsters.length >= 3, true)
  assert.equal(artifact.sourceDungeon, 'mist-bamboo-secret')
})
