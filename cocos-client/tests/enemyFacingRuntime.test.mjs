import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'

const runtimeUrl = new URL('../tools/enemy-facing-runtime.mjs', import.meta.url)

test('facing follows the player on both sides and crosses cleanly', async () => {
  const { updateEnemyFacing } = await import(runtimeUrl)
  assert.equal(updateEnemyFacing(1, 10, 0, 2), -1)
  assert.equal(updateEnemyFacing(-1, 10, 20, 2), 1)
  assert.equal(updateEnemyFacing(1, 10, 0, 2), -1)
})

test('dead-zone jitter and invalid coordinates preserve previous facing', async () => {
  const { updateEnemyFacing } = await import(runtimeUrl)
  assert.equal(updateEnemyFacing(-1, 10, 11, 2), -1)
  assert.equal(updateEnemyFacing(1, 10, 9, 2), 1)
  assert.equal(updateEnemyFacing(-1, Number.NaN, 20, 2), -1)
  assert.equal(updateEnemyFacing(1, 10, Number.POSITIVE_INFINITY, 2), 1)

  let facing = -1
  for (let index = 0; index < 20; index += 1) {
    facing = updateEnemyFacing(facing, 0, index % 2 ? 0.01 : -0.01, 0.1)
  }
  assert.equal(facing, -1)
})

test('TypeScript and executable mirrors have behavioral parity', async () => {
  const source = await readFile(new URL('../assets/Scripts/Core/EnemyFacingRuntime.ts', import.meta.url), 'utf8')
  const executable = stripTypeScriptTypes(source, { mode: 'transform' })
  const tsRuntime = await import(`data:text/javascript;base64,${Buffer.from(executable).toString('base64')}`)
  const esmRuntime = await import(runtimeUrl)
  const cases = [[-1, 0, -5, 1], [-1, 0, 5, 1], [1, 0, 0.5, 1], [-1, NaN, 1, 1]]
  assert.deepEqual(cases.map(args => tsRuntime.updateEnemyFacing(...args)), cases.map(args => esmRuntime.updateEnemyFacing(...args)))
})

test('controller wiring uses live world positions and emits facing without scaling the root', async () => {
  const enemy = await readFile(new URL('../assets/Scripts/Game/EnemyController.ts', import.meta.url), 'utf8')
  const visual = await readFile(new URL('../assets/Scripts/Game/EnemyVisualController.ts', import.meta.url), 'utf8')
  assert.match(enemy, /@property\s+facingDeadZone\s*=/)
  assert.match(enemy, /updateEnemyFacing\([^,]+,\s*current\.x,\s*liveTarget\.x,\s*this\.facingDeadZone\)/)
  assert.match(enemy, /this\.node\.emit\(['"]enemy-facing['"],\s*this\.facing\)/)
  assert.doesNotMatch(enemy, /this\.node\.setScale/)
  assert.match(visual, /this\.node\.on\(['"]enemy-facing['"],\s*this\.onEnemyFacing/)
  assert.match(visual, /this\.animator\?\.targetSprite\?\.node/)
  assert.doesNotMatch(visual, /this\.node\.setScale/)
})

test('visual facing commands leave root and boss scale data independent', async () => {
  const runtime = await import('../tools/visual-reset-runtime.mjs')
  const state = runtime.setVisualFacing({ ...runtime.createVisualResetState(), localScale: { x: 2.5, y: 3, z: 4 } }, 1)
  assert.deepEqual(runtime.visualResetCommands(state).scale, { x: 2.5, y: 3, z: 4 })
  assert.deepEqual(state.localScale, { x: 2.5, y: 3, z: 4 })
})
