import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

import { computeBattleLayout, computeBossVisualPlacement } from '../assets/Scripts/Combat/BattleLayout.ts'

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
  transform = {
    contentSize: { width: 210, height: 336 },
    setContentSize: (width, height) => { this.transform.contentSize = { width, height } },
  }

  constructor(controller) { this.controller = controller }
  setPosition(x, y, z) { this.position = typeof x === 'object' ? { ...x } : { x, y, z } }
  setScale() {}
  setRotationFromEuler() {}
  on() {}
  off() {}
  emit() {}
  getComponent(Type) {
    if (Type.name === 'EnemyController') return this.controller
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
  const node = new SpawnNode(controller)
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

  const expected = computeBossVisualPlacement(resized, { width: 210, height: 336 }).position
  assert.deepEqual({ x: node.position.x, y: node.position.y }, expected)
  assert.deepEqual(synced.at(-1), { x: expected.x, y: expected.y, z: 0 })
})
