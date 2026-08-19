# H3 Gameplay Animation Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate nine approved Qinglan sword cultivator and moss wolf action videos with the existing local MiniMax H3 service, convert them into stable PNG animation atlases, and verify the new motion in the Cocos game.

**Architecture:** A checked-in pilot manifest and H3 prompt set define reproducible Ref2V jobs. A restart-safe Python client submits and downloads source MP4 files to ignored artifacts, while a separate deterministic extractor selects authored frames into the existing `art-source/vertical-slice` tree. The existing atlas builder validates and promotes only complete candidates, and the current `AtlasAnimator` remains the runtime playback path.

**Tech Stack:** MiniMax H3 Ref2V, ComfyUI H3 bridge, Python 3.11 standard library, FFmpeg, Pillow, Node.js test runner, Cocos Creator 3.8.8.

---

## File Map

- Create `cocos-client/art-source/h3-pilot/pilot.json`: H3 job identity, references, fixed seeds, source video names, and output sampling maps.
- Create `cocos-client/art-source/h3-pilot/prompts/qinglan/*.txt`: four H3 Ref2V prompts for the player pilot.
- Create `cocos-client/art-source/h3-pilot/prompts/moss-wolf/*.txt`: five H3 Ref2V prompts for the monster pilot.
- Create `cocos-client/tools/generate-h3-action-videos.py`: bridge health check, resumable submission, polling, and MP4 download.
- Create `cocos-client/tools/extract-h3-action-frames.py`: deterministic FFmpeg sampling and source-frame publication.
- Create `cocos-client/tests/h3AnimationPilot.test.mjs`: manifest, prompt, client, extraction, and runtime-action contract tests.
- Modify `cocos-client/.gitignore`: keep source MP4 and transient extraction frames out of Git.
- Modify `cocos-client/assets/Data/vertical-slice-animation-sources.json`: mark replaced actions as `pose-video` and add wolf bite contact timing.
- Replace selected PNGs under `cocos-client/art-source/vertical-slice/qinglan` and `cocos-client/art-source/vertical-slice/moss-wolf` after visual approval.
- Replace selected runtime PNGs under `cocos-client/assets/resources/Assets/ActorAtlases/QinglanSwordCultivator` and `MossWolf` only through candidate promotion.
- Create `docs/reports/h3-gameplay-animation-pilot-verification.md`: generation provenance, contact-sheet findings, tests, and gameplay evidence.

### Task 1: Lock the H3 Pilot Contract

**Files:**
- Create: `cocos-client/tests/h3AnimationPilot.test.mjs`
- Create: `cocos-client/art-source/h3-pilot/pilot.json`
- Modify: `cocos-client/.gitignore`

- [ ] **Step 1: Write the failing manifest-contract test**

Add a Node test that requires exactly four Qinglan jobs and five moss-wolf jobs, `minimax-h3-ref2v-local`, 768 by 1344 output, five-second duration, fixed integer seeds, existing reference PNGs, unique output names, and exact runtime output frame counts.

```js
const expected = {
  qinglan: { idle: 8, sword_ride: 10, hand_seal: 10, hurt: 6 },
  'moss-wolf': { idle: 6, move: 8, telegraph: 4, attack: 8, hurt: 4, death: 8 },
}
assert.equal(pilot.model, 'minimax-h3-ref2v-local')
assert.deepEqual([pilot.width, pilot.height, pilot.duration], [768, 1344, 5])
assert.equal(pilot.jobs.length, 9)
assert.deepEqual(outputsByActor, expected)
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `node --test tests/h3AnimationPilot.test.mjs`

Expected: FAIL because `art-source/h3-pilot/pilot.json` does not exist.

- [ ] **Step 3: Add the manifest and artifact exclusions**

Use this stable manifest shape:

```json
{
  "version": 1,
  "bridgeUrl": "http://127.0.0.1:8900",
  "model": "minimax-h3-ref2v-local",
  "width": 768,
  "height": 1344,
  "duration": 5,
  "fps": 24,
  "jobs": [
    {
      "id": "qinglan-idle",
      "actor": "qinglan",
      "action": "idle",
      "reference": "art-source/vertical-slice/qinglan/reference-chroma.png",
      "prompt": "art-source/h3-pilot/prompts/qinglan/idle.txt",
      "seed": 3082001,
      "video": "qinglan/idle.mp4",
      "outputs": [{ "action": "idle", "samples": [0.20, 0.80, 1.40, 2.00, 2.60, 3.20, 3.80, 4.40] }]
    }
  ]
}
```

Add the other eight jobs with unique ascending seeds. The wolf bite-lunge job owns two output entries: four anticipation samples for `telegraph` and eight launch/contact/recovery samples for `attack`. Ignore `artifacts/h3-animation-pilot/*/videos/`, `frames-raw/`, and bridge state files, while retaining JSON reports and contact sheets.

- [ ] **Step 4: Run the contract test and confirm GREEN**

Run: `node --test tests/h3AnimationPilot.test.mjs`

Expected: PASS for schema, references, counts, paths, and seed uniqueness.

- [ ] **Step 5: Commit the contract**

```powershell
git add cocos-client/.gitignore cocos-client/tests/h3AnimationPilot.test.mjs cocos-client/art-source/h3-pilot/pilot.json
git commit -m "test: lock H3 animation pilot contract"
```

### Task 2: Author H3 Ref2V Action Prompts

**Files:**
- Create: `cocos-client/art-source/h3-pilot/prompts/qinglan/idle.txt`
- Create: `cocos-client/art-source/h3-pilot/prompts/qinglan/sword-ride.txt`
- Create: `cocos-client/art-source/h3-pilot/prompts/qinglan/hand-seal.txt`
- Create: `cocos-client/art-source/h3-pilot/prompts/qinglan/hurt.txt`
- Create: `cocos-client/art-source/h3-pilot/prompts/moss-wolf/idle.txt`
- Create: `cocos-client/art-source/h3-pilot/prompts/moss-wolf/run.txt`
- Create: `cocos-client/art-source/h3-pilot/prompts/moss-wolf/bite-lunge.txt`
- Create: `cocos-client/art-source/h3-pilot/prompts/moss-wolf/hurt.txt`
- Create: `cocos-client/art-source/h3-pilot/prompts/moss-wolf/death.txt`
- Modify: `cocos-client/tests/h3AnimationPilot.test.mjs`

- [ ] **Step 1: Extend the test with prompt-format and motion guards**

Require every prompt to contain all six H3 Ref2V sections in order and the shared sprite constraints.

```js
const sections = [
  'subject_definitions:',
  'summary:',
  'retention_analysis:',
  'detailed_description:',
  'overall_soundscape:',
  'non_diegetic_music:',
]
assertSectionsInOrder(prompt, sections)
assert.match(prompt, /locked side-view camera/i)
assert.match(prompt, /no camera movement/i)
assert.match(prompt, /plain near-white background/i)
assert.match(prompt, /subject remains fully inside the frame/i)
```

Require Qinglan prompts to prohibit walking, running, body lunges, costume changes, extra swords, and extra limbs. Require wolf prompts to preserve four legs and prohibit detached limbs, bipedal motion, direction changes, and frame exits.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `node --test tests/h3AnimationPilot.test.mjs`

Expected: FAIL listing the nine missing prompt files.

- [ ] **Step 3: Write the four Qinglan prompts**

Use the exact H3 Ref2V section order. Define `<Subject 1>` from the reference image and mark it `fully_preserved`. Each prompt contains one continuous shot from `0.00-5.00s`, no dialogue, no music, no camera movement, and no visible effects that obscure the body.

The action beats are:

- `idle`: stable sword stance, subtle breathing, robe hem and hair moving in a light breeze, seamless return.
- `sword-ride`: stable feet on the sword, torso counterbalances gentle flight, cloth trails backward, no stepping.
- `hand-seal`: hands rise, fingers form a readable cultivation seal, pose holds, arms recover, feet remain planted on the sword.
- `hurt`: upper body recoils once, sleeves and hair follow through, balance recovers, no forward rush or fall.

- [ ] **Step 4: Write the five moss-wolf prompts**

The action beats are:

- `idle`: breathing, ear response, tail balance, paws planted.
- `run`: complete quadruped gait cycles with alternating fore and hind limbs while the body stays centered.
- `bite-lunge`: crouched anticipation, hind-leg push, foreleg reach, jaw contact, recoil and recovery.
- `hurt`: single lateral recoil with paw bracing and recovery.
- `death`: loss of balance, controlled collapse, final still silhouette, no disappearing body.

- [ ] **Step 5: Run the focused test and confirm GREEN**

Run: `node --test tests/h3AnimationPilot.test.mjs`

Expected: PASS with nine complete Ref2V prompts and all action-specific guards.

- [ ] **Step 6: Commit the prompts**

```powershell
git add cocos-client/art-source/h3-pilot/prompts cocos-client/tests/h3AnimationPilot.test.mjs
git commit -m "assets: author H3 pilot action prompts"
```

### Task 3: Add a Restart-Safe H3 Video Client

**Files:**
- Create: `cocos-client/tools/generate-h3-action-videos.py`
- Modify: `cocos-client/tests/h3AnimationPilot.test.mjs`

- [ ] **Step 1: Write failing client behavior tests**

Test a local fake HTTP server and require the client to:

- stop before submission when `/health` is not `ready`;
- encode PNG references as data URIs;
- POST the exact Ref2V payload;
- write `jobs.json` atomically after receiving a task ID;
- resume polling an existing task without resubmitting;
- download completed MP4 content to a temporary name and rename after success;
- retain failed task metadata and return non-zero.

```python
payload = {
    "model": pilot["model"],
    "prompt": prompt,
    "width": pilot["width"],
    "height": pilot["height"],
    "duration": pilot["duration"],
    "n": 1,
    "seed": job["seed"],
    "reference_images": [image_data_uri(reference_path)],
}
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `node --test tests/h3AnimationPilot.test.mjs`

Expected: FAIL because `tools/generate-h3-action-videos.py` is missing.

- [ ] **Step 3: Implement the client**

Expose these arguments:

```text
--manifest art-source/h3-pilot/pilot.json
--run-root artifacts/h3-animation-pilot/20260820-h3-pilot-r1
--job <job-id>          repeatable; omit for all jobs
--poll-seconds 15
--timeout-seconds 10800
--dry-run
```

Use only Python's `argparse`, `base64`, `json`, `mimetypes`, `pathlib`, `tempfile`, `time`, and `urllib.request`. Process jobs sequentially because the bridge has one video worker. Never include base64 image data in logs or state files.

- [ ] **Step 4: Run the focused test and a real dry run**

Run: `node --test tests/h3AnimationPilot.test.mjs`

Run: `python tools/generate-h3-action-videos.py --dry-run --run-root artifacts/h3-animation-pilot/dry-run`

Expected: tests PASS; dry run reports nine valid jobs, bridge ready, references readable, and zero submissions.

- [ ] **Step 5: Commit the client**

```powershell
git add cocos-client/tools/generate-h3-action-videos.py cocos-client/tests/h3AnimationPilot.test.mjs
git commit -m "feat: add resumable local H3 action client"
```

### Task 4: Add Deterministic Video Frame Extraction

**Files:**
- Create: `cocos-client/tools/extract-h3-action-frames.py`
- Modify: `cocos-client/tests/h3AnimationPilot.test.mjs`

- [ ] **Step 1: Write failing extraction tests**

Generate a synthetic 24 FPS five-second MP4 with FFmpeg. Require exact output counts, zero-padded names, strictly increasing sample times, no writes outside `art-source/vertical-slice`, and atomic action-directory replacement. Require extraction to reject missing videos, timestamps outside `[0, 5)`, duplicate output actions, and FFmpeg failures.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `node --test tests/h3AnimationPilot.test.mjs`

Expected: FAIL because `tools/extract-h3-action-frames.py` is missing.

- [ ] **Step 3: Implement deterministic sampling**

For every sample time, run FFmpeg with one selected frame and preserve full RGB detail:

```python
command = [
    ffmpeg, "-hide_banner", "-loglevel", "error", "-ss", f"{sample:.3f}",
    "-i", str(video), "-frames:v", "1", "-vf", "scale=768:1344:flags=lanczos",
    "-y", str(output),
]
```

Write frames to a staging directory, verify each PNG with Pillow, then replace only the selected actor/action directory. Emit `extraction-report.json` containing source video SHA-256, sample times, output hashes, and dimensions.

- [ ] **Step 4: Run extraction tests and atlas-builder tests**

Run: `node --test tests/h3AnimationPilot.test.mjs tests/verticalSliceAtlasBuilder.test.mjs`

Expected: PASS; no existing source frames are changed by the synthetic test.

- [ ] **Step 5: Commit the extractor**

```powershell
git add cocos-client/tools/extract-h3-action-frames.py cocos-client/tests/h3AnimationPilot.test.mjs
git commit -m "feat: extract deterministic H3 animation frames"
```

### Task 5: Generate and Curate the Qinglan Pilot

**Files:**
- Modify: `cocos-client/art-source/vertical-slice/qinglan/idle/*.png`
- Modify: `cocos-client/art-source/vertical-slice/qinglan/sword_ride/*.png`
- Modify: `cocos-client/art-source/vertical-slice/qinglan/hand_seal/*.png`
- Modify: `cocos-client/art-source/vertical-slice/qinglan/hurt/*.png`
- Modify: `cocos-client/assets/Data/vertical-slice-animation-sources.json`
- Create: `cocos-client/artifacts/h3-animation-pilot/20260820-h3-pilot-r1/qinglan-contact-sheet.png`

- [ ] **Step 1: Verify the live local H3 route**

Run: `Invoke-RestMethod http://127.0.0.1:8900/health`

Run: `Invoke-RestMethod http://127.0.0.1:8190/system_stats | ConvertTo-Json -Depth 5`

Expected: bridge `status` is `ready`; the device name contains `RTX 5090`; required H3 models remain available.

- [ ] **Step 2: Submit the four Qinglan jobs sequentially**

Run:

```powershell
python tools/generate-h3-action-videos.py --run-root artifacts/h3-animation-pilot/20260820-h3-pilot-r1 --job qinglan-idle --job qinglan-sword-ride --job qinglan-hand-seal --job qinglan-hurt
```

Expected: four completed task IDs, four downloaded MP4 files, and no cloud provider call.

- [ ] **Step 3: Extract the selected Qinglan frames**

Run:

```powershell
python tools/extract-h3-action-frames.py --run-root artifacts/h3-animation-pilot/20260820-h3-pilot-r1 --actor qinglan
```

Expected: 34 PNG source frames written through atomic action-directory replacements.

- [ ] **Step 4: Build the Qinglan candidate and inspect it**

Run:

```powershell
python tools/build-vertical-slice-atlases.py --actor qinglan-sword-cultivator --report-root artifacts/animation-candidates
```

Expected: candidate validation succeeds and produces a contact sheet. Inspect at native resolution. Reject and regenerate any action with identity drift, extra hands or swords, missing flying sword, cropped robe, body-size pulsing, foot sliding, or unclear hand-seal silhouettes.

- [ ] **Step 5: Update source modes and run focused tests**

Set Qinglan `idle`, `sword_ride`, `hand_seal`, and `hurt` to `pose-video` in the authoritative source manifest. Keep `cast` and `death` unchanged and retain the existing `seal-formed` marker.

Run: `node --test tests/h3AnimationPilot.test.mjs tests/verticalSliceAtlasContract.test.mjs tests/verticalSliceAtlasBuilder.test.mjs`

Expected: PASS with valid source actions and unchanged unrelated actor entries.

- [ ] **Step 6: Commit approved Qinglan sources**

```powershell
git add cocos-client/art-source/vertical-slice/qinglan cocos-client/assets/Data/vertical-slice-animation-sources.json cocos-client/artifacts/animation-candidates/qinglan-sword-cultivator
git commit -m "assets: rebuild Qinglan motion from local H3"
```

### Task 6: Generate and Curate the Moss Wolf Pilot

**Files:**
- Modify: `cocos-client/art-source/vertical-slice/moss-wolf/idle/*.png`
- Modify: `cocos-client/art-source/vertical-slice/moss-wolf/move/*.png`
- Modify: `cocos-client/art-source/vertical-slice/moss-wolf/telegraph/*.png`
- Modify: `cocos-client/art-source/vertical-slice/moss-wolf/attack/*.png`
- Modify: `cocos-client/art-source/vertical-slice/moss-wolf/hurt/*.png`
- Modify: `cocos-client/art-source/vertical-slice/moss-wolf/death/*.png`
- Modify: `cocos-client/assets/Data/vertical-slice-animation-sources.json`
- Create: `cocos-client/artifacts/h3-animation-pilot/20260820-h3-pilot-r1/moss-wolf-contact-sheet.png`

- [ ] **Step 1: Submit the five moss-wolf jobs sequentially**

Run:

```powershell
python tools/generate-h3-action-videos.py --run-root artifacts/h3-animation-pilot/20260820-h3-pilot-r1 --job moss-wolf-idle --job moss-wolf-run --job moss-wolf-bite-lunge --job moss-wolf-hurt --job moss-wolf-death
```

Expected: five completed task IDs and five downloaded MP4 files.

- [ ] **Step 2: Extract six runtime action sets**

Run:

```powershell
python tools/extract-h3-action-frames.py --run-root artifacts/h3-animation-pilot/20260820-h3-pilot-r1 --actor moss-wolf
```

Expected: 38 PNG frames. The bite-lunge source yields both `telegraph` anticipation frames and `attack` launch/contact/recovery frames.

- [ ] **Step 3: Build and inspect the moss-wolf candidate**

Run:

```powershell
python tools/build-vertical-slice-atlases.py --actor moss-wolf --report-root artifacts/animation-candidates
```

Expected: candidate validation succeeds. Reject and regenerate frames with a changing leg count, detached torso or paws, reversed facing, bipedal poses, ground-contact jumps, sliding body, cropped tail, or indistinguishable run and attack silhouettes.

- [ ] **Step 4: Update source modes and attack timing**

Set all six moss-wolf runtime actions to `pose-video`. Add `events: [{ "name": "bite-contact", "time": 0.55 }]` to `attack` in the authoritative source manifest. Preserve frame counts, FPS, loops, action names, and all unrelated actor data.

- [ ] **Step 5: Run focused tests and commit approved sources**

Run: `node --test tests/h3AnimationPilot.test.mjs tests/verticalSliceAtlasContract.test.mjs tests/verticalSliceAtlasBuilder.test.mjs tests/playableBattle.test.mjs`

Expected: PASS with the bite marker and unchanged unrelated actor entries.

```powershell
git add cocos-client/art-source/vertical-slice/moss-wolf cocos-client/assets/Data/vertical-slice-animation-sources.json cocos-client/artifacts/animation-candidates/moss-wolf
git commit -m "assets: rebuild moss wolf motion from local H3"
```

### Task 7: Promote Atlases and Verify Runtime Playback

**Files:**
- Modify: `cocos-client/assets/Data/animation-atlas.json`
- Modify: `cocos-client/assets/resources/Data/animation-atlas.json`
- Modify: `cocos-client/assets/resources/Assets/ActorAtlases/QinglanSwordCultivator/*.png`
- Modify: `cocos-client/assets/resources/Assets/ActorAtlases/MossWolf/*.png`
- Modify: `cocos-client/tests/playableBattle.test.mjs`

- [ ] **Step 1: Add a failing runtime-marker test**

Require the moss-wolf `attack` manifest entry to expose `bite-contact` once and verify the pure animation event runtime crosses it once during forward playback.

```js
assert.deepEqual(crossed.map((event) => event.name), ['bite-contact'])
```

- [ ] **Step 2: Run the marker test and confirm RED before promotion**

Run: `node --test tests/playableBattle.test.mjs`

Expected: FAIL because the current promoted runtime manifest has no `bite-contact` marker.

- [ ] **Step 3: Promote both complete candidates atomically**

Run:

```powershell
python tools/build-vertical-slice-atlases.py --promote --actor qinglan-sword-cultivator --actor moss-wolf --report-root artifacts/animation-candidates
```

Expected: both candidates promote; no unrelated actor atlas or manifest entry changes.

- [ ] **Step 4: Run animation and Cocos structure tests**

Run:

```powershell
node --test tests/h3AnimationPilot.test.mjs tests/verticalSliceAtlasContract.test.mjs tests/verticalSliceAtlasBuilder.test.mjs tests/playableBattle.test.mjs tests/cocosStructure.test.mjs
```

Expected: PASS, including event timing, non-looping completion, facing, atlas dimensions, and catalog resolution.

- [ ] **Step 5: Commit promoted runtime assets**

```powershell
git add cocos-client/assets/Data/animation-atlas.json cocos-client/assets/resources/Data/animation-atlas.json cocos-client/assets/resources/Assets/ActorAtlases/QinglanSwordCultivator cocos-client/assets/resources/Assets/ActorAtlases/MossWolf cocos-client/tests/playableBattle.test.mjs
git commit -m "feat: ship H3 pilot animation atlases"
```

### Task 8: Build, Play, and Record Acceptance

**Files:**
- Modify: `cocos-client/build/web-mobile/**`
- Create: `docs/reports/h3-gameplay-animation-pilot-verification.md`
- Create: `docs/reports/assets/h3-gameplay-animation-pilot/*.png`

- [ ] **Step 1: Run the full test suite**

Run: `node --test tests/*.test.mjs`

Expected: zero failures; any intentional skip is named in the report.

- [ ] **Step 2: Build and independently validate the web output**

Run:

```powershell
$args=@('--project','D:\游戏\douyin-mini-rpg\.worktrees\m3-pursuit-dungeon\cocos-client','--build','platform=web-mobile;debug=false')
Start-Process -FilePath 'D:\CocosCreator\3.8.8\CocosCreator.exe' -ArgumentList $args -Wait -WindowStyle Hidden
```

The Creator process may return the already documented code 36. Accept the build only when `build/web-mobile/index.html` is freshly written and the independent checks below pass:

```powershell
node tools/check-cocos-build-output.mjs build/web-mobile
node tools/report-resource-budget.mjs
node tools/report-web-build-size.mjs build/web-mobile
```

Expected: build readiness `ready: true`, no output errors, and animation assets remain within the current budget.

- [ ] **Step 3: Run real browser gameplay checks**

From the repository root, start the static server:

```powershell
python -m http.server 4175 --bind 127.0.0.1 --directory cocos-client/build/web-mobile
```

From a second terminal, run both real browser checks:

```powershell
npm.cmd run agent:test -- --url http://127.0.0.1:4175/ --mode default --viewport 390x844
npm.cmd run agent:test -- --url http://127.0.0.1:4175/ --mode default --viewport 844x390
```

Exercise player idle, sword-flight movement, hand-seal casting, wolf pursuit, bite, hurt, and death. Confirm no actor stretching, incomplete cropping, reversed facing, stuck action, texture hitch, or control obstruction.

- [ ] **Step 4: Record visual and performance evidence**

Capture one portrait and one landscape gameplay screenshot plus the two contact sheets. Measure requestAnimationFrame P95 during player casting and wolf attack, not after settlement. Compare against the current accepted build and reject a measurable new cast hitch.

- [ ] **Step 5: Write the verification report**

Record:

- H3 bridge version, remote GPU identity, local model IDs, and zero cloud usage;
- all nine task IDs, seeds, prompt paths, source-video hashes, and extraction reports;
- contact-sheet findings and rejected/regenerated attempts;
- final test counts, build checks, resource totals, viewport matrix, and frame-time P95;
- remaining risk limited to physical Douyin-device validation.

- [ ] **Step 6: Verify and commit the release evidence**

Run:

```powershell
git diff --check
node --test tests/*.test.mjs
node tools/check-cocos-build-output.mjs build/web-mobile
```

Expected: all commands pass.

```powershell
git add cocos-client/build/web-mobile docs/reports/h3-gameplay-animation-pilot-verification.md docs/reports/assets/h3-gameplay-animation-pilot
git commit -m "test: verify H3 gameplay animation pilot"
```

## Execution Notes

- Preserve the existing unrelated `settings/v2/packages/engine.json` worktree change and untracked Cocos metadata.
- Never overwrite approved runtime atlases before both candidate reports pass.
- Keep source MP4 files outside Git; retain reproducibility through prompts, seeds, task IDs, hashes, and extraction reports.
- Process H3 jobs sequentially and allow restart-safe polling because the local bridge has one worker.
- Do not broaden this pilot to other actors before the two pilot actors pass gameplay acceptance.
