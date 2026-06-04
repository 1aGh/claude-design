# Phase 23 — Canvas media: drag-and-drop images + paste-link chips

> **Sequenced after [Phase 21](phase-21-annotation-vocabulary-figjam.md) (FigJam vocabulary).** Images and link cards are new *annotation strokes* — they live on the same world-plane overlay as stickies/text/arrows, persist in the same `<slug>.annotations.svg`, move/resize with the same handles, and undo through the same command sink. Building after Phase 21 avoids merge churn in `annotations-layer.tsx` and lets media reuse Phase 21's selection/resize machinery.
>
> Sibling: [Phase 22](phase-22-annotation-brief-board.md) (annotation brief-board). The two compose: drop reference screenshots here, annotate them, and Phase 22's `read-annotations` reader (already forward-compatible with `image`/`link` strokes) feeds the asset paths to Claude at ingest.

## Description

The user wants to **drop images onto the canvas** (drag a `.png` from Finder, or paste from clipboard) and **paste links that render as a preview chip** (favicon + title) — the FigJam move where reference material lives right next to the work. Today the canvas has **zero** of this: no image primitive, no clipboard-read handler, no OS-level file/URL drop, no asset-upload route (all verified greenfield).

Two new free-floating canvas objects, modeled as annotation strokes:

1. **Image stroke** — drop/paste an image file → it uploads to `<designRoot>/assets/<sha8>.<ext>`, renders as an `<image>` on the canvas at the drop point, and is selectable / movable / resizable like any annotation. Persisted as `<image href="assets/<sha8>.png">` in the annotation SVG (a tiny reference, not inlined bytes).
2. **Link chip** — paste/drop a URL → it renders as a card with a link glyph, the domain, and a best-effort title. **No server outbound fetch** (decision: client-only lite chip — the dev-server stays zero-egress, honoring the DDR-054/060 security posture). Title comes from the clipboard/DnD HTML payload when present (browsers put the anchor text in `text/html`), else the prettified URL. A real favicon would require either a server fetch or a CSP `img-src` relaxation — both deferred; v1 ships a vector link glyph.

The security-sensitive surface — extending the annotation SVG vocabulary to allow `<image>` + a constrained `href`, and adding a binary-accepting write route reachable from the (potentially untrusted) canvas origin — is gated behind a **single DDR** with explicit SSRF/path-traversal/upload caps.

## User Story

As a designer, I want to drag a screenshot from my desktop straight onto the canvas and paste a reference link that shows up as a tidy card — so my moodboard, the competitor screenshot I'm reacting to, and the spec link all sit on the same board as my sticky notes, instead of living in a separate tab I keep alt-tabbing to.

## Problem

Verified greenfield, every piece:

- **No image primitive.** `canvas-lib.tsx` exposes no `DCImage`; `annotations-layer.tsx` has no image stroke. There is no way to get a raster onto the canvas at all.
- **No clipboard read.** `navigator.clipboard.writeText` is wired (copy), but there is no `onPaste` / `ClipboardEvent` handler anywhere — the `paste-artboard` menu item is a `noop`.
- **No OS-level drop.** The only DnD is the internal `drop-comment` pointer action (placing a comment pin). No `dragover`/`drop`/`DataTransfer` for files or URLs.
- **No asset storage route.** The dev-server has read routes + inert collab writes (annotations SVG, comment replies) but **no** binary-upload route and no `assets/` write convention at runtime (the `assets/` prefix exists only in the export ZIP layout + the `asset-sweep` *discovery* helper).
- **The sanitizer actively blocks images.** `sanitizeAnnotationSvg` (api.ts) is an allowlist that drops any non-vocabulary element **and strips every `href`** — so `<image href="...">` is doubly rejected today. Extending it is mandatory and security-load-bearing.

## Solution

| Concern | Approach |
| ------- | -------- |
| Image stroke | New `ImageStroke { id; tool: 'image'; x; y; w; h; href; alt? }` in the `Stroke` union. `href` is a **relative** `assets/<sha8>.<ext>` path (never a data URL — keeps the SVG under its 1 MB cap and out of the sanitizer's way). Renders `<image href x y width height preserveAspectRatio>`. Reuses Phase 21's resize handles (aspect-lock by default). |
| Link chip | New `LinkStroke { id; tool: 'link'; x; y; w; h; url; title; domain }`. Renders a `<g data-tool="link" data-url data-title>` containing `<rect>` (card) + `<path>` (vector link glyph) + two `<text>` runs (domain, title) — **all in the existing allowlisted vocabulary**. No favicon network. Click-to-open is a client handler reading `data-url` → `window.open` (no persisted `<a href>`). |
| Asset upload | New `POST /_api/asset` route. Accepts image bytes; **sniffs magic bytes** (PNG/JPEG/WEBP/GIF — header lie is rejected); size cap (10 MB); **content-addressed** name `assets/<sha8-of-bytes>.<ext>` (dedupe → bounded file count); writes only under `<designRoot>/assets/` (resolved-path traversal guard). Rejects SVG upload (XSS). Returns `{ path: "assets/<sha8>.<ext>" }`. |
| Sanitizer extension (DDR) | Add `image` to `ANNOTATION_SVG_ELEMENTS`. Relax the href denylist so `href`/`xlink:href` survive **only on `<image>`** and **only** when the value matches `^assets/[A-Za-z0-9._-]+\.(png\|jpe?g\|webp\|gif)$` (relative, single path segment, no scheme, no `..`, no `data:`/`javascript:`/external). Everything else — `<script>`, `on*=`, `style=`, external/`data:` hrefs, hrefs on non-image elements — stays stripped. |
| Static serving | **No new code.** `assets/*.{png,jpg,jpeg,gif,webp}` are already in the canvas-origin static extension allowlist (http.ts ~728-740), and CSP is `img-src 'self' data: blob:` — same-origin asset hrefs render directly; `blob:`/`data:` cover the optimistic pre-upload preview. (Both verified.) |
| DnD + paste | New `use-canvas-media-drop.tsx` hook attached to the canvas-shell host (where `dblclick`/`mousemove` already bind). `drop`/`dragover`: image files → optimistic `blob:` preview stroke → `POST /_api/asset` → swap `href` to `assets/…` on success → commit + undo. URL (`text/uri-list`) → link stroke (title from `text/html` anchor). `paste`: same routing off `clipboardData`. Drop position = pointer world coord via existing `screenToWorld`. |
| Keyboard / a11y alternative | DnD + paste aren't keyboard-reachable. Add an **Image tool** button (opens `<input type=file accept="image/*">`, places at viewport center) + a **Link** button (inline URL input). Both route through the same create+upload path. aria-labels, focus management on the inputs. |
| Undo / persist | Reuse `commitStrokes` + `AnnotationStrokesCommand` (DDR-050). Image/link strokes persist in `<slug>.annotations.svg`. No new command type, no new server file. |
| Orphan assets | When an image stroke is deleted its `assets/` file may orphan. v1 leaves it (content-addressing bounds growth; another stroke/canvas may share the same file). GC is backlog — note `maude design asset-sweep` could be extended later. |

**Out of scope (deferred):** server-side OG/`og:image` unfurl (the rich-preview option, rejected for now to keep the server zero-egress — revisit behind a DDR if a real favicon/preview is wanted); real favicons via a public icon service (needs a CSP `img-src` relax); SVG image upload (XSS); video/PDF/embed media; pasting a screenshot region; auto-layout / packing of dropped media; asset garbage collection.

## Metadata

- **Type**: New Capability (canvas media)
- **Complexity**: High — new stroke types, sanitizer extension (security), new binary write route (security), DnD/paste hooks, tool palette + context toolbar + a11y alternatives, round-trip + upload tests. Touches the same hot files as Phase 21.
- **App/Package**: `plugins/design` — dev-server only.
- **Depends on**: Phase 21 (selection/resize machinery + the `Stroke` union it extends; building after avoids conflicts). Phase 5.1 + Phase 20 (annotation persistence + command sink).
- **Parallel with**: Phase 22 (independent; Phase 22's reader already forward-compat with `image`/`link` strokes).
- **Security**: DDR required (see Task 9). Extends the canvas-origin write surface + the annotation vocabulary — both are DDR-054/DDR-060 territory.
- **Affected files**:
  - `plugins/design/dev-server/annotations-layer.tsx` — `+ImageStroke +LinkStroke` in the union; extend `strokeToSvgEl` / `svgToStrokes` / `strokeBBox` / `strokeHitTest` / `translateOne` / `isStrokeMeaningful`; add `<image>` + link-`<g>` render branches; link click-to-open handler.
  - `plugins/design/dev-server/api.ts` — extend `ANNOTATION_SVG_ELEMENTS` (+`image`); relax href denylist for `assets/` on `<image>`; **NEW** `POST /_api/asset` handler (magic-byte sniff + content-addressed write + traversal guard).
  - `plugins/design/dev-server/http.ts` — register `/_api/asset` in the route map; add it to the canvas-origin inert-write allowlist (~line 751) with the upload caps; confirm the static extension allowlist covers the image types (it does).
  - `plugins/design/dev-server/use-canvas-media-drop.tsx` — **NEW** host `drop`/`dragover`/`paste` listeners → stroke create + upload.
  - `plugins/design/dev-server/canvas-shell.tsx` — mount the media-drop hook; drag-affordance overlay (highlight border on `dragover`).
  - `plugins/design/dev-server/input-router.tsx` — extend `Tool` union (`'image' | 'link'`); classify shortcuts; add to `ANNOTATION_TOOLS`.
  - `plugins/design/dev-server/use-tool-mode.tsx` — register `image` + `link` tool descriptors.
  - `plugins/design/dev-server/tool-palette.tsx` — Image button (file picker) + Link button (URL input).
  - `plugins/design/dev-server/canvas-icons.tsx` — `IconImage` + `IconLink`; register in `TOOL_ICONS`.
  - `plugins/design/dev-server/annotations-context-toolbar.tsx` — image alt-text + aspect-lock; link url/title + "open" button; extend `caps`.
  - `plugins/design/dev-server/use-annotation-resize.tsx` — add `image` + `link` to the resize hit-set.
  - Tests: `test/annotations-layer.test.ts` (round-trip image/link + back-compat); `test/sanitize-annotation-svg.test.ts` (href allow/deny matrix); `test/asset-api.test.ts` (**NEW** — upload validation, magic-byte reject, traversal reject, dedupe).

---

## Context References

### Must-Read Files

> Read in parallel during `/flow:execute`.

- `plugins/design/dev-server/annotations-layer.tsx:53-100` — the `Stroke` union (`+ImageStroke +LinkStroke` go here, mirroring `RectStroke`'s field order: id, tool, then geometry).
- `plugins/design/dev-server/annotations-layer.tsx:136-196` — `esc()` + `strokeToSvgEl` + `strokesToSvg`. Add an `image` branch (`<image>`) and a `link` branch (`<g>` with rect/path/text). Mirror the arrow `<g>` composition at line 193.
- `plugins/design/dev-server/annotations-layer.tsx:222-294` — `svgToStrokes` parser. Symmetric read branches; defensive defaults (missing `alt` → `''`, missing `data-title` → domain).
- `plugins/design/dev-server/annotations-layer.tsx:313-381` — `strokeBBox` / `strokeHitTest` / `isStrokeMeaningful` (line 380). Image + link are rect-shaped (filled-bbox hit). `isStrokeMeaningful`: image always true; link true when `url` non-empty.
- `plugins/design/dev-server/annotations-layer.tsx:~604` — `translateOne`. Image + link move like rect (translate x+y).
- `plugins/design/dev-server/api.ts:186-245` — **`ANNOTATION_SVG_ELEMENTS` (189) + `sanitizeAnnotationSvg` (221).** The allowlist + the three replace passes. Rule 1 strips `foreignObject`/`script`/`style`/`title`/`desc` content; Rule 2 drops non-allowlisted tags; Rule 3 strips `on*`/`style`/`*href`. **The href relaxation is the delicate edit** — it must permit `assets/` hrefs on `<image>` without re-opening `javascript:`/`data:`/external/`..`. Add a positive test for every bypass the comment enumerates (svg-namespace script, entity-encoded href, `url(javascript:)`).
- `plugins/design/dev-server/api.ts:657-699` — annotation persistence (`annotationsPath` 666, `saveAnnotations` 678 with its 1 MB cap + `<svg>` content gate + `sanitizeAnnotationSvg` call). The asset route sits beside these.
- `plugins/design/dev-server/http.ts:28-55` — `MIME` map (`.png` 39, etc.) for the asset response content-type.
- `plugins/design/dev-server/http.ts:101-104` — **the canvas CSP**: `default-src 'none'`, `connect-src 'self'`, `img-src 'self' data: blob:`. Confirms same-origin asset hrefs + blob/data preview render; external favicon does **not** (→ vector glyph).
- `plugins/design/dev-server/http.ts:~728-755` — the canvas-origin **static extension allowlist** (`.png/.jpg/.jpeg/.gif/.webp/.svg/.ico` already present) + the **inert-write route allowlist** (`/_api/annotations` etc., line 751-755). `/_api/asset` joins the write allowlist with documented caps.
- `plugins/design/dev-server/http.ts:370-596` — the `/_api/*` route map (canvas-meta 370, annotations 467, export 507, canvas-state 577). `/_api/asset` registers in this map.
- `plugins/design/dev-server/input-router.tsx:66` (Tool union) + `:92,210-215,331` (the `drop-comment` action — the *pointer* DnD, distinct from the OS-level file drop this phase adds) + `:252` (`onDropComment` callback shape, the wiring pattern to mirror for media).
- `plugins/design/dev-server/canvas-shell.tsx:399,436,685` — host event-listener attach points (`dblclick`/`mousemove`) + the existing `navigator.clipboard.writeText`. The media-drop hook attaches `drop`/`dragover`/`paste` to the same host.

### Files to Create

- `plugins/design/dev-server/use-canvas-media-drop.tsx`
- `plugins/design/dev-server/test/asset-api.test.ts`

### Documentation

- HTML5 Drag-and-Drop `DataTransfer`: `files`, `getData('text/uri-list')`, `getData('text/html')`. <https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer>
- `ClipboardEvent.clipboardData` for paste (image `File`s + text). <https://developer.mozilla.org/en-US/docs/Web/API/ClipboardEvent/clipboardData>
- SVG `<image>` `href` + `preserveAspectRatio`. <https://developer.mozilla.org/en-US/docs/Web/SVG/Element/image>
- Magic-byte signatures (PNG `89 50 4E 47`, JPEG `FF D8 FF`, GIF `47 49 46`, WEBP `RIFF…WEBP`) for content-type verification. <https://en.wikipedia.org/wiki/List_of_file_signatures>

### Patterns to Follow

- **Allowlist, never denylist** (api.ts:200-219 comment): the sanitizer learned this the hard way (`svg:script`, entity-encoded href, `url(javascript:)` all beat a denylist). The href relaxation must be a *positive* match (`^assets/…\.(png|jpe?g|webp|gif)$`), not "block the bad ones".
- **Inert collab write trust** (http.ts:749-755 + DDR-054): the canvas origin may be serving *untrusted hub-pushed* JSX. The asset route is a bigger grant than annotation-SVG writes (binary, disk) — every cap (magic-byte sniff, size, content-addressed name, traversal guard, no-SVG) is load-bearing, not optional. Document each in the DDR.
- **Content-addressed assets**: `sha8(bytes)` filename → identical drops dedupe → a malicious canvas can't fill the disk with N copies of one image, and orphan-on-delete is safe (shared content survives).
- **Schema bump back-compat** (Phase 5.1 / Phase 21 playbook): new attributes are optional `parseFloat(getAttr || default)` reads; a pre-Phase-23 `.annotations.svg` round-trips byte-identical. Pin it with the fixture test.
- **Tool palette ordering** (Phase 21 "Patterns to Follow"): media tools cluster after the draw tools, before `eraser` (which stays last).

---

## Tasks

Execute in dependency order. Every task ends with `cd plugins/design/dev-server && bun test`.

### Task 1: EXTEND the Stroke union — ImageStroke + LinkStroke

- **Do**: Add `ImageStroke { id; tool:'image'; x; y; w; h; href; alt? }` and `LinkStroke { id; tool:'link'; x; y; w; h; url; title; domain }` to the union (annotations-layer.tsx:53-100). `href` is documented as a relative `assets/…` path only.
- **Gotcha**: the union is discriminated on `tool` — `bun run tsc --noEmit` enumerates every consumer that needs a new branch. Use the type errors as the checklist (`strokeBBox`, `strokeHitTest`, `translateOne`, `isStrokeMeaningful`, `strokeToSvgEl`, `svgToStrokes`, context-toolbar `caps`).
- **Validate**: `bun run tsc --noEmit`.

### Task 2: EXTEND strokeToSvgEl + svgToStrokes (round-trip)

- **Do**: `image` branch → `<image data-id data-tool="image" x y width height href="<assets-path>" preserveAspectRatio="xMidYMid meet"/>` + optional `aria-label`/`data-alt` for alt text. `link` branch → `<g data-id data-tool="link" data-url data-title><rect x y width height rx="8"/><path d="<link-glyph>"/><text>domain</text><text>title</text></g>`. Symmetric reads with defaults.
- **Pattern**: `parseFill` (defensive null-coalescing) + the arrow `<g>` writer at line 193.
- **Gotcha**: kebab-case `data-*` names (Phase 21 learned `DOMParser` casing inconsistencies — `data-title` not `data-Title`).
- **Validate**: round-trip tests in `test/annotations-layer.test.ts` — image (href + alt), link (url/title/domain), back-compat fixture byte-identical.

### Task 3: EXTEND bbox / hit-test / translate / meaningful

- **Do**: image + link → rect-shaped bbox `{x,y,w,h}`, filled-rect hit, translate x+y. `isStrokeMeaningful`: image `w>=16 && h>=16`; link `url.trim().length>0`.
- **Validate**: extend the bbox/hit-test test cluster.

### Task 4: ADD the sanitizer extension (SECURITY — pairs with the DDR)

- **Do**: Add `'image'` to `ANNOTATION_SVG_ELEMENTS` (api.ts:189). Change Rule 3's href strip so `href`/`xlink:href` survive **only on `<image>`** and **only** matching `^assets/[A-Za-z0-9._-]+\.(png|jpe?g|webp|gif)$`. Implement as: strip all hrefs first (current behavior), then in the image-element pass re-validate and keep a compliant `href`. Keep `foreignObject`/`script`/`style` stripping and the on*/style strips untouched.
- **Gotcha**: the regex anchors matter — `^…$`, no `/` allowed beyond the single `assets/<name>` segment (block `assets/../../etc/passwd`), no query string, no scheme. An `<image href="https://evil/x.png">` or `href="data:…"` or `href="assets/../secret">` must all be stripped.
- **Validate**: `test/sanitize-annotation-svg.test.ts` — a matrix: valid assets href kept; external/`data:`/`javascript:`/`..`/non-image-element href all stripped; `<script>`/`svg:script`/entity-encoded href still dropped; a legit pre-Phase-23 SVG unchanged.

### Task 5: ADD the `POST /_api/asset` route (SECURITY — pairs with the DDR)

- **Do**: New handler in api.ts + registration in http.ts route map. Read the body as bytes; **sniff magic bytes** → resolve true type ∈ {png,jpeg,webp,gif} (reject mismatch + reject SVG); enforce ≤10 MB; compute `sha8` of bytes; write to `<designRoot>/assets/<sha8>.<ext>` via `Bun.write` after asserting the resolved path stays under `designRoot/assets`; dedupe (skip write if exists). Return `{ path: "assets/<sha8>.<ext>" }`. Add `/_api/asset` to the canvas-origin inert-write allowlist (http.ts ~751) with a comment citing the caps.
- **Gotcha**: `saveAnnotations`'s 1 MB cap is for SVG text — assets get their own 10 MB cap. Don't route assets through the SVG gate.
- **Gotcha**: ensure `assets/` is created if missing; ensure the dev-server's file watcher / file-tree ignores `assets/` as a canvas source (it's media, not a `.tsx` canvas — confirm the `findHtmlFiles` SKIP/HIDDEN logic doesn't surface it as a fake canvas).
- **Validate**: `test/asset-api.test.ts` — valid PNG/JPEG/WEBP/GIF written + path returned; header-lie (`.png` name, GIF bytes → stored as gif by sniff) ; oversized rejected; SVG rejected; traversal `name` ignored (content-addressed); identical bytes dedupe to one file.

### Task 6: ADD the DnD + paste hook

- **Do**: `use-canvas-media-drop.tsx` — attach `dragover` (preventDefault + show drop affordance), `drop`, and `paste` to the canvas-shell host. Drop/paste of image files → create an optimistic `ImageStroke` with a `blob:`/`data:` `href` at the pointer world coord (natural intrinsic size, capped to viewport) → `POST /_api/asset` → on success swap `href` to `assets/…` and `commitStrokes` (undo sink) → on failure remove the optimistic stroke + toast. URL drop/paste (`text/uri-list` / a URL in `text/plain`) → `LinkStroke` (domain from `new URL(...).hostname`; title from `text/html` anchor text when present, else prettified path). Ignore non-image files.
- **Pattern**: `onDropComment` wiring (input-router.tsx:252) for the callback shape; `screenToWorld` for the drop coord.
- **Gotcha**: the optimistic `blob:` URL must be `URL.revokeObjectURL`'d after the swap to avoid a leak.
- **Gotcha**: `paste` competes with the existing copy/paste of artboards/annotations — only claim the event when `clipboardData` has image files or a URL; otherwise let it through.
- **Validate**: manual — drag a PNG from Finder onto the canvas → uploads + renders + persists across reload; paste a URL → chip renders.

### Task 7: ADD tool-palette buttons + a11y alternatives + context toolbar

- **Do**: Register `image` + `link` in `input-router` `Tool` union + `ANNOTATION_TOOLS`, `use-tool-mode` descriptors, `tool-palette` buttons, `canvas-icons` (`IconImage`, `IconLink`). **Image button** opens a hidden `<input type=file accept="image/*">` → same upload path, places at viewport center (keyboard-accessible alternative to drag). **Link button** reveals an inline URL `<input>` → creates a link stroke on submit. Context toolbar: image selected → `alt` text field (a11y) + aspect-lock toggle; link selected → editable url/title + "Open" button (reads `data-url` → `window.open`). Extend `caps` (`caps.image`, `caps.link`).
- **Gotcha**: the `<input type=file>` must have a real `aria-label`; the URL input needs focus management (focus on reveal, Esc to cancel) per the a11y-auditor.
- **Validate**: tool palette renders both buttons; file-picker + URL-input paths create strokes without any drag gesture (keyboard-only path works).

### Task 8: EXTEND resize overlay for image + link

- **Do**: Add `image` + `link` to the resize hit-set in `use-annotation-resize.tsx`. Image resize aspect-locks by default (Shift to free-resize, matching common tools); link card free-resizes.
- **Validate**: manual — select image, drag corner, aspect preserved; select link, resize card.

### Task 9: DDR — canvas media vocabulary + asset write surface

- **Do**: Record the DDR (in the DDR-054/060 lineage). Decisions: (1) extend the annotation SVG vocabulary with `<image>` + a **constrained** `assets/`-only href allowlist (vs. inlined data URLs, rejected for the 1 MB cap + base64 bloat); (2) add a binary `POST /_api/asset` write route reachable from the canvas origin, with the full cap set (magic-byte sniff, 10 MB, content-addressed names, traversal guard, no-SVG) as the trust mitigation; (3) **link chips are client-only with no server fetch and no external favicon** (server stays zero-egress; favicon/OG-unfurl deferred behind a future CSP-relax DDR). Enumerate the SSRF/XSS/disk-fill threats each cap closes.
- **Validate**: DDR file created + linked from this plan + STATE.md History; sanitizer + asset-api tests are the executable evidence.

### Task 10: BACK-COMPAT regression test

- **Do**: Reuse / extend the Phase 21 byte-identical fixture: a hand-written pre-Phase-23 `.annotations.svg` (pen + rect + ellipse + arrow + text [+ sticky if Phase 21 landed]) must `strokesToSvg(svgToStrokes(s)) === s`. Confirms image/link additions introduce no phantom default into legacy SVGs.
- **Validate**: `bun test test/annotations-layer.test.ts`.

---

## Validation

1. **Types**: `cd plugins/design/dev-server && bun run tsc --noEmit`.
2. **Tests**: `bun test --bail` — round-trip, sanitizer matrix, asset-api, back-compat all green.
3. **Build**: `bun run build.ts` — `dist/` artifacts produced (the runtime-bundle floor check in CI guards bundle integrity).
4. **Smoke (DDR-021)**: `/design:smoke` — touches `annotations-layer.tsx` + `tool-palette.tsx` + `canvas-icons.tsx`.
5. **Manual security probe**: POST a GIF with a `.png` name → stored as `.gif` (sniff wins). POST an 11 MB file → rejected. POST an SVG → rejected. Hand-write an `<image href="https://evil/x.png">` into a `.annotations.svg`, load → href stripped, image doesn't fetch external. `<image href="assets/../../etc/x.png">` → stripped.
6. **Cross-platform scenario**: `.ai/scenarios/canvas-media/spec.md` — drag image, paste image, paste link, resize, reload-persist. Web-desktop only (DnD/paste is mouse+keyboard; native skip justified).
7. **A11y**: `a11y-auditor` — Image/Link tool buttons (aria-label, shortcut), file-input label, URL-input focus management, image `alt` round-trips to `aria-label` on the rendered `<image>`.

---

## Scenario Coverage

**New scenario** (`.ai/scenarios/canvas-media/spec.md`):

- Drag a `.png` from the OS onto the canvas → uploads to `assets/<sha8>.png` → renders at the drop point → select + resize (aspect-locked) → reload iframe → image persists.
- Paste an image from clipboard → same upload path.
- Use the **Image tool button** (no drag) → file picker → image placed at center (keyboard path).
- Paste a URL (`https://example.com/post`) → link chip renders with glyph + `example.com` + title → "Open" button opens it → reload → chip persists, carries no external href.
- Security: a hand-injected external/`data:`/`..` href in the SVG is stripped on load.

Web-desktop only required; native mobile/tablet skipped (justified — OS drag/paste + canvas media is a desktop authoring flow).

---

## Acceptance Criteria

> **Executed 2026-06-03** — all 10 tasks landed. DDR-088 records the media vocabulary + asset write surface + client-only-link rationale. Verification below; a live agent-browser pass on the running solo dev-server confirmed: link create→render→persist→reload; image upload→render→persist→reload (incl. the context-toolbar alt field); the sanitizer keeping a valid assets href + stripping an external one on the live PUT path.

- [x] All 10 tasks complete.
- [x] Drag-drop **and** clipboard-paste of images upload to `assets/<sha8>.<ext>` and render as movable/resizable strokes. _(shared `use-canvas-media-drop` hook → `createImageFromFile`; live-verified via the file-picker path.)_
- [~] Keyboard-only path — **revised per user steer (2026-06-03): the Image + Link toolbar buttons were REMOVED; media is paste/drop-only** ("staci paste primo do canvasu"). Cmd+V of a clipboard image / URL is the keyboard-reachable path; image-from-disk-without-clipboard now needs drag-drop (accepted a11y trade-off).
- [x] Paste/drop of a URL renders a client-only link chip (glyph + domain + title, click-to-open via the context-toolbar Open button); **no server outbound fetch, no external href persisted** (verified: persisted `<g>` carries `data-url`, never `<a href>`). **You do NOT need to type `https://`** — a bare `example.com` is normalized to `https://example.com` (`normalizeUrl`); `javascript:`/`data:`/`file:` still rejected. Live-verified by dropping `example.com`.
- [x] Image + link strokes persist in `<slug>.annotations.svg` and round-trip; legacy SVGs round-trip byte-identical (Phase-20 + Phase-21 canaries still green — Task 10).
- [x] Sanitizer keeps a valid `assets/` image href and strips external/`data:`/`..`/non-image hrefs + all script/style (Task 4 matrix: 20 tests green + live PUT/GET).
- [x] `POST /_api/asset` enforces magic-byte sniff + 10 MB cap + content-addressed naming + traversal guard + no-SVG (Task 5: 9 tests green + live curl).
- [x] `bun test` green (1217 pass; the 1 fail is the pre-existing flaky `export-history` parallel-CWD test, passes in isolation — unrelated); `bun run tsc --noEmit` clean (only the DDR-026 baseline); biome clean on changed files.
- [~] `/design:smoke` — superseded by a targeted live agent-browser render pass on the solo dev-server (palette buttons + link chip + image render + context toolbars all confirmed). Full `/design:smoke` deferred to `/flow:done`.
- [~] `a11y-auditor` — deferred to `/flow:done`. Built-in: tool buttons carry aria-labels; the file input has a real `aria-label`; the URL input focus-manages on reveal + Esc-cancels; image `alt` round-trips to `aria-label` on the rendered `<image>`; the decorative link glyph is `aria-hidden`.
- [x] DDR-088 (media vocabulary + asset write surface + client-only-link rationale) written + cross-linked.
- [x] No regression in existing draw / select / sticky / undo flows (full suite + live link/image select+resize).

**Live-verification learning (folded into DDR-088):** the asset route lives in TWO allowlists — `CANVAS_SAFE_API` (fetch fall-through) **and** the `startCanvasServer` `routes` map (Bun matches it first). Listing it only in the former 404'd the upload from the canvas iframe (optimistic image flashed then vanished). `canvas-origin-gate.test.ts` now guards the invariant (`GET /_api/asset → 405`, reached-but-method-gated). Also: a relative `assets/…` href 403s against `/_canvas-shell.html`; `resolveAssetHref` rewrites it to `/<designRel>/assets/…` at render time while persistence stays relative.

---

## Retro

- **Live verification earned its keep — twice.** Static checks + 1200 unit tests were all green, yet agent-browser caught two real defects that would have shipped broken: `/_api/asset` 404'd from the canvas iframe (the route was in `CANVAS_SAFE_API` but not the `startCanvasServer.routes` map Bun matches first), and a relative `assets/…` href 403'd against `/_canvas-shell.html` (needed `resolveAssetHref`). Lesson for `/plan`: for any dev-server route reachable from the segregated canvas origin, the plan should call out **both** allowlists as a single task, and a render-path resolution check belongs in the acceptance criteria, not just "it persists".
- **The discriminated `Stroke` union does NOT fail tsc on missing branches** — consumers use `if (s.tool === …)` fall-through chains, not exhaustive switches, so a new union member silently misroutes at runtime (the `findStrokeId` move-bug that the user caught post-merge is exactly this). The plan's Task-1 gotcha assumed tsc would enumerate consumers; it didn't. Next time: grep every `\.tool === '` site as the checklist, or add an exhaustiveness `assertNever` to the union's consumers.
- **Security-sensitive surface → independent adversarial pass paid off.** The `/done` ethical-hacker found the unbounded-body / dedup-isn't-a-quota DoS that the defender + my own implementation rationalized away ("content-addressed → safe"). Dedup is a storage optimization, not a disk-fill defense — a one-byte mutation defeats it. The fix (`maxRequestBodySize` + session budget) was cheap once named.
- **Product steer mid-flight was cheap because intake was already centralized.** Removing the toolbar buttons was a clean revert (net-zero diff on `tool-palette.tsx`) because all stroke creation lived in `AnnotationsLayer` and the buttons were just event sources. Designing the create path as "one owner, many input sources" made the UI surface disposable.
- **`esc()` not escaping `>` was a latent foot-gun** the moment user text moved from element *content* (where `>` is harmless) into *attributes* (`data-title`/`data-url`/`data-alt`). Added `escAttr`. Worth auditing the other annotation serializers for the same content-vs-attribute distinction.
