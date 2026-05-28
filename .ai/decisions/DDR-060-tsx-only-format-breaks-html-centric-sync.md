## DDR-060 — The TSX-only canvas migration silently broke the HTML-centric linked-mode sync (and the collab roadmap's `.html` assumption)

- **Status:** Accepted — 2026-05-28
- **Authors:** 1aGh (surfaced during live Docker-hub dogfood — linked repo synced nothing)
- **Phase:** 9 (self-hostable hub + file sync) — defect found post-ship
- **Supersedes:** —
- **Superseded by:** —
- **Amends:** [DDR-054](./DDR-054-linked-mode-trust-model-and-task-4-hardening.md) §2b — re-frames the ".tsx not synced" mitigation now that `.tsx` is the **only** format
- **Related:**
  - [DDR-054](./DDR-054-linked-mode-trust-model-and-task-4-hardening.md) — linked-mode trust model; §2b refuses `.tsx` over the wire (the now-load-bearing line)
  - Phase 3.6 (`.ai/plans/archive/phase-3.6-canvas-tsx-format.md`) — TSX-only canvas migration, closed 2026-05-18 (`1b2f349`)
  - Phase 9 (`.ai/plans/archive/phase-9-self-hosted-hub-file-sync.md`) — hub + bidi sync
  - Phase 10 (`.ai/plans/phase-10-structured-crdt-html-coediting.md`) — also predicated on `.design/*.html`
  - `.ai/plans/phase-9.1-tsx-sync-unblock.md` — the remediation plan this DDR authorizes

## Context

Linked-mode file sync (Phase 9 Task 4, `c21c7d4`) discovers canvases and opens one Hocuspocus/Yjs WebSocket per canvas to the hub. Live dogfood against a self-hosted Docker hub showed **zero peers connect and no `.design/_sync.json` is ever written**, even with a valid token and a reachable hub. The hub logs show no WS-upgrade attempt at all — the sync agent returns before connecting.

Root cause is a collision between two decisions made nine days apart:

1. **2026-05-18 — Phase 3.6 made `.tsx` the only canvas format.** `plugins/design/commands/new.md:140`: *"TSX is the only canvas format. Legacy `.html` canvases have been migrated; the html-to-jsx codemod was removed alongside the migration."* Real projects (including this repo) carry **zero** `.html` canvases — only `.design/<group>/*.tsx`.

2. **2026-05-27 — DDR-054 §2b made sync refuse `.tsx` over the wire.** `plugins/design/dev-server/sync/index.ts:402-403`:
   ```ts
   // DDR-054 §2b — refuse .tsx; only .html canvases sync.
   if (ext !== '.html') continue;
   ```
   The discovery `walk()` also skips `_`-prefixed dirs (`:397`), so even archived `.design/_history/**/*.html` snapshots don't count. DDR-054 framed this as *".tsx canvases stay editable solo, just not synced"* — acceptable **only under the obsolete assumption that `.html` canvases still exist.** Its own §2b comment ("existing code finds both .tsx and .html") was already factually stale when written.

**Net effect:** `discoverCanvases()` returns `[]` for every real project → the agent logs *"no canvases discovered"* and returns at `:188` → no provider, no peer, no `_sync.json`. The headline Phase 9 feature ("self-hostable hub file sync") syncs nothing a current project actually contains.

This is not limited to the canvas body. The sync unit is a `CanvasDescriptor { slug, html, comments, annotations }`; the comment store (`_comments/<slug>.json`) and annotation SVG (`<slug>.annotations.svg`) are **inert data and safe to sync**, but they are attached to a per-canvas agent that is only created for an `.html`-discovered canvas. So in a `.tsx` project, comments and annotations don't sync either.

The roadmap-wide blast radius is larger than sync: **Phase 10 (structured CRDT co-editing) is also written against `.design/*.html`** (`data-cd-id` injection into `.html`, HTML↔Y.XmlFragment bridge). The entire collab branch (Phase 8 multiplayer → 9 sync → 10 co-editing) was designed before the format migration and still assumes `.html`.

### Why we can't just delete the `.tsx` guard

DDR-054 §2b exists because of the audit's **CRITICAL F1**: a hostile/compromised hub pushes JSX → the sync agent writes it verbatim to `<slug>.tsx` → `serveCanvasTsx` transpiles it via `Bun.Transpiler` and serves `application/javascript` into the canvas iframe **same-origin with no CSP / no `sandbox`** → arbitrary fetch to `/_api/*`, LAN, cloud-metadata IMDS, plus trifecta-class prompt-injection into adjacent Claude Code sessions (F3). `.tsx` is the *transpile-and-execute* lane — strictly worse than `.html`. Removing the guard re-opens the exact CRITICAL the guard was added to close. The architectural fix (CSP + sandboxed iframe for untrusted/synced content) was mapped by DDR-054 §3 to "Task 8" and **never shipped**; the promised per-canvas opt-in (`.meta.json.syncable: true`) is still only a comment at `sync/index.ts:367`.

## Decision

1. **Acknowledge the regression in writing.** Linked-mode sync is **non-functional for real (TSX-only) projects**, not merely "experimental preview." DDR-054's "preview" banner undersells it: there is currently no canvas a normal project can sync. This DDR is the authoritative statement of that gap.

2. **The fix direction is to make `.tsx` syncable safely — not to resurrect `.html`.** `.tsx` is the format; sync must meet the format where it is. Reviving `.html` canvases is explicitly rejected (it would re-fork the format the whole plugin migrated away from).

3. **The blocking dependency is the F1 architectural fix.** `.tsx` may only sync once hub-pushed canvas content is rendered in a **sandboxed, CSP-constrained iframe** (no same-origin `/_api/*` reach, `connect-src`/`img-src`/`script-src` locked — per the DDR-054 §54 note that CSP must cover `connect-src`, not just `script-src`). Until that lands, the `.tsx` guard stays.

4. **Sequencing (detailed in `phase-9.1-tsx-sync-unblock.md`):**
   - **9.1-A** — ship the F1 fix: CSP + `sandbox` on canvas-served content; segregate the canvas-content origin from the inspector/`/_api` origin.
   - **9.1-B** — ship the deferred per-canvas opt-in (`.meta.json.syncable: true`) and extend `discoverCanvases()` to admit `.tsx` **only** when the sidecar opts in AND 9.1-A is in force. Default stays off (solo-safe).
   - **9.1-C** — comments + annotations: decouple from `.html` discovery so an opted-in `.tsx` canvas syncs its `_comments/<slug>.json` + `<slug>.annotations.svg` (these are inert; they may be allowed to sync for any discovered canvas independent of the body-sync gate, pending the DDR-054 §3 F14 ownership decision).
   - **9.1-D** — make the failure mode loud: when `linkedHub` is set but discovery yields zero syncable canvases, the dev server must surface a visible banner ("linked but nothing syncs — see DDR-060"), not a silent early-return.

5. **Until 9.1 lands, fix the lie, not the lock.** The dev-server + `maude design status` must report the real state (linked, but 0 syncable canvases because the project is TSX-only) instead of appearing healthy. The `.tsx` security guard is NOT relaxed as an interim measure.

## Consequences

### Positive
- The contradiction is named and the resolution is sequenced behind the security gate, so future work can't "just remove the guard" without re-reading F1.
- Phase 10's `.html` assumption is flagged before more co-editing work is built on sand.
- The interim loud-failure (9.1-D) stops users burning time on a feature that silently does nothing.

### Negative
- Linked-mode sync — a shipped, advertised feature — is formally a no-op for real projects until 9.1-A+B land. That is a real capability gap to communicate in release notes, not paper over.
- 9.1-A (CSP + sandbox origin segregation) is non-trivial cross-slice dev-server work; it gates B and C. The honest critical path to "sync actually works" runs through the security fix DDR-054 deferred.

### Rollback path
- None needed — this DDR documents a defect and authorizes forward work; it changes no runtime behavior on its own. The only code change it sanctions immediately is the **loud-failure surface (9.1-D)**, which is solo-safe (no `linkedHub` ⇒ no change). The `.tsx` guard stays until 9.1-A is in force.
