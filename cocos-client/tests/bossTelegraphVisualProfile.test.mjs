import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import * as esmRuntime from '../tools/boss-telegraph-visual-profile.mjs'

const expectedSpirit = [141, 232, 218, 190]
const expectedImpact = [255, 240, 189, 245]
const expectedQuality = { reducedAccent: true, minimalParticles: false }
const expectedProfiles = {
  sweep: {
    id: 'sweep-arc',
    resources: {
      main: 'Assets/Skills/BossDomain/sweep_arc/spriteFrame',
      accent: 'Assets/Skills/BossDomain/sweep_trail/spriteFrame',
      particle: 'Assets/Skills/BossDomain/leaf_particle/spriteFrame',
    },
    quality: expectedQuality,
    warning: [232, 190, 88, 220],
    spirit: expectedSpirit,
    impact: expectedImpact,
  },
  spike: {
    id: 'spike-eruption',
    resources: {
      main: 'Assets/Skills/BossDomain/spike_cluster/spriteFrame',
      accent: 'Assets/Skills/BossDomain/ground_dust/spriteFrame',
      particle: 'Assets/Skills/BossDomain/impact_spark/spriteFrame',
    },
    quality: expectedQuality,
    warning: [164, 58, 44, 220],
    spirit: expectedSpirit,
    impact: expectedImpact,
  },
  'roar-sector': {
    id: 'roar-wave',
    resources: {
      main: 'Assets/Skills/BossDomain/roar_wave/spriteFrame',
      accent: 'Assets/Skills/BossDomain/ground_dust/spriteFrame',
      particle: 'Assets/Skills/BossDomain/leaf_particle/spriteFrame',
    },
    quality: expectedQuality,
    warning: [232, 190, 88, 220],
    spirit: expectedSpirit,
    impact: expectedImpact,
  },
}
const canonicalPhaseCases = [
  { name: 'start', args: [0.8, 0.8], expected: { progress: 0, phase: 'warning', intensity: 0.32, travel: 0 } },
  { name: 'warning interior', args: [0.8, 0.4], expected: { progress: 0.5, phase: 'warning', intensity: 0.56, travel: 0 } },
  { name: 'just before critical threshold', args: [0.8, 0.241], expected: { progress: 0.699, phase: 'warning', intensity: 0.656, travel: 0 } },
  { name: 'at critical threshold', args: [0.8, 0.24], expected: { progress: 0.7, phase: 'critical', intensity: 0.7, travel: 0 } },
  { name: 'critical interior', args: [0.8, 0.2], expected: { progress: 0.75, phase: 'critical', intensity: 0.75, travel: 0.167 } },
  { name: 'completion', args: [0.8, 0], expected: { progress: 1, phase: 'critical', intensity: 1, travel: 1 } },
  { name: 'invalid duration', args: [Number.NaN, Number.NaN], expected: { progress: 0, phase: 'warning', intensity: 0.32, travel: 0 } },
  { name: 'remaining above duration', args: [0.8, 2], expected: { progress: 0, phase: 'warning', intensity: 0.32, travel: 0 } },
  { name: 'negative remaining', args: [0.8, -1], expected: { progress: 1, phase: 'critical', intensity: 1, travel: 1 } },
]

test('boss danger kinds resolve to distinct glyph-free resource profiles', () => {
  for (const kind of ['sweep', 'spike', 'roar-sector']) {
    const profile = esmRuntime.resolveBossTelegraphVisual({ kind })
    assert.deepEqual(profile, expectedProfiles[kind])
    assert.equal('glyph' in profile, false)
    assert.equal('talismanPath' in profile, false)
    assert.doesNotMatch(JSON.stringify(profile), /talisman_/)
  }

  assert.strictEqual(
    esmRuntime.resolveBossTelegraphVisual({ kind: 'unknown' }),
    esmRuntime.resolveBossTelegraphVisual({ kind: 'sweep' }),
  )
})

test('boss VFX phase progresses through warning and critical phases with safe clamping', () => {
  assert.equal(typeof esmRuntime.bossVfxPhase, 'function')
  for (const phaseCase of canonicalPhaseCases) {
    assert.deepEqual(esmRuntime.bossVfxPhase(...phaseCase.args), phaseCase.expected, phaseCase.name)
  }
})

test('boss VFX phase reuses an optional output object without changing two-argument behavior', () => {
  const output = { progress: -1, phase: 'warning', intensity: -1, travel: -1 }
  const reused = esmRuntime.bossVfxPhase(0.8, 0.2, output)

  assert.strictEqual(reused, output)
  assert.deepEqual(output, { progress: 0.75, phase: 'critical', intensity: 0.75, travel: 0.167 })
  assert.notStrictEqual(esmRuntime.bossVfxPhase(0.8, 0.2), esmRuntime.bossVfxPhase(0.8, 0.2))
})

test('profiles, resources, quality policies, and RGBA tuples resist runtime mutation', () => {
  for (const kind of ['sweep', 'spike', 'roar-sector']) {
    const profile = esmRuntime.resolveBossTelegraphVisual({ kind })
    assert.equal(Object.isFrozen(profile), true)
    assert.equal(Object.isFrozen(profile.resources), true)
    assert.equal(Object.isFrozen(profile.quality), true)
    assert.equal(Object.isFrozen(profile.warning), true)
    assert.equal(Object.isFrozen(profile.spirit), true)
    assert.equal(Object.isFrozen(profile.impact), true)
  }

  const sweep = esmRuntime.resolveBossTelegraphVisual({ kind: 'sweep' })
  assert.throws(() => { sweep.id = 'roar-wave' }, TypeError)
  assert.throws(() => { sweep.resources.main = 'replacement' }, TypeError)
  assert.throws(() => { sweep.quality.reducedAccent = false }, TypeError)
  assert.throws(() => { sweep.warning[0] = 0 }, TypeError)
  assert.throws(() => { sweep.spirit[0] = 0 }, TypeError)
  assert.throws(() => { sweep.impact[0] = 0 }, TypeError)
  assert.deepEqual(sweep, expectedProfiles.sweep)
})

test('TypeScript declares the public glyph-free contract and omits retired runtime terms', async () => {
  const typeScriptSource = await readFile(new URL('../assets/Scripts/Core/BossTelegraphVisualProfile.ts', import.meta.url), 'utf8')
  const esmSource = await readFile(new URL('../tools/boss-telegraph-visual-profile.mjs', import.meta.url), 'utf8')

  assert.match(typeScriptSource, /export type BossTelegraphVisualId = 'sweep-arc' \| 'spike-eruption' \| 'roar-wave'/)
  assert.match(typeScriptSource, /export type BossVfxPhaseName = 'warning' \| 'critical'/)
  assert.match(typeScriptSource, /export interface BossVfxResources\s*\{\s*readonly main: string\s*readonly accent: string\s*readonly particle: string\s*\}/s)
  assert.match(typeScriptSource, /export interface BossVfxPhaseOutput\s*\{\s*progress: number\s*phase: BossVfxPhaseName\s*intensity: number\s*travel: number\s*\}/s)
  assert.match(typeScriptSource, /export interface BossTelegraphVisualProfile\s*\{\s*readonly id: BossTelegraphVisualId\s*readonly resources: BossVfxResources\s*readonly quality: Readonly<\{\s*readonly reducedAccent: boolean\s*readonly minimalParticles: boolean\s*\}>\s*readonly warning: Rgba\s*readonly spirit: Rgba\s*readonly impact: Rgba\s*\}/s)

  for (const source of [typeScriptSource, esmSource]) {
    assert.doesNotMatch(source, /\bglyph\s*:/)
    assert.doesNotMatch(source, /\btalismanPath\b/)
    assert.doesNotMatch(source, /talisman_/)
    assert.doesNotMatch(source, /\btalismanPulse\b/)
  }
})

test('TypeScript source stays behaviorally consistent with the ESM mirror', async () => {
  const source = await readFile(new URL('../assets/Scripts/Core/BossTelegraphVisualProfile.ts', import.meta.url), 'utf8')
  const executable = stripTypeScriptTypes(source, { mode: 'transform' })
  const tsRuntime = await import(`data:text/javascript;base64,${Buffer.from(executable).toString('base64')}`)
  const kinds = ['sweep', 'spike', 'roar-sector', 'unknown']

  for (const kind of kinds.slice(0, 3)) {
    const profile = tsRuntime.resolveBossTelegraphVisual({ kind })
    assert.equal(Object.isFrozen(profile), true)
    assert.equal(Object.isFrozen(profile.resources), true)
    assert.equal(Object.isFrozen(profile.quality), true)
    assert.equal(Object.isFrozen(profile.warning), true)
    assert.equal(Object.isFrozen(profile.spirit), true)
    assert.equal(Object.isFrozen(profile.impact), true)
  }

  assert.deepEqual(
    kinds.map(kind => tsRuntime.resolveBossTelegraphVisual({ kind })),
    kinds.map(kind => esmRuntime.resolveBossTelegraphVisual({ kind })),
  )
  assert.deepEqual(
    canonicalPhaseCases.map(phaseCase => tsRuntime.bossVfxPhase(...phaseCase.args)),
    canonicalPhaseCases.map(phaseCase => esmRuntime.bossVfxPhase(...phaseCase.args)),
  )
  const esmOutput = { progress: -1, phase: 'warning', intensity: -1, travel: -1 }
  const tsOutput = { progress: -1, phase: 'warning', intensity: -1, travel: -1 }
  assert.strictEqual(esmRuntime.bossVfxPhase(0.8, 0.2, esmOutput), esmOutput)
  assert.strictEqual(tsRuntime.bossVfxPhase(0.8, 0.2, tsOutput), tsOutput)
  assert.deepEqual(tsOutput, esmOutput)
  assert.equal('talismanPulse' in esmRuntime, false)
  assert.equal('talismanPulse' in tsRuntime, false)
})
