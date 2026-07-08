import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const catalog = JSON.parse(readFileSync(resolve('assets/Data/asset-catalog.json'), 'utf8'))

function findById(list, id, label) {
  const item = list.find((entry) => entry.id === id)
  if (!item) {
    throw new Error(`Unknown ${label}: ${id}`)
  }
  return item
}

export function findCharacter(id) {
  return findById(catalog.characters, id, 'character')
}

export function findArtifact(id) {
  return findById(catalog.artifacts, id, 'artifact')
}

export function findSkill(id) {
  return findById(catalog.skills, id, 'skill')
}

export function monstersForTheme(theme) {
  return catalog.monsters.filter((monster) => monster.theme === theme)
}

export function skillsForCharacter(characterId) {
  const character = findCharacter(characterId)
  return [findSkill(character.innateSkill)]
}
