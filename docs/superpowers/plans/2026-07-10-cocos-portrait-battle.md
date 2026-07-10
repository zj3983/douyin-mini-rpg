# Cocos Portrait Battle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a playable portrait Cocos first stage with smooth click movement, automatic returning flying sword attacks, themed enemies, soul pickup, a gated world Boss, and compact mobile HUD.

**Architecture:** Keep deterministic combat and movement calculations in dependency-free runtime modules mirrored by TypeScript Core files. Use one `PortraitBattleBootstrap` Cocos component to assemble the initial scene from focused Game components and resource paths, while existing runtime controllers remain the authority for spawning, damage, drops, Boss state, and rewards.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, Node.js built-in test runner, Cocos Web Mobile build, Playwright mobile viewport verification.

---

## File Map

- Create `cocos-client/tools/movement-runtime.mjs`: deterministic target clamping and fixed-speed movement for Node tests.
- Create `cocos-client/assets/Scripts/Core/MovementRuntime.ts`: Cocos-side equivalent of movement rules.
- Create `cocos-client/tests/movementRuntime.test.mjs`: movement and repeated-click regression tests.
- Modify `cocos-client/tools/battle-runtime.mjs`: spawn cap, defeat gate, Boss readiness, and sword return-pass helpers.
- Modify `cocos-client/assets/Scripts/Core/BattleRuntime.ts`: typed production equivalent of the updated battle rules.
- Modify `cocos-client/tests/battleRuntime.test.mjs`: first-stage gate and return-pass tests.
- Create `cocos-client/assets/Scripts/Game/BattleInputController.ts`: maps touch coordinates to safe movement targets.
- Modify `cocos-client/assets/Scripts/Game/PlayerController.ts`: fixed-speed movement and animation-state events.
- Modify `cocos-client/assets/Scripts/Game/FlyingSwordSkill.ts`: hand-seal lead-in, outbound curve, return curve, and two hit passes.
- Modify `cocos-client/assets/Scripts/Game/BattleRuntimeController.ts`: automatic Boss gate, drop placement, and stage-clear claim.
- Create `cocos-client/assets/Scripts/Game/BattleHudController.ts`: compact portrait HUD state.
- Create `cocos-client/assets/Scripts/Game/PortraitBattleBootstrap.ts`: runtime scene assembly and resource binding.
- Modify `cocos-client/assets/Scenes/MainBattle.scene`: attach bootstrap component and portrait canvas settings.
- Add `cocos-client/assets/resources/Assets/World/MistBamboo/*`: first-stage background layers.
- Add `cocos-client/assets/resources/Assets/Combat/QinglanSwordCultivator/*`: transparent combat strip and manifest.
- Add `cocos-client/assets/resources/Assets/Combat/MistBamboo/*`: transparent wolf, moth, and Boss strips.
- Modify `cocos-client/assets/Data/animation-atlas.json`: point first-stage actors to the playable transparent strips.
- Modify `cocos-client/assets/Data/scene-blueprint.json`: record the approved portrait node tree and bindings.
- Modify `cocos-client/tests/sceneBlueprint.test.mjs`: require portrait layout, bootstrap, HUD, input, and safe-area nodes.

### Task 1: Lock Smooth Portrait Movement Rules

**Files:**
- Create: `cocos-client/tests/movementRuntime.test.mjs`
- Create: `cocos-client/tools/movement-runtime.mjs`
- Create: `cocos-client/assets/Scripts/Core/MovementRuntime.ts`

- [ ] **Step 1: Write the failing movement tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { clampBattleTarget, stepTowardTarget } from '../tools/movement-runtime.mjs'

test('portrait target stays below HUD and above navigation', () => {
  assert.deepEqual(
    clampBattleTarget({ x: 999, y: -999 }, { minX: -300, maxX: 50, minY: -430, maxY: 410 }),
    { x: 50, y: -430 },
  )
})

test('repeated clicks update the target without teleporting', () => {
  const first = stepTowardTarget({ x: -210, y: 0 }, { x: 20, y: 100 }, 220, 1 / 60)
  const second = stepTowardTarget(first.position, { x: -80, y: -120 }, 220, 1 / 60)
  assert.ok(first.distanceMoved <= 220 / 60 + 0.001)
  assert.ok(second.distanceMoved <= 220 / 60 + 0.001)
  assert.notDeepEqual(second.position, { x: -80, y: -120 })
})
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `cd cocos-client && node --test tests/movementRuntime.test.mjs`

Expected: FAIL because `tools/movement-runtime.mjs` does not exist.

- [ ] **Step 3: Implement deterministic movement helpers in both runtime files**

```js
export function clampBattleTarget(point, bounds) {
  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, point.x)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY, point.y)),
  }
}

export function stepTowardTarget(current, target, speed, deltaTime) {
  const dx = target.x - current.x
  const dy = target.y - current.y
  const distance = Math.hypot(dx, dy)
  if (distance === 0) return { position: { ...current }, distanceMoved: 0, arrived: true }
  const step = Math.min(distance, Math.max(0, speed * deltaTime))
  return {
    position: { x: current.x + dx / distance * step, y: current.y + dy / distance * step },
    distanceMoved: step,
    arrived: step >= distance,
  }
}
```

The TypeScript file exports the same signatures using `Point2` and `BattleBounds` interfaces.

- [ ] **Step 4: Run movement tests and confirm GREEN**

Run: `cd cocos-client && node --test tests/movementRuntime.test.mjs`

Expected: 2 tests pass.

- [ ] **Step 5: Commit movement rules**

```bash
git add cocos-client/tests/movementRuntime.test.mjs cocos-client/tools/movement-runtime.mjs cocos-client/assets/Scripts/Core/MovementRuntime.ts
git commit -m "feat: add smooth portrait movement rules"
```

### Task 2: Gate the Boss and Support the Returning Sword

**Files:**
- Modify: `cocos-client/tests/battleRuntime.test.mjs`
- Modify: `cocos-client/tools/battle-runtime.mjs`
- Modify: `cocos-client/assets/Scripts/Core/BattleRuntime.ts`

- [ ] **Step 1: Add failing Boss-gate and return-pass tests**

```js
test('first stage boss becomes ready only after twelve defeats', () => {
  const runtime = createBattleRuntime({ stageId: 1, heroAttack: 120 })
  for (let index = 0; index < 12; index += 1) {
    const enemy = nextSpawn(runtime, 1.1).enemy
    defeatEnemy(runtime, enemy.id)
  }
  assert.equal(runtimeStats(runtime).bossReady, true)
  assert.equal(nextSpawn(runtime, 1.1).ok, false)
  assert.equal(spawnBoss(runtime).ok, true)
})

test('returning sword can hit a surviving enemy on the reverse path', () => {
  const runtime = createBattleRuntime({ stageId: 1, heroAttack: 35 })
  const enemy = nextSpawn(runtime, 1.1).enemy
  enemy.position = { x: 120, y: 0 }
  const outward = applyFlyingSwordHit(runtime, { pierce: 4, damageScale: 1, path: { from: { x: 0, y: 0 }, to: { x: 260, y: 0 }, width: 18 } })
  const returning = applyFlyingSwordHit(runtime, { pierce: 4, damageScale: 1, path: { from: { x: 260, y: 0 }, to: { x: 0, y: 0 }, width: 18 } })
  assert.equal(outward.hitCount, 1)
  assert.equal(returning.hitCount, 1)
  assert.equal(returning.damageEvents[0].remainingHp, 30)
})
```

- [ ] **Step 2: Run battle tests and confirm RED**

Run: `cd cocos-client && node --test tests/battleRuntime.test.mjs`

Expected: FAIL because `bossReady` and the defeat threshold do not exist.

- [ ] **Step 3: Add gate state and spawn limits to both battle runtimes**

Add `defeatTarget: 12`, `maxAliveEnemies: 18`, and compute:

```ts
const defeatedEnemies = runtime.enemies.filter((enemy) => !enemy.alive && enemy.profile.role !== 'boss').length
const bossReady = defeatedEnemies >= runtime.defeatTarget
```

`nextSpawn` returns `{ ok: false, enemy: null }` when the stage is cleared, the Boss is ready, a Boss is alive, or alive ordinary enemies reach 18. `spawnBoss` returns false until `bossReady` is true.

- [ ] **Step 4: Run all Cocos rule tests**

Run: `cd cocos-client && npm test`

Expected: all tests pass, including prior direct `spawnBoss` tests updated to create twelve defeats first.

- [ ] **Step 5: Commit combat gate rules**

```bash
git add cocos-client/tests/battleRuntime.test.mjs cocos-client/tools/battle-runtime.mjs cocos-client/assets/Scripts/Core/BattleRuntime.ts
git commit -m "feat: gate world boss behind stage defeats"
```

### Task 3: Replace Square Battle Art with Playable Transparent Assets

**Files:**
- Add: `cocos-client/assets/resources/Assets/World/MistBamboo/far.webp`
- Add: `cocos-client/assets/resources/Assets/World/MistBamboo/mid.webp`
- Add: `cocos-client/assets/resources/Assets/Combat/QinglanSwordCultivator/action-strip.webp`
- Add: `cocos-client/assets/resources/Assets/Combat/MistBamboo/moss-wolf-strip.png`
- Add: `cocos-client/assets/resources/Assets/Combat/MistBamboo/green-wing-moth-strip.png`
- Add: `cocos-client/assets/resources/Assets/Combat/MistBamboo/bamboo-warden-strip.png`
- Modify: `cocos-client/assets/Data/animation-atlas.json`
- Test: `cocos-client/tests/animationAtlas.test.mjs`

- [ ] **Step 1: Add failing catalog assertions for playable combat assets**

```js
test('first stage actors use transparent combat strips', () => {
  for (const actorId of ['qinglan-sword-cultivator', 'moss-wolf', 'green-wing-moth', 'bamboo-warden']) {
    const actor = manifest.actors.find((entry) => entry.id === actorId)
    assert.ok(actor.atlas.includes('/Combat/'))
    assert.ok(actor.actions.move || actor.actions.sword_ride)
    assert.ok(actor.actions.attack || actor.actions.hand_seal)
  }
})
```

- [ ] **Step 2: Run atlas test and confirm RED**

Run: `cd cocos-client && node --test tests/animationAtlas.test.mjs`

Expected: FAIL because the manifest still points at the old square actor atlases.

- [ ] **Step 3: Prepare and import the exact first-stage assets**

Use `public/assets/generated/world-mist-forest.webp` as the far background and a darkened crop as the mid layer. Use `public/assets/generated/action-sword-sheet-ai.webp` as the initial transparent four-frame player strip.

Generate the monster sheets with these fixed art directions:

```text
moss-wolf-strip.png: Chinese xianxia moss-covered stone wolf demon, complete side view facing left, four equally sized horizontal frames showing one grounded running cycle, legs remain attached to body, identical camera and scale, teal bamboo-forest rim light, transparent background, no text, no border, no shadow platform.

green-wing-moth-strip.png: Chinese xianxia jade-wing moth demon, complete side view facing left, four equally sized horizontal frames showing one wing-beat flying cycle, original wings remain part of the creature, identical camera and scale, pale cyan spirit glow, transparent background, no text, no border, no shadow platform.

bamboo-warden-strip.png: Chinese xianxia ancient bamboo guardian beast Boss, massive quadruped complete side view facing left, four equally sized horizontal frames showing a heavy attack wind-up and strike, limbs remain attached to body, antler-like bamboo crown, jade green spirit veins, identical camera and scale, transparent background, no text, no border, no shadow platform.
```

Each output is a single `2048 x 512` PNG. Validate alpha at all four corners and reject any output whose corner alpha is nonzero or whose frame subject touches a cell boundary.

Update `animation-atlas.json` so every first-stage actor points under `Assets/Combat/`, with `sword_ride`, `hand_seal`, `move`, `attack`, `hurt`, and `death` rectangles matching the imported sheet dimensions.

- [ ] **Step 4: Run atlas and asset-catalog tests**

Run: `cd cocos-client && node --test tests/animationAtlas.test.mjs tests/assetCatalog.test.mjs`

Expected: all selected tests pass and every referenced file exists.

- [ ] **Step 5: Commit first-stage art**

```bash
git add cocos-client/assets/resources/Assets/World cocos-client/assets/resources/Assets/Combat cocos-client/assets/Data/animation-atlas.json cocos-client/tests/animationAtlas.test.mjs
git commit -m "feat: add transparent first-stage combat art"
```

### Task 4: Implement Input, Player Motion, and Returning Sword Presentation

**Files:**
- Create: `cocos-client/assets/Scripts/Game/BattleInputController.ts`
- Modify: `cocos-client/assets/Scripts/Game/PlayerController.ts`
- Modify: `cocos-client/assets/Scripts/Game/FlyingSwordSkill.ts`
- Modify: `cocos-client/tests/cocosStructure.test.mjs`

- [ ] **Step 1: Add failing component-structure assertions**

```js
test('portrait battle input clamps touches before moving the player', () => {
  const input = readFileSync(resolve('assets/Scripts/Game/BattleInputController.ts'), 'utf8')
  assert.match(input, /clampBattleTarget/)
  assert.match(input, /EventTouch/)
  assert.match(input, /moveTo/)
})

test('flying sword has outward and return phases', () => {
  const skill = readFileSync(resolve('assets/Scripts/Game/FlyingSwordSkill.ts'), 'utf8')
  assert.match(skill, /handSealDuration/)
  assert.match(skill, /outbound/)
  assert.match(skill, /returning/)
  assert.match(skill, /castFlyingSwordPass/)
})
```

- [ ] **Step 2: Run structure tests and confirm RED**

Run: `cd cocos-client && node --test tests/cocosStructure.test.mjs`

Expected: FAIL because the input component and two-pass skill API do not exist.

- [ ] **Step 3: Implement the three focused Cocos components**

`BattleInputController` listens for `Node.EventType.TOUCH_END`, converts UI coordinates through `UITransform`, clamps them with `clampBattleTarget`, and calls `player.moveTo(new Vec3(x, y, 0))`.

`PlayerController.update` calls `stepTowardTarget` with `moveSpeed` and emits `player-motion-changed` only when moving state changes. Sword hover uses accumulated `deltaTime`, not `Date.now()`.

`FlyingSwordSkill` uses states `idle`, `handSeal`, `outbound`, and `returning`. It emits `player-action-requested` with `hand_seal`, calls `battleRuntime.castFlyingSwordPass(from, to)` once at the midpoint of each travel phase, rotates the sword along the curve tangent, then emits `sword_ride` on completion.

- [ ] **Step 4: Run all Cocos tests**

Run: `cd cocos-client && npm test`

Expected: all tests pass.

- [ ] **Step 5: Commit controls and skill presentation**

```bash
git add cocos-client/assets/Scripts/Game/BattleInputController.ts cocos-client/assets/Scripts/Game/PlayerController.ts cocos-client/assets/Scripts/Game/FlyingSwordSkill.ts cocos-client/tests/cocosStructure.test.mjs
git commit -m "feat: add portrait controls and returning sword skill"
```

### Task 5: Assemble the Portrait Scene and HUD

**Files:**
- Create: `cocos-client/assets/Scripts/Game/BattleHudController.ts`
- Create: `cocos-client/assets/Scripts/Game/PortraitBattleBootstrap.ts`
- Modify: `cocos-client/assets/Scenes/MainBattle.scene`
- Modify: `cocos-client/assets/Data/scene-blueprint.json`
- Modify: `cocos-client/tests/sceneBlueprint.test.mjs`

- [ ] **Step 1: Add failing portrait-scene assertions**

```js
test('main battle is a portrait full-screen playable scene', () => {
  assert.equal(blueprint.scene.orientation, 'portrait')
  for (const path of [
    'Canvas/BattleRoot/WorldLayer/FarBackground',
    'Canvas/BattleRoot/WorldLayer/MidBackground',
    'Canvas/BattleRoot/ActorLayer/Player',
    'Canvas/BattleRoot/InputLayer',
    'Canvas/BattleRoot/HudLayer/TopHud',
    'Canvas/BattleRoot/HudLayer/BottomNavigation',
  ]) assert.ok(nodes.has(path), path)
})
```

- [ ] **Step 2: Run blueprint tests and confirm RED**

Run: `cd cocos-client && node --test tests/sceneBlueprint.test.mjs tests/sceneAssembly.test.mjs`

Expected: FAIL because the blueprint is landscape and required portrait nodes are missing.

- [ ] **Step 3: Implement runtime bootstrap and compact HUD**

`PortraitBattleBootstrap.onLoad()` creates the approved node tree under Canvas, sets `view.setDesignResolutionSize(750, 1334, ResolutionPolicy.FIXED_WIDTH)`, loads the first-stage background and actor resources, positions the player at `(-210, -80)`, and binds Runtime, Input, Skill, Spawner, Drop, Effect, and HUD components.

`BattleHudController` exposes labels/bars for realm, health, mana, soul progress, stage name, and Boss health. It hides the Boss row until a Boss exists. Bottom navigation uses five equal-width text/icon nodes and does not consume touches outside its own 104-pixel safe area.

Attach `PortraitBattleBootstrap` to `BattleRoot` in `MainBattle.scene`, and update `scene-blueprint.json` to match the actual node tree.

- [ ] **Step 4: Run scene and structure tests**

Run: `cd cocos-client && node --test tests/sceneBlueprint.test.mjs tests/sceneAssembly.test.mjs tests/cocosStructure.test.mjs`

Expected: all selected tests pass.

- [ ] **Step 5: Commit scene assembly**

```bash
git add cocos-client/assets/Scripts/Game/BattleHudController.ts cocos-client/assets/Scripts/Game/PortraitBattleBootstrap.ts cocos-client/assets/Scenes/MainBattle.scene cocos-client/assets/Data/scene-blueprint.json cocos-client/tests/sceneBlueprint.test.mjs
git commit -m "feat: assemble portrait Cocos battle scene"
```

### Task 6: Connect Drops, Boss Flow, and Compact Settlement

**Files:**
- Modify: `cocos-client/assets/Scripts/Game/BattleRuntimeController.ts`
- Modify: `cocos-client/assets/Scripts/Game/SoulOrbController.ts`
- Modify: `cocos-client/assets/Scripts/Game/StageClearPanelController.ts`
- Modify: `cocos-client/tests/cocosStructure.test.mjs`

- [ ] **Step 1: Add failing orchestration assertions**

```js
test('runtime automatically summons the ready boss and places soul drops', () => {
  const runtime = readFileSync(resolve('assets/Scripts/Game/BattleRuntimeController.ts'), 'utf8')
  assert.match(runtime, /bossReady/)
  assert.match(runtime, /summonWorldBoss/)
  assert.match(runtime, /follow\(this\.playerNode/)
})
```

- [ ] **Step 2: Run the structure test and confirm RED**

Run: `cd cocos-client && node --test tests/cocosStructure.test.mjs`

Expected: FAIL because automatic Boss and player-follow drop wiring are absent.

- [ ] **Step 3: Implement the complete first-stage loop**

In `BattleRuntimeController.update`, stop ordinary spawns when `bossReady`, wait until existing ordinary enemies are dead, then call `summonWorldBoss()` once. Tick Boss skills every frame only while the Boss is alive. On defeat, place each soul orb at the defeated enemy position, call `SoulOrbController.follow(playerNode)`, and increment soul progress on `soul-orb-picked`.

When a sword pass reports `stageClear`, call `claimStageClear()` after death animation delay. The settlement panel uses at most 72% screen width, lists the three rewards in one row, and advances only when tapped; it never covers the player before the battle freezes.

- [ ] **Step 4: Run all Cocos tests**

Run: `cd cocos-client && npm test`

Expected: all tests pass.

- [ ] **Step 5: Commit the playable loop**

```bash
git add cocos-client/assets/Scripts/Game/BattleRuntimeController.ts cocos-client/assets/Scripts/Game/SoulOrbController.ts cocos-client/assets/Scripts/Game/StageClearPanelController.ts cocos-client/tests/cocosStructure.test.mjs
git commit -m "feat: complete first-stage battle loop"
```

### Task 7: Build, Playtest, and Deploy

**Files:**
- Verify: `cocos-client/settings/v2/packages/project.json`
- Verify: `.github/workflows/deploy.yml`
- Produce: `cocos-client/build/web-mobile/**`

- [ ] **Step 1: Run the full rule and structure suites**

Run: `cd cocos-client && npm test`

Expected: all tests pass with no warnings or unhandled rejections.

- [ ] **Step 2: Build with the installed D-drive Creator**

Run:

```powershell
& 'D:\CocosCreator\3.8.8\CocosCreator.exe' --project 'D:\游戏\douyin-mini-rpg\cocos-client' --build 'platform=web-mobile;debug=false'
```

Expected: process exits successfully and `cocos-client/build/web-mobile/index.html` exists.

- [ ] **Step 3: Run build readiness checks**

Run: `cd cocos-client && $env:COCOS_CREATOR_PATH='D:\CocosCreator\3.8.8\CocosCreator.exe'; npm run build:check`

Expected: JSON output reports `ready: true`.

- [ ] **Step 4: Playtest both phone sizes**

Serve `cocos-client/build/web-mobile` locally and inspect at `390 x 844` and `430 x 932`. Run the game for at least three minutes. Verify: nonblank background, complete player sprite, click movement without teleporting, continuous automatic sword casts, themed enemies, soul pickup, Boss spawn after twelve defeats, compact settlement, and no HUD/navigation overlap.

- [ ] **Step 5: Check runtime performance**

During a sword cast with 18 enemies, record FPS and console errors. Expected: at least 50 FPS on desktop mobile emulation, no repeated asset-load errors, and no growing inactive-node count after enemies recycle.

- [ ] **Step 6: Deploy and validate the live endpoint**

Push the committed branch, deploy the new `build/web-mobile` package to `/var/www/game/douyin-mini-rpg`, restart the existing account API only if server files changed, and verify:

```text
https://mcp.edcedc.cn/game/douyin-mini-rpg/
https://mcp.edcedc.cn/game/douyin-mini-rpg/api/health
```

Expected: the live page loads the portrait Cocos scene, the health endpoint returns `{ "ok": true }`, and `/game/` still contains only the intended game entry.

- [ ] **Step 7: Commit any verification-only fixes and push**

```bash
git add cocos-client .github/workflows/deploy.yml
git commit -m "fix: finalize portrait Cocos web build"
git push origin main
```
