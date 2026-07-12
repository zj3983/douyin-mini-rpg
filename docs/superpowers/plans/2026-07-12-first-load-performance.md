# First-load Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the deployed Cocos mobile cold-start time while preserving the current xianxia artwork, alpha edges, animation contracts, gameplay, and public URL.

**Architecture:** Add three independently verifiable improvements: deterministic build-size reporting, guarded near-lossless PNG optimization, and a stage-aware resource lifecycle that loads only the current stage before interaction and retains at most the current/next stage. Extend the existing deployment workflow to install explicit gzip MIME types at server scope, then verify both the generated Cocos package and the real public endpoint.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, Node.js test runner, Python 3.12 + Pillow, GitHub Actions, Nginx, Playwright/browser mobile verification.

---

## Task 1: Add a repeatable build-size baseline

**Files:**
- Create: `cocos-client/tools/report-web-build-size.mjs`
- Create: `cocos-client/tests/buildSizeReport.test.mjs`
- Modify: `cocos-client/package.json`

- [ ] **Step 1: Write the failing report tests**

Create fixtures containing nested JavaScript, JSON, PNG, and unrelated files. Assert that the reporter returns total bytes, total file count, text bytes, image bytes, the largest files in descending order, and gzip byte estimates for compressible text without modifying the fixture.

Also assert that a missing build root exits non-zero with a useful error instead of returning a misleading zero-byte report.

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `cd cocos-client && node --test tests/buildSizeReport.test.mjs`

Expected: FAIL because `tools/report-web-build-size.mjs` does not exist.

- [ ] **Step 3: Implement the smallest deterministic reporter**

Implement recursive file collection with stable path sorting. Use Node's `gzipSync` only to estimate transfer bytes for `.js`, `.json`, `.css`, `.svg`, `.txt`, `.xml`, and `.wasm`; do not rewrite the build. Emit machine-readable JSON including:

```json
{
  "fileCount": 0,
  "totalBytes": 0,
  "imageBytes": 0,
  "textBytes": 0,
  "estimatedGzipTextBytes": 0,
  "largestFiles": []
}
```

The module contract is:

```js
export function reportBuildSize(buildRoot, { largestCount = 20 } = {})
export function isCompressibleText(path)
```

The CLI resolves `process.argv[2]`, prints `JSON.stringify(report, null, 2)` on success, and exits with code `1` plus `Build root not found: <absolute path>` on a missing root.

Add `"report:size": "node tools/report-web-build-size.mjs build/web-mobile"` to `cocos-client/package.json`.

- [ ] **Step 4: Verify and record the baseline**

Run:

```powershell
cd cocos-client
node --test tests/buildSizeReport.test.mjs
npm run report:size | Tee-Object build-size-before.json
```

Expected: focused tests PASS; baseline reports approximately 520 files and 56.59 MB before optimization. Keep the JSON as review evidence but do not commit transient report files.

- [ ] **Step 5: Commit the reporter**

```powershell
git add cocos-client/tools/report-web-build-size.mjs cocos-client/tests/buildSizeReport.test.mjs cocos-client/package.json
git commit -m "test: add cocos build size reporting"
```

## Task 2: Add guarded near-lossless PNG optimization

**Files:**
- Create: `cocos-client/tools/optimize-runtime-pngs.py`
- Create: `cocos-client/tests/pngOptimization.test.mjs`
- Modify: `cocos-client/package.json`
- Modify generated assets only when accepted: `cocos-client/assets/resources/Assets/ActorAtlases/*/atlas.png`
- Modify generated assets only when accepted: `cocos-client/assets/resources/Assets/World/**/*.png`
- Modify generated assets only when accepted: `cocos-client/assets/resources/Assets/Generated/Atlases/*.png`

- [ ] **Step 1: Write failing optimizer contract tests**

Generate temporary RGBA fixtures in the test. Assert that optimization:

- preserves width and height;
- preserves every alpha byte exactly;
- keeps RGB PSNR at or above 42 dB;
- accepts output only when it is smaller;
- leaves the original bytes untouched when quality, alpha, dimensions, or size gates fail;
- produces identical bytes on two runs with identical input and settings;
- supports `--check` without writing files.

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `cd cocos-client && node --test tests/pngOptimization.test.mjs`

Expected: FAIL because `tools/optimize-runtime-pngs.py` does not exist.

- [ ] **Step 3: Implement conservative optimization**

Use Pillow only. Preserve the original alpha channel, quantize RGB conservatively, save deterministic RGBA PNGs with maximum lossless compression, calculate RGB PSNR against the source, and atomically replace only accepted candidates. Print one JSON result per file with original bytes, candidate bytes, PSNR, and accept/reject reason.

Use this callable contract so the Node test can exercise the Python implementation without coupling to CLI output formatting:

```python
def optimize_png(source: Path, *, apply: bool, min_psnr: float = 42.0) -> dict[str, object]:
    """Return path, originalBytes, candidateBytes, psnr, accepted, and reason."""

def discover_runtime_pngs(project_root: Path) -> list[Path]:
    """Return sorted PNG paths from ActorAtlases, World, and Generated/Atlases only."""
```

The accepted path must write to a sibling temporary file, reopen and validate that candidate, then use `Path.replace`. Rejection reasons are exactly `not-smaller`, `dimensions-changed`, `alpha-changed`, or `psnr-below-threshold` so tests can assert behavior.

Default discovery must be limited to the three runtime asset groups listed above. Do not touch source motion strips, portraits, skill art, `.meta` files, or files outside `assets/resources`.

- [ ] **Step 4: Run optimization and all visual contracts**

Run:

```powershell
cd cocos-client
python tools/optimize-runtime-pngs.py --check
python tools/optimize-runtime-pngs.py --apply
node --test tests/pngOptimization.test.mjs tests/animationAtlas.test.mjs tests/monsterAtlasContract.test.mjs tests/stageVisuals.test.mjs
npm test
```

Expected: all tests PASS; monster canvases remain 1024x1280, alpha margins remain valid, animation frames remain distinct, and rejected images remain byte-identical to their source.

- [ ] **Step 5: Inspect the changed art before committing**

Open at least the active cultivator atlas, one ground monster atlas, one flying monster atlas, one boss atlas, and every changed world background at original resolution. Confirm there are no halos, color banding, lost translucent edges, detached fragments, or changed framing.

- [ ] **Step 6: Commit accepted image reductions**

```powershell
git add cocos-client/tools/optimize-runtime-pngs.py cocos-client/tests/pngOptimization.test.mjs cocos-client/package.json cocos-client/assets/resources/Assets
git commit -m "perf: optimize runtime png assets safely"
```

## Task 3: Make stage resource loading current-plus-next only

**Files:**
- Create: `cocos-client/assets/Scripts/Core/StageResourceRuntime.ts`
- Create: `cocos-client/tools/stage-resource-runtime.mjs`
- Create: `cocos-client/tests/stageResourceRuntime.test.mjs`
- Create: `cocos-client/assets/Scripts/Game/StageResourceController.ts`
- Modify: `cocos-client/assets/Scripts/Core/StageVisualCatalog.ts`
- Modify: `cocos-client/tools/stage-visual-catalog.mjs`
- Modify: `cocos-client/assets/Scripts/Game/StageBackgroundController.ts`
- Modify: `cocos-client/assets/Scripts/Game/PortraitBattleBootstrap.ts`
- Modify: `cocos-client/tests/stageBackgroundRuntime.test.mjs`
- Modify: `cocos-client/tests/stageVisuals.test.mjs`
- Modify: `cocos-client/tests/cocosStructure.test.mjs`

- [ ] **Step 1: Write failing lifecycle tests**

Cover the behavior as executable state transitions:

1. Stage 1 activation requests only stage 1 required assets.
2. Once stage 1 is marked interactive, stage 2 background and monster atlases are prefetched.
3. Stage 2 activation reuses its completed prefetch and then starts stage 3 prefetch.
4. Stage 3 activation releases stage 1 assets while retaining stages 2 and 3.
5. Failed optional prefetch does not block the active stage and is retried as a required load on activation.
6. Rapid stage changes and destroy release each retained resource exactly once.
7. Stage 4 never requests an unknown stage 5.

Run: `cd cocos-client && node --test tests/stageResourceRuntime.test.mjs`

Expected: FAIL because the runtime does not exist.

- [ ] **Step 2: Implement a pure, mirrored lifecycle runtime**

Implement the same deterministic state machine in TypeScript and ESM mirror form. The runtime owns generation tokens, required loads, optional prefetches, retained stage IDs, retry state, and exactly-once release. Keep adapter methods limited to `load`, `release`, `ready`, and `warn`, so tests do not depend on Cocos.

Use the following shared shape in TypeScript and equivalent object shape in ESM:

```ts
export interface StageResourceDescriptor {
  readonly path: string
  readonly kind: 'spriteFrame' | 'texture'
}

export interface StageResourcePlan {
  readonly stageId: number
  readonly assets: readonly StageResourceDescriptor[]
}

export interface StageResourceAdapter<T> {
  load(asset: StageResourceDescriptor, resolve: (resource: T) => void, reject: (error: unknown) => void): void
  release(asset: StageResourceDescriptor, resource: T): void
  ready(stageId: number): void
  warn?(asset: StageResourceDescriptor, error: unknown): void
}

export class StageResourceRuntime<T> {
  constructor(adapter: StageResourceAdapter<T>)
  activate(plan: StageResourcePlan): boolean
  prefetch(plan: StageResourcePlan): boolean
  destroy(): void
  snapshot(): {
    activeStageId: number | null
    prefetchedStageId: number | null
    pendingStageIds: number[]
    retainedStageIds: number[]
    destroyed: boolean
  }
}
```

`activate` treats a completed prefetch as ready without issuing duplicate loads. A rejected prefetch is removed from retained state, and a later `activate` issues a new generation of required loads. After activation, release every completed stage whose ID is neither active nor prefetched-next.

Add a parity test that runs identical transitions through the TypeScript and ESM versions and compares snapshots and adapter actions.

- [ ] **Step 3: Define stage resource plans from existing authority data**

Extend each stage visual entry with its stage-specific monster actor IDs. Build resource paths from the existing animation manifest naming convention and preserve the existing far/mid background paths. Do not preload inactive characters, unrelated skills, artifacts, generated aggregate atlases, or stages 2-4 during initial scene assembly.

Add this catalog helper to both TypeScript and ESM mirrors:

```ts
export function stageResourcePlanFor(stageId: number): StageResourcePlan
```

It returns the far and optional mid background as `spriteFrame` descriptors and each `Assets/ActorAtlases/<ActorFolder>/atlas` as a `texture` descriptor. It throws `Unknown stage visual: <id>` for IDs outside 1-4; callers use this to avoid a stage-5 prefetch.

- [ ] **Step 4: Wire Cocos loading without blocking battle startup**

`StageResourceController` should load retained monster atlas `Texture2D` resources with `addRef()`/`decRef()` and delegate background display to the existing `StageBackgroundController`. In `PortraitBattleBootstrap`:

- activate stage 1 during assembly;
- mark stage 1 interactive only after the battle runtime is initialized and the active player/skill are bound;
- on `battle-stage-changed`, activate the requested stage and schedule only its next valid stage;
- destroy the controller with the scene;
- keep current fallback warnings and current-stage behavior when prefetch fails.

The controller-facing API is:

```ts
export class StageResourceController {
  activate(stageId: number): boolean
  prefetchNext(stageId: number): boolean
  destroy(): void
}
```

The Cocos adapter switches on descriptor kind and calls `resources.load(path, SpriteFrame, ...)` or `resources.load(path, Texture2D, ...)`. Every successful retained asset receives one `addRef`; the matching runtime release performs one `decRef`.

- [ ] **Step 5: Run focused and full Cocos tests**

Run:

```powershell
cd cocos-client
node --test tests/stageResourceRuntime.test.mjs tests/stageBackgroundRuntime.test.mjs tests/stageVisuals.test.mjs tests/cocosStructure.test.mjs
npm test
```

Expected: focused tests PASS; full suite reports zero failures and only the existing build-root environment skip.

- [ ] **Step 6: Commit stage-aware loading**

```powershell
git add cocos-client/assets/Scripts/Core/StageResourceRuntime.ts cocos-client/tools/stage-resource-runtime.mjs cocos-client/tests/stageResourceRuntime.test.mjs cocos-client/assets/Scripts/Game/StageResourceController.ts cocos-client/assets/Scripts/Core/StageVisualCatalog.ts cocos-client/tools/stage-visual-catalog.mjs cocos-client/assets/Scripts/Game/StageBackgroundController.ts cocos-client/assets/Scripts/Game/PortraitBattleBootstrap.ts cocos-client/tests/stageBackgroundRuntime.test.mjs cocos-client/tests/stageVisuals.test.mjs cocos-client/tests/cocosStructure.test.mjs
git commit -m "perf: load battle assets by active stage"
```

## Task 4: Enable text compression in the deployed Nginx route

**Files:**
- Create: `test/deploy-compression.test.js`
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Write a failing deployment contract test**

Read the workflow as text and assert the generated server block contains:

- `gzip on`;
- `gzip_vary on`;
- `gzip_proxied any`;
- `gzip_min_length 1024`;
- `gzip_comp_level 6`;
- MIME types for JavaScript, JSON, CSS, SVG, XML/text, and WebAssembly;
- public post-deploy checks using `Accept-Encoding: gzip` that require `Content-Encoding: gzip` for a built JavaScript file;
- the existing 30-day immutable cache check for versioned assets.

Run: `node --test test/deploy-compression.test.js`

Expected: FAIL because the workflow currently inserts cache locations but no explicit gzip MIME list or encoded-response assertion.

- [ ] **Step 2: Add server-scope gzip directives to the existing patcher**

Insert the directives once immediately after the matched `server_name`, before the game locations, so `/assets/`, `/cocos-js/`, `/src/`, and the fallback game route inherit them. Keep the patch idempotent by removing the previously managed gzip block before insertion. Do not alter unrelated Nginx virtual hosts.

The managed block is exactly:

```nginx
# BEGIN douyin-mini-rpg compression
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml application/json application/javascript application/xml application/xml+rss image/svg+xml application/wasm;
# END douyin-mini-rpg compression
```

Before insertion, remove only text between those two marker comments. This keeps repeated deployments idempotent without rewriting unrelated gzip directives.

- [ ] **Step 3: Add deployment-time public assertions**

After `nginx -t` and reload, discover one built `.js` path from the deployed package and request it with `Accept-Encoding: gzip`. Require `Content-Encoding: gzip`, `Vary: Accept-Encoding`, and the existing immutable cache header where applicable. Keep the current HTML, CSS, JSON, hub, API, and removed-legacy-entry checks.

- [ ] **Step 4: Run focused and full root tests**

Run:

```powershell
node --test test/deploy-compression.test.js
npm test
```

Expected: all 65 root tests PASS.

- [ ] **Step 5: Commit deployment compression**

```powershell
git add test/deploy-compression.test.js .github/workflows/deploy.yml
git commit -m "perf: compress deployed cocos text assets"
```

## Task 5: Rebuild Cocos and verify the complete package

**Files:**
- Regenerate: `cocos-client/build/web-mobile/**`
- Verify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Build from a clean Cocos cache in the worktree**

Resolve the worktree path before deletion and verify that `library`, `temp`, and `build/web-mobile` are children of `D:\游戏\douyin-mini-rpg\.worktrees\first-load-performance\cocos-client`. Delete only those generated directories, then run:

```powershell
& 'D:\CocosCreator\3.8.8\CocosCreator.exe' --project 'D:\游戏\douyin-mini-rpg\.worktrees\first-load-performance\cocos-client' --build 'platform=web-mobile;debug=false'
```

Expected: Cocos exits successfully and produces `cocos-client/build/web-mobile/index.html`.

- [ ] **Step 2: Verify the generated build and compare size**

Run:

```powershell
cd cocos-client
$env:COCOS_CREATOR_PATH='D:\CocosCreator\3.8.8\CocosCreator.exe'
npm run build:check
npm run verify:build-output -- build/web-mobile
npm run report:size | Tee-Object build-size-after.json
```

Expected: readiness and output verification PASS. Compare before/after total bytes, image bytes, largest files, raw text bytes, and estimated gzip text bytes. Do not claim a percentage not supported by the report.

- [ ] **Step 3: Run all automated checks**

Run:

```powershell
cd 'D:\游戏\douyin-mini-rpg\.worktrees\first-load-performance'
npm test
cd cocos-client
$env:COCOS_BUILD_ROOT=(Resolve-Path 'build/web-mobile').Path
npm test
npm run verify:build-output -- build/web-mobile
```

Expected: root tests all PASS; Cocos tests all PASS including explicit build-root verification; zero skips and zero failures with `COCOS_BUILD_ROOT` set.

- [ ] **Step 4: Perform local mobile visual and request-order verification**

Serve `cocos-client/build/web-mobile` and inspect at `390x844` and `430x932`. Play through stage 1 into stage 2. Verify:

- first canvas is nonblank and correctly proportioned;
- the complete cultivator and stage-matched monsters render without alpha artifacts;
- movement, automatic flying sword, soul pickup, boss, and settlement still work;
- no stage 2-4 PNG requests occur before stage 1 becomes interactive;
- stage 2 resources begin prefetching only after interaction;
- stage 2 transition uses the prefetched resources;
- console has no errors and no missing-resource requests.

- [ ] **Step 5: Commit the verified Cocos output**

```powershell
git add cocos-client/build/web-mobile
git commit -m "build: export optimized cocos web package"
```

## Task 6: Review, integrate, deploy, and verify the public game

**Files:**
- Review all changes from `a7e541c` to `HEAD`
- Deploy public path: `/var/www/game/douyin-mini-rpg`

- [ ] **Step 1: Run specification and quality reviews**

Request separate reviewers for:

- design/spec compliance against `docs/superpowers/specs/2026-07-12-first-load-performance-design.md`;
- code quality, lifecycle correctness, failure handling, and test adequacy.

Resolve every critical or important finding, rerun affected tests, and keep unrelated cleanup out of this branch.

- [ ] **Step 2: Verify the branch is intentional and clean**

Run:

```powershell
git status --short
git diff --stat a7e541c...HEAD
git log --oneline a7e541c..HEAD
```

Expected: clean worktree; only performance implementation, tests, optimized accepted images, deployment workflow, and generated Cocos output are present.

- [ ] **Step 3: Integrate and push**

Use the finishing-development-branch workflow. Fast-forward `main` only after all checks pass, push `main`, and confirm the GitHub deployment workflow succeeds.

- [ ] **Step 4: Verify public response headers**

Against `https://mcp.edcedc.cn/game/douyin-mini-rpg/`, request the actual deployed engine/main JavaScript with `Accept-Encoding: gzip` and confirm:

- `Content-Encoding: gzip`;
- `Vary: Accept-Encoding`;
- versioned assets retain `Cache-Control: public, max-age=2592000, immutable`;
- compressed transfer bytes are lower than raw content bytes.

- [ ] **Step 5: Verify public mobile gameplay and first interaction**

Open the public URL at `390x844`, force a cold cache, and record navigation start to the first playable battle frame. Confirm nonblank canvas, correct aspect ratio, complete character and monsters, no console errors, stage 1 combat, stage 2 transition, and no gameplay regression. Compare the measured first-interaction time and transferred bytes with the recorded baseline; report exact values and testing conditions.

- [ ] **Step 6: Final acceptance**

Acceptance requires all of the following:

- root and Cocos test suites pass;
- build output verifier passes on the newly generated build;
- PNG contract and visual inspection pass;
- public JavaScript is gzip encoded and immutable caching remains intact;
- cold-cache first interaction and transfer evidence are recorded;
- public mobile gameplay reaches stage 2 without rendering or lifecycle errors.
