# Combat Vertical Slice M2 Actors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace stage-one placeholders with four clear, complete, actor-specific animation sets that preserve body integrity, aspect ratio, facing, and action readability on mobile.

**Architecture:** Canonical transparent 4:5 source frames are generated per action from one locked reference per actor. A data-driven Python builder creates controlled per-action runtime packs and a manifest; source masters stay at the approved resolution while mobile runtime tiers may be downsampled only by the documented quality profile. Pixel and manifest tests reject crop, duplicate frames, edge fragments, and anchor drift before Cocos loads an atlas.

**Tech Stack:** OpenAI image generation, Python 3.11, Pillow, Cocos Creator SpriteFrame/Texture2D, Node test runner.

---

### Task 1: Data-Driven 4:5 Atlas Builder and Contract

**Files:**
- Create: `cocos-client/assets/Data/vertical-slice-animation-sources.json`
- Create: `cocos-client/tools/build-vertical-slice-atlases.py`
- Create: `cocos-client/tests/verticalSliceAtlasContract.test.mjs`
- Create: `cocos-client/tests/verticalSliceAtlasBuilder.test.mjs`
- Modify: `cocos-client/assets/Data/animation-atlas.json`
- Modify: `cocos-client/assets/resources/Data/animation-atlas.json`

- [ ] **Step 1: Write failing contract tests**

Require these canonical contracts:

```js
const expected = {
  'qinglan-sword-cultivator': { size: [512, 640], actions: { idle: 8, sword_ride: 10, hand_seal: 10, cast: 12, hurt: 6, death: 10 } },
  'moss-wolf': { size: [384, 480], actions: { idle: 6, move: 8, telegraph: 4, attack: 8, hurt: 4, death: 8 } },
  'green-wing-moth': { size: [384, 480], actions: { idle: 6, move: 8, dive: 8, cast: 8, hurt: 4, death: 8 } },
  'bamboo-warden': { size: [768, 960], actions: { idle: 8, move: 10, sweep: 12, spikes: 12, roar: 12, hurt: 6, death: 12 } },
}
```

For each frame assert 4:5 dimensions, alpha bounds at least 10% from the frame edge, nonempty subject, consecutive-frame pixel difference, and foot/flight-anchor drift no more than 3% of frame height.

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/verticalSliceAtlasContract.test.mjs tests/verticalSliceAtlasBuilder.test.mjs`.

- [ ] **Step 3: Add the source manifest**

Each actor entry must define `masterFrameSize`, `runtimeFrameSize`, `anchor`, and explicit action sources. Use `512x640`, `384x480`, and `768x960` masters; use `256x320`, `256x320`, and `384x480` runtime frames for the default mobile tier while preserving the masters under `cocos-client/art-source/vertical-slice`.

- [ ] **Step 4: Implement the builder**

The script must expose and test:

```py
def normalize_frame(image, frame_size, padding_ratio, anchor): ...
def validate_subject(frame, padding_ratio): ...
def pack_action(frames, frame_size, max_texture_size=4096): ...
def build_actor(source_config, source_root, output_root): ...
def write_manifest(actors, source_path, resource_path): ...
```

Pack each action into one or more textures no larger than `4096x4096`. Never stretch a frame. Write the same manifest bytes to source and resources.

- [ ] **Step 5: Run synthetic builder tests and commit**

Run: `python tools/build-vertical-slice-atlases.py --check` from `cocos-client`.

Run: `node --test tests/verticalSliceAtlasBuilder.test.mjs`.

```bash
git add cocos-client/assets/Data/vertical-slice-animation-sources.json cocos-client/tools/build-vertical-slice-atlases.py cocos-client/tests/verticalSliceAtlasBuilder.test.mjs cocos-client/tests/verticalSliceAtlasContract.test.mjs
git commit -m "feat: add production actor atlas pipeline"
```

### Task 2: Qinglan Sword Cultivator Animation Set

**Files:**
- Create: `cocos-client/art-source/vertical-slice/qinglan/reference.png`
- Replace: `cocos-client/assets/resources/Assets/Characters/QinglanSwordCultivator/portrait.png`
- Create: `cocos-client/art-source/vertical-slice/qinglan/{idle,sword_ride,hand_seal,cast,hurt,death}/*.png`
- Create generated: `cocos-client/assets/resources/Assets/ActorAtlases/QinglanSwordCultivator/**`
- Modify generated: both animation manifest copies

- [ ] **Step 1: Generate and approve the locked reference**

Use the `imagegen` skill with this exact direction: realistic Chinese xianxia male sword cultivator, age 22 to 26, pale blue and white layered hanfu, dark tied hair with loose strands, slim athletic anatomy, jade belt, one narrow flying sword beneath both feet, three-quarter side view facing right, elegant and restrained, full body, neutral light, transparent background, no text, no extra limbs, no glow covering the silhouette.

- [ ] **Step 2: Generate each action sheet from the same reference**

Generate the required frame counts with fixed camera, body proportions, costume, face, sword length, and lighting. `sword_ride` moves hair, sleeves, robe hem, and sword tassel while the feet remain planted on the sword. `hand_seal` uses only hands and upper body with no forward lunge. `cast` progresses from seal to sword release. `hurt` and `death` retain complete limbs and sword.

Derive the updated character portrait from the same locked reference so the profile art and battle actor depict the same person and costume.

- [ ] **Step 3: Build and run the actor contract**

Run: `python tools/build-vertical-slice-atlases.py --actor qinglan-sword-cultivator` from `cocos-client`.

Run: `node --test --test-name-pattern="qinglan" tests/verticalSliceAtlasContract.test.mjs`.

Expected: all frame, margin, anchor, and difference checks pass.

- [ ] **Step 4: Preview every action at 1x and mobile display size**

Add an ignored preview under `cocos-client/temp/qinglan-preview.html`; verify hands are readable, clothing actually deforms across frames, no whole-image wobble substitutes for movement, and the body never leaves its frame.

- [ ] **Step 5: Commit the canonical sources and runtime pack**

```bash
git add cocos-client/art-source/vertical-slice/qinglan cocos-client/assets/resources/Assets/Characters/QinglanSwordCultivator/portrait.png cocos-client/assets/resources/Assets/ActorAtlases/QinglanSwordCultivator cocos-client/assets/Data/animation-atlas.json cocos-client/assets/resources/Data/animation-atlas.json
git commit -m "feat: add complete qinglan animation set"
```

### Task 3: Moss Wolf and Green-Wing Moth Animation Sets

**Files:**
- Create: `cocos-client/art-source/vertical-slice/moss-wolf/**`
- Create: `cocos-client/art-source/vertical-slice/green-wing-moth/**`
- Replace generated: `cocos-client/assets/resources/Assets/ActorAtlases/MossWolf/**`
- Replace generated: `cocos-client/assets/resources/Assets/ActorAtlases/GreenWingMoth/**`
- Modify generated: both animation manifest copies

- [ ] **Step 1: Generate the moss-wolf reference and actions**

Direction: realistic low-fantasy wolf demon adapted to a wet bamboo forest, complete quadruped anatomy, moss-green markings integrated into fur, left-facing side view, grounded paws, no detached leaves or fake legs. Movement must show a readable eight-frame gait; telegraph lowers shoulders and hips; attack launches and lands; recovery is visible before movement resumes.

- [ ] **Step 2: Generate the moth reference and actions**

Direction: realistic xianxia moth spirit with one anatomical pair of patterned wings, jade-green and moon-white body, full silhouette, left-facing side view, no added wing nodes. Idle and movement use different wing amplitudes; dive pitches the body; cast gathers a small spirit orb between forelimbs; hurt and death retain both wings.

- [ ] **Step 3: Build and validate both actors**

Run: `python tools/build-vertical-slice-atlases.py --actor moss-wolf --actor green-wing-moth`.

Run: `node --test --test-name-pattern="moss-wolf|green-wing-moth" tests/verticalSliceAtlasContract.test.mjs`.

- [ ] **Step 4: Bind action names to AI commands**

Update `EnemyVisualController.ts` so wolf `telegraph`, `attack`, `recovery` and moth `dive`, `cast`, `hurt`, `death` resolve directly from domain animation commands. Remove any code that adds synthetic legs or wings.

- [ ] **Step 5: Commit after a pooled 20-cycle preview**

Run: `node --test tests/visualResetRuntime.test.mjs tests/verticalSliceAtlasContract.test.mjs`.

```bash
git add cocos-client/art-source/vertical-slice/moss-wolf cocos-client/art-source/vertical-slice/green-wing-moth cocos-client/assets/resources/Assets/ActorAtlases/MossWolf cocos-client/assets/resources/Assets/ActorAtlases/GreenWingMoth cocos-client/assets/Scripts/Game/EnemyVisualController.ts cocos-client/assets/Data/animation-atlas.json cocos-client/assets/resources/Data/animation-atlas.json
git commit -m "feat: add distinct stage one monster animation"
```

### Task 4: Bamboo Warden Boss and Cocos Visual Sizing

**Files:**
- Create: `cocos-client/art-source/vertical-slice/bamboo-warden/**`
- Replace generated: `cocos-client/assets/resources/Assets/ActorAtlases/BambooWarden/**`
- Modify: `cocos-client/assets/Scripts/Game/AtlasAnimator.ts`
- Modify: `cocos-client/assets/Scripts/Game/PortraitBattleBootstrap.ts`
- Modify: `cocos-client/assets/Scripts/Game/EnemyVisualController.ts`
- Modify generated: both animation manifest copies

- [ ] **Step 1: Generate the Boss reference and action sheets**

Direction: massive realistic bamboo-armored mountain guardian beast, broad complete body, weathered dark fur and stone plates bound with living bamboo, left-facing side view, heavy readable weight, no cropped horns, hands, feet, or tail. `sweep`, `spikes`, and `roar` must have visually different anticipation, active, and recovery poses.

- [ ] **Step 2: Build and validate the Boss pack**

Run: `python tools/build-vertical-slice-atlases.py --actor bamboo-warden`.

Run: `node --test --test-name-pattern="bamboo-warden" tests/verticalSliceAtlasContract.test.mjs`.

- [ ] **Step 3: Preserve aspect and clamp visual bounds in Cocos**

Make `AtlasAnimator` report each action's frame aspect. Set `UITransform` from `logicalHeight * frameAspect`, never from the old fixed `210x336` monster size. Fit the Boss into `BattleLayout.bossMaxVisualBounds` and apply facing to the visual child only.

- [ ] **Step 4: Run all actor and pool tests**

Run: `node --test tests/animationAtlas.test.mjs tests/verticalSliceAtlasContract.test.mjs tests/visualResetRuntime.test.mjs tests/playableBattle.test.mjs`.

Run: `npm.cmd test` from `cocos-client`.

- [ ] **Step 5: Commit the complete visual milestone**

```bash
git add cocos-client/art-source/vertical-slice/bamboo-warden cocos-client/assets/resources/Assets/ActorAtlases/BambooWarden cocos-client/assets/Scripts/Game/AtlasAnimator.ts cocos-client/assets/Scripts/Game/PortraitBattleBootstrap.ts cocos-client/assets/Scripts/Game/EnemyVisualController.ts cocos-client/assets/Data/animation-atlas.json cocos-client/assets/resources/Data/animation-atlas.json
git commit -m "feat: complete stage one hd actor visuals"
```

### Task 5: Layered Mist-Bamboo Stage Art

**Files:**
- Create: `cocos-client/art-source/vertical-slice/mist-bamboo/stage-master.png`
- Replace: `cocos-client/assets/resources/Assets/World/MistBamboo/far.png`
- Replace: `cocos-client/assets/resources/Assets/World/MistBamboo/mid.png`
- Create: `cocos-client/assets/resources/Assets/World/MistBamboo/foreground-mist.png`
- Modify: `cocos-client/assets/Scripts/Game/StageBackgroundController.ts`
- Modify: `cocos-client/assets/Scripts/Core/StageVisualCatalog.ts`
- Modify: `cocos-client/tests/stageBackgroundRuntime.test.mjs`
- Modify: `cocos-client/tests/stageVisuals.test.mjs`

- [ ] **Step 1: Add failing layer and composition tests**

Require three different nonblank images, matching portrait composition, no painted UI, no level markers, no oval fake trees, no geometric rings, and alpha in the mid/foreground layers. Assert parallax changes only layer positions and never stretches or ripples the source image.

- [ ] **Step 2: Generate one coherent stage master**

Use the `imagegen` skill with this direction: cinematic realistic Chinese xianxia bamboo mountain pass after rain, side-view playable clearing across the lower third, deep misty peaks and waterfalls in the distance, dense wet bamboo at middle depth, pale dawn light, restrained cyan green and warm lantern accents, readable dark silhouettes for characters, no people, no monsters, no circles, no level labels, no interface, no flying islands shaped like disks.

- [ ] **Step 3: Separate the original composition into real depth layers**

Create `far.png` from sky, mountains, and distant waterfalls; create transparent `mid.png` from bamboo trunks and nearby terrain; create transparent `foreground-mist.png` from low mist only. Repaint holes after extraction so moving a layer does not reveal duplicated or blank regions.

- [ ] **Step 4: Bind restrained parallax**

`StageBackgroundController` moves far, mid, and mist at separate speeds based on player/camera progress, clamps each offset to the layer's overscan, and preserves aspect ratio. Do not apply whole-image scale pulsing, displacement, water-ripple shaders, or decorative map stickers.

- [ ] **Step 5: Verify and commit**

Run: `node --test tests/stageBackgroundRuntime.test.mjs tests/stageVisuals.test.mjs`.

```bash
git add cocos-client/art-source/vertical-slice/mist-bamboo cocos-client/assets/resources/Assets/World/MistBamboo cocos-client/assets/Scripts/Game/StageBackgroundController.ts cocos-client/assets/Scripts/Core/StageVisualCatalog.ts cocos-client/tests/stageBackgroundRuntime.test.mjs cocos-client/tests/stageVisuals.test.mjs
git commit -m "feat: add layered mist bamboo battle stage"
```
