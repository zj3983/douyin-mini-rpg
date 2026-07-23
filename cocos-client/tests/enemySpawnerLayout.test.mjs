import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

import {
  computeBattleLayout,
  computeBossVisualPlacement,
  computeOrdinaryEnemySpawn,
} from '../assets/Scripts/Combat/BattleLayout.ts'
import { createEnemyBrain, stepEnemyBrain } from '../assets/Scripts/Combat/EnemyBrain.ts'

const ccSource = `
export const _decorator = {
  ccclass: () => (target) => target,
  property: (...args) => args.length >= 2 ? undefined : () => undefined,
}
export class Component {}
export class Node {}
export class Sprite {}
export class UITransform {}
export class Vec3 {
  static ZERO = new Vec3(0, 0, 0)
  static ONE = new Vec3(1, 1, 1)
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z }
}
export class Color { static WHITE = new Color() }
`

async function loadEnemySpawner() {
  const source = await readFile(new URL('../assets/Scripts/Game/EnemySpawner.ts', import.meta.url), 'utf8')
  let executable = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      experimentalDecorators: true,
    },
  }).outputText
  const moduleUrl = (sourceText) => `data:text/javascript;base64,${Buffer.from(sourceText).toString('base64')}`
  const ccUrl = moduleUrl(ccSource)
  const controllerUrl = moduleUrl('export class EnemyController {}')
  const poolUrl = moduleUrl('export class NodePoolController {}')
  const visualUrl = moduleUrl('export class EnemyVisualController {}')
  const layoutUrl = new URL('../assets/Scripts/Combat/BattleLayout.ts', import.meta.url).href
  executable = executable
    .replace("from 'cc'", `from '${ccUrl}'`)
    .replace("from '../Combat/BattleLayout'", `from '${layoutUrl}'`)
    .replace("from './EnemyController'", `from '${controllerUrl}'`)
    .replace("from './NodePoolController'", `from '${poolUrl}'`)
    .replace("from './EnemyVisualController'", `from '${visualUrl}'`)
  return import(moduleUrl(executable))
}

class SpawnNode {
  position = { x: 0, y: 0, z: 0 }
  controller
  visual
  transform = {
    contentSize: { width: 210, height: 336 },
    setContentSize: (width, height) => { this.transform.contentSize = { width, height } },
  }

  constructor(controller, visual = null) {
    this.controller = controller
    this.visual = visual
  }
  setPosition(x, y, z) { this.position = typeof x === 'object' ? { ...x } : { x, y, z } }
  setScale() {}
  setRotationFromEuler() {}
  on() {}
  off() {}
  emit() {}
  getComponent(Type) {
    if (Type.name === 'EnemyController') return this.controller
    if (Type.name === 'EnemyVisualController') return this.visual
    if (Type.name === 'UITransform') return this.transform
    return null
  }
}

test('EnemySpawner resize moves the visual and synchronizes the active Boss Brain authority', async () => {
  const { EnemySpawner } = await loadEnemySpawner()
  const synced = []
  const controller = {
    bindRuntimeEnemy() {},
    setTarget() {},
    syncBossBattleSpace() { synced.push({ ...node.position }) },
  }
  const node = new SpawnNode(controller, {
    animator: {
      currentFrameSize: () => null,
      animationManifest: {
        json: {
          actors: [{ id: 'bamboo-warden', frameSize: { w: 384, h: 480 } }],
        },
      },
      targetSprite: null,
    },
    resetForSpawn() {},
  })
  const spawner = new EnemySpawner()
  spawner.enemyPool = {
    spawn: () => node,
    activateNode() {},
    hasAvailableSlot: () => true,
  }
  const enemy = {
    id: 101,
    hp: 520,
    alive: true,
    position: { x: 0, y: 0 },
    profile: { id: 'bamboo-warden', role: 'boss' },
  }
  const first = computeBattleLayout({ designWidth: 750, cssWidth: 390, cssHeight: 844, topInsetPx: 47, bottomInsetPx: 34 })
  const resized = computeBattleLayout({ designWidth: 750, cssWidth: 412, cssHeight: 915, topInsetPx: 30, bottomInsetPx: 24 })
  spawner.configureBattleLayout(first)
  spawner.spawnEnemy(enemy)
  spawner.configureBattleLayout(resized)

  const expected = computeBossVisualPlacement(resized, { width: 384, height: 480 }).position
  assert.deepEqual({ x: node.position.x, y: node.position.y }, expected)
  assert.deepEqual(synced.at(-1), { x: expected.x, y: expected.y, z: 0 })
})

test('ordinary spawn uses a complete visible right entry and has no first-frame bounds teleport on supported viewports', async () => {
  const { EnemySpawner } = await loadEnemySpawner()
  const viewports = [
    { cssWidth: 390, cssHeight: 844, topInsetPx: 47, bottomInsetPx: 34 },
    { cssWidth: 360, cssHeight: 800, topInsetPx: 0, bottomInsetPx: 0 },
    { cssWidth: 412, cssHeight: 915, topInsetPx: 30, bottomInsetPx: 24 },
  ]
  for (const [index, viewport] of viewports.entries()) {
    let boundAt = null
    const controller = {
      bindRuntimeEnemy(_enemy, binding) { boundAt = { position: { ...node.position }, binding } },
      setTarget() {},
    }
    const node = new SpawnNode(controller)
    const spawner = new EnemySpawner()
    spawner.enemyPool = { spawn: () => node, activateNode() {}, hasAvailableSlot: () => true }
    const layout = computeBattleLayout({ designWidth: 750, ...viewport })
    spawner.configureBattleLayout(layout)
    const enemy = {
      id: 200 + index,
      hp: 100,
      alive: true,
      position: { x: 520, y: -60 },
      profile: { id: 'moss-wolf', role: 'ground' },
    }
    spawner.spawnEnemy(enemy)

    const expected = computeOrdinaryEnemySpawn(layout, { width: 210, height: 336 }, -60)
    assert.deepEqual(enemy.position, expected)
    assert.deepEqual({ x: node.position.x, y: node.position.y }, expected)
    assert.deepEqual({ x: boundAt.position.x, y: boundAt.position.y }, expected)
    assert.ok(expected.x + 105 <= layout.actorSafeRect.maxX + 1e-9)
    assert.ok(expected.y - 168 >= layout.actorSafeRect.minY - 1e-9)
    assert.ok(expected.y + 168 <= layout.actorSafeRect.maxY + 1e-9)

    const brain = createEnemyBrain('moss-wolf', enemy.id, expected, 19)
    stepEnemyBrain(brain, {
      now: 1 / 60,
      player: { id: 'player', position: { x: -180, y: expected.y }, alive: true },
      neighbors: [],
      battleBounds: layout.actorSafeRect,
    }, 1 / 60)
    assert.ok(Math.hypot(brain.position.x - expected.x, brain.position.y - expected.y) <= 120 / 60 + 1e-9)
  }
})

test('EnemySpawner reuses the versioned neighbor array on stable frames without sorting or reallocating', async () => {
  const { EnemySpawner } = await loadEnemySpawner()
  const spawner = new EnemySpawner()
  const firstSnapshot = Object.freeze({ id: 1, position: Object.freeze({ x: 10, y: 20 }), alive: true })
  const secondSnapshot = Object.freeze({ id: 2, position: Object.freeze({ x: 30, y: 40 }), alive: true })
  spawner.ordinaryControllers.add({ enemyNeighborSnapshot: () => firstSnapshot })
  spawner.ordinaryControllers.add({ enemyNeighborSnapshot: () => secondSnapshot })

  spawner.lateUpdate()
  const first = spawner.livingNeighbors()
  spawner.lateUpdate()
  const stable = spawner.livingNeighbors()
  assert.strictEqual(stable, first)
  assert.deepEqual(stable.map((entry) => entry.id), [1, 2])
  assert.equal(Object.isFrozen(stable), true)
})
