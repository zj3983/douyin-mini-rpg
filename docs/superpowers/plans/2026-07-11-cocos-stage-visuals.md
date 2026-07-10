# Cocos Multi-Stage Visuals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give stages two through four distinct backgrounds and transparent six-state monster atlases without increasing mobile memory across stage transitions.

**Architecture:** A pure stage visual catalog supplies Cocos resource paths. The bootstrap swaps stage backgrounds from runtime stage-change events while pooled monsters select actor-specific atlases through the existing manifest. Assets are produced one stage at a time and validated before runtime integration.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, Node test runner, PNG alpha validation, AI raster generation.

---

### Task 1: Stage Visual Catalog And Background Switching

**Files:**
- Create: `cocos-client/assets/Scripts/Core/StageVisualCatalog.ts`
- Create: `cocos-client/tools/stage-visual-catalog.mjs`
- Modify: `cocos-client/assets/Scripts/Game/PortraitBattleBootstrap.ts`
- Modify: `cocos-client/assets/Scripts/Game/BattleRuntimeController.ts`
- Test: `cocos-client/tests/stageVisuals.test.mjs`
- Create: `cocos-client/assets/resources/Assets/World/MistLantern/far.webp`
- Create: `cocos-client/assets/resources/Assets/World/FlameRavine/far.webp`
- Create: `cocos-client/assets/resources/Assets/World/StarRoad/far.webp`

- [ ] Write a failing catalog test that expects stage ids 1-4 to resolve to four distinct resource paths and rejects an unknown stage.
- [ ] Run `node --test tests/stageVisuals.test.mjs` and confirm the missing catalog failure.
- [ ] Implement `stageVisualFor(stageId)` and copy the three approved backgrounds into Cocos resources.
- [ ] Emit `battle-stage-changed` after runtime rebuild and make the bootstrap swap backgrounds only after the new `SpriteFrame` loads.
- [ ] Add a generation guard so a slow prior load cannot overwrite the current stage; release the previous non-current asset after a successful swap.
- [ ] Run the focused test and `npm test`, then commit `feat: add stage-aware Cocos backgrounds`.

### Task 2: Stage Two Transparent Actors

**Files:**
- Create: `cocos-client/assets/resources/Assets/Combat/MistLantern/fog-spider-strip.png`
- Create: `cocos-client/assets/resources/Assets/Combat/MistLantern/lantern-wraith-strip.png`
- Create: `cocos-client/assets/resources/Assets/Combat/MistLantern/mist-deer-king-strip.png`
- Modify: `cocos-client/assets/Data/animation-atlas.json`
- Modify: `cocos-client/assets/resources/Data/animation-atlas.json`
- Test: `cocos-client/tests/animationAtlas.test.mjs`

- [ ] Generate each six-cell strip on a removable chroma background and convert it to alpha PNG.
- [ ] Validate transparent corners, gutters, 1920x512 dimensions, and stable bottom alignment for all 18 cells.
- [ ] Replace only the three stage-two actor atlas paths and frame mappings in both manifest copies.
- [ ] Run animation and alpha tests, build to an isolated directory, and screenshot stage two at 390x844.
- [ ] Commit `art: add mist lantern monster atlases`.

### Task 3: Stage Three Transparent Actors

**Files:**
- Create: `cocos-client/assets/resources/Assets/Combat/FlameRavine/lava-lizard-strip.png`
- Create: `cocos-client/assets/resources/Assets/Combat/FlameRavine/ember-crow-strip.png`
- Create: `cocos-client/assets/resources/Assets/Combat/FlameRavine/flame-ogre-strip.png`
- Modify: both animation manifest copies
- Test: `cocos-client/tests/animationAtlas.test.mjs`

- [ ] Generate and alpha-convert six-cell strips for the lizard, crow, and boss without opaque panels.
- [ ] Validate dimensions, gutters, bottom alignment, and action mappings.
- [ ] Update both manifests, run tests, build in isolation, and screenshot stage three at 390x844.
- [ ] Commit `art: add flame ravine monster atlases`.

### Task 4: Stage Four Transparent Actors

**Files:**
- Create: `cocos-client/assets/resources/Assets/Combat/StarRoad/star-armored-beast-strip.png`
- Create: `cocos-client/assets/resources/Assets/Combat/StarRoad/void-wing-spirit-strip.png`
- Create: `cocos-client/assets/resources/Assets/Combat/StarRoad/meteor-guardian-strip.png`
- Modify: both animation manifest copies
- Test: `cocos-client/tests/animationAtlas.test.mjs`

- [ ] Generate and alpha-convert six-cell strips for the star-road actors.
- [ ] Validate dimensions, gutters, bottom alignment, and action mappings.
- [ ] Update both manifests, run tests, build in isolation, and screenshot stage four at 390x844.
- [ ] Commit `art: add star road monster atlases`.

### Task 5: Cross-Stage Playtest And Mobile Budget

**Files:**
- Modify: `cocos-client/tests/stageVisuals.test.mjs`
- Produce: isolated Cocos web-mobile build

- [ ] Run `npm test` and the mandatory build-output verifier.
- [ ] Play stages one through four at 390x844 and 430x932, checking background identity, actor transparency, Boss isolation, retry, and manual settlement.
- [ ] Measure FPS during an 18-enemy cast and verify at least 50 FPS with no growing pooled-node count.
- [ ] Verify previously loaded stage textures are released and no old stage callback can overwrite the current background.
- [ ] Commit any focused fixes, request specification and quality reviews, merge to main, push GitHub, then deploy the Cocos build to the single `/game` entry.

