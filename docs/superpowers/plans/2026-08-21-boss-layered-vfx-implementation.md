# Boss Layered VFX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Boss `斩 / 突 / 镇` glyph sprites with three readable, layered xianxia skill effects while preserving combat timing, hit areas, pool capacity, and mobile performance.

**Architecture:** Keep `BossBrain` and hitbox authority unchanged. Extend the pure visual profile with phase data and named resource layers, give each pooled hazard node four reusable sprite layers plus one `Graphics` layer, and have `BossTelegraphPresenter` drive warning, critical, burst, and dissipate motion from normalized time without per-frame allocation.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, Cocos `Graphics`/`Sprite`/`NodePool`, Node test runner, transparent PNG resources, Playwright-style in-app browser verification.

---

## File Map

- Modify `cocos-client/assets/Scripts/Core/BossTelegraphVisualProfile.ts`: define glyph-free profiles, layer paths, phase calculation, and reusable output types.
- Modify `cocos-client/tools/boss-telegraph-visual-profile.mjs`: keep the executable ESM mirror aligned with the TypeScript profile.
- Modify `cocos-client/assets/Scripts/Game/BossHazardVisualController.ts`: own and reset four fixed sprite layers without creating objects during `update`.
- Modify `cocos-client/assets/Scripts/Game/BossTelegraphPresenter.ts`: preload unique layer resources and animate each skill through warning, critical, burst, and dissipate phases.
- Modify `cocos-client/assets/Scripts/Game/BattleRuntimeController.ts`: pass the existing adaptive VFX quality into Boss warning and impact presentation.
- Modify `cocos-client/assets/Scripts/Game/PortraitBattleBootstrap.ts`: construct the four sprite children once in the hazard pool factory.
- Create seven PNGs under `cocos-client/assets/resources/Assets/Skills/BossDomain/`: reusable glyph-free VFX textures.
- Create matching `.meta` files through Cocos import for all seven PNGs.
- Replace `cocos-client/tests/bossTalismanAssets.test.mjs` with `cocos-client/tests/bossSkillVfxAssets.test.mjs`: validate transparency, padding, dimensions, diversity, and removal of the retired glyph resources.
- Modify `cocos-client/tests/bossTelegraphVisualProfile.test.mjs`: verify profile resources and phase values.
- Modify `cocos-client/tests/bossHazardVisualController.test.mjs`: verify four-layer binding and complete pool reset.
- Modify `cocos-client/tests/bossTelegraphPresenter.test.mjs`: verify preload ownership, phase animation, skill-specific motion, fallback behavior, and pool invariants.
- Modify `cocos-client/tests/cocosStructure.test.mjs`: require the new resource closure and reject retired talisman paths.
- Modify `cocos-client/tests/buildOutput.test.mjs`: validate that the built resource catalog contains all new sprite frames.
- Modify `cocos-client/tools/check-cocos-build-readiness.mjs`: require source PNGs and their Cocos metadata.
- Modify `cocos-client/tools/check-cocos-build-output.mjs`: verify compiled markers and built VFX asset UUIDs.

### Task 1: Define Glyph-Free Profiles and Phase Timing

**Files:**
- Modify: `cocos-client/tests/bossTelegraphVisualProfile.test.mjs`
- Modify: `cocos-client/assets/Scripts/Core/BossTelegraphVisualProfile.ts`
- Modify: `cocos-client/tools/boss-telegraph-visual-profile.mjs`

- [ ] **Step 1: Write failing profile tests**

Replace glyph assertions with the exact layer contract and add canonical phase cases:

```js
const sweep = resolveBossTelegraphVisual({ kind: 'sweep' })
assert.deepEqual(sweep.resources, {
  main: 'Assets/Skills/BossDomain/sweep_arc/spriteFrame',
  accent: 'Assets/Skills/BossDomain/sweep_trail/spriteFrame',
  particle: 'Assets/Skills/BossDomain/leaf_particle/spriteFrame',
})
assert.equal('glyph' in sweep, false)
assert.equal('talismanPath' in sweep, false)

const output = { progress: 0, phase: 'warning', intensity: 0, travel: 0 }
assert.strictEqual(bossVfxPhase(0.8, 0.8, output), output)
assert.deepEqual(output, { progress: 0, phase: 'warning', intensity: 0.32, travel: 0 })
assert.deepEqual(bossVfxPhase(0.8, 0.2), {
  progress: 0.75,
  phase: 'critical',
  intensity: 0.813,
  travel: 0.25,
})
```

Assert that all profile objects, nested resource objects, and RGBA tuples are frozen and that no source line contains a glyph field or `talisman_` resource path.

- [ ] **Step 2: Run the focused test and observe the expected failure**

Run: `node --test tests/bossTelegraphVisualProfile.test.mjs`

Expected: FAIL because `bossVfxPhase` and `resources` do not exist and the old glyph fields remain.

- [ ] **Step 3: Implement the pure profile contract in TypeScript**

Use these public types and function names:

```ts
export type BossTelegraphVisualId = 'sweep-arc' | 'spike-eruption' | 'roar-wave'
export type BossVfxPhaseName = 'warning' | 'critical'

export interface BossVfxResources {
  readonly main: string
  readonly accent: string
  readonly particle: string
}

export interface BossVfxPhaseOutput {
  progress: number
  phase: BossVfxPhaseName
  intensity: number
  travel: number
}

export interface BossTelegraphVisualProfile {
  readonly id: BossTelegraphVisualId
  readonly resources: BossVfxResources
  readonly quality: Readonly<{
    readonly reducedAccent: boolean
    readonly minimalParticles: boolean
  }>
  readonly warning: Rgba
  readonly spirit: Rgba
  readonly impact: Rgba
}

export function bossVfxPhase(
  duration: number,
  remaining: number,
  out?: BossVfxPhaseOutput,
): BossVfxPhaseOutput {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 1
  const finiteRemaining = Number.isFinite(remaining) ? remaining : safeDuration
  const safeRemaining = Math.min(safeDuration, Math.max(0, finiteRemaining))
  const progress = round3(1 - safeRemaining / safeDuration)
  const critical = progress >= 0.7
  const result = out ?? { progress: 0, phase: 'warning', intensity: 0, travel: 0 }
  result.progress = progress
  result.phase = critical ? 'critical' : 'warning'
  result.intensity = round3(critical ? 0.7 + (progress - 0.7) : 0.32 + progress * 0.48)
  result.travel = round3(critical ? (progress - 0.7) / 0.3 : 0)
  return result
}
```

Define the three resource combinations exactly as in the test and use `Object.freeze` on every nested resource and quality object. Set `reducedAccent` to `true` only for the main attack silhouette and set `minimalParticles` to `false` so minimal mode keeps boundary plus main shape while hiding both decorative particle layers.

- [ ] **Step 4: Mirror the same public data and phase function in the ESM helper**

Update `cocos-client/tools/boss-telegraph-visual-profile.mjs` with the same profile IDs, paths, formulas, clamping, rounding, and optional output reuse. Do not retain `talismanPulse` as an alias because the retired term must disappear from runtime and tests.

- [ ] **Step 5: Run the focused tests**

Run: `node --test tests/bossTelegraphVisualProfile.test.mjs`

Expected: PASS with all canonical phase cases and TypeScript/ESM parity checks green.

- [ ] **Step 6: Commit the profile change**

```text
git add cocos-client/assets/Scripts/Core/BossTelegraphVisualProfile.ts cocos-client/tools/boss-telegraph-visual-profile.mjs cocos-client/tests/bossTelegraphVisualProfile.test.mjs
git commit -m "refactor: define glyph-free boss vfx profiles"
```

### Task 2: Create and Validate the VFX Texture Set

**Files:**
- Create: `cocos-client/assets/resources/Assets/Skills/BossDomain/sweep_arc.png`
- Create: `cocos-client/assets/resources/Assets/Skills/BossDomain/sweep_trail.png`
- Create: `cocos-client/assets/resources/Assets/Skills/BossDomain/spike_cluster.png`
- Create: `cocos-client/assets/resources/Assets/Skills/BossDomain/ground_dust.png`
- Create: `cocos-client/assets/resources/Assets/Skills/BossDomain/roar_wave.png`
- Create: `cocos-client/assets/resources/Assets/Skills/BossDomain/leaf_particle.png`
- Create: `cocos-client/assets/resources/Assets/Skills/BossDomain/impact_spark.png`
- Create: matching `.png.meta` files through Cocos import
- Delete: `cocos-client/assets/resources/Assets/Skills/BossDomain/talisman_sweep.png`
- Delete: `cocos-client/assets/resources/Assets/Skills/BossDomain/talisman_sweep.png.meta`
- Delete: `cocos-client/assets/resources/Assets/Skills/BossDomain/talisman_spike.png`
- Delete: `cocos-client/assets/resources/Assets/Skills/BossDomain/talisman_spike.png.meta`
- Delete: `cocos-client/assets/resources/Assets/Skills/BossDomain/talisman_roar.png`
- Delete: `cocos-client/assets/resources/Assets/Skills/BossDomain/talisman_roar.png.meta`
- Replace: `cocos-client/tests/bossTalismanAssets.test.mjs`
- Create: `cocos-client/tests/bossSkillVfxAssets.test.mjs`

- [ ] **Step 1: Write the failing VFX asset test**

Test all seven paths with `decodePngRgba` and enforce:

```js
assert.ok(image.width >= 256 && image.width <= 1024)
assert.ok(image.height >= 256 && image.height <= 1024)
assert.ok(alpha.includes(0), `${relativePath} needs transparent background`)
assert.ok(alpha.some(value => value > 180), `${relativePath} needs a readable core`)
assert.ok(visibleWidthRatio <= 0.9 && visibleHeightRatio <= 0.9)
assert.ok(bytes.length <= 500_000, `${relativePath} exceeds mobile PNG budget`)
```

Also assert that the three retired `talisman_*.png` paths do not exist and that all seven decoded pixel hashes are distinct.

- [ ] **Step 2: Run the test and observe missing-resource failures**

Run: `node --test tests/bossSkillVfxAssets.test.mjs`

Expected: FAIL listing the seven absent PNGs.

- [ ] **Step 3: Generate a coherent transparent source sheet**

Use image generation with this art direction: semi-realistic Chinese xianxia mobile-game VFX, cyan jade and pale gold energy, crisp luminous cores, translucent edges, no scene background, no character, no writing, no rune, no logo, no UI frame. Generate one sheet whose separated subjects are: broad crescent sword arc, two thin trailing arcs, jagged rock-and-bamboo spike cluster, low ground dust, curved pressure-wave ribbon, bamboo leaf group, compact white-gold impact sparks.

- [ ] **Step 4: Extract and clean seven runtime PNGs**

Crop each subject with at least 8% transparent padding, remove residual background color, premultiply-safe clean the RGB values of fully transparent pixels, resize the long side to 512 pixels, and optimize without changing RGBA content semantics. Keep the sword arc horizontal and the spike cluster upright.

- [ ] **Step 5: Import resources through Cocos Creator**

Open the project with Cocos Creator 3.8.8 and allow the asset database to produce `.png.meta` files. Verify each meta exposes the `/spriteFrame` subasset and uses trimmed sprite settings that preserve transparent padding.

- [ ] **Step 6: Run asset validation**

Run: `node --test tests/bossSkillVfxAssets.test.mjs`

Expected: PASS for dimensions, transparency, padding, encoded size, distinct hashes, and retired resource removal.

- [ ] **Step 7: Visually inspect all seven PNGs**

Open a contact sheet on a checkerboard background. Reject any asset containing text-like marks, opaque corners, white fringe, cropped glow, or a photographic scene background.

- [ ] **Step 8: Commit the resource set**

```text
git add cocos-client/assets/resources/Assets/Skills/BossDomain cocos-client/tests/bossSkillVfxAssets.test.mjs
git add -u cocos-client/tests/bossTalismanAssets.test.mjs
git commit -m "art: replace boss glyphs with layered vfx textures"
```

### Task 3: Upgrade Each Pooled Hazard to Four Fixed Layers

**Files:**
- Modify: `cocos-client/tests/bossHazardVisualController.test.mjs`
- Modify: `cocos-client/assets/Scripts/Game/BossHazardVisualController.ts`
- Modify: `cocos-client/assets/Scripts/Game/PortraitBattleBootstrap.ts`

- [ ] **Step 1: Write failing controller tests**

Build a real Cocos mock node with `mainShape`, `accent`, `particleNear`, and `particleFar` sprites. Set distinct frames, colors, sizes, positions, scales, rotations, and opacities, despawn through `NodePoolController`, then assert every layer returns to:

```js
{
  spriteFrame: null,
  color: { r: 255, g: 255, b: 255, a: 0 },
  position: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
  rotation: 0,
}
```

Assert the bootstrap factory creates exactly four sprite children and assigns each to the matching controller property.

- [ ] **Step 2: Run the controller test and observe the expected failure**

Run: `node --test tests/bossHazardVisualController.test.mjs`

Expected: FAIL because only `talisman` exists.

- [ ] **Step 3: Implement fixed layer ownership**

Expose these properties and methods:

```ts
@property(Sprite) mainShape: Sprite | null = null
@property(Sprite) accent: Sprite | null = null
@property(Sprite) particleNear: Sprite | null = null
@property(Sprite) particleFar: Sprite | null = null

resetVisual(): void
setLayerFrames(main: SpriteFrame | null, accent: SpriteFrame | null, particle: SpriteFrame | null): void
setLayerSizes(width: number, height: number): void
```

`resetVisual` must reuse module-level transparent white color components through `Color#set` where possible; it must clear all sprite frames and reset transforms on all four existing child nodes. `setLayerFrames` assigns the particle frame to both particle layers so no extra resource is loaded.

- [ ] **Step 4: Update the pool factory**

Replace `Talisman` with children named `MainShape`, `Accent`, `ParticleNear`, and `ParticleFar`. Add one `UITransform` and one `Sprite` to each child, add them to the hazard root once, and bind them to `BossHazardVisualController` before calling `resetVisual`.

- [ ] **Step 5: Run controller and structure tests**

Run: `node --test tests/bossHazardVisualController.test.mjs tests/cocosStructure.test.mjs`

Expected: PASS; repeated pool despawn leaves no stale layer state.

- [ ] **Step 6: Commit the pooled-layer change**

```text
git add cocos-client/assets/Scripts/Game/BossHazardVisualController.ts cocos-client/assets/Scripts/Game/PortraitBattleBootstrap.ts cocos-client/tests/bossHazardVisualController.test.mjs cocos-client/tests/cocosStructure.test.mjs
git commit -m "feat: add pooled layers for boss skill effects"
```

### Task 4: Animate Skill-Specific Warning and Impact Phases

**Files:**
- Modify: `cocos-client/tests/bossTelegraphPresenter.test.mjs`
- Modify: `cocos-client/assets/Scripts/Game/BossTelegraphPresenter.ts`
- Modify: `cocos-client/assets/Scripts/Game/BattleRuntimeController.ts`

- [ ] **Step 1: Replace presenter mocks with four-layer controller mocks**

The mock controller must record `setLayerFrames`, `setLayerSizes`, and mutable layer transforms. Update `visualIdForFrame` to use `sweep_arc`, `spike_cluster`, and `roar_wave` resource IDs.

- [ ] **Step 2: Write failing preload and fallback tests**

Assert `onLoad` preloads the seven unique resource paths exactly once, late loads affect only subsequent effects, every acquired frame receives one owned ref per presenter, and missing accent/particle resources still leave the main `Graphics` warning and normal activation lifecycle intact.

- [ ] **Step 3: Write failing phase-motion tests**

For a sweep warning, assert progress changes accent scale and particle positions without changing the authoritative node position, size, or `Graphics` command list. For spike impact, assert the main layer rises from below while accent dust expands horizontally. For roar impacts with wave indices 0, 1, and 2, assert increasing travel offsets and decreasing retained alpha distinguish the three waves.

- [ ] **Step 4: Write a failing no-allocation update test**

Capture Cocos `Color` construction count, component lookup count, resource-load count, and references to reusable phase/color outputs. Run 120 updates and assert none of those counts increase and the output object identities remain stable.

Add a quality-routing test that calls `present(delivery, 'full')`, `present(delivery, 'reduced')`, and `present(delivery, 'minimal')`. Assert full mode shows all four layers, reduced mode hides `particleFar`, and minimal mode hides both particle layers plus the accent while retaining `Graphics` and `mainShape`.

- [ ] **Step 5: Run presenter tests and observe the expected failures**

Run: `node --test tests/bossTelegraphPresenter.test.mjs`

Expected: FAIL on old three-path preload, missing four-layer calls, and unchanged transforms.

- [ ] **Step 6: Implement unique resource preloading**

Collect `main`, `accent`, and `particle` paths from the three frozen profiles into one startup list. Store owned `SpriteFrame` references in `vfxFrames`, keep the existing late-callback destruction guard, and release each owned reference exactly once in `onDestroy`.

- [ ] **Step 7: Implement warning geometry and phase updates**

Keep root node geometry equal to `delivery.area`. Route to `drawSweepWarning`, `drawSpikeWarning`, and `drawRoarWarning`; draw only thin boundaries/cracks/safe-gap edges. Cache controller and four sprites when the effect is created. During `update`, call `bossVfxPhase` into a reused output and mutate only cached color and node transforms.

- [ ] **Step 8: Implement burst and dissipate updates**

Extend `ImpactVisual` with `duration`, `profile`, `controller`, two reusable colors, and one reusable motion output. Use normalized remaining time to apply:

```text
sweep: main travels 0% -> 82% of area width; accent trails by 12%; particles drift opposite the slash
spike: main y rises -38% -> 8% of area height; accent x scale grows 0.55 -> 1.2
roar: main and accent expand 0.72 -> 1.18; particle layers rotate in opposite directions; older waves fade faster
```

The movement is visual-only; do not alter root node position, root size, activation order, or impact duration.

- [ ] **Step 9: Route the existing adaptive quality into Boss effects**

Accept `quality: VfxQuality = 'full'` as the final argument of `present` and `activate`, store it with each visual, and apply the profile's quality policy without changing the root node. Update `BattleRuntimeController` to call:

```ts
this.bossTelegraphPresenter?.present(telegraph, this.currentVfxQuality)
this.bossTelegraphPresenter?.activate(this.stageGeneration, enemyId, command, this.currentVfxQuality)
```

This reuses `PerformanceBudget.ts`; do not introduce a second frame-time monitor.

- [ ] **Step 10: Preserve pool capacity at phase-two peak**

Run: `node --test tests/bossTelegraphPresenter.test.mjs`

Expected: PASS including 256 seeds, three delta partitions, both component update orders, `BOSS_HAZARD_POOL_CAPACITY === 18`, and no same-frame impact despawn.

- [ ] **Step 11: Commit presenter animation**

```text
git add cocos-client/assets/Scripts/Game/BossTelegraphPresenter.ts cocos-client/assets/Scripts/Game/BattleRuntimeController.ts cocos-client/tests/bossTelegraphPresenter.test.mjs
git commit -m "feat: animate layered boss skill phases"
```

### Task 5: Update Build Closure and Verify the Complete Game

**Files:**
- Modify: `cocos-client/tools/check-cocos-build-readiness.mjs`
- Modify: `cocos-client/tools/check-cocos-build-output.mjs`
- Modify: `cocos-client/tests/cocosStructure.test.mjs`
- Modify: `cocos-client/tests/buildOutput.test.mjs`
- Rebuild: `cocos-client/build/web-mobile/**`

- [ ] **Step 1: Write failing build-closure tests**

Replace the three talisman entries with the seven VFX assets. For each asset, resolve its source meta UUID and sprite-frame UUID, then assert the built settings map exposes `Assets/Skills/BossDomain/<name>/spriteFrame` and that corresponding import and native artifacts exist. Add a negative fixture for one omitted VFX path and one wrong UUID.

- [ ] **Step 2: Run closure tests and observe the expected failure**

Run: `node --test tests/cocosStructure.test.mjs tests/buildOutput.test.mjs`

Expected: FAIL because readiness and output checks still require talisman assets.

- [ ] **Step 3: Update readiness and build-output checks**

Require all seven PNG/meta pairs, compiled markers `BossTelegraphVisualProfile`, `BossTelegraphPresenter`, and `BossHazardVisualController`, and every new sprite-frame path. Reject any built settings entry containing `/talisman_`.

- [ ] **Step 4: Run the complete unit suite**

Run: `npm.cmd test`

Expected: all tests pass, with only the repository's explicitly documented skip remaining.

- [ ] **Step 5: Run pre-build checks and rebuild**

Run: `npm.cmd run build:check`

Expected: PASS with no missing resource or metadata.

Run: `npm.cmd run build:douyin`

Expected: Cocos Creator build exits successfully and updates `build/web-mobile`.

- [ ] **Step 6: Verify built output and resource budget**

Run: `npm.cmd run verify:build-output`

Expected: PASS for compiled feature markers and all seven VFX resource artifacts.

Run: `npm.cmd run report:size`

Expected: no new size-budget violation; record the exact BossDomain native PNG total.

- [ ] **Step 7: Serve and test the real build at 390x844**

Open the built game, reach the first Boss, and capture warning, burst, and dissipate moments for all three skills. Verify:

```text
no 斩/突/镇 glyphs
three skills distinguishable without labels
safe gap remains readable
player, Boss, and flying sword remain visible
Boss takes and deals damage normally
no missing-resource console errors
no visible freeze at skill activation
```

Use a canvas-pixel check on each capture to confirm the battle canvas is nonblank and not stretched.

- [ ] **Step 8: Commit build closure and verified output**

```text
git add cocos-client/tools/check-cocos-build-readiness.mjs cocos-client/tools/check-cocos-build-output.mjs cocos-client/tests/cocosStructure.test.mjs cocos-client/tests/buildOutput.test.mjs cocos-client/build/web-mobile
git commit -m "build: ship layered boss skill effects"
```

- [ ] **Step 9: Review the final diff**

Run: `git diff --check HEAD~5..HEAD`

Expected: no whitespace errors. Confirm no unrelated generated files, user work, secrets, or retired glyph PNGs are staged.
