## DDR-072 — Project-level TSX sync opt-in (`linkedHub.syncTsx`) — coarse-grained equivalent of the per-canvas `syncable` flag

- **Status:** Accepted — 2026-06-01
- **Authors:** 1aGh (surfaced during live remote-hub dogfood — linked repo synced 0 of 55 TSX canvases)
- **Phase:** 9.1 (TSX sync unblock) — ergonomics follow-up
- **Supersedes:** —
- **Superseded by:** —
- **Amends:** [DDR-060](./DDR-060-tsx-only-format-breaks-html-centric-sync.md) §4 (9.1-B) — relaxes "Default stays off (solo-safe)" to add a *project-scoped* default-on switch, while keeping the global default off and the sandbox coupling intact.
- **Related:**
  - [DDR-060](./DDR-060-tsx-only-format-breaks-html-centric-sync.md) — TSX-only migration broke HTML-centric sync; established the per-canvas `.meta.json "syncable": true` opt-in (9.1-B) + the Lock-1/Lock-2 coupling.
  - [DDR-054](./DDR-054-linked-mode-trust-model-and-task-4-hardening.md) — linked-mode trust model; §F1 (RCE via hub-pushed JSX → contained by the 9.1-A cross-origin sandbox), §F2 (committable-allowlist trust-laundering lesson), §F4/§2i (per-machine attestation pattern).

## Context

A user stood up a self-hosted hub, ran `maude design link <https-url> --token …`, and started `maude design serve`. The server reported **"linked but 0 syncable canvases — 55 TSX canvas(es) found but none are syncable"**. This is exactly the DDR-060 design: a `.tsx` body syncs only when **both** locks engage —

- **Lock 2** — the cross-origin CSP/sandbox is active (`ctx.canvasOrigin` set; `MAUDE_CANVAS_ORIGIN_SPLIT != 0`). This is the F1 containment shipped in 9.1-A. **Default ON.**
- **Lock 1** — the canvas's sibling `.meta.json` declares `"syncable": true`. **Default OFF, per-canvas.**

The per-canvas opt-in is **not** redundant belt-and-suspenders to the sandbox. The F1 re-audit found that even with the sandbox in force, an opted-in hostile canvas can still exfiltrate collab metadata over **WebRTC data channels / self-navigation** — a residual the CSP does not close (documented at `server.ts` T2 comment and surfaced in the `maude design link` banner). Lock 1 is the conscious human decision *"this specific canvas is safe to push to the hub,"* which bounds that residual to hand-picked canvases.

The friction: a real project carries dozens of TSX canvases. Editing 55 sidecars by hand to enable sync is hostile ergonomics, and the absence of a project-level switch made users assume sync was broken rather than off-by-design.

The user explicitly wanted a **single project-level switch in `.design/config.json`**, NOT a true global default-on (which would re-expose the residual to every linked project) and NOT a one-off bulk sidecar edit.

## Decision

Add an optional **`linkedHub.syncTsx: boolean`** to `.design/config.json`. When `true`, every `.tsx` canvas in the project defaults to syncable — no per-canvas sidecar needed.

### Precedence (tri-state resolution — `sync/index.ts` `resolveSyncable`)

1. A per-canvas `.meta.json "syncable"` **boolean always wins** when present: `true` opts in, **`false` opts out** (the escape hatch for a sensitive canvas under a project-wide opt-in).
2. Otherwise fall back to the project-level `linkedHub.syncTsx` default.
3. Missing / unparseable sidecar → no explicit verdict → the project default.

### Invariants preserved

- **Lock 2 coupling is untouched.** `syncTsx` is gated on `splitActive` (`ctx.canvasOrigin`) exactly like the per-canvas flag: with the sandbox off, **no `.tsx` syncs regardless of the flag**. Decoupling them would re-open F1 (DDR-060).
- **Global default stays OFF.** A project with no `syncTsx` (or `syncTsx: false`) behaves bit-for-bit as before. Solo mode (no `linkedHub`) is entirely unaffected.
- **Discovery is the sole chokepoint.** A per-canvas `CanvasSyncAgent` is only created for a canvas that passed `scanCanvases()`, and inbound hub writes route exclusively through those agents. So flipping discovery makes sync bidirectional automatically; `_untrusted/INDEX.json` + the managed `.claudeignore` block (which consume the discovery set) auto-expand. No separate inbound gate to wire.
- **The flag is never synced to the hub.** Like `syncable`, it is local-only config; a hostile hub cannot flip a project into broad-sync.

### Trust model (why a committed flag is acceptable here)

The **per-machine token in `~/.config/maude/hubs.json` remains the consent boundary.** A malicious PR that adds `linkedHub.syncTsx: true` (or even `linkedHub.url`) does **nothing** on a machine that has not run `maude design link` and stored a token — `createSyncRuntime` returns null without a token. This is the same boundary that makes the committed `linkedHub.url` safe, and it sidesteps the DDR-054 §F2 "committable allowlist is a trust-laundering primitive" trap: the flag cannot self-activate.

The residual risk: on a machine **already linked** to a hub (token present), a PR flipping `syncTsx: true` would broaden what syncs to that **already-trusted** hub from hand-picked canvases to all `.tsx`. Mitigations:

- **Loud boot banner** (non-loopback hubs): `maude design serve` prints how many TSX bodies will sync, to which URL, and the residual reminder — a sneaky flip surfaces on the next serve, never silently.
- **Re-link resets on URL change.** `maude design link` preserves `syncTsx` only when re-linking to the **same** normalized URL; pointing at a new hub drops it (a new hub is a fresh trust decision — the DDR-054 §F2 lesson applied).
- The broadened residual is `git`-visible (config.json is committed + PR-reviewed) and bounded to a hub the user already trusts.

### Rejected alternatives

- **True global default-on** (flip `readSyncableFlag` default / drop the opt-in): re-exposes the WebRTC/self-nav residual to *every* linked project for users who never consciously chose it. Contradicts the core of DDR-060/054.
- **Per-machine attestation** (a `~/.config/maude/hubs.json` `syncTsxConsentedAt` à la `adoptedAt`, gating the config flag): heavier CLI surface for marginal gain — the token already establishes per-machine consent, and the loud banner covers the silent-PR-flip case. Recorded as the available knob if a future incident shows the committed flag is too permissive.

## Consequences

### Positive
- One git-tracked switch enables TSX sync for a whole project; the headline Phase 9 feature is usable on real (TSX-only) projects without 55 hand edits.
- Per-canvas `syncable: false` gives a precise opt-out under a project-wide opt-in.
- The sandbox coupling + token-as-consent-boundary keep the change inside the existing trust model rather than punching through it.

### Negative
- A project that opts in widens the WebRTC/self-nav exfil residual from hand-picked canvases to all of them (bounded to the linked hub). Documented; surfaced by the boot banner; acceptable under "hubs you operate or fully trust."
- One more `linkedHub` field to keep in lockstep across the type (`context.ts`), the schema (`config.schema.json`), the discovery gate, and the CLI re-link path.

### Rollback path
- Solo + unflagged projects are unaffected, so disabling is just removing the field (or `syncTsx: false`). If the committed flag is later judged too permissive, gate it behind the per-machine attestation described in "Rejected alternatives" and supersede this DDR.
