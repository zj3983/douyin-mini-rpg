# Battle Loop Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the first-stage combat lifecycle, homing flying sword, movement contract, and pooled monster reset so the public first stage reliably reaches Boss settlement.

**Architecture:** Put deterministic behavior in three engine-independent runtime modules: `StageFlowRuntime`, `HomingSwordRuntime`, and the existing `MovementRuntime`. Cocos controllers translate runtime commands into nodes and events. Enemy visual and pool controllers gain explicit spawn and pool lifecycle methods so reused nodes never retain animation state.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, Node.js native test runner, Playwright public smoke test.

---

### Task 1: Deterministic Stage Flow

**Files:**
- Create: `cocos-client/assets/Scripts/Core/StageFlowRuntime.ts`
- Create: `cocos-client/tools/stage-flow-runtime.mjs`
- Create: `cocos-client/tests/stageFlowRuntime.test.mjs`

- [ ] **Step 1: Write failing transition tests**

Test that `createStageFlow(12)` starts in `clearing`, the twelfth ordinary defeat emits `beginDrain`, `completeDrain` emits `spawnBoss` exactly once, and `defeatBoss` emits `settle` exactly once. Also test that stale-generation commands are rejected.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/stageFlowRuntime.test.mjs`
Expected: FAIL because `stage-flow-runtime.mjs` does not exist.

- [ ] **Step 3: Implement the pure state machine**

Define `StagePhase = 'clearing' | 'draining' | 'boss' | 'settled' | 'defeated'` and functions `createStageFlow`, `recordOrdinaryDefeat`, `completeDrain`, `recordBossDefeat`, and `markPlayerDefeated`. Every transition returns `{ changed, command }`; invalid or duplicate transitions return `{ changed: false, command: null }`.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/stageFlowRuntime.test.mjs`
Expected: all stage-flow tests pass.

- [ ] **Step 5: Commit**

```powershell
git add cocos-client/assets/Scripts/Core/StageFlowRuntime.ts cocos-client/tools/stage-flow-runtime.mjs cocos-client/tests/stageFlowRuntime.test.mjs
git commit -m "feat: add deterministic battle stage flow"
```

### Task 2: Integrate Clear, Boss, and Settlement Phases

**Files:**
- Modify: `cocos-client/assets/Scripts/Game/BattleRuntimeController.ts`
- Modify: `cocos-client/assets/Scripts/Core/BattleRuntime.ts`
- Modify: `cocos-client/tools/battle-runtime.mjs`
- Modify: `cocos-client/tests/playableBattle.test.mjs`
- Modify: `cocos-client/tests/battleRuntime.test.mjs`

- [ ] **Step 1: Write failing integration tests**

Assert that the controller owns `StageFlowState`, stops ordinary spawning outside `clearing`, drains all living ordinary nodes on `beginDrain`, and calls `spawnBoss` only after drain completion. Remove assertions that couple Boss readiness to `pendingEnemyRecycles`.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/playableBattle.test.mjs tests/battleRuntime.test.mjs`
Expected: FAIL because the controller still uses `pendingEnemyRecycles` as the Boss gate.

- [ ] **Step 3: Implement controller integration**

Replace the recycle counter gate with `StageFlowRuntime`. On the target defeat, disable ordinary spawning, despawn every living ordinary node through `EnemySpawner`, mark those runtime enemies inactive without drops, then call `completeDrain`. Boss death transitions directly to guarded settlement. Stage rebuild and retry create a new flow generation.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/playableBattle.test.mjs tests/battleRuntime.test.mjs`
Expected: all selected tests pass.

- [ ] **Step 5: Commit**

```powershell
git add cocos-client/assets/Scripts/Game/BattleRuntimeController.ts cocos-client/assets/Scripts/Core/BattleRuntime.ts cocos-client/tools/battle-runtime.mjs cocos-client/tests/playableBattle.test.mjs cocos-client/tests/battleRuntime.test.mjs
git commit -m "refactor: drive battle through explicit stage phases"
```

### Task 3: Homing Sword Runtime

**Files:**
- Create: `cocos-client/assets/Scripts/Core/HomingSwordRuntime.ts`
- Create: `cocos-client/tools/homing-sword-runtime.mjs`
- Create: `cocos-client/tests/homingSwordRuntime.test.mjs`

- [ ] **Step 1: Write failing homing tests**

Cover nearest-target selection, bounded turn rate, retargeting after target death, outbound distance limit, return-to-player completion, and per-flight hit de-duplication. Include a high-player/ground-enemy case.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/homingSwordRuntime.test.mjs`
Expected: FAIL because the homing runtime does not exist.

- [ ] **Step 3: Implement homing state**

Create `HomingSwordState` with `position`, `velocity`, `phase`, `targetId`, `distanceTravelled`, and `hitIds`. Implement `createHomingSword`, `selectNearestTarget`, `stepHomingSword`, `recordSwordHit`, and `beginSwordReturn`. Use normalized steering with `maxTurnRadians * deltaTime`, fixed speed, and finite-coordinate guards.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/homingSwordRuntime.test.mjs`
Expected: all homing tests pass.

- [ ] **Step 5: Commit**

```powershell
git add cocos-client/assets/Scripts/Core/HomingSwordRuntime.ts cocos-client/tools/homing-sword-runtime.mjs cocos-client/tests/homingSwordRuntime.test.mjs
git commit -m "feat: add retargeting flying sword runtime"
```

### Task 4: Replace Fixed Sword Path in Cocos

**Files:**
- Modify: `cocos-client/assets/Scripts/Game/FlyingSwordSkill.ts`
- Modify: `cocos-client/assets/Scripts/Game/BattleRuntimeController.ts`
- Modify: `cocos-client/tests/cocosStructure.test.mjs`
- Modify: `cocos-client/tests/playableBattle.test.mjs`

- [ ] **Step 1: Write failing controller tests**

Assert that `FlyingSwordSkill` no longer stores `activePath`, requests live targets every update, moves the sword from homing state, and submits swept segments to damage resolution. Assert that a target removed between frames causes retargeting rather than stopping the cast.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/cocosStructure.test.mjs tests/playableBattle.test.mjs`
Expected: FAIL because `activePath` and interpolated fixed flight still exist.

- [ ] **Step 3: Integrate homing runtime**

Expose living target snapshots from `BattleRuntimeController`. During outbound and return updates, advance `HomingSwordState`, set the visual node to the new position, and resolve damage along the previous-to-current segment. Keep hand-seal timing and cooldown, but remove path interpolation and fixed endpoint properties.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/cocosStructure.test.mjs tests/playableBattle.test.mjs tests/homingSwordRuntime.test.mjs`
Expected: all selected tests pass.

- [ ] **Step 5: Commit**

```powershell
git add cocos-client/assets/Scripts/Game/FlyingSwordSkill.ts cocos-client/assets/Scripts/Game/BattleRuntimeController.ts cocos-client/tests/cocosStructure.test.mjs cocos-client/tests/playableBattle.test.mjs
git commit -m "refactor: make flying sword continuously seek targets"
```

### Task 5: Monster Pool and Animation Reset Contract

**Files:**
- Create: `cocos-client/assets/Scripts/Core/VisualResetRuntime.ts`
- Create: `cocos-client/tools/visual-reset-runtime.mjs`
- Create: `cocos-client/tests/visualResetRuntime.test.mjs`
- Modify: `cocos-client/assets/Scripts/Game/EnemyVisualController.ts`
- Modify: `cocos-client/assets/Scripts/Game/StripAnimationController.ts`
- Modify: `cocos-client/assets/Scripts/Game/EnemyController.ts`
- Modify: `cocos-client/assets/Scripts/Game/EnemySpawner.ts`
- Modify: `cocos-client/tests/playableBattle.test.mjs`

- [ ] **Step 1: Write failing reset tests**

Test a visual snapshot containing death frame, non-unit scale, rotation, opacity, tint, flipped direction, and stale action. `resetVisualState` must return canonical spawn values. Add source assertions requiring `resetForSpawn` and `prepareForPool` calls around every pool lifecycle.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/visualResetRuntime.test.mjs tests/playableBattle.test.mjs`
Expected: FAIL because no reset contract exists.

- [ ] **Step 3: Implement reset lifecycle**

`EnemyVisualController.resetForSpawn` cancels callbacks, restores node and sprite properties, binds the correct atlas, and starts move frame zero. `prepareForPool` stops animation and unbinds events. `EnemyController.bindRuntimeEnemy` resets cooldown, target, motion, and attack flags. `EnemySpawner` invokes these methods before activation and before pool return.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/visualResetRuntime.test.mjs tests/playableBattle.test.mjs`
Expected: all reset and integration tests pass.

- [ ] **Step 5: Commit**

```powershell
git add cocos-client/assets/Scripts/Core/VisualResetRuntime.ts cocos-client/tools/visual-reset-runtime.mjs cocos-client/tests/visualResetRuntime.test.mjs cocos-client/assets/Scripts/Game/EnemyVisualController.ts cocos-client/assets/Scripts/Game/StripAnimationController.ts cocos-client/assets/Scripts/Game/EnemyController.ts cocos-client/assets/Scripts/Game/EnemySpawner.ts cocos-client/tests/playableBattle.test.mjs
git commit -m "fix: reset pooled monster visuals and motion"
```

### Task 6: Movement Contract and Player Presentation

**Files:**
- Modify: `cocos-client/tools/movement-runtime.mjs`
- Modify: `cocos-client/assets/Scripts/Core/MovementRuntime.ts`
- Modify: `cocos-client/assets/Scripts/Game/PlayerController.ts`
- Modify: `cocos-client/tests/movementRuntime.test.mjs`
- Modify: `cocos-client/tests/playableBattle.test.mjs`

- [ ] **Step 1: Write failing movement tests**

Test rapid target replacement across alternating screen points, bounded per-frame displacement, no backward overshoot, and identical total movement for one large update versus several fixed substeps. Assert that cast events never change player position.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/movementRuntime.test.mjs tests/playableBattle.test.mjs`
Expected: at least the fixed-substep and cast-isolation assertions fail.

- [ ] **Step 3: Implement stable movement**

Clamp delta time into fixed substeps, preserve current position when replacing a target, and emit movement animation only when displacement is non-zero. Keep hand-seal and sword casts presentation-only; neither may write player position.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/movementRuntime.test.mjs tests/playableBattle.test.mjs`
Expected: all selected tests pass.

- [ ] **Step 5: Commit**

```powershell
git add cocos-client/tools/movement-runtime.mjs cocos-client/assets/Scripts/Core/MovementRuntime.ts cocos-client/assets/Scripts/Game/PlayerController.ts cocos-client/tests/movementRuntime.test.mjs cocos-client/tests/playableBattle.test.mjs
git commit -m "fix: stabilize click movement and casting motion"
```

### Task 7: Build, Deploy, and Public First-Stage Verification

**Files:**
- Modify generated output: `cocos-client/build/web-mobile/**`
- Create temporary ignored test: `cocos-client/temp/public-playtest/battle-loop.spec.js`

- [ ] **Step 1: Run full source verification**

Run: `npm test` from `cocos-client`.
Expected: zero failures.

- [ ] **Step 2: Export a fresh Cocos web-mobile build**

Delete only the worktree's `cocos-client/library`, `cocos-client/temp`, and `cocos-client/build/web-mobile`, then run Cocos Creator 3.8.8 CLI with output redirected to a file. Verify the compiled bundle contains `StageFlowRuntime`, `HomingSwordRuntime`, `resetForSpawn`, and `prepareForPool`.

- [ ] **Step 3: Verify generated output**

Run: `npm run verify:build-output -- build/web-mobile`.
Expected: `{ "ok": true }` and no blockers.

- [ ] **Step 4: Integrate and deploy**

Merge the feature branch into `main`, force-add the complete generated web build, push, and wait for the `Deploy to Cloud Server` GitHub Actions run to succeed.

- [ ] **Step 5: Play the public first stage**

At a `430x932` viewport, open `https://mcp.edcedc.cn/game/douyin-mini-rpg/` with a cache-busting query. Rapidly click alternating high and low positions, wait for ordinary clear, capture a Boss screenshot, defeat the Boss, and capture settlement. Record page errors, failed requests, FPS, and canvas aspect ratio.

- [ ] **Step 6: Final verification**

Expected: Boss appears after 12 ordinary defeats, settlement appears after Boss death, no stuck monster visual remains, no request/page errors occur, and average FPS is at least 55.

