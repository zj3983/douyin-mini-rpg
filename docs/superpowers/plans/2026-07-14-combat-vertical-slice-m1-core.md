# Combat Vertical Slice M1 Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a deterministic 90-second greybox stage with full-screen movement, distinct wolf and moth AI, a three-attack Boss, flying-sword-only combat, and one-shot settlement.

**Architecture:** New pure TypeScript modules own session, movement, AI, hit resolution, and artifacts. Existing Cocos controllers become adapters around one `BattleSession`; they render typed commands and synchronize node positions without owning rules. Tests import the same `.ts` files Cocos compiles.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, Node 24 type stripping, Node test runner.

---

### Task 1: Direct TypeScript Test Contract and Domain Types

**Files:**
- Modify: `cocos-client/package.json`
- Create: `cocos-client/assets/Scripts/Combat/CombatTypes.ts`
- Create after Cocos import: `cocos-client/assets/Scripts/Combat.meta`
- Create after Cocos import: `cocos-client/assets/Scripts/Combat/CombatTypes.ts.meta`
- Create: `cocos-client/tests/combatTypes.test.mjs`

- [ ] **Step 1: Write the failing direct-import test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createSeededRandom, isCombatEvent } from '../assets/Scripts/Combat/CombatTypes.ts'

test('combat core is imported from TypeScript without an executable mirror', () => {
  const random = createSeededRandom(7)
  assert.deepEqual([random(), random()].map((value) => Number(value.toFixed(6))), [0.238781, 0.913493])
  assert.equal(isCombatEvent({ type: 'stage-entered', stageId: 1, at: 0 }), true)
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/combatTypes.test.mjs` from `cocos-client`.

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `CombatTypes.ts`.

- [ ] **Step 3: Add the domain primitives**

```ts
export interface Point2 { x: number; y: number }
export interface BattleRect { minX: number; maxX: number; minY: number; maxY: number }
export type EnemyKind = 'moss-wolf' | 'green-wing-moth' | 'bamboo-warden'
export type EnemyState = 'spawn' | 'select-position' | 'telegraph' | 'attack' | 'recovery' | 'hurt' | 'death'
export type CombatEvent =
  | { type: 'stage-entered'; stageId: number; at: number }
  | { type: 'animation-requested'; actorId: string; action: string; at: number }
  | { type: 'attack-telegraphed'; enemyId: number; attackId: string; area: BattleRect; at: number }
  | { type: 'damage-resolved'; sourceId: string; targetId: string; amount: number; at: number }
  | { type: 'enemy-defeated'; enemyId: number; at: number }
  | { type: 'boss-entered'; enemyId: number; at: number }
  | { type: 'stage-settled'; stageId: number; at: number }

export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 0x100000000)
}

export function isCombatEvent(value: unknown): value is CombatEvent {
  return Boolean(value && typeof value === 'object' && 'type' in value && 'at' in value)
}
```

Add `"type": "module"` to `cocos-client/package.json`. Do not add a `.mjs` mirror.

- [ ] **Step 4: Run focused and package tests**

Run: `node --test tests/combatTypes.test.mjs`.

Expected: `1` pass, `0` fail, and no `MODULE_TYPELESS_PACKAGE_JSON` warning.

- [ ] **Step 5: Import the new folder in Cocos and commit**

Open the project once in Cocos Creator so `.meta` files are generated, then run `npm.cmd run build:check`.

```bash
git add cocos-client/package.json cocos-client/assets/Scripts/Combat cocos-client/tests/combatTypes.test.mjs
git commit -m "feat: establish single-source combat domain"
```

### Task 2: Stage Configuration and Battle Session

**Files:**
- Create: `cocos-client/assets/Data/stage-one-combat.json`
- Create: `cocos-client/assets/resources/Data/stage-one-combat.json`
- Create: `cocos-client/assets/Scripts/Combat/StageOneConfig.ts`
- Create: `cocos-client/assets/Scripts/Combat/BattleSession.ts`
- Create: `cocos-client/tests/battleSession.test.mjs`

- [ ] **Step 1: Write failing phase and idempotency tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createBattleSession, advanceBattleSession, settleBattleSession } from '../assets/Scripts/Combat/BattleSession.ts'
import { parseStageOneConfig } from '../assets/Scripts/Combat/StageOneConfig.ts'

const config = parseStageOneConfig(JSON.parse(readFileSync(new URL('../assets/Data/stage-one-combat.json', import.meta.url), 'utf8')))

test('stage one reaches pressure and boss phases on schedule', () => {
  const session = createBattleSession({ stageId: 1, seed: 19, config })
  const advanceFor = (seconds) => {
    for (let frame = 0; frame < seconds * 60; frame += 1) advanceBattleSession(session, 1 / 60)
  }
  advanceFor(15)
  assert.equal(session.phase, 'mowing')
  advanceFor(25)
  assert.equal(session.phase, 'pressure')
  advanceFor(20)
  assert.equal(session.phase, 'boss')
})

test('settlement is accepted exactly once', () => {
  const session = createBattleSession({ stageId: 1, seed: 19, config })
  assert.equal(settleBattleSession(session, 'boss-defeated'), true)
  assert.equal(settleBattleSession(session, 'timeout'), false)
})
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/battleSession.test.mjs`.

Expected: FAIL because `BattleSession.ts` does not exist.

- [ ] **Step 3: Add the authoritative JSON and session API**

Use this timing block in both source and resource JSON copies:

```json
{
  "stageId": 1,
  "durationSeconds": 90,
  "phaseStarts": { "mowing": 15, "pressure": 40, "boss": 60 },
  "activeEnemyCap": 18,
  "spawnCadenceSeconds": { "intro": 1.4, "mowing": 0.9, "pressure": 0.75 },
  "bossId": "bamboo-warden",
  "settlementAutoContinueSeconds": 3
}
```

Expose exactly these session functions:

```ts
export type BattlePhase = 'intro' | 'mowing' | 'pressure' | 'boss' | 'settled' | 'defeated'
export interface EnemySnapshot {
  id: number
  kind: EnemyKind
  position: Point2
  alive: boolean
  spawnedAt: number
}
export interface BattleSession {
  stageId: number
  generation: number
  elapsed: number
  phase: BattlePhase
  enemies: Map<number, EnemySnapshot>
  events: CombatEvent[]
  settled: boolean
}
export interface StageOneCombatConfig {
  stageId: number
  durationSeconds: number
  phaseStarts: { mowing: number; pressure: number; boss: number }
  activeEnemyCap: number
  spawnCadenceSeconds: { intro: number; mowing: number; pressure: number }
  bossId: 'bamboo-warden'
  settlementAutoContinueSeconds: number
}
export function parseStageOneConfig(value: unknown): StageOneCombatConfig
export function createBattleSession(input: { stageId: number; seed: number; config: StageOneCombatConfig }): BattleSession
export function advanceBattleSession(session: BattleSession, deltaSeconds: number): readonly CombatEvent[]
export function registerEnemyDefeat(session: BattleSession, enemyId: number): readonly CombatEvent[]
export function settleBattleSession(session: BattleSession, reason: 'boss-defeated' | 'timeout' | 'button'): boolean
export function drainCombatEvents(session: BattleSession): CombatEvent[]
```

Clamp each advance to deterministic substeps of at most `1 / 30` second and cap external delta at `0.25` second.

`StageOneConfig.ts` validates JSON structure, finite values, ordered phase times, positive cadence, stage duration, and the 18-enemy hard ceiling. Node tests read the source JSON; the later Cocos adapter loads the resource JSON as `JsonAsset` and passes the validated value into `createBattleSession`. No gameplay constants are duplicated in TypeScript.

- [ ] **Step 4: Add the 90-second seeded simulation test**

Advance with `1 / 60` second steps, auto-defeat ordinary enemies after their test lifetime, defeat the Boss after 24 simulated seconds, and assert Boss entry in `[59, 62]`, settlement in `[84, 90]`, and `maxAlive <= 18`.

- [ ] **Step 5: Run, sync JSON, and commit**

Run: `node --test tests/battleSession.test.mjs`.

Run: `npm.cmd test`.

```bash
git add cocos-client/assets/Data/stage-one-combat.json cocos-client/assets/resources/Data/stage-one-combat.json cocos-client/assets/Scripts/Combat cocos-client/tests/battleSession.test.mjs
git commit -m "feat: add deterministic stage one session"
```

### Task 3: Full-Screen Player Motor and Safe Layout

**Files:**
- Create: `cocos-client/assets/Scripts/Combat/BattleLayout.ts`
- Create: `cocos-client/assets/Scripts/Combat/PlayerMotor.ts`
- Create: `cocos-client/tests/playerMotor.test.mjs`
- Modify: `cocos-client/assets/Scripts/Game/BattleInputController.ts`
- Modify: `cocos-client/assets/Scripts/Game/PlayerController.ts`
- Modify: `cocos-client/assets/Scripts/Game/PortraitBattleBootstrap.ts`
- Modify: `cocos-client/assets/Data/scene-blueprint.json`

- [ ] **Step 1: Write failing layout and rapid-input tests**

```js
test('390x844 exposes both horizontal halves above the navigation', () => {
  const layout = computeBattleLayout({ designWidth: 750, cssWidth: 390, cssHeight: 844, topInsetPx: 47, bottomInsetPx: 34 })
  assert.ok(layout.movement.minX <= -300)
  assert.ok(layout.movement.maxX >= 300)
  assert.ok(layout.movement.minY < layout.movement.maxY)
  assert.ok(layout.navigationTop < layout.movement.minY)
})

test('rapid target replacement advances from the current point', () => {
  const motor = createPlayerMotor({ x: -210, y: -80 }, 220)
  requestMove(motor, { x: 300, y: 300 })
  stepPlayerMotor(motor, 1 / 60)
  const before = { ...motor.position }
  requestMove(motor, { x: -280, y: -300 })
  stepPlayerMotor(motor, 1 / 60)
  assert.ok(Math.hypot(motor.position.x - before.x, motor.position.y - before.y) <= 220 / 60 + 0.001)
})
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/playerMotor.test.mjs`.

Expected: FAIL for missing `BattleLayout.ts` and `PlayerMotor.ts`.

- [ ] **Step 3: Implement pure layout and motor functions**

```ts
export interface LayoutInput {
  designWidth: number
  cssWidth: number
  cssHeight: number
  topInsetPx: number
  bottomInsetPx: number
}
export interface BattleLayout {
  visibleHeight: number
  movement: BattleRect
  actorSafeRect: BattleRect
  bossSpawn: Point2
  bossMaxVisualBounds: { width: number; height: number }
  navigationTop: number
}
export interface PlayerMotorState {
  spawn: Point2
  position: Point2
  target: Point2 | null
  bounds: BattleRect
  speed: number
  lockedAction: 'cast' | 'hurt' | 'death' | null
}
export function computeBattleLayout(input: LayoutInput): BattleLayout
export function createPlayerMotor(spawn: Point2, speed: number): PlayerMotorState
export function setPlayerBounds(state: PlayerMotorState, bounds: BattleRect): void
export function requestMove(state: PlayerMotorState, target: Point2): boolean
export function stepPlayerMotor(state: PlayerMotorState, deltaSeconds: number): PlayerMotorFrame
export function lockPlayerAction(state: PlayerMotorState, action: 'cast' | 'hurt' | 'death'): void
```

`lockPlayerAction` may change the requested animation but must not write `position`, `target`, or `bounds`.

- [ ] **Step 4: Bind layout-derived bounds in Cocos**

Remove serialized `minX`, `maxX`, `minY`, and `maxY` authority from `BattleInputController`. Add `configure(bounds: BattleRect)` and convert touches through `UITransform.convertToNodeSpaceAR` before calling `requestMove`.

In `PortraitBattleBootstrap`, compute the layout on initial build and every resize; position HUD and navigation using converted safe insets, not fixed viewport edges.

- [ ] **Step 5: Run tests and commit**

Run: `node --test tests/playerMotor.test.mjs tests/playableBattle.test.mjs tests/sceneAssembly.test.mjs`.

```bash
git add cocos-client/assets/Scripts/Combat cocos-client/assets/Scripts/Game/BattleInputController.ts cocos-client/assets/Scripts/Game/PlayerController.ts cocos-client/assets/Scripts/Game/PortraitBattleBootstrap.ts cocos-client/assets/Data/scene-blueprint.json cocos-client/tests/playerMotor.test.mjs
git commit -m "fix: allow stable full-screen battle movement"
```

### Task 4: Enemy State Machines and Active Hit Frames

**Files:**
- Create: `cocos-client/assets/Scripts/Combat/EnemyBrain.ts`
- Create: `cocos-client/assets/Scripts/Combat/CombatResolver.ts`
- Create: `cocos-client/tests/enemyBrain.test.mjs`
- Create: `cocos-client/tests/combatResolver.test.mjs`
- Modify: `cocos-client/assets/Scripts/Game/EnemyController.ts`
- Modify: `cocos-client/assets/Scripts/Game/EnemySpawner.ts`

- [ ] **Step 1: Write failing wolf and moth behavior tests**

Test the exact transition chains:

```js
assert.deepEqual(traceWolfAttack(), ['spawn', 'select-position', 'telegraph', 'attack', 'recovery'])
assert.deepEqual(traceMothCycle(), ['spawn', 'select-position', 'telegraph:dive', 'attack:dive', 'recovery', 'telegraph:spirit-orb', 'attack:spirit-orb'])
```

Also assert wolf telegraph is at least `0.4` seconds, a missed pounce enters recovery, moth projectiles contain a traversable gap, and touching an idle enemy resolves zero damage.

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/enemyBrain.test.mjs tests/combatResolver.test.mjs`.

- [ ] **Step 3: Implement the brain command contract**

```ts
export interface EnemyContext {
  now: number
  player: { id: string; position: Point2; alive: boolean }
  neighbors: readonly { id: number; position: Point2; alive: boolean }[]
  battleBounds: BattleRect
}
export type EnemyCommand =
  | { type: 'move'; velocity: Point2 }
  | { type: 'face'; direction: -1 | 1 }
  | { type: 'animate'; action: string }
  | { type: 'show-telegraph'; attackId: string; area: BattleRect; duration: number }
  | { type: 'activate-hitbox'; attackId: string; area: BattleRect; damage: number; duration: number }
  | { type: 'spawn-projectile'; attackId: string; origin: Point2; velocity: Point2; damage: number }

export function createEnemyBrain(kind: EnemyKind, id: number, spawn: Point2, seed: number): EnemyBrainState
export function stepEnemyBrain(state: EnemyBrainState, context: EnemyContext, deltaSeconds: number): EnemyCommand[]
```

Run decisions at staggered 8 to 10Hz using `(enemyId % 5) * 0.02` offsets; integrate movement every frame.

- [ ] **Step 4: Make `CombatResolver` the only damage authority**

Expose `openHitbox`, `closeHitbox`, `stepProjectiles`, and `resolveFrame`. Delete contact-damage calls from `BattleRuntimeController`; the Cocos enemy adapter forwards domain hitbox commands and animation requests only.

- [ ] **Step 5: Run focused and integration tests, then commit**

Run: `node --test tests/enemyBrain.test.mjs tests/combatResolver.test.mjs tests/playableBattle.test.mjs`.

```bash
git add cocos-client/assets/Scripts/Combat cocos-client/assets/Scripts/Game/EnemyController.ts cocos-client/assets/Scripts/Game/EnemySpawner.ts cocos-client/tests/enemyBrain.test.mjs cocos-client/tests/combatResolver.test.mjs
git commit -m "feat: add distinct telegraphed enemy AI"
```

### Task 5: Bamboo Warden Boss Brain

**Files:**
- Create: `cocos-client/assets/Scripts/Combat/BossBrain.ts`
- Create: `cocos-client/tests/bossBrain.test.mjs`
- Modify: `cocos-client/assets/Scripts/Combat/EnemyBrain.ts`
- Modify: `cocos-client/assets/Scripts/Combat/CombatResolver.ts`
- Modify: `cocos-client/assets/Scripts/Game/EnemySpawner.ts`

- [ ] **Step 1: Write failing tests for all three attacks and phase two**

Assert `bamboo-sweep` telegraphs for `0.8` seconds and leaves vertical escape space; `ground-spikes` emits three ordered markers before damage; `mountain-roar` has one safe angular gap; health below 50% permits paired attacks but never reduces telegraph duration.

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/bossBrain.test.mjs`.

- [ ] **Step 3: Implement Boss attack selection and readable areas**

```ts
export type BossAttackId = 'bamboo-sweep' | 'ground-spikes' | 'mountain-roar'
export function createBambooWardenBrain(id: number, spawn: Point2, seed: number): BossBrainState
export function stepBambooWarden(state: BossBrainState, context: EnemyContext, deltaSeconds: number): EnemyCommand[]
export function setBossHealthRatio(state: BossBrainState, ratio: number): void
```

Store cooldowns per attack and reject an immediate repeat unless no other attack is ready.

- [ ] **Step 4: Replace fixed Boss placement**

Update `EnemySpawner` to receive `BattleLayout.bossSpawn` and `BattleLayout.bossMaxVisualBounds`. Remove fixed `bossSpawnX=610` and fixed `1.45` scale authority. Preserve aspect ratio and clamp the complete visual frame inside the actor safe rect.

- [ ] **Step 5: Verify and commit**

Run: `node --test tests/bossBrain.test.mjs tests/playerMotor.test.mjs tests/playableBattle.test.mjs`.

```bash
git add cocos-client/assets/Scripts/Combat cocos-client/assets/Scripts/Game/EnemySpawner.ts cocos-client/tests/bossBrain.test.mjs
git commit -m "feat: add readable bamboo warden boss fight"
```

### Task 6: Artifact Runtime and Cocos Session Adapter

**Files:**
- Create: `cocos-client/assets/Scripts/Combat/ArtifactRuntime.ts`
- Create: `cocos-client/tests/artifactRuntime.test.mjs`
- Create: `cocos-client/assets/Scripts/Game/VerticalSliceBattleController.ts`
- Modify: `cocos-client/assets/Scripts/Game/FlyingSwordSkill.ts`
- Modify: `cocos-client/assets/Scripts/Game/BattleRuntimeController.ts`
- Modify: `cocos-client/assets/Scripts/Game/PortraitBattleBootstrap.ts`
- Modify: `cocos-client/tests/playableBattle.test.mjs`

- [ ] **Step 1: Write failing flying-sword tests**

Assert nearest-target selection, bounded curved steering, outbound and return piercing, one hit per target per phase, no ground dive at close range, and mutations at levels `6`, `12`, and `18` only.

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/artifactRuntime.test.mjs`.

- [ ] **Step 3: Implement the artifact API over the existing homing geometry**

```ts
export interface ArtifactContext {
  now: number
  ownerPosition: Point2
  targets: readonly { id: string; position: Point2; alive: boolean }[]
  battleBounds: BattleRect
}
export type ArtifactCommand =
  | { type: 'animate-owner'; action: 'hand_seal' | 'cast' }
  | { type: 'spawn-sword'; pathId: string; origin: Point2; targetId: string }
  | { type: 'move-sword'; pathId: string; from: Point2; to: Point2; phase: 'outbound' | 'orbit' | 'returning' }
  | { type: 'resolve-sword-hit'; pathId: string; targetId: string; phase: 'outbound' | 'orbit' | 'returning' }
  | { type: 'despawn-sword'; pathId: string }
export interface ArtifactRuntime {
  artifactId: 'flying-sword'
  level: number
  ownerId: string
  generation: number
  cooldownLeft: number
  activePaths: Map<string, unknown>
}
export function createArtifactRuntime(input: { artifactId: 'flying-sword'; level: number; ownerId: string }): ArtifactRuntime
export function stepArtifact(runtime: ArtifactRuntime, context: ArtifactContext, deltaSeconds: number): ArtifactCommand[]
export function setArtifactLevel(runtime: ArtifactRuntime, level: number): void
export function resetArtifact(runtime: ArtifactRuntime, generation: number): void
```

Level 6 emits three paths, level 12 adds a half-orbit cutting zone, and level 18 emits a readable wide sword formation without changing character base stats.

- [ ] **Step 4: Add one Cocos adapter around one session**

`VerticalSliceBattleController` owns `BattleSession`, forwards player targets, advances the session, translates `CombatEvent` and domain commands to Cocos node events, and applies stage generation checks. `BattleRuntimeController` becomes a compatibility entry that delegates stage 1 to the new controller; do not duplicate combat behavior.

- [ ] **Step 5: Prove the complete greybox loop and commit**

Run: `node --test tests/combatTypes.test.mjs tests/battleSession.test.mjs tests/playerMotor.test.mjs tests/enemyBrain.test.mjs tests/combatResolver.test.mjs tests/bossBrain.test.mjs tests/artifactRuntime.test.mjs tests/playableBattle.test.mjs`.

Run: `npm.cmd test` from `cocos-client`.

Run: `npm.cmd run build:check` from `cocos-client`.

```bash
git add cocos-client/assets/Scripts/Combat cocos-client/assets/Scripts/Game cocos-client/tests
git commit -m "feat: complete stage one combat greybox"
```
