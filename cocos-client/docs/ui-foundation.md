# Cocos UI Foundation

This foundation defines the shared visual and asset contract for the Cocos UI. It does not change `MainBattle.scene`, runtime layout, or gameplay controllers.

## Source of truth

- Design canvas: portrait `750 × 1334`, matching `assets/Data/scene-blueprint.json`.
- Resolution behavior: retain the current `FIXED_WIDTH` policy and existing viewport layout calculations.
- Safe area: consume the current `ViewportMetrics` / `BattleLayout` insets. A component must not calculate device cutouts independently.
- Visual source of truth: `assets/UI/Theme/ui-tokens.json`. Runtime TypeScript is generated from this file; do not hand-edit the generated projection.
- Figma component key and Cocos asset path must follow the mapping below.

## Asset map

| Component | Cocos asset | Status |
| --- | --- | --- |
| Primary button | `assets/UI/Prefabs/Atoms/PrimaryButton.prefab` | Gallery prefab |
| Panel frame | `assets/UI/Prefabs/Atoms/PanelFrame.prefab` | Gallery prefab |
| Title bar | `assets/UI/Prefabs/Atoms/TitleBar.prefab` | Gallery prefab |
| Resource chip | `assets/UI/Prefabs/Atoms/ResourceChip.prefab` | Gallery prefab |
| Progress bar | `assets/UI/Prefabs/Atoms/ProgressBar.prefab` | Gallery prefab |
| Quality frame | `assets/UI/Prefabs/Atoms/QualityFrame.prefab` | Gallery prefab |
| Navigation item | `assets/UI/Prefabs/Molecules/NavItem.prefab` | Gallery prefab |
| Secondary/icon buttons, hero/boss status, stage/reward cards | Not created | Reserved for later approved slices |

## Prefab contract

- A prefab owns reusable visual nodes and serialized component references. Page or battle controllers own data, timing, and actions.
- Controllers bind to named child nodes and keep their current public behavior when a graybox view is replaced.
- Repeated content is one prefab plus bound data, arranged with `Layout` or `ScrollView`; do not copy numbered node trees for each entry.
- Prefab roots use the component name in PascalCase. Children use stable semantic names such as `TitleLabel`, `Icon`, `ValueLabel`, and `ProgressFill`.
- Do not encode runtime state in node names. Expose state through controller properties or explicit child nodes.
- Colors, spacing, radii, type sizes, component dimensions, and quality colors come from `ui-tokens.json` rather than page-local literals. Run `npm run generate:ui-foundation` after changing tokens to regenerate the runtime projection, prefabs, and showcase scene.
- Use `Widget` for anchoring and `Layout` for repeated rows or grids. Keep interactive hit areas at least the tokenized minimum size.
- Use Cocos `Label`, `Button`, `ProgressBar`, and `Mask` components for standard controls. `Graphics` skin drawing is centralized in the shared UI factory; page controllers must not draw their own button or card skins.
- Put reusable artwork under `assets/UI/Common`. Prefer atlased sprites for small UI pieces; keep large illustrations and battle art in their existing content asset domains.

## Safe area and adaptation

- Keep the design canvas at `750 × 1334` and preserve the existing `FIXED_WIDTH` policy until a separately reviewed layout migration.
- Apply safe-area insets from the established viewport metrics at the page root. Do not bake a particular phone notch or browser chrome into prefab coordinates.
- Anchor top HUD content below the top inset and bottom navigation above the bottom inset.
- Keep decorative backgrounds full bleed; constrain text, buttons, and close controls to the safe content rect.
- Recompute page bounds after canvas resize using the existing layout authority. Prefabs must not listen to browser resize independently.
- Validate narrow and tall aspect ratios, including 390 × 844 CSS pixels, against the same runtime layout path.

## Naming and source workflow

- Figma pages use `UI/<domain>`; components use `UI/<domain>/<Component>`; variants use explicit properties such as `size`, `state`, and `quality`.
- Cocos prefab files use PascalCase component names and `.prefab`; scripts use the matching `<Component>Controller.ts` convention.
- Runtime image files use descriptive lowercase kebab-case names. Avoid names such as `final2`, `new`, or `copy`.
- Export only approved raster assets into `assets/UI/Common/Sprites` or `assets/UI/Common/Atlases`, with source files and licensing recorded in the asset handoff.
- A design change is approved before it replaces an existing player-facing screen. Implementation must preserve the current controller contract unless that contract is explicitly changed.

## Delivery boundary

This is the UI Foundation and runtime Gallery slice. Battle HUD, stage-clear, stage selection, and dungeon pages remain untouched until their individual slices are approved.

## Component gallery

- `UIShowcase.scene` contains a `Canvas` (`cc.Canvas`, the 2D render root) with a full-screen `Widget`; `UIShowcaseRoot` is its child. Open the scene in Creator 3.8.8 and run Preview to inspect the runtime component gallery.
- `assets/UI/Scripts/CultivationUiFactory.ts` is the shared visual factory used by the gallery. Button, panel, progress, quality, resource-chip, and navigation skins belong here; page controllers should bind data and actions rather than draw their own copies.
- `UIShowcase.scene` is a design review scene and is not added to the production build scene list.
- The seven listed controls are serialized `.prefab` assets used by this runtime gallery. Battle HUD and production-page migration are not part of this slice.
