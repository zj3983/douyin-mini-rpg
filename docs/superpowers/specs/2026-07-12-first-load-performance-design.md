# First-load performance design

## Goal

Reduce the mobile cold-start time for the deployed Cocos web build without visibly degrading xianxia artwork, animation atlases, alpha edges, or runtime behavior.

## Evidence

- The deployed web build contains 520 files totaling 56.59 MB.
- The 2.41 MB Cocos engine bundle is served without gzip or Brotli compression.
- Immutable 30-day caching is already enabled for versioned assets.
- Several generated aggregate atlases are 2.2-2.6 MB, while the twelve monster atlases are roughly 0.7-1 MB each.
- Public mobile verification showed a several-second bootstrap interval before the game requested its settings and battle resources.

## Design

### Transfer compression

Enable gzip for JavaScript, JSON, CSS, SVG, text, and WebAssembly responses in the Nginx configuration serving `/game/douyin-mini-rpg/`. Preserve the existing immutable cache policy for versioned build assets. Confirm compression with public response headers and compare encoded byte counts before and after deployment.

### Image optimization

Run deterministic near-lossless optimization on PNG backgrounds and atlases. Preserve dimensions and alpha channels. Monster atlas validation remains authoritative: every actor stays 1024x1280, every frame remains on the 256 grid, transparent margins stay at or above 8%, consecutive animation frames remain distinct, and isolated fragments remain forbidden.

Use conservative settings and keep a source asset unchanged when the optimized result either grows, loses alpha, changes dimensions, or fails the visual and pixel contract. Target a 30-60 percent reduction where the image content permits it; do not force the target at the expense of visible quality.

### Loading order

Keep the initial scene limited to the active character, stage-one background layers, stage-one monsters, the innate skill, and required UI. Do not preload stage-two through stage-four monster atlases or backgrounds at startup. Begin prefetching the next stage after the current stage is interactive, and release the previous stage using the existing stage-background and resource lifecycle.

### Failure handling

If a prefetched asset fails, retain the current stage and retry through the existing resource loader when the next stage is requested. Missing optional prefetched content must not block the current battle. A missing required stage asset continues to use the existing safe fallback behavior.

## Verification

- Root tests: 64 passing.
- Cocos tests: 200 passing, one environment-dependent skip, zero failures.
- Build output verification passes.
- PNG dimensions, alpha, frame counts, margins, distinct frames, and fragment checks pass after optimization.
- Public headers prove compressed text transfer and unchanged immutable caching.
- A 390x844 public mobile run has a nonblank canvas, no console errors, correct aspect ratio, and complete character and monster sprites.
- Record before/after build size, largest files, public transfer headers, and time to the first interactive battle frame.

## Out of scope

- Repainting or redesigning existing artwork.
- Changing combat balance, stage flow, account services, or gameplay rules.
- Replacing Cocos Creator or changing the deployment URL.
