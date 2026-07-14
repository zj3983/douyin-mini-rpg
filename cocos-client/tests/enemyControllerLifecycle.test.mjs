import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const ccSource = `
export const _decorator = {
  ccclass: () => (target) => target,
  property: (...args) => args.length >= 2 ? undefined : () => undefined,
}
export class Component {}
export class Node {}
export class Vec3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z }
  clone() { return new Vec3(this.x, this.y, this.z) }
  static distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) }
}
`

class EventNode {
  position = { x: 260, y: -80, z: 0 }
  activeInHierarchy = true
  #listeners = new Map()

  on(event, callback, context) {
    const listeners = this.#listeners.get(event) ?? []
    listeners.push({ callback, context })
    this.#listeners.set(event, listeners)
  }

  off(event, callback, context) {
    const listeners = this.#listeners.get(event) ?? []
    this.#listeners.set(event, listeners.filter((entry) => entry.callback !== callback || entry.context !== context))
  }

  emit(event, ...args) {
    for (const entry of [...(this.#listeners.get(event) ?? [])]) entry.callback.call(entry.context, ...args)
  }

  listenerCount(event) {
    return this.#listeners.get(event)?.length ?? 0
  }

  setPosition(x, y, z) {
    this.position = typeof x === 'object' ? { ...x } : { x, y, z }
  }
}

async function loadEnemyController() {
  const source = await readFile(new URL('../assets/Scripts/Game/EnemyController.ts', import.meta.url), 'utf8')
  let executable = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      experimentalDecorators: true,
    },
  }).outputText
  const ccUrl = `data:text/javascript;base64,${Buffer.from(ccSource).toString('base64')}`
  const brainUrl = new URL('../assets/Scripts/Combat/EnemyBrain.ts', import.meta.url).href
  const facingUrl = new URL('../assets/Scripts/Core/EnemyFacingRuntime.ts', import.meta.url).href
  executable = executable
    .replace("from 'cc'", `from '${ccUrl}'`)
    .replace("from '../Combat/EnemyBrain'", `from '${brainUrl}'`)
    .replace("from '../Core/EnemyFacingRuntime'", `from '${facingUrl}'`)
  return import(`data:text/javascript;base64,${Buffer.from(executable).toString('base64')}`)
}

function binding(seed) {
  return {
    kind: 'moss-wolf',
    seed,
    battleBounds: () => ({ minX: -360, maxX: 360, minY: -140, maxY: 240 }),
    neighbors: () => [],
  }
}

test('EnemyController detaches for pool and rebinds exactly once to the reused enemy identity', async () => {
  const { EnemyController } = await loadEnemyController()
  const node = new EventNode()
  const controller = new EnemyController()
  controller.node = node
  const cancelled = []
  node.on('enemy-attack-cancelled', (enemyId) => cancelled.push(enemyId), null)

  controller.bindRuntimeEnemy({ id: 41, alive: true, position: { x: 0, y: 0 } }, binding(41))
  controller.bindRuntimeEnemy({ id: 41, alive: true, position: { x: 0, y: 0 } }, binding(41))
  assert.equal(node.listenerCount('enemy-hit'), 1)
  assert.equal(node.listenerCount('enemy-defeated'), 1)
  node.emit('enemy-hit')
  assert.deepEqual(cancelled, [41])

  controller.prepareForPool()
  assert.equal(node.listenerCount('enemy-hit'), 0)
  assert.equal(node.listenerCount('enemy-defeated'), 0)
  node.emit('enemy-hit')
  assert.deepEqual(cancelled, [41])

  controller.bindRuntimeEnemy({ id: 52, alive: true, position: { x: 0, y: 0 } }, binding(52))
  assert.equal(node.listenerCount('enemy-hit'), 1)
  assert.equal(node.listenerCount('enemy-defeated'), 1)
  node.emit('enemy-hit')
  assert.deepEqual(cancelled, [41, 52])
})
