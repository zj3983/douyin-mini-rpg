# Hybrid Character Animation Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing vertical-slice actor frames into a validated, event-aware, mobile-budgeted animation production pipeline and integrate approved Qinglan sword cultivator and moss wolf samples into the current Cocos runtime.

**Architecture:** Extend the checked-in source manifest and Python atlas builder instead of introducing a second asset system. Generation providers remain upstream and optional; deterministic local processing validates, normalizes, reports, packs, and exports action atlases. A small pure TypeScript event-timeline module feeds `AtlasAnimator`, which emits marker and completion events while preserving the current combat ownership model.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, Node.js built-in test runner, Python 3.11, Pillow, PNG action atlases, JSON manifests.

---

## File Structure

- Modify `assets/Data/vertical-slice-animation-sources.json`: versioned production source contract, source modes, event markers, and quality thresholds.
- Modify `tools/build-vertical-slice-atlases.py`: strict validation, frame metrics, contact sheets, reports, 2048 texture budget, candidate builds, and explicit promotion.
- Modify `tests/verticalSliceAtlasContract.test.mjs`: checked-in source contract expectations.
- Modify `tests/verticalSliceAtlasBuilder.test.mjs`: synthetic frame-quality, report, packing, and failure tests.
- Modify `assets/Scripts/Core/AnimationAtlas.ts`: optional action marker type.
- Create `assets/Scripts/Core/AnimationEventRuntime.ts`: pure marker-crossing and completion calculations.
- Create `tools/animation-event-runtime.mjs`: Node-test mirror of the pure runtime calculations.
- Create `tests/animationEventRuntime.test.mjs`: timing, frame skip, loop wrap, and completion tests.
- Modify `assets/Scripts/Game/AtlasAnimator.ts`: emit marker/completion events while retaining frame caching and stale-load protection.
- Modify `tests/playableBattle.test.mjs`: structural coverage for event emission and single completion.
- Modify `assets/Data/animation-atlas.json`: generated action metadata.
- Modify `assets/resources/Data/animation-atlas.json`: byte-identical runtime copy.
- Modify `assets/resources/Assets/ActorAtlases/QinglanSwordCultivator/*.png`: rebuilt approved action atlases.
- Modify `assets/resources/Assets/ActorAtlases/MossWolf/*.png`: rebuilt approved action atlases.
- Create `artifacts/animation-reports/qinglan-sword-cultivator.json`: per-action production metrics.
- Create `artifacts/animation-reports/qinglan-sword-cultivator-contact-sheet.png`: visual review sheet.
- Create `artifacts/animation-reports/moss-wolf.json`: per-action production metrics.
- Create `artifacts/animation-reports/moss-wolf-contact-sheet.png`: visual review sheet.

### Task 1: Lock The Source Production Contract

**Files:**
- Modify: `tests/verticalSliceAtlasContract.test.mjs`
- Modify: `assets/Data/vertical-slice-animation-sources.json`
- Modify: `tools/build-vertical-slice-atlases.py`

- [ ] **Step 1: Write the failing source-contract test**

Add assertions that every action declares a supported source mode, valid quality limits, and sorted normalized events:

```javascript
const sourceModes = new Set(['layered-keyframes', 'pose-video', 'frame-sequence'])

for (const [actorId, actor] of Object.entries(source.actors)) {
  assert.equal(typeof actor.quality?.maxCenterDrift, 'number', `${actorId} center drift`)
  assert.equal(typeof actor.quality?.maxScaleDrift, 'number', `${actorId} scale drift`)
  assert.equal(typeof actor.quality?.minAlphaCoverage, 'number', `${actorId} alpha coverage`)
  for (const [actionName, action] of Object.entries(actor.actions)) {
    assert.equal(sourceModes.has(action.sourceMode), true, `${actorId}/${actionName} source mode`)
    const times = (action.events ?? []).map(({ at }) => at)
    assert.deepEqual(times, [...times].sort((a, b) => a - b), `${actorId}/${actionName} sorted events`)
    assert.equal(times.every((at) => at > 0 && at < 1), true, `${actorId}/${actionName} event range`)
  }
}
```

- [ ] **Step 2: Run the contract test and verify the expected failure**

Run: `node --test tests/verticalSliceAtlasContract.test.mjs`

Expected: FAIL because `quality` and `sourceMode` are absent from version 1 source entries.

- [ ] **Step 3: Upgrade the source manifest to version 2**

Add actor-level quality defaults and action source modes. Use these initial event markers:

```json
{
  "version": 2,
  "quality": {
    "maxCenterDrift": 0.08,
    "maxScaleDrift": 0.12,
    "minAlphaCoverage": 0.02,
    "maxAlphaCoverage": 0.72,
    "safePadding": 0.08
  },
  "actions": {
    "hand_seal": {
      "sourceMode": "layered-keyframes",
      "events": [{ "name": "seal-formed", "at": 0.6 }]
    },
    "cast": {
      "sourceMode": "layered-keyframes",
      "events": [{ "name": "sword-release", "at": 0.42 }]
    }
  }
}
```

Use `layered-keyframes` for all Qinglan actions, `pose-video` for moss-wolf movement and attacks, and `frame-sequence` for existing hurt/death sources. Preserve existing frame counts, source paths, FPS, and loop flags.

- [ ] **Step 4: Add strict version-2 validation to the builder**

Implement helpers with these contracts:

```python
SOURCE_MODES = {"layered-keyframes", "pose-video", "frame-sequence"}

def _as_ratio(value, label, minimum=0.0, maximum=1.0):
    ratio = float(value)
    if not minimum <= ratio <= maximum:
        raise ValueError(f"{label} must be in [{minimum}, {maximum}]")
    return ratio

def _validate_events(events, label):
    previous = 0.0
    for event in events or []:
        name = event.get("name")
        at = _as_ratio(event.get("at"), f"{label}.{name}.at")
        if not isinstance(name, str) or not name.strip() or at <= previous or at >= 1:
            raise ValueError(f"{label} events must have names and strictly increasing times inside (0, 1)")
        previous = at
```

Require source version 2, five quality keys, supported source modes, frame counts from 1 to 16, FPS from 1 to 24, and valid events.

- [ ] **Step 5: Run the contract and builder checks**

Run: `node --test tests/verticalSliceAtlasContract.test.mjs tests/verticalSliceAtlasBuilder.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit the source contract**

```bash
git add assets/Data/vertical-slice-animation-sources.json tools/build-vertical-slice-atlases.py tests/verticalSliceAtlasContract.test.mjs tests/verticalSliceAtlasBuilder.test.mjs
git commit -m "feat: define actor animation source contract"
```

### Task 2: Measure Frame Quality And Produce Review Artifacts

**Files:**
- Modify: `tests/verticalSliceAtlasBuilder.test.mjs`
- Modify: `tools/build-vertical-slice-atlases.py`

- [ ] **Step 1: Write failing tests for metrics and rejection**

Add synthetic tests proving the processor reports visible bounds and rejects edge contact and excessive center drift:

```python
stable = [make_frame(x=80), make_frame(x=82), make_frame(x=79)]
metrics = builder.analyze_action(stable, {
    "maxCenterDrift": 0.08,
    "maxScaleDrift": 0.12,
    "minAlphaCoverage": 0.02,
    "maxAlphaCoverage": 0.72,
    "safePadding": 0.08,
})
assert metrics["frameCount"] == 3
assert metrics["centerDrift"] < 0.08

clipped = Image.new("RGBA", (256, 320), (0, 0, 0, 0))
ImageDraw.Draw(clipped).rectangle((0, 40, 130, 300), fill=(255, 255, 255, 255))
try:
    builder.analyze_action([clipped], quality)
except ValueError as error:
    assert "safe edge" in str(error)
else:
    raise AssertionError("edge-touching frame must fail")
```

- [ ] **Step 2: Run the builder tests and verify they fail**

Run: `node --test tests/verticalSliceAtlasBuilder.test.mjs`

Expected: FAIL because `analyze_action` does not exist.

- [ ] **Step 3: Implement deterministic frame metrics**

Add `frame_metrics`, `analyze_action`, and `write_actor_report`. Measure:

```python
def frame_metrics(frame):
    left, top, right, bottom = _bbox_or_error(frame)
    width, height = frame.size
    visible_width = right - left
    visible_height = bottom - top
    return {
        "bounds": [left, top, right, bottom],
        "center": [(left + right) / (2 * width), (top + bottom) / (2 * height)],
        "scale": [visible_width / width, visible_height / height],
        "alphaCoverage": sum(a > 0 for a in frame.getchannel("A").getdata()) / (width * height),
        "edgeMargins": [left / width, top / height, (width - right) / width, (height - bottom) / height],
    }
```

Center drift is the maximum Euclidean distance from the median center. Scale drift is the largest proportional deviation from median visible width or height. Fail on alpha coverage outside configured bounds, any edge margin below `safePadding - 0.015`, center drift above the limit, or scale drift above the limit.

- [ ] **Step 4: Generate contact sheets and JSON reports**

Create one report per actor under `artifacts/animation-reports`. The contact sheet uses action rows, frame columns, a checkerboard background, and a short ASCII action label. Reports contain `status: "candidate"`, actor id, source modes, per-action metrics, atlas dimensions, and warnings. Use Pillow only; do not add ImageMagick.

- [ ] **Step 5: Run builder tests**

Run: `node --test tests/verticalSliceAtlasBuilder.test.mjs`

Expected: PASS, including a test that opens the generated contact sheet and confirms non-zero dimensions.

- [ ] **Step 6: Commit quality analysis**

```bash
git add tools/build-vertical-slice-atlases.py tests/verticalSliceAtlasBuilder.test.mjs
git commit -m "feat: validate actor animation frame quality"
```

### Task 3: Make Atlas Builds Budgeted And Atomic

**Files:**
- Modify: `tests/verticalSliceAtlasBuilder.test.mjs`
- Modify: `tests/verticalSliceAtlasContract.test.mjs`
- Modify: `tools/build-vertical-slice-atlases.py`
- Modify: `assets/Data/animation-atlas.json`
- Modify: `assets/resources/Data/animation-atlas.json`

- [ ] **Step 1: Write failing tests for the 2048 limit, events, and failed-build preservation**

Test that `pack_action` rejects output larger than 2048, emitted actions retain event markers, and an invalid source frame leaves a sentinel output file unchanged.

```javascript
assert.deepEqual(
  actor.actions.find(({ name }) => name === 'cast').events,
  [{ name: 'sword-release', at: 0.42 }],
)
assert.equal(sourceManifestBytes.equals(resourceManifestBytes), true)
```

- [ ] **Step 2: Run tests and verify the expected failures**

Run: `node --test tests/verticalSliceAtlasBuilder.test.mjs tests/verticalSliceAtlasContract.test.mjs`

Expected: FAIL because the builder still defaults to 4096, omits events, and has no candidate/promotion boundary.

- [ ] **Step 3: Build candidates before explicit promotion**

Build into `artifacts/animation-candidates/<actor-id>` by default and validate every generated atlas and report without touching runtime resources. Add `--promote`; it accepts only candidates with no metric warnings, replaces only the selected actor PNG files, merges only selected actor manifest entries, writes both manifests after every selected actor succeeds, and changes the report status to `approved`. Do not remove or overwrite unrelated actors.

- [ ] **Step 4: Emit event metadata and enforce the texture budget**

Set `pack_action(..., max_texture_size=2048)`. Copy validated events into runtime actions:

```python
"events": [
    {"name": event["name"], "at": float(event["at"])}
    for event in action_config.get("events", [])
],
```

Keep version 2 and `framePacking: "vertical-slice-action-atlases"` so existing consumers remain compatible.

- [ ] **Step 5: Run all atlas tests**

Run: `node --test tests/animationAtlas.test.mjs tests/verticalSliceAtlasBuilder.test.mjs tests/verticalSliceAtlasContract.test.mjs tests/monsterAtlasContract.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit the atomic builder**

```bash
git add tools/build-vertical-slice-atlases.py tests/verticalSliceAtlasBuilder.test.mjs tests/verticalSliceAtlasContract.test.mjs assets/Data/animation-atlas.json assets/resources/Data/animation-atlas.json
git commit -m "feat: build mobile actor atlases atomically"
```

### Task 4: Add Pure Animation Event Timing

**Files:**
- Create: `tests/animationEventRuntime.test.mjs`
- Create: `tools/animation-event-runtime.mjs`
- Create: `assets/Scripts/Core/AnimationEventRuntime.ts`
- Modify: `assets/Scripts/Core/AnimationAtlas.ts`

- [ ] **Step 1: Write the failing event-runtime tests**

Cover a normal crossing, a skipped-frame crossing, loop wrap, and one-shot completion:

```javascript
test('collects markers crossed during a skipped frame interval', () => {
  const markers = [{ name: 'seal', at: 0.25 }, { name: 'release', at: 0.5 }]
  assert.deepEqual(
    markersCrossed({ markers, previousElapsed: 0.1, elapsed: 0.65, duration: 1, loop: false }),
    markers,
  )
})

test('non-looping completion is emitted only on the first duration crossing', () => {
  assert.equal(actionCompleted({ previousElapsed: 0.9, elapsed: 1.1, duration: 1, loop: false }), true)
  assert.equal(actionCompleted({ previousElapsed: 1.1, elapsed: 1.4, duration: 1, loop: false }), false)
})
```

- [ ] **Step 2: Run the tests and verify module-not-found failure**

Run: `node --test tests/animationEventRuntime.test.mjs`

Expected: FAIL because `tools/animation-event-runtime.mjs` is absent.

- [ ] **Step 3: Implement the pure event functions in the Node mirror**

Export `actionDuration`, `markersCrossed`, and `actionCompleted`. Marker crossing uses absolute elapsed time and iterates every crossed loop cycle, preserving marker order. Return no marker when elapsed time does not advance or duration is invalid.

- [ ] **Step 4: Run tests to green**

Run: `node --test tests/animationEventRuntime.test.mjs`

Expected: PASS.

- [ ] **Step 5: Port the same functions and types to TypeScript**

Add:

```typescript
export interface AnimationEventMarker {
  name: string
  at: number
}

export interface AnimationEventCrossingInput {
  markers: readonly AnimationEventMarker[]
  previousElapsed: number
  elapsed: number
  duration: number
  loop: boolean
}
```

Extend `AtlasAction` with `events?: AnimationEventMarker[]` without changing required legacy fields.

- [ ] **Step 6: Run import and event tests**

Run: `node --test tests/animationEventRuntime.test.mjs tests/tsImportSmoke.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit the event runtime**

```bash
git add assets/Scripts/Core/AnimationEventRuntime.ts assets/Scripts/Core/AnimationAtlas.ts tools/animation-event-runtime.mjs tests/animationEventRuntime.test.mjs
git commit -m "feat: add deterministic animation event timing"
```

### Task 5: Emit Atlas Events Without Breaking Existing Playback

**Files:**
- Modify: `tests/playableBattle.test.mjs`
- Modify: `assets/Scripts/Game/AtlasAnimator.ts`

- [ ] **Step 1: Write failing structural assertions**

Require the animator to compute duration, collect markers before updating the frame, emit typed payloads, and emit one completion event:

```javascript
assert.match(source, /markersCrossed\(/)
assert.match(source, /this\.node\.emit\('atlas-animation-event'/)
assert.match(source, /this\.node\.emit\('atlas-animation-complete'/)
assert.match(source, /private completionEmitted = false/)
```

- [ ] **Step 2: Run the playable battle test and verify failure**

Run: `node --test tests/playableBattle.test.mjs`

Expected: FAIL because `AtlasAnimator` does not emit timeline events.

- [ ] **Step 3: Integrate event crossing into `AtlasAnimator`**

Before advancing elapsed time, retain `previousElapsed`. After consuming accumulated time:

```typescript
const duration = actionDuration(this.action.order.length, this.action.fps)
for (const marker of markersCrossed({
  markers: this.action.events ?? [],
  previousElapsed,
  elapsed: this.elapsed,
  duration,
  loop: this.action.loop,
})) {
  this.node.emit('atlas-animation-event', {
    actorId: this.actorId,
    action: this.action.name,
    marker: marker.name,
    normalizedTime: marker.at,
  })
}
```

Reset `completionEmitted` in `play`, `stop`, and `reset`. Emit `atlas-animation-complete` exactly once when a non-looping action crosses its duration. Keep the existing cached-frame ownership, stale-load token, and no-redundant-frame-assignment changes intact.

- [ ] **Step 4: Run runtime-focused tests**

Run: `node --test tests/playableBattle.test.mjs tests/stripAnimation.test.mjs tests/animationEventRuntime.test.mjs tests/cocosStructure.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit atlas event emission**

```bash
git add assets/Scripts/Game/AtlasAnimator.ts tests/playableBattle.test.mjs
git commit -m "feat: emit actor animation markers"
```

### Task 6: Rebuild And Verify The Two Production Samples

**Files:**
- Modify: `assets/resources/Assets/ActorAtlases/QinglanSwordCultivator/*.png`
- Modify: `assets/resources/Assets/ActorAtlases/MossWolf/*.png`
- Modify: `assets/Data/animation-atlas.json`
- Modify: `assets/resources/Data/animation-atlas.json`
- Create: `artifacts/animation-reports/qinglan-sword-cultivator.json`
- Create: `artifacts/animation-reports/qinglan-sword-cultivator-contact-sheet.png`
- Create: `artifacts/animation-reports/moss-wolf.json`
- Create: `artifacts/animation-reports/moss-wolf-contact-sheet.png`

- [ ] **Step 1: Run source validation before rebuilding**

Run: `python tools/build-vertical-slice-atlases.py --check`

Expected: `vertical slice atlas source manifest ok`.

- [ ] **Step 2: Rebuild Qinglan and moss wolf only**

Run:

```bash
python tools/build-vertical-slice-atlases.py --actor qinglan-sword-cultivator --actor moss-wolf
```

Expected: two successful candidate builds and reports, with no runtime atlas or manifest modified yet.

- [ ] **Step 3: Inspect generated contact sheets**

Check all rows at original resolution. Reject the run if Qinglan has whole-body size pulsing, detached hands, a missing flying sword, or cropped robes; reject the wolf if legs detach, ground contact jumps, facing changes, or action silhouettes are indistinguishable. Correct source frames or manifest anchor settings and rebuild until both reports have no metric warnings and the contact sheets pass visual review.

- [ ] **Step 4: Promote the visually approved candidates**

Run:

```bash
python tools/build-vertical-slice-atlases.py --actor qinglan-sword-cultivator --actor moss-wolf --promote
```

Expected: only the two selected actor atlas folders and their two manifest entries change; both reports change to `status: "approved"`.

- [ ] **Step 5: Run the full automated test suite**

Run: `npm test`

Expected: all tests pass with no uncaught warnings.

- [ ] **Step 6: Run Cocos and Douyin readiness checks**

Run:

```bash
npm run build:check
npm run plan:douyin-resources
npm run report:resources
```

Expected: all commands exit 0; no action atlas exceeds 2048x2048; Qinglan and moss wolf remain in the stage-one package group.

- [ ] **Step 7: Build and test the game**

Run the existing Cocos Creator 3.8.8 web-mobile build, then:

```bash
npm run verify:build-output
npm run report:size
```

Open the built game at a phone portrait viewport and a landscape viewport. Verify the sword cultivator remains visible, movement is a stable flying-sword glide, hand-seal/cast markers fire once, and the moss wolf has distinct movement, telegraph, pounce, hurt, and death motion without a skill-cast hitch.

- [ ] **Step 8: Commit approved assets and reports**

```bash
git add assets/Data/animation-atlas.json assets/resources/Data/animation-atlas.json assets/resources/Assets/ActorAtlases/QinglanSwordCultivator assets/resources/Assets/ActorAtlases/MossWolf artifacts/animation-reports
git commit -m "feat: integrate validated cultivation actor animations"
```

## Plan Self-Review

- Every design requirement in the first-phase scope maps to a task.
- Source generation remains provider-neutral and does not require unavailable API keys.
- New runtime behavior is isolated behind optional event metadata, so legacy actors remain valid.
- Existing uncommitted frame-cache and timing work in `AtlasAnimator` is preserved explicitly.
- Asset builds are selective and atomic, preventing a failed source from corrupting approved runtime files.
- Mobile limits are enforced before Cocos import rather than reported after packaging.
