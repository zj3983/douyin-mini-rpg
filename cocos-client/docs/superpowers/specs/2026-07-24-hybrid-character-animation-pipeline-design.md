# Hybrid Character Animation Pipeline Design

## Goal

Build a repeatable production pipeline for clear, fluid, cultivation-themed character and monster animation in the existing Cocos Creator 3.8.8 client. The first vertical slice delivers a Qinglan sword cultivator sample and a moss wolf sample without replacing the current combat, atlas, or asset-catalog architecture.

## Scope

The first phase covers:

- Qinglan sword cultivator actions: `idle`, `sword_ride`, `hand_seal`, `cast`, `hurt`, and `death`.
- Moss wolf actions: `idle`, `move`, `telegraph`, `attack`, `hurt`, and `death`.
- A deterministic source-manifest, frame-validation, atlas-packing, and Cocos-manifest export pipeline.
- Animation event metadata for cast release, attack activation, recovery, and completion.
- Runtime integration through the existing `AtlasAnimator` and `animation-atlas.json` contracts.
- Automated structural, visual-quality, and resource-budget checks.

The first phase does not include all playable characters, all monsters, a Spine editor license, online generation credentials, or automatic cloud billing. It establishes the production contract those later assets will use.

## Production Strategy

### Important characters and bosses

Important characters use layered 2D source art and authored key poses. Hair, rear hair, torso, front and rear sleeves, hands, robe panels, sash, and flying sword remain separate source layers. The runtime output for phase one remains a compact PNG atlas so the current game can consume it immediately. The source contract keeps the layers suitable for a later Spine export without requiring Spine to complete the first slice.

The sword cultivator must read as a cultivator rather than a running humanoid:

- Locomotion is a stable flying-sword glide with restrained body translation.
- Casting uses arm, wrist, and sleeve motion around an integrated hand-seal pose.
- Cloth and hair use delayed secondary motion, not whole-body wobble.
- The flying sword is a separate layer and may be hidden during projectile release.
- Attack timing comes from metadata, not visual guesses in combat code.

### Ordinary monsters

Ordinary monsters use a pose-driven video source when available. A curated motion reference defines the actual species motion: quadruped gait for the moss wolf and wing beats for flying monsters. The source video is sampled into key frames, background-removed, normalized to a stable ground contact and scale, visually validated, and packed into the same runtime atlas format.

Wan2.2-Animate, Grok, Runway, or another generator may produce the source video. Provider choice stays outside the deterministic pipeline so generated videos can be replaced without changing game code. Local generation is not required because the available RTX 5060 has 8 GB VRAM and cannot reasonably run Wan2.2-Animate-14B.

### Skills and projectiles

Character body animation and skill effects remain separate assets. `hand_seal` and `cast` express the performer motion; flying swords, lightning, formations, projectiles, trails, and impacts retain independent animation and gameplay ownership. This allows artifact evolution to change count, size, path, and coverage without regenerating the character.

## Source Contract

Each actor has a source manifest containing:

- Stable actor id and actor type.
- Master and runtime frame dimensions.
- Ground or flight anchor.
- Required actions, frame count range, frame rate, and loop behavior.
- Per-action source mode: `layered-keyframes`, `pose-video`, or `frame-sequence`.
- Event markers expressed as normalized action time in the range `0..1`.
- Quality thresholds for visible bounds, alpha coverage, frame-to-frame center drift, scale drift, and edge contact.

Source files live outside runtime resources. Generated runtime atlases and manifests live under the existing `assets/resources/Assets/ActorAtlases` and `assets/resources/Data` paths.

## Deterministic Processing

The processor performs these stages in order:

1. Validate the source manifest and required action folders.
2. Decode input frames as RGBA images.
3. Remove a chroma background or consume already-transparent frames.
4. Detect visible bounds and reject empty, cropped, or edge-touching frames.
5. Normalize scale and position against the actor anchor without stretching anatomy.
6. Sample only approved source frames; optical interpolation is disabled for hands, swords, wings, and attack silhouettes.
7. Resize to runtime cell dimensions with high-quality downsampling.
8. Pack one atlas per action for incremental loading and smaller replacement scope.
9. Emit `animation-atlas.json` data plus a production report containing frame metrics and warnings.

The generated atlas must never be hand-edited. Corrections happen in source frames or manifest parameters and the atlas is rebuilt.

## Runtime Integration

`AnimationAtlas` gains optional event markers while retaining backward compatibility with existing entries. `AtlasAnimator` reports marker crossings and non-looping action completion without owning combat decisions. Combat presenters map those events to existing sword launch, hitbox, sound, and recovery commands.

The atlas animator continues to use pooled `SpriteFrame` objects and distance-based update throttling. Each action texture is loaded only when requested. The first phase does not introduce GIF, animated WebP, SVG, or per-frame standalone runtime textures.

## Mobile Resource Budget

- Standard actor runtime cell: `256x320` maximum.
- Boss runtime cell: `384x480` maximum.
- Ordinary action: 6 to 12 approved frames.
- No runtime animation texture larger than `2048x2048`.
- Transparent padding is minimized while preserving a stable action cell.
- Source masters may be larger but never ship in the mini-game package.
- Reports fail the build on oversize textures, excessive edge contact, missing actions, or invalid event markers.

## Error Handling

Processing fails with an actionable actor/action/frame path when:

- A required action or frame is missing.
- A frame cannot be decoded.
- The visible subject is empty or clipped.
- Frame dimensions or event markers violate the manifest.
- Output would exceed the texture budget.

Quality drift that may require visual judgment is emitted as a warning and contact sheet. No failed or warning-bearing run silently overwrites an approved production atlas.

## Verification

Automated tests cover manifest validation, visible-bound detection, anchor normalization, frame sampling, event crossing, atlas geometry, and budget rejection. A generated contact sheet covers every action. The Cocos readiness checks verify that every catalog actor and combat action resolves to a manifest entry and runtime PNG.

The final acceptance pass runs the web-mobile build and tests the first battle at phone and landscape browser sizes. Acceptance requires:

- The sword cultivator remains fully visible and glides without body jitter.
- Hand-seal and cast events occur once at the authored frame.
- The moss wolf keeps four connected limbs, faces its movement direction, and uses visibly different move, telegraph, attack, hurt, and death silhouettes.
- Actor atlases remain sharp at gameplay scale and do not cause a measurable skill-cast hitch.

## Delivery Sequence

1. Add the production manifest schema, validator, metrics, and tests.
2. Add deterministic normalization, packing, reports, and tests.
3. Extend runtime metadata with animation events and tests.
4. Produce and integrate the Qinglan sample.
5. Produce and integrate the moss wolf sample from an approved source sequence or pose-driven clip.
6. Run visual, performance, build, and mini-game resource checks.

