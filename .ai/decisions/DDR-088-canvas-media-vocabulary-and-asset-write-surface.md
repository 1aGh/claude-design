# DDR-088 — Canvas media: `<image>` annotation vocabulary + a capped binary asset-write surface + client-only link chips

**Status:** Accepted — 2026-06-03.
**Supersedes:** none. **First of its kind:** the first **binary** write route the dev-server exposes, and the first href ever allowed to survive `sanitizeAnnotationSvg`.
**Related:** [DDR-054](DDR-054-self-hostable-hub-trust-model.md) (the canvas origin is "untrusted to peers" — hub-pushed JSX; this route is a bigger grant than the inert annotation-SVG write, so its caps are the trust mitigation); [DDR-060](DDR-060-annotation-svg-sanitizer-allowlist.md) (the allowlist sanitizer this extends — `<image>` is the first href-bearing exception); Phase 21 (the selection/resize/commit machinery image + link strokes reuse); Phase 5.1 / Phase 20 (`<slug>.annotations.svg` persistence + the `AnnotationStrokesCommand` undo sink); [DDR-085](DDR-085-canvas-kind-and-design-new-ingest-mode.md) (the `read-annotations` reader is already forward-compatible with `image`/`link` strokes); [DDR-067](DDR-067-react-free-draw-engine.md) (the esc-every-interpolated-value defence the media serializers follow).
**Instruments:** `plugins/design/dev-server/annotations-layer.tsx` (`ImageStroke`/`LinkStroke` union members; `strokeToSvgEl`/`svgToStrokes` round-trip; `StrokeNode` render branches; `resolveAssetHref`; the DnD/paste create path); `plugins/design/dev-server/use-canvas-media-drop.tsx` (the drop/paste hook + URL helpers + `uploadAsset`); `plugins/design/dev-server/api.ts` (`ANNOTATION_SVG_ELEMENTS` + `ASSET_IMAGE_HREF_RE` + the `sanitizeAnnotationSvg` href hoist/restore + `sniffImageType` + `saveAsset`); `plugins/design/dev-server/http.ts` (`POST /_api/asset` route + the `CANVAS_SAFE_API` entry); `plugins/design/dev-server/server.ts` (the `startCanvasServer` `routes` allowlist entry); tests: `asset-api.test.ts`, `canvas-media-drop.test.ts`, the `sanitize-annotation-svg.test.ts` href matrix, the `annotations-roundtrip.test.ts` image/link blocks, `canvas-origin-gate.test.ts` (the dual-allowlist guard).

## Context

The user wants to **drop a screenshot onto the canvas** and **paste a link that renders as a tidy card** — the FigJam move where reference material lives next to the work. The canvas had zero of this (verified greenfield: no image primitive, no clipboard read, no OS drop, no asset route, and the sanitizer actively stripped `<image>` + every `href`).

Two new free-floating objects, modeled as annotation strokes so they reuse Phase 21's selection / resize / move / undo machinery and persist in the same `<slug>.annotations.svg`. The security-sensitive surface is the reason for this DDR: extending the annotation SVG vocabulary to allow `<image href>`, and adding a **binary** write route reachable from the (potentially hub-pushed-untrusted) canvas origin.

## Decision

### 1. Extend the annotation vocabulary with `<image>` + a **constrained** `assets/`-only href — not inlined data URLs

`ImageStroke.href` is **always** a relative `assets/<sha8>.<ext>` path. The sanitizer (`sanitizeAnnotationSvg`) keeps `href`/`xlink:href` **only on `<image>`** and **only** when the value matches `ASSET_IMAGE_HREF_RE = /^assets\/[A-Za-z0-9._-]+\.(?:png|jpe?g|webp|gif)$/`. Implementation preserves the DDR-060 "strip every href, zero bypass" invariant: a pre-pass neutralizes any input-supplied marker, then hoists a **regex-valid** image href into a sanitizer-inert `data-mdcc-asset` marker, the three allowlist rules run unchanged (still stripping every other href + all `on*`/`style`), and a post-pass **re-validates** the marker before restoring it to `href`. A forged marker can therefore only ever resolve to a safe same-origin assets path — never a scheme or traversal.

- **vs. inlined `data:` URLs** (the obvious alternative — self-contained SVG, no second file). Rejected: a base64 raster blows past `saveAnnotations`'s 1 MB SVG cap, bloats every sync/collab Y.Map round-trip, and re-opens the `data:`-href hole the sanitizer exists to close. A relative reference keeps the SVG tiny and the href shape trivially matchable.
- The anchored, single-segment regex (`^…$`, no `/` beyond the one `assets/` segment, no query, no scheme) is the **traversal guard**: `assets/../../etc/passwd`, `assets/sub/dir/x.png`, `assets/x.svg`, `https://evil/x.png`, `data:…` all fail the match → stripped (proven by the `sanitize-annotation-svg.test.ts` matrix + a live PUT/GET on the running server).

### 2. A binary `POST /_api/asset` write route — reachable from the canvas origin, gated by a load-bearing cap set

`api.saveAsset(bytes)` is the first binary write the dev-server exposes. Because the canvas origin may be serving untrusted hub-pushed JSX (DDR-054), **every cap is the trust mitigation, not optional**:

- **magic-byte sniff** (`sniffImageType`) → true type ∈ {png, jpeg, gif, webp}. The declared name / extension / Content-Type is never trusted (a `.png` name carrying GIF bytes is stored as `.gif`). **SVG matches nothing → rejected (415)** — no script-bearing vector rides in through the image route.
- **10 MB ceiling** — assets get their OWN cap; they are never routed through the 1 MB SVG-text gate.
- **content-addressed name** `assets/<sha8-of-bytes>.<ext>` → identical drops dedupe, so a malicious canvas can't fill the disk with N copies of one image, and orphan-on-delete is safe (shared content survives).
- **resolved-path containment assert** (defence-in-depth; the name carries no user input, but a poisoned `designRoot` must still not escape).

### 3. Link chips are **client-only** — no server fetch, no external favicon (the server stays zero-egress)

A pasted/dropped URL renders as a `<g data-tool="link">` (rect + a vector link glyph + domain/title `<text>`) — all in the existing allowlisted vocabulary, **no `<a href>` persisted**. Title comes from the clipboard/DnD `text/html` anchor text when present, else the prettified URL; the domain from `new URL(url).hostname`. Click-to-open reads `data-url` client-side and **validates http(s) before `window.open`** (the URL helpers reject `javascript:`/`data:`/`file:` at create AND open time). You do **not** need to type a scheme — `normalizeUrl` prepends `https://` to a scheme-less but domain-shaped token (`example.com`, `sub.example.io:8080/path`; a bare decimal like `3.5` or `host:port` with no dot is NOT mistaken for a domain), so a bare-domain paste still becomes a safe https link.

**Intake is paste/drop-only (no toolbar buttons).** An earlier iteration added Image (file-picker) + Link (URL-input) palette buttons as keyboard-accessible alternatives; per product steer they were removed — dropping a file/URL or `Cmd+V`-ing a clipboard image/link straight onto the canvas is the whole surface. `Cmd+V` keeps the keyboard path for clipboard content; image-from-disk-without-clipboard is the one drag-only gap (accepted).

- **vs. a server-side OG / `og:image` unfurl** (the rich-preview option) and **vs. real favicons via a public icon service**. Both rejected for v1: the first makes the dev-server egress to arbitrary attacker-chosen URLs (SSRF, and the lethal-trifecta surface DDR-054 §3 guards against); the second needs a CSP `img-src` relaxation to a third-party origin. A vector glyph keeps the server zero-egress and the canvas CSP (`img-src 'self' data: blob:`) untouched. Revisit behind a future CSP-relax DDR if a real preview is wanted.

### 4. The render resolves `assets/…` → `/<designRel>/assets/…`; the persisted form stays relative

The sanitizer allowlists the **relative** `assets/<name>` shape, but a bare relative href resolves against `/_canvas-shell.html` → `/assets/…`, which the canvas-origin gate 403s (it isn't under `designRoot`). So `StrokeNode` resolves the href to the served `/<designRel>/assets/<name>` path at **render** time (`resolveAssetHref`), while persistence keeps the relative form. An optimistic `blob:` preview href (pre-upload) is used verbatim and revoked after the swap. (Caught in live verification — without it images silently 403'd.)

## Consequences

- **The asset route lives in TWO allowlists that must stay in sync.** `CANVAS_SAFE_API` (the `http.fetch` fall-through gate) AND the `startCanvasServer` `routes` map (which Bun matches *before* `fetch`). Listing it in only the former 404s the route from the canvas iframe — the exact bug found in live verification, where an upload flashed an optimistic image then removed it on the 404. `canvas-origin-gate.test.ts` now asserts `GET /_api/asset → 405` (reached, method-gated) — not 403/404 — to guard the invariant.
- **Orphan assets are not GC'd in v1.** Deleting an image stroke may orphan its `assets/` file; content-addressing bounds growth and a shared file survives. A future `maude design asset-sweep` extension is backlog.
- The annotation reader (DDR-085) needs no change — it was already forward-compatible with `image`/`link` strokes.

## Security review (`/flow:done`, 2026-06-04) — outcome

Defender + adversarial + a11y passes all returned **PASS, 0 blockers** (no XSS/SSRF/privilege-escalation/sanitizer-bypass chain found; the sanitizer resisted the named vectors plus the 2025 SVG-sanitizer CVE classes). Findings actioned:

- **MEDIUM (DoS) — addressed.** Unbounded request-body buffering + no aggregate quota on `/_api/asset` from the untrusted canvas origin. Fixed: `maxRequestBodySize: 16 MB` on both `Bun.serve` instances (memory amplification) + `ASSET_SESSION_BUDGET` (256 MB, `MAUDE_ASSET_SESSION_BUDGET` override) per-instance write ceiling (disk-fill). The threat-table dedup row above is reworded to be honest about what content-addressing does and doesn't bound.
- **LOW — addressed.** Served files now carry `X-Content-Type-Options: nosniff` (no MIME-sniff of an image polyglot into a richer type — defense-in-depth on top of CSP `script-src 'self'`).
- **LOW — deferred (documented).** (1) `sanitizeAnnotationSvg` Rule 3 can *corrupt* (never breach — `escAttr` prevents breakout) a `data-title`/`data-alt` whose text literally contains `href=`/`on…=`/`style=`; the value is inert, only mangled. A safe fix is a tag-scoped attribute strip, deferred to avoid churn on the security-load-bearing regex. (2) The persisted link `data-url` is not http(s)-stripped by the sanitizer (only the open-time `isHttpUrl` gate enforces it) — clean today, a defense-in-depth strip is backlog for any future raw consumer. (3) Phase 23 *widens* (does not open) the DDR-085 ingest injection surface with structured `url`/`href`/`title` fields; the `/design:new` brief jq filter already selects only `.text` + data-frames it — kept as an asserted invariant, with the DDR-085 architectural close (fetch-allowlisted ingest research) still the tracked follow-up.
- **a11y — PASS, 0 blockers.** Image `alt` round-trips to the *exported* SVG; the live annotation root is intentionally `aria-hidden` editor chrome (the misleading source comment was corrected). Touch targets 26 px (WCAG 2.2 AA pass, AAA fail — noted).

## Threats each cap closes (enumerated)

| Threat | Closed by |
| --- | --- |
| Stored XSS via `<image href="javascript:…">` / `xlink:href` | `ASSET_IMAGE_HREF_RE` strips every non-assets href; restore-pass re-validates |
| Path traversal write/read (`assets/../../etc/x`) | single-segment regex (no `/`) + `saveAsset` containment assert |
| Off-origin fetch / SSRF via image or link | href allowlist (no external) + link chips never fetch + CSP `img-src 'self'` |
| Script-bearing SVG upload | `sniffImageType` returns null for XML/text → 415 |
| Disk-fill DoS | content-addressing dedupes IDENTICAL bytes only (a one-byte mutation defeats it — it is a storage optimization, NOT a quota), so the real bound is the **per-server-instance `ASSET_SESSION_BUDGET`** (256 MB, env-overridable) added after the security review |
| Oversized-body DoS / memory amplification | per-route 10 MB ceiling **+** `maxRequestBodySize: 16 MB` on both `Bun.serve` instances (bounds the pre-handler buffer — Bun's 128 MB default would otherwise buffer before `saveAsset`'s check) |
| `javascript:` reaching `window.open` | `isHttpUrl` gate at create + open |
| Untrusted iframe reaching the route at all | gated by `CANVAS_SAFE_API` + the explicit canvas `routes` allowlist; every other privileged route (`/_api/canvas`, `/_api/export`, `/_config`) stays 403 |
