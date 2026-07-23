import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { resolveBossTelegraphVisual, talismanPulse } from '../tools/boss-telegraph-visual-profile.mjs'

const expectedSpirit = [141, 232, 218, 190]
const expectedImpact = [255, 240, 189, 245]
const canonicalPulseCases = [
  { name: 'invalid duration', args: [Number.NaN, Number.NaN], expected: { progress: 0, alpha: 0.54, hot: false } },
  { name: 'remaining above duration', args: [0.8, 2], expected: { progress: 0, alpha: 0.54, hot: false } },
  { name: 'negative remaining', args: [0.8, -1], expected: { progress: 1, alpha: 0.72, hot: true } },
  { name: 'interior cold progress', args: [0.8, 0.4], expected: { progress: 0.5, alpha: 0.66, hot: false } },
  { name: 'just before hot threshold', args: [0.8, 0.151], expected: { progress: 0.811, alpha: 0.735, hot: false } },
  { name: 'at hot threshold', args: [0.8, 0.15], expected: { progress: 0.813, alpha: 0.903, hot: true } },
  { name: 'just inside hot threshold', args: [0.8, 0.149], expected: { progress: 0.814, alpha: 0.898, hot: true } },
  { name: 'interior hot progress', args: [0.8, 0.1], expected: { progress: 0.875, alpha: 0.579, hot: true } },
  { name: 'completion', args: [0.8, 0], expected: { progress: 1, alpha: 0.72, hot: true } },
]

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
  for (const pulseCase of canonicalPulseCases) {
    assert.deepEqual(talismanPulse(...pulseCase.args), pulseCase.expected, pulseCase.name)
  }
})

test('talisman pulse reuses an optional output object without changing two-argument behavior', () => {
  const output = { progress: -1, alpha: -1, hot: false }
  const reused = talismanPulse(0.8, 0.4, output)

  assert.strictEqual(reused, output)
  assert.deepEqual(output, { progress: 0.5, alpha: 0.66, hot: false })
  assert.notStrictEqual(talismanPulse(0.8, 0.4), talismanPulse(0.8, 0.4))
})

test('resolved profiles and RGBA tuples resist runtime mutation', () => {
  for (const kind of ['sweep', 'spike', 'roar-sector']) {
    const profile = resolveBossTelegraphVisual({ kind })
    assert.equal(Object.isFrozen(profile), true)
    assert.equal(Object.isFrozen(profile.warning), true)
    assert.equal(Object.isFrozen(profile.spirit), true)
    assert.equal(Object.isFrozen(profile.impact), true)
  }

  const sweep = resolveBossTelegraphVisual({ kind: 'sweep' })
  assert.throws(() => { sweep.glyph = '镇' }, TypeError)
  assert.throws(() => { sweep.warning[0] = 0 }, TypeError)
  assert.throws(() => { sweep.spirit[0] = 0 }, TypeError)
  assert.throws(() => { sweep.impact[0] = 0 }, TypeError)
  assert.deepEqual(resolveBossTelegraphVisual({ kind: 'sweep' }), {
    id: 'sweep-seal',
    glyph: '斩',
    talismanPath: 'Assets/Skills/BossDomain/talisman_sweep/spriteFrame',
    warning: [232, 190, 88, 220],
    spirit: expectedSpirit,
    impact: expectedImpact,
  })
})

test('TypeScript source stays behaviorally consistent with the ESM mirror', async () => {
  const source = await readFile(new URL('../assets/Scripts/Core/BossTelegraphVisualProfile.ts', import.meta.url), 'utf8')
  assert.match(source, /readonly glyph: '斩' \| '突' \| '镇'/)
  assert.match(source, /const PROFILES = Object\.freeze\(/)
  const executable = stripTypeScriptTypes(source, { mode: 'transform' })
  const tsRuntime = await import(`data:text/javascript;base64,${Buffer.from(executable).toString('base64')}`)
  const kinds = ['sweep', 'spike', 'roar-sector', 'unknown']

  for (const kind of kinds.slice(0, 3)) {
    const profile = tsRuntime.resolveBossTelegraphVisual({ kind })
    assert.equal(Object.isFrozen(profile), true)
    assert.equal(Object.isFrozen(profile.warning), true)
    assert.equal(Object.isFrozen(profile.spirit), true)
    assert.equal(Object.isFrozen(profile.impact), true)
  }

  assert.deepEqual(
    kinds.map(kind => tsRuntime.resolveBossTelegraphVisual({ kind })),
    kinds.map(kind => resolveBossTelegraphVisual({ kind })),
  )
  assert.deepEqual(
    canonicalPulseCases.map(pulseCase => tsRuntime.talismanPulse(...pulseCase.args)),
    canonicalPulseCases.map(pulseCase => talismanPulse(...pulseCase.args)),
  )
  const esmOutput = { progress: -1, alpha: -1, hot: false }
  const tsOutput = { progress: -1, alpha: -1, hot: false }
  assert.strictEqual(talismanPulse(0.8, 0.1, esmOutput), esmOutput)
  assert.strictEqual(tsRuntime.talismanPulse(0.8, 0.1, tsOutput), tsOutput)
  assert.deepEqual(tsOutput, esmOutput)
})
