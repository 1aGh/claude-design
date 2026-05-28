---
name: phase-9.1-tsx-sync-unblock
status: planned
created: 2026-05-28
decisions:
  - DDR-060 (TSX-only format broke HTML-centric sync — remediation authorized here)
  - DDR-054 (linked-mode trust model; §2b .tsx-refusal + §3 F1→CSP/sandbox deferral)
---

# Phase 9.1: Unblock linked-mode sync for the TSX-only canvas format

> Authorized by [DDR-060](../decisions/DDR-060-tsx-only-format-breaks-html-centric-sync.md). Linked-mode sync (Phase 9 Task 4) is a **no-op for every real project** because discovery admits only `.html` (DDR-054 §2b) while `.tsx` has been the only canvas format since Phase 3.6. This plan makes `.tsx` syncable **safely** — it does NOT resurrect `.html`, and it does NOT relax the `.tsx` security guard until the F1 architectural fix is in force.

## Problem

- `plugins/design/dev-server/sync/index.ts:402-403` — `discoverCanvases()` skips everything that isn't `.html`. Real projects have zero `.html` canvases → `[]` → no provider, no peer, no `_sync.json`. (Symptom: hub `peersCount: 0`, no WS-upgrade attempt logged, `_sync.json` absent.)
- The `.tsx` guard cannot simply be removed: it closes the audit's **CRITICAL F1** (hub pushes JSX → `serveCanvasTsx` transpiles + executes it in a same-origin, CSP-less, un-sandboxed iframe → XSS/RCE + trifecta prompt-injection). See DDR-054 §Context + §2b.
- The promised escape hatch (`.meta.json.syncable: true`, DDR-054 §2b) was never built — it's still a comment at `sync/index.ts:367`.
- Failure is **silent** — `maude design serve` + `maude design status` look healthy while syncing nothing.

## Solution (4 slices, gated in order)

`9.1-A` is the hard dependency for `9.1-B`/`9.1-C`. `9.1-D` is independent and solo-safe — ship it first as the honest interim.

## Metadata

- **Type:** Defect remediation / security-gated feature unblock
- **Complexity:** High (A is cross-slice dev-server origin/CSP work)
- **Depends on:** Phase 9 (sync agent, hub), DDR-054 trust model
- **Blocks:** Phase 10 (structured CRDT co-editing — also `.html`-assumed; re-scope after this)
- **Affected files (anticipated):**
  - `plugins/design/dev-server/http.ts` — CSP + `X-Frame-Options` + iframe `sandbox` on canvas-served content; origin segregation from `/_api/*`
  - `plugins/design/dev-server/sync/index.ts` — `discoverCanvases()` `.tsx` admission behind the syncable gate; loud zero-syncable failure
  - canvas `.meta.json` schema + reader — `syncable: true` opt-in
  - `plugins/design/dev-server/sync/codec.ts` / `agent.ts` — `.tsx` body codec path (currently `.html`-shaped)
  - `cli/lib/design-link.mjs` / `maude design status` — report "linked but 0 syncable canvases"
  - security re-audit reports under `.ai/logs/security-reviews/`

---

## Tasks

### T1 — (9.1-D) Loud zero-syncable failure surface  *[solo-safe, ship first]*
- **Do:** When `linkedHub` is set but `discoverCanvases()` returns zero **syncable** canvases, surface a visible dev-server banner + a clear `maude design status` line ("linked to <url> but 0 syncable canvases — TSX bodies need opt-in, see DDR-060"), instead of the silent `console.log` early-return at `sync/index.ts:188`.
- **Why now:** Stops users burning time on a feature that silently does nothing. Changes nothing for solo users (no `linkedHub`).
- **Validate:** Link a `.tsx`-only repo → banner shows + `status` reports the gap; a repo with a syncable canvas shows normal sync.

### T2 — (9.1-A) CSP + sandboxed canvas origin  *[the F1 architectural fix DDR-054 §3 deferred]*
- **Do:** Serve canvas content (both the transpiled `.tsx`→JS and any synced body) under a CSP that locks `script-src` / `connect-src` / `img-src` (per the DDR-054 §54 note: must cover `connect-src`, not just `script-src`) and an iframe `sandbox` attribute. Segregate the canvas-content origin from the inspector / `/_api/*` origin so hub-pushed content cannot reach the local API, LAN, or IMDS.
- **Why:** This is the gate. `.tsx` sync is unsafe until hub-pushed JSX can no longer execute with same-origin privilege.
- **Validate:** Adversarial test — a canvas body attempting `fetch('/_api/...')`, an outbound beacon, or IMDS access is blocked by CSP/sandbox. Re-run ethical-hacker pass against the F1 chain; F1 must drop from CRITICAL.

### T3 — (9.1-B) Per-canvas `syncable` opt-in + `.tsx` discovery admission
- **Do:** Add `syncable: true` to the canvas `.meta.json` schema + reader. Extend `discoverCanvases()` to admit a `.tsx` canvas **iff** its sidecar opts in AND the T2 sandbox/CSP is in force (feature-flag the two together — opt-in is inert without the sandbox). Build the `.tsx` body codec path (currently `.html`-shaped in `codec.ts`/`agent.ts`). Default stays OFF.
- **Validate:** An opted-in `.tsx` canvas connects a provider, shows as a peer on the hub, round-trips edits disk↔Yjs↔disk; a non-opted-in `.tsx` canvas still does not sync.

### T4 — (9.1-C) Comments + annotations decoupled from `.html` discovery
- **Do:** Let an opted-in (or any discovered) canvas sync its `_comments/<slug>.json` + `<slug>.annotations.svg`. These are inert data — resolve the DDR-054 §3 **F14** single-ownership question (sync-agent-owns vs collab-room-owns) before wiring, so comments aren't double-written.
- **Validate:** Comment + annotation edits on a syncable canvas propagate to a second peer; no double-write / echo loop.

### T5 — Docs + release-note correction
- **Do:** Update the linked-mode README banner from "experimental preview" to the accurate state (and, post-T3, to "works for opted-in `.tsx` canvases under sandbox"). Note the capability gap in the changelog for the releases where sync was a no-op.
- **Validate:** `/flow:maintain-docs` clean; no doc claims sync works for default `.tsx` canvases pre-T3.

## Open questions (resolve during T2/T4)
- Origin-segregation mechanism: separate port/subdomain for canvas content vs `srcdoc` + strict `sandbox`? (T2 spike.)
- F14 ownership: does the sync agent own the comment/annotation files, or read through the collab room? (Blocks T4.)
- Does T2's CSP break any current `.tsx` canvas runtime (motion/react bundles, `@maude/canvas-lib`)? Inventory the canvas runtime's network + inline-script needs first.
