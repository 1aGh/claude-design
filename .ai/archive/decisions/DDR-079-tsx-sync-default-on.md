## DDR-079 — TSX sync defaults ON for a linked project (supersedes DDR-072's opt-in)

- **Status:** Accepted — 2026-06-02
- **Authors:** 1aGh (after repeated live dogfood pain — see Context)
- **Phase:** 9 (linked-mode file sync) — ergonomics correction
- **Supersedes:** [DDR-072](./DDR-072-project-level-tsx-sync-opt-in.md) — flips its default-OFF, project-level opt-IN to a default-ON, project-level opt-OUT. Everything else in DDR-072 (the `linkedHub.syncTsx` field, the per-canvas `.meta.json "syncable"` override, the Lock-2 sandbox coupling) is retained — only the default polarity changes.
- **Superseded by:** —
- **Related:**
  - [DDR-060](./DDR-060-tsx-only-format-breaks-html-centric-sync.md) — TSX-only sync + the Lock-1/Lock-2 coupling. **Lock 2 is preserved** (see Invariants).
  - [DDR-054](./DDR-054-linked-mode-trust-model-and-task-4-hardening.md) — linked-mode trust model; the WebRTC/self-nav exfil residual (§F-series) this DDR consciously accepts in exchange for the UX.
  - [DDR-076](./DDR-076-empty-hub-doc-never-clobbers-local-canvas.md) — the empty-hub clobber fix; same dogfood session.

## Context

DDR-072 made TSX sync a **per-project opt-in, default OFF** ("only for hubs you operate or fully trust"). In practice this produced a recurring, expensive footgun. In one dogfood session it bit three separate times:

1. **"I linked but my teammate sees nothing."** A user links a hub, a second peer links the same hub, both run `serve` — and nothing syncs, because every canvas is `.tsx` and `syncTsx` was never set. The status line says "linked but 0 syncable canvases", which reads like a bug. The user hunts for the error instead of finding a hidden opt-in.
2. **`maude design link --adopt` silently does nothing for TSX.** `--adopt` sets the *direction* (push local up) but not the *set membership* (`syncTsx`). Running adopt to "make this repo authoritative and push it up" left `syncTsx` unset → 0 syncable → adopt had nothing to push.
3. **`git restore` wipes it.** `syncTsx` lives in the committed `.design/config.json`; a recovery `git restore` reverted it to the committed (off) state, silently re-disabling sync. `keepSyncTsx` on re-link only *preserves* an existing value, so it couldn't bring it back.

The default-off cost a real user three debugging detours. The opt-in's *purpose* — bounding the exfil residual to consciously-chosen projects — is real but is better served by a loud, opt-OUT-able default than by silent non-function.

## Decision

**`linkedHub.syncTsx` defaults to `true`.** A linked project syncs all its `.tsx` canvas bodies by default. The field becomes an **opt-OUT**:

- `linkedHub.syncTsx: false` → project-wide opt-out (no TSX syncs).
- per-canvas `.meta.json "syncable": false` → excludes one canvas (the sidecar still always wins, either direction).
- absence of the field → **on** (we deliberately do NOT write `syncTsx: true` to encode the default — a written value is what `git restore` wiped; absence-means-on is restore-proof).

The trade is explicit: we accept the DDR-054 WebRTC/self-nav exfil residual applying to every synced canvas of a linked project, in exchange for sync that works without a hidden switch. Mitigations make the trade safe-by-visibility, not safe-by-default-off:

- **Loud boot banner** on every `serve` against a non-loopback hub: `"N TSX canvas BODIES will sync to <hub> (TSX sync is ON by default — DDR-079) … link only hubs you operate or trust. Opt out: …"`.
- **`maude design status`** shows `TSX sync: on (default)` / `off (opted out)`, and prints a **migration advisory** when `syncTsx` is unset (so an upgrader who relied on the old default-off learns the polarity flipped).
- **`maude design link`** gains `--no-sync-tsx` (write `false`) and `--sync-tsx` (pin `true`), so the choice is a flag, not a manual config edit.
- **Trust gate unchanged** — linking a new non-loopback hub still requires explicit per-machine trust (DDR-054 F2/F4). You cannot sync TSX anywhere you haven't already trusted to write your `.design/`.

## Invariants preserved

- **Lock-2 (sandbox) coupling is UNTOUCHED.** A `.tsx` still syncs ONLY when the cross-origin CSP/sandbox is active (`ctx.canvasOrigin` set; `MAUDE_CANVAS_ORIGIN_SPLIT != 0`). `MAUDE_CANVAS_ORIGIN_SPLIT=0` disables the sandbox AND all TSX sync. Decoupling them would re-open the F1 RCE (DDR-060) — the default-polarity change does not touch this gate.
- **Per-canvas sidecar wins.** `resolveSyncable` precedence is unchanged: explicit `.meta.json "syncable"` (true OR false) beats the project default.
- **Solo mode unaffected.** No `linkedHub` → no sync at all, regardless of this default.
- **HTML behavior unchanged.** `.html` canvases were always syncable; still are.

## Consequences

- **Upgrade behavior change (intentional):** a project linked under maude < 0.27 with no explicit `syncTsx`, on upgrade, starts syncing its TSX on the next `serve`. The boot banner + status advisory announce this; opt out with `syncTsx: false`. This is the one sharp edge of the flip and is surfaced loudly rather than silently.
- **`--adopt` now "just works" for TSX** — adopt + default-on means a populated repo seeds the hub on first connect with no extra flag (the #2 footgun above is gone).
- Code: `scanCanvases` (`syncTsx !== false`), the boot banner condition, the zero-syncable message, `design-link.mjs` (flags + persistence + status advisory), and `config.schema.json` (`default: true`) all move together.

## Alternatives considered

- **Keep opt-in, add a `--sync-tsx` flag + loud 0-syncable warning (no default change).** Rejected by the project owner: a flag you must remember is still a footgun for the *second* peer (who didn't run the link command), and "0 syncable" warnings train users to ignore them. The default is the actual fix.
- **`--adopt` implies `syncTsx: true` (but global default stays off).** Fixes footgun #2 only; #1 (teammate sees nothing without adopt) and #3 (restore wipes it) remain. Partial.
- **Default on globally with NO opt-out.** Rejected — a project on a hub it doesn't fully trust needs an exit; `syncTsx: false` + per-canvas `syncable: false` are kept.
