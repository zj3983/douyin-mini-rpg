import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createWorldRegion,
  highestSelectableStage,
  selectWorldStage,
} from '../assets/Scripts/Core/World/WorldRegion.ts'

function validStages() {
  return Array.from({ length: 10 }, (_, index) => {
    const id = index + 1
    return {
      id,
      encounter: id === 10 ? 'region-boss' : [4, 7].includes(id) ? 'elite' : 'normal',
    }
  })
}

test('createWorldRegion accepts exactly ten stages ordered from one to ten', () => {
  const region = createWorldRegion('mist-frontier', validStages())

  assert.equal(region.id, 'mist-frontier')
  assert.deepEqual(region.stages.map((stage) => stage.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  assert.throws(() => createWorldRegion('mist-frontier', validStages().slice(0, 9)), /exactly ten stages/i)
  assert.throws(() => createWorldRegion('mist-frontier', [...validStages(), { id: 11, encounter: 'normal' }]), /exactly ten stages/i)

  const outOfOrder = validStages()
  ;[outOfOrder[4], outOfOrder[5]] = [outOfOrder[5], outOfOrder[4]]
  assert.throws(() => createWorldRegion('mist-frontier', outOfOrder), /ordered from one to ten/i)
})

test('createWorldRegion rejects sparse ten-slot stage arrays', () => {
  const sparseStages = new Array(10)
  sparseStages[3] = { id: 4, encounter: 'elite' }
  sparseStages[6] = { id: 7, encounter: 'elite' }
  sparseStages[9] = { id: 10, encounter: 'region-boss' }

  assert.throws(() => createWorldRegion('mist-frontier', sparseStages), /missing world region stage: 1/i)
})

test('createWorldRegion requires exactly two elites and the only regional Boss at stage ten', () => {
  const oneElite = validStages()
  oneElite[6] = { id: 7, encounter: 'normal' }
  assert.throws(() => createWorldRegion('mist-frontier', oneElite), /exactly two elite/i)

  const threeElites = validStages()
  threeElites[1] = { id: 2, encounter: 'elite' }
  assert.throws(() => createWorldRegion('mist-frontier', threeElites), /exactly two elite/i)

  const earlyBoss = validStages()
  earlyBoss[8] = { id: 9, encounter: 'region-boss' }
  earlyBoss[9] = { id: 10, encounter: 'normal' }
  assert.throws(() => createWorldRegion('mist-frontier', earlyBoss), /stage ten.*only regional Boss/i)

  const extraBoss = validStages()
  extraBoss[0] = { id: 1, encounter: 'region-boss' }
  assert.throws(() => createWorldRegion('mist-frontier', extraBoss), /stage ten.*only regional Boss/i)
})

test('createWorldRegion rejects encounter kinds outside the world contract', () => {
  const stages = validStages()
  stages[0] = { id: 1, encounter: 'treasure' }

  assert.throws(() => createWorldRegion('mist-frontier', stages), /unknown world encounter/i)
})

test('createWorldRegion rejects empty and whitespace-only IDs', () => {
  for (const id of ['', '   ', '\t\r\n']) {
    assert.throws(() => createWorldRegion(id, validStages()), /world region ID is required/i)
  }
})

test('highestSelectableStage unlocks one next stage and caps at stage ten', () => {
  const region = createWorldRegion('mist-frontier', validStages())

  assert.equal(highestSelectableStage(0, region), 1)
  assert.equal(highestSelectableStage(4, region), 5)
  assert.equal(highestSelectableStage(10, region), 10)
  assert.equal(highestSelectableStage(99, region), 10)
})

test('selectWorldStage allows cleared stages and only the next uncleared stage', () => {
  const region = createWorldRegion('mist-frontier', validStages())

  assert.deepEqual(selectWorldStage(region, 4, 1), { ok: true, stageId: 1 })
  assert.deepEqual(selectWorldStage(region, 4, 4), { ok: true, stageId: 4 })
  assert.deepEqual(selectWorldStage(region, 4, 5), { ok: true, stageId: 5 })
  assert.deepEqual(selectWorldStage(region, 4, 6), { ok: false, reason: 'locked-stage' })
  assert.deepEqual(selectWorldStage(region, 10, 11), { ok: false, reason: 'unknown-stage' })
})

test('selectWorldStage returns immutable success and failure results', () => {
  const region = createWorldRegion('mist-frontier', validStages())
  const success = selectWorldStage(region, 4, 5)
  const failure = selectWorldStage(region, 4, 6)

  assert.equal(Object.isFrozen(success), true)
  assert.equal(Object.isFrozen(failure), true)
  assert.throws(() => { success.stageId = 10 }, TypeError)
  assert.throws(() => { failure.reason = 'unknown-stage' }, TypeError)
  assert.deepEqual(success, { ok: true, stageId: 5 })
  assert.deepEqual(failure, { ok: false, reason: 'locked-stage' })
})

test('invalid numeric inputs cannot bypass stage locking', () => {
  const region = createWorldRegion('mist-frontier', validStages())

  for (const progress of [NaN, Infinity, -Infinity, -3]) {
    assert.equal(highestSelectableStage(progress, region), 1)
    assert.deepEqual(selectWorldStage(region, progress, 2), { ok: false, reason: 'locked-stage' })
  }
  assert.equal(highestSelectableStage(4.9, region), 5)

  for (const requested of [NaN, Infinity, -Infinity, -1, 0, 1.5]) {
    assert.deepEqual(selectWorldStage(region, 10, requested), { ok: false, reason: 'unknown-stage' })
  }
})

test('createWorldRegion returns a deeply isolated immutable structure', () => {
  const stages = validStages()
  const region = createWorldRegion('  mist-frontier  ', stages)

  stages[0].id = 10
  stages[1].encounter = 'elite'
  stages.push({ id: 11, encounter: 'normal' })

  assert.equal(region.id, 'mist-frontier')
  assert.equal(region.stages.length, 10)
  assert.deepEqual(region.stages[0], { id: 1, encounter: 'normal' })
  assert.deepEqual(region.stages[1], { id: 2, encounter: 'normal' })
  assert.equal(Object.isFrozen(region), true)
  assert.equal(Object.isFrozen(region.stages), true)
  assert.equal(region.stages.every(Object.isFrozen), true)
  assert.throws(() => region.stages.push({ id: 11, encounter: 'normal' }), TypeError)
  assert.throws(() => { region.stages[0].id = 99 }, TypeError)
})
