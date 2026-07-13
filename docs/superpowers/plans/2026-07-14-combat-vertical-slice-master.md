# Combat Vertical Slice Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild world stage 1 into a clear, responsive, 90-second portrait side-view xianxia combat slice that establishes the production standard for later stages.

**Architecture:** A pure TypeScript combat domain under `assets/Scripts/Combat` owns all authoritative state and is imported directly by both Node tests and Cocos adapters. Cocos components render domain events, bind input, pool nodes, stream stage resources, and never change combat rules. Art uses canonical 4:5 masters and controlled runtime packs; feedback, audio, performance, and mobile release checks are layered on only after the greybox loop passes.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, Node test runner, Python 3.11 with Pillow, OpenAI image generation, Playwright, existing Vite account shell and deployment workflow.

---

## Execution Order

1. Execute `2026-07-14-combat-vertical-slice-m1-core.md` and require a complete greybox stage.
2. Execute `2026-07-14-combat-vertical-slice-m2-actors.md` and require four complete actors with no crop, stretch, or fake body-part motion.
3. Execute `2026-07-14-combat-vertical-slice-m3-m5-release.md` and require final feedback, original xianxia audio, performance, mobile Agent, build, and deployment checks.

Do not begin a later plan while the previous plan has red tests or an unresolved mobile blocker.

## Locked File Boundaries

- `cocos-client/assets/Scripts/Combat/**`: pure deterministic TypeScript; no imports from `cc`.
- `cocos-client/assets/Scripts/Game/**`: Cocos adapters and presentation only.
- `cocos-client/assets/Data/stage-one-combat.json`: authoritative first-stage tuning.
- `cocos-client/assets/Data/vertical-slice-animation-sources.json`: authoritative action/frame contract.
- `cocos-client/assets/resources/Assets/ActorAtlases/**`: generated runtime atlases.
- `cocos-client/assets/resources/Audio/**`: generated original WAV assets.
- `cocos-client/tests/**`: domain, contract, integration, performance, and source-structure tests.
- `scripts/game-agent*.mjs`: browser/mobile playtest and structured report generation.

## Cross-Cutting Rules

- New combat modules are imported directly from `.ts` in Node tests. Do not create new hand-maintained `.mjs` mirrors.
- All gameplay randomness flows through an injected seeded random source.
- Combat state changes emit typed events; Cocos components may consume events but may not mutate domain internals.
- Contact overlap never damages the player. Only an attack's active hit frame may resolve damage.
- No ordinary attack and no manual skill button may be introduced.
- Player level affects only attack, health, and mana. Artifact levels and mutations remain separate.
- Every asset load, delayed callback, and pooled node carries a stage generation token.
- Every task ends with focused tests and a small commit before the next task starts.

## Release Gates

- Root tests: `npm.cmd test`, expected `72` or more passing, `0` failing.
- Cocos tests: `npm.cmd test` from `cocos-client`, expected all non-environment tests passing.
- Cocos readiness: `npm.cmd run build:check` from `cocos-client`, expected `PASS`.
- Cocos export verification: `npm.cmd run verify:build-output -- build/web-mobile`, expected `PASS`.
- Mobile viewports: `360x780`, `390x844`, and `430x932` all pass without crop or CSS stretch.
- Runtime: first playable within 6 seconds; P95 frame time at or below 20ms; 18 active enemies maximum.
- Stage: Boss begins near 60 seconds; the stage settles by 90 seconds; button or 3-second timeout advances exactly once.
- Console: zero uncaught errors and zero missing required assets.

## Commit Sequence

Use the commit boundaries defined in each phase plan. Do not squash during implementation because each commit is a review and rollback point. Merge the branch only after the final live URL check passes.

## Explicitly Out of Scope

- No second playable character and no new account, archive, backpack, equipment, gacha, artifact-library, or dungeon page.
- No additional world stage or dungeon-floor expansion beyond proving the existing stage-2 transition.
- No multiplayer, networked combat, or engine migration.
- No public URL change and no second game entry.
