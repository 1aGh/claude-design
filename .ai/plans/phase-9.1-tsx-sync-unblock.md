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

## Direction (decided 2026-05-29)

Three strategies were weighed for "make `.tsx` sync safe":

- **A — keep `.tsx`, contain at runtime (cross-origin + CSP + route-allowlist + postMessage bridge).** Industry-standard for "render untrusted code-UI while the host interacts" (VS Code webviews, CodeSandbox). The browser enforces `connect-src` *below* the JS layer, so obfuscation can't bypass it. **CHOSEN.**
- **B — change the synced unit to a structured data model (Phase 10 reconceived).** Co-edit a constrained scene/component tree, render through a trusted interpreter; no executable code crosses the wire, so the RCE surface vanishes by construction (how Figma/tldraw/Penpot do safe multiplayer). The clean endgame, but a format-level rearchitecture. **Stays on the roadmap; sync is NOT blocked on it.**
- **C — sync-as-proposal / review-gate on body edits** (remote body changes stage, human accepts before they execute). Strongest control against *both* F1 and F3, cheaper than finishing the live bridge — but **not** live co-editing of the body. **REJECTED as the model:** the product goal is live multiplayer on the body itself (decided 2026-05-29).

**A static "security check before sync" is NOT the wall.** TSX is Turing-complete with reflection escapes (`window['fe'+'tch']`, `[].constructor.constructor(...)`, indirect eval), so a denylist is bypassable and an allowlist strict enough to be safe would reject normal canvases. CSP `connect-src 'none'`/scoped is the sound RCE control because the browser enforces it under JS. A content check may ship only as silent **defense-in-depth / telemetry** (e.g. obvious-junk early-reject), never as a substitute for the runtime containment.

**The F3 (trifecta / prompt-injection) lane is orthogonal to CSP.** A sandbox contains *browser execution*; it does nothing about hub-pushed `.tsx` text that Claude Code reads as context (`/design:edit`, review prompts). That lane needs `.claudeignore` / an untrusted-marker on sync-written files (DDR-054 §3 F3) — it MUST land alongside the body-sync unblock, not after.

> **Load-bearing invariant — the two locks flip together.** `tsx`-sync admission (relaxing the `sync/index.ts` `.tsx` guard, *Lock 1*) and the cross-origin/CSP containment (`MAUDE_CANVAS_ORIGIN_SPLIT`, *Lock 2*) must be **feature-flagged as one unit**. The opt-in is inert without the sandbox; enabling sync without the origin split re-opens CRITICAL F1. Today F1 is unreachable *only* because Lock 1 holds (sync writes nothing) — do not let a future refactor decouple them.

## Problem

- `plugins/design/dev-server/sync/index.ts:402-403` — `discoverCanvases()` skips everything that isn't `.html`. Real projects have zero `.html` canvases → `[]` → no provider, no peer, no `_sync.json`. (Symptom: hub `peersCount: 0`, no WS-upgrade attempt logged, `_sync.json` absent.)
- The `.tsx` guard cannot simply be removed: it closes the audit's **CRITICAL F1** (hub pushes JSX → `serveCanvasTsx` transpiles + executes it in a same-origin, CSP-less, un-sandboxed iframe → XSS/RCE + trifecta prompt-injection). See DDR-054 §Context + §2b.
- The promised escape hatch (`.meta.json.syncable: true`, DDR-054 §2b) was never built — it's still a comment at `sync/index.ts:367`.
- Failure is **silent** — `maude design serve` + `maude design status` look healthy while syncing nothing. *(Fixed — 9.1-D shipped the loud surface, see T1.)*

### What's already built (the reframe)

The A1 runtime containment is **~80 % built and dormant behind `MAUDE_CANVAS_ORIGIN_SPLIT=1`** (off by default — proven same-origin path stays the default, zero regression):

- `server.ts:153 startCanvasServer` — a second `Bun.serve` on its own OS-assigned origin with a **hard route-allowlist** (`/_health`, `git-user`, `canvas-meta`, `annotations`, `git-committers`, `ai`, `_comments`); everything else 403'd at the door so hub-pushed JSX can't reach `/_api/export`, `/_config`, `/_sync-status`, or arbitrary repo files.
- `http.ts:67 cspForCanvasShell` — strict CSP: `default-src 'none'`, `script-src 'self' + per-inline sha256` (no `unsafe-inline`, no `unsafe-eval` — runtime verified not to need eval), `base-uri 'none'`, `object-src 'none'`.
- `http.ts:734 isCanvasSafeRoute` — the allowlist gate.
- The **postMessage bridge already exists** (`comments-overlay`, `use-selection-set`, `canvas-comment-mount`, `contextual-toolbar`, `annotations-layer`, `inspect.ts` all relay via `window.parent.postMessage({ dgn: … })`). The inspector is message-driven, not direct-DOM-reach.
- `undo-stack.ts` already hardened against the cross-origin `window.top` `SecurityError`.

**So the cross-origin regressions are bridge-*parity* bugs, not greenfield work** — same-origin assumptions in an existing protocol that break when the origin actually differs (`targetOrigin: '*'`, cross-origin geometry reads, clipboard-in-sandbox). That's bounded debugging.

## Solution

Direction **A** (above). `9.1-A` (finish the containment) is the hard dependency for `9.1-B`/`9.1-C`. `9.1-D` (loud failure) is shipped.

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

### T1 — (9.1-D) Loud zero-syncable failure surface  ✅ **SHIPPED**
- **Done:** `linkedHub` set + zero syncable canvases → visible status-bar `0 SYNCABLE` indicator + `surfaceNoSyncable` warn (`sync/index.ts:492`) + `maude design status` line, instead of the silent early-return. Solo users unaffected.

### T2 — (9.1-A) Finish the cross-origin containment  *[the F1 fix — parity + hardening DONE; F1 adversarial validation + default-flip remain]*
The origin split, CSP, route-allowlist, and postMessage bridge scaffold were already built (see "What's already built"). The 2026-05-29 session closed the parity bugs + the two hardening items (all verified live via agent-browser against a `MAUDE_CANVAS_ORIGIN_SPLIT=1` server + full 684-test suite green):

- **Parity bugs** ✅ (fixed in the existing `dgn:` protocol, no re-architecture):
  - [x] **Comment composer position** — root cause was NOT geometry: `comments-overlay.tsx` is the lone overlay that loads its CSS via an external `<link href="/_client/comments-overlay.css">`, and the canvas-origin `isCanvasSafeRoute` allowlist 403'd it → composer lost `position: fixed` + chrome → collapsed to 0,0. Fix: allow `/_client/*.css` on the canvas origin (`http.ts isCanvasSafeRoute`). All other overlays inline their CSS, so they were never affected.
  - [x] **Presence accumulation** — root cause was NOT cross-origin-specific: client `myConnId` (random UUID, `use-collab.tsx:379`) never equalled server `conn.id`, so `room.ts disconnect`'s `__connId` match never fired → disconnected peers' awareness states were never removed (only the ~30s yjs timeout masked it). Fix: server-authoritative `clientID→conn.id` map learned from awareness update origins (`collab/room.ts`); `collab-room.test.ts` rewritten off the artificial `__connId` path onto the real `room.receive` path.
  - [x] **Clipboard** — no fix needed; `allow: clipboard-write` on the iframe (already present) delegates the permission, localhost is a secure context. Confirmed working (paste into search + annotations + Copy CSS/ID).
  - [x] Undo-stack `window.top` `SecurityError` — already hardened.
- [x] **Tighten `connect-src`** — `'self' ws: wss:` → `'self'` (`http.ts cspForCanvasShell`). CSP3 `'self'` covers same-origin ws/wss, so collab + HMR sockets still connect (verified — peers render) while `ws://attacker` / cross-origin fetch / IMDS / LAN beacon is refused.
- [x] **Audit parent-side postMessage handlers** — added an `e.origin === (cfg.canvasOrigin || location.origin)` guard at the top of the shell's `onMessage` (`client/app.jsx`) so spoofed inbound `dgn:` messages from any other window are dropped. The handlers only relay to inert stores (comments/selection — the "safe to sync" set), so the blast radius was small, but this closes the confused-deputy seam. Verified: selection / comment-submit / pin-click still work through the guard.
- [ ] **F1 adversarial re-validation** — re-run the ethical-hacker pass against the F1 chain: a canvas body attempting `fetch('/_api/export')`, an outbound `fetch`/`WebSocket` beacon, or IMDS access must be blocked by CSP/route-allowlist/origin. F1 must drop from CRITICAL. *(Not yet done — this is the security sign-off gating the default-flip.)*
- [ ] **Flip the default** — set `MAUDE_CANVAS_ORIGIN_SPLIT` on by default *only* after the F1 adversarial pass, and **atomically with Lock 1** (see the invariant). Until then the split stays opt-in behind the env flag.

### T3 — (9.1-B) Per-canvas `syncable` opt-in + `.tsx` discovery admission
- **Do:** Add `syncable: true` to the canvas `.meta.json` schema + reader. Extend `discoverCanvases()` to admit a `.tsx` canvas **iff** its sidecar opts in AND the T2 sandbox/CSP is in force (feature-flag the two together — opt-in is inert without the sandbox). Build the `.tsx` body codec path (currently `.html`-shaped in `codec.ts`/`agent.ts`). Default stays OFF.
- **Validate:** An opted-in `.tsx` canvas connects a provider, shows as a peer on the hub, round-trips edits disk↔Yjs↔disk; a non-opted-in `.tsx` canvas still does not sync.

### T4 — (9.1-C) Comments + annotations decoupled from `.html` discovery
- **Do:** Let an opted-in (or any discovered) canvas sync its `_comments/<slug>.json` + `<slug>.annotations.svg`. These are inert data — resolve the DDR-054 §3 **F14** single-ownership question (sync-agent-owns vs collab-room-owns) before wiring, so comments aren't double-written.
- **Validate:** Comment + annotation edits on a syncable canvas propagate to a second peer; no double-write / echo loop.

### T4.5 — (F3) Trifecta containment for sync-written files  *[orthogonal to CSP — MUST land with T3]*
- **Why:** CSP/sandbox contains *browser execution*; it does nothing about hub-pushed `.tsx` text that Claude Code reads as context (`/design:edit`, review prompts) and acts on. This is DDR-054 §3 **F3** (trifecta prompt-injection), deferred to "Task 6" and never shipped. A `.tsx` body becoming syncable makes this lane live, so it cannot trail behind T3.
- **Do:** Mark sync-written files as untrusted context — `.claudeignore` strategy and/or a per-sync marker under `.design/_untrusted/<slug>` (DDR-054 §3 F3). Carry the linked-mode README banner about untrusted synced content. Raise Claude Code-side `.claudeignore` honoring with Anthropic if not already honored.
- **Validate:** A synced canvas carrying an injected instruction string is excluded from / flagged in the context Claude Code reads; the banner is present.

### T5 — Docs + release-note correction
- **Do:** Update the linked-mode README banner from "experimental preview" to the accurate state (and, post-T3, to "works for opted-in `.tsx` canvases under sandbox"). Note the capability gap in the changelog for the releases where sync was a no-op.
- **Validate:** `/flow:maintain-docs` clean; no doc claims sync works for default `.tsx` canvases pre-T3.

## Open questions
- **Origin-segregation mechanism** — *resolved:* separate OS-assigned port (`startCanvasServer`), not `srcdoc`+`sandbox`. (Cross-origin via distinct port severs `window.parent` borrow while keeping the postMessage bridge.)
- **Does the CSP break the canvas runtime?** — *resolved:* `cspForCanvasShell` verified motion/pixi/`@maude/canvas-lib`/Bun.build output need no `unsafe-eval`; inline scripts are sha256-allowlisted. After tightening `connect-src` to `'self'` (T2), the collab + HMR sockets still connect (verified live — peers render, comments load), confirming CSP3 `'self'` covers same-origin ws/wss.
- **F14 ownership:** does the sync agent own the comment/annotation files, or read through the collab room? (Blocks T4.)
