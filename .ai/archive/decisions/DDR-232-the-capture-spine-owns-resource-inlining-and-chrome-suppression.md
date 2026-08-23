# DDR-232 — The capture spine owns resource inlining and chrome suppression; format × scope is a validated pair

- **Date:** 2026-08-23
- **Status:** accepted
- **Extends:** [DDR-231](./DDR-231-hybrid-export-lanes-images-in-the-member-browser-video-on-maude-render.md) (hybrid export lanes), [DDR-230](./DDR-230-render-workers-amend-containment-tenant-tsx-evaluates-only-in-maude-render.md)
- **Tags:** export, capture, containment, csp, dev-server

## Context

DDR-231 split export into three lanes — `local` (desktop playwright, the fidelity
reference), `browser` (the member's own browser), `remote` (maude-render) — over one
shared in-page spine, `apps/studio/exporters/capture-core.ts`.

The first live cloud run produced artifacts that were visibly wrong: the artboard's
own title bar rendered into the file, and every photo missing. Two of the three
diagnoses in the plan turned out to be wrong; the reproduction is what corrected them.

## Decision

### 1. The capture spine does its own resource inlining. dom-to-svg's is not used.

`dom-to-svg@0.12.2` writes image URLs to `xlink:href` and reads them back as
`element.href.baseVal` — the SVG2 `href` attribute, which on a document built with
`createElementNS` is `''`. Its own `assert(url, 'No URL passed')` therefore throws for
every image, and it **catches and `console.error`s its own failure**. The export came
out with remote hrefs, zero `data:` URIs, and no thrown error anywhere.

**Image inlining had never worked in this lane, on any host.** The cloud capability
token was a red herring — it reproduces on a plain same-origin localhost fixture. The
desktop looked healthy only because its PNG is a playwright screenshot, not a
dom-to-svg reconstruction; its own **SVG** export was equally broken and unnoticed.

`inlineCaptureResources` replaces it: **fetch first** (keeps the original bytes and
MIME, so a vector logo stays vector), **decoded-`<img>` → canvas → `toDataURL()`
second** (no network, so it survives a fetch the context refuses — a credentialed URL,
an opaque origin). Both `href` and `xlink:href` are written. `<style>` `url()`s are
inlined the same way, which is what keeps webfonts from silently falling back.

A capture also **waits** for `document.fonts.ready` and every in-target `<img>` decode,
bounded — the playwright hosts got this free from navigation; the live-canvas host has
no navigation to get it from.

### 2. Editor chrome is suppressed by the spine, from one shared list.

`_shell.html`'s `#canvas-hide-chrome` block only helps a host that NAVIGATES with
`?hide-chrome=1`. The browser lane captures the live canvas, where the block is still
`media="not all"`. The selector list now lives in `exporters/capture-chrome.ts`,
applied by the spine in **both** hosts, with the hidden nodes **removed** from the
output (an empty `<g>` still carried the artboard title as `aria-label`) and dangling
`aria-owns` idrefs scrubbed. `test/canvas-hide-chrome.test.ts` fails if the two copies
disagree in either direction.

### 3. A capture shim reuses the page's own spine — or injects CSP-safely — never inline.

The render worker always loads the canvas from the CANVAS origin, whose shell CSP is
`script-src 'self' 'sha256-…'`. `page.addScriptTag({path|content})` injects an INLINE
script, which that CSP refuses — so **worker-lane SVG failed 100%**, and the same wall
still blocks worker-lane video (`_video-playwright.mjs` injects its encoder the same
way). Measured, not assumed:

| injection | under `script-src 'self' 'sha256-…'` |
| --- | --- |
| `addScriptTag({content})` | **blocked** |
| `addInitScript({content})` (pre-navigation) | works |
| `page.evaluate` | works |

`_svg-playwright.mjs` now prefers `window.__maudeCaptureCore` + the importmap's
`dom-to-svg`, which a real canvas already has, and injects only as a fallback. **No
CSP was relaxed** — `cspForCapture()` was deliberately not extended to the canvas
origin, because it trades `unsafe-inline`/`unsafe-eval` for the egress lock and the
canvas origin already executes tenant modules. The worker now runs literally the same
capture code the member's browser runs.

### 4. `format` × `scope` is validated as a PAIR, server-side, from one table.

`/_api/export-jobs` validated `isFormat` and `isScope` independently and never the
combination. `{format:'pdf', scope:'project-raw'}` — two individually valid values —
resolves to a `file-tree` target, which the render service correctly refuses because it
holds no checkout. Every layer behaved as specified; the pair was never legal and
nothing said so. The reported symptom was `render service refused the job: invalid
render job` for PDF and HTML.

The table lived in `client/app.jsx` and `export-dialog.tsx` and in **neither server**,
and had already drifted (the in-canvas copy was missing mp4/webm/gif). It is now
`exporters/format-scopes.ts`, read by both dialogs and both servers; the route refuses
an incoherent pair with a sentence naming the remedy, and the render service's
`validBody` became `rejectReason` so its 400 names the field.

### 5. A browser-lane export is recorded in the same ledger every other export uses.

The browser lane has no job, so nothing wrote history and the member saw a modal close
with no trace ("v exports dialog nic nevidim"). `POST /_api/export-history` +
`recordBrowserExport` add a row flagged `deliveredInBrowser`, so no UI offers a
download for bytes the cell never held.

## Consequences

- The three lanes are held to one artifact contract — no editor chrome, no remote
  `http(s)` refs, assets present as `data:` — asserted end-to-end on real bytes in
  `apps/studio/test/export-e2e-lanes.test.ts` (browser + worker) and
  `apps/desktop/e2e/scenarios/export-formats.e2e.ts` (native). The web one is a
  **required** CI job; layer tests alone were green through both live defects.
- Two further viewer-role defects fell out of writing those tests:
  `/_api/export-assemble` was not in the read-only allowlist (a viewer could not export
  a deck at all), and the single-artboard capture branch matched `pptx`, making the
  dedicated deck branch unreachable and silently degrading it to the worker.
- **Video, second pass (same day):** reproduced on a 12-frame fixture with the exact
  production error, then fixed with `addScriptCspSafe` (`bin/_pw-launch.mjs`): the
  bundle is served at a same-origin virtual URL via Playwright request interception and
  added as `<script src>` — CSP checks the URL's origin (`'self'`), and as a real module
  script it still resolves the shell importmap the render lib needs (it externalizes
  `remotion`). `addInitScript` was measured and rejected: it runs before the importmap
  exists. Worker mp4 renders un-degraded (fast path, not the muted fallback); mp4/webm/gif
  are in the worker e2e, mp4/gif in the native e2e. The OOM hypothesis was never the
  first fault.

## Alternatives rejected

- **Serve `cspForCapture()` on the canvas origin for `?hide-chrome=1`.** One line, and
  it fixes every shim at once — but it hands `unsafe-inline`/`unsafe-eval` to anyone
  who appends a query param to a tenant-code origin. Reusing the page's own spine costs
  nothing and relaxes nothing.
- **Patch dom-to-svg's `href.baseVal` read.** A vendored patch would need DDR-176's
  per-workspace registration mirrored into `apps/studio`, and it would still leave the
  fetch-only strategy that fails on a credentialed asset. Owning ~80 lines in the spine
  is cheaper and strictly more capable.
- **Keep the scope table in the dialogs and fix the two copies.** It had already
  drifted once; the server would still accept anything a non-dialog caller sent.
