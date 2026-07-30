import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'
import ts from 'typescript'

const root = resolve(import.meta.dirname, '..')
const sourceDesign = JSON.parse(readFileSync(join(root, 'assets', 'Data', 'cultivation-design.json'), 'utf8'))
const resourceDesign = JSON.parse(readFileSync(join(root, 'assets', 'resources', 'Data', 'cultivation-design.json'), 'utf8'))

async function loadCultivationRuntime() {
  const source = readFileSync(join(root, 'assets', 'Scripts', 'Core', 'CultivationRuntime.ts'), 'utf8')
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`)
}

test('source and resource cultivation designs stay deeply identical', () => {
  assert.deepEqual(sourceDesign, resourceDesign)
})

test('the first world region contains the ordered ten-stage catalog', () => {
  const stages = sourceDesign.worldStages

  assert.deepEqual(stages.map(({ id }) => id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  assert.equal(new Set(stages.map(({ background }) => background)).size, 10)
  assert.deepEqual(
    stages.map(({ encounter }) => encounter),
    ['normal', 'normal', 'normal', 'elite', 'normal', 'normal', 'elite', 'normal', 'normal', 'region-boss'],
  )
})

test('stages nine and ten reuse existing actors with complete combat roles', () => {
  const existingActorIds = new Set(sourceDesign.worldStages.slice(0, 8).flatMap(({ enemies }) => enemies.map(({ id }) => id)))
  const [stage9, stage10] = sourceDesign.worldStages.slice(8)

  assert.deepEqual(
    { id: stage9.id, name: stage9.name, theme: stage9.theme, background: stage9.background },
    { id: 9, name: '玄泉石林', theme: 'mist-bamboo', background: 'mystic-spring-stone-forest' },
  )
  assert.deepEqual(
    { id: stage10.id, name: stage10.name, theme: stage10.theme, background: stage10.background },
    { id: 10, name: '雾海天阙', theme: 'cloud-gate', background: 'mist-sea-heaven-palace' },
  )
  assert.deepEqual(
    stage9.enemies.map(({ id }) => id),
    ['moss-wolf', 'green-wing-moth', 'mist-deer-king'],
  )
  assert.deepEqual(
    stage10.enemies.map(({ id }) => id),
    ['star-armored-beast', 'void-wing-spirit', 'meteor-guardian'],
  )

  for (const stage of [stage9, stage10]) {
    assert.deepEqual(stage.enemies.map(({ role }) => role), ['ground', 'flying', 'boss'])
    assert.equal(stage.enemies.every(({ id }) => existingActorIds.has(id)), true)
  }
})

test('stage profiles use exact IDs and reject an unknown finite stage', async () => {
  const { stageProfileFromDesign } = await loadCultivationRuntime()

  assert.equal(stageProfileFromDesign(sourceDesign, 10).id, 10)
  assert.equal(stageProfileFromDesign(sourceDesign, 10).name, '雾海天阙')
  assert.throws(() => stageProfileFromDesign(sourceDesign, 11), /Unknown world stage: 11/)
})

test('stage profile input normalization preserves existing fallback behavior', async () => {
  const { stageProfileFromDesign } = await loadCultivationRuntime()

  assert.equal(stageProfileFromDesign(sourceDesign, 2.9).id, 2)
  for (const stageNumber of [Number.NaN, 0, -3, 0.25, 0.9]) {
    assert.equal(stageProfileFromDesign(sourceDesign, stageNumber).id, 1)
  }
})

test('stage profile rejects infinite stage numbers explicitly', async () => {
  const { stageProfileFromDesign } = await loadCultivationRuntime()

  assert.throws(
    () => stageProfileFromDesign(sourceDesign, Number.POSITIVE_INFINITY),
    /Unknown world stage: Infinity/,
  )
})

test('stage profile copies enemies without exposing source design objects', async () => {
  const { stageProfileFromDesign } = await loadCultivationRuntime()
  const profile = stageProfileFromDesign(sourceDesign, 1)
  const originalName = sourceDesign.worldStages[0].enemies[0].name

  profile.enemies[0].name = 'mutated enemy'
  profile.enemies.push({ id: 'mutated', name: 'mutated', role: 'ground', theme: 'mutated' })
  profile.boss.name = 'mutated boss'

  assert.equal(sourceDesign.worldStages[0].enemies[0].name, originalName)
  assert.equal(sourceDesign.worldStages[0].enemies.length, 3)
  assert.notEqual(sourceDesign.worldStages[0].enemies.at(-1).name, 'mutated boss')
  const freshProfile = stageProfileFromDesign(sourceDesign, 1)
  assert.equal(freshProfile.enemies[0].name, originalName)
  assert.equal(freshProfile.enemies.length, 3)
  assert.equal(freshProfile.boss.role, 'boss')
})
