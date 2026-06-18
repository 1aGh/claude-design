# DDR-113: Visual diff renders the "before" by building the canvas at a git ref (`?sha=`)

- **Date:** 2026-06-18
- **Status:** Accepted + implemented (phase-27, epic E2). `apps/studio/{http.ts,git/service.ts}` + `plugins/design/templates/_shell.html` + `apps/studio/client/{canvas-url.js,panels/DiffView.jsx}`.
- **Tags:** native-app, git, visual-diff, canvas-render, security, dos, phase-27, E2
- **Related:** [DDR-107](./DDR-107-git-engine-isomorphic-git.md) (the engine `gitShowFile` uses), [DDR-110](./DDR-110-three-lane-collaboration-model.md) (the visual-diff differentiator), [DDR-054](./DDR-054-linked-mode-trust-model-and-task-4-hardening.md) (the untrusted canvas origin this surface is reachable from), [DDR-112](./DDR-112-simplified-staging-model.md). Epic § E2.

## Context

E2's differentiator is a **rendered** before/after of a changed canvas, not a text diff. "After" is the working tree (the live canvas). "Before" must be the canvas **as it was at a past saved version** — which requires rendering source that no longer exists on disk. Options: (a) screenshot pipeline (render HEAD to a PNG via agent-browser — heavy, CLI-time, not a runtime path); (b) a checkout-and-render worktree subsystem; (c) build the canvas from the historical *source* at a git ref and render it in a live iframe.

## Decision

**Render the "before" pane by building the canvas from `git show <sha>:<path>` content through the existing canvas pipeline, served on the canvas-serve path via `?sha=<ref>`.** A new `gitShowFile` (service) reads the file at the ref; `serveCanvasTsx` branches on `?sha=` to `serveHistoricalCanvas` (builds via `buildCanvasModule`, immutable per-(path,sha) cache); `_shell.html` + `canvasUrl` forward `?sha=` into the module import. Both diff panes are LIVE iframes inside ONE shared, locked zoom/pan transform, rendered with `?hide-chrome=1` (no editor toolbar/minimap) so the diff is just the design.

### Why
- **Real, faithful-enough, cheap.** Reuses the canvas build pipeline (no new render subsystem, no screenshot infra). The historical `.tsx` builds against today's siblings/lib — an accepted approximation (the *code* at the sha, with current DS), documented in the UI.
- **Live, not a screenshot.** The panes are interactive canvas iframes; the synced transform gives locked zoom/pan across both sides so you compare the same region.

### Security envelope (load-bearing)
The route is on the **canvas-serve path**, hence reachable from the UNTRUSTED canvas origin (DDR-054). Two controls make that safe:
1. `sha` is `isSafeGitPositional`-guarded + the path is containment-checked (no argument injection, no traversal — reads only an in-design-tree file's history).
2. The historical build is **LRU-capped** (96 entries) + **rate-limited** (24 builds / 10 s, gating the expensive miss path *before* `gitShowFile`) so a distinct-`?sha=` spray from a hub-pushed canvas can't OOM or CPU-starve the sidecar. (Security review HIGH — closed; `.ai/logs/security-reviews/phase-27-git-layer.md`.)

## Consequences
- **Positive:** the visual diff ships real before/after with no new render subsystem; the `?sha=` change is additive (the no-sha serve is byte-identical); the DoS surface is bounded.
- **Negative / accepted:** the before render isn't a byte-faithful historical render (current lib/siblings) — not authoritative for security review, fine for design comparison. Conflict-resolution file writes (Keep both = copy-with-suffix) + a byte-faithful historical render are deferred to a later slice. The global rate limiter can 429 a legit user during an active flood (correct tradeoff vs a keyed, attacker-defeatable limiter).

## Alternatives considered
- **Screenshot the historical version** — rejected: needs checkout-and-render or a render farm; CLI-time, not a runtime iframe; loses interactivity.
- **Checkout-and-render worktree** — rejected for phase-27: a whole subsystem (temp worktree per sha, isolation, cleanup) for marginal fidelity gain over building from source.
- **Text diff** — rejected: the non-technical persona can't read a code diff; the rendered diff is the E2 differentiator (DDR-110).
