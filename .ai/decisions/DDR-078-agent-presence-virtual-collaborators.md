# DDR-078: agents surface as virtual presence peers (avatar + color + funny name), client-side from ai-activity

- **Date:** 2026-06-02
- **Status:** Accepted
- **Tags:** design, dev-server, collab, presence, ai-activity, canvas-lib, phase-13.2
- **Related:** [DDR-075](./DDR-075-canvas-activity-overlay-fs-watch-driven.md) (the identity-less activity overlay this adds identity to), [DDR-077](./DDR-077-hmr-error-resilience-during-agent-editing.md) (the cross-bundle-provider + soft-reload lessons), Phase 8 collab (Yjs awareness, `participants-chrome`, `colorForName`, `ai-activity`), [`.ai/plans/phase-13-canvas-activity-overlay.md`](../plans/phase-13-canvas-activity-overlay.md)

## Context

The Phase 13 activity overlay (DDR-075) is deliberately identity-less — it's fs-watch-driven, so it knows a file changed but not *who* changed it (one blue hue, badge "editing — <file>"). The user asked: can multiple agents working on canvases feel like additional connected people — distinct colors, a funny name, a presence avatar in the corner, just like a human collaborator? The infrastructure already mostly exists (Phase 8): Yjs awareness + `participants-chrome` avatar stack, `colorForName` deterministic peer colors, live cursors, and `ai-activity` which already carries `author`.

## Decision

Agents surface as **virtual presence peers synthesized client-side from `ai-activity`** — NOT injected into the Yjs awareness protocol. When an agent is editing this canvas: an avatar joins the participants stack (peer chip + a subtle ✦ AI marker), and the activity overlay is tinted with the agent's own color and shows its funny name.

**MVP scope (confirmed with the user):**
- **One agent per canvas** — matches `ai-activity`'s file key. Multiple agents across the project each show in their own canvas tab; multiple agents on the *same* file at once is deferred (needs `ai-activity` multi-author).
- **Avatar + overlay only** — no roaming cursor (an agent has no real cursor coordinates; a synthetic one would mislead).
- **Subtle AI marker** — looks like a connected person, but a ✦ badge + an "AI agent" popover subtitle distinguish it from a human teammate.

### Mechanism

- **Identity, no flow change.** The funny name + color are derived deterministically from `${author}:${startedAt}` (both already on the `ai-activity` entry; `startedAt` is stable across heartbeats, so identity is stable for a session). `agentFunnyName()` = "Adjective Animal" (20×20); color = `colorForName(name)` — the *same* palette human peers use, so agents and humans read as one presence system. No change to what `/design:edit` posts.
- **Why client-side synthesis, not a Yjs ghost peer.** Injecting a server-side phantom into awareness would be invasive and could destabilize real-peer presence. `ai-activity` already broadcasts `{file, author}` to every client; mapping that to a virtual participant is read-only display with zero protocol risk.
- **`AgentPresenceProvider`** (canvas-lib bundle, mounted in `DesignCanvas` beside `CanvasActivityProvider`) subscribes to `ai-activity` exactly as `ai-banner` does — parent `dgn:'ai-activity'` postMessage relay when embedded, own inspector WS when standalone, plus a `GET /_api/ai` seed for a tab opened mid-edit — and exposes the agent via context. It MUST live in canvas-lib because its consumers (`DCArtboard`, `ParticipantsChrome`) are canvas-lib — the same cross-bundle-context rule DDR-077 established.
- **Overlay survives the soft-reload.** The 13.1 soft-reload (DDR-077) remounts the canvas without a page reload, which resets the activity provider and skips the snapshot that normally re-seeds it. So `_shell.html` now keeps `window.__maude_activity_seed__` live-updated on every `activity` message (not just on `snapshot`); the remounted provider re-seeds from it. Without this, the overlay vanished on every agent `.tsx` save.

## Consequences

- **Positive:** an editing agent reads as another connected person — avatar (initials + ✦) in the corner, the overlay rim/badge in the agent's color with its funny name, alongside the existing "Claude is editing" banner. Reuses `ai-activity` + `colorForName` + the participants stack; no Yjs surgery, no new dep, no flow-command change.
- **Negative / accepted:**
  - One agent per canvas (multi-agent-on-same-file deferred — would need `ai-activity` keyed by `(file, author)` + a broadcast-shape change rippling to `ai-banner`).
  - No roaming cursor.
  - Funny name collides only if two same-`author` agents start in the same millisecond — astronomically unlikely; not guarded.
  - The pre-existing "presence peers accumulate on tab switch" bug (each iframe = 1 collab WS = 1 self-peer) is **not** addressed here — agent avatars are virtual (not Yjs peers) so they don't worsen it; tracked separately.
- **Security:** the avatar/popover shows the `author` string, which the Phase-8 `ai-banner` already displays; color/name are derived locally; `ai-activity` is already broadcast on the inspector channel. Read-only display — no new exposure or write surface (the `/flow:validate` defender pass found nothing; no XSS — `author` is React-escaped text, `color` is palette-bounded, the dynamic import is path-confined).
  - **Hardened after the validate adversarial pass:** the ethical-hacker flagged that the new `ai-activity` `postMessage` listeners (and the pre-existing `ai-banner` one) had no origin/source check, so a hostile canvas (under the gated DDR-054 untrusted-synced threat) could self-post a forged `author` → a durable, named "AI agent · <forged>" identity (a low→medium social-engineering / identity-spoof primitive, no code-exec). **Fixed:** all three `ai-activity` `postMessage` handlers (`use-agent-presence.tsx`, `templates/_shell.html` agent gate, `ai-banner.tsx`) now require `e.source === window.parent && window.parent !== window` — only the trusted embedding parent relays the event; canvas self-posts are rejected (standalone receives `ai-activity` via its own WS, never `postMessage`). Additionally `deriveAgent` re-bounds the `author` client-side (strip control chars, cap 120) since the relay path bypasses the server cap. Verified live: legit presence still renders; a forged `window.postMessage` is rejected (the spoofed identity does not appear).
- **Tested:** `use-agent-presence.test.tsx` (funny-name determinism, `deriveAgent`, provider gating via the `initialAgent` seed). Live-verified: agent `ai-activity` → orange/blue avatar ("Sleepy Lynx" / "Nimble Ferret") with ✦ marker + matching-color overlay rim + "editing — <funny name>" badge; survives the soft-reload; the non-agent manual-edit path is unchanged (default blue rim + file label, no avatar).
