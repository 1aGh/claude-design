# Feature: Whiteboard AI toolkit — element-aware read + effortless authoring + plan-board recipes

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. **This is FigJam v4** — it extends the v3 AI loop ([DDR-100](../decisions/DDR-100-annotations-figjam-v3-data-model.md)) and the brief-board ingest ([DDR-085](../decisions/DDR-085-canvas-kind-and-design-new-ingest-mode.md)). Most of the primitives already exist; read them before writing new code.

## Description

Make the FigJam annotation layer a first-class, **bidirectional AI medium**: the agent can (1) READ a user's sketch and understand not just *which artboard* but *which element* each note sits over, and (2) WRITE notes/shapes effortlessly — drop a sticky onto an artboard, pin one to a button, or compose a whole tidy "plan board" (social-media calendar, roadmap, kanban) it can then follow — without ever hand-computing coordinates. Packaged as a dedicated **`whiteboard` skill** + a **`/design:board`** command so any agent naturally reaches for it.

## User Story

As a designer using Maude, I want Claude to fully use the whiteboard in both directions — read my scattered sticky notes with awareness of what UI they annotate, and lay out a clean, labelled plan (e.g. a week of social posts) as movable shapes+notes — so the whiteboard becomes a shared working surface, not a one-way sketchpad.

## Problem

The read/write CLI verbs (`maude design annotate`, `maude design read-annotations`) already ship and are robust, but three things keep them from being the "robust tool" the user wants:

1. **No element-level context.** `read-annotations --canvas-state` tags each note with the overlapping *artboard* id + artboard-relative coords, but there is **no join to the `data-cd-id`/selector of the inner element** the note visually covers (`read-annotations.mjs:478-513` resolves to artboard only). The user explicitly wants "nad kterým artboardem **a elementem** jsou nakreslené."
2. **No offline geometry source → placement is manual.** Both verbs need a `--canvas-state` file of `{id,x,y,w,h}` artboard rects, but **that file has no producer**: since [DDR-027](../decisions/DDR-027-jsx-authoritative-artboard-size.md) `.meta.json` `layout.artboards[]` is position-only (no w/h) and `_canvas-state/<slug>.view.json` is camera-only (DDR-115). `loadArtboards` silently filters out any rect missing finite w/h (`read-annotations.mjs:460-476`), so raw meta yields nothing. Full rects (and *any* element rects) resolve only in the live browser (`canvas-lib.tsx` WorldContext). Result: `--near`/`--canvas-state` are effectively unusable unless the caller already has browser-computed rects.
3. **Buried + no composition layer.** The verbs are documented only inside `skill design` § "Strokes annotation layer" (`SKILL.md:199-230`) and referenced from `/design:edit`/`/design:new`. There is no discoverable entry, and no higher-level "make me a nice plan" recipe — the agent must hand-author every op, so results aren't reliably tidy.

## Solution

One **geometry manifest** producer unblocks everything, then read/write/packaging compose on it:

- **`maude design canvas-rects <path>`** (new verb) → emits `{ artboards:[{id,x,y,w,h}], elements:[{cdId,selector,index,artboard,x,y,w,h,tag,text,role}] }` in **world coordinates**, by reading a tiny new `window.__maudeCanvasRects()` hook (reuses the client's existing WorldContext + the comment element-hit-tester) via headless Chromium — the same "playwright shim behind a `.sh`" pattern as `_enumerate-artboards-playwright.mjs`. Static artboard-only fallback (merge meta positions + JSX `width`/`height` + default grid) when no server/browser.
- **READ**: `read-annotations` gains `--rects <manifest>` → each annotation gets `element: {cdId, selector, artboard, rect, tag, text}` by deepest-overlap hit-test, and its W3C `target.selector` is refined from `AnnotationIdSelector` to the element's `CssSelector`/`CdIdSelector`.
- **WRITE**: `annotate` gains `--in <artboardId>` (place inside), `--pin <cdId|selector>` (place beside an element + optional pointer arrow), and a `--board <spec>` recipe mode (typed board spec → auto-laid-out sections + card grid + connectors) — all resolving geometry from the manifest.
- **PACKAGE**: a new `whiteboard` skill (the authoritative bidirectional doc + recipes + trust model) and a `/design:board` command (read-understand-author-verify loop).

## Metadata

- **Type**: Enhancement (completes an existing surface) + New Capability (element context, board recipes)
- **Complexity**: High
- **App/Package**: `apps/studio` (dev-server bins + client hook) + `plugins/design` (skill + command + docs) + `cli/commands/design.mjs` (verb registration)
- **Affected Systems**: annotation read/write verbs, canvas-lib client, design plugin skill/command surface, runtime-state taxonomy (3 ignore lists), docs
- **Dependencies**: none new. Reuses playwright (already a soft dep via `_pw-launch.mjs`), the React-free `annotations-model.ts`, `annotations-bindings.ts`, optionally `draw/layout.ts` (A\*-routing).

---

## Context References

### Must-Read Files

> When consuming this section during `/flow:execute`, **read every file listed here in parallel in a single assistant message**.

- `apps/studio/bin/read-annotations.mjs` (whole file, esp. `460-513`) — Why: the READ verb; `loadArtboards` finite-w/h filter, `findArtboard` overlap, `anchorToArtboard` W3C target. Element context bolts on here.
- `apps/studio/bin/annotate.mjs` (whole file, esp. `222-249` placement, `283-509` ops, `514-568` flow layout, `612-720` write path) — Why: the WRITE verb; `--in`/`--pin`/`--board` bolt on here; `buildContext` already does `--near`.
- `apps/studio/annotations-model.ts` (`56-90` StrokeBase/ArrowBind, `202-226` sticky, `300-322` section+union, serializer `954-1215`, sanitizer `2062-2178`) — Why: React-free single source both verbs import; new ops must round-trip through `strokeToSvgEl`.
- `apps/studio/annotations-bindings.ts` (`anchorPoint`, `facingAnchor`, `recomputeBoundArrows`) — Why: world-coord anchor math for `--pin` pointer arrows.
- `apps/studio/bin/_enumerate-artboards-playwright.mjs` (whole) + `apps/studio/bin/_pw-launch.mjs` — Why: the exact headless-shim template `canvas-rects` copies (navigate canvas-shell URL, `page.evaluate`, one-value-per-line/JSON stdout, subprocess so `bun --compile` doesn't pull chromium).
- `apps/studio/bin/draw-build.sh` + `apps/studio/bin/svg-optimize.sh` + `apps/studio/bin/_svg-optimize.mjs` — Why: the `.sh`→`_shim.mjs`(→`.ts` import) pattern and `#!/usr/bin/env bash` + `--help` + `SCRIPT_DIR` conventions for the new `canvas-rects.sh`.
- `cli/commands/design.mjs` (`28-48` `BIN_VERBS`, `53` `BOOT_VERBS`, `89-129` `runBinDispatch`, `131-197` `usage`) — Why: register `canvas-rects`; it boots the server → add to `BOOT_VERBS`.
- `apps/studio/canvas-lib.tsx` (`320-338` `ArtboardRect`/`WorldContext.rectFor`, `375` `VP_GRID`, `389-444` `harvestArtboards`/`synthDefaultGrid`, `1633/1813` `DCSection`/`DCArtboard`) — Why: the world-rect math the `window.__maudeCanvasRects()` hook reuses.
- `apps/studio/canvas-comment-mount.tsx` (`84-100` `resolveHoverTarget`/deepest-non-chrome element, `268-303` cd-id-else-cssPath anchor) — Why: the element hit-tester + selector-minting logic to reuse for element rects and the READ resolver.
- `apps/studio/comments-overlay.tsx` (`57-84` selector+`index`, `145-230` `querySelectorAll(selector)[index]` resolution) — Why: the selector+occurrence-index anchor shape to mirror for `element.selector`.
- `apps/studio/inspect.ts` (`8-78` `SelectedElement`/`ActiveState`) + `apps/studio/locator.ts` (`13-39` `LocatorEntry`/`LocatorFile`) — Why: the `data-cd-id` identity + source-map the element anchor plugs into.
- `apps/studio/http.ts` (`1048-1078` `/_api/annotations`, `907-931` `/_api/canvas-meta`, `2139-2147` `CANVAS_SAFE_API`) + `apps/studio/server.ts` (`238-252` canvas routes) — Why: confirm we add **no new HTTP write route** (stay CLI-verb + existing PUT); the trust boundary any new read endpoint would have to respect.
- `apps/studio/api.ts` (`971-1046` `canvasMetaPath`/`loadCanvasMeta`/camera split, `1157-1199` `saveAnnotations`) — Why: the static artboard fallback source (meta positions) + the write persist path.
- `plugins/design/skills/design/SKILL.md` (`146` comments, `199-230` Strokes annotation layer + trust model) — Why: current annotation doc; new `whiteboard` skill lifts + extends this, and this section links to it.
- `plugins/design/commands/new.md` (`666-672` `--canvas-state` sourcing + verbatim-brief) + `plugins/design/commands/edit.md` (`257-278` active-state read, `267-270` annotation cross-ref, `294-318` locator fast-path) — Why: cross-wire points; the verbatim/untrusted framing to reuse.
- `plugins/design/agents/draw-agent.md` (`113-159` `maude design` invocation + engine surface incl. `diagram`/`placeLabels`/`routeConnector`) + `apps/studio/draw/layout.ts` (`116-153` `placeLabels`, `190-260` `diagram` A\*-routing) — Why: optional borrow for board-connector routing.
- `cli/lib/plugin-cli-reachability.test.mjs` — Why: the guard that forces all skill/command calls through `maude design <verb>`; keep green.
- `apps/studio/test/annotate-write.test.ts` + `apps/studio/test/read-annotations.test.ts` — Why: the round-trip contract tests to extend.
- `.ai/decisions/DDR-100-...md`, `DDR-085-...md`, `DDR-027-...md`, `DDR-115-...md`, `DDR-062-...md`, `DDR-054-...md`, `DDR-045-...md` — Why: the governing decisions this feature extends / must not violate.

### Files to Create

- `apps/studio/bin/canvas-rects.sh` — whitelisted agent-facing wrapper for the geometry manifest.
- `apps/studio/bin/_canvas-rects-playwright.mjs` — headless shim: navigate canvas-shell URL → read `window.__maudeCanvasRects()` → emit manifest JSON. (Underscore = internal, not whitelisted.)
- `apps/studio/bin/_canvas-rects-static.mjs` — offline fallback: merge `.meta.json` layout positions + parsed JSX `<DCArtboard width/height>` + default grid → artboard-only manifest.
- `apps/studio/test/canvas-rects.test.ts` — static-fallback + manifest-shape asserts (bun:test).
- `plugins/design/skills/whiteboard/SKILL.md` — the authoritative bidirectional whiteboard doc + recipes + trust model.
- `plugins/design/commands/board.md` — `/design:board` command (`name: design:board`, `category: daily`).
- `.ai/decisions/DDR-151-whiteboard-ai-toolkit-geometry-manifest-and-element-context.md` — the decision record (see Design Decisions).

### Design canvases

> `.design/` exists but the feature is plugin/dev-server internals, not a UI mock. Relevant existing surfaces to dogfood against (they carry live annotation layers): `.design/ui/*.tsx` with sibling `.design/ui-*.annotations.svg`, and the brief-board template `plugins/design/templates/brief-board.tsx.template`. No canvas matched by slug/tag — nothing to ground UI pixels in.

### Documentation

- FigJam v3 plan (archived): `.ai/plans/archive/feature-annotations-figjam-v3-ai-loop.md` — Why: the wave-by-wave build of the verbs this extends; the security waves (F2 egress, F4 non-finite clamp) the new manifest+ops must not regress.
- W3C Web Annotation Data Model (selector types) — Why: `read-annotations` already emits a W3C-style `target`; element context adds a `CssSelector`/`FragmentSelector` refinement. Reference the existing shape in-repo, no external fetch needed.

### Patterns to Follow

- **Whitelisted `.sh` → underscore `_shim.mjs` → `.ts` import** (`svg-optimize.sh`/`_svg-optimize.mjs`): the agent-facing entry is the `.sh` on `BIN_VERBS`; the `.mjs` shim is internal and imports engine `.ts` directly (Bun transpiles).
- **Headless via subprocess, never a compiled-in import** (`_enumerate-artboards-playwright.mjs`): keeps chromium out of the `bun --compile` binary. Last stdout line = capturable result; diagnostics to stderr.
- **World coords only** (`annotations-model.ts:39`): everything the verbs emit/read is pan/zoom-independent world space; the manifest converts screen→world in the browser hook, not in the bins.
- **Read-then-write, whole-SVG LWW** (`annotate.mjs:18-19`): new ops still merge into the existing SVG and PUT the whole thing; stay under the 1 MB cap.
- **`data-author="ai"` on every created stroke** (provenance, not trust).
- **DDR-045 real-disk paths**: bins resolve siblings via `SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"`; client/server paths via `paths.ts` — never `dirname(fileURLToPath(...))`.
- **DDR-062 reachability**: skill/command markdown calls `maude design <verb>` only, never a raw bin path.

---

## Design Decisions

> These are the DDR-worthy forks. All are recorded in **DDR-151**; recommendation given for each.

### 1. Geometry source — headless-browser primary, static fallback (recommended)

Full artboard rects and *all* element rects only exist in the live render. **Expose one client hook `window.__maudeCanvasRects()`** (reusing WorldContext + the comment element-walk) and read it via headless Chromium — mirroring `_enumerate-artboards-playwright.mjs`. Fallback to a static artboard-only merge (meta positions + JSX width/height + default grid) when no server/browser. *Rejected:* a new `/_api/canvas-rects` HTTP endpoint (the server is headless — it can't compute rects without a browser; adding a route also widens the DDR-054 canvas-safe surface for no gain). *Rejected:* client pushes a persisted `rects.json` like it pushes `_active.json` (staleness + write-amplification; the on-demand hook is simpler and always fresh).

### 2. Element anchor identity — `data-cd-id` first, `selector`+`index` fallback (recommended)

Mirror the comment system exactly (`comments-overlay.tsx`): prefer the stable `data-cd-id` (v2/TSX canvases, resolvable to source via `_locator.json`), fall back to a `cssPath` selector + occurrence `index` for legacy/unstamped elements. One shared minting helper so comments and the manifest can't drift. This makes an annotation's element anchor *survive edits* the same way a comment pin does.

### 3. Board recipes are annotation-native, NOT `draw/` assets (recommended)

A "social-media plan" must be **editable on the whiteboard, artboard-aware, and readable back** — so it's `sticky`/`section`/`shape`/`arrow` strokes via `annotate --board`, not a static `draw/diagram()` SVG asset. Reuse `annotate --flow`'s existing layered auto-layout for connector graphs; add a **grid/section layout** for calendar/kanban/roadmap boards. Optionally borrow `draw/layout.ts` `routeConnector` (A\*) for edges that must dodge cards — the one thing `--flow`'s straight bound arrows lack.

### 4. Packaging — new `whiteboard` skill + new `/design:board` command (per user's "full toolkit" choice)

DDR-085 precedent overloads existing verbs (brief-board folded into `/design:new`). We **add** here because the bidirectional "read the board / compose a plan" workflow is a distinct loop the user wants discoverable, and the user explicitly chose the full toolkit. The low-level verbs stay the engine; `/design:board` (daily group, bare verb `name: design:board`) is the entry; the `whiteboard` skill is the auto-loaded knowledge. `skill design` § Strokes annotation layer shrinks to a pointer at the new skill. Recorded in DDR-151 with the overload alternative noted.

### 5. `update`/`move` op — additive, delete-then-recreate-preserving-id (recommended, lower priority)

DDR-100 deliberately omitted `update` (LWW honesty). Add a thin `move` (reposition, keep id) + `set-text`/`set-color` implemented as delete+recreate-with-same-id so iteration ("nudge that sticky", "recolor the done column") is one op. Documented as LWW, id-preserving. Task 6 — cut first if scope pressure.

### Icons / Tokens / Typography

N/A — no new UI. The board strokes use the existing theme-aware ink/fill defaults in `annotate.mjs` (`NODE_INK`/`NODE_FILL`/`STICKY_PALETTE`) that read on light+dark canvases. The `/design:board` command and skill are markdown.

---

## Tasks

Execute in order. Each task is atomic and testable. Keywords: CREATE, UPDATE, ADD.

### Task 1: ADD the `window.__maudeCanvasRects()` client hook

- **Do**: In the canvas-shell client, expose a global that returns `{ artboards: [{id,x,y,w,h}], elements: [{cdId, selector, index, artboard, x,y,w,h, tag, text, role}] }` in **world coords**. Reuse `WorldContext` (`canvas-lib.tsx:320-338`) for artboard rects and the comment element-walk (`canvas-comment-mount.tsx:84-100`) + selector minting (`comments-overlay.tsx`) for element rects; convert each element's `getBoundingClientRect` to world via its artboard transform. Cap element count (skip pure-chrome / zero-size / off-artboard nodes; keep interactive + `data-cd-id`-stamped + text nodes).
- **Pattern**: the selection/comment code already does screen→world + selector minting — lift, don't reinvent.
- **Gotcha**: element sizes depend on live CSS/content → this MUST run in the rendered iframe, not the headless server. After editing the client, **rebuild the committed bundle release-minified** (`cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`) and commit `dist/client.bundle.js` — whatever is committed ships (CLAUDE.md rebuild rule).
- **Validate**: boot a canvas, `agent-browser` eval `window.__maudeCanvasRects()`, confirm artboards + a known `data-cd-id` element appear with plausible world rects.

### Task 2: CREATE `maude design canvas-rects` (the geometry manifest verb)

- **Do**: `apps/studio/bin/canvas-rects.sh` (whitelisted wrapper, `--help`/`SCRIPT_DIR` per template) that `exec bun run`s `_canvas-rects-playwright.mjs` when a live server (`_server.json`) is present, else `_canvas-rects-static.mjs`. Playwright shim: reuse `_pw-launch.mjs`, navigate the canvas-shell URL for `<path>`, `page.evaluate(() => window.__maudeCanvasRects())`, print the manifest JSON. Static shim: read `.meta.json` `layout.artboards[]` positions + parse the canvas `.tsx` for `<DCArtboard width= height=>` (JSX-authoritative sizes), synth default grid (`VP_GRID`) when no layout; artboards only, `elements: []`, with a stderr note that element context needs the live/headless path. Register in `design.mjs` `BIN_VERBS` + `BOOT_VERBS` + `usage()`.
- **Pattern**: `_enumerate-artboards-playwright.mjs` (headless), `svg-optimize.sh`/`_svg-optimize.mjs` (wrapper→shim), `design.mjs:89-129` (dispatch).
- **Gotcha**: manifest must be shaped so `loadArtboards` accepts `manifest.artboards` unchanged (all of `x,y,w,h` finite) — this is the file that finally satisfies `read-annotations`/`annotate` `--canvas-state`.
- **Validate**: `apps/studio/test/canvas-rects.test.ts` (static-fallback shape + finite-rect asserts); manual `maude design canvas-rects "ui/Foo.tsx"` against a live server returns artboards + elements.

### Task 3: UPDATE `read-annotations` — element-level context (`--rects`)

- **Do**: Add `--rects <manifest>` (accepts a `canvas-rects` manifest; also accept the manifest via the existing `--canvas-state` for the artboard-only lane). For each annotation, hit-test its world bbox against `manifest.elements` (deepest = smallest element containing the annotation's center, mirroring `resolveHoverTarget`); attach `element: { cdId, selector, index, artboard, rect, tag, text }` or `element: null`. Refine `anchorToArtboard`'s W3C `target.selector` to a `CssSelector`/`CdIdSelector` when an element is resolved (keep `AnnotationIdSelector` as fallback). Preserve existing `--canvas-state` artboard behavior byte-for-byte.
- **Pattern**: `anchorToArtboard`/`findArtboard` (`read-annotations.mjs:478-513`); deepest-element rule from `canvas-comment-mount.tsx:90-100`.
- **Gotcha**: annotations outside every artboard (floating board notes) → `element: null`, `artboard: null` — don't force a match.
- **Validate**: extend `read-annotations.test.ts` — a sticky placed over a known element resolves that element's `cdId`; a floating note resolves null. Round-trip guard stays green.

### Task 4: UPDATE `annotate` — effortless placement (`--in`, `--pin`)

- **Do**: `--in <artboardId>` sets the placement origin *inside* the artboard (top-left + inset, from the manifest rect) instead of beside it. `--pin <cdId|selector>` resolves the element rect from the manifest and places the created stroke adjacent to it; if the op is a sticky/text and `pointer:true`, also emit an `arrow` from the note to the element's nearest edge point (via `anchorPoint`/`facingAnchor` — a visual pointer, since magnetic binds only host on annotation strokes, not DOM elements). Op-level `in`/`near` fields resolve the same way per-op. All geometry comes from a `--rects`/`--canvas-state` manifest (Task 2).
- **Pattern**: `buildContext` `--near` origin (`annotate.mjs:222-249`); `createConnect` anchor math (`:401-444`).
- **Gotcha**: LWW read-then-write unchanged; `--pin` to an unresolvable element = clear error (exit 2), never a silent mis-place.
- **Validate**: `annotate-write.test.ts` — `--in`/`--pin` place within/next to the target rect; pointer arrow endpoints land on the element edge; strokes still round-trip + sanitize.

### Task 5: UPDATE `annotate` — `--board` recipe mode (plan boards)

- **Do**: Add `--board <file|->` (mutually exclusive with `--ops`/`--flow`) taking a typed board spec, e.g. `{ title, layout: "columns"|"grid"|"lanes", groups: [{ title, color?, cards: [{ text, color?, tags?, pin? }] }], connections?: [{from,to,label?}] }`. Expand to ops: a titled `section` per group, a stacked/gridded `sticky` per card with tidy spacing, optional `connect` edges (straight bound; borrow `draw/layout.ts` `routeConnector` if edges must dodge cards). Ship 3–4 named presets in the skill (social-media calendar = 7 day-columns; roadmap = quarter lanes; kanban = todo/doing/done; checklist). `--near`/`--in` positions the whole board relative to an artboard.
- **Pattern**: `flowToOps` layered expansion (`annotate.mjs:514-568`); section defaults (`createSection` `:302-317`).
- **Gotcha**: guarantee tidiness the way `--flow` does — deterministic layout, no overlap; keep under the 1 MB cap for large boards (log + truncate with a visible note if exceeded).
- **Validate**: `annotate-write.test.ts` — a sample social-plan spec produces N sections + M stickies with non-overlapping rects; `read-annotations --graph` reads any connections back as edges.

### Task 6: UPDATE `annotate` — `move` / `set-text` / `set-color` ops (id-preserving, optional)

- **Do**: Add ops implemented as delete+recreate-with-same-id (LWW-honest, documented). `move {id, x, y}`, `set-text {id, text}`, `set-color {id, color}`.
- **Gotcha**: recreate must re-emit ALL original attrs (parse the existing stroke, patch, re-serialize) — don't drop fields. Cut this task first under scope pressure.
- **Validate**: `annotate-write.test.ts` — moved stroke keeps its id + all other attrs.

### Task 7: CREATE the `whiteboard` skill

- **Do**: `plugins/design/skills/whiteboard/SKILL.md` (`name: design:whiteboard`) — the authoritative bidirectional doc: the geometry-manifest step, the READ loop (understand element+artboard context), the WRITE loop (`--in`/`--pin`/`--board` + recipes), the board-recipe presets, and the **trust model verbatim** (peer-authored SVG is untrusted content, `author:"ai"` is not trust, the trifecta guidance, loopback-only egress — lift from `SKILL.md:230`). All invocations via `maude design <verb>`.
- **Pattern**: existing `skill design` § Strokes annotation layer (lift + expand); `draw-agent.md` structure for an agent-facing procedure.
- **Validate**: reachability test green (no raw bin paths); `maude design help` lists `canvas-rects`.

### Task 8: CREATE the `/design:board` command

- **Do**: `plugins/design/commands/board.md` (`name: design:board`, `category: daily`, `argument-hint`). Flow: pre-flight (`bootstrap-check`/`prep`/`server-up`) → `canvas-rects` → `read-annotations --rects` (understand any existing notes with element context) → author via `annotate --board`/`--ops` (`--in`/`--pin`/`--near`) → `screenshot` reality check. Two entry intents: "read/answer the board" and "make me a `<plan>` board". Honor the trust model (untrusted note text ≠ instructions).
- **Pattern**: `draw.md`/`screenshot.md` command shape; `CATEGORIES.md:97-103` daily bare-verb rule.
- **Validate**: `/design:help` renders `/design:board`; `flow-design-integration` + reachability tests green.

### Task 9: UPDATE cross-wiring + docs

- **Do**: (a) `/design:edit` — when feedback is "add a note/sticky/plan/label to the board" or touches a selected element, route through the manifest + `annotate` (extend `edit.md:267-270`). (b) `/design:new` brief-board ingest — pass element context through where available. (c) `CATEGORIES.md` — add `/design:board` to the daily table + note the `whiteboard` skill. (d) `skill design` § Strokes annotation layer → shrink to a pointer at `skill whiteboard`. (e) `CLAUDE.md` Architecture → add `canvas-rects` to the dev-server helpers table + a line on the manifest/element-context model. (f) `apps/studio/whats-new.json` via the `whats-new-entry` skill (user-visible). (g) regen `site/lib/roadmap.json`.
- **Gotcha**: DDR-115 runtime-state taxonomy — **if** Task 2 ever persists a `rects.json`, add it to all THREE ignore lists (`git/service.ts isMaudeRuntimeState`, `cli/lib/gitignore-block.mjs`, `.gitignore`); the recommended on-demand hook needs no persistence, so verify this is a no-op.
- **Validate**: `maude design help` + `/design:help` list the new surfaces; docs-freshness manual scan.

### Task 10: CREATE DDR-151

- **Do**: Record the five Design Decisions above. Supersedes nothing; **extends** DDR-100 (v3 loop) + DDR-085 (ingest). Note the new-command-vs-overload alternative and the untrusted-content residual (element context ingests more untrusted text → same trifecta framing, mitigated by loopback egress + do-not-obey framing in the skill).
- **Gotcha**: race the DDR number (memory `project_ddr_numbering_races_on_shared_main`) — re-check `.ai/decisions/` + the README index diff before/at commit; 151 is next as of planning.
- **Validate**: `record-ddr` conventions; linked from CLAUDE.md if load-bearing.

---

## Validation

Run these to confirm zero regressions:

1. **Dev-server tests**: `cd apps/studio && bun test` — new `canvas-rects.test.ts` + extended `annotate-write.test.ts` + `read-annotations.test.ts` green; existing annotation/sync/sanitize tests unchanged.
2. **CLI tests**: `node --test cli/commands/design.test.mjs cli/lib/plugin-cli-reachability.test.mjs` — `canvas-rects` dispatch + reachability green.
3. **Runtime bundle floor**: `apps/studio/bin/check-runtime-bundles.sh` still passes after the client rebuild; `dist/client.bundle.js` committed release-minified.
4. **Version parity / quality gates**: repo `quality` block (lint/tests/build + parity/tokens/site-content drift) — no red.
5. **Live bidirectional scenario** (the acceptance proof): on a real canvas with artboards + `data-cd-id` elements —
   - sketch a sticky over a known button → `canvas-rects` → `read-annotations --rects` resolves that element's `cdId`;
   - `annotate --board <social-plan>` produces a tidy 7-column calendar of stickies beside the artboard;
   - `annotate --pin <cdId>` drops a labelled note pointing at the button;
   - `screenshot` shows all of it rendered, non-overlapping, live-synced.
6. **Security**: `security-auditor` + `ethical-hacker` over the new ops + manifest — confirm no new HTTP write route, loopback egress intact, non-finite geometry clamp preserved, and the untrusted-annotation-text trifecta framing is in the skill.
7. **Manual**: legacy `.annotations.svg` files still round-trip byte-identically (the Phase-24 canary); `--canvas-state` without `--rects` behaves exactly as before.

---

## Scenario Coverage (UI-adjacent)

The user-visible surface is the rendered whiteboard, verified via `agent-browser` on `web-desktop` (the canvas browser is desktop-first). Native iOS/Android runners are **not applicable** (the design dev-server + annotation authoring is a desktop tool) — record the skip rationale rather than forcing 5-platform parity.

**New scenario to create:** `whiteboard-ai-loop` (web-desktop) — flow: open canvas → sketch note over element → read-with-context → author board+pin → screenshot; persona: designer; fixtures: a canvas with ≥2 artboards and ≥1 `data-cd-id` element + a seeded `.annotations.svg`.

---

## Acceptance Criteria

- [ ] All tasks completed (Task 6 optional).
- [ ] `read-annotations --rects` returns per-note `element:{cdId,selector,artboard,rect}` or `null`; artboard-only `--canvas-state` behavior unchanged.
- [ ] `annotate --in`/`--pin`/`--board` place correctly from a `canvas-rects` manifest with **zero hand-computed coordinates** in the calling command/skill.
- [ ] `maude design canvas-rects` emits a manifest that `loadArtboards` accepts unchanged (finite `x,y,w,h`), with element rects when a live/headless render is available and a documented artboard-only fallback otherwise.
- [ ] `/design:board` + `skill whiteboard` are discoverable (`/design:help`, `maude design help`) and reach all logic via `maude design <verb>` (reachability test green).
- [ ] `/flow:utils-verify` passes after each task (Edit-Verify Loop, max 3 iterations).
- [ ] `/flow:validate` passes: dev-server tests, CLI tests, build, security (0 blockers), no bundle-floor regression.
- [ ] Legacy annotation files round-trip byte-identically; whole-SVG LWW + 1 MB cap + `data-author="ai"` + loopback egress all preserved.
- [ ] DDR-151 recorded; `whats-new.json` entry (pending) added; `site/lib/roadmap.json` regenerated.
- [ ] Committed `dist/client.bundle.js` rebuilt release-minified after the client-hook change.
- [ ] No DDR-worthy decision left unrecorded; code follows project conventions, no regressions.
