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
- Final validation must run in Douyin Developer Tools and on a real device.

## Current Project Risks

- No `build/bytedance-mini-game` output is committed or generated in this worktree.
- No AppID is configured.
- Source resources are about 65.94MB under `assets/resources`.
- Images dominate the budget at about 64.75MB, so package optimization must focus on atlases, backgrounds, and stage-specific art.
- Audio is about 1.10MB and is not the primary loading bottleneck.

## Local Commands

Run these from `cocos-client`:

```powershell
$env:COCOS_CREATOR_PATH='D:\CocosCreator\3.8.8\CocosCreator.exe'
$env:DOUYIN_APPID='tt-your-real-appid'
$env:DOUYIN_REMOTE_SERVER='https://your-cdn.example.com/void-trial/'
npm.cmd run build:douyin
npm.cmd run report:resources
npm.cmd run check:douyin
```

`build:douyin` writes `temp/douyin-build-config.json` and calls Cocos Creator with `configPath=...`, so the generated upload package should land in `build/bytedance-mini-game`.

Expected result before Douyin build: `check:douyin` fails and lists missing build files plus missing AppID.

Expected result before upload: `check:douyin` passes with no blockers.

## Release Path

1. Configure Cocos Creator 3.8.8 to build the Douyin mini-game target.
2. Enter the real AppID from the Douyin developer platform.
3. Build to `build/bytedance-mini-game`.
4. Run `npm.cmd run check:douyin`.
5. If package size fails, move non-critical resources to remote loading or split packages.
6. Open `build/bytedance-mini-game` in Douyin Developer Tools.
7. Test login, save flow, audio unlock behavior, touch input, safe-area layout, and first-stage combat on device.
8. Upload a test build, verify it through platform preview, then prepare the review submission.

## Current Decision

Do not upload the current web build. The next milestone is a valid Douyin mini-game build plus package-size remediation.
