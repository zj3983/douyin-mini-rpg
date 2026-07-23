import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const expectedActors = {
  'qinglan-sword-cultivator': {
    masterFrameSize: [512, 640],
    runtimeFrameSize: [256, 320],
    actions: { idle: 8, sword_ride: 10, hand_seal: 10, cast: 12, hurt: 6, death: 10 },
  },
  'moss-wolf': {
    masterFrameSize: [384, 480],
    runtimeFrameSize: [256, 320],
    actions: { idle: 6, move: 8, telegraph: 4, attack: 8, hurt: 4, death: 8 },
  },
  'green-wing-moth': {
    masterFrameSize: [384, 480],
    runtimeFrameSize: [256, 320],
    actions: { idle: 6, move: 8, dive: 8, cast: 8, hurt: 4, death: 8 },
  },
  'bamboo-warden': {
    masterFrameSize: [768, 960],
    runtimeFrameSize: [384, 480],
    actions: { idle: 8, move: 10, sweep: 12, spikes: 12, roar: 12, hurt: 6, death: 12 },
  },
}

function loadSources() {
  return JSON.parse(readFileSync(resolve('assets/Data/vertical-slice-animation-sources.json'), 'utf8'))
}

test('vertical slice source manifest locks actor frame sizes anchors and action counts', () => {
  const source = loadSources()
  assert.equal(source.version, 1)
  assert.deepEqual(Object.keys(source.actors).sort(), Object.keys(expectedActors).sort())

  for (const [actorId, expected] of Object.entries(expectedActors)) {
    const actor = source.actors[actorId]
    assert.deepEqual(actor.masterFrameSize, expected.masterFrameSize, actorId)
    assert.deepEqual(actor.runtimeFrameSize, expected.runtimeFrameSize, actorId)
    assert.equal(actor.masterFrameSize[0] * 5, actor.masterFrameSize[1] * 4, `${actorId} master is 4:5`)
    assert.equal(actor.runtimeFrameSize[0] * 5, actor.runtimeFrameSize[1] * 4, `${actorId} runtime is 4:5`)
    assert.deepEqual(Object.fromEntries(Object.entries(actor.actions).map(([name, action]) => [name, action.frames])), expected.actions)
    assert.equal(typeof actor.anchor?.x, 'number', `${actorId} anchor.x`)
    assert.equal(typeof actor.anchor?.y, 'number', `${actorId} anchor.y`)
    assert.ok(actor.anchor.x >= 0 && actor.anchor.x <= 1, `${actorId} anchor.x range`)
    assert.ok(actor.anchor.y >= 0 && actor.anchor.y <= 1, `${actorId} anchor.y range`)
  }
})

test('stage-one runtime manifest is ready for the four production actor packs', () => {
  const manifest = JSON.parse(readFileSync(resolve('assets/Data/animation-atlas.json'), 'utf8'))
  const actors = new Map(manifest.actors.map((actor) => [actor.id, actor]))

  for (const [actorId, expected] of Object.entries(expectedActors)) {
    const actor = actors.get(actorId)
    assert.ok(actor, `${actorId} exists in runtime manifest`)
    for (const [actionName] of Object.entries(expected.actions)) {
      assert.ok(actor.actions.some((action) => action.name === actionName), `${actorId}/${actionName}`)
    }
  }
})
