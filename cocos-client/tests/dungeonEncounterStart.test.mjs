import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import ts from 'typescript'

async function loadRuntime() {
  const source = readFileSync(resolve('assets/Scripts/Core/Dungeon/DungeonEncounterStart.ts'), 'utf8')
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`)
}

test('successful dungeon encounter start does not invoke recovery', async () => {
  const { startDungeonEncounterWithRecovery } = await loadRuntime()
  let recoveries = 0

  assert.equal(startDungeonEncounterWithRecovery(() => true, () => { recoveries += 1 }), true)
  assert.equal(recoveries, 0)
})

test('false dungeon encounter start recovers and stays retryable', async () => {
  const { startDungeonEncounterWithRecovery } = await loadRuntime()
  let recoveries = 0

  assert.equal(startDungeonEncounterWithRecovery(() => false, () => { recoveries += 1 }), false)
  assert.equal(recoveries, 1)
})

test('throwing dungeon encounter start recovers instead of escaping', async () => {
  const { startDungeonEncounterWithRecovery } = await loadRuntime()
  let recoveries = 0

  assert.equal(
    startDungeonEncounterWithRecovery(() => { throw new Error('pool unavailable') }, () => { recoveries += 1 }),
    false,
  )
  assert.equal(recoveries, 1)
})
