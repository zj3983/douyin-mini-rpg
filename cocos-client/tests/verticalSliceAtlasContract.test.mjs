import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const expectedActors = {
  'qinglan-sword-cultivator': {
    masterFrameSize: [512, 640],
    runtimeFrameSize: [256, 320],
    actions: { idle: 8, sword_ride: 10, hand_seal: 10, cast: 12, hurt: 6, death: 10 },
    sourceModes: {
      idle: 'layered-keyframes',
      sword_ride: 'layered-keyframes',
      hand_seal: 'layered-keyframes',
      cast: 'layered-keyframes',
      hurt: 'layered-keyframes',
      death: 'layered-keyframes',
    },
  },
  'moss-wolf': {
    masterFrameSize: [384, 480],
    runtimeFrameSize: [256, 320],
    actions: { idle: 6, move: 8, telegraph: 4, attack: 8, hurt: 4, death: 8 },
    sourceModes: {
      idle: 'pose-video',
      move: 'pose-video',
      telegraph: 'pose-video',
      attack: 'pose-video',
      hurt: 'frame-sequence',
      death: 'frame-sequence',
    },
  },
  'green-wing-moth': {
    masterFrameSize: [384, 480],
    runtimeFrameSize: [256, 320],
    actions: { idle: 6, move: 8, dive: 8, cast: 8, hurt: 4, death: 8 },
    sourceModes: Object.fromEntries(['idle', 'move', 'dive', 'cast', 'hurt', 'death'].map((name) => [name, 'frame-sequence'])),
  },
  'bamboo-warden': {
    masterFrameSize: [768, 960],
    runtimeFrameSize: [384, 480],
    actions: { idle: 8, move: 10, sweep: 12, spikes: 12, roar: 12, hurt: 6, death: 12 },
    sourceModes: Object.fromEntries(['idle', 'move', 'sweep', 'spikes', 'roar', 'hurt', 'death'].map((name) => [name, 'frame-sequence'])),
  },
  'mist-bamboo-emperor': {
    masterFrameSize: [256, 320],
    runtimeFrameSize: [256, 320],
    actions: { idle: 6, move: 6, sweep: 6, spikes: 6, roar: 6, hurt: 6, death: 6 },
    sourceModes: {
      idle: 'pose-video',
      move: 'pose-video',
      sweep: 'pose-video',
      spikes: 'pose-video',
      roar: 'pose-video',
      hurt: 'frame-sequence',
      death: 'frame-sequence',
    },
    quality: {
      maxCenterDrift: 0.1,
      maxScaleDrift: 0.16,
      minAlphaCoverage: 0.02,
      maxAlphaCoverage: 0.76,
      safePadding: 0.1,
    },
    packingMode: 'unified',
  },
}

const expectedQuality = {
  maxCenterDrift: 0.08,
  maxScaleDrift: 0.12,
  minAlphaCoverage: 0.02,
  maxAlphaCoverage: 0.72,
  safePadding: 0.08,
}

function loadSources() {
  return JSON.parse(readFileSync(resolve('assets/Data/vertical-slice-animation-sources.json'), 'utf8'))
}

test('vertical slice source manifest locks actor frame sizes anchors and action counts', () => {
  const source = loadSources()
  assert.equal(source.version, 2)
  assert.deepEqual(Object.keys(source.actors).sort(), Object.keys(expectedActors).sort())

  for (const [actorId, expected] of Object.entries(expectedActors)) {
    const actor = source.actors[actorId]
    assert.deepEqual(actor.masterFrameSize, expected.masterFrameSize, actorId)
    assert.deepEqual(actor.runtimeFrameSize, expected.runtimeFrameSize, actorId)
    assert.equal(actor.masterFrameSize[0] * 5, actor.masterFrameSize[1] * 4, `${actorId} master is 4:5`)
    assert.equal(actor.runtimeFrameSize[0] * 5, actor.runtimeFrameSize[1] * 4, `${actorId} runtime is 4:5`)
    assert.deepEqual(Object.fromEntries(Object.entries(actor.actions).map(([name, action]) => [name, action.frames])), expected.actions)
    assert.deepEqual(actor.quality, expected.quality ?? expectedQuality, `${actorId} quality`)
    assert.equal(actor.packingMode ?? 'per-action', expected.packingMode ?? 'per-action', `${actorId} packing mode`)
    assert.deepEqual(
      Object.fromEntries(Object.entries(actor.actions).map(([name, action]) => [name, action.sourceMode])),
      expected.sourceModes,
      `${actorId} source modes`,
    )
    assert.equal(typeof actor.anchor?.x, 'number', `${actorId} anchor.x`)
    assert.equal(typeof actor.anchor?.y, 'number', `${actorId} anchor.y`)
    assert.ok(actor.anchor.x >= 0 && actor.anchor.x <= 1, `${actorId} anchor.x range`)
    assert.ok(actor.anchor.y >= 0 && actor.anchor.y <= 1, `${actorId} anchor.y range`)
  }

  assert.deepEqual(source.actors['qinglan-sword-cultivator'].actions.hand_seal.events, [
    { name: 'seal-formed', time: 0.6 },
  ])
  assert.deepEqual(source.actors['qinglan-sword-cultivator'].actions.cast.events, [
    { name: 'sword-release', time: 0.42 },
  ])
  assert.deepEqual(source.actors['qinglan-sword-cultivator'].actions.cast.quality, {
    maxScaleDrift: 0.17,
  })
  assert.deepEqual(source.actors['moss-wolf'].actions.attack.quality, {
    maxScaleDrift: 0.20,
  })
  assert.deepEqual(source.actors['moss-wolf'].actions.death.quality, {
    maxCenterDrift: 0.14,
  })
  assert.deepEqual(source.actors['qinglan-sword-cultivator'].actions.hand_seal.order, [0, 0, 1, 1, 7, 7, 7, 9, 9, 9])
  assert.deepEqual(source.actors['qinglan-sword-cultivator'].actions.cast.order, [0, 0, 1, 1, 5, 5, 6, 6, 9, 9, 10, 11])
  assert.deepEqual(source.actors['moss-wolf'].actions.death.order, [0, 1, 2, 3, 3, 3, 3, 3])

  const overrides = []
  for (const [actorId, actor] of Object.entries(source.actors)) {
    for (const [actionName, action] of Object.entries(actor.actions)) {
      if (action.quality) overrides.push(`${actorId}/${actionName}`)
    }
  }
  assert.deepEqual(overrides.sort(), [
    'mist-bamboo-emperor/death',
    'mist-bamboo-emperor/hurt',
    'mist-bamboo-emperor/spikes',
    'mist-bamboo-emperor/sweep',
    'moss-wolf/attack',
    'moss-wolf/death',
    'qinglan-sword-cultivator/cast',
  ])
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

  const qinglan = actors.get('qinglan-sword-cultivator')
  assert.deepEqual(qinglan.actions.find(({ name }) => name === 'hand_seal').events, [
    { name: 'seal-formed', at: 0.6 },
  ])
  assert.deepEqual(qinglan.actions.find(({ name }) => name === 'cast').events, [
    { name: 'sword-release', at: 0.42 },
  ])
})
