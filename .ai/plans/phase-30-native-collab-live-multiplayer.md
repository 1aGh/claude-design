# Phase 30 — Native Maude: Live multiplayer + artboard locking + hub realignment

Validate docs and codebase patterns before implementing. Read DDR-054, DDR-064, DDR-063 and the 3-lane collab model in `collab-model-design.md` before touching any sync/collab code. The no-break exhaustive verify posture applies — this is security-critical.

## Co je shipped vs. co je net-new

| Oblast | Stav | Co phase-30 dělá |
| --- | --- | --- |
| Yjs presence, cursors, viewport | ✅ Shipped (Phase 8) | Reuse — netýká se |
| Comments + annotations live sync | ✅ Shipped (Phase 8/9) | Reuse — netýká se |
| Hub + linked mode | ✅ Shipped (Phase 9) | Reuse — netýká se |
| **Artboard locking** | ❌ Neexistuje | Net-new: `lock` field na awareness |
| **`canvas-list-update` event** | ❌ Neexistuje | Net-new: live propagace nových canvasů v session |
| **Hub admin realignment** | ⚠️ Existuje, ale flat | Refactor: přepsat na repo/branch kontext |

## Description

Tato fáze **nestaví live collab od nuly** — Yjs, presence, annotations, comments a hub jsou shipped. Přidává tři věci, které v kódu chybí:

1. **Artboard locking (net-new):** `lock` field na existujícím Yjs awareness kanálu — soft single-writer na TSX body; "Anna is editing · Take over" se stale-lock lease + attributed takeover.
2. **Live canvas-list propagation (net-new):** nový canvas vytvořený během live session se okamžitě objeví v tree ostatních přítomných peerů (ephemeral `canvas-list-update` awareness event — canvas soubor samotný stále cestuje přes git push→pull).
3. **Hub admin UI realignment (refactor):** přepsat existující flat doc-list admin na repo/branch kontext (jedno repo/branch najednou, ne global seznam všech Y.Doc).

**Phase milestone:** Two users on the same hub session see each other's cursors, annotations, and comments live. When one edits a canvas, the other sees "Anna is editing · Take over" and cannot accidentally overwrite. New canvases created during a live session appear for both instantly.

## User Story

As a non-technical collaborator, I want to see my teammate's cursor and their live annotations, and know when they're editing a canvas so we don't step on each other — exactly like Figma.

## Problem

Yjs presence + annotations already work loopback and over the hub, but:
1. Artboard locking doesn't exist — two people can edit the same TSX body simultaneously and overwrite each other.
2. New canvases created during a live session don't propagate to the other peer's canvas list until they do a "Get latest" (git pull) — visible duality the UX model wanted to eliminate.
3. The hub admin UI shows a flat list of all documents across all repos — conflicts with the "one repo/branch context" IA model.

## Solution

1. **Artboard lock field** on the existing Yjs awareness channel: `{lockedBy, displayName, since}` per canvas slug. Broadcast on edit-start, release on commit/quiescence/lease-expiry.
2. **Live session new-canvas propagation:** within a trusted invited session (both peers on same branch + connected to same hub), new canvases appear live via a lightweight `canvas-list-update` awareness event — no git required for the list (only git gets the files). The canvas body itself still travels via git push→pull; the *list entry* is ephemeral session state.
3. **Hub admin realignment:** hub scopes its document namespace to one repo/branch context; admin UI shows the active repo/branch + its canvases, not a global flat list.

## Metadata

- **Type:** Enhancement + New Capability (locking is new; lane 2 is enhancement; hub realignment is refactor)
- **Complexity:** High (security-critical; touches collab/room.ts, awareness, hub admin)
- **App/Package:** `plugins/design/dev-server/collab/` + `plugins/design/hub/src/admin/`
- **Depends on:** phase-26 (shell), phase-27 (git), phase-29 (onboarding — defines "trusted live session")
- **Security:** TSX live-edit (full peer-code sync) stays gated behind DDR-054 F1 iframe sandbox — NOT in this phase. This phase ships locking as the mechanism that makes TSX-safe-without-F1 possible.

---

## Context References

### Must-Read Files

> Read in parallel.

- `.ai/docs/collab-model-design.md` — **entire doc.** 3-lane model, UX mental model, microcopy contract, edge-case stress test.
- `.ai/decisions/DDR-064-single-shared-collab-doc.md` — one Y.Doc per canvas; locking must not break the doc lifecycle.
- `.ai/decisions/DDR-054-linked-mode-trust-model-and-task-4-hardening.md` — the F1 iframe sandbox. TSX live-edit is still gated here; locking is orthogonal.
- `.ai/decisions/DDR-078-agent-presence-virtual-collaborators.md` — awareness sanitization; locking field must go through the same sanitizer.
- `plugins/design/dev-server/use-collab.tsx` — client-side Yjs provider + awareness state; `sanitizeForeignState()` chokepoint (lines 76–257 from the inventory).
- `plugins/design/dev-server/collab/room.ts` + `protocol.ts` + `registry.ts` — server-side Y.Doc room lifecycle.
- `plugins/design/hub/src/admin/` — current hub admin UI (vanilla JS); realignment target.
- `.design/ui/Sync Hub Admin.tsx` — existing hub admin mockup; starting point for realignment.

### Files to Modify (not create from scratch)

- `plugins/design/dev-server/use-collab.tsx` — add `lock` field to `CollabAwarenessState`; add `useLockArtboard()` hook; add `sanitizeLockState()` to the chokepoint.
- `plugins/design/dev-server/collab/protocol.ts` — add lock lease timeout constant (default 30 s).
- `plugins/design/dev-server/client/app.jsx` — mount `LockOverlay` on locked canvases.
- `plugins/design/hub/src/admin/index.html` + `admin.js` — realign to repo/branch context.
- `plugins/design/dev-server/server.ts` — `canvas-list-update` awareness event handling.

### Files to Create

- `plugins/design/dev-server/client/panels/LockOverlay.jsx` — "Anna is editing · Take over" UI
- `plugins/design/dev-server/test/artboard-lock.test.ts` — lock acquire/release/timeout/takeover matrix

### Design canvases

| Canvas (to create) | Screens needed |
| --- | --- |
| `ArtboardLock.tsx` | Locked canvas overlay ("Anna is editing"), Take over button, stale-lock state ("Anna left 20 min ago · Take over?"), lock release confirmation |

---

## Tasks

### Task 1: `/design:new` — Artboard lock overlay

- **Do:** Run `/design:new` for `ArtboardLock`. Include: locked state, stale-lock state (timeout expired, owner offline), takeover confirmation, release animation.
- **Validate:** Canvas `status: ready-for-handoff`.

### Task 2: Artboard lock field on awareness channel

- **Do:** Extend `CollabAwarenessState` in `use-collab.tsx`:
  ```ts
  lock?: { slug: string; since: number } // slug = which canvas, since = epoch ms
  ```
  - `useLockArtboard(slug)`: sets `awareness.setLocalStateField('lock', {slug, since: Date.now()})`. Returns `unlock()` which clears it.
  - Auto-release: if the editor's tab closes or goes inactive for > 30 s, the lock field is cleared (use Yjs's existing awareness timeout — peers whose connection drops have their awareness cleared automatically after the provider's `awarenessTimeout`).
  - **Takeover:** anyone can broadcast `lock: {slug, since: Date.now()}` on the same slug to forcibly acquire it. The previous holder's UI shows a toast "Your lock on *Login* was taken over by Anna."
  - Add `sanitizeLockState()` to `sanitizeForeignState()`: `slug` must match `[a-z0-9-_]+` (the existing slug charset), `since` must be a finite positive number ≤ `Date.now() + 5000` (reject future timestamps ± 5 s). Peer count cap already exists — no new cap needed.
- **Validate:** `artboard-lock.test.ts` — acquire, release, takeover, timeout (30 s lease), stale-lock detection.

### Task 3: `LockOverlay` client component

- **Do:** Per approved mockup. Mounts as an overlay on the canvas iframe when another peer's awareness `lock.slug` matches the current canvas slug.
  - Shows avatar + name + "is editing this canvas".
  - "Take over" button → calls `useLockArtboard(slug)` (broadcasts the lock for this client).
  - Stale-lock: if `Date.now() - lock.since > 30_000` AND the locking peer's awareness is absent → show "Anna left — Take over?" one-click affordance.
  - When locked by self: shows a small "You're editing · Release" chip (for when the user wants to explicitly unlock without committing).
- **Validate:** Two tabs: Tab A acquires lock → Tab B shows overlay → Tab B clicks Take over → Tab A shows "taken over" toast → Tab B can now edit.

### Task 4: Live-session new-canvas propagation

- **Do:** When a canvas is created via `POST /_api/canvas/create` (existing endpoint) AND there are connected hub peers on the same slug-namespace, broadcast a `canvas-list-update` event over the Yjs awareness channel: `{type: 'canvas-added', slug, title}`. Client: on receiving `canvas-list-update`, refresh the canvas tree (re-fetch `GET /_api/canvases`) without a full page reload.
  - **Scope guard:** this event is ephemeral (awareness, not Y.Doc) — it disappears when peers disconnect. A peer who was offline gets the canvas via git pull ("Get latest"), not via this event. This event is only a "hey, refresh your list" nudge for online peers.
  - Similarly, `canvas-deleted` → `{type: 'canvas-removed', slug}`.
- **Gotcha:** The canvas FILE still travels via git. This event is only about the list display — it calls the existing `GET /_api/canvases` to re-read from disk. No new files are created by the event receiver.
- **Validate:** Two tabs, same hub session: Tab A creates "Login" canvas → Tab B's tree updates within 1 s without reload. Tab B offline during create → does NOT see the canvas until "Get latest".

### Task 5: Hub admin UI realignment

- **Do:** Rework `plugins/design/hub/src/admin/` to present one repo/branch context:
  - New top-level: "Connected repo" display (repo URL + active branch from the hub's config / first connected client's context). This is read-only in the admin — the hub attaches to whatever the first client passes as the doc namespace prefix.
  - Rename "Documents" list to "Canvases" — show only slugs that match the active repo/branch prefix (e.g. `projects/repo-slug/branch-slug/*`), not all raw doc names.
  - Remove the flat global document list view.
  - Keep: token management, status, generate-invite button.
  - Size guard: hub admin stays ≤ 15 KB gz (existing CI guard).
- **Validate:** Hub admin loads; canvas list shows only the active repo/branch context; token generation still works.

### Task 6: DDRs

- **Do:** Write 2 DDRs:
  1. **Artboard locking model** — per-canvas soft single-writer via awareness field; 30 s lease; attributed takeover; stale-lock UX. Cite collab-model-design.md H2 (locking holds for un-mergeable artifacts); cite Perforce stale-lock failure mode as motivation for lease + takeover.
  2. **Live-session canvas propagation** — `canvas-list-update` awareness event for online peers; git pull remains the delivery mechanism for offline peers; event is ephemeral, not persisted.

---

## Validation

1. **Tests:** `bun test` — `artboard-lock.test.ts` + existing collab/room tests green.
2. **Security:** `flow:validate-security` — lock field sanitized at `sanitizeForeignState()` chokepoint; `canvas-list-update` event payload sanitized (slug charset assertion).
3. **No-break exhaustive verify (per `feedback-no-break-exhaustive-verify` memory):** All existing collab features (presence, cursors, annotations, comments) verified via agent-browser after changes to `use-collab.tsx`. Test: two tabs, hub session; verify cursors, comments, annotations all still live-sync.
4. **Scenario:** Two users, live session: create canvas (Tab B sees it instantly), Tab A edits (Tab B sees lock overlay + Take over), Tab B takes over (Tab A sees toast), both save.
5. **Hub admin:** loads, shows only active-context canvases, 15 KB gz limit met.

## Acceptance Criteria

- [ ] Lock overlay mockup approved (Task 1)
- [ ] Lock field on awareness: acquire, release, 30 s timeout, takeover (Task 2)
- [ ] `LockOverlay` renders all states per mockup (Task 3)
- [ ] `canvas-list-update` — online peer sees new canvas within 1 s (Task 4)
- [ ] Hub admin realigned to repo/branch context, 15 KB gz limit (Task 5)
- [ ] 2 DDRs written (Task 6)
- [ ] No-break exhaustive verify: all existing collab features still work
- [ ] Security pass: lock field + canvas-list-update sanitized
