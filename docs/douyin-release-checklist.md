# Douyin Mini Game Release Checklist

Current status: the project is a Cocos Creator game prototype, but it is not yet a Douyin mini-game upload package.

## Hard Requirements

- Build target must be Douyin mini-game, producing `build/bytedance-mini-game`.
- Upload package must contain `game.js`, `game.json`, and `project.config.json`.
- `project.config.json` must contain a real Douyin mini-game AppID.
- Main package must stay under 4MB.
- Total mini-game package must stay under 20MB.
- Single subpackage must stay under 20MB.
- Large late-stage art, audio, and optional assets should move to remote resources instead of the main package.
- Both the built-in `main` bundle and `resources` bundle are remote for the Douyin target.
- The remote resource server must use HTTPS, and the generated `remote` directory must be uploaded before device preview.
- Final validation must run in Douyin Developer Tools and on a real device.

## Current Project Risks

- No `build/bytedance-mini-game` output is committed or generated in this worktree.
- No AppID is configured.
- Source resources are about 38.47MB under `assets/resources` after retiring 27.47MB of superseded atlases, combat strips, and legacy monster frames.
- Images dominate the budget at about 37.28MB, so the next package optimization pass should focus on stage-specific art and first-stage duplicate actor atlases.
- Audio is about 1.10MB and is not the primary loading bottleneck.
- The current planning report assigns about 16.71MB to stage 1 and 21.67MB to deferred content. The legacy review queue is now empty.

## Local Commands

Run these from `cocos-client`:

```powershell
$env:COCOS_CREATOR_PATH='D:\CocosCreator\3.8.8\CocosCreator.exe'
$env:DOUYIN_APPID='tt-your-real-appid'
$env:DOUYIN_REMOTE_SERVER='https://your-cdn.example.com/void-trial/'
npm.cmd run build:douyin
npm.cmd run plan:douyin-resources
npm.cmd run report:resources
npm.cmd run check:douyin
```

`build:douyin` writes `temp/douyin-build-config.json` and calls Cocos Creator with `configPath=...`, so the generated upload package should land in `build/bytedance-mini-game`.

`build:douyin` now refuses release builds without an HTTPS `DOUYIN_REMOTE_SERVER`. For the Douyin target, `assets/resources.meta` configures the `resources` bundle as a zipped remote bundle, while the build config marks the `main` bundle remote. Cocos writes both to the generated `remote` directory; that directory is CDN content and is excluded from upload-package size checks.

`plan:douyin-resources` classifies every source byte as `shared`, `stage-one`, `deferred`, or `review`. The `review` group is a deletion audit queue, not an automatic deletion list.

Expected result before Douyin build: `check:douyin` fails and lists missing build files plus missing AppID.

Expected result before upload: `check:douyin` passes with no blockers.

## Release Path

1. Configure Cocos Creator 3.8.8 to build the Douyin mini-game target.
2. Enter the real AppID from the Douyin developer platform.
3. Build to `build/bytedance-mini-game`.
4. Run `npm.cmd run check:douyin`.
5. Upload the generated `build/bytedance-mini-game/remote` directory to `DOUYIN_REMOTE_SERVER` without changing its internal paths.
6. Run `npm.cmd run check:douyin`; confirm upload-package bytes and remote CDN bytes are reported separately.
7. Open `build/bytedance-mini-game` in Douyin Developer Tools.
8. Test login, save flow, audio unlock behavior, touch input, safe-area layout, CDN loading, and first-stage combat on device.
9. Upload a test build, verify it through platform preview, then prepare the review submission.

## Current Decision

Do not upload the current web build. The next milestone is a valid Douyin mini-game build plus package-size remediation.
