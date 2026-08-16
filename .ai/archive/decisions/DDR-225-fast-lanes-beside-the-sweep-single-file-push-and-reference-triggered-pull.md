# DDR-225 — Fast lanes beside the sweep: single-file in-process push, reference-triggered pull

- **Date:** 2026-08-16
- **Status:** accepted
- **Scope:** `repo:maude`, `dept:dev`
- **Extends:** DDR-222 (resync is restart; the asset sweep runs out of process) · [DDR-224](./DDR-224-the-checkout-serves-assets-first-and-every-write-door-mirrors.md)

## Context

With the DDR-223/224 lanes correct, latency became the complaint: an asset
dropped on the desktop reached the cloud MINUTES later (debounce → spawned
sweep child → walk-and-probe of the whole project), while its annotation
stroke crossed in milliseconds — a placeholder frame the whole wait. The
other direction rode the 20 s remote poll.

## Decisions

### 1. A single-file, in-process push fast lane (`pushOneAsset`)

`fs:any` on a pushable asset now pushes THAT ONE file immediately (400 ms
settle, serialized chain): one `POST /_asset-probe` (the batch route — it
survives the cloud's HEAD→GET conversion, and it is the guard that stops the
lane from uploading a file the asset PULL just wrote), one PUT via the sweep's
own `routeFor`/`putWithRetry`. **This deliberately qualifies DDR-222's
boundary, not reverses it**: the out-of-process wall exists because the FULL
sweep (mass hashing + walking) destabilizes Bun next to the dev server; a
single fetch is the same class of in-process work `pullAssets` has always
done on every poll. The sweep stays the reconciler — the fast lane never
throws, and every miss is the next sweep pass's job. The cell keeps the same
never-pushes guard as the sweep.

### 2. Reference arrival triggers the pull (`requestFastPull`)

A reference-bearing file landing on disk (`.annotations.svg`/`.tsx`/`.jsx`/
`.css`/`.meta.json` — asset-pull's own SCANNED_EXT) fires a debounced (750 ms),
single-flight `pullAssetsOnce` instead of waiting for the next 20 s tick. The
pull is missing-only and idempotent, so the steady-state cost of the trigger
is one directory scan and zero requests. The 20 s poll survives as the
schedule-driven reconciler.

## Alternatives rejected

- **Shrinking the sweep debounce / poll interval.** Leaves the full-sweep
  latency (spawn + walk + probe) in the hot path and multiplies steady-state
  polling cost for everyone.
- **A hub→peer "asset arrived" WS notification.** The right long-term shape,
  but a protocol change across hub + worker + peers; the reference-triggered
  pull gets the same seconds-level result with zero wire changes, because the
  reference itself already arrives over the live doc lane.
- **Suppression bookkeeping instead of the probe** (a recently-pulled set fed
  by the pull lanes). Racy against watcher latency; the probe is one cheap
  request and is authoritative.
