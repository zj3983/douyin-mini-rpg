# Monster Animation Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all twelve monster strips with complete, distinct action atlases and make every monster face the player without visual jitter.

**Architecture:** Generate one transparent fixed-grid atlas per monster, validate it with deterministic pixel tests, then update the shared animation manifest. Keep source images canonical and let Cocos consume copied resource assets. A pure facing runtime chooses direction from player-relative world coordinates while only the visual child is flipped.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, Node test runner, Pillow-based validation utilities already used by the project, OpenAI image generation, Playwright.

---

### Task 1: Atlas Contract and Dynamic Facing

**Files:**
- Create: `cocos-client/assets/Scripts/Core/EnemyFacingRuntime.ts`
- Create: `cocos-client/tools/enemy-facing-runtime.mjs`
- Create: `cocos-client/tests/enemyFacingRuntime.test.mjs`
- Create: `cocos-client/tests/monsterAtlasContract.test.mjs`
- Modify: `cocos-client/assets/Scripts/Game/EnemyController.ts`
- Modify: `cocos-client/assets/Scripts/Game/EnemyVisualController.ts`

- [ ] Write failing tests for left/right player positions, a horizontal dead zone, no jitter near zero, and Boss root-scale preservation.
- [ ] Write failing atlas-contract tests requiring twelve monster atlases, five actions, configured frame counts, transparent borders, per-action frame differences, and source/resource manifest parity.
- [ ] Run the focused tests and confirm RED for missing facing runtime and old 6-frame strips.
- [ ] Implement `updateEnemyFacing(previous, enemyX, playerX, deadZone)` and wire the result to the `Visual` child only.
- [ ] Run focused tests and commit the facing runtime plus contract tests.

### Task 2: Generate Mist Bamboo Atlases

**Files:**
- Replace: `cocos-client/assets/resources/Assets/Combat/MistBamboo/moss-wolf-strip.png`
- Replace: `cocos-client/assets/resources/Assets/Combat/MistBamboo/green-wing-moth-strip.png`
- Replace: `cocos-client/assets/resources/Assets/Combat/MistBamboo/bamboo-warden-strip.png`
- Modify: `cocos-client/assets/Data/animation-atlas.json`
- Modify: `cocos-client/assets/resources/Data/animation-atlas.json`

- [ ] Use existing monsters as references and generate complete transparent action atlases facing left.
- [ ] Process each image into the approved fixed grid without cropping or neighboring-frame contamination.
- [ ] Configure ground-wolf gait, moth wingbeat/dive, and Boss weighted attack timing independently.
- [ ] Run pixel/manifest tests and create an animated preview for all five actions.
- [ ] Inspect the moss wolf at original resolution and commit the first scene assets.

### Task 3: Generate Mist Lantern Atlases

**Files:**
- Replace the fog-spider, lantern-wraith, and mist-deer-king strips under `Assets/Combat/MistLantern`.
- Modify both animation manifests.

- [ ] Generate distinct spider leg motion, floating wraith casting, and deer-Boss charge sequences.
- [ ] Process, validate, preview, and confirm transparent margins.
- [ ] Run all atlas tests and commit the second scene assets.

### Task 4: Generate Flame Ravine Atlases

**Files:**
- Replace the lava-lizard, ember-crow, and flame-ogre strips under `Assets/Combat/FlameRavine`.
- Modify both animation manifests.

- [ ] Generate lizard crawl/bite, crow flap/dive, and ogre wind-up/slam sequences.
- [ ] Process, validate, preview, and confirm transparent margins.
- [ ] Run all atlas tests and commit the third scene assets.

### Task 5: Generate Star Abyss Atlases

**Files:**
- Replace the star-armored-beast, void-wing-spirit, and meteor-guardian strips under `Assets/Combat/StarAbyss`.
- Modify both animation manifests.

- [ ] Generate armored gait/ram, wing-spirit flight/cast, and guardian telegraphed strike sequences.
- [ ] Process, validate, preview, and confirm transparent margins.
- [ ] Run all atlas tests and commit the fourth scene assets.

### Task 6: Full Preview, Build, and Public Verification

**Files:**
- Modify generated output: `cocos-client/build/web-mobile/**`
- Create ignored preview/playtest artifacts under `cocos-client/temp/`.

- [ ] Build a local preview page that plays every monster's idle, move, attack, hurt, and death actions with facing controls.
- [ ] Run `npm test` from the root and `cocos-client`; require zero failures.
- [ ] Clean Cocos project caches and export a fresh `web-mobile` build.
- [ ] Verify the compiled output references the new facing runtime and atlas rectangles.
- [ ] Merge to `main`, push, and wait for successful deployment.
- [ ] Publicly test all four scene groups at a mobile viewport, checking complete bodies, distinct actions, correct facing, pool reuse, resource errors, and at least 55 FPS.

