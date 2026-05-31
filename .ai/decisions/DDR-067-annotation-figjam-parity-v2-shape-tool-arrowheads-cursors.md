# DDR-067 — Annotations FigJam-parity v2: shape-tool data model, arrowhead vocabulary, Kenney CC0 cursor pack

- **Status:** Accepted
- **Date:** 2026-05-30
- **Phase:** 24 ([`.ai/plans/phase-24-annotations-figjam-parity-v2.md`](../plans/phase-24-annotations-figjam-parity-v2.md))
- **Supersedes / extends:** Phase 21 annotation vocabulary ([`096f0bf`](../plans/archive/phase-21-annotation-vocabulary-figjam.md))
- **Scope:** `plugins/design/dev-server` canvas chrome (annotations layer, context toolbar, tool palette, cursors, icons, input router)

## Context

Phase 21 shipped the FigJam-style annotation vocabulary (sticky / standalone text / rect corner-radius / arrow heads+dash / dark toolbars / custom cursors), but the chrome was visually + behaviourally off from FigJam. The Phase 24 brief (user, 7 points) asked for: a ghost placeholder, square dim-palette left-aligned stickies, ONE shape tool with a kind switcher, the full arrowhead set + line-types, richer text controls, and a cohesive cursor pack. The load-bearing constraint was **byte-identical legacy round-trip** + a **100%-no-regression** bar (the user's standing exhaustive-verify rule).

This DDR records the data-model + licence decisions that have future consequences.

## Decisions

### 1. Single Shape tool; `rect`/`ellipse`/`polygon` stay the on-disk discriminants

The palette collapses the two `rect` (R) + `ellipse` (O) buttons into ONE active `shape` tool (added to the `Tool` union) plus a `shapeKind` selector (`square | rounded | circle | diamond | triangle | triangle-down`) in `use-tool-mode`. The kind maps onto the **existing** stroke model at create time:

| Kind | Stroke produced | Geometry |
| ---- | --------------- | -------- |
| square / rounded | `rect` (cornerRadius 0 / 8) | x/y/w/h |
| circle | `ellipse` | cx/cy/rx/ry |
| diamond / triangle / triangle-down | `polygon` (NEW) | bbox x/y/w/h + `shape` |

`rect` / `ellipse` remain in the `Tool` union (no longer directly selectable; still valid stroke `tool` values). Both `r` and `o` keys now arm `shape`. **Why:** keeps rect/ellipse byte-identical on disk (no migration), and the active-tool → stroke-tool indirection isolates UI consolidation from the persisted schema.

`PolygonStroke` is **brand-new** on disk (`<polygon data-tool="polygon" data-shape="…" points="…">`) — no back-compat constraint, only idempotent round-trip. Points derive from the bbox (every shape's vertices span the full bbox, so parse-back via points' min/max recovers x/y/w/h exactly). A bare tap with the Shape tool drops a default-sized (120²) shape at the tap point (FigJam "click to place"); a drag sizes it.

### 2. Arrowhead vocabulary widened to 6 per end + 3 line-types — non-default-only serialization

`ArrowHead = 'none' | 'line' | 'triangle' | 'triangle-outline' | 'circle' | 'diamond'` (per end); `ArrowLineType = 'straight' | 'curved' | 'elbow'`. Defaults stay `start='none'`, `end='triangle'`, `lineType='straight'` so a legacy arrow serializes byte-identically (a `data-*` attr appears **only** for a non-default value). Curved = quadratic bézier (perpendicular-offset control); elbow = single orthogonal bend along the dominant axis. **Elbow shipped this phase** (the plan time-boxed it as a potential deferral; the single-bend impl was small + robust enough to land).

Arrow geometry (shaft + heads) is the single source of truth in **`canvas-arrowheads.ts`** (`arrowPrimitives()` → ordered `SvgPrimitive[]`). The serializer formats each primitive to a string; `StrokeNode` maps the SAME primitives to JSX — so the on-disk and on-canvas forms can never drift. Curved/elbow arrows persist a `<path>` (not `<line>`); the parser recovers endpoints from the first + last coordinate pairs of the `d`.

### 3. Cursor pack: Kenney (CC0), NOT Bibata (GPL-3.0)

**Licence gate (hard invariant):** any embedded cursor asset must be redistributable inside an MIT npm package + marketplace clone. **CC0 = safe (no attribution). GPL/AGPL = BLOCKER (copyleft would relicense the package).**

- **Bibata** (ful1e5) — visually excellent BUT **GPL-3.0 → rejected.**
- **Kenney Cursor Pack 1.1** — **CC0 1.0** (verified `License.txt`: "free to use in personal, educational and commercial projects… crediting … is not mandatory"). **Chosen** (user-confirmed: "líbí se mi ta kenney kolekce"). pen / hand / shape / eraser / text adopt Kenney "Outline" glyphs (black-outline + white-fill → legible on light AND dark canvases). comment + sticky have no Kenney equivalent and stay hand-authored in a compatible flat style. Glyph paths embedded verbatim as inline-SVG data-URI cursors (no asset files, no runtime dep).

### 4. Sticky polish

Stickies are now 1:1 (square) — enforced at create (drag snaps to the larger axis) + resize (corner drag keeps w=h); default tap = 200². The palette is 10 muted FigJam tints (slot 0 = muted yellow `#fce8a6`); existing stickies keep their stored hex (only NEW stickies get the new default). Body text sits top-left. The corner-radius switch is removed for stickies (fixed soft radius). **Latent bug fixed:** the per-selection context toolbar painted sticky swatches from `STROKE_PALETTE` (ink) — it now shows `STICKY_PALETTE` (paper tints) for sticky selections.

### 5. Text bold / strike / align on text + sticky (non-default-only)

`bold?` / `strike?` / `align?` added to `TextStroke` + `StickyStroke`. Defaults: bold/strike false; align = `center` for anchored text (legacy), `left` for standalone + sticky. Serialized only when non-default (`font-weight="700"`, `text-decoration="line-through"`, `data-align="…"`) so legacy nodes round-trip byte-identical. Named size presets (Small 12 → Huge 64) + a numeric input (clamped 8–200) replace the 3 fixed chips.

### 6. Sanitizer allowlist + module-cycle lesson (load-bearing)

- `sanitizeAnnotationSvg` (DDR-060 F1) allowlist gained `polygon` + `circle` (inert shape elements — same safety class as the existing vocabulary; needed for polygon strokes + circle/diamond/outline arrowheads). `data-*` attrs already survive (only `on*`/`style`/`href` are stripped), so the new `data-shape`/`data-bold`/`data-strike`/`data-align`/`data-line-type` round-trip.
- **`canvas-arrowheads.ts` imports NOTHING from `annotations-layer.tsx`** (it owns `ArrowHead`/`ArrowLineType` + a structural `ArrowGeom` input; annotations-layer re-exports those types). **Why this matters:** a top-level `.ts` file matched by tsconfig `include: ["*.ts"]` that sits in a **re-export cycle** with a react `.tsx` breaks `@types/react`'s global `JSX` namespace **project-wide** under `types: ["bun-types"]` — every `JSX.Element` annotation in unrelated files errors. Keeping the dependency one-way (annotations-layer → canvas-arrowheads) avoids the cycle. The pre-existing `canvas-cursors.ts → input-router.tsx` works precisely because it is NOT a cycle.
- **`tsc` tolerated a stray backtick inside a CSS template literal that bun's parser rejected** — a syntax error showed as 3 (baseline) under `bun tsc … | grep -c error` but `bun test` failed to load the module (appearing as a hang). Lesson: a green `tsc` count is NOT sufficient; the `bun test` run (the real runtime parser) is the authoritative parse gate.

### 7. Security review fixes (`/flow:validate` security fan-out)

The defender pass on the annotation surface (persisted + peer-synced under linked mode, DDR-054 §3) flagged two XSS blockers, both fixed with regression tests (`test/sanitize-annotation-svg.test.ts`, `test/annotations-roundtrip.test.ts`):

- **Sanitizer quote-glued-handler bypass (high, pre-existing, widened by this phase).** `sanitizeAnnotationSvg`'s attribute denylist anchored on a *consumed* leading `\s`, so a handler glued to the previous attribute's closing quote (`<circle r="2"onload="…"/>` — a distinct attribute to HTML/SVG parsers) survived. Adding `circle`/`polygon` to the allowlist widened the affected element set. **Fix:** the leading boundary is now a non-consuming **lookbehind** `(?<=[\s"'/])`, catching glued handlers while leaving the preceding quote intact. (A full re-parse-and-re-emit-allowlisted-attrs rewrite is the more robust long-term option, noted for a future hardening pass.)
- **Arrowhead round-trip — unvalidated parse + unescaped serialize (medium, this phase).** `data-start-head`/`data-end-head` were the only Phase-24 round-trip attrs cast `as ArrowHead` unchecked on parse and re-interpolated without `esc()`. **Fix (defense-in-depth):** parse now clamps against `ARROW_HEADS` (canvas-arrowheads.ts), the serializer `esc()`s the values, and `headPrimitives` gained a safe `default: return []` (an out-of-vocab head renders nothing instead of throwing a per-stroke render `TypeError`).
- **Tool-cursor bridge — untrusted cursor string applied app-wide (medium, this phase; caught by the `/flow:done` review fan-out, post-`/flow:validate`).** The "custom cursor across the whole app" feature (above) originally posted the cursor *string* from the canvas iframe to the shell, which interpolated it into a global `* { cursor: … !important }` rule on the **un-CSP'd** main origin after a shape-regex check. The adversarial pass proved a fully URL-encoded SVG data-URI (`<`/`>` → `%3C`/`%3E`) passes that regex, so a malicious *synced* canvas (DDR-054 — content untrusted, hub-pushable) could push an **invisible or displaced** cursor across the whole shell → a clickjacking aid over destructive controls (comment-delete, rollback, Backspace-delete). **Fix (token-resolution, not string-validation):** the bridge now carries only a tool *token*; the shell resolves it via `resolveToolCursor()` to a value from the frozen `TOOL_CURSORS` map (own-property + `[a-z-]` + typeof guards), so **no attacker-controlled bytes reach the stylesheet** — the canvas can only pick a known, always-visible glyph. The user's "cursor everywhere in the UI" requirement is preserved (the rule stays global; only the *value* is now trust-resolved). `TOOL_CURSORS` is `Object.freeze`d (defense-in-depth + truthful docstring), and `test/canvas-cursors.test.ts` pins the confinement (rejects unknown / prototype-chain / case / whitespace / non-string / `toString`-coercion tokens; the old full-string vector no longer parses). The defender + attacker re-audit both returned **0 blockers / prior blocker CLOSED**. **Residual (accepted, low):** the shell still trusts the canvas to *name* its active tool, so a hostile canvas can show a *wrong-but-visible* glyph (e.g. arrow while eraser is armed) — a cosmetic nuisance, not a redress primitive (every reachable cursor is visible + hotspot-honest). The principled long-term close is for the shell to derive the cursor from its own active-tool state; deferred as not load-bearing.
- **Not addressed (pre-existing, out of scope):** the PUT `/_api/annotations` endpoint accepts any `file` from a canvas-origin caller (a hub-pushed canvas can write a sibling's `.annotations.svg`) — a DDR-054 linked-mode authz concern, unchanged by this phase; the sanitizer hardening above mitigates the XSS payload class that endpoint could carry.

## Deferred

- **Draw-time arrow "inherit last choice"** (Task 6 step 3): the per-selection context-toolbar dropdowns fully cover head/line-type editing + rendering + round-trip; the secondary "new arrows inherit the last head/line-type" draw-time quick-pick is deferred to a clean follow-up. Not load-bearing — new arrows use the FigJam default (start none / end triangle / straight).

## Consequences

- Legacy `.annotations.svg` files round-trip byte-identical (two frozen canaries: `phase-20-annotations.svg` + new `phase-21-annotations.svg`).
- The annotation SVG vocabulary now includes `polygon` + `circle`; any future raw-renderer / sanitizer change must keep them allowlisted.
- Cursor assets are CC0 — no NOTICE/attribution obligation, but the provenance is recorded here + in the `canvas-cursors.ts` header.

### Cursor coverage + sizing (post-review user feedback)

- **24px, not 32px.** Cursors render in a 24px box (32-unit `viewBox` scaled down); the raw 32px Kenney glyphs read as oversized. Hotspots scale with the box.
- **text + sticky authored.** Kenney has no clean I-beam (`pointer_i` is a small bracket) and no sticky-note glyph (`drawing_pen` is a luggage tag that reads as a pen) — so `text` (classic I-beam) and `sticky` (folded-corner note) are AUTHORED in the same dark-glyph + white-halo treatment to keep one identity. The other six are Kenney CC0.
- **Custom cursor across the WHOLE app, not just empty canvas.** Two layers: (1) inside the canvas, `useToolMode` injects `* { cursor: <tool> !important }` so the cursor wins over artboard CONTENT cursors everywhere in the canvas document (the brief: "prostě všude"); (2) the canvas iframe posts `{dgn:'tool-cursor', tool}` to the outer app shell, which resolves the token to a trusted cursor and applies `* { cursor: <tool> !important }` so the sidebar / top bar show it too. **Security (token-resolution, NOT string-trust — see §7 finding 3):** the shell sends/receives only a tool *token* (`'pen'`, `'shape'`, …), never a cursor string. The shell calls `resolveToolCursor(token)` (canvas-cursors.ts), which returns a value **only** from the frozen `TOOL_CURSORS` map (guarded `typeof` + `/^[a-z-]+$/` + `Object.prototype.hasOwnProperty`), so a malicious synced canvas (DDR-054) can at most pick which of the 11 known, always-visible glyphs shows — it cannot inject an invisible/displaced/zero-content SVG cursor. (An earlier impl validated an untrusted cursor *string* against a `url("data:…") n n, kw` shape regex; the adversarial review proved a `%3C…%3E`-encoded invisible SVG could pass it → replaced by token-resolution.)
- **Cache-invalidation fix (the recurring "my chrome edit didn't show up" bug).** The cursor/chrome code ships via the on-demand canvas transpile (canvas-lib → use-tool-mode → canvas-cursors), which `http.ts` caches with an ETag derived only from the canvas SOURCE + its inlined CSS — not the bundled chrome. So a chrome edit left the etag unchanged → the browser's `If-None-Match` matched → **304 → stale transpile served even after a server restart**. Two-part fix (`http.ts`): (1) the canvas ETag now folds in a per-boot `RUNTIME_BOOT_ID` (restart busts the browser cache) **and** a `CHROME_EPOCH` counter bumped by the source watchers (a LIVE chrome edit busts it); (2) the `devSrcWatcher` now watches `.ts` as well as `.tsx`, because `canvas-cursors.ts` / `canvas-arrowheads.ts` are plain `.ts` chrome modules the `.tsx`-only filter was skipping. Net: editing any chrome `.tsx`/`.ts` now propagates to the browser on the next reload (and the HMR hard-reload), no manual cache-bust needed. `test/canvas-route.test.ts` updated for the new `<hash>-<bootId>-<epoch>` etag shape.
