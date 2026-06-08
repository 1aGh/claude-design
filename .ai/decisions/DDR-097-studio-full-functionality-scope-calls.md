# DDR-097: Studio full-functionality pass — scope calls (Plan C)

- **Date:** 2026-06-07
- **Status:** Accepted (implemented — Plan C Tasks 1–9 live-verified via agent-browser)
- **Tags:** dev-server, studio, client, shell, canvas-origin, export, inspector, presence, command-palette, hub-sync
- **Related:** [DDR-096](./DDR-096-studio-shell-rewritten-in-maude-ds.md) (Plan B — shell rewritten in maude DS, this completes its deferrals), [DDR-054](./DDR-054-linked-mode-trust-model-and-task-4-hardening.md) (canvas iframe untrusted origin), [DDR-060](./DDR-060-linked-not-syncable-status.md) (hub-sync notSyncable status), [DDR-045](./DDR-045-real-disk-path-resolution-for-compiled-dev-server.md). Plan: [`feature-studio-full-functionality-parity.md`](../plans/feature-studio-full-functionality-parity.md). Parity: [`studio-shell-parity.md`](../context/studio-shell-parity.md) § P.

## Context

DDR-096 made the studio *look* like maude but left a gap between `.design/ui/Studio.tsx`
and the running studio: static placeholders where live state belonged (top-bar zoom
hardcoded `100%`, artboard count = tab-count, hub-sync hidden for the common linked
case), deferred surfaces (Inspector, richer palette, shell export dialog, presence), and
a comment popover missing its pin badge. A user audit (2026-06-07) catalogued them; Plan C
closed them. Several required scope calls — recorded here.

## Decisions

1. **Top-bar zoom = relay, not full pan/zoom.** `canvas-shell.tsx` emits `dgn:zoom` (settle-
   cadence) from the existing `artboardsCtx.viewport.zoom`; `app.jsx` clamps + displays it.
   The canvas zoom was already real (the audit wrongly reported the in-canvas minimap/zoom/
   annotation-toolbar as missing — all three exist). A full shell-driven pan/zoom world
   transform stays out of scope.

2. **Artboard count = shell-side from `.meta.json`.** Read `/_api/canvas-meta` `artboards[]`
   on active-canvas change — no iframe dependency (an optional `dgn:artboards` override is
   also accepted). Replaces the misleading `tabs.length` (0/1).

3. **Hub-sync slot always-on.** `/_sync-status` returns three shapes — solo (`linked:false`,
   hide), DDR-060 `notSyncable`, and the connection-state machine `{state,queuedOps,flash}`.
   The old guard only rendered `notSyncable`, so the common linked case showed nothing (the
   "hub sync se neukazuje" bug). Now all three map to a label; this **supersedes DDR-060's
   notSyncable-only placement** while keeping its 0-syncable copy.

4. **Inspector = display-only; writeback stays Phase 12.** Inspect/Layers/CSS read the live
   `selected` payload (`bounds/tag/classes/dom_path/html`). The CSS tab is explicitly read-
   only with a Phase-12 callout — honoring DDR-096's refusal to ship a panel "claiming
   functionality it lacks." Live CSS-knob writeback needs a canvas-origin write bridge
   (DDR-054) and is a separate phase. Computed fill/radius/type also wait for that bridge.

5. **Export dialog over the real backend; handoff stays CLI.** A shell-level maude `.st-dialog`
   (6-format grid + PPTX/Canva kept, no silent cap) POSTs to the privileged main-origin
   `/_api/export`. The **shadcn/handoff card copies `/design:handoff`** rather than adding an
   HTTP file-write route — handoff writes a sidecar to disk, exactly the privileged surface
   DDR-054 keeps off canvas-reachable routes; it stays Claude/CLI-driven.

6. **Presence = local user + agent, not multiplayer.** The menubar shows the git-user avatar
   (`/_api/git-user`) + a transient agent avatar on `ai-activity`. Full human multiplayer
   presence (the mock's fictional Petra/Sam) is a separate WS-channel feature. **ParticipantsChrome
   (the in-canvas peer/cursor stack) is KEPT** — it is live-collab presence inside the canvas,
   complementary to the shell menubar's local-identity + agent indicator, not a duplicate.

7. **Command palette = full grouped set; ⌘K unchanged.** Grouped Canvas/View/Tools/Help with
   New canvas / Export / Handoff / Draw / inspector / theme / … Combo shortcuts (⌘N/⇧⌘E/I) are
   shown as hints but NOT globally bound (⌘N collides with the browser; bare `I` added).
   "Draw a mark" copies `/design:draw` — the shell cannot invoke Claude, so surfacing the
   command is the honest affordance.

## Consequences

- The studio is now functional, not just styled: live zoom/artboard/hub-sync, working palette,
  real export, a display-only inspector, menubar presence, DS folder icons, `.st-toast`.
- **Verified:** every Plan-C parity row (§ P) live via agent-browser; `maude design smoke`
  88/88 styled; release bundles rebuilt (`client.bundle.js` 271 KB, `comment-mount.js` 39 KB;
  `dist/runtime/*.js` untouched per CLAUDE.md).
- **Deferred (recorded, not dropped):** full pan/zoom world; live CSS writeback + computed-style
  readout (Phase 12); presentation mode (Phase 6); real human multiplayer presence; ZoomHud
  visually separated from the in-canvas tool palette (P16 — functional today). Comment-pin
  badge (P18) shipped in the bundle; visual confirmation pending a commented canvas.
