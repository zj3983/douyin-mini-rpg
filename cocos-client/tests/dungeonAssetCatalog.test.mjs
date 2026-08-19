import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import ts from 'typescript'

const root = resolve(import.meta.dirname, '..')
const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`

async function loadCatalog() {
  const source = readFileSync(resolve(root, 'assets/Scripts/Core/Dungeon/DungeonVisualCatalog.ts'), 'utf8')
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  return import(moduleUrl(javascript))
}

function catalogModuleUrl() {
  const source = readFileSync(resolve(root, 'assets/Scripts/Core/Dungeon/DungeonVisualCatalog.ts'), 'utf8')
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  return moduleUrl(javascript)
}

async function loadResourceRuntime() {
  const catalogUrl = catalogModuleUrl()
  const source = readFileSync(resolve(root, 'assets/Scripts/Game/DungeonResourceController.ts'), 'utf8')
  let javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  javascript = javascript
    .replace(/import \{[^;]+\} from 'cc';?/, '')
    .replace("from '../Core/Dungeon/DungeonVisualCatalog'", `from '${catalogUrl}'`)
  return import(moduleUrl(javascript))
}

function createResourceHarness(DungeonResourceController) {
  const pending = []
  const released = []
  const visible = []
  const controller = new DungeonResourceController({
    load(descriptor) {
      return new Promise((resolveLoad, rejectLoad) => pending.push({ descriptor, resolveLoad, rejectLoad }))
    },
    release(descriptor, resource) {
      released.push({ descriptor, resource })
    },
    showFloor(floor, resources) {
      visible.push({ floor, resources })
    },
  })
  const settle = async () => {
    for (let cycle = 0; cycle < 20; cycle += 1) {
      while (pending.length) {
        const request = pending.shift()
        request.resolveLoad({ path: request.descriptor.path })
      }
      await Promise.resolve()
    }
  }
  return { controller, pending, released, visible, settle }
}

test('mist vault owns three distinct deeply frozen floor visual contracts', async () => {
  const { dungeonFloorVisualFor } = await loadCatalog()
  const visuals = [1, 2, 3].map((floor) => dungeonFloorVisualFor('mist-vault', floor))

  assert.equal(new Set(visuals.map((visual) => visual.farPath)).size, 3)
  assert.equal(new Set(visuals.map((visual) => visual.midPath)).size, 3)
  assert.deepEqual(visuals.map(({ monsterActorIds }) => monsterActorIds), [
    ['moss-wolf', 'green-wing-moth'],
    ['fog-spider', 'lantern-wraith', 'moss-wolf'],
    ['fog-spider', 'lantern-wraith', 'mist-deer-king', 'mist-bamboo-emperor'],
  ])
  for (const visual of visuals) {
    assert.equal(Object.isFrozen(visual), true)
    assert.equal(Object.isFrozen(visual.monsterActorIds), true)
  }
  assert.throws(() => dungeonFloorVisualFor('mist-vault', 0), /floor/i)
  assert.throws(() => dungeonFloorVisualFor('other-vault', 1), /dungeon/i)
})

test('dungeon backgrounds and effects are complete, correctly shaped, and visually distinct', () => {
  const script = String.raw`
import sys
from pathlib import Path
from PIL import Image

root = Path(sys.argv[1]) / "assets/resources/Assets/Dungeon/MistBamboo"
images = [
    *(root / f"Floor{floor}" / layer for floor in (1, 2, 3) for layer in ("far.webp", "mid.webp")),
    root / "Effects/pursuit_edge.png",
    root / "Effects/extraction_array.png",
]

def dhash(image):
    gray = image.convert("L").resize((9, 8), Image.Resampling.LANCZOS)
    values = list(gray.getdata())
    return tuple(values[row * 9 + col] > values[row * 9 + col + 1] for row in range(8) for col in range(8))

hashes = []
for path in images:
    assert path.is_file(), f"missing {path}"
    meta = Path(f"{path}.meta")
    assert meta.is_file(), f"missing {meta}"
    with Image.open(path) as image:
        expected_size = (1254, 1254) if path.name == "extraction_array.png" else (1536, 1024)
        assert image.size == expected_size, f"unexpected dimensions {path}: {image.size}"
        ratio = image.width / image.height
        if path.name == "extraction_array.png":
            assert 0.98 <= ratio <= 1.02, f"extraction array must remain square: {image.size}"
        else:
            assert 1.48 <= ratio <= 1.52, f"wide dungeon art is distorted {path}: {image.size}"
        rgba = image.convert("RGBA")
        alpha = rgba.getchannel("A")
        assert alpha.getbbox() is not None, f"blank alpha {path}"
        if "mid.webp" in path.as_posix() or "Effects" in path.as_posix():
            lo, hi = alpha.getextrema()
            assert lo < 255 and hi > 0, f"expected useful transparency {path}"
        hashes.append(dhash(rgba))
        metadata = __import__('json').loads(meta.read_text(encoding='utf-8'))
        frame = metadata['subMetas']['f9941']['userData']
        assert (frame['rawWidth'], frame['rawHeight']) == image.size, f"stale meta dimensions {meta}"
assert len(set(hashes)) == len(hashes), "dungeon images must have unique perceptual hashes"
boss = Path(sys.argv[1]) / "assets/resources/Assets/ActorAtlases/MistBambooEmperor/atlas.png"
assert boss.is_file(), f"missing {boss}"
assert Path(f"{boss}.meta").is_file(), f"missing {boss}.meta"
with Image.open(boss) as image:
    assert image.size == (2048, 1920), f"unexpected boss atlas size: {image.size}"
    alpha = image.convert("RGBA").getchannel("A")
    assert alpha.getbbox() is not None, "blank boss atlas"
    lo, hi = alpha.getextrema()
    assert lo < 255 and hi > 0, "boss atlas requires transparent padding and visible pixels"
print("dungeon images valid")
`
  const result = spawnSync('python', ['-c', script, '.'], { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stdout || result.stderr)
})

test('pursuit boss uses one atlas with seven complete action contracts', () => {
  const sourceManifest = JSON.parse(readFileSync(resolve(root, 'assets/Data/vertical-slice-animation-sources.json'), 'utf8'))
  const sourceActor = sourceManifest.actors['mist-bamboo-emperor']
  const runtimeManifest = JSON.parse(readFileSync(resolve(root, 'assets/Data/animation-atlas.json'), 'utf8'))
  const actor = runtimeManifest.actors.find((candidate) => candidate.id === 'mist-bamboo-emperor')

  assert.ok(sourceActor)
  assert.equal(sourceActor.packingMode, 'unified')
  assert.ok(actor)
  assert.equal(new Set(actor.actions.map((action) => action.atlas)).size, 1)
  assert.equal(actor.atlas, 'Assets/ActorAtlases/MistBambooEmperor/atlas.png')
  assert.deepEqual(actor.actions.map((action) => action.name), ['idle', 'move', 'sweep', 'spikes', 'roar', 'hurt', 'death'])
  assert.equal(actor.actions.every((action) => action.frames.length >= 6), true)
  assert.equal(existsSync(resolve(root, 'assets/resources', actor.atlas)), true)
  for (const [actionName, action] of Object.entries(sourceActor.actions)) {
    const sourceDir = resolve(root, 'art-source/vertical-slice', action.source)
    assert.equal(existsSync(sourceDir), true, `missing reproducible source directory ${actionName}`)
    const sourceFrames = Array.from({ length: action.frames }, (_, index) => resolve(sourceDir, `${String(index).padStart(2, '0')}.png`))
    assert.equal(sourceFrames.every(existsSync), true, `missing reproducible source frames ${actionName}`)
  }
})

test('pursuit boss source frames rebuild through the reviewed atlas pipeline', () => {
  const script = String.raw`
import importlib.util, json, sys, tempfile
from pathlib import Path
root = Path(sys.argv[1])
spec = importlib.util.spec_from_file_location("builder", root / "tools/build-vertical-slice-atlases.py")
builder = importlib.util.module_from_spec(spec); spec.loader.exec_module(builder)
config = json.loads((root / "assets/Data/vertical-slice-animation-sources.json").read_text("utf-8"))["actors"]["mist-bamboo-emperor"]
with tempfile.TemporaryDirectory() as directory:
    actor = builder.build_actor(config, root / "art-source/vertical-slice", Path(directory) / "resources")
    assert actor["id"] == "mist-bamboo-emperor"
    assert len(actor["actions"]) == 7
    assert sum(len(action["frames"]) for action in actor["actions"]) == 42
print("boss source rebuild ok")
`
  const result = spawnSync('python', ['-c', script, root], { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stdout || result.stderr)
})

test('asset and audio catalogs bind the pursuit boss and three short cues without adding BGM', () => {
  const assets = JSON.parse(readFileSync(resolve(root, 'assets/Data/asset-catalog.json'), 'utf8'))
  const sourceAudio = JSON.parse(readFileSync(resolve(root, 'assets/Data/audio-catalog.json'), 'utf8'))
  const runtimeAudio = JSON.parse(readFileSync(resolve(root, 'assets/resources/Data/audio-catalog.json'), 'utf8'))
  const boss = assets.monsters.find(({ id }) => id === 'mist-bamboo-emperor')

  assert.deepEqual(boss, {
    id: 'mist-bamboo-emperor',
    name: '雾竹皇',
    theme: 'mist-bamboo',
    animationActorId: 'mist-bamboo-emperor',
    skillCue: 'bamboo-emperor-pursuit',
  })
  assert.deepEqual(runtimeAudio, sourceAudio)
  assert.deepEqual(Object.keys(sourceAudio.bgm), ['mist-bamboo'])
  for (const cueId of ['pursuit-warning', 'extraction-start', 'extraction-complete']) {
    const cue = sourceAudio.cues[cueId]
    assert.ok(cue)
    assert.equal(existsSync(resolve(root, `assets/resources/${cue.resource}.wav`)), true)
    assert.equal(existsSync(resolve(root, `assets/resources/${cue.resource}.wav.meta`)), true)
  }
})

test('entry preparation loads only floor one essentials and exposes retry after rollback', async () => {
  const { DungeonResourceController } = await loadResourceRuntime()
  const harness = createResourceHarness(DungeonResourceController)
  const preparing = harness.controller.prepareEntry(['moss-wolf'])
  const requested = harness.pending.map(({ descriptor }) => descriptor.path)

  assert.equal(requested.some((path) => path.includes('/Floor1/')), true)
  assert.equal(requested.some((path) => path.includes('/Floor2/') || path.includes('/Floor3/')), false)
  assert.equal(requested.includes('Assets/Dungeon/MistBamboo/Effects/pursuit_edge/spriteFrame'), true)
  assert.equal(requested.includes('Assets/Dungeon/MistBamboo/Effects/extraction_array/spriteFrame'), true)
  const failed = harness.pending.shift()
  failed.rejectLoad(new Error('network'))
  await Promise.resolve()
  await harness.settle()
  assert.equal(await preparing, false)
  assert.equal(harness.controller.isReady(), false)
  assert.deepEqual(harness.controller.status(), { state: 'retry', error: 'network' })
  assert.ok(harness.released.length > 0)
  assert.deepEqual(harness.controller.snapshot().loadedPaths, [])

  const retrying = harness.controller.retryPreparation()
  await harness.settle()
  assert.equal(await retrying, true)
  assert.equal(harness.controller.isReady(), true)
  assert.equal(harness.controller.status().state, 'ready')
})

test('concurrent retry callers share the same preparation result', async () => {
  const { DungeonResourceController } = await loadResourceRuntime()
  const harness = createResourceHarness(DungeonResourceController)
  const firstPreparation = harness.controller.prepareEntry()
  harness.pending.shift().rejectLoad(new Error('temporary'))
  await harness.settle()
  assert.equal(await firstPreparation, false)

  const firstRetry = harness.controller.retryPreparation()
  const secondRetry = harness.controller.retryPreparation()
  await harness.settle()
  assert.deepEqual(await Promise.all([firstRetry, secondRetry]), [true, true])
})

test('a visible-floor failure releases the detached candidate and remains retryable', async () => {
  const { DungeonResourceController } = await loadResourceRuntime()
  const pending = []
  const released = []
  const controller = new DungeonResourceController({
    load: (descriptor) => new Promise((resolveLoad) => pending.push({ descriptor, resolveLoad })),
    release: (descriptor, resource) => released.push({ descriptor, resource }),
    showFloor: () => { throw new Error('presenter unavailable') },
  })
  const settle = async () => {
    for (let cycle = 0; cycle < 20; cycle += 1) {
      while (pending.length) {
        const request = pending.shift()
        request.resolveLoad({ path: request.descriptor.path })
      }
      await Promise.resolve()
    }
  }
  const preparing = controller.prepareEntry()
  await settle()
  assert.equal(await preparing, true)
  const activating = controller.activateFloor(1)
  await settle()
  assert.equal(await activating, false)
  assert.deepEqual(controller.status(), { state: 'retry', error: 'presenter unavailable' })
  assert.equal(released.some(({ descriptor }) => descriptor.path.includes('/Floor1/')), true)
})

test('floor activation swaps visibly, prefetches one floor, and releases stale references', async () => {
  const { DungeonResourceController } = await loadResourceRuntime()
  const harness = createResourceHarness(DungeonResourceController)
  const preparing = harness.controller.prepareEntry(['moss-wolf', 'green-wing-moth'])
  await harness.settle()
  assert.equal(await preparing, true)

  const first = harness.controller.activateFloor(1)
  await harness.settle()
  assert.equal(await first, true)
  await harness.settle()
  assert.equal(harness.visible.at(-1).floor, 1)
  assert.equal(harness.controller.snapshot().prefetchedFloors.includes(2), true)
  assert.equal(harness.controller.snapshot().retainedFloors.includes(3), false)

  const second = harness.controller.activateFloor(2)
  await harness.settle()
  assert.equal(await second, true)
  await harness.settle()
  assert.equal(harness.visible.at(-1).floor, 2)
  assert.equal(harness.released.some(({ descriptor }) => descriptor.path.includes('/Floor1/')), true)
  assert.equal(harness.controller.snapshot().retainedFloors.includes(1), false)
  assert.equal(harness.controller.snapshot().prefetchedFloors.includes(3), true)
})

test('concurrent stale activation cannot replace the latest floor and destroy releases everything', async () => {
  const { DungeonResourceController } = await loadResourceRuntime()
  const harness = createResourceHarness(DungeonResourceController)
  const preparing = harness.controller.prepareEntry()
  await harness.settle()
  await preparing

  const floor1 = harness.controller.activateFloor(1)
  const floor2 = harness.controller.activateFloor(2)
  const floor2Requests = harness.pending.filter(({ descriptor }) => descriptor.path.includes('/Floor2/'))
  for (const request of floor2Requests) request.resolveLoad({ path: request.descriptor.path })
  await Promise.resolve()
  await harness.settle()
  await Promise.all([floor1, floor2])

  assert.equal(harness.visible.at(-1).floor, 2)
  assert.equal(harness.visible.some(({ floor }, index) => floor === 1 && index > harness.visible.findIndex((entry) => entry.floor === 2)), false)
  harness.controller.destroy()
  await harness.settle()
  const snapshot = harness.controller.snapshot()
  assert.equal(snapshot.destroyed, true)
  assert.deepEqual(snapshot.retainedFloors, [])
  assert.deepEqual(snapshot.pendingFloors, [])
})

test('an older asynchronous floor presentation cannot overwrite the latest floor', async () => {
  const { DungeonResourceController } = await loadResourceRuntime()
  const deferredPresentations = []
  const visible = []
  const controller = new DungeonResourceController({
    load: (descriptor) => Promise.resolve({ path: descriptor.path }),
    release: () => {},
    showFloor: (floor) => new Promise((resolveShow) => deferredPresentations.push({ floor, resolveShow }))
      .then(() => visible.push(floor)),
  })
  assert.equal(await controller.prepareEntry(), true)

  const first = controller.activateFloor(1)
  await Promise.resolve()
  const second = controller.activateFloor(2)
  for (let index = 0; index < 10; index += 1) await Promise.resolve()
  const simultaneousSecond = deferredPresentations.find(({ floor }) => floor === 2)
  const firstPresentation = deferredPresentations.find(({ floor }) => floor === 1)
  if (simultaneousSecond) {
    simultaneousSecond.resolveShow()
    await Promise.resolve()
    firstPresentation?.resolveShow()
    for (let index = 0; index < 10; index += 1) await Promise.resolve()
  } else {
    firstPresentation.resolveShow()
    for (let index = 0; index < 10; index += 1) await Promise.resolve()
    deferredPresentations.find(({ floor }) => floor === 2).resolveShow()
  }
  assert.deepEqual(await Promise.all([first, second]), [false, true])
  assert.equal(visible.at(-1), 2)
  assert.equal(controller.snapshot().activeFloor, 2)
})

test('a completed stale prefetch is released instead of returning after the player skips ahead', async () => {
  const { DungeonResourceController } = await loadResourceRuntime()
  const deferredFloorTwo = []
  const released = []
  const controller = new DungeonResourceController({
    load(descriptor) {
      if (descriptor.path.includes('/Floor2/')) {
        return new Promise((resolveLoad) => deferredFloorTwo.push({ descriptor, resolveLoad }))
      }
      return Promise.resolve({ path: descriptor.path })
    },
    release: (descriptor, resource) => released.push({ descriptor, resource }),
    showFloor: () => {},
  })

  assert.equal(await controller.prepareEntry(), true)
  assert.equal(await controller.activateFloor(1), true)
  await Promise.resolve()
  assert.ok(deferredFloorTwo.length > 0)
  assert.equal(await controller.activateFloor(3), true)
  for (const request of deferredFloorTwo.splice(0)) request.resolveLoad({ path: request.descriptor.path })
  for (let index = 0; index < 10; index += 1) await Promise.resolve()

  assert.equal(controller.snapshot().retainedFloors.includes(2), false)
  assert.equal(controller.snapshot().prefetchedFloors.includes(2), false)
  assert.equal(released.some(({ descriptor }) => descriptor.path.includes('/Floor2/')), true)
})
