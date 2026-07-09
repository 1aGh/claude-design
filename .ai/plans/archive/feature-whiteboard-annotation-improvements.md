# Feature: Whiteboard / annotation improvements

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. The FigJam-style draw layer lives in the SVG-annotation world — data model + serializer in `apps/studio/annotations-model.ts`, interaction in `apps/studio/annotations-layer.tsx`, plus the CLI verbs `apps/studio/bin/{annotate,read-annotations}.mjs`.

## Description

A batch of quality-of-life + delight improvements to the Maude whiteboard (feature-whiteboard-ai-toolkit, DDR-151): fix the shape text-edit vertical "jump", auto-focus text on object create, proportional bulk resize for multi-select, show the author on sticky notes, a searchable FigJam-style **sticker picker** (OpenMoji base + attributed Figma packs + a Maude-drawn fun pack), smarter `/design:board` generation, and an optional Tenor GIF search. All improvements are additive and individually shippable.

## User Story

As a whiteboard user I want faster, more delightful sketching — text that lands where I type it, one gesture to scale a group, authored stickies, fun stickers, and boards I can generate by asking — so that the whiteboard feels as fluid as FigJam.

## Problem

- Editing text in a shape shows the caret at the **top**, then jumps to **center** on the first keystroke (jarring; Images #3/#4).
- Creating a shape doesn't focus its text editor — every shape needs a manual double-click (stickies already auto-focus).
- Multi-selecting elements shows a decorative bounding box with **dead** corner handles — no group resize (Image #1).
- Sticky notes carry no author — in branch-scoped multiplayer you can't tell who wrote what (Image #2).
- `/design:board` generation is under-specified: presets are bare empty columns; a request like "vytvoř mi team sprint retro" gets three blank columns, and the ACP chat doesn't advertise the board/whiteboard capability.
- No quick way to drop fun stickers; no GIF search.

## Solution

Six phases (5 core + 1 optional) against the existing annotation model, reusing its single canonical serializer, the existing content-addressed asset lane, the existing presence identity, and the existing ACP bootstrap-brief + session-plugin auto-load. Plus an appendix of delight extras.

## Metadata

- **Type**: Enhancement (+ one bug fix)
- **Complexity**: High (spans annotations runtime, model/serializer, CLI verbs, ACP brief, a new picker UI, a new bundled asset set)
- **App/Package**: `apps/studio` (dev-server + client) and `plugins/design` (board command + whiteboard skill)
- **Affected Systems**: annotations layer, annotation serializer, presence/collab, asset store, ACP bridge/brief, `/design:board`, npm `files` surface, `.gitignore` runtime taxonomy (assets)
- **Dependencies**: (client) `emojibase-data` optional for OpenMoji keyword search — OpenMoji ships its own `openmoji.json`; (Phase 6 only) a server-side Tenor proxy + user-supplied Tenor API key. No new runtime deps for phases 1–3.

---

## Context References

### Must-Read Files

> During `/flow:execute`, read these in parallel (one message, multiple Read calls) — independent context loads.

- `apps/studio/annotations-layer.tsx` (4875 lines — the interaction layer). Key regions:
  - `3326-3466` `TextEditor` (shape/anchored text editor — **the jump bug**), style block `3406-3437`.
  - `3469-3565` `StickyEditor` (top-left aligned; no jump — the reference for the fix). Focus+select-all on mount `3512-3527`.
  - `4282-4302` read-only anchored `<text>` (centered; **not hidden during edit** — secondary jump contributor).
  - `4319-4356` sticky read render; `stickyBodyStyle` `4057-4067`; `.dc-sticky-body` CSS `551-566`.
  - `1521-1527` / `1579-1584` draw-commit → `annotSel.replace` + sticky-only `setEditingId` (**auto-focus hook**).
  - `1139-1186` `createImageFromFile` (**sticker drop insertion point**); `resolveAssetHref` `385`; intake `useCanvasMediaDrop` `168`,`1254-1257`.
  - `3978-4051` `AnnotGroupBbox` (decorative multi-select box, `pointerEvents="none"` — **group-resize hook**); hull drag math `1862-1895`.
  - `838` `useCollab()` already in scope (`myName`/`myColor`/`myConnId` for author stamp).
- `apps/studio/annotations-model.ts`:
  - `203-226` `StickyStroke`; `105-118` `RectStroke`; `172-201` `TextStroke` (anchored via `anchorId`); `235-244` `ImageStroke`.
  - `913-937` `rootExtraAttrs` (**single serializer seam** — `data-author="ai"` today at `928`; add author fields here); `injectRootAttrs` `946-952`.
  - `1007-1035` sticky serialize; `1305-1320` `readSharedAttrs` (parse); `1352-1387` sticky deserialize.
  - `78-81` `StrokeBase.author` (currently `'ai'` literal — widen).
- `apps/studio/use-annotation-resize.tsx`: `230-304` `bboxResize`; `311-333` `bboxResizeRotAware`; single-only gate `580`, null-return `911-914` (**relax for group**).
- `apps/studio/use-annotation-selection.tsx`: `23-30` selection value (`selectedIds[]`), state `46`.
- `apps/studio/bin/annotate.mjs`: `443-462` `createSticky` (`author:'ai'` at `458`); `882-1061` `boardToOps` (`937-971` columns, `978-1012` radial); caps `907-918`.
- `apps/studio/bin/read-annotations.mjs`: `398-412` `withShared` (mirror author parse `405`); `213` `readSection`; `107`/`394-395` `z`=document order; `569-594` smallest-containing-rect resolver (annotation→element — **model for annotation→section membership**); `361-362` image/media pass-through with href; `_canvas-rects-static.mjs` static lane must match.
- `apps/studio/api.ts`: `1330-1459` `saveAssetFromStream`; magic-byte sniff `617` (**png/jpg/gif/webp only — SVG rejected**); `1481-1512` `listAssets`; caps `475`,`590`.
- `apps/studio/http.ts`: `2045-2079` `POST /_api/asset`; CSP `120-139` (`img-src 'self' data: blob:`, `connect-src 'self'`); static `/assets/` serve `2336-2385`; canvas-origin gate `2515-2522`; `CANVAS_SAFE_API` `2461`.
- `apps/studio/acp/bootstrap-brief.ts`: `75-93` `buildStudioBrief`; command list `83-84` (**add board/whiteboard here**); safeFact `49-72`.
- `apps/studio/acp/index.ts` `152-160` brief construction; `apps/studio/acp/plugin-bootstrap.ts` `107-115` (design plugin auto-load → whiteboard skill + board cmd already in the ACP catalogue).
- `plugins/design/skills/whiteboard/SKILL.md`: `98-116` `--board` mode; `118-174` **Preset fixtures** (retro `120-128`, kanban `130-137`, calendar `139-147`, roadmap `149-155`, brainstorm `157-161`, checklist `163-166`, flow `168-174`).
- `plugins/design/commands/board.md`: `12` free-text intent; `47-52` intent branch (template match `51`).
- `apps/studio/client/app.jsx` `844-963` `AssetPicker` (modal/grid/upload — **UI reference for the sticker picker**, but no search).

### Files to Create

- `apps/studio/stickers/<pack-slug>/manifest.json` — per-pack `{ name, author, license, attributionUrl, stickers:[{file, keywords[]}] }`.
- `apps/studio/stickers/<pack-slug>/*.png` — bundled sticker art (user-supplied for the Figma packs; scripted for OpenMoji).
- `apps/studio/stickers/index.ts` (or `.json`) — merged catalogue served to the picker.
- `apps/studio/client/panels/StickerPicker.jsx` (+ CSS) — searchable grid, grouped by pack, attribution footer.
- `apps/studio/http.ts` route `GET /_api/stickers` — serve the merged catalogue (main-origin) + static serve of the bundled PNGs.
- `scripts/build-openmoji-stickers.mjs` — one-shot: curate an OpenMoji subset + emit `manifest.json` from `openmoji.json` keywords.
- (Phase 6) `apps/studio/tenor.ts` + `GET /_api/tenor/search` proxy.

### Design canvases

None — the whiteboard is a working surface, not shipped UI, so there are no `.design/` canvases to ground against. The **reference aesthetic** is the four attributed Figma sticker packs (see § Sticker sourcing) + OpenMoji's hand-drawn look.

---

## Design Decisions

### Sticker sourcing (item 6)

- **Base set: OpenMoji** — CC-BY-SA 4.0 (attribution + share-alike, both acceptable). ~4000 hand-drawn glyphs, ships `openmoji.json` with tags/keywords → search for free. Use the **PNG** release (passes the `/_api/asset` sniffer, renders through the existing image lane). Curate a subset to keep the tarball small.
- **Attributed packs — DELIVERED 2026-07-09**, exported by the user into `/Users/iagh/Downloads/Stickers/` (source of truth for the scaffold script's input, NOT committed as-is — see rasterization note below):
  - Project status stickers (Iconfinder) — https://www.figma.com/community/file/1128224635870836270 — `Project status stickers (Community) - Iconfinder/` — **80 files, SVG**, 1.2 MB
  - Life Style Stickers (Pelin ŞENOĞLU — pelinsenogluisik@gmail.com) — https://www.figma.com/community/file/1228731654126072640 — `Life Style Stickers (Community) - Pelin ŞENOĞLU/` — **15 files, SVG**, 1.8 MB
  - FigJam Doodle Stickers (CJ Xue — kinomuto05@gmail.com) — https://www.figma.com/community/file/1301623299668462371 — `FigJam Doodle Stickers - CJ Xue/` — **25 files, PNG** (868×867), 5.6 MB
  - Opposing Thoughts Stickers (Erik Leib — instagram.com/esl90) — https://www.figma.com/community/file/1130195021486928915 — `Opposing Thoughts Stickers - Erik Leib/` — **20 files, SVG**, 756 KB
  - **Base:** OpenMoji PNG release — https://openmoji.org / https://github.com/hfg-gmuend/openmoji (releases carry `openmoji.json` keyword metadata).
  - Total across the 4 attributed packs: **140 stickers, 9.4 MB source** — small enough to bundle without further curation.
- **Format finding (changes the scaffold, not the architecture):** 3 of the 4 delivered packs are **SVG** (plain `<path>`/`<g>` markup, no `<script>`, no external refs in a spot-check), not PNG as originally assumed. The `/_api/asset` upload sniffer (`api.ts:617`) only accepts png/jpg/gif/webp — **loosening it to accept SVG is explicitly out of scope** (that endpoint is reachable from the untrusted canvas origin per `CANVAS_SAFE_API`; widening what it accepts widens what an in-canvas actor could plant, a bigger blast radius than "rasterize 4 curated packs once"). Resolution: **rasterize the 3 SVG packs to PNG once, at scaffold time**, using the project's existing `playwright` devDependency (`apps/studio/package.json` — already used as the `screenshot.sh`/`canvas-rects.sh` fallback engine) — navigate to a `data:image/svg+xml` URL per sticker, screenshot at 2× with a transparent viewport, write PNG. **Zero new dependencies.** The already-PNG pack (FigJam Doodle Stickers) copies through as-is, resized down from 868×867 to a sane sticker-picker size (e.g. max side 256–512px) to cut its 5.6 MB footprint. All four packs end up PNG-only in the shipped bundle, so every sticker — regardless of source pack — flows through the exact same `createImageFromFile` → `POST /_api/asset` path with no new trust surface.
- **Maude-drawn fun/feedback pack** — via the draw geometry engine (DDR-070): `SHIP IT` / `LGTM` stamps, googly eyes, speech bubbles, 🔥, party, "Have you considered?", scribble arrows — the Opposing-Thoughts concept as Maude's own, fully on-brand, no license burden. Phase-able after the bundled sets land.
- **Storage/CSP:** PNG stickers, served same-origin. On pick, feed bytes through the existing `createImageFromFile` → `POST /_api/asset` → `assets/<sha8>.png` path (content-addressed dedupe bounds repo growth; zero new trust surface; works for peers + export).
- **Bundle location:** `apps/studio/stickers/**` must be added to `package.json` `files` (ships via the `@1agh/maude` tarball, not the user's repo). 9.4 MB source (pre-rasterization) is small enough to ship without further curation, per the size finding above.

### Author identity (item 2)

- Stamp a **stable id + display name + re-derivable color**, not a trusted wire color. Reuse the presence identity already in scope in `annotations-layer.tsx` via `useCollab()`: `myName` (git `user.name`, else `anonymous-<connId6>`), `myConnId`, and `colorForName()` (exported from `use-collab.tsx`, djb2→OKLCH). Badge color = `colorForName(authorName)` so it matches the peer's cursor/avatar hue exactly.
- Persist on the sticky root `<g>` via `rootExtraAttrs` (new `data-author-name` / `data-author-id`), so **both** writers (runtime + `annotate.mjs`) get it through the one serializer. Widen `StrokeBase.author` from the `'ai'` literal to `{ kind:'ai'|'human'; name?; id? }` (or add sibling `authorName?`/`authorId?` fields — pick the least-churn shape; keep back-compat: legacy `data-author="ai"` still parses).
- **Privacy note (DDR-worthy):** this writes the local git `user.name` into the **committed** `.annotations.svg`, exposing it to peers/repo history. Acceptable (presence already broadcasts it), but record the decision and consider honoring an opt-out / `anonymous-*` fallback when git user is unset.

### Board generation (item 3)

- The `annotate.mjs` board **engine** needs no change (pure geometry). Gaps are prompt-side: (a) enrich the **Preset fixtures** in `SKILL.md` (sprint-retro framing, seeded prompts, per-column color, action-item owner/date structure, recommended card counts); (b) add an explicit keyword→preset intent map + **non-English trigger examples** (Czech "vytvoř mi…", "uděláš…") to `board.md` §3; (c) advertise `/design:board` + the whiteboard capability in the ACP **bootstrap brief** (`bootstrap-brief.ts:83-84`) so the native chat invokes it without the user naming the skill (the plugin auto-load, DDR-143, already puts it in the catalogue — this just surfaces it).

### Tenor GIF (item 6, optional — Phase 6)

- Server-side proxy `GET /_api/tenor/search` (CSP blocks canvas→tenor.com). Config-gated on a **user-supplied Tenor API key** — feature off without it. On pick: download-first (SSRF-gated, mirror `bin/_fetch-asset.mjs`) → `assets/<sha8>.gif` (GIF is in the sniffer allowlist). **Animation caveat:** SVG `<image>` shows only the first GIF frame in WKWebView — render GIF strokes via `<foreignObject><img></foreignObject>` and verify on the bundled `.app`. Attribution "Powered by Tenor" required; flag GIF repo-bloat (size cap / consider gitignoring GIF assets).

---

## Tasks

Execute by phase; phases are independent and individually shippable. Within a phase, tasks are in dependency order. **Phases 1–2 interact** (auto-focusing shapes opens the `TextEditor`, so fix the jump first).

### Phase 1 — Text-edit jump fix + auto-focus on create (items 4, 5)

#### ✅ Task 1.1: FIX `TextEditor` empty-state vertical jump — completed
- **Do**: In the `TextEditor` foreignObject/div style block (`annotations-layer.tsx:3406-3437`), stop the empty `contentEditable` from parking the caret at the top while `justifyContent:'center'` has no line box. Options to evaluate: (a) render a zero-width placeholder line so a flex line box exists from frame 0; (b) switch the editor to the same top-anchored model `StickyEditor` uses (which has no jump) and match the committed render; (c) set the editor's vertical alignment to whatever the read-only `<text>` uses so read↔edit metrics agree. Prefer the option that makes edit-time position == committed-render position (currently centered via `dominantBaseline="middle"` at `4283-4300`).
- **Do**: Hide the read-only anchored `<text>` (`4282-4302`) while its shape is being edited — add an `editing`-guard mirroring the sticky-body guard at `4344` (prevents the double-paint contributor).
- **Gotcha**: Runs in WKWebView (desktop `.app`) — the empty-flex-caret behavior is WebKit-specific; verify the fix on the bundled app, not only `tauri dev` (memory: native-app verification ceiling).
- **Validate**: Live — double-click an empty rect, caret must appear where typed text will land; type one char, no jump. Repeat for a rect that already has text (no double-paint).

#### ✅ Task 1.2: ADD auto-focus text editor on shape create — completed
- **Do**: Extend the draw-commit branch (`annotations-layer.tsx:1579-1584`) so `rect`/`ellipse`/`polygon` also `setEditingId(committed.id)` (today only sticky does). Confirm the click-to-place path (`1521-1527`) flows through the same commit.
- **Pattern**: Mirror the sticky auto-focus + the chain-create re-enter (`2356-2364`).
- **Gotcha**: Depends on Task 1.1 — without the jump fix this ships the bug to every new shape.
- **Validate**: Create each shape type → editor opens focused, caret centered, typing has no jump.

### Phase 2 — Proportional bulk resize (item 1)

#### ✅ Task 2.1: MAKE the group bounding-box handles live — completed
- **Do**: In `AnnotGroupBbox` (`annotations-layer.tsx:3978-4051`) remove `pointerEvents="none"` from the corner handles and wire pointer-down/move/up. The union-bbox math already exists here (mirrors hull math `1862-1876`).
- **Validate**: Marquee-select ≥2 elements → 4 corner handles are grabbable.

#### ✅ Task 2.2: ADD group scale-about-origin to the resize lane — completed
- **Do**: In `use-annotation-resize.tsx`, relax the single-selection gate (`580`, `911-914`) to a group branch: on a corner drag, scale each selected stroke's position + size about the group-bbox anchor corner (reuse `bboxResize`/`strokeBBox` + `translateOne`). Corner = proportional by default; honor `shift`=aspect-lock and `alt`=about-center like single resize. Commit one undo record for the whole group.
- **Gotcha**: Stickies are forced 1:1 in single-resize (`386`); decide group behavior — proportional group scale should scale sticky font/size uniformly. Anchored text inherits its host's bbox — don't double-scale.
- **Validate**: Select 3 columns (Image #1), drag a corner → all scale proportionally about the anchor; undo restores in one step.

### Phase 3 — Sticky note author (item 2)

#### ✅ Task 3.1: WIDEN the author model + serializer/parser — completed
- **Do**: `annotations-model.ts:78-81` widen `StrokeBase.author` (keep `'ai'` back-compat). Emit `data-author-name`/`data-author-id` in `rootExtraAttrs` (`913-937`, beside line 928); parse them in `readSharedAttrs` (`1305-1320`) and mirror in `bin/read-annotations.mjs:398-412`.
- **Validate**: Round-trip a stamped sticky through serialize→disk→parse; legacy `data-author="ai"` still reads.

#### ✅ Task 3.2: STAMP author on human-drawn stickies + render badge — completed
- **Do**: In the sticky create path (`annotations-layer.tsx` beginStroke sticky branch / commit `1581`) stamp `{ name: collab.myName, id: collab.myConnId }` from the in-scope `useCollab()`. Render a small author badge on the sticky (name/initials), color = `colorForName(name)` (import from `use-collab.tsx`).
- **Decision (not done)**: Left `bin/annotate.mjs` `createSticky`'s `author:'ai'` unchanged — that field is the "this was agent-authored" signal for every downstream consumer (board templates, `/design:board`, the trust model), and the CLI running under a particular git identity doesn't mean a human drew it. Stamping `authorName`/`authorId` stays scoped to the runtime (mouse-drawn) creation path, where a real human gesture is what triggered it.
- **Gotcha**: Never trust a wire/stored color — always re-derive via `colorForName` (matches cursor/avatar). Respect the privacy note — fall back to `anonymous-*` when git user unset; record the DDR.
- **Verified live**: drew a sticky in this repo's own `Smoke TSX` canvas via `agent-browser` against the source dev server; the persisted `.annotations.svg` showed `data-author-name="1aGh" data-author-id="43b2c1bf-…"` on the sticky's `<g>`; running the edited `bin/read-annotations.mjs` directly (not the globally-installed compiled `maude` CLI, which doesn't see local source edits) parsed both fields back out correctly. Test sticky removed afterward via `git checkout` (file back to zero diff against HEAD).
- **Validate**: Draw a sticky → badge shows your git name in your presence hue; a peer sees the same.

### Phase 4 — Searchable sticker picker (item 6)

#### ✅ Task 4.1: SCAFFOLD the bundled sticker store — rasterize the 4 delivered packs — completed (OpenMoji base deferred, see plan note)
- **Do**: Source packs are delivered at `/Users/iagh/Downloads/Stickers/<pack-name>/` (see § Sticker sourcing for the per-pack file counts/formats — 3 SVG packs + 1 PNG pack, 140 stickers / 9.4 MB total). Write `scripts/build-stickers.mjs` (one-shot, Bun): for each of the 4 packs, rasterize SVGs to PNG via `playwright` (data-URL navigate + transparent-viewport screenshot @2×, matching the existing `screenshot.sh` fallback-engine pattern) and downsize the already-PNG pack (FigJam Doodle Stickers, 868×867 → max side ~256–512px); write output to `apps/studio/stickers/<pack-slug>/*.png` + a hand-authored/scripted `manifest.json` per pack (`name`, `author`, `attributionUrl` from the URLs on file, `stickers:[{file, keywords[]}]` — keywords derived from each source filename, e.g. `HOT!.svg`→`["hot"]`, `Group 108.svg`→needs a manual keyword pass since Iconfinder's export names are non-descriptive). Separately, `scripts/build-openmoji-stickers.mjs` curates an OpenMoji PNG subset + writes its `manifest.json` from `openmoji.json` keywords (no rasterization needed, OpenMoji ships PNG already). Add `apps/studio/stickers/**` to `package.json` `files`.
- **Gotcha**: Iconfinder's "Group NNN.svg" filenames carry no semantic info — the keyword pass for that pack needs either a manual per-file naming pass or an agent look at each rendered sticker to assign keywords; don't ship it unsearchable.
- **Validate**: `GET /_api/stickers` returns the merged, pack-grouped catalogue with all 4 attributed packs + OpenMoji populated (not stubs).

#### ✅ Task 4.2: ADD the `/_api/stickers` catalogue route + static serve — completed
- **Do**: `http.ts` — serve the merged catalogue (main-origin only) and static-serve the bundled PNGs same-origin. Resolve the sticker dir from the maude package root via `paths.ts` (DDR-045) — NOT the served project.
- **Validate**: Route returns catalogue; a bundled PNG loads under CSP `img-src 'self'`.

#### ✅ Task 4.3: BUILD the StickerPicker UI — completed
- **Do**: `client/panels/StickerPicker.jsx` — modal grid (reuse `AssetPicker` shell/styles `app.jsx:844-963`) **+ a search bar** filtering on keywords, grouped into per-pack sections (name + author headers), attribution footer. Add a toolbar affordance to open it (media intake is paste/drop-only today — this is the first toolbar button, per the steer at `annotations-layer.tsx:1257`).
- **Do**: On pick → `createImageFromFile(bytes, dropPoint)` (`1139-1186`), reusing the existing upload+ImageStroke path.
- **Validate**: Live — open picker, type "fire", pick a sticker, it lands on the board; sections + attribution render; works in the bundled `.app`.
- **Actual architecture (diverged from the plan text above — recorded for accuracy):** `StickerPicker` does NOT live canvas-side and call `createImageFromFile` directly. `/_api/stickers` (and the static sticker PNG serve) are intentionally **main-origin only** (same DDR-054 posture as `/_api/assets` — verified via `canvas-origin-gate.test.ts`), so a canvas-side fetch of either can't work; DDR-054's split-origin model means canvas-side JS can't reach a main-origin-only route at all. The real flow mirrors the existing `replace-annotation-media` bridge exactly: (1) the tool-palette's Stickers button does `window.parent.postMessage({dgn:'open-sticker-picker'})`; (2) `client/app.jsx` opens `StickerPicker` (mounted main-shell-side, fetches `/_api/stickers` — same-origin there); (3) on pick, the shell fetches the picked sticker's bytes from `/_stickers/<pack>/<file>` (same-origin) and re-uploads them through the existing `/_api/asset` lane (content-addressed, canvas-origin-allowlisted) to get a project-relative path; (4) `postToActiveCanvas({dgn:'insert-sticker', path})` relays that path down; (5) `annotations-layer.tsx`'s existing cross-origin `onMessage` handler (the same one that already handles `replace-annotation-media`) creates the `ImageStroke` directly at a fixed `STICKER_DROP_SIZE=160` positioned at the current viewport center (no cross-origin cursor position to reuse). Confused-deputy gated (`e.source === activeWin`) + a stale-canvas re-check on pick, matching `onAssetPicked`'s existing G3 (DDR-152) pattern.

#### Task 4.4 (optional): Maude-drawn fun/feedback pack
- **Do**: Author ~30–50 on-brand fun stamps via the draw engine (`/design:draw` / draw-agent), export PNG into a `maude-fun` pack with keywords.
- **Validate**: Pack appears as its own section; stamps render crisply at sticker size.

### Phase 5 — Board generation intelligence + section-scoped read context (item 3)

#### ✅ Task 5.0: AUDIT + EXTEND section-membership & reading-order in the read path — completed

> **Why (high-value use case):** a common flow will be — user drops several **media/images into a section**, then says "udělej mi z toho video" or "udělej mi z toho carousel na Instagram". For that the agent must be able to read *which* items live inside a given section, *in what order*, and resolve each image to its asset. Today it can't reliably.

- **Audit (report first, then fix):** confirm the current gaps in `apps/studio/bin/read-annotations.mjs`:
  - Sections are read as standalone `tool:'section'` elements (`readSection`, `read-annotations.mjs:213`) but there is **no computed membership** — nothing lists which annotations geometrically fall inside a section's rect.
  - `z` (`107`/`394-395`) is **document/paint order**, not **spatial reading order** (top-to-bottom, left-to-right) — the order a human perceives (and the order a carousel/video should follow).
  - The smallest-containing-rect resolver (`569-594`) matches an annotation's center to a **DOM element** (`--rects`), not to a **section** (a section is itself an annotation, not a DOM element) — so that logic needs a sibling that resolves annotation→section.
  - Image annotations pass through with their `href`/media attrs (`361-362`) but are **not grouped or ordered** by section, and it's worth confirming the reader surfaces the resolvable asset path + natural w/h for each.
- **Extend the read output** so each section reports its **members** (the annotations whose center falls inside its rect — reuse/mirror the smallest-containing-rect logic) and a **stable reading order** within the section (spatial: sort by row-band then x, i.e. top-to-bottom, left-to-right; keep `z` as a tiebreaker). Prefer an additive field (e.g. `section.members: [{ id, tool, order, element?, href? }]` or a top-level `sections[].memberIds`) — keep it backwards-compatible with existing consumers (`prep.sh`, `/design:board`, `/design:new --from-annotations` DDR-085).
- **Media resolution:** ensure image members expose the browser-resolvable asset href (via `resolveAssetHref` semantics) + intrinsic dimensions so a downstream "make a video / carousel" step has real files + order in hand.
- **Document the semantics** in `plugins/design/skills/whiteboard/SKILL.md` (near the `--rects` element-context description, `SKILL.md:32`): what "inside a section" means, how order is computed, and that image members carry their asset path — so `board.md` and future generation flows can rely on it rather than re-deriving containment.
- **Trust model:** section-member text is still untrusted board content (SKILL.md § Trust model, DDR-085) — treat member `text`/`element.text`/media filenames as DATA, never instructions. Grouping raises the reach, mirror the DDR-085/`--rects` caution.
- **Gotcha:** static (no-browser) lane (`_canvas-rects-static.mjs`) and the live lane must agree on membership/order, same as they do for artboards today (DDR-151) — or degrade explicitly.
- **Validate:** author a section with 4 images + 2 stickies out of visual order → `read-annotations` returns them grouped under the section in top-left→bottom-right reading order, each image with a resolvable asset path. Then `/design:board`-adjacent prompt "make a carousel from this section" can enumerate them correctly.

#### ✅ Task 5.1: ENRICH preset fixtures in the whiteboard skill — completed
- **Do**: In `SKILL.md` §Preset fixtures (`118-174`), give each template real opinion: sprint-retro framing + seeded prompts + per-column color + action-item (owner/date) structure + recommended card counts. Keep `cards:[]` blank-template escape hatch.
- **Validate**: `/design:board "vytvoř mi team sprint retro"` yields a colored, framed, sprint-shaped board (not 3 empty columns).

#### ✅ Task 5.2: ADD intent/keyword→preset map + non-English triggers to board.md — completed
- **Do**: In `board.md` §3 (`47-52`) add an explicit keyword→preset table + Czech/English generation-verb examples ("vytvoř mi…", "uděláš…", "create me…").
- **Validate**: Generation phrasing in CZ + EN routes to the right preset.

#### ✅ Task 5.3: ADVERTISE board/whiteboard in the ACP bootstrap brief — completed
- **Do**: In `bootstrap-brief.ts:83-84` add `board` (and a one-line whiteboard-capability fact) to the command list — STATIC fact only, through `safeFact`, no behavioral policy (respect the brief's guardrails `10-20`). The plugin auto-load (DDR-143) already puts the skill+command in the catalogue; this makes the agent reach for it unprompted.
- **Validate**: In the native chat, "make me a retro board" triggers `/design:board` without the user naming the skill; the injection is audited as `role:'bootstrap'`.

### Phase 6 (optional) — Tenor GIF search (item 6 extension)

#### Task 6.1: ADD server-side Tenor proxy (config-gated)
- **Do**: `GET /_api/tenor/search?q=` (main-origin) → dev-server calls Tenor API with a **user-supplied** key from config; off without a key. Mirror `_fetch-asset.mjs` SSRF gate on the download of the picked GIF → `assets/<sha8>.gif`.
- **Validate**: With a key set, search returns thumbnails; without, feature is cleanly absent.

#### Task 6.2: RENDER animated GIF strokes + attribution
- **Do**: Render GIF `ImageStroke`s via `<foreignObject><img></foreignObject>` (SVG `<image>` freezes GIFs in WKWebView). Add "Powered by Tenor" attribution. Add a GIF size cap; decide gitignore vs commit for GIF assets (record DDR).
- **Validate**: Picked GIF **animates** in the bundled `.app`; size cap enforced.

---

## Validation

There is **no test suite / lint / build** in this repo (per CLAUDE.md) — verification is live + targeted unit tests where a suite exists (`bun:test` under `apps/studio/`).

1. **Unit (where applicable)**: `cd apps/studio && bun test` for serializer round-trip (author fields), board-ops, and any resize math extracted to a pure fn.
2. **Runtime bundle rebuild**: after client changes (`StickerPicker`, badge, styles) rebuild release-minified — `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release` — and commit `dist/client.bundle.js` + `dist/styles.css` (never boot the source dev-server without rebuilding `--release`).
3. **Canvas-origin gate**: if any `/_api/*` route is reachable from the canvas, add it to BOTH `CANVAS_SAFE_API` and the `routes` map + a `GET→405` assertion (DDR-088). `/_api/stickers` + `/_api/tenor` are **main-origin only** (picker is shell UI) — keep them OUT of the canvas allowlist.
4. **Gitignore/taxonomy**: confirm sticker/GIF asset handling agrees across `isMaudeRuntimeState`, `cli/lib/gitignore-block.mjs`, and `.gitignore` (DDR-115) if any new `_*` path is introduced.
5. **Version parity**: no version bump unless releasing (`scripts/check-version-parity.sh`).
6. **Live (native `.app`, DOM-driven)**: verify each phase in the bundled Maude.app (memory: native verification ceiling; prefer `desktop-e2e` DOM-driven scenarios over computer-use). Add `data-testid`s for any new UI a scenario must reach (sticker picker, author badge).
7. **Manual edge cases**: text-jump on empty vs pre-filled shape; group resize with mixed stroke types (sticky + rect + anchored text); author badge for `anonymous-*` (git user unset); sticker under CSP; board generation in CZ + EN.

---

## Acceptance Criteria

- [x] Phase 1: shape text edits land where typed — no top→center jump (empty + pre-filled). **Verified live in the source dev-server via `agent-browser` (web/Chromium), NOT in the bundled native `.app` (WKWebView)** — the WebKit-specific transform/caret quirks this fix targets are exactly the kind of thing that can differ between engines; flagged to the user for their own `.app` confirmation (native-app verification ceiling).
- [x] Phase 1: new shapes auto-focus their text editor (parity with stickies) — live-verified.
- [x] Phase 2: multi-select corner drag scales the group proportionally about the anchor; shift/alt modifiers honored; one undo record — live-verified end to end (draw → marquee-select → drag corner → undo, toast labels matched exactly).
- [x] Phase 3: human-drawn stickies carry author name+id in the committed SVG (back-compat with `data-author="ai"`) — live-verified via the persisted SVG + the CLI reader round-trip. Badge design changed mid-implementation from an avatar+initials to a name/nickname label (user feedback) — color still re-derives via `colorForName` so it matches the author's presence hue. Privacy DDR recorded: DDR-155.
- [x] Phase 4: searchable, pack-grouped sticker picker (4 attributed Figma packs + optional Maude pack) drops stickers via the existing image-upload lane; attribution shown; PNGs ship via the existing whole-directory `package.json` `files` entry (no edit needed — confirmed, not assumed); committed release bundle rebuilt. **OpenMoji base deferred** (DDR-156) — user explicitly wanted funny/crazy over emoji; not a gap, a scoped-out layer with zero cost to add later.
- [x] Phase 5: `read-annotations` reports section membership + spatial reading order (top-left→bottom-right) with resolvable asset paths for image members — verified against a constructed fixture (3 out-of-order stickies + an image) and 4 new automated tests. "Static + live lanes agree" doesn't apply as originally worded — this reader has always been a single headless/DOM-free implementation (no live-browser lane to reconcile against, unlike `canvas-rects`); noted in the plan rather than silently dropped.
- [x] Phase 5: `/design:board` generates a rich, framed retro (and other presets) from CZ/EN prompts — the preset enrichment + keyword/verb map are implemented and documented; **"ACP chat invokes board unprompted" is implemented per spec (the bootstrap brief now names the capability) but NOT literally tested against a real live ACP session** — that would require driving an actual Claude conversation through the native chat panel, out of reach for this session to verify directly.
- [ ] Phase 6 — **not taken**, explicitly deferred per the user's own choice (no Tenor API key on hand; config-gated off regardless).
- [x] No DDR-worthy decision left unrecorded — DDR-155 (author privacy/sanitization/badge color) + DDR-156 (sticker sourcing/licensing/rasterization) recorded during `/flow:done`'s DDR sweep. GIF asset handling is N/A (Phase 6 not taken).
- [x] Code follows project conventions; canvas-origin routes correctly gated (verified via `canvas-origin-gate.test.ts` — both new sticker routes 403 from the canvas origin); no regressions (full studio suite green throughout: 2204 pass / 5 skip / 0 fail on the final run). `pnpm lint` + `pnpm format` both exit 0 (only pre-existing, unrelated warnings remain).

---

## Appendix — Extra "delight" ideas (captured, not yet scoped into tasks)

Strongest whiteboard additions beyond the six requests — promote to phases on demand:

1. **Dot-voting / reactions on stickies** — click to add colored vote dots; pairs perfectly with generated retro boards (FigJam's signature retro ritual). Natural companion to Phase 5.
2. **Tidy-up + align/distribute for multi-select** — auto-arrange scattered stickies into a grid; align-left/center, distribute-evenly. Natural companion to Phase 2 (shares the multi-select bbox math).
3. **Sticky auto-fit to text** — grow the sticky (or shrink font) to fit content so text never clips.
4. **Meme-maker (caption tool)** — drop any user image + Impact top/bottom caption = instant meme on canvas (the only license-clean route to *real* meme content, since the user supplies the image). Composes with the sticker picker.
5. **Templates gallery in the UI** — surface the board presets as a visual picker in the shell (not only via `/design:board`).
6. **Convert sticky ↔ shape**, **frame/section auto-grouping**, **keyboard color swatch on create** — smaller ergonomics wins.
