import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { findCharacter, findArtifact, monstersForTheme, skillsForCharacter } from '../tools/asset-catalog-runtime.mjs'

const catalog = JSON.parse(readFileSync(resolve('assets/Data/asset-catalog.json'), 'utf8'))
const animationAtlas = JSON.parse(readFileSync(resolve('assets/Data/animation-atlas.json'), 'utf8'))
const resourceRoot = 'assets/resources'

test('character catalog keeps portraits and resolves canonical actor atlases', () => {
  assert.equal(catalog.characters.length >= 4, true)
  const characterActors = new Map(
    animationAtlas.actors
      .filter((actor) => actor.type === 'character')
      .map((actor) => [actor.id, actor]),
  )

  for (const character of catalog.characters) {
    assert.equal(Boolean(character.portrait), true)
    assert.equal(character.animationActorId, character.id)
    assert.equal('combatSprite' in character, false)
    assert.equal('motions' in character, false)
    assert.equal('motionFrames' in character, false)
    assert.equal(Boolean(character.innateSkill), true)
    assert.equal(Boolean(character.startingArtifact), true)

    const actor = characterActors.get(character.animationActorId)
    assert.ok(actor, `${character.animationActorId} should exist in animation-atlas.json`)
    for (const action of actor.actions) {
      assert.equal(action.atlas.startsWith('Assets/ActorAtlases/'), true)
      assert.equal(existsSync(resolve(resourceRoot, action.atlas)), true, `${action.atlas} should exist`)
    }
  }
})

test('monster catalog is grouped by scene theme and resolves canonical actor atlases', () => {
  assert.equal(catalog.monsters.length >= 12, true)
  const monsterActors = new Map(
    animationAtlas.actors
      .filter((actor) => actor.type === 'monster')
      .map((actor) => [actor.id, actor]),
  )

  for (const monster of catalog.monsters) {
    assert.equal(Boolean(monster.theme), true)
    assert.equal(monster.animationActorId, monster.id)
    assert.equal('sprite' in monster, false)
    assert.equal('motions' in monster, false)
    assert.equal('motionFrames' in monster, false)
    assert.equal(Boolean(monster.skillCue), true)

    const actor = monsterActors.get(monster.animationActorId)
    assert.ok(actor, `${monster.animationActorId} should exist in animation-atlas.json`)
    assert.ok(actor.actions.length >= 5)
    for (const action of actor.actions) {
      assert.equal(action.atlas.startsWith('Assets/ActorAtlases/'), true)
      assert.equal(existsSync(resolve(resourceRoot, action.atlas)), true, `${action.atlas} should exist`)
    }
  }

  assert.equal(existsSync(resolve(resourceRoot, 'Assets/Monsters')), false)
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

test('catalog image paths exist under Cocos assets', () => {
  const imagePaths = [
    ...catalog.characters.map((character) => character.portrait),
    ...catalog.skills.flatMap((skill) => [skill.icon, skill.projectile, skill.impact, skill.fullScreen]),
    ...catalog.artifacts.map((artifact) => artifact.icon),
  ]

  for (const assetPath of imagePaths) {
    assert.equal(existsSync(resolve(resourceRoot, assetPath)), true, `${assetPath} should exist`)
  }
  assert.equal(existsSync(resolve('assets/Assets')), false, 'runtime assets should live under assets/resources')
})

test('character folders contain portraits only', () => {
  for (const character of catalog.characters) {
    const folder = character.portrait.split('/').slice(0, -1).join('/')
    const pngFiles = readdirSync(resolve(resourceRoot, folder), { recursive: true })
      .filter((name) => name.endsWith('.png'))
      .map((name) => name.replaceAll('\\', '/'))
      .sort()
    assert.deepEqual(pngFiles, ['portrait.png'], `${character.id} should not ship legacy combat strips`)
  }
})
