# M3 Pursuit Dungeon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first complete three-floor, twelve-room extraction dungeon with semi-hidden routing, mixed magic-pressure timing, a two-repel pursuit Boss, optional final Boss kill, resumable runs, and idempotent extraction rewards.

**Architecture:** Pure TypeScript modules under `assets/Scripts/Core/Dungeon` own map, pressure, pursuit, encounter, extraction, and checkpoint rules. `DungeonRunController` coordinates those rules while `DungeonRunPresenter` and `PortraitBattleBootstrap` render them; room combat reuses the existing `BattleRuntimeController`, enemy AI, combat resolver, artifact runtime, and object pools through a narrow dungeon-encounter API. Player save V4 stores daily entry usage and the active checkpoint atomically with the consumed entry payment.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, JSON content catalogs, Node.js built-in test runner, deterministic simulation tests, AI-generated raster assets, Cocos Web Mobile, Playwright game agent.

---

## File Map

- Modify `cocos-client/assets/Scripts/Core/Dungeon/DungeonTypes.ts`: complete profile, map, pressure, pursuit, extraction, event, and checkpoint contracts.
- Modify `cocos-client/assets/Scripts/Core/Dungeon/DungeonSession.ts`: authoritative session creation, restoration, stepping, interaction, defeat, and snapshots.
- Replace `cocos-client/assets/Scripts/Core/Dungeon/DungeonInteraction.ts`: explicit search, route, altar, and extraction commands instead of implicit “first affordable exit”.
- Create `cocos-client/assets/Scripts/Core/Dungeon/DungeonMapRuntime.ts`: semi-hidden map, route costs, reveal state, sealing, and escape-path invariant.
- Create `cocos-client/assets/Scripts/Core/Dungeon/DungeonPressureRuntime.ts`: mixed timer and calm/restless/frenzy transitions.
- Create `cocos-client/assets/Scripts/Core/Dungeon/PursuitBossRuntime.ts`: two repel encounters, route seal, altar unlock, and final death.
- Create `cocos-client/assets/Scripts/Core/Dungeon/DungeonExtractionRuntime.ts`: three-second channel, valid interruption, and terminal completion.
- Create `cocos-client/assets/Scripts/Core/Dungeon/DungeonEncounterDirector.ts`: seeded room encounter and loot selection.
- Create `cocos-client/assets/Scripts/Core/Dungeon/DungeonEntryRules.ts`: three daily free entries, pass fallback, and payment refund.
- Modify `cocos-client/assets/Scripts/Core/Progression/PlayerSave.ts`: migrate V3 to V4 and store dungeon entry/checkpoint data.
- Modify `cocos-client/assets/Scripts/Core/Progression/SaveRepository.ts`: persist and clone PlayerSave V4.
- Modify `cocos-client/assets/Scripts/Core/Progression/DualModeRuntime.ts`: atomic entry, checkpoint, restore, abandon, defeat, and extraction transitions.
- Modify `cocos-client/assets/Scripts/Core/World/WorldRewards.ts`: accept PlayerSave V4 without changing world reward behavior.
- Modify `cocos-client/assets/Scripts/Core/BattleRuntime.ts`: configurable room encounter target and completion policy.
- Modify `cocos-client/assets/Scripts/Game/BattleRuntimeController.ts`: expose a bounded dungeon encounter port without duplicating combat code.
- Modify `cocos-client/assets/Scripts/Game/DungeonRunController.ts`: coordinate session ticks, combat outcomes, checkpoints, pursuit, and extraction.
- Modify `cocos-client/assets/Scripts/Game/DualModeGameController.ts`: restore active runs and persist controller checkpoints.
- Create `cocos-client/assets/Scripts/Game/DungeonRunPresenter.ts`: render room, HUD, map overlay, interaction hints, pursuit warning, and compact settlement.
- Create `cocos-client/assets/Scripts/Game/DungeonLayout.ts`: safe-area layout for portrait, long-screen, and landscape previews.
- Create `cocos-client/assets/Scripts/Game/DungeonResourceController.ts`: load one floor resource plan and release the previous floor.
- Modify `cocos-client/assets/Scripts/Game/PortraitBattleBootstrap.ts`: replace the colored-floor prototype with the playable dungeon page and shared battle actors.
- Modify `cocos-client/assets/resources/Data/dual-mode-slice.json`: author the exact three-floor, twelve-room Mist Bamboo dungeon.
- Create `cocos-client/assets/resources/Data/dungeon-encounters.json`: seeded room rosters, rewards, and pursuit profiles.
- Create three far/mid background pairs under `cocos-client/assets/resources/Assets/Dungeon/MistBamboo/`.
- Create pursuit warning and extraction sprites under `cocos-client/assets/resources/Assets/Dungeon/MistBamboo/Effects/`.
- Create one unified multi-action `MistBambooEmperor/atlas.png` and update animation source/runtime manifests.
- Add pursuit warning, extraction start, and extraction completion cues under `cocos-client/assets/resources/Assets/Audio/Cues/`.
- Modify `cocos-client/assets/Data/scene-blueprint.json`, build-readiness contracts, resource budgets, and focused tests.

### Task 1: Author the Twelve-Room Dungeon Contract

**Files:**
- Modify: `cocos-client/assets/Scripts/Core/Dungeon/DungeonTypes.ts`
- Modify: `cocos-client/assets/Scripts/Core/Dungeon/DungeonSession.ts`
- Modify: `cocos-client/assets/resources/Data/dual-mode-slice.json`
- Modify: `cocos-client/tests/dungeonSession.test.mjs`

- [ ] **Step 1: Replace the real-profile test with the approved twelve-room contract**

```js
test('Mist Bamboo is a three-floor twelve-room authored dungeon with two extraction choices', async () => {
  const raw = await readFile(new URL('../assets/resources/Data/dual-mode-slice.json', import.meta.url), 'utf8')
  const profile = JSON.parse(raw)
  assert.doesNotThrow(() => validateDungeonProfile(profile))
  assert.equal(profile.rooms.length, 12)
  assert.deepEqual([...new Set(profile.rooms.map((room) => room.floor))], [1, 2, 3])
  assert.deepEqual(profile.extractionRoomIds, ['f2-damaged-exit', 'f3-full-exit'])
  assert.equal(profile.finalExtractionRoomId, 'f3-full-exit')
  assert.equal(profile.bossAltarRoomId, 'f3-altar')
  assert.equal(profile.rooms.filter((room) => room.kind === 'boss').length, 1)
  assert.equal(new Set(profile.rooms.map((room) => room.sceneId)).size, 12)
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `cd cocos-client && node --test tests/dungeonSession.test.mjs`

Expected: FAIL because the current profile has seven rooms and one extraction room.

- [ ] **Step 3: Define the new immutable contracts**

Use these exact public shapes in `DungeonTypes.ts`:

```ts
export type DungeonRoomKind = 'entry' | 'combat' | 'treasure' | 'alchemy' | 'mechanism' | 'elite' | 'boss' | 'extraction'
export type DungeonPressurePhase = 'calm' | 'restless' | 'frenzy'
export type DungeonRunPhase = 'exploring' | 'extracting' | 'extracted' | 'defeated' | 'abandoned'
export type PursuitBossPhase = 'dormant' | 'first-hunt' | 'first-repelled' | 'second-hunt' | 'second-repelled' | 'true-form-locked' | 'final-fight' | 'defeated'

export interface DungeonExit {
  id: string
  to: string
  cost: number
  unlock?: 'boss-defeat'
}

export interface DungeonRoom {
  id: string
  floor: 1 | 2 | 3
  kind: DungeonRoomKind
  sceneId: string
  risk: 'low' | 'medium' | 'high' | 'extreme'
  encounterId?: string
  exits: DungeonExit[]
  loot?: RunLoot[]
  doorCurrency?: number
  searchPressureSeconds?: 12 | 20
}

export interface DungeonProfile {
  id: string
  entryRoomId: string
  extractionRoomIds: string[]
  finalExtractionRoomId: string
  bossAltarRoomId: string
  rooms: DungeonRoom[]
}
```

Update profile cloning and validation to require unique exit IDs, valid extraction rooms, a boss altar on floor three, safe integer costs, reachable rooms, and at least one extraction path from every room. Do not enforce twelve rooms in the generic validator; enforce it in the real-profile contract test.

- [ ] **Step 4: Author the exact room IDs**

Use these four rooms per floor in `dual-mode-slice.json`:

```json
{
  "floor1": ["f1-entry", "f1-forest-combat", "f1-alchemy", "f1-sealed-cache"],
  "floor2": ["f2-bridge-combat", "f2-sword-array", "f2-gate-elite", "f2-damaged-exit"],
  "floor3": ["f3-antechamber", "f3-altar", "f3-sword-vault", "f3-full-exit"]
}
```

Author bidirectional same-floor exits, forward floor links, a cost-2 sealed cache, a cost-1 floor-two branch, and no direct access to `f3-sword-vault` until the Boss-death rule opens its route.

Use this exact logical route table; each `<->` becomes two uniquely named exit records:

```text
f1-entry <-> f1-forest-combat                     cost 0
f1-forest-combat <-> f1-alchemy                   cost 0
f1-forest-combat <-> f1-sealed-cache              cost 2
f1-forest-combat -> f2-bridge-combat              cost 0
f2-bridge-combat <-> f2-sword-array               cost 0
f2-bridge-combat <-> f2-damaged-exit              cost 0
f2-sword-array <-> f2-gate-elite                  cost 1 toward elite, cost 0 returning
f2-gate-elite <-> f2-damaged-exit                 cost 0
f2-gate-elite -> f3-antechamber                   cost 0
f3-antechamber <-> f3-altar                       cost 0
f3-antechamber <-> f3-full-exit                   cost 0
f3-altar <-> f3-sword-vault                       cost 0, unlock boss-defeat in both directions
f3-sword-vault <-> f3-full-exit                   cost 0
```

Use the stable exit IDs referenced by tests and events: `f1-entry-to-forest`, `f1-forest-to-floor2`, `f2-elite-to-exit`, `f2-elite-to-floor3`, `f3-altar-to-vault`, and reverse IDs with the same `<from>-to-<destination>` convention.

- [ ] **Step 5: Run the focused tests and verify GREEN**

Run: `cd cocos-client && node --test tests/dungeonSession.test.mjs`

Expected: all dungeon profile validation tests PASS.

- [ ] **Step 6: Commit**

```bash
git add cocos-client/assets/Scripts/Core/Dungeon/DungeonTypes.ts cocos-client/assets/Scripts/Core/Dungeon/DungeonSession.ts cocos-client/assets/resources/Data/dual-mode-slice.json cocos-client/tests/dungeonSession.test.mjs
git commit -m "feat: author twelve-room Mist Bamboo dungeon"
```

### Task 2: Implement Semi-Hidden Routing and Safe Route Sealing

**Files:**
- Create: `cocos-client/assets/Scripts/Core/Dungeon/DungeonMapRuntime.ts`
- Create: `cocos-client/tests/dungeonMapRuntime.test.mjs`

- [ ] **Step 1: Write failing map tests**

```js
test('map exposes topology but hides room identity until entered', () => {
  const map = createDungeonMap(profile)
  assert.deepEqual(map.revealedRoomIds, ['f1-entry'])
  assert.equal(roomIntel(map, profile, 'f1-alchemy').kind, null)
  assert.equal(roomIntel(map, profile, 'f1-alchemy').risk, 'low')
  assert.equal(enterMappedRoom(map, profile, 'f1-forest-combat', 0).ok, true)
  assert.equal(enterMappedRoom(map, profile, 'f1-alchemy', 0).ok, true)
  assert.equal(roomIntel(map, profile, 'f1-alchemy').kind, 'alchemy')
})

test('route sealing rejects a seal that removes every extraction path', () => {
  const map = createDungeonMap(profile)
  map.currentRoomId = 'f2-gate-elite'
  assert.deepEqual(sealRoute(map, profile, 'f2-elite-to-floor3'), { ok: true })
  assert.deepEqual(sealRoute(map, profile, 'f2-bridge-to-exit'), { ok: true })
  assert.deepEqual(sealRoute(map, profile, 'f2-elite-to-exit'), {
    ok: false,
    reason: 'would-strand-player',
  })
})
```

- [ ] **Step 2: Run and verify RED**

Run: `cd cocos-client && node --test tests/dungeonMapRuntime.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `DungeonMapRuntime.ts`.

- [ ] **Step 3: Implement the map state and path check**

```ts
export interface DungeonMapState {
  currentRoomId: string
  revealedRoomIds: string[]
  sealedExitIds: string[]
}

export function createDungeonMap(profile: DungeonProfile): DungeonMapState {
  validateDungeonProfile(profile)
  return {
    currentRoomId: profile.entryRoomId,
    revealedRoomIds: [profile.entryRoomId],
    sealedExitIds: profile.rooms.flatMap((room) => room.exits.filter((exit) => exit.unlock === 'boss-defeat').map((exit) => exit.id)),
  }
}

export function roomIntel(map: DungeonMapState, profile: DungeonProfile, roomId: string) {
  const room = profile.rooms.find((candidate) => candidate.id === roomId)
  if (!room) return null
  const revealed = map.revealedRoomIds.includes(roomId)
  return { id: room.id, floor: room.floor, risk: room.risk, kind: revealed ? room.kind : null, revealed }
}
```

Implement `enterMappedRoom` by finding a connected unsealed exit and charging its cost exactly once. Implement `sealRoute` on a cloned state, then breadth-first search from `currentRoomId` to any ID in `profile.extractionRoomIds`; commit the seal only when a path remains.

- [ ] **Step 4: Add immutability and malformed-state cases**

Assert that snapshots cannot mutate internal arrays, duplicate seals are idempotent, unknown exit IDs reject, and negative/fractional currency rejects without changing state.

- [ ] **Step 5: Run and verify GREEN**

Run: `cd cocos-client && node --test tests/dungeonMapRuntime.test.mjs tests/dungeonSession.test.mjs`

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add cocos-client/assets/Scripts/Core/Dungeon/DungeonMapRuntime.ts cocos-client/tests/dungeonMapRuntime.test.mjs
git commit -m "feat: add semi-hidden dungeon routing"
```

### Task 3: Add Mixed Magic-Pressure Timing

**Files:**
- Create: `cocos-client/assets/Scripts/Core/Dungeon/DungeonPressureRuntime.ts`
- Create: `cocos-client/tests/dungeonPressureRuntime.test.mjs`

- [ ] **Step 1: Write failing timing tests**

```js
function advanceSeconds(state, seconds) {
  for (let step = 0; step < Math.round(seconds * 10); step += 1) {
    advanceDungeonPressure(state, 0.1, false)
  }
}

test('pressure changes at 120 and 240 effective seconds', () => {
  const state = createDungeonPressure()
  advanceSeconds(state, 119.9)
  assert.deepEqual(advanceDungeonPressure(state, 0.1, false).events, [{ type: 'pressure-phase-changed', phase: 'restless' }])
  applySearchPressure(state, 20)
  advanceSeconds(state, 100)
  assert.equal(snapshotDungeonPressure(state).phase, 'frenzy')
})

test('paused time and oversized frames cannot skip pressure boundaries', () => {
  const state = createDungeonPressure()
  advanceDungeonPressure(state, 30, true)
  assert.equal(snapshotDungeonPressure(state).elapsedSeconds, 0)
  advanceDungeonPressure(state, 4, false)
  assert.equal(snapshotDungeonPressure(state).elapsedSeconds, 0.1)
})
```

- [ ] **Step 2: Run and verify RED**

Run: `cd cocos-client && node --test tests/dungeonPressureRuntime.test.mjs`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the bounded timer**

```ts
const MAX_FRAME_DELTA_SECONDS = 0.1
const RESTLESS_AT_SECONDS = 120
const FRENZY_AT_SECONDS = 240

export interface DungeonPressureState {
  elapsedSeconds: number
  phase: DungeonPressurePhase
}

export function pressurePhaseAt(elapsedSeconds: number): DungeonPressurePhase {
  if (elapsedSeconds >= FRENZY_AT_SECONDS) return 'frenzy'
  if (elapsedSeconds >= RESTLESS_AT_SECONDS) return 'restless'
  return 'calm'
}

export function advanceDungeonPressure(state: DungeonPressureState, deltaSeconds: number, paused: boolean) {
  if (paused) return { events: [] as DungeonPressureEvent[] }
  if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) throw new TypeError('deltaSeconds must be finite and nonnegative')
  const previous = state.phase
  state.elapsedSeconds += Math.min(deltaSeconds, MAX_FRAME_DELTA_SECONDS)
  state.phase = pressurePhaseAt(state.elapsedSeconds)
  return { events: previous === state.phase ? [] : [{ type: 'pressure-phase-changed' as const, phase: state.phase }] }
}
```

`applySearchPressure` accepts only `12` or `20`, advances immediately, and emits every crossed phase in order.

- [ ] **Step 4: Run and verify GREEN**

Run: `cd cocos-client && node --test tests/dungeonPressureRuntime.test.mjs`

Expected: all pressure tests PASS.

- [ ] **Step 5: Commit**

```bash
git add cocos-client/assets/Scripts/Core/Dungeon/DungeonPressureRuntime.ts cocos-client/tests/dungeonPressureRuntime.test.mjs
git commit -m "feat: add dungeon magic pressure runtime"
```

### Task 4: Implement the Pursuit Boss State Machine

**Files:**
- Create: `cocos-client/assets/Scripts/Core/Dungeon/PursuitBossRuntime.ts`
- Create: `cocos-client/tests/pursuitBossRuntime.test.mjs`

- [ ] **Step 1: Write failing pursuit tests**

```js
test('the pursuer is repelled twice before its true form can take final damage', () => {
  const boss = createPursuitBoss({ firstShield: 180, secondShield: 260, finalHealth: 1200 })
  assert.equal(beginFirstHunt(boss), true)
  assert.equal(damagePursuer(boss, 999).event.type, 'pursuer-repelled')
  assert.equal(beginSecondHunt(boss).event.type, 'route-seal-requested')
  assert.equal(damagePursuer(boss, 999).event.type, 'pursuer-repelled')
  assert.deepEqual(beginFinalFight(boss), { ok: false, reason: 'altar-locked' })
  assert.equal(unlockTrueForm(boss, 'f3-altar'), true)
  assert.equal(beginFinalFight(boss).ok, true)
  assert.equal(damagePursuer(boss, 1200).event.type, 'pursuer-defeated')
})
```

- [ ] **Step 2: Run and verify RED**

Run: `cd cocos-client && node --test tests/pursuitBossRuntime.test.mjs`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement explicit transitions and separate shield/final health**

```ts
export interface PursuitBossState {
  phase: PursuitBossPhase
  shield: number
  finalHealth: number
  altarUnlocked: boolean
}

export function damagePursuer(state: PursuitBossState, amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false as const, reason: 'invalid-damage' as const }
  if (state.phase === 'first-hunt' || state.phase === 'second-hunt') {
    state.shield = Math.max(0, state.shield - amount)
    if (state.shield > 0) return { ok: true as const, event: { type: 'pursuer-shield-damaged' as const, remaining: state.shield } }
    state.phase = state.phase === 'first-hunt' ? 'first-repelled' : 'second-repelled'
    return { ok: true as const, event: { type: 'pursuer-repelled' as const, phase: state.phase } }
  }
  if (state.phase !== 'final-fight') return { ok: false as const, reason: 'not-damageable' as const }
  state.finalHealth = Math.max(0, state.finalHealth - amount)
  if (state.finalHealth === 0) state.phase = 'defeated'
  return { ok: true as const, event: state.phase === 'defeated'
    ? { type: 'pursuer-defeated' as const }
    : { type: 'pursuer-health-damaged' as const, remaining: state.finalHealth } }
}
```

Only `f3-altar` may unlock true form. The second hunt emits exactly one deterministic route-seal request. Repeated damage after repel or death must not emit another reward-bearing event.

- [ ] **Step 4: Run and verify GREEN**

Run: `cd cocos-client && node --test tests/pursuitBossRuntime.test.mjs`

Expected: all pursuit tests PASS.

- [ ] **Step 5: Commit**

```bash
git add cocos-client/assets/Scripts/Core/Dungeon/PursuitBossRuntime.ts cocos-client/tests/pursuitBossRuntime.test.mjs
git commit -m "feat: add two-repel pursuit Boss rules"
```

### Task 5: Add Extraction Channeling and Integrate the Authoritative Session

**Files:**
- Create: `cocos-client/assets/Scripts/Core/Dungeon/DungeonExtractionRuntime.ts`
- Modify: `cocos-client/assets/Scripts/Core/Dungeon/DungeonSession.ts`
- Modify: `cocos-client/assets/Scripts/Core/Dungeon/DungeonInteraction.ts`
- Create: `cocos-client/tests/dungeonExtractionRuntime.test.mjs`
- Create: `cocos-client/tests/dungeonRunEngine.test.mjs`

- [ ] **Step 1: Write failing extraction tests**

```js
test('extraction completes after three valid seconds and elite or Boss damage interrupts it', () => {
  const extraction = createDungeonExtraction()
  assert.equal(startExtraction(extraction, 'f2-damaged-exit'), true)
  assert.equal(advanceExtraction(extraction, 2.9).type, 'progressed')
  assert.equal(interruptExtraction(extraction, { sourceRole: 'elite', effectiveDamage: 1 }).type, 'extraction-interrupted')
  assert.equal(startExtraction(extraction, 'f2-damaged-exit'), true)
  assert.equal(advanceExtraction(extraction, 3).type, 'extraction-completed')
  assert.equal(advanceExtraction(extraction, 1).type, 'inactive')
})

test('defeat keeps bound rewards but discards carried extraction loot', () => {
  const run = createDungeonSession(profile, 42)
  run.boundLoot.push({ itemId: 'realm-experience', amount: 8 })
  run.carriedLoot.push({ itemId: 'mist-herb', amount: 3 })
  const result = defeatDungeonRun(run)
  assert.deepEqual(result, { phase: 'defeated', retainedLoot: [{ itemId: 'realm-experience', amount: 8 }] })
  assert.deepEqual(run.carriedLoot, [])
})
```

- [ ] **Step 2: Write the integrated deterministic run test**

```js
test('one seeded run can search, pay a door, repel twice, skip the final fight, and extract', () => {
  const run = createDungeonSession(profile, 41)
  searchCurrentRoom(run)
  chooseDungeonExit(run, 'f1-entry-to-forest')
  for (let step = 0; step < 1200; step += 1) advanceDungeonRun(run, 0.1, { paused: false })
  applyPursuerDamage(run, 999)
  chooseDungeonExit(run, 'f1-forest-to-floor2')
  beginSecondPursuit(run)
  applyPursuerDamage(run, 999)
  moveRunTo(run, 'f2-damaged-exit')
  beginDungeonExtraction(run)
  for (let step = 0; step < 30; step += 1) advanceDungeonRun(run, 0.1, { paused: false })
  assert.equal(run.phase, 'extracted')
  assert.equal(run.pursuer.phase, 'second-repelled')
})
```

- [ ] **Step 3: Run and verify RED**

Run: `cd cocos-client && node --test tests/dungeonExtractionRuntime.test.mjs tests/dungeonRunEngine.test.mjs`

Expected: FAIL because extraction and integrated session APIs are missing.

- [ ] **Step 4: Implement channeling and explicit commands**

```ts
export type DungeonCommand =
  | { type: 'search' }
  | { type: 'choose-exit'; exitId: string }
  | { type: 'activate-altar' }
  | { type: 'begin-extraction' }
  | { type: 'abandon' }

export interface DungeonExtractionState {
  phase: 'idle' | 'channeling' | 'completed'
  roomId: string | null
  progressSeconds: number
}

export interface DungeonRun {
  id: string
  seed: number
  profile: DungeonProfile
  phase: DungeonRunPhase
  map: DungeonMapState
  pressure: DungeonPressureState
  pursuer: PursuitBossState
  extraction: DungeonExtractionState
  doorCurrency: number
  searchedRoomIds: string[]
  carriedLoot: RunLoot[]
  boundLoot: RunLoot[]
  eventSequence: number
}

export function interruptExtraction(
  state: DungeonExtractionState,
  hit: { sourceRole: 'ordinary' | 'elite' | 'boss'; effectiveDamage: number },
) {
  if (state.phase !== 'channeling') return { type: 'inactive' as const }
  if (hit.effectiveDamage <= 0 || hit.sourceRole === 'ordinary') return { type: 'ignored' as const }
  state.phase = 'idle'
  state.progressSeconds = 0
  return { type: 'extraction-interrupted' as const, reason: `${hit.sourceRole}-damage` }
}
```

Replace implicit `interactDungeonRun` routing with `applyDungeonCommand(run, command)`. `advanceDungeonRun` advances pressure, pursuit triggers, and extraction using the same bounded effective delta. Every accepted mutation increments `eventSequence` and returns immutable events.

An extraction completion event contains `exitKind: 'damaged' | 'full'`, `explorationRate`, `bossDefeated`, `loot`, and `retainedLoot`. `f2-damaged-exit` produces `damaged`; `f3-full-exit` produces `full`. Defeat and abandon clear `carriedLoot`, return only `boundLoot`, and never emit `extraction-completed`. Final Boss defeat opens the sealed route to `f3-sword-vault` exactly once.

- [ ] **Step 5: Add checkpoint round-trip tests**

Add this serializable contract to `DungeonSession.ts`, importing the four focused runtime state types:

```ts
export interface DungeonRunCheckpoint {
  schemaVersion: 1
  runId: string
  profileId: string
  seed: number
  phase: DungeonRunPhase
  map: DungeonMapState
  pressure: DungeonPressureState
  pursuer: PursuitBossState
  extraction: DungeonExtractionState
  doorCurrency: number
  searchedRoomIds: string[]
  carriedLoot: RunLoot[]
  boundLoot: RunLoot[]
  eventSequence: number
}
```

Create `checkpointDungeonRun(run)`, `validateDungeonCheckpointShape(checkpoint)`, and `restoreDungeonSession(profile, checkpoint)`. Assert deep isolation, schema version `1`, canonical IDs, finite bounded numbers, and equality after JSON serialization. Shape validation must not require a profile; restoration must reject profile ID, room ID, route, or extraction state that does not match the loaded profile.

- [ ] **Step 6: Run and verify GREEN**

Run: `cd cocos-client && node --test tests/dungeonExtractionRuntime.test.mjs tests/dungeonRunEngine.test.mjs tests/dungeonSession.test.mjs`

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add cocos-client/assets/Scripts/Core/Dungeon/DungeonExtractionRuntime.ts cocos-client/assets/Scripts/Core/Dungeon/DungeonSession.ts cocos-client/assets/Scripts/Core/Dungeon/DungeonInteraction.ts cocos-client/tests/dungeonExtractionRuntime.test.mjs cocos-client/tests/dungeonRunEngine.test.mjs
git commit -m "feat: integrate extraction dungeon session"
```

### Task 6: Add Seeded Room Encounters and Reuse Live Combat

**Files:**
- Create: `cocos-client/assets/Scripts/Core/Dungeon/DungeonEncounterDirector.ts`
- Create: `cocos-client/assets/resources/Data/dungeon-encounters.json`
- Modify: `cocos-client/assets/Scripts/Core/BattleRuntime.ts`
- Modify: `cocos-client/assets/Scripts/Game/BattleRuntimeController.ts`
- Create: `cocos-client/tests/dungeonEncounterDirector.test.mjs`
- Create: `cocos-client/tests/dungeonBattleAdapter.test.mjs`

- [ ] **Step 1: Write deterministic encounter tests**

```js
test('the same seed and room produce the same roster and loot', () => {
  const first = planDungeonEncounter(catalog, 'f2-bridge-combat', 77)
  const second = planDungeonEncounter(catalog, 'f2-bridge-combat', 77)
  assert.deepEqual(first, second)
  assert.ok(first.enemies.every((enemy) => ['moss-wolf', 'green-wing-moth', 'fog-spider'].includes(enemy.id)))
  assert.ok(first.maxAlive <= 18)
})

test('pursuit and final Boss plans reuse the Boss actor but have different authority', () => {
  assert.equal(planPursuitEncounter(catalog, 1).completion, 'repel')
  assert.equal(planPursuitEncounter(catalog, 3).completion, 'kill')
})
```

- [ ] **Step 2: Run and verify RED**

Run: `cd cocos-client && node --test tests/dungeonEncounterDirector.test.mjs tests/dungeonBattleAdapter.test.mjs`

Expected: FAIL because the encounter director and controller API do not exist.

- [ ] **Step 3: Define the bounded battle request**

```ts
export interface DungeonBattleRequest {
  id: string
  seed: number
  enemies: EnemyProfile[]
  defeatTarget: number
  maxAlive: number
  boss: EnemyProfile | null
  completion: 'clear-room' | 'repel' | 'kill'
}

export interface DungeonBattleResult {
  requestId: string
  completion: DungeonBattleRequest['completion']
  defeatedEnemyIds: number[]
}
```

`dungeon-encounters.json` must define ordinary rosters for every combat, mechanism, elite, and Boss room. Use scene-matching actors already present in the project: moss wolf and green-wing moth on floor one; fog spider, lantern wraith, and elite moss wolf on floor two; the dedicated `mist-bamboo-emperor` actor as the pursuit/final Boss on floor three.

- [ ] **Step 4: Add a dungeon encounter mode to the existing controller**

Expose only these methods from `BattleRuntimeController`:

```ts
beginDungeonEncounter(request: DungeonBattleRequest): boolean
cancelDungeonEncounter(requestId: string): boolean
isDungeonEncounterActive(): boolean
onDungeonEncounterCompleted: ((result: DungeonBattleResult) => void) | null
```

Pass `defeatTarget` and `maxAlive` into `createBattleRuntime`. In dungeon mode, do not run world Boss gates, world settlement, world rewards, or next-stage flow. Continue using the same `EnemySpawner`, `EnemyController`, `EnemyCombatResolverAdapter`, `ArtifactRuntime`, soul/drop pools, and player input.

- [ ] **Step 5: Assert generation cleanup**

Tests must prove cancelling or changing rooms despawns every enemy, cancels active hitboxes/projectiles, resets Boss telegraphs, and ignores stale completion callbacks from a previous request ID.

- [ ] **Step 6: Run and verify GREEN**

Run: `cd cocos-client && node --test tests/dungeonEncounterDirector.test.mjs tests/dungeonBattleAdapter.test.mjs tests/playableBattle.test.mjs tests/bossBrain.test.mjs`

Expected: all tests PASS with world-stage behavior unchanged.

- [ ] **Step 7: Commit**

```bash
git add cocos-client/assets/Scripts/Core/Dungeon/DungeonEncounterDirector.ts cocos-client/assets/resources/Data/dungeon-encounters.json cocos-client/assets/Scripts/Core/BattleRuntime.ts cocos-client/assets/Scripts/Game/BattleRuntimeController.ts cocos-client/tests/dungeonEncounterDirector.test.mjs cocos-client/tests/dungeonBattleAdapter.test.mjs
git commit -m "feat: reuse live combat for dungeon rooms"
```

### Task 7: Migrate to Player Save V4 and Persist Active Runs Atomically

**Files:**
- Create: `cocos-client/assets/Scripts/Core/Dungeon/DungeonEntryRules.ts`
- Modify: `cocos-client/assets/Scripts/Core/Progression/PlayerSave.ts`
- Modify: `cocos-client/assets/Scripts/Core/Progression/SaveRepository.ts`
- Modify: `cocos-client/assets/Scripts/Core/Progression/DualModeRuntime.ts`
- Modify: `cocos-client/assets/Scripts/Core/World/WorldRewards.ts`
- Modify: `cocos-client/tests/playerSave.test.mjs`
- Create: `cocos-client/tests/dungeonEntryRules.test.mjs`
- Modify: `cocos-client/tests/dualModeRuntime.test.mjs`

- [ ] **Step 1: Write failing migration and daily-entry tests**

```js
test('V3 migrates to V4 with three unused daily entries and no active run', () => {
  const save = migratePlayerSave({ version: 3, inventory: { dungeonPasses: 2 } })
  assert.equal(save.version, 4)
  assert.deepEqual(save.dungeon, { dayKey: '', freeEntriesUsed: 0, activeRun: null })
})

test('entry uses three daily attempts before consuming a pass', () => {
  let save = createDefaultSave()
  save.inventory.dungeonPasses = 1
  for (let index = 0; index < 3; index += 1) {
    const result = consumeDungeonEntry(save, '2026-08-19')
    assert.equal(result.payment, 'free')
    save = result.save
  }
  const paid = consumeDungeonEntry(save, '2026-08-19')
  assert.equal(paid.payment, 'pass')
  assert.equal(paid.save.inventory.dungeonPasses, 0)
})
```

- [ ] **Step 2: Run and verify RED**

Run: `cd cocos-client && node --test tests/playerSave.test.mjs tests/dungeonEntryRules.test.mjs tests/dualModeRuntime.test.mjs`

Expected: FAIL because V4 dungeon state and entry rules do not exist.

- [ ] **Step 3: Define PlayerSave V4**

```ts
export interface PlayerCharacterSave {
  id: 'qinglan'
  realm: 'qi-refining'
  innateSkillId: 'flying-sword-art'
}

export interface PlayerWorldSave {
  highestClearedStage: number
  claimedFirstClears: number[]
}

export interface PlayerInventorySave {
  dungeonPasses: number
  artifacts: Partial<Record<ArtifactId, number>>
  relics: Partial<Record<RelicId, number>>
  materials: Record<string, number>
}

export interface ActiveDungeonSave {
  payment: 'free' | 'pass'
  checkpoint: DungeonRunCheckpoint
}

export interface PlayerSaveV4 {
  version: 4
  spiritStones: number
  character: PlayerCharacterSave
  world: PlayerWorldSave
  inventory: PlayerInventorySave
  loadout: PlayerLoadout
  rewardLedger: string[]
  dungeon: {
    dayKey: string
    freeEntriesUsed: number
    activeRun: ActiveDungeonSave | null
  }
}
```

Rename internal `PlayerSaveV3` references in `SaveRepository.ts`, `DualModeRuntime.ts`, and `WorldRewards.ts` to `PlayerSaveV4`. Migration accepts V1-V4 shapes, validates the checkpoint envelope with a profile-independent `validateDungeonCheckpointShape`, and deep-clones all nested state. The later controller restore performs profile-dependent room and route validation through `restoreDungeonSession(profile, checkpoint)`.

- [ ] **Step 4: Make entry and checkpoint writes atomic**

Extend `DungeonSessionPort` with:

```ts
isReady(): boolean
restore(checkpoint: DungeonRunCheckpoint): boolean
checkpoint(): DungeonRunCheckpoint | null
```

`enterDungeon` rejects with `dungeon-not-ready` before preview or payment when `isReady()` is false. It must then validate and begin, obtain the checkpoint, consume the free entry/pass, set `save.dungeon.activeRun`, and perform one repository save. On persistence failure, cancel the begun run and retain the previous save. Add `handleDungeonCheckpoint`, `handleDungeonDefeated`, and `handleDungeonAbandoned`; each performs one save and leaves state retryable on failure.

Add `recoverDungeonRestoreFailure()`: when an active entry exists but profile-dependent restoration fails, clone the save, refund its recorded payment, clear `activeRun`, persist once, then publish the repaired save. If persistence fails, retain the active entry so the recovery remains retryable and cannot double-refund.

- [ ] **Step 5: Recover corrupt checkpoints with one refund**

`migratePlayerSave` must inspect the raw `activeRun.payment`. If the checkpoint is invalid, clear it and call `refundDungeonEntry` once: decrement `freeEntriesUsed` for a free payment or increment `dungeonPasses` for a pass payment. A second migration of the repaired value must not refund again.

- [ ] **Step 6: Run and verify GREEN**

Run: `cd cocos-client && node --test tests/playerSave.test.mjs tests/dungeonEntryRules.test.mjs tests/dualModeRuntime.test.mjs tests/dualModeFlow.test.mjs`

Expected: all progression and dual-mode tests PASS.

- [ ] **Step 7: Commit**

```bash
git add cocos-client/assets/Scripts/Core/Dungeon/DungeonEntryRules.ts cocos-client/assets/Scripts/Core/Progression/PlayerSave.ts cocos-client/assets/Scripts/Core/Progression/SaveRepository.ts cocos-client/assets/Scripts/Core/Progression/DualModeRuntime.ts cocos-client/assets/Scripts/Core/World/WorldRewards.ts cocos-client/tests/playerSave.test.mjs cocos-client/tests/dungeonEntryRules.test.mjs cocos-client/tests/dualModeRuntime.test.mjs
git commit -m "feat: persist resumable dungeon runs in save V4"
```

### Task 8: Build the Dungeon Controller, Layout, and Presenter

**Files:**
- Modify: `cocos-client/assets/Scripts/Game/DungeonRunController.ts`
- Modify: `cocos-client/assets/Scripts/Game/DualModeGameController.ts`
- Create: `cocos-client/assets/Scripts/Game/DungeonLayout.ts`
- Create: `cocos-client/assets/Scripts/Game/DungeonRunPresenter.ts`
- Modify: `cocos-client/tests/dungeonRunController.test.mjs`
- Create: `cocos-client/tests/dungeonLayout.test.mjs`
- Create: `cocos-client/tests/dungeonRunPresenter.test.mjs`

- [ ] **Step 1: Write failing safe-area layout tests**

```js
const viewports = [
  { name: 'design', cssWidth: 750, cssHeight: 1334, topInsetPx: 0, bottomInsetPx: 0 },
  { name: 'iphone', cssWidth: 390, cssHeight: 844, topInsetPx: 47, bottomInsetPx: 34 },
  { name: 'android-long', cssWidth: 412, cssHeight: 915, topInsetPx: 32, bottomInsetPx: 24 },
  { name: 'landscape', cssWidth: 844, cssHeight: 390, topInsetPx: 0, bottomInsetPx: 20 },
]

test('dungeon HUD, map button, interaction hint, and settlement stay inside safe bounds', () => {
  for (const viewport of viewports) {
    const layout = computeDungeonLayout(viewport)
    for (const rect of [layout.hud, layout.mapButton, layout.interaction, layout.settlement]) {
      assert.equal(rectInside(rect, layout.safeRect), true, `${viewport.name}: ${JSON.stringify(rect)}`)
    }
    assert.ok(layout.settlement.height <= layout.safeRect.height * 0.7)
  }
})
```

- [ ] **Step 2: Write controller/presenter behavior tests**

Assert that `update(delta)` pauses when the map or choice overlay is open, accepted session events produce one immutable checkpoint callback, pursuit warning precedes Boss visibility, and `onDestroy` removes every callback and pending schedule.

- [ ] **Step 3: Run and verify RED**

Run: `cd cocos-client && node --test tests/dungeonLayout.test.mjs tests/dungeonRunPresenter.test.mjs tests/dungeonRunController.test.mjs`

Expected: FAIL because layout and presenter modules do not exist.

- [ ] **Step 4: Implement the layout contract**

```ts
export interface DungeonLayout {
  safeRect: UiRect
  battleRect: UiRect
  hud: UiRect
  mapButton: UiRect
  interaction: UiRect
  settlement: UiRect
}

export function computeDungeonLayout(metrics: ViewportMetrics): DungeonLayout {
  const scale = 750 / Math.max(1, metrics.cssWidth)
  const width = metrics.cssWidth * scale
  const height = metrics.cssHeight * scale
  const top = metrics.topInsetPx * scale
  const bottom = metrics.bottomInsetPx * scale
  const safeRect = rect(-width / 2, -height / 2 + bottom, width, height - top - bottom)
  return placeDungeonRegions(safeRect)
}
```

Use fixed physical touch targets of at least 44px. Do not scale font size from viewport width.

- [ ] **Step 5: Replace the controller’s single-button flow**

`DungeonRunController` receives explicit commands, battle completion, effective damage, pause state, and extraction ticks. It exposes `onCheckpoint: (checkpoint) => boolean`, `onRunEvent`, and `onTerminalResult`. For every significant mutation it clones the current run, applies the command to the candidate, asks `onCheckpoint` to persist the candidate, and assigns `this.run = candidate` only when persistence succeeds. `DualModeGameController` restores `save.dungeon.activeRun` only after the profile has loaded. If profile-dependent restoration rejects the checkpoint, call `DualModeRuntime.recoverDungeonRestoreFailure()` to clear the active run and refund its recorded payment in one save; repeat startup must not refund again. Failed persistence leaves both the visible run and authoritative run unchanged.

- [ ] **Step 6: Implement the presenter hierarchy**

Create runtime nodes named:

```text
DungeonWorldLayer
DungeonHud
DungeonPressureBar
DungeonMapButton
DungeonMapOverlay
DungeonInteractionHint
DungeonPursuitWarning
DungeonSettlement
```

The presenter receives `SharedActorLayer`, `SharedEffectLayer`, `SharedDropLayer`, and `SharedInputLayer` references from the bootstrap; it must not create a second player, enemy pool, artifact runtime, or combat resolver. Loot events spawn bounded pooled pickups on `SharedDropLayer`, automatically attract them to the player, and show only a short icon/rarity/name toast for artifacts or attachments. The HUD shows only health, floor, pressure, and carried loot count. Opening `DungeonMapOverlay` pauses the run. Only final-fight events show the full Boss bar. Settlement is manual-close, distinguishes damaged/full extraction, displays exploration rate and Boss state, and never schedules a three-second auto-dismiss.

- [ ] **Step 7: Run and verify GREEN**

Run: `cd cocos-client && node --test tests/dungeonLayout.test.mjs tests/dungeonRunPresenter.test.mjs tests/dungeonRunController.test.mjs tests/dualModeRuntime.test.mjs`

Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add cocos-client/assets/Scripts/Game/DungeonRunController.ts cocos-client/assets/Scripts/Game/DualModeGameController.ts cocos-client/assets/Scripts/Game/DungeonLayout.ts cocos-client/assets/Scripts/Game/DungeonRunPresenter.ts cocos-client/tests/dungeonRunController.test.mjs cocos-client/tests/dungeonLayout.test.mjs cocos-client/tests/dungeonRunPresenter.test.mjs
git commit -m "feat: present playable pursuit dungeon"
```

### Task 9: Create Three Distinct Floor Asset Sets and Resource Lifecycles

**Files:**
- Create: `cocos-client/assets/Scripts/Core/Dungeon/DungeonVisualCatalog.ts`
- Create: `cocos-client/assets/Scripts/Game/DungeonResourceController.ts`
- Add: `cocos-client/assets/resources/Assets/Dungeon/MistBamboo/Floor1/far.webp`
- Add: `cocos-client/assets/resources/Assets/Dungeon/MistBamboo/Floor1/mid.webp`
- Add: `cocos-client/assets/resources/Assets/Dungeon/MistBamboo/Floor2/far.webp`
- Add: `cocos-client/assets/resources/Assets/Dungeon/MistBamboo/Floor2/mid.webp`
- Add: `cocos-client/assets/resources/Assets/Dungeon/MistBamboo/Floor3/far.webp`
- Add: `cocos-client/assets/resources/Assets/Dungeon/MistBamboo/Floor3/mid.webp`
- Add: `cocos-client/assets/resources/Assets/Dungeon/MistBamboo/Effects/pursuit_edge.png`
- Add: `cocos-client/assets/resources/Assets/Dungeon/MistBamboo/Effects/extraction_array.png`
- Add: `cocos-client/assets/resources/Assets/ActorAtlases/MistBambooEmperor/atlas.png`
- Add: `cocos-client/assets/resources/Assets/Audio/Cues/pursuit-warning.wav`
- Add: `cocos-client/assets/resources/Assets/Audio/Cues/extraction-start.wav`
- Add: `cocos-client/assets/resources/Assets/Audio/Cues/extraction-complete.wav`
- Modify: `cocos-client/assets/Data/vertical-slice-animation-sources.json`
- Modify: `cocos-client/assets/Data/asset-catalog.json`
- Modify: `cocos-client/assets/Data/animation-atlas.json`
- Modify: `cocos-client/assets/resources/Data/animation-atlas.json`
- Modify: `cocos-client/assets/resources/Data/audio-catalog.json`
- Modify: `cocos-client/tools/build-vertical-slice-atlases.py`
- Create: `cocos-client/tests/dungeonAssetCatalog.test.mjs`
- Modify: `cocos-client/tests/verticalSliceAtlasBuilder.test.mjs`
- Modify: `cocos-client/tools/report-resource-budget.mjs`

- [ ] **Step 1: Write failing asset contract tests**

```js
test('each floor owns a distinct complete background pair', () => {
  const visuals = [1, 2, 3].map((floor) => dungeonFloorVisualFor('mist-vault', floor))
  assert.equal(new Set(visuals.map((visual) => visual.farPath)).size, 3)
  assert.equal(new Set(visuals.map((visual) => visual.midPath)).size, 3)
  for (const visual of visuals) {
    assert.ok(existsSync(resolve('assets/resources', `${visual.farPath.replace('/spriteFrame', '')}.webp`)))
    assert.ok(existsSync(resolve('assets/resources', `${visual.midPath.replace('/spriteFrame', '')}.webp`)))
  }
})

test('the pursuit Boss uses one atlas with complete action contracts', () => {
  const actor = manifest.actors.find((candidate) => candidate.id === 'mist-bamboo-emperor')
  assert.ok(actor)
  assert.equal(new Set(actor.actions.map((action) => action.atlas)).size, 1)
  assert.deepEqual(actor.actions.map((action) => action.name), ['idle', 'move', 'sweep', 'spikes', 'roar', 'hurt', 'death'])
  assert.equal(actor.actions.every((action) => action.frames.length >= 6), true)
})
```

- [ ] **Step 2: Run and verify RED**

Run: `cd cocos-client && node --test tests/dungeonAssetCatalog.test.mjs`

Expected: FAIL because the catalog and files do not exist.

- [ ] **Step 3: Generate source art with image generation**

Generate three separate 1536x1024 non-pixel-art xianxia backgrounds, each preserving a clear horizontal combat band and full scene readability:

```text
Floor 1: realistic Chinese xianxia wet bamboo forest exterior, green-cyan mist, rain-dark stone path, abandoned alchemy hut, layered depth, no characters, no text, no circles, no UI, no geometric overlays
Floor 2: realistic moonlit suspended bamboo bridge and cold blue spirit lanterns above a fog ravine, sword-array ruins, layered depth, no characters, no text, no circles, no UI
Floor 3: realistic ancient bamboo emperor cave sanctuary, gold-cyan altar, jade sword vault, deep cavern scale, ominous mist, no characters, no text, no circles, no UI
```

Create a clean far layer and a transparent mid/foreground layer for each floor. Generate `pursuit_edge.png` as transparent inward-moving mist/leaf edges and `extraction_array.png` as a transparent grounded cultivation formation with no surrounding frame.

Generate a consistent full-body `mist-bamboo-emperor` source character: ancient deer-antlered bamboo spirit emperor, weathered jade-and-bamboo armor, long spectral sleeves, complete feet and weapon silhouette, readable at mobile scale, transparent background, no text. Produce the seven approved action sequences (`idle`, `move`, `sweep`, `spikes`, `roar`, `hurt`, `death`) and use the existing reviewed-candidate workflow before promotion.

- [ ] **Step 4: Implement floor-only loading**

```ts
export interface DungeonFloorVisual {
  dungeonId: 'mist-vault'
  floor: 1 | 2 | 3
  farPath: string
  midPath: string
  monsterActorIds: readonly string[]
}
```

`DungeonResourceController.activateFloor` loads the current pair and room roster, prefetches only the next floor, then decrements references for the previous floor after the new pair is visible. Do not load all three floors on dungeon entry.

`DungeonResourceController.prepareEntry()` loads and validates floor-one backgrounds, current room actors, pursuit warning effect, extraction effect, and required audio before setting the controller readiness flag. The dungeon entry button remains disabled until this promise succeeds. A failed preparation shows a retry action and leaves `DungeonSessionPort.isReady()` false, so no free attempt or pass can be consumed.

Add `packingMode: "unified"` support to `build-vertical-slice-atlases.py`. For `mist-bamboo-emperor`, pack every approved action into one `atlas.png`; every action manifest references that same file with distinct frame rectangles. Existing per-action actors must retain byte-for-byte equivalent manifests. Bind the three new audio cues through `audio-catalog.json`, reusing the existing dungeon BGM loop rather than adding another full music track.

- [ ] **Step 5: Validate image quality and budgets**

Use Pillow-based checks to assert nonblank alpha, correct dimensions, no accidental aspect distortion, and unique perceptual hashes. Update the resource report so the six backgrounds, effects, current monster atlases, and audio stay inside the existing package budget.

- [ ] **Step 6: Run and verify GREEN**

Run: `cd cocos-client && node --test tests/dungeonAssetCatalog.test.mjs tests/verticalSliceAtlasBuilder.test.mjs tests/resourceBudget.test.mjs`

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add cocos-client/assets/Scripts/Core/Dungeon/DungeonVisualCatalog.ts cocos-client/assets/Scripts/Game/DungeonResourceController.ts cocos-client/assets/resources/Assets/Dungeon/MistBamboo cocos-client/assets/resources/Assets/ActorAtlases/MistBambooEmperor cocos-client/assets/resources/Assets/Audio/Cues/pursuit-warning.wav cocos-client/assets/resources/Assets/Audio/Cues/extraction-start.wav cocos-client/assets/resources/Assets/Audio/Cues/extraction-complete.wav cocos-client/assets/Data/vertical-slice-animation-sources.json cocos-client/assets/Data/asset-catalog.json cocos-client/assets/Data/animation-atlas.json cocos-client/assets/resources/Data/animation-atlas.json cocos-client/assets/resources/Data/audio-catalog.json cocos-client/tools/build-vertical-slice-atlases.py cocos-client/tests/dungeonAssetCatalog.test.mjs cocos-client/tests/verticalSliceAtlasBuilder.test.mjs cocos-client/tools/report-resource-budget.mjs
git commit -m "feat: add distinct Mist Bamboo dungeon visuals"
```

### Task 10: Replace the Colored-Floor Prototype and Update Build Contracts

**Files:**
- Modify: `cocos-client/assets/Scripts/Game/PortraitBattleBootstrap.ts`
- Modify: `cocos-client/assets/Data/scene-blueprint.json`
- Modify: `cocos-client/assets/Scenes/MainBattle.scene`
- Modify: `cocos-client/tools/check-cocos-build-readiness.mjs`
- Modify: `cocos-client/tools/check-cocos-build-output.mjs`
- Modify: `cocos-client/tests/sceneAssembly.test.mjs`
- Modify: `cocos-client/tests/sceneBlueprint.test.mjs`
- Modify: `cocos-client/tests/sceneBlueprintValidation.test.mjs`

- [ ] **Step 1: Write failing assembly contracts**

Replace assertions for `DungeonFloor1`, `DungeonFloor2`, `DungeonFloor3`, and the permanent `DungeonInteractButton` with the presenter hierarchy from Task 8. Lock this runtime ownership tree in the tests:

```text
Canvas
  SharedCombatRoot
    SharedActorLayer
    SharedEffectLayer
    SharedDropLayer
    SharedInputLayer
  WorldRoot
    WorldLayer
    WorldHudLayer
  DungeonRoot
    DungeonWorldLayer
    DungeonHud
```

Assert that entering dungeon hides world navigation and world HUD, keeps `SharedCombatRoot` active, switches the shared `BattleRuntimeController` to dungeon encounter mode, and restores world state only after accepted terminal persistence.

- [ ] **Step 2: Run and verify RED**

Run: `cd cocos-client && node --test tests/sceneAssembly.test.mjs tests/sceneBlueprint.test.mjs tests/sceneBlueprintValidation.test.mjs`

Expected: FAIL because the old colored-floor nodes are still assembled.

- [ ] **Step 3: Wire the new page**

Remove `createDungeonFloor`, `DUNGEON_FLOOR_COLORS`, the permanent room label, and the one-button implicit interaction flow. Split the existing runtime-generated `BattleRoot` into the ownership tree above: move actor, effect, drop, input, player, enemy pool, artifact runtime, and `BattleRuntimeController` under `SharedCombatRoot`; leave stage background, world HUD, settlement, and navigation under `WorldRoot`. Build `DungeonRunPresenter` under `DungeonRoot`, bind it to the shared combat references, route map/door/search/altar/extraction input to explicit commands, and release all listeners in `onDestroy`.

- [ ] **Step 4: Update import and build-output contracts**

Require all new TypeScript files, JSON catalogs, six background files, two effect files, and corresponding Cocos `.meta` files. Add compiled markers `DungeonPressureRuntime`, `PursuitBossRuntime`, `DungeonRunPresenter`, and `DungeonResourceController` to `check-cocos-build-output.mjs`.

- [ ] **Step 5: Import with Cocos and run focused tests**

Open the worktree project with `D:\CocosCreator\3.8.8\CocosCreator.exe`, allow Cocos to generate valid `.meta` files, and verify the editor console has no TypeScript or asset import errors.

Run: `cd cocos-client && node --test tests/sceneAssembly.test.mjs tests/sceneBlueprint.test.mjs tests/sceneBlueprintValidation.test.mjs tests/buildReadiness.test.mjs`

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add cocos-client/assets/Scripts/Game/PortraitBattleBootstrap.ts cocos-client/assets/Data/scene-blueprint.json cocos-client/assets/Scenes/MainBattle.scene cocos-client/tools/check-cocos-build-readiness.mjs cocos-client/tools/check-cocos-build-output.mjs cocos-client/tests/sceneAssembly.test.mjs cocos-client/tests/sceneBlueprint.test.mjs cocos-client/tests/sceneBlueprintValidation.test.mjs cocos-client/assets/Scripts/Core/Dungeon/*.meta cocos-client/assets/Scripts/Game/Dungeon*.meta cocos-client/assets/resources/Assets/Dungeon/**/*.meta
git commit -m "feat: assemble complete dungeon runtime page"
```

### Task 11: Add Simulation, Performance, Build, and Play-Agent Gates

**Files:**
- Create: `cocos-client/tools/simulate-pursuit-dungeon.mjs`
- Create: `cocos-client/tests/dungeonSimulation.test.mjs`
- Modify: `scripts/game-agent.mjs`
- Create: `docs/reports/m3-pursuit-dungeon-verification.md`
- Regenerate: `cocos-client/build/web-mobile/**`

- [ ] **Step 1: Write the failing 100-seed simulation test**

```js
test('one hundred seeded policy runs always reach a terminal result without invalid state', () => {
  const reports = Array.from({ length: 100 }, (_, seed) => {
    const policy = seed % 3 === 0 ? safePolicy : seed % 3 === 1 ? balancedPolicy : greedyPolicy
    return simulateDungeon(seed, policy)
  })
  assert.equal(reports.every((report) => ['extracted', 'defeated'].includes(report.phase)), true)
  assert.equal(reports.filter((_, seed) => seed % 3 === 0).every((report) => report.earlyExtraction), true)
  assert.equal(reports.filter((_, seed) => seed % 3 === 2).every((report) => report.bossDefeated), true)
  assert.equal(reports.every((report) => report.minimumDoorCurrency >= 0), true)
  assert.equal(reports.every((report) => report.rewardCommitCount <= 1), true)
  assert.equal(reports.every((report) => report.escapePathAlwaysAvailable), true)
})
```

- [ ] **Step 2: Run and verify RED**

Run: `cd cocos-client && node --test tests/dungeonSimulation.test.mjs`

Expected: FAIL because the simulation tool does not exist.

- [ ] **Step 3: Implement deterministic policies**

Provide `safePolicy`, `balancedPolicy`, and `greedyPolicy`. Each policy may only use currently revealed room information. The simulator records room visits, searches, pressure phases, pursuit encounters, route seals, extraction result, reward commit count, and terminal reason.

- [ ] **Step 4: Extend the game agent**

Add `--mode dungeon --policy safe|balanced|greedy`. The agent must run these three scenarios:

```text
balanced: search at least three rooms, open one paid door, repel the pursuer, obtain an artifact or attachment, and extract
safe: use the damaged floor-two extraction array
greedy: reach floor three, activate the altar, defeat the Boss, open the sword vault, and use the full extraction gate
```

Capture screenshots before pursuit, during final Boss telegraph, and on settlement. Record viewport, runtime errors, dropped-frame samples, visible clipping, and interaction blockers.

The balanced successful run must finish between 6 and 9 minutes of wall-clock play under normal agent input; safe withdrawal may finish earlier and greedy completion may reach the upper bound.

- [ ] **Step 5: Run the complete test suite**

Run: `cd cocos-client && npm test`

Expected: all tests PASS; the existing single intentional skip remains the only skip.

- [ ] **Step 6: Build Web Mobile from the worktree**

```powershell
$args=@('--project','D:\游戏\douyin-mini-rpg\.worktrees\m3-pursuit-dungeon\cocos-client','--build','platform=web-mobile;debug=false')
Start-Process -FilePath 'D:\CocosCreator\3.8.8\CocosCreator.exe' -ArgumentList $args -Wait -WindowStyle Hidden
```

Expected: `cocos-client/build/web-mobile/index.html` exists and the build log reports the web-mobile task finished.

- [ ] **Step 7: Verify output and resource budgets**

Run:

```powershell
cd cocos-client
$env:COCOS_CREATOR_PATH='D:\CocosCreator\3.8.8\CocosCreator.exe'
npm run build:check
npm run verify:build-output -- build/web-mobile
npm run report:resources
```

Expected: readiness and build-output checks report `ok: true`; no resource budget is exceeded.

- [ ] **Step 8: Run mobile viewport and play-agent verification**

Serve the worktree build:

```powershell
python -m http.server 4175 --bind 127.0.0.1 --directory cocos-client/build/web-mobile
```

Run the dungeon agent at `390x844`, `412x915`, `430x932`, and `844x390`. Verify complete player/Boss frames, non-stretched backgrounds, no world navigation during dungeon play, map overlay pause, three-second interruptible extraction, manual settlement close, and P95 frame time at or below 20ms with no sustained period below 30 FPS.

- [ ] **Step 9: Write the evidence report**

Record test totals, build checks, asset sizes, four viewport screenshots, simulation summary, agent scenario outcomes, P95 frame time, minimum FPS, and any residual risk in `docs/reports/m3-pursuit-dungeon-verification.md`.

- [ ] **Step 10: Commit**

```bash
git add cocos-client/tools/simulate-pursuit-dungeon.mjs cocos-client/tests/dungeonSimulation.test.mjs scripts/game-agent.mjs docs/reports/m3-pursuit-dungeon-verification.md cocos-client/build/web-mobile
git commit -m "test: verify M3 pursuit dungeon release"
```

## Final Verification

- [ ] Run `cd cocos-client && npm test` and confirm zero failures.
- [ ] Run `npm run build:check` and confirm the Cocos 3.8.8 project is ready.
- [ ] Run `npm run verify:build-output -- build/web-mobile` and confirm all M3 compiled markers and resources exist.
- [ ] Run the 100-seed simulation and confirm every run terminates without a dead route or duplicate reward.
- [ ] Complete safe, balanced, and greedy play-agent routes on all four viewports.
- [ ] Review `git diff main...HEAD` and confirm no unrelated main-worktree artifacts entered the branch.
