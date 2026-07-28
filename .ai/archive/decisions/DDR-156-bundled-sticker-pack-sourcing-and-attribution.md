# DDR-156: Bundled whiteboard sticker packs — sourcing, licensing, and rasterization

- **Date:** 2026-07-09
- **Status:** Accepted (implemented — `feature-whiteboard-annotation-improvements.md`)
- **Tags:** whiteboard, stickers, licensing, attribution, assets, npm-tarball, playwright, rasterization
- **Related:** [DDR-151](./DDR-151-whiteboard-ai-toolkit-geometry-manifest-and-element-context.md) (the whiteboard toolkit's `ImageStroke` this reuses unchanged), [DDR-045](./DDR-045-real-disk-path-resolution-for-compiled-dev-server.md) (real-disk-path rule `STICKERS_DIR` follows), [DDR-044](./DDR-044-marketplace-install-vs-npm-install-artifact-strategy.md) (npm tarball `files` minimalism this stays inside — no new entry needed). Plan: [`feature-whiteboard-annotation-improvements.md`](../plans/feature-whiteboard-annotation-improvements.md).

## Context

The user wanted a FigJam-style searchable sticker picker with a "fun/crazy" character — explicitly **not** an emoji set (ruled out generic emoji packs like OpenMoji mid-conversation). Four community Figma sticker packs were identified and manually exported by the user (Figma Community `.fig` files aren't fetchable programmatically — auth-gated, 403): Project status stickers (Iconfinder), Life Style Stickers (Pelin ŞENOĞLU), FigJam Doodle Stickers (CJ Xue), Opposing Thoughts Stickers (Erik Leib). Delivered as 140 source files split across SVG (3 packs) and PNG (1 pack), with two packs using non-descriptive filenames (`Group 108.svg`, `slice6.png`).

## Decision

### 1. Attribution-with-permission over CC0-only, since the user explicitly accepted the obligation

Every pack requires attribution (author name + a link back to the source Figma Community page) rather than being CC0/public-domain. This was a conscious trade-off the user made explicitly ("nevadi mi attribution pridat") in exchange for packs with the right creative character — the alternative (CC0-only sets) skewed either generic/emoji-like or too sparse for a genuinely fun/crazy picker. The attribution is discharged via a per-pack section header (pack name + author) and a footer listing every pack + a link to its source, always visible in the picker regardless of search filter.

### 2. Every sticker ships as PNG, regardless of source format — no format-based trust exception

3 of the 4 delivered packs are SVG; the 4th is already PNG. All four are rasterized to PNG at build time (`scripts/build-stickers.mjs`) rather than shipping the SVGs as-is. This was **not** a quality/fidelity call — it's a security boundary: the existing `/_api/asset` upload sniffer (`api.ts`) accepts only png/jpg/gif/webp by design, and that endpoint is reachable from the untrusted canvas origin (DDR-054). Loosening the sniffer to accept SVG — even "just for these 4 curated packs" — would widen what an in-canvas actor could plant for every future upload, a permanent blast-radius increase in exchange for a one-time convenience. Rasterizing once at build time keeps every sticker, regardless of pack, flowing through the exact same `createImageFromFile` → `/_api/asset` path as any other dropped image, with zero new trust surface added anywhere in the runtime.

### 3. Rasterization via the existing `playwright` devDependency — zero new dependencies

`playwright` is already a devDependency of `apps/studio` (the fallback rendering engine behind `screenshot.sh`/`canvas-rects.sh` when `agent-browser` is unavailable). `scripts/build-stickers.mjs` reuses it: navigate to a minimal HTML page wrapping each source SVG/PNG, screenshot the wrapper element at 2× device scale with a transparent background. *Rejected:* adding `sharp` or `resvg` — either would be a new dependency solely for a one-shot asset-prep script that isn't part of the shipped runtime at all; reusing an already-present tool is strictly better. One real bug surfaced and was fixed during this build: the first rasterization pass used CSS `max-width/max-height` to fit each source graphic into the target canvas, which only caps growth relative to a source SVG's own (often tiny, e.g. 27×23) intrinsic pixel size — every sticker rendered as a tiny icon adrift in a mostly-empty square. Fixed by forcing `width:100%; height:100%` on the wrapped content instead, letting each SVG's own `viewBox` + default `preserveAspectRatio="xMidYMid meet"` scale it up to fill the box correctly.

### 4. Keyword curation: filename-derived where the source is descriptive, hand-curated via a contact sheet otherwise

Two packs (Life Style, Opposing Thoughts) ship with self-descriptive filenames (`HOT!.svg`, `Keep Exploring.svg`) — their search keywords are derived programmatically from the filename slug. The other two (`figjam-doodle`'s `slice1..24`, `project-status`'s `Group NNN.svg`) carry no semantic filename information at all. Rather than ship these unsearchable (defeating the point of a searchable picker) or guess blindly, `scripts/build-stickers.mjs --contact-sheets` generates one visual grid image per pack (every rasterized sticker + its filename, labeled), which was read and used to hand-author keywords per file in `scripts/write-sticker-manifests.mjs`. This is a one-time authoring cost paid once at build time, not a runtime dependency — a future re-run of the build script against the same source files reuses the same hand-authored keyword table.

### 5. OpenMoji (the originally-planned "base" layer) is deferred, not shipped

The plan's original sticker-sourcing section named OpenMoji as a base/volume layer underneath the curated packs. This is intentionally **not** implemented: the user's explicit ask was funny/crazy stickers over emoji, and the 4 delivered packs (139 stickers after rasterization) already constitute a complete, searchable V1 without it. Adding OpenMoji later is a pure addition (drop a new pack directory + manifest.json under `apps/studio/stickers/`) — the picker's pack-discovery is already generic over however many pack directories exist, so this isn't a rejected option so much as a correctly-deferred one with no architectural cost to adding it later.

### 6. No `package.json` `files` change needed

`apps/studio/stickers/**` ships automatically via the existing whole-directory `"apps/studio"` entry in `files` (DDR-044's minimal-tarball posture already covers subdirectories added later, as long as they live under an already-included top-level directory) — confirmed no `.npmignore` exclusion pattern would catch PNG/JSON assets under this path.

## Consequences

- The npm tarball grows by the rasterized-pack size (a few MB of PNGs) — accepted as proportionate to the feature; no further curation pass was applied since the total (9.4 MB source, smaller after PNG rasterization/compression) is well within what DDR-044's "minimal but not austere" tarball posture already tolerates.
- Attribution is a **product commitment**, not just a code comment: the pack name/author/source-link must keep rendering in the picker's footer for as long as these packs ship. Removing a pack means removing both its `apps/studio/stickers/<slug>/` directory AND any attribution list entry that assumes its presence.
- A future contributor adding a 5th pack should follow the same shape: a `manifest.json` with `name`/`author`/`attributionUrl`/`license`/`stickers[]`, PNG-only content (the upload-lane security boundary in Decision 2 applies to every future pack the same way, not just these four).
