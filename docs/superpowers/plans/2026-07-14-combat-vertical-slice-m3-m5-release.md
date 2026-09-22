# Combat Vertical Slice M3-M5 Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add readable high-impact artifact feedback, original xianxia sound, resource/performance controls, mobile playtesting, and a verified production deployment for stage 1.

**Architecture:** Presentation consumes typed combat events through bounded pools and a frame-time quality budget. Original WAV assets are generated offline and loaded per stage through one audio controller. Automated domain simulation, source contracts, Playwright mobile checks, the game Agent, Cocos export checks, and live smoke tests form one release gate.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, Python standard audio libraries, Node test runner, Playwright, existing GitHub deployment workflow.

---

### Task 1: Combat Feedback Timeline and Bounded VFX Pools

**Files:**
- Create: `cocos-client/assets/Scripts/Combat/FeedbackTimeline.ts`
- Create: `cocos-client/assets/Scripts/Combat/PerformanceBudget.ts`
- Create: `cocos-client/tests/feedbackTimeline.test.mjs`
- Create: `cocos-client/tests/performanceBudget.test.mjs`
- Create: `cocos-client/art-source/vertical-slice/vfx/{sword-trail,sword-impact,bamboo-sweep,bamboo-spikes,mountain-roar}.png`
- Create generated: `cocos-client/assets/resources/Assets/Vfx/StageOne/**`
- Create: `cocos-client/assets/Scripts/Game/CombatVfxController.ts`
- Modify: `cocos-client/assets/Scripts/Game/NodePoolController.ts`
- Modify: `cocos-client/assets/Scripts/Game/DamageNumberController.ts`
- Modify: `cocos-client/assets/Scripts/Game/FlyingSwordSkill.ts`

- [ ] **Step 1: Write failing feedback and degradation tests**

Assert cast cue at `0ms`, launch near `60ms`, first impact near `140ms`, hit stop clamped to `35..50ms`, and return audio after impact. Assert regular hits request no shake, elite breaks at most `2px`, and Boss breaks at most `5px`. At P95 above 20ms, particles and debris reduce before sword body, actor silhouette, or telegraph visibility.

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/feedbackTimeline.test.mjs tests/performanceBudget.test.mjs`.

- [ ] **Step 3: Implement pure feedback requests**

```ts
export type VfxQuality = 'full' | 'reduced' | 'minimal'
export interface PerformanceBudget {
  quality: VfxQuality
  frameSamples: number[]
  healthyWindows: number
}
export interface FeedbackRequest {
  kind: 'cast-cue' | 'sword-trail' | 'impact' | 'hit-stop' | 'camera-kick' | 'damage-number'
  strength: number
  durationMs: number
  position?: Point2
}
export function feedbackFor(event: CombatEvent, quality: VfxQuality): FeedbackRequest[]
export function updateVfxQuality(state: PerformanceBudget, frameMs: number): VfxQuality
```

- [ ] **Step 4: Generate readable xianxia skill assets and render through bounded pools**

Use the `imagegen` skill with the Qinglan and Boss references. Generate transparent sprite sheets for a narrow cyan-white sword trail, metal-and-qi sword impact, crescent bamboo sweep, sequential earth-breaking bamboo spikes, and a pale wind-pressure roar with a clearly open safe sector. Keep every effect directional and tied to its attack; do not use unrelated water waves, triangles, or full opaque circles.

Create capacities for sword trails `24`, impacts `24`, damage numbers `32`, soul orbs `24`, and Boss effects `12`. Overflow drops optional debris first and never allocates an unbounded node. Remove giant centered skill banners and unrelated rings, triangles, and water-wave overlays.

- [ ] **Step 5: Verify and commit**

Run: `node --test tests/feedbackTimeline.test.mjs tests/performanceBudget.test.mjs tests/pooling.test.mjs tests/playableBattle.test.mjs`.

```bash
git add cocos-client/art-source/vertical-slice/vfx cocos-client/assets/resources/Assets/Vfx/StageOne cocos-client/assets/Scripts/Combat cocos-client/assets/Scripts/Game cocos-client/tests/feedbackTimeline.test.mjs cocos-client/tests/performanceBudget.test.mjs
git commit -m "feat: add bounded xianxia combat feedback"
```

### Task 2: Original Xianxia Audio Pack and Audio Controller

**Files:**
- Create: `cocos-client/tools/generate-cultivation-audio.py`
- Create generated: `cocos-client/assets/resources/Audio/MistBamboo/bamboo-rain.wav`
- Create generated: `cocos-client/assets/resources/Audio/MistBamboo/mountain-wind.wav`
- Create generated: `cocos-client/assets/resources/Audio/MistBamboo/stage-theme.wav`
- Create generated: `cocos-client/assets/resources/Audio/MistBamboo/boss-theme.wav`
- Create generated: `cocos-client/assets/resources/Audio/Combat/{hand-seal,sword-launch,sword-hit,sword-return,enemy-hit,boss-break}.wav`
- Create: `cocos-client/assets/Data/audio-catalog.json`
- Create: `cocos-client/assets/Scripts/Game/CombatAudioController.ts`
- Create: `cocos-client/tests/cultivationAudio.test.mjs`

- [ ] **Step 1: Write failing audio contract tests**

Parse WAV headers and assert mono or stereo PCM, `22050` or `44100` Hz, nonzero samples, peak below clipping, loop assets at least 45 seconds, one-shot assets between 80ms and 2 seconds, and every catalog path exists.

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/cultivationAudio.test.mjs`.

- [ ] **Step 3: Generate an original pentatonic audio set**

The Python generator uses a D-G-A-C-D pentatonic pitch set, Karplus-Strong plucks for guqin-like notes, breath-filtered tones for xiao phrases, low drum impulses, filtered noise for bamboo rain and wind, and decaying partials for distant bells. Seed generation with `20260714` so output bytes are reproducible. Keep stage and Boss music as separate loops; do not synthesize electronic UI beeps.

- [ ] **Step 4: Bind audio to combat events and browser unlock**

`CombatAudioController` unlocks on the first pointer event, loads only the active stage catalog, limits repeated hit sounds to four concurrent voices with a 45ms per-key cooldown, crossfades stage/Boss music over 800ms, and silently degrades with one diagnostic warning per missing key.

- [ ] **Step 5: Verify and commit**

Run: `python tools/generate-cultivation-audio.py --check` from `cocos-client`.

Run: `node --test tests/cultivationAudio.test.mjs`.

```bash
git add cocos-client/tools/generate-cultivation-audio.py cocos-client/assets/resources/Audio cocos-client/assets/Data/audio-catalog.json cocos-client/assets/Scripts/Game/CombatAudioController.ts cocos-client/tests/cultivationAudio.test.mjs
git commit -m "feat: add original cultivation combat audio"
```

### Task 3: Final Stage Cadence, Boss Entry, and Compact Settlement

**Files:**
- Modify: `cocos-client/assets/Data/stage-one-combat.json`
- Modify: `cocos-client/assets/resources/Data/stage-one-combat.json`
- Modify: `cocos-client/assets/Scripts/Game/StageClearPanelController.ts`
- Modify: `cocos-client/assets/Scripts/Game/VerticalSliceBattleController.ts`
- Create: `cocos-client/tests/stageOneSimulation.test.mjs`
- Modify: `cocos-client/tests/playableBattle.test.mjs`

- [ ] **Step 1: Add a deterministic 90-second balance test**

Run 100 seeds. Require at least 95 simulations to reach Boss between 59 and 62 seconds and settle between 84 and 90 seconds. Require no simulation to exceed 18 live enemies, emit damage outside active hitboxes, or advance the stage twice.

- [ ] **Step 2: Run and verify RED against current tuning**

Run: `node --test tests/stageOneSimulation.test.mjs`.

- [ ] **Step 3: Tune cadence through JSON only**

Adjust spawn cadence, health, telegraph, cooldown, and flying-sword damage in `stage-one-combat.json`. Do not add timing constants to Cocos controllers. Keep first cast visible during the first 3 seconds, pressure phase at 40 seconds, and Boss entry near 60 seconds.

- [ ] **Step 4: Implement one-shot compact settlement**

The panel fits within `560x320` design units, lists reward values on one line, exposes an immediate continue button, shows `3`, `2`, `1`, and invokes `requestNextStage()` exactly once whether timeout and click occur in the same frame.

- [ ] **Step 5: Verify and commit**

Run: `node --test tests/stageOneSimulation.test.mjs tests/playableBattle.test.mjs`.

```bash
git add cocos-client/assets/Data/stage-one-combat.json cocos-client/assets/resources/Data/stage-one-combat.json cocos-client/assets/Scripts/Game/StageClearPanelController.ts cocos-client/assets/Scripts/Game/VerticalSliceBattleController.ts cocos-client/tests/stageOneSimulation.test.mjs cocos-client/tests/playableBattle.test.mjs
git commit -m "feat: finalize stage one cadence and settlement"
```

### Task 4: Stage Resource Lifecycle and Performance Gate

**Files:**
- Modify: `cocos-client/assets/Scripts/Core/StageResourceRuntime.ts`
- Modify: `cocos-client/assets/Scripts/Game/StageResourceController.ts`
- Create: `cocos-client/assets/Scripts/Game/BattlePerformanceMonitor.ts`
- Create: `cocos-client/tests/verticalSliceResourceLifecycle.test.mjs`
- Create: `cocos-client/tests/verticalSlicePerformance.test.mjs`
- Modify: `cocos-client/tools/report-web-build-size.mjs`

- [ ] **Step 1: Write failing generation and memory-budget tests**

Assert stage 1 requests only Qinglan, wolf, moth, first-stage backgrounds, flying sword, VFX, and stage audio at start. Assert the Boss pack begins loading during pressure phase, ordinary monster packs may release after Boss entry, stale loads are rejected, and old stage assets release once after stage change.

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/verticalSliceResourceLifecycle.test.mjs tests/verticalSlicePerformance.test.mjs`.

- [ ] **Step 3: Implement lifecycle batches**

Add `critical`, `pressure-prefetch`, and `boss` batches with generation tokens. First playable waits only for `critical`; optional VFX and audio failures degrade; missing actor atlases roll back their domain spawn.

- [ ] **Step 4: Add the runtime frame monitor**

Track a rolling 300-frame window, publish P50/P95 every 5 seconds, and feed P95 to `PerformanceBudget`. Never log every frame. The automated test feeds synthetic frame durations and asserts quality drops within one report window and recovers only after two healthy windows.

- [ ] **Step 5: Verify and commit**

Run: `node --test tests/verticalSliceResourceLifecycle.test.mjs tests/verticalSlicePerformance.test.mjs tests/stageResourceRuntime.test.mjs`.

Run: `npm.cmd run report:size` after the first fresh export; record totals in the commit body.

```bash
git add cocos-client/assets/Scripts/Core/StageResourceRuntime.ts cocos-client/assets/Scripts/Game/StageResourceController.ts cocos-client/assets/Scripts/Game/BattlePerformanceMonitor.ts cocos-client/tests/verticalSliceResourceLifecycle.test.mjs cocos-client/tests/verticalSlicePerformance.test.mjs cocos-client/tools/report-web-build-size.mjs
git commit -m "perf: bound stage one resources and frame work"
```

### Task 5: Mobile Game Agent and Visual Acceptance

**Files:**
- Modify: `scripts/game-agent-core.mjs`
- Modify: `scripts/game-agent.mjs`
- Create: `test/combatVerticalSliceAgent.test.js`
- Create ignored: `artifacts/combat-vertical-slice/**`

- [ ] **Step 1: Write failing report-schema tests**

Require the Agent report to include `firstPlayableMs`, `horizontalMovementObserved`, `verticalMovementObserved`, `distinctEnemyBehaviors`, `bossAttacksObserved`, `bossFullyVisible`, `maxFrameMsP95`, `canvasAspectHealthy`, `settled`, `advancedToStage2`, `consoleErrors`, and screenshot paths.

- [ ] **Step 2: Run and verify RED**

Run: `node --test test/combatVerticalSliceAgent.test.js`.

- [ ] **Step 3: Implement deterministic browser play**

For each viewport `360x780`, `390x844`, and `430x932`, click six target points covering both horizontal halves and three heights, wait through the complete stage, sample canvas pixels and performance marks, capture intro/pressure/Boss/settlement screenshots, and fail on crop, blank canvas, CSS stretch, missing movement axis, or console error.

- [ ] **Step 4: Run the local Agent**

Run `python -m http.server 4173 --directory cocos-client/build/web-mobile` from the repository root, then run `npm.cmd run agent:test -- --url http://127.0.0.1:4173/ --stage 1 --duration 100000` from a second terminal.

Expected: three viewport reports pass and stage 2 is reached.

- [ ] **Step 5: Commit Agent coverage**

```bash
git add scripts/game-agent-core.mjs scripts/game-agent.mjs test/combatVerticalSliceAgent.test.js
git commit -m "test: add mobile combat vertical slice agent"
```

### Task 6: Cocos Export, Regression, and Live Deployment

**Files:**
- Modify generated: `cocos-client/build/web-mobile/**`
- Modify only if required by build output: `cocos-client/assets/Scenes/MainBattle.scene`

- [ ] **Step 1: Run all tests before opening the editor**

Run: `npm.cmd test` from repository root.

Run: `npm.cmd test` from `cocos-client`.

Expected: zero failures.

- [ ] **Step 2: Import, compile, and export with Cocos Creator 3.8.8**

Open `D:\CocosCreator\3.8.8\CocosCreator.exe`, import the worktree project, wait for script compilation, confirm no editor errors, and export Web Mobile to `cocos-client/build/web-mobile` without changing `FIXED_WIDTH`.

- [ ] **Step 3: Verify the fresh export**

Run: `npm.cmd run build:check`.

Run: `npm.cmd run verify:build-output -- build/web-mobile`.

Run: `npm.cmd run report:size`.

Expected: the compiled bootstrap and `VerticalSliceBattleController` are present, no old duplicate game entry is emitted, and size reporting completes.

- [ ] **Step 4: Run local mobile Agent and manual original-resolution inspection**

Require all Agent checks to pass. Inspect one original-resolution frame from each actor, one screenshot for each Boss attack, and the 18-enemy pressure screenshot. Reject blur, crop, detached limbs, fake wings, hidden telegraphs, or overlapping HUD/navigation.

- [ ] **Step 5: Merge, push, and verify the public URL**

Use `superpowers:finishing-a-development-branch` to integrate the feature branch. Push the resulting main commit, wait for deployment success, then run the Agent against `https://mcp.edcedc.cn/game/douyin-mini-rpg/` with cache-busting query parameters.

Expected: HTTP success, correct compressed asset headers, zero console errors, first playable within 6 seconds, complete stage 1, and stage 2 transition.

```bash
git add cocos-client/build/web-mobile
git commit -m "build: publish combat vertical slice"
```
