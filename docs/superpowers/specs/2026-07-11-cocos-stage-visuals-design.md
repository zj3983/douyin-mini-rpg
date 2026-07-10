# Cocos Multi-Stage Visual Design

## Goal

Replace the legacy black-backed stage-two-to-four art with distinct xianxia environments and transparent animated monsters while keeping the portrait survivor battle fast on mobile.

## Stage Identity

| Stage | Environment | Ground Enemy | Flying Enemy | Boss |
| --- | --- | --- | --- | --- |
| 1 | Rainy moss bamboo hills | Moss wolf | Green-wing moth | Bamboo warden |
| 2 | Lantern-lit fog forest | Fog spider | Lantern wraith | Mist deer king |
| 3 | Red flame ravine | Lava lizard | Ember crow | Flame ogre |
| 4 | Fallen-star ancient road | Star-armored beast | Void-wing spirit | Meteor guardian |

Stages two through four use the existing approved backgrounds in `public/assets/generated`: `world-mist-forest.webp`, `world-blood-rift.webp`, and `world-star-sea.webp`. They are copied into Cocos resources and never loaded from the old Vite tree at runtime.

## Monster Atlases

Each monster receives one transparent 1920x512 PNG containing six 320x512 cells: idle, move A, move B, attack/cast, hurt, and death. The actor silhouette, scale, facing direction, ground line, lighting, and camera remain stable across every cell. Flying actors animate their existing wings; grounded actors animate their existing legs. No extra limbs, rings, UI marks, text, card frames, or opaque panels are allowed.

All cells keep transparent gutters and share a stable bottom alignment. The existing animation manifest keeps the same action names and frame rectangles so `AtlasAnimator` remains the only playback path.

## Runtime Switching

A focused `StageVisualCatalog` maps stage theme/background ids to Cocos resource paths. `PortraitBattleBootstrap` owns the far background sprites and asks `BattleRuntimeController` for a stage-change event. On stage transition it loads the next background, swaps only after success, and releases the previous stage texture after the new texture is visible.

Monster nodes stay pooled. When reused, the node changes `actorId`; `AtlasAnimator` resolves the matching transparent atlas. The current stage and next stage may be preloaded, but older stage textures must be released so memory does not grow after repeated transitions.

## Failure Behavior

If a stage background fails to load, keep the last valid background and show one non-repeating load warning. If an actor atlas fails, do not display an opaque legacy fallback; use the matching stage-one transparent role as a temporary fallback and record the missing actor id once.

## Acceptance

- Stages one through four have visibly different backgrounds.
- All nine new actors render without rectangular backgrounds.
- Ground/flying/Boss actions use their own body parts and preserve alignment.
- Crossing stages does not retain soul or enemy nodes from the prior stage.
- At 390x844 and 430x932, no HUD overlap or canvas stretching occurs.
- An 18-enemy skill cast remains at least 50 FPS in desktop mobile emulation.

