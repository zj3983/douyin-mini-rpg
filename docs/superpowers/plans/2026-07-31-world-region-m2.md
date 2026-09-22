# World Region M2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing eight-stage world prototype into one authored ten-stage region with explicit unlock rules, two elite encounters, a regional Boss, stage selection, and ten distinct continuously scrolling battle backgrounds.

**Architecture:** Pure rules live under `assets/Scripts/Core/World`; JSON remains the authored content source, while Cocos controllers only render selection state and forward accepted stage choices to `BattleRuntimeController`. Stage progression never wraps with modulo arithmetic: the save determines the highest selectable stage, stage ten is the region cap, and only a cleared Boss unlocks the next stage.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, JSON content catalogs, Node.js built-in test runner, Cocos Web Mobile.

---

## File Map

- Create `cocos-client/assets/Scripts/Core/World/WorldRegion.ts`: ten-stage region types, validation, lookup, unlock and selection rules.
- Create `cocos-client/assets/Scripts/Core/World/WorldRegion.ts.meta`: Cocos script metadata.
- Modify `cocos-client/assets/Scripts/Core/CultivationTypes.ts`: add explicit encounter classification to stage profiles.
- Modify `cocos-client/assets/Scripts/Core/CultivationRuntime.ts`: resolve exact authored stages without modulo wrapping.
- Modify `cocos-client/assets/resources/Data/cultivation-design.json`: author stages nine and ten and classify all encounters.
- Modify `cocos-client/assets/Scripts/Core/StageVisualCatalog.ts`: add stage nine and ten visual/resource records.
- Create `cocos-client/assets/Scripts/Game/WorldStageSelectController.ts`: render ten stage buttons and emit accepted selections.
- Create `cocos-client/assets/Scripts/Game/WorldStageSelectController.ts.meta`: Cocos script metadata.
- Modify `cocos-client/assets/Scripts/Game/DualModeGameController.ts`: expose save-derived world selection state.
- Modify `cocos-client/assets/Scripts/Game/PortraitBattleBootstrap.ts`: assemble and wire the Cocos stage-selection overlay.
- Modify `cocos-client/assets/Data/scene-blueprint.json`: declare stable stage-selection nodes.
- Add two stage-nine/ten background image pairs under `cocos-client/assets/resources/Assets/World/` with matching `.meta` files.
- Add focused tests under `cocos-client/tests/` and update build/readiness contracts.

### Task 1: Define the Ten-Stage Region Contract

**Files:**
- Create: `cocos-client/assets/Scripts/Core/World/WorldRegion.ts`
- Create: `cocos-client/tests/worldRegion.test.mjs`

- [ ] **Step 1: Write the failing world-region tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createWorldRegion,
  highestSelectableStage,
  selectWorldStage,
} from '../assets/Scripts/Core/World/WorldRegion.ts'

const stages = Array.from({ length: 10 }, (_, index) => ({
  id: index + 1,
  encounter: index + 1 === 10 ? 'region-boss' : [4, 7].includes(index + 1) ? 'elite' : 'normal',
}))

test('the first region has ten ordered stages, two elites, and one regional Boss', () => {
  const region = createWorldRegion('mist-frontier', stages)
  assert.equal(region.stages.length, 10)
  assert.deepEqual(region.stages.filter((stage) => stage.encounter === 'elite').map((stage) => stage.id), [4, 7])
  assert.deepEqual(region.stages.filter((stage) => stage.encounter === 'region-boss').map((stage) => stage.id), [10])
})

test('selection allows cleared stages plus only the next uncleared stage', () => {
  const region = createWorldRegion('mist-frontier', stages)
  assert.equal(highestSelectableStage(0, region), 1)
  assert.equal(highestSelectableStage(4, region), 5)
  assert.equal(highestSelectableStage(10, region), 10)
  assert.deepEqual(selectWorldStage(region, 4, 5), { ok: true, stageId: 5 })
  assert.deepEqual(selectWorldStage(region, 4, 6), { ok: false, reason: 'locked-stage' })
  assert.deepEqual(selectWorldStage(region, 10, 11), { ok: false, reason: 'unknown-stage' })
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd cocos-client && node --test tests/worldRegion.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `WorldRegion.ts`.

- [ ] **Step 3: Implement the minimal immutable region rules**

```ts
export type WorldEncounterKind = 'normal' | 'elite' | 'region-boss'

export interface WorldRegionStage {
  readonly id: number
  readonly encounter: WorldEncounterKind
}

export interface WorldRegion {
  readonly id: string
  readonly stages: readonly WorldRegionStage[]
}

export function createWorldRegion(id: string, stages: readonly WorldRegionStage[]): WorldRegion {
  const safeId = id.trim()
  if (!safeId) throw new Error('World region ID is required.')
  if (stages.length !== 10) throw new Error('A world region must contain exactly ten stages.')
  const copy = stages.map((stage, index) => {
    if (stage.id !== index + 1) throw new Error('World region stages must be ordered from one to ten.')
    return Object.freeze({ id: stage.id, encounter: stage.encounter })
  })
  if (copy.filter((stage) => stage.encounter === 'elite').length !== 2) {
    throw new Error('A world region must contain exactly two elite encounters.')
  }
  if (copy.filter((stage) => stage.encounter === 'region-boss').map((stage) => stage.id).join(',') !== '10') {
    throw new Error('Stage ten must be the only regional Boss encounter.')
  }
  return Object.freeze({ id: safeId, stages: Object.freeze(copy) })
}

export function highestSelectableStage(highestClearedStage: number, region: WorldRegion): number {
  const cleared = Math.max(0, Math.floor(Number.isFinite(highestClearedStage) ? highestClearedStage : 0))
  return Math.min(region.stages.length, cleared + 1)
}

export function selectWorldStage(region: WorldRegion, highestClearedStage: number, requestedStage: number) {
  const stageId = Math.floor(requestedStage)
  if (!region.stages.some((stage) => stage.id === stageId)) return { ok: false as const, reason: 'unknown-stage' as const }
  if (stageId > highestSelectableStage(highestClearedStage, region)) {
    return { ok: false as const, reason: 'locked-stage' as const }
  }
  return { ok: true as const, stageId }
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `cd cocos-client && node --test tests/worldRegion.test.mjs`

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add cocos-client/assets/Scripts/Core/World/WorldRegion.ts cocos-client/tests/worldRegion.test.mjs
git commit -m "feat: define ten-stage world region rules"
```

### Task 2: Author Exact Stage Content Without Wrapping

**Files:**
- Modify: `cocos-client/assets/Scripts/Core/CultivationTypes.ts`
- Modify: `cocos-client/assets/Scripts/Core/CultivationRuntime.ts`
- Modify: `cocos-client/assets/resources/Data/cultivation-design.json`
- Create: `cocos-client/tests/worldStageCatalog.test.mjs`

- [ ] **Step 1: Write failing catalog and lookup tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { stageProfileFromDesign } from '../assets/Scripts/Core/CultivationRuntime.ts'

const design = JSON.parse(fs.readFileSync(new URL('../assets/resources/Data/cultivation-design.json', import.meta.url)))

test('the authored world catalog contains ten unique stages and expected encounter cadence', () => {
  assert.deepEqual(design.worldStages.map((stage) => stage.id), [1,2,3,4,5,6,7,8,9,10])
  assert.deepEqual(design.worldStages.filter((stage) => stage.encounter === 'elite').map((stage) => stage.id), [4,7])
  assert.deepEqual(design.worldStages.filter((stage) => stage.encounter === 'region-boss').map((stage) => stage.id), [10])
  assert.equal(new Set(design.worldStages.map((stage) => stage.background)).size, 10)
})

test('stage lookup resolves exact IDs and rejects stages outside the region', () => {
  assert.equal(stageProfileFromDesign(design, 10).id, 10)
  assert.throws(() => stageProfileFromDesign(design, 11), /Unknown world stage: 11/)
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd cocos-client && node --test tests/worldStageCatalog.test.mjs`

Expected: FAIL because only eight stages exist and stage eleven wraps.

- [ ] **Step 3: Add encounter typing and exact lookup**

Add to `StageProfile`:

```ts
import type { WorldEncounterKind } from './World/WorldRegion'

export interface StageProfile {
  id: number
  name: string
  theme: string
  background: string
  encounter: WorldEncounterKind
  enemies: EnemyProfile[]
  boss: EnemyProfile
}
```

Replace modulo lookup in `stageProfileFromDesign`:

```ts
const safeStage = Math.max(1, Math.floor(stageNumber || 1))
const stage = design.worldStages.find((candidate) => candidate.id === safeStage)
if (!stage) throw new Error(`Unknown world stage: ${safeStage}`)
```

Classify stages 4 and 7 as `elite`, stage 10 as `region-boss`, and all others as `normal`. Add stage 9 `玄泉石林` and stage 10 `雾海天阙`; each receives its own background ID, ordinary roster, and Boss record.

- [ ] **Step 4: Run catalog and battle tests**

Run: `cd cocos-client && node --test tests/worldStageCatalog.test.mjs tests/battleRuntime.test.mjs`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add cocos-client/assets/Scripts/Core/CultivationTypes.ts cocos-client/assets/Scripts/Core/CultivationRuntime.ts cocos-client/assets/resources/Data/cultivation-design.json cocos-client/tests/worldStageCatalog.test.mjs
git commit -m "feat: author complete first world region"
```

### Task 3: Add Stage Nine and Ten Visual Resource Plans

**Files:**
- Modify: `cocos-client/assets/Scripts/Core/StageVisualCatalog.ts`
- Add: `cocos-client/assets/resources/Assets/World/MysticSpring/far.png`
- Add: `cocos-client/assets/resources/Assets/World/MysticSpring/mid.png`
- Add: `cocos-client/assets/resources/Assets/World/MistHeaven/far.png`
- Add: `cocos-client/assets/resources/Assets/World/MistHeaven/mid.png`
- Modify: `cocos-client/tests/stageVisuals.test.mjs`
- Modify: `cocos-client/tests/stageResourceRuntime.test.mjs`

- [ ] **Step 1: Extend visual tests to require ten distinct stages**

```js
test('stages one through ten resolve distinct background resources', () => {
  const visuals = Array.from({ length: 10 }, (_, index) => stageVisualFor(index + 1))
  assert.equal(new Set(visuals.map((visual) => visual.farPath)).size, 10)
  assert.equal(visuals.every((visual) => visual.stageId >= 1 && visual.stageId <= 10), true)
})
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `cd cocos-client && node --test tests/stageVisuals.test.mjs tests/stageResourceRuntime.test.mjs`

Expected: FAIL on `Unknown stage visual: 9`.

- [ ] **Step 3: Produce and import four background layers**

Generate two 9:16 Chinese cultivation landscapes with no text, circles, UI, fake trees, or embedded landmarks. Split each into a stable far layer and a transparent mid mist/foliage layer. Keep visual anchors near the upper and lower thirds so Cocos `Sprite.SizeMode.CUSTOM` may crop safely across 360x780, 390x844, and 430x932.

- [ ] **Step 4: Add stage visual records**

```ts
9: Object.freeze({
  stageId: 9,
  backgroundId: 'mystic-spring-stone-forest',
  theme: 'mist-bamboo',
  farPath: 'Assets/World/MysticSpring/far/spriteFrame',
  midPath: 'Assets/World/MysticSpring/mid/spriteFrame',
  monsterActorIds: Object.freeze(['moss-wolf', 'green-wing-moth', 'mist-deer-king']),
}),
10: Object.freeze({
  stageId: 10,
  backgroundId: 'mist-sea-heaven-palace',
  theme: 'cloud-gate',
  farPath: 'Assets/World/MistHeaven/far/spriteFrame',
  midPath: 'Assets/World/MistHeaven/mid/spriteFrame',
  monsterActorIds: Object.freeze(['star-armored-beast', 'void-wing-spirit', 'meteor-guardian']),
}),
```

- [ ] **Step 5: Run visual/resource tests and commit**

Run: `cd cocos-client && node --test tests/stageVisuals.test.mjs tests/stageResourceRuntime.test.mjs`

Expected: all tests PASS.

```bash
git add cocos-client/assets/Scripts/Core/StageVisualCatalog.ts cocos-client/assets/resources/Assets/World cocos-client/tests/stageVisuals.test.mjs cocos-client/tests/stageResourceRuntime.test.mjs
git commit -m "feat: add final world region backgrounds"
```

### Task 4: Build Save-Derived Stage Selection

**Files:**
- Create: `cocos-client/assets/Scripts/Game/WorldStageSelectController.ts`
- Modify: `cocos-client/assets/Scripts/Game/DualModeGameController.ts`
- Create: `cocos-client/tests/worldStageSelection.test.mjs`

- [ ] **Step 1: Write source-contract and pure-rule selection tests**

```js
test('world selection is derived from the save and forwards only accepted stage IDs', () => {
  const selection = read('assets/Scripts/Game/WorldStageSelectController.ts')
  const dualMode = read('assets/Scripts/Game/DualModeGameController.ts')
  assert.match(selection, /selectWorldStage/)
  assert.match(selection, /world-stage-selected/)
  assert.match(dualMode, /highestClearedStage/)
  assert.doesNotMatch(selection, /localStorage|rewardLedger|highestClearedStage\s*=/)
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd cocos-client && node --test tests/worldStageSelection.test.mjs`

Expected: FAIL because `WorldStageSelectController.ts` does not exist.

- [ ] **Step 3: Implement a presentation-only selector**

`WorldStageSelectController` receives the immutable region and `highestClearedStage`, updates ten button states, and emits `world-stage-selected` only when `selectWorldStage` returns `{ ok: true }`. Locked selection emits `world-stage-selection-rejected` with `locked-stage`; it never edits the save:

```ts
import { _decorator, Button, Component, Label, Node } from 'cc'
import { createWorldRegion, selectWorldStage, type WorldRegion } from '../Core/World/WorldRegion'

const { ccclass } = _decorator

@ccclass('WorldStageSelectController')
export class WorldStageSelectController extends Component {
  private region: WorldRegion | null = null
  private highestClearedStage = 0
  private buttons: Button[] = []
  private labels: Label[] = []

  bind(stages: WorldRegion['stages'], highestClearedStage: number, buttons: Button[], labels: Label[]) {
    this.region = createWorldRegion('mist-frontier', stages)
    this.highestClearedStage = Math.max(0, Math.floor(highestClearedStage))
    this.buttons = buttons.slice(0, 10)
    this.labels = labels.slice(0, 10)
    this.refresh()
  }

  select(stageId: number) {
    if (!this.region) return false
    const result = selectWorldStage(this.region, this.highestClearedStage, stageId)
    if (!result.ok) {
      this.node.emit('world-stage-selection-rejected', { stageId, reason: result.reason })
      return false
    }
    this.node.emit('world-stage-selected', { stageId: result.stageId })
    return true
  }

  private refresh() {
    if (!this.region) return
    for (let index = 0; index < this.region.stages.length; index += 1) {
      const stage = this.region.stages[index]
      const accepted = selectWorldStage(this.region, this.highestClearedStage, stage.id).ok
      if (this.buttons[index]) this.buttons[index].interactable = accepted
      if (this.labels[index]) this.labels[index].string = `第${stage.id}关`
    }
  }
}
```

`DualModeGameController` adds:

```ts
getHighestClearedWorldStage(): number {
  return this.save.world.highestClearedStage
}
```

- [ ] **Step 4: Run focused tests and commit**

Run: `cd cocos-client && node --test tests/worldStageSelection.test.mjs tests/playerSave.test.mjs tests/worldRewards.test.mjs`

Expected: all tests PASS.

```bash
git add cocos-client/assets/Scripts/Game/WorldStageSelectController.ts cocos-client/assets/Scripts/Game/DualModeGameController.ts cocos-client/tests/worldStageSelection.test.mjs
git commit -m "feat: add save-driven world stage selection"
```

### Task 5: Assemble the Stage Selection Overlay

**Files:**
- Modify: `cocos-client/assets/Scripts/Game/PortraitBattleBootstrap.ts`
- Modify: `cocos-client/assets/Data/scene-blueprint.json`
- Modify: `cocos-client/tests/sceneAssembly.test.mjs`
- Modify: `cocos-client/tests/playableBattle.test.mjs`

- [ ] **Step 1: Add failing stable-node and wiring contracts**

```js
for (const name of ['WorldStageSelectRoot', 'WorldStageGrid', 'WorldStageCloseButton']) {
  assert.match(sceneText, new RegExp(`"_name": "${name}"`))
}
assert.match(bootstrap, /world-stage-selected/)
assert.match(bootstrap, /advanceToStage/)
```

- [ ] **Step 2: Run tests and verify RED**

Run: `cd cocos-client && node --test tests/sceneAssembly.test.mjs tests/playableBattle.test.mjs`

Expected: FAIL on the first missing stable stage-selection node.

- [ ] **Step 3: Assemble the mobile overlay**

Create a full-width, non-card page layer above the bottom navigation. Use a two-column stage grid with fixed-height rows, stage number, stage name, encounter badge, and lock state. Stage ten receives a Boss badge; stages four and seven receive elite badges. No stage node or title overlays the active battle background.

Wire `world-stage-selected` to `BattleRuntimeController.advanceToStage(stageId)`, close the overlay only after an accepted transition, and leave it open with a short locked-state feedback after rejection:

```ts
private bindWorldStageSelection() {
  const selector = this.worldStageSelectRoot?.getComponent(WorldStageSelectController)
  if (!selector || !this.battleRuntimeController || !this.dualModeGameController) return
  selector.node.on('world-stage-selected', this.handleWorldStageSelected, this)
  selector.bind(
    this.worldRegion.stages,
    this.dualModeGameController.getHighestClearedWorldStage(),
    this.worldStageButtons,
    this.worldStageLabels,
  )
}

private handleWorldStageSelected(payload: { stageId: number }) {
  const result = this.battleRuntimeController?.advanceToStage(payload.stageId)
  if (!result?.ok) return
  if (this.worldStageSelectRoot) this.worldStageSelectRoot.active = false
}
```

- [ ] **Step 4: Run assembly and behavior tests and commit**

Run: `cd cocos-client && node --test tests/sceneAssembly.test.mjs tests/playableBattle.test.mjs tests/worldStageSelection.test.mjs`

Expected: all tests PASS.

```bash
git add cocos-client/assets/Scripts/Game/PortraitBattleBootstrap.ts cocos-client/assets/Data/scene-blueprint.json cocos-client/tests/sceneAssembly.test.mjs cocos-client/tests/playableBattle.test.mjs
git commit -m "feat: assemble world stage selection overlay"
```

### Task 6: Verify the Complete Region Loop

**Files:**
- Modify: `cocos-client/tools/check-cocos-build-readiness.mjs`
- Modify: `cocos-client/tests/cocosStructure.test.mjs`

- [ ] **Step 1: Require new scripts, data and stage assets in readiness checks**

Add `WorldRegion.ts`, `WorldStageSelectController.ts`, stages nine and ten, and all four background layers to the existing readiness manifest. Assert that no new Game file imports legacy `../Combat` rules.

- [ ] **Step 2: Run the full automated gate**

```bash
cd cocos-client
npm test
npm run build:check
npm run check:douyin
```

Expected: all tests PASS, build readiness reports no blockers, and Douyin readiness reports no source/config failures.

- [ ] **Step 3: Build and run the mobile smoke test**

At 360x780, 390x844, and 430x932 verify:

1. A fresh save may enter stage one only.
2. Clearing a Boss unlocks exactly the next stage.
3. Stages four and seven visibly identify elite encounters.
4. Stage ten visibly identifies the regional Boss.
5. Every stage swaps to a distinct background without showing stage-map UI over combat.
6. Midground drift remains smooth and never exposes an empty seam.
7. Returning to a cleared stage does not lower progression or duplicate first-clear rewards.

- [ ] **Step 4: Commit verification contracts**

```bash
git add cocos-client/tools/check-cocos-build-readiness.mjs cocos-client/tests/cocosStructure.test.mjs
git commit -m "test: gate complete ten-stage world region"
```

## M2 Completion Gate

- The first world region contains exactly ten authored stages.
- Stages four and seven are elite encounters; stage ten is the only regional Boss.
- Stage lookup never wraps and locked stages cannot be entered.
- Save progression unlocks only one next stage at a time.
- All ten stages have distinct battle backgrounds and valid resource plans.
- Stage-map text and route UI never overlay active combat.
- Full tests, build readiness, Douyin readiness, and three mobile viewport smoke tests pass.
