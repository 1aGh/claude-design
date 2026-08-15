# DDR-224 — The checkout serves assets first, every write door mirrors, and arrival heals the canvas

- **Date:** 2026-08-15
- **Status:** accepted
- **Scope:** `repo:maude`, `dept:dev`
- **Extends:** [DDR-217 addendum] (desktop asset push), [DDR-223](./DDR-223-annotations-get-a-per-lane-edit-stamp-and-emptiness-never-beats-content.md) (the sibling annotations fix; same live-test)
- **Related:** DDR-193 (R2 proxy posture), DDR-054 (canvas-origin trust)

## Context

Live-tested on alligators right after DDR-223 shipped: fresh annotation images
still crossed machines as broken frames. Worker + container logs pinned four
stacked holes, one symptom:

1. `GET /assets/<key>` served the BUCKET ONLY. A browser upload lands in the
   checkout instantly (201 logged 09:32:47) and the same process serves it to
   browsers — but a peer's asset pull got 404 for it until the bucket mirror
   caught up. For every peer without the file plane that 404 was the only
   downward path.
2. `PUT /_asset-file/` was the one write door WITHOUT the B3 mirror hook
   ("no bucket mirror" by design comment) — human-named `assets/…` files
   pushed there lived checkout-only until the next boot, one container
   teardown from gone.
3. `sweepNew`'s per-file mirror failures were structurally silent: they land
   in `result.failed`, the caller catches only promise rejection, and the
   function never rejects. A broken mirror produced zero log lines.
4. Browsers never retry a failed image load. The bytes arrived (file plane,
   09:33), the canvas kept the broken glyph until a manual reload — the heal
   was invisible, so the lane looked broken even after it worked.

## Decisions

### 1. Checkout first, bucket second on `GET/HEAD /assets/<key>`

The checkout is precisely "what this cell can serve"; the bucket is the
durable copy. Serving order now says so. Containment mirrors the PUT branch
(ASSET_KEY + `isContainedReal`); a symlink out of `assets/` stays a 404. With
a checkout and no bucket, a miss is a 404, not a 503 — 503 remains for a hub
with no store of either kind. (This also un-breaks self-hosted hubs with a
checkout and no S3.)

### 2. Every checkout write door fires the mirror

`PUT /_asset-file/` gets the same `onWritten → sweepNew` hook as
`PUT /assets/` and the browser-upload proxy door. The sweep only lists
`<designRoot>/assets/`, so a `system/**` write through the same door is a
cheap no-op pass.

### 3. Mirror results are loud, and failure retries once

`sweepNew` logs `mirrored N` on success and an ERROR naming the failed keys +
reasons, then arms one 60 s retry (single-flight + trailing-run already
serialize). No more zero-evidence bucket drift.

### 4. Asset arrival is an HMR mode, and it HEALS instead of reloading

`classifyChange` maps any media-extension file event under the design root to
`mode:'asset'`; the canvas shell re-points matching, still-broken
`<img>`/`<image>` elements at a cache-busted URL. No reload, no React state
loss, works for top-level `assets/` and DS trees alike. Fonts are excluded —
a font 404 heals only via CSS re-evaluation, not worth forcing a reload.

## Alternatives rejected

- **Bucket-only serving kept, mirror made synchronous with the upload.**
  Couples every upload's latency to S3 and still 404s for git/backup-restored
  checkout files the bucket never saw.
- **Hard-reload on asset arrival.** A fresh link pulls hundreds of files; a
  reload storm across every open canvas versus a per-name DOM re-point is no
  contest.
- **Streaming the checkout file.** The bucket branch already buffers whole
  objects under the same ceilings; matching its shape keeps the route (and
  its test harness) uniform.
