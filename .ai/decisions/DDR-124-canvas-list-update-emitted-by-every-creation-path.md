# DDR-124 — Every canvas create/remove path must emit `canvas-list-update`; the file tree refreshes on nothing else

**Status:** accepted · **Date:** 2026-06-23 · **Phase:** 31 (Native Maude: ACP sidepanel) — RCA-driven follow-up
**Relates:** Phase 30 (introduced the `canvas-list-update` event for in-app create/delete), DDR-115 (runtime-state taxonomy — what counts as a canvas vs. ignored `_*` state), DDR-054 (untrusted-canvas / loopback inspector-WS trust model), DDR-093 (`/_index-data` per-canvas DS map). RCA: `.ai/logs/rca/issue-acp-new-canvas-not-in-filetree.md`.

## Context

The browser file tree (`groups` in `client/app.jsx`) is **not** a live view of the filesystem. It is a snapshot fetched from `GET /_index-data` by `loadTree()`, re-run only on: mount, an in-app create/delete handler, and the `canvas-list-update` WebSocket message.

Phase 30 added `canvas-list-update`, but emitted it from **one** place: the dev-server's own `POST`/`DELETE /_api/canvas` handlers (`api.ts`). That covered canvases created via the in-app **+** / trash, and nothing else.

Phase 31's ACP chat panel exposed the gap. When the panel's `claude` subprocess runs `/design:new`, the canvas is written **straight to disk** (`Bun.write`, not the API), so no `canvas-list-update` fired and the new canvas stayed invisible until a full reload. The same blind spot hit any external write — agent `Write`, terminal `cp`, and `git checkout`/branch-switch bringing in new canvases. The fs-watcher *did* fire `fs:any`, but its subscribers (HMR reload, activity overlay, git-status badges) only act on canvases the tree **already** knows about — none of them re-list the tree.

## Decision

**The invariant: any code path that adds or removes a canvas under a configured canvas group MUST result in a `canvas-list-update` broadcast. The file tree refreshes on that event and on nothing else, so a creation path that skips it is silently invisible to the UI.**

There are now two emitters, deliberately symmetric:

1. **`api.ts` (in-app create/delete)** — emits synchronously on the API call. Fast path; no fs round-trip.
2. **`canvas-list-watch.ts` (external create/delete)** — a new `fs:any` subscriber that debounce-diffs the openable-canvas set (reusing `findHtmlFiles` over `cfg.canvasGroups`, the *same* listing `/_index-data` uses) and emits `canvas-list-update` on any add/remove. Covers `/design:new`, agent writes, `git checkout`, terminal `cp`/`rm`.

The two are idempotent w.r.t. each other: an api.ts create updates the watcher's known-set, so its subsequent `fs:any` diff sees no change and won't double-emit.

### Load-bearing details

- **The client ignores the event payload.** The `canvas-list-update` handler just calls `loadTree()` (a wholesale `/_index-data` re-read), so payload accuracy is advisory only. **Security tripwire:** any *future* consumer that reads `payload.rel`/`.slug`/`.action` must treat them as **attacker-controlled** (agent- / `git checkout`-authored filenames) and must not feed them to a render/open/build sink without re-validating against `/_index-data`. The watcher only ever *lists* — it never auto-opens, builds, or executes a detected canvas (opening still routes through the DDR-054 canvas sandbox).
- **Trust boundary unchanged.** `canvas-list-update` rides the existing loopback **inspector** WS (`ws.ts` `broadcast()`, gated to `kind === 'inspector'`); the untrusted canvas origin never receives it. No new route, no new external input.
- **Membership = `/_index-data`'s group set, not the create-allowlist.** The watcher mirrors `cfg.canvasGroups` (what the tree can actually show), deliberately *not* api.ts's create-allowlist (which also permits `cfg.newCanvasDir`). On the default config `newCanvasDir` is a group; a config pointing it elsewhere would be invisible in `/_index-data` too, so the watcher stays consistent with the tree rather than the writer.
- **DDR-115 exclusions come for free.** `findHtmlFiles` already skips `_`-prefixed + `SKIP_DIRS` paths, so runtime state never produces a spurious refresh; the cheap `isCanvasCandidate` pre-filter applies the same rule before arming the debounce, avoiding tree thrash on every `/design:edit` body save.

## Consequences

- New canvases from the ACP panel / terminal / git appear in the tree without a reload; removed ones drop out. The Phase-31 "build from chat → watch it appear" loop works.
- **When adding a new way to create or delete a canvas, you don't need to wire `canvas-list-update` by hand** — the fs-watcher covers any on-disk change. Only add a direct emit if you need the no-fs-round-trip immediacy (as api.ts does).
- One accepted, below-floor cost (security review F3): a sustained drip of distinct-named creates each triggers an O(N) `readdir` walk past the 150 ms debounce. Acceptable for a local single-user dev server; revisit with a max-interval coalescer only if it ever bites.

## Alternatives considered

- **Emit on the fs `rename` event in `fs-watch.ts`.** Rejected: `fs.watch`'s `rename` is unreliable for distinguishing add vs. remove and yields no slug. The set-diff subscriber is deterministic.
- **Client-side fallback** (reload the tree when an HMR arrives for an unknown canvas). Rejected: only covers the open-iframe path, misses pure creates, and pushes filesystem knowledge into the client.
