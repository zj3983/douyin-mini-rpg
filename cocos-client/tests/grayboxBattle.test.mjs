import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path) => readFileSync(resolve(path), 'utf8')

test('graybox controller wires the new battle core to cocos nodes', () => {
  const source = read('assets/Scripts/Game/GrayboxBattleController.ts')

  assert.match(source, /class GrayboxBattleController/)
  assert.match(source, /createBattleSession\(STAGE_ONE/)
  assert.match(source, /tickBattleSession\(this\.session, deltaTime\)/)
  assert.match(source, /Node\.EventType\.TOUCH_END/)
  assert.match(source, /convertToNodeSpaceAR/)
  assert.match(source, /setMoveTarget\(this\.session\.player/)
  assert.match(source, /requestSettleContinue/)
  assert.match(source, /Graphics/)
  assert.match(source, /update\(deltaTime: number\)/)
})

test('graybox controller renders telegraphs, settlement countdown, and defeat restart', () => {
  const source = read('assets/Scripts/Game/GrayboxBattleController.ts')

  assert.match(source, /drawTelegraphs/)
  assert.match(source, /sweepFan/)
  assert.match(source, /roarWave/)
  assert.match(source, /settleElapsed/)
  assert.match(source, /rebuildSession/)
  assert.match(source, /'settle'/)
  assert.match(source, /'defeated'/)
  assert.match(source, /'enemy-death'/)
})
