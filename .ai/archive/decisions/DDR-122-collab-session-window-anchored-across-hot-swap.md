# DDR-122 — Collab session is window-anchored (non-enumerable Symbol) so it survives a canvas hot-swap

**Status:** accepted · **Date:** 2026-06-20 · **Phase:** 30 (multiplayer)
**Supersedes/relates:** DDR-051 (Yjs canvas collab), DDR-054 (untrusted canvas / semi-trusted hub trust model), DDR-077 (HMR soft-reload), DDR-079 (TSX sync default-on), DDR-116 (visual conflict picker)

## Context

Phase-30 finding **F4** (`.ai/logs/rca/issue-collab-observer-tsx-reload-flicker.md`): a cross-peer synced edit re-rendered the observer's canvas via a full iframe `location.reload()`, blinking presence (avatars/cursors drop + reconnect) and losing in-canvas state. The fix routes synced body changes through the existing `softReload()` **hot-swap** (re-import the canvas module + remount in place) instead of a reload.

But the hot-swap **remounts** `<CollabProvider>` (it lives inside `DesignCanvas`, inside the `key={attempt}` subtree). A per-component Y.Doc + Awareness + WebSocket is therefore torn down + re-handshaked on every swap. The first fix attempt cached the session in a **module-level** `const SESSIONS = new Map()` — which **failed live** (finding **F5**: phantom "self" avatars piled up 1→2→…→8 per edit). Root cause: `softReload` re-imports the canvas bundle with a `?v=` **cache-buster**, and `use-collab` is **inlined** into that per-canvas bundle, so each hot-swap re-evaluates a **fresh module with a fresh, empty map**. The session cache was wiped by the very re-import it was meant to survive; each swap minted a new Yjs `clientID` whose awareness lingered on the hub until timeout.

## Decision

Anchor the refcounted collab-session registry on the **iframe's `window`**, resolved **lazily** (per access), under a **non-enumerable global Symbol** key:

```ts
const SESSIONS_KEY = Symbol.for('maude.collab.sessions.v1');
// Object.defineProperty(window, SESSIONS_KEY, { value: new Map(), enumerable: false, ... })
```

- **`window`, not module scope** — `window` is the only store that survives a cache-busted module re-evaluation within the same realm. (Same pattern the repo already uses for undo stacks `__maude_undo_stacks` and the activity seed `__maude_activity_seed__`.)
- **A *global* Symbol (`Symbol.for`)**, not a per-module `Symbol()` — the re-imported module must resolve the **same** key; `Symbol.for` uses the per-realm global registry, so it does. A plain `Symbol()` would be a fresh symbol each re-import and defeat survival (the F5 bug in disguise).
- **Non-enumerable** — the registry holds live network handles, and the canvas iframe is untrusted (DDR-054) sharing this realm. Keying by a non-enumerable Symbol keeps it off `for…in` / `Object.keys(window)` so it can't be harvested by an opportunistic global sweep.

Refcount + a short grace-window teardown (`SESSION_GRACE_MS`) keep the session alive across the unmount→remount gap; a genuine close tears it down so the peer leaves cleanly.

## Consequences

- ✅ Presence survives the hot-swap: stable `clientID`, one socket, no avatar accumulation (verified live — fresh room, peer alone, repeated edits → 0 avatars).
- ✅ F4 seamless synced updates without the reload blink; scroll / tool mode / undo also survive.
- ⚠️ **Security residual (NOT introduced by this change, but adjacent).** The Symbol key is **defense-in-depth, not a trust boundary**: a determined attacker can call `Symbol.for('maude.collab.sessions.v1')`, and — more fundamentally — untrusted same-realm canvas script can already reach the live Y.Doc via `useCollab()` and inject CRDT body ops that the sync agent propagates to **every peer's disk** (stored-XSS / Claude-Code-context-poisoning lane, DDR-054 F1/F3). The adversarial review (`.ai/logs/security-reviews/native-app-20260620-0724-attacker.md`) rated the chained worst case HIGH; the defender review judged it pre-existing (the doc was always reachable in-realm). **Accepted as a pre-existing trust-model gap**, hardened only against opportunistic discovery here.

## Follow-up (tracked, not done here)

**Origin-gate canvas-injected doc ops.** `CollabProvider.onDocUpdate` broadcasts *any* non-server doc update to the hub, including ops a canvas script injects via `useCollab().doc`. A real fix tags update origins (sync-agent / inspector / user-gesture = trusted; bare canvas-script mutation = untrusted) and refuses to broadcast untrusted-origin body ops — closing "untrusted canvas writes `.tsx` to all peers." That's a Phase-30+ hardening with its own design; out of scope for the F1/F4/F5 bug-fix.

## The lesson (for future agents)

**Module-scoped singletons do NOT survive a cache-busted dynamic re-import of a bundle that inlines them.** If you need state to persist across a `softReload`/hot-swap (the canvas re-import path), it must live on `window` (per-realm), keyed by a **global** Symbol. A unit test that mounts/unmounts in one module instance will pass while the live re-import path fails — verify hot-swap-survival behavior *live*, not just in `bun:test`. (This is the collab analogue of DDR-045's `/$bunfs/root` trap: the unit harness hides a realm/identity difference the live runtime exposes.)
