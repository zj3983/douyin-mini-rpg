import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { resolveBossTelegraphVisual, talismanPulse } from '../tools/boss-telegraph-visual-profile.mjs'

const expectedSpirit = [141, 232, 218, 190]
const expectedImpact = [255, 240, 189, 245]

test('boss danger kinds resolve to distinct talisman profiles', () => {
  const sweep = resolveBossTelegraphVisual({ kind: 'sweep' })
  const spike = resolveBossTelegraphVisual({ kind: 'spike' })
  const roar = resolveBossTelegraphVisual({ kind: 'roar-sector' })

  assert.deepEqual([sweep.id, sweep.glyph], ['sweep-seal', '斩'])
  assert.equal(sweep.talismanPath, 'Assets/Skills/BossDomain/talisman_sweep/spriteFrame')
  assert.deepEqual([sweep.warning, sweep.spirit, sweep.impact], [[232, 190, 88, 220], expectedSpirit, expectedImpact])

  assert.deepEqual([spike.id, spike.glyph], ['spike-seal', '突'])
  assert.equal(spike.talismanPath, 'Assets/Skills/BossDomain/talisman_spike/spriteFrame')
  assert.deepEqual([spike.warning, spike.spirit, spike.impact], [[164, 58, 44, 220], expectedSpirit, expectedImpact])

  assert.deepEqual([roar.id, roar.glyph], ['roar-seal', '镇'])
  assert.equal(roar.talismanPath, 'Assets/Skills/BossDomain/talisman_roar/spriteFrame')
  assert.deepEqual([roar.warning, roar.spirit, roar.impact], [[232, 190, 88, 220], expectedSpirit, expectedImpact])
  assert.strictEqual(resolveBossTelegraphVisual({ kind: 'unknown' }), sweep)
})

test('talisman pulse progresses, heats, and clamps invalid values safely', () => {
  assert.deepEqual(talismanPulse(0.8, 0.8), { progress: 0, alpha: 0.54, hot: false })
  assert.equal(talismanPulse(0.8, 0.1).hot, true)
  assert.equal(talismanPulse(0.8, 0).progress, 1)
  assert.deepEqual(talismanPulse(Number.NaN, Number.NaN), { progress: 0, alpha: 0.54, hot: false })
  assert.deepEqual(talismanPulse(-1, -4), { progress: 1, alpha: 0.72, hot: true })
})

test('TypeScript source stays behaviorally consistent with the ESM mirror', async () => {
  const source = await readFile(new URL('../assets/Scripts/Core/BossTelegraphVisualProfile.ts', import.meta.url), 'utf8')
  const executable = stripTypeScriptTypes(source, { mode: 'transform' })
  const tsRuntime = await import(`data:text/javascript;base64,${Buffer.from(executable).toString('base64')}`)
  const kinds = ['sweep', 'spike', 'roar-sector', 'unknown']
  const pulseCases = [[0.8, 0.8], [0.8, 0.1], [0.8, 0], [NaN, Infinity], [-1, -4]]

  assert.deepEqual(
    kinds.map(kind => tsRuntime.resolveBossTelegraphVisual({ kind })),
    kinds.map(kind => resolveBossTelegraphVisual({ kind })),
  )
  assert.deepEqual(
    pulseCases.map(args => tsRuntime.talismanPulse(...args)),
    pulseCases.map(args => talismanPulse(...args)),
  )
})
