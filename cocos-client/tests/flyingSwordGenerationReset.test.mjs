import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`

const ccSource = `
export const _decorator = {
  ccclass: () => (Type) => Type,
  property: (...args) => args.length >= 2 ? undefined : () => undefined,
}
export class Component { constructor() { this.node = null } }
export class Node {}
`

class EventNode {
  constructor() { this.listeners = new Map(); this.events = [] }
  on(name, callback, context) {
    const listeners = this.listeners.get(name) ?? []
    listeners.push({ callback, context })
    this.listeners.set(name, listeners)
  }
  off(name, callback, context) {
    const listeners = this.listeners.get(name) ?? []
    this.listeners.set(name, listeners.filter((entry) => entry.callback !== callback || entry.context !== context))
  }
  emit(name, ...args) {
    this.events.push([name, ...args])
    for (const entry of [...(this.listeners.get(name) ?? [])]) entry.callback.call(entry.context, ...args)
  }
  listenerCount(name) { return this.listeners.get(name)?.length ?? 0 }
}

async function loadFlyingSwordSkill() {
  const source = await readFile(new URL('../assets/Scripts/Game/FlyingSwordSkill.ts', import.meta.url), 'utf8')
  const ccUrl = moduleUrl(ccSource)
  const artifactUrl = new URL('../assets/Scripts/Combat/ArtifactRuntime.ts', import.meta.url).href
  const feedbackUrl = moduleUrl('export function feedbackFor() { return [] }')
  const runtimeUrl = moduleUrl('export class BattleRuntimeController {}')
  let executable = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      experimentalDecorators: true,
    },
  }).outputText
  executable = executable
    .replace("from 'cc'", `from '${ccUrl}'`)
    .replace("from '../Combat/ArtifactRuntime.ts'", `from '${artifactUrl}'`)
    .replace("from '../Combat/FeedbackTimeline.ts'", `from '${feedbackUrl}'`)
    .replace("from './BattleRuntimeController'", `from '${runtimeUrl}'`)
  return import(moduleUrl(executable))
}

function swordNode() {
  return {
    active: false,
    position: { x: 0, y: 0 },
    angle: 0,
    setPosition(x, y) { this.position = { x, y } },
    setRotationFromEuler(_x, _y, angle) { this.angle = angle },
  }
}

function battleRuntime(node, hits) {
  return {
    node,
    isBattleFrozen: () => false,
    getCurrentPlayerPosition: () => ({ x: 0, y: 0 }),
    getLivingSwordTargets: () => [{ id: 'same-id', position: { x: 140, y: 0 }, alive: true }],
    getBattleBounds: () => ({ minX: -360, maxX: 360, minY: -260, maxY: 260 }),
    getCurrentVfxQuality: () => 'full',
    resolveArtifactSwordHit(targetId) { hits.push(targetId); return { hitCount: 1 } },
  }
}

test('FlyingSwordSkill late-binds generation resets and drops stale paths before same-ID enemies can be hit', async () => {
  const { FlyingSwordSkill } = await loadFlyingSwordSkill()
  const skill = new FlyingSwordSkill()
  const skillEvents = new EventNode()
  const runtimeEvents = new EventNode()
  const hits = []
  skill.node = skillEvents
  skill.sword = swordNode()
  skill.onLoad()

  skill.onEnable()
  assert.equal(runtimeEvents.listenerCount('battle-generation-reset'), 0)
  skill.battleRuntime = battleRuntime(runtimeEvents, hits)
  skill.start()
  skill.onEnable()
  assert.equal(runtimeEvents.listenerCount('battle-generation-reset'), 1)

  skill.update(1 / 60)
  const stalePathId = skill.visiblePathId
  assert.ok(stalePathId)
  assert.ok(skill.artifact.activePaths.size > 0)
  assert.equal(skill.sword.active, true)

  runtimeEvents.emit('battle-generation-reset', { generation: 2 })
  assert.equal(skill.artifact.generation, 2)
  assert.equal(skill.artifact.activePaths.size, 0)
  assert.equal(skill.visiblePathId, null)
  assert.equal(skill.casting, false)
  assert.equal(skill.sword.active, false)

  skill.applyArtifactCommand({
    type: 'spawn-sword',
    pathId: stalePathId,
    origin: { x: 20, y: 30 },
    targetId: 'same-id',
  })
  skill.applyArtifactCommand({
    type: 'resolve-sword-hit',
    pathId: stalePathId,
    targetId: 'same-id',
    phase: 'outbound',
  })
  assert.equal(skill.visiblePathId, null)
  assert.equal(skill.sword.active, false)
  assert.deepEqual(hits, [])

  skill.onDisable()
  assert.equal(runtimeEvents.listenerCount('battle-generation-reset'), 0)
  runtimeEvents.emit('battle-generation-reset', { generation: 3 })
  assert.equal(skill.artifact.generation, 2)

  skill.onEnable()
  assert.equal(runtimeEvents.listenerCount('battle-generation-reset'), 1)
  runtimeEvents.emit('battle-generation-reset', { generation: 3 })
  assert.equal(skill.artifact.generation, 3)
  skill.onDestroy()
  skill.onDestroy()
  assert.equal(runtimeEvents.listenerCount('battle-generation-reset'), 0)
})
