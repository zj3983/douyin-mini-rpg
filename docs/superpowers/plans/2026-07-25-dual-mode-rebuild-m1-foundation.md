# Dual-Mode Cultivation RPG M1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one deterministic graybox loop in Cocos where the player clears the existing world Boss, receives a dungeon pass, explores a three-floor room graph, obtains one artifact, extracts, and reloads the resulting save.

**Architecture:** `assets/Scripts/Core` becomes the only authoritative rules layer. The live world path remains `Game/BattleRuntimeController -> Core/BattleRuntime.ts`; the older `Scripts/Combat` and graybox `Core/Battle` implementations receive no new rules. New `Core/Dungeon`, `Core/Loadout`, and `Core/Progression` modules own dungeon, equipment, and save rules. Cocos components consume pure-core events and never calculate rewards or mutate inventory directly.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, Node.js built-in test runner, JSON content data, Cocos Web Mobile build checks.

---

## Scope Split

The approved specification is too broad for one safe implementation plan. It is split into independently playable milestones:

1. **M1, this plan:** canonical core, loadout/save schema, world reward, three-floor dungeon graybox, extraction persistence.
2. **M2:** ten-stage world region, two elites, regional Boss, background continuity and stage selection.
3. **M3:** twelve-room authored dungeon, search interactions, magic-pressure phases, pursuit Boss and extraction presentation.
4. **M4:** six active artifacts, five relics, three mutations per artifact, permanent strengthening and inventory UI.
5. **M5:** final actors, monster families, audio/VFX, performance degradation, mobile/device and Douyin release verification.

Each later milestone receives its own implementation plan after the previous milestone passes its completion gate.

## File Map

### Canonical rule files

- Create `cocos-client/assets/Scripts/Core/GameContent.ts`: shared IDs, rarity, item source and content records.
- Create `cocos-client/assets/Scripts/Core/Loadout/LoadoutRules.ts`: three-active/two-relic validation.
- Create `cocos-client/assets/Scripts/Core/Progression/PlayerSave.ts`: versioned save schema, migration and reward application.
- Create `cocos-client/assets/Scripts/Core/Progression/SaveRepository.ts`: storage-port interface and in-memory adapter used by tests.
- Create `cocos-client/assets/Scripts/Core/Dungeon/DungeonTypes.ts`: room graph, pressure and run-state types.
- Create `cocos-client/assets/Scripts/Core/Dungeon/DungeonSession.ts`: room movement, search, door cost, loot, death and extraction rules.
- Create `cocos-client/assets/Scripts/Core/World/WorldRewards.ts`: deterministic first-clear and repeat-clear rewards.

### Cocos integration files

- Modify `cocos-client/assets/Scripts/Game/StageClearPanelController.ts`: remove the live three-second automatic continuation.
- Modify `cocos-client/assets/Scripts/Game/BattleRuntimeController.ts`: emit the canonical world-clear event after the active runtime claims a clear.
- Modify `cocos-client/assets/Scripts/Game/DungeonRunController.ts`: replace floor counter with `DungeonSession` event adapter.
- Create `cocos-client/assets/Scripts/Game/DualModeGameController.ts`: coordinates world completion, dungeon entry and save persistence.
- Modify `cocos-client/assets/Scripts/Game/PortraitBattleBootstrap.ts`: bind the dual-mode controller without adding reward rules.
- Create `cocos-client/assets/resources/Data/dual-mode-slice.json`: first dungeon graph, costs and deterministic loot.
- Create matching Cocos `.meta` files through Creator/import refresh before build verification.

### Tests

- Create `cocos-client/tests/loadoutRules.test.mjs`.
- Create `cocos-client/tests/playerSave.test.mjs`.
- Create `cocos-client/tests/worldRewards.test.mjs`.
- Create `cocos-client/tests/dungeonSession.test.mjs`.
- Create `cocos-client/tests/dualModeFlow.test.mjs`.
- Modify `cocos-client/tests/cocosStructure.test.mjs` to assert canonical imports and reject new Game-to-legacy-Combat dependencies.

## Authority Rule

New code must not import from `assets/Scripts/Combat` or `assets/Scripts/Core/Battle`. Existing legacy imports remain temporarily until migrated in later milestones, but no new behavior may be added there. The live world authority for M1 is `Core/BattleRuntime.ts`; all new rule imports must resolve through `assets/Scripts/Core`.

### Task 1: Define Content IDs and Loadout Rules

**Files:**
- Create: `cocos-client/assets/Scripts/Core/GameContent.ts`
- Create: `cocos-client/assets/Scripts/Core/Loadout/LoadoutRules.ts`
- Test: `cocos-client/tests/loadoutRules.test.mjs`

- [ ] **Step 1: Write the failing loadout test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { validateLoadout } from '../assets/Scripts/Core/Loadout/LoadoutRules.ts'

test('accepts exactly three active artifacts and two relics at maximum', () => {
  assert.equal(validateLoadout({ active: ['flying-sword'], relics: [] }).ok, true)
  assert.equal(validateLoadout({
    active: ['flying-sword', 'thunder-seal', 'soul-bell'],
    relics: ['soul-magnet', 'jade-guard'],
  }).ok, true)
  assert.deepEqual(validateLoadout({
    active: ['flying-sword', 'thunder-seal', 'soul-bell', 'flame-ruler'],
    relics: [],
  }), { ok: false, reason: 'active-limit' })
  assert.deepEqual(validateLoadout({
    active: ['flying-sword'],
    relics: ['soul-magnet', 'jade-guard', 'spirit-vessel'],
  }), { ok: false, reason: 'relic-limit' })
})

test('rejects duplicate equipment IDs', () => {
  assert.deepEqual(validateLoadout({
    active: ['flying-sword', 'flying-sword'],
    relics: [],
  }), { ok: false, reason: 'duplicate-id' })
})
```

- [ ] **Step 2: Run the test and verify the missing-module failure**

Run: `cd cocos-client && node --test tests/loadoutRules.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `LoadoutRules.ts`.

- [ ] **Step 3: Add the shared IDs and minimal validator**

```ts
// GameContent.ts
export type ArtifactId = 'flying-sword' | 'thunder-seal' | 'soul-bell' | 'flame-ruler'
export type RelicId = 'soul-magnet' | 'jade-guard' | 'spirit-vessel'
export type ItemRarity = 'common' | 'spirit' | 'mystic' | 'epic' | 'legendary'

export interface PlayerLoadout {
  active: ArtifactId[]
  relics: RelicId[]
}
```

```ts
// LoadoutRules.ts
import type { PlayerLoadout } from '../GameContent.ts'

export type LoadoutValidation =
  | { ok: true }
  | { ok: false; reason: 'active-limit' | 'relic-limit' | 'duplicate-id' }

export function validateLoadout(loadout: PlayerLoadout): LoadoutValidation {
  if (loadout.active.length > 3) return { ok: false, reason: 'active-limit' }
  if (loadout.relics.length > 2) return { ok: false, reason: 'relic-limit' }
  const ids = [...loadout.active, ...loadout.relics]
  if (new Set(ids).size !== ids.length) return { ok: false, reason: 'duplicate-id' }
  return { ok: true }
}
```

- [ ] **Step 4: Run the focused test**

Run: `cd cocos-client && node --test tests/loadoutRules.test.mjs`

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add cocos-client/assets/Scripts/Core/GameContent.ts cocos-client/assets/Scripts/Core/Loadout/LoadoutRules.ts cocos-client/tests/loadoutRules.test.mjs
git commit -m "feat: define canonical artifact loadouts"
```

### Task 2: Introduce Versioned Player Save and Repository Port

**Files:**
- Create: `cocos-client/assets/Scripts/Core/Progression/PlayerSave.ts`
- Create: `cocos-client/assets/Scripts/Core/Progression/SaveRepository.ts`
- Test: `cocos-client/tests/playerSave.test.mjs`

- [ ] **Step 1: Write failing migration and persistence tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createDefaultSave, migratePlayerSave } from '../assets/Scripts/Core/Progression/PlayerSave.ts'
import { createJsonSaveRepository, createMemorySaveRepository } from '../assets/Scripts/Core/Progression/SaveRepository.ts'

test('creates a version three save with one innate skill and legal loadout', () => {
  const save = createDefaultSave()
  assert.equal(save.version, 3)
  assert.equal(save.character.innateSkillId, 'flying-sword-art')
  assert.deepEqual(save.loadout, { active: [], relics: [] })
  assert.equal(save.inventory.dungeonPasses, 0)
})

test('migrates missing dual-mode fields without deleting legacy balances', () => {
  const migrated = migratePlayerSave({ version: 2, spiritStones: 611, stage: 9 })
  assert.equal(migrated.spiritStones, 611)
  assert.equal(migrated.world.highestClearedStage, 9)
  assert.equal(migrated.inventory.dungeonPasses, 0)
})

test('repository round-trips an isolated copy', () => {
  const repository = createMemorySaveRepository()
  const save = createDefaultSave()
  repository.save(save)
  save.spiritStones = 999
  assert.equal(repository.load()?.spiritStones, 0)
})

test('JSON repository migrates stored legacy data', () => {
  const values = new Map([['cultivation-save-v3', JSON.stringify({ version: 2, spiritStones: 12, stage: 4 })]])
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
  const repository = createJsonSaveRepository(storage, 'cultivation-save-v3')
  assert.equal(repository.load()?.world.highestClearedStage, 4)
})
```

- [ ] **Step 2: Run and verify failure**

Run: `cd cocos-client && node --test tests/playerSave.test.mjs`

Expected: FAIL because progression modules do not exist.

- [ ] **Step 3: Implement schema, migration and repository**

```ts
// PlayerSave.ts
import type { ArtifactId, PlayerLoadout, RelicId } from '../GameContent.ts'

export interface PlayerSaveV3 {
  version: 3
  spiritStones: number
  character: { id: 'qinglan'; realm: 'qi-refining'; innateSkillId: 'flying-sword-art' }
  world: { highestClearedStage: number; claimedFirstClears: number[] }
  inventory: {
    dungeonPasses: number
    artifacts: Partial<Record<ArtifactId, number>>
    relics: Partial<Record<RelicId, number>>
    materials: Record<string, number>
  }
  loadout: PlayerLoadout
  rewardLedger: string[]
}

export function createDefaultSave(): PlayerSaveV3 {
  return {
    version: 3,
    spiritStones: 0,
    character: { id: 'qinglan', realm: 'qi-refining', innateSkillId: 'flying-sword-art' },
    world: { highestClearedStage: 0, claimedFirstClears: [] },
    inventory: { dungeonPasses: 0, artifacts: {}, relics: {}, materials: {} },
    loadout: { active: [], relics: [] },
    rewardLedger: [],
  }
}

export function migratePlayerSave(input: unknown): PlayerSaveV3 {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  const save = createDefaultSave()
  save.spiritStones = Number.isFinite(source.spiritStones) ? Number(source.spiritStones) : 0
  const legacyStage = Number.isFinite(source.stage) ? Math.max(0, Math.floor(Number(source.stage))) : 0
  const world = source.world && typeof source.world === 'object' ? source.world as Record<string, unknown> : {}
  save.world.highestClearedStage = Number.isFinite(world.highestClearedStage)
    ? Math.max(0, Math.floor(Number(world.highestClearedStage)))
    : legacyStage
  if (source.version === 3) {
    const inventory = source.inventory && typeof source.inventory === 'object'
      ? source.inventory as Record<string, unknown>
      : {}
    save.inventory.dungeonPasses = Number.isFinite(inventory.dungeonPasses)
      ? Math.max(0, Math.floor(Number(inventory.dungeonPasses)))
      : 0
    save.inventory.artifacts = inventory.artifacts && typeof inventory.artifacts === 'object'
      ? { ...(inventory.artifacts as PlayerSaveV3['inventory']['artifacts']) }
      : {}
    save.inventory.relics = inventory.relics && typeof inventory.relics === 'object'
      ? { ...(inventory.relics as PlayerSaveV3['inventory']['relics']) }
      : {}
    save.inventory.materials = inventory.materials && typeof inventory.materials === 'object'
      ? { ...(inventory.materials as Record<string, number>) }
      : {}
    const loadout = source.loadout && typeof source.loadout === 'object'
      ? source.loadout as Partial<PlayerLoadout>
      : {}
    save.loadout = {
      active: Array.isArray(loadout.active) ? [...loadout.active] : [],
      relics: Array.isArray(loadout.relics) ? [...loadout.relics] : [],
    }
    save.rewardLedger = Array.isArray(source.rewardLedger)
      ? source.rewardLedger.filter((value): value is string => typeof value === 'string')
      : []
  }
  return save
}
```

```ts
// SaveRepository.ts
import { migratePlayerSave } from './PlayerSave.ts'
import type { PlayerSaveV3 } from './PlayerSave.ts'

export interface SaveRepository {
  load(): PlayerSaveV3 | null
  save(value: PlayerSaveV3): void
}

export function createMemorySaveRepository(initial: PlayerSaveV3 | null = null): SaveRepository {
  let stored = initial ? structuredClone(initial) : null
  return {
    load: () => stored ? structuredClone(stored) : null,
    save: (value) => { stored = structuredClone(value) },
  }
}

export interface StoragePort {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function createJsonSaveRepository(storage: StoragePort, key: string): SaveRepository {
  return {
    load() {
      const raw = storage.getItem(key)
      if (!raw) return null
      try { return migratePlayerSave(JSON.parse(raw)) } catch { return null }
    },
    save(value) { storage.setItem(key, JSON.stringify(value)) },
  }
}
```

- [ ] **Step 4: Run tests**

Run: `cd cocos-client && node --test tests/playerSave.test.mjs tests/loadoutRules.test.mjs`

Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add cocos-client/assets/Scripts/Core/Progression cocos-client/tests/playerSave.test.mjs
git commit -m "feat: add versioned Cocos player save"
```

### Task 3: Make World Boss Rewards Deterministic and Idempotent

**Files:**
- Create: `cocos-client/assets/Scripts/Core/World/WorldRewards.ts`
- Test: `cocos-client/tests/worldRewards.test.mjs`

- [ ] **Step 1: Write the failing reward test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createDefaultSave } from '../assets/Scripts/Core/Progression/PlayerSave.ts'
import { applyWorldBossClear } from '../assets/Scripts/Core/World/WorldRewards.ts'

test('first stage Boss clear grants one dungeon pass exactly once', () => {
  const save = createDefaultSave()
  const first = applyWorldBossClear(save, { stage: 1, rewardId: 'world-1-clear-a' })
  const duplicate = applyWorldBossClear(first.save, { stage: 1, rewardId: 'world-1-clear-a' })
  assert.equal(first.granted.dungeonPasses, 1)
  assert.equal(first.save.inventory.dungeonPasses, 1)
  assert.equal(duplicate.granted.dungeonPasses, 0)
  assert.equal(duplicate.save.inventory.dungeonPasses, 1)
})
```

- [ ] **Step 2: Run and verify failure**

Run: `cd cocos-client && node --test tests/worldRewards.test.mjs`

Expected: FAIL with missing `WorldRewards.ts`.

- [ ] **Step 3: Implement the reducer against the save reward ledger**

Use the `rewardLedger` already defined in Task 2:

```ts
import type { PlayerSaveV3 } from '../Progression/PlayerSave.ts'

export function applyWorldBossClear(
  current: PlayerSaveV3,
  input: { stage: number; rewardId: string },
) {
  const save = structuredClone(current)
  if (save.rewardLedger.includes(input.rewardId)) {
    return { save, granted: { dungeonPasses: 0, spiritStones: 0 } }
  }
  save.rewardLedger.push(input.rewardId)
  save.world.highestClearedStage = Math.max(save.world.highestClearedStage, input.stage)
  save.inventory.dungeonPasses += 1
  save.spiritStones += 80
  return { save, granted: { dungeonPasses: 1, spiritStones: 80 } }
}
```

- [ ] **Step 4: Run focused and save tests**

Run: `cd cocos-client && node --test tests/worldRewards.test.mjs tests/playerSave.test.mjs`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add cocos-client/assets/Scripts/Core/World cocos-client/assets/Scripts/Core/Progression/PlayerSave.ts cocos-client/tests/worldRewards.test.mjs cocos-client/tests/playerSave.test.mjs
git commit -m "feat: grant idempotent world Boss rewards"
```

### Task 4: Build the Three-Floor Dungeon Room Session

**Files:**
- Create: `cocos-client/assets/Scripts/Core/Dungeon/DungeonTypes.ts`
- Create: `cocos-client/assets/Scripts/Core/Dungeon/DungeonSession.ts`
- Create: `cocos-client/assets/resources/Data/dual-mode-slice.json`
- Test: `cocos-client/tests/dungeonSession.test.mjs`

- [ ] **Step 1: Write failing room, door and extraction tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createDungeonSession, enterRoom, searchRoom, extractRun } from '../assets/Scripts/Core/Dungeon/DungeonSession.ts'

const profile = {
  id: 'mist-vault', entryRoomId: 'f1-entry', extractionRoomId: 'f3-gate',
  rooms: [
    { id: 'f1-entry', floor: 1, kind: 'entry', exits: [{ to: 'f1-store', cost: 2 }] },
    { id: 'f1-store', floor: 1, kind: 'treasure', exits: [{ to: 'f3-gate', cost: 0 }], loot: [{ itemId: 'flying-sword', amount: 1 }] },
    { id: 'f3-gate', floor: 3, kind: 'extraction', exits: [] },
  ],
}

test('requires door currency before entering a locked room', () => {
  const run = createDungeonSession(profile, 7)
  assert.equal(enterRoom(run, 'f1-store').ok, false)
  run.doorCurrency = 2
  assert.equal(enterRoom(run, 'f1-store').ok, true)
  assert.equal(run.doorCurrency, 0)
})

test('searches a room once and only extracts carried loot at the gate', () => {
  const run = createDungeonSession(profile, 7)
  run.doorCurrency = 2
  enterRoom(run, 'f1-store')
  assert.equal(searchRoom(run).loot[0].itemId, 'flying-sword')
  assert.equal(searchRoom(run).loot.length, 0)
  enterRoom(run, 'f3-gate')
  const result = extractRun(run)
  assert.equal(result.ok, true)
  assert.deepEqual(result.loot, [{ itemId: 'flying-sword', amount: 1 }])
})
```

- [ ] **Step 2: Run and verify failure**

Run: `cd cocos-client && node --test tests/dungeonSession.test.mjs`

Expected: FAIL with missing dungeon modules.

- [ ] **Step 3: Implement explicit room-graph rules**

Create the complete type contract:

```ts
// DungeonTypes.ts
export type DungeonRoomKind = 'entry' | 'combat' | 'treasure' | 'alchemy' | 'elite' | 'boss' | 'extraction'
export type DungeonRunPhase = 'exploring' | 'extracted' | 'defeated'

export interface RunLoot { itemId: string; amount: number }
export interface DungeonExit { to: string; cost: number }
export interface DungeonRoom {
  id: string
  floor: number
  kind: DungeonRoomKind
  exits: DungeonExit[]
  loot?: RunLoot[]
}
export interface DungeonProfile {
  id: string
  entryRoomId: string
  extractionRoomId: string
  rooms: DungeonRoom[]
}
export interface DungeonRun {
  id: string
  profile: DungeonProfile
  phase: DungeonRunPhase
  currentRoomId: string
  doorCurrency: number
  searchedRoomIds: string[]
  carriedLoot: RunLoot[]
}
```

Create the session constructor, graph validation and transitions:

```ts
// DungeonSession.ts
import type { DungeonProfile, DungeonRoom, DungeonRun } from './DungeonTypes.ts'

function roomById(profile: DungeonProfile, id: string): DungeonRoom {
  const room = profile.rooms.find((candidate) => candidate.id === id)
  if (!room) throw new Error(`Unknown dungeon room: ${id}`)
  return room
}

export function validateDungeonProfile(profile: DungeonProfile): void {
  const ids = new Set(profile.rooms.map((room) => room.id))
  if (ids.size !== profile.rooms.length) throw new Error('Dungeon room IDs must be unique.')
  if (!ids.has(profile.entryRoomId)) throw new Error('Dungeon entry room is missing.')
  if (!ids.has(profile.extractionRoomId)) throw new Error('Dungeon extraction room is missing.')
  for (const room of profile.rooms) {
    for (const exit of room.exits) {
      if (!ids.has(exit.to)) throw new Error(`Broken dungeon exit: ${room.id} -> ${exit.to}`)
      if (!Number.isFinite(exit.cost) || exit.cost < 0) throw new Error(`Invalid door cost in ${room.id}.`)
    }
  }
}

export function createDungeonSession(profile: DungeonProfile, seed: number): DungeonRun {
  validateDungeonProfile(profile)
  return {
    id: `${profile.id}-${seed}`,
    profile: structuredClone(profile),
    phase: 'exploring',
    currentRoomId: profile.entryRoomId,
    doorCurrency: 0,
    searchedRoomIds: [],
    carriedLoot: [],
  }
}

export function enterRoom(run: DungeonRun, targetId: string) {
  if (run.phase !== 'exploring') return { ok: false, reason: 'inactive' as const }
  const current = roomById(run.profile, run.currentRoomId)
  const exit = current.exits.find((candidate) => candidate.to === targetId)
  if (!exit) return { ok: false, reason: 'not-connected' as const }
  if (run.doorCurrency < exit.cost) return { ok: false, reason: 'door-cost' as const }
  run.doorCurrency -= exit.cost
  run.currentRoomId = targetId
  return { ok: true as const }
}

export function searchRoom(run: DungeonRun) {
  const room = roomById(run.profile, run.currentRoomId)
  if (run.searchedRoomIds.includes(room.id)) return { loot: [] }
  run.searchedRoomIds.push(room.id)
  const loot = (room.loot ?? []).map((item) => ({ ...item }))
  run.carriedLoot.push(...loot)
  return { loot }
}

export function extractRun(run: DungeonRun) {
  if (run.currentRoomId !== run.profile.extractionRoomId || run.phase !== 'exploring') {
    return { ok: false as const, loot: [] }
  }
  run.phase = 'extracted'
  return { ok: true as const, loot: run.carriedLoot.map((item) => ({ ...item })) }
}
```

Create `dual-mode-slice.json` with three floors and at least `f1-entry`, `f1-store`, `f2-alchemy`, `f2-elite`, `f3-boss`, and `f3-gate`. All exits must reference an existing room and the extraction room must be reachable.

- [ ] **Step 4: Run tests**

Run: `cd cocos-client && node --test tests/dungeonSession.test.mjs`

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add cocos-client/assets/Scripts/Core/Dungeon cocos-client/assets/resources/Data/dual-mode-slice.json cocos-client/tests/dungeonSession.test.mjs
git commit -m "feat: add deterministic dungeon room session"
```

### Task 5: Apply Extraction Loot to the Save

**Files:**
- Modify: `cocos-client/assets/Scripts/Core/Progression/PlayerSave.ts`
- Create: `cocos-client/tests/dualModeFlow.test.mjs`

- [ ] **Step 1: Write the failing end-to-end reducer test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createDefaultSave, applyExtractionLoot, consumeDungeonPass } from '../assets/Scripts/Core/Progression/PlayerSave.ts'
import { applyWorldBossClear } from '../assets/Scripts/Core/World/WorldRewards.ts'

test('world clear, dungeon entry and extraction produce one persisted artifact', () => {
  const initial = createDefaultSave()
  const world = applyWorldBossClear(initial, { stage: 1, rewardId: 'stage-1-run-1' }).save
  assert.equal(world.inventory.dungeonPasses, 1)
  const entry = consumeDungeonPass(world)
  assert.equal(entry.ok, true)
  assert.equal(entry.save.inventory.dungeonPasses, 0)
  const extracted = applyExtractionLoot(entry.save, 'mist-vault-run-1', [
    { itemId: 'flying-sword', amount: 1 },
    { itemId: 'mist-herb', amount: 3 },
  ])
  assert.equal(extracted.inventory.artifacts['flying-sword'], 1)
  assert.equal(extracted.inventory.materials['mist-herb'], 3)
  assert.equal(applyExtractionLoot(extracted, 'mist-vault-run-1', [
    { itemId: 'flying-sword', amount: 1 },
  ]).inventory.artifacts['flying-sword'], 1)
})

test('dungeon pass consumption rejects zero without mutating the save', () => {
  const initial = createDefaultSave()
  const result = consumeDungeonPass(initial)
  assert.equal(result.ok, false)
  assert.equal(result.save.inventory.dungeonPasses, 0)
  assert.equal(initial.inventory.dungeonPasses, 0)
})
```

- [ ] **Step 2: Run and verify failure**

Run: `cd cocos-client && node --test tests/dualModeFlow.test.mjs`

Expected: FAIL because `applyExtractionLoot` is not exported.

- [ ] **Step 3: Implement idempotent loot classification**

```ts
import type { RunLoot } from '../Dungeon/DungeonTypes.ts'

export function consumeDungeonPass(current: PlayerSaveV3) {
  const save = structuredClone(current)
  if (save.inventory.dungeonPasses <= 0) return { ok: false as const, save }
  save.inventory.dungeonPasses -= 1
  return { ok: true as const, save }
}

export function applyExtractionLoot(current: PlayerSaveV3, rewardId: string, loot: RunLoot[]): PlayerSaveV3 {
  const save = structuredClone(current)
  if (save.rewardLedger.includes(rewardId)) return save
  save.rewardLedger.push(rewardId)
  for (const item of loot) {
    if (item.itemId === 'flying-sword') {
      save.inventory.artifacts['flying-sword'] = (save.inventory.artifacts['flying-sword'] ?? 0) + item.amount
    } else {
      save.inventory.materials[item.itemId] = (save.inventory.materials[item.itemId] ?? 0) + item.amount
    }
  }
  return save
}
```

- [ ] **Step 4: Run the pure-core suite**

Run: `cd cocos-client && node --test tests/loadoutRules.test.mjs tests/playerSave.test.mjs tests/worldRewards.test.mjs tests/dungeonSession.test.mjs tests/dualModeFlow.test.mjs`

Expected: all focused tests PASS.

- [ ] **Step 5: Commit**

```bash
git add cocos-client/assets/Scripts/Core/Progression/PlayerSave.ts cocos-client/tests/dualModeFlow.test.mjs
git commit -m "feat: persist extracted dungeon loot"
```

### Task 6: Remove Forced World Settlement Closure on the Live Path

**Files:**
- Modify: `cocos-client/assets/Scripts/Game/StageClearPanelController.ts`
- Modify: `cocos-client/tests/playableBattle.test.mjs`

- [ ] **Step 1: Replace the old auto-continue source contract with a failing explicit-continue contract**

```js
test('stage clear panel waits for an explicit continue action', () => {
  const source = read('assets/Scripts/Game/StageClearPanelController.ts')
  assert.doesNotMatch(source, /autoContinueSeconds/)
  assert.doesNotMatch(source, /scheduleOnce\(this\.handleAutoContinue/)
  assert.match(source, /private handleContinue\(\)/)
  assert.match(source, /this\.onContinue\?\.\(this\.result\.nextStageId\)/)
})
```

- [ ] **Step 2: Run and verify the current live auto-continue failure**

Run: `cd cocos-client && node --test tests/playableBattle.test.mjs`

Expected: FAIL because `StageClearPanelController` still declares `autoContinueSeconds = 3` and schedules `handleAutoContinue`.

- [ ] **Step 3: Remove the scheduler while preserving the explicit button path**

Delete `autoContinueSeconds`, `scheduleAutoContinue`, `handleAutoContinue`, and every `schedule`/`unschedule` call related to them. `showResult` ends after enabling the button:

```ts
if (this.nextStageLabel) this.nextStageLabel.string = `前往第${result.nextStageId}关`
if (this.nextStageButton) this.nextStageButton.interactable = true
```

`handleContinue` remains the only clear-mode transition and calls `onContinue` once after disabling the button.

- [ ] **Step 4: Run panel and active battle tests**

Run: `cd cocos-client && node --test tests/playableBattle.test.mjs tests/battleRuntime.test.mjs tests/sceneAssembly.test.mjs`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add cocos-client/assets/Scripts/Game/StageClearPanelController.ts cocos-client/tests/playableBattle.test.mjs
git commit -m "fix: keep battle settlement open for review"
```

### Task 7: Replace the Dungeon Floor Counter with a Core Session Adapter

**Files:**
- Modify: `cocos-client/assets/Scripts/Game/DungeonRunController.ts`
- Create: `cocos-client/assets/Scripts/Game/DualModeGameController.ts`
- Modify: `cocos-client/assets/Scripts/Game/BattleRuntimeController.ts`
- Modify: `cocos-client/assets/Scripts/Game/PortraitBattleBootstrap.ts`
- Modify: `cocos-client/tests/cocosStructure.test.mjs`

- [ ] **Step 1: Add failing source-contract assertions**

```js
test('dual-mode Cocos controllers delegate rules to Core', () => {
  const dungeon = readSource('assets/Scripts/Game/DungeonRunController.ts')
  const dualMode = readSource('assets/Scripts/Game/DualModeGameController.ts')
  const world = readSource('assets/Scripts/Game/BattleRuntimeController.ts')
  assert.match(dungeon, /Core\/Dungeon\/DungeonSession/)
  assert.match(dualMode, /Core\/Progression\/PlayerSave/)
  assert.match(world, /world-stage-cleared/)
  assert.doesNotMatch(dungeon, /resolveDungeonFloor/)
  assert.doesNotMatch(dualMode, /\.\.\/Combat\//)
})
```

- [ ] **Step 2: Run and verify failure**

Run: `cd cocos-client && node --test tests/cocosStructure.test.mjs`

Expected: FAIL because `DualModeGameController.ts` is absent and `DungeonRunController` still uses `resolveDungeonFloor`.

- [ ] **Step 3: Implement the Cocos adapters**

`DungeonRunController` must hold a `DungeonRun`, translate UI actions to `enterRoom`, `searchRoom`, and `extractRun`, and emit these events without calculating rewards:

```ts
import { _decorator, Component, JsonAsset, Label } from 'cc'
import { createDungeonSession, enterRoom, extractRun, searchRoom } from '../Core/Dungeon/DungeonSession.ts'
import type { DungeonProfile, DungeonRun } from '../Core/Dungeon/DungeonTypes.ts'

const { ccclass, property } = _decorator

@ccclass('DungeonRunController')
export class DungeonRunController extends Component {
  @property(JsonAsset) profileData: JsonAsset | null = null
  @property(Label) roomLabel: Label | null = null
  private run: DungeonRun | null = null

  begin(seed: number) {
    if (!this.profileData) return false
    this.run = createDungeonSession(this.profileData.json as DungeonProfile, seed)
    this.refreshRoomLabel()
    return true
  }

  grantDoorCurrency(amount: number) {
    if (!this.run || !Number.isFinite(amount) || amount <= 0) return
    this.run.doorCurrency += Math.floor(amount)
  }

  moveTo(roomId: string) {
    if (!this.run) return false
    const result = enterRoom(this.run, roomId)
    if (!result.ok) return false
    this.refreshRoomLabel()
    this.node.emit('dungeon-room-changed', { roomId: this.run.currentRoomId })
    return true
  }

  searchCurrentRoom() {
    if (!this.run) return []
    const result = searchRoom(this.run)
    if (result.loot.length > 0) this.node.emit('dungeon-loot-found', result.loot)
    return result.loot
  }

  extract() {
    if (!this.run) return false
    const result = extractRun(this.run)
    if (!result.ok) return false
    this.node.emit('dungeon-extracted', { runId: this.run.id, loot: result.loot })
    return true
  }

  private refreshRoomLabel() {
    if (this.roomLabel && this.run) this.roomLabel.string = this.run.currentRoomId
  }
}
```

After `claimStageClearRuntime` succeeds, `BattleRuntimeController` emits the live event exactly once:

```ts
if (result?.ok && result.result) {
  this.stageClearPanel?.showResult(result.result)
  this.node.emit('world-stage-cleared', {
    stage: this.stageNumber,
    rewardId: `world-${this.stageNumber}-generation-${this.stageGeneration}`,
  })
}
```

`DualModeGameController` owns the current `PlayerSaveV3`, handles that event through `applyWorldBossClear`, consumes one pass before dungeon entry, handles `dungeon-extracted` through `applyExtractionLoot`, and saves after each accepted transition:

```ts
import { _decorator, Component, Node, sys } from 'cc'
import { applyExtractionLoot, consumeDungeonPass, createDefaultSave } from '../Core/Progression/PlayerSave.ts'
import type { PlayerSaveV3 } from '../Core/Progression/PlayerSave.ts'
import { createJsonSaveRepository } from '../Core/Progression/SaveRepository.ts'
import type { SaveRepository } from '../Core/Progression/SaveRepository.ts'
import { applyWorldBossClear } from '../Core/World/WorldRewards.ts'
import type { RunLoot } from '../Core/Dungeon/DungeonTypes.ts'

const { ccclass, property } = _decorator

@ccclass('DualModeGameController')
export class DualModeGameController extends Component {
  @property(Node) worldRoot: Node | null = null
  @property(Node) dungeonRoot: Node | null = null
  private save: PlayerSaveV3 = createDefaultSave()
  private repository: SaveRepository | null = null

  onLoad() {
    this.repository = createJsonSaveRepository(sys.localStorage, 'cultivation-save-v3')
    this.save = this.repository.load() ?? createDefaultSave()
  }

  handleWorldCleared(payload: { stage: number; rewardId: string }) {
    this.save = applyWorldBossClear(this.save, payload).save
    this.repository?.save(this.save)
    this.node.emit('player-save-changed', this.save)
  }

  enterDungeon() {
    const result = consumeDungeonPass(this.save)
    if (!result.ok) {
      this.node.emit('dungeon-entry-rejected', { reason: 'missing-pass' })
      return false
    }
    this.save = result.save
    this.repository?.save(this.save)
    if (this.worldRoot) this.worldRoot.active = false
    if (this.dungeonRoot) this.dungeonRoot.active = true
    this.node.emit('dungeon-entry-accepted')
    return true
  }

  handleDungeonExtracted(payload: { runId: string; loot: RunLoot[] }) {
    this.save = applyExtractionLoot(this.save, payload.runId, payload.loot)
    this.repository?.save(this.save)
    if (this.dungeonRoot) this.dungeonRoot.active = false
    if (this.worldRoot) this.worldRoot.active = true
    this.node.emit('player-save-changed', this.save)
  }
}
```

`PortraitBattleBootstrap` only wires scene nodes and events:

```ts
runtimeNode.on('world-stage-cleared', this.dualMode.handleWorldCleared, this.dualMode)
this.node.on('dungeon-extracted', this.dualMode.handleDungeonExtracted, this.dualMode)
```

- [ ] **Step 4: Run structure and full unit tests**

Run: `cd cocos-client && npm test`

Expected: all tests PASS; no new Game file imports `../Combat`.

- [ ] **Step 5: Commit**

```bash
git add cocos-client/assets/Scripts/Game/DungeonRunController.ts cocos-client/assets/Scripts/Game/DualModeGameController.ts cocos-client/assets/Scripts/Game/BattleRuntimeController.ts cocos-client/assets/Scripts/Game/PortraitBattleBootstrap.ts cocos-client/tests/cocosStructure.test.mjs
git commit -m "feat: connect world and dungeon sessions"
```

### Task 8: Assemble the Graybox Scene and Verify the Complete Loop

**Files:**
- Modify: `cocos-client/assets/Scenes/MainBattle.scene`
- Modify: `cocos-client/assets/Data/scene-blueprint.json`
- Modify: `cocos-client/tests/sceneAssembly.test.mjs`
- Modify: `cocos-client/tests/grayboxBattle.test.mjs`
- Modify: `cocos-client/tools/check-cocos-build-readiness.mjs`

- [ ] **Step 1: Add failing scene-contract tests**

Require the scene and blueprint to expose these stable nodes:

```js
for (const name of [
  'DualModeGameController', 'DungeonRoot', 'DungeonFloor1',
  'DungeonFloor2', 'DungeonFloor3', 'DungeonRoomLabel', 'DungeonInteractButton',
]) {
  assert.match(sceneText, new RegExp(`"_name": "${name}"`))
}
```

Also assert that `DungeonRoot` starts inactive and that the world root remains active.

- [ ] **Step 2: Run and verify failure**

Run: `cd cocos-client && node --test tests/sceneAssembly.test.mjs tests/grayboxBattle.test.mjs`

Expected: FAIL on the first missing dual-mode node.

- [ ] **Step 3: Assemble the three-floor graybox**

Use Cocos nodes, not DOM overlays. Each floor must include a background band, two room anchors, one door anchor and a floor label. Bind `DungeonRunController`, `DualModeGameController`, the JSON profile, the interact button and status label. Preserve the existing world battle nodes and switch roots through active state instead of reloading the page.

Update `scene-blueprint.json` with the same stable node names and component bindings. Add required scripts and `dual-mode-slice.json` to the build-readiness manifest.

- [ ] **Step 4: Run all verification commands**

Run:

```bash
cd cocos-client
npm test
npm run build:check
npm run check:douyin
```

Expected:

- Node test suite: PASS with no failures.
- Build readiness: PASS with all scripts, scene nodes and data files present.
- Douyin readiness: PASS or only report a pre-existing external Creator-build artifact requirement; no source/config failures.

- [ ] **Step 5: Run the local mobile smoke test**

Build or preview the Cocos Web Mobile output, then verify `390 x 844`:

1. Clear world stage one.
2. Observe one dungeon pass in the save/HUD.
3. Enter the dungeon without a page reload.
4. Move through all three floor roots.
5. Search the treasure room and obtain `flying-sword`.
6. Reach the extraction room and extract.
7. Reload and confirm the artifact remains in the save.
8. Confirm there is no three-second forced settlement close, canvas stretching or controller error.

- [ ] **Step 6: Commit**

```bash
git add cocos-client/assets/Scenes/MainBattle.scene cocos-client/assets/Data/scene-blueprint.json cocos-client/tests/sceneAssembly.test.mjs cocos-client/tests/grayboxBattle.test.mjs cocos-client/tools/check-cocos-build-readiness.mjs
git commit -m "feat: deliver dual-mode graybox loop"
```

## M1 Completion Gate

M1 is complete only when:

- `assets/Scripts/Core` owns every new rule introduced by this milestone.
- World Boss clear grants one dungeon pass exactly once per reward ID.
- Dungeon entry consumes one pass and rejects entry at zero.
- The three-floor room graph is traversable and has no broken exit references.
- Search loot is obtained once per room.
- Only successful extraction persists carried loot.
- Reload preserves the extracted artifact.
- Settlement remains open until explicit continuation.
- `npm test`, `npm run build:check`, mobile viewport smoke test and console inspection pass.
- The worktree is clean after the final commit.
