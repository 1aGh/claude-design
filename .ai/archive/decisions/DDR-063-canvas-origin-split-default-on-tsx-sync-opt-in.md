## DDR-063 — Canvas-origin split is ON by default (opt-out); `.tsx` sync stays per-canvas opt-in; F1 accepted at MEDIUM

- **Status:** Accepted — 2026-05-29
- **Authors:** 1aGh (decision) + Claude (implementation + two ethical-hacker re-audits)
- **Phase:** 9.1 (TSX sync unblock) — closes the T2 default-flip question
- **Supersedes:** —
- **Superseded by:** —
- **Amends:** [DDR-054](./DDR-054-linked-mode-trust-model-and-task-4-hardening.md) §F1 (CRITICAL → MEDIUM after containment + the three residual fixes); [DDR-060](./DDR-060-tsx-only-format-breaks-html-centric-sync.md) (the remediation it authorized is now shipped)
- **Related:**
  - `.ai/plans/phase-9.1-tsx-sync-unblock.md` — the plan (archived on close)
  - `.ai/logs/security-reviews/phase-9.1-t2-f1-cross-origin-reaudit.md` — the two F1 adversarial passes (gitignored; this DDR is the committed summary)

## Context

Phase 9.1 made the TSX-only canvas format syncable without re-opening the audit's CRITICAL **F1** (hub-pushed JSX → RCE/exfil in a same-origin, CSP-less iframe). The containment — a segregated canvas origin under strict CSP + route-allowlist + iframe sandbox (`MAUDE_CANVAS_ORIGIN_SPLIT`) — was built behind an opt-IN env flag (default OFF) while its interactive-feature parity was stabilised. Two questions remained: (1) should the split become the default, and (2) does the F1 residual permit it.

Two independent ethical-hacker passes ran against the built containment. The first found three residuals; all were fixed (see Decision). The confirming pass verified the fixes hold and rated **F1 → MEDIUM** (down from CRITICAL): the file-read / RCE / privileged-route legs are closed; a WebRTC + self-navigation *collab-metadata* exfil lane remains (no browser fully closes it today — the CSP `webrtc` directive is unimplemented as of 2026), and the canvas origin structurally retains the trifecta's data leg (collab reads like `/_api/git-committers`, load-bearing for @mention/pins).

## Decision

**1. The canvas-origin split (`MAUDE_CANVAS_ORIGIN_SPLIT`) is ON by default — opt-out via `=0` (or `false`/`off`/`no`).** This turns on reading the two locks separately:

- **Lock 2 (the sandbox/split) default-on is purely protective.** For the solo case (no hub, no untrusted content) it sandboxes the user's *own* canvas code under CSP — a strict security improvement over same-origin, with zero functional regression (selection / comments / presence / motion verified). There is no exfil concern when the content is the user's own.
- **It does NOT auto-enable untrusted `.tsx` sync.** **Lock 1** — the per-canvas `"syncable": true` flag in the canvas's `.meta.json`, hand-set and deliberately *excluded* from the untrusted `/_api/canvas-meta` PATCH whitelist — remains the gate. So the WebRTC/self-nav residual is reachable only for a canvas the user *explicitly opted into syncing* from a hub, exactly as before the flip.
- **The two locks stay coupled** (the "two locks flip together" invariant): `.tsx` is admitted to sync iff the split is active AND the sidecar opts in. `MAUDE_CANVAS_ORIGIN_SPLIT=0` disables the sandbox and, by the coupling, `.tsx` sync with it. Never decouple them — a synced `.tsx` without the sandbox re-opens CRITICAL F1.

**2. F1 is accepted at MEDIUM for opt-in synced canvases.** The residual (collab-metadata exfil via WebRTC/self-nav from a canvas you chose to sync from a hub you chose to trust) is bounded, opt-in, and surfaced: the linked-mode banner + `/docs/hub/linking` document it, and every synced canvas is flagged untrusted (`.design/_untrusted/INDEX.json` + a managed `.claudeignore` block, DDR-054 §3 F3).

**3. Making `.tsx` *sync itself* default-on is explicitly NOT done.** That would require the tracked residuals below to close first.

### The three residual fixes (shipped this phase)
- **`%2f` path-traversal** (could read repo source outside `designRoot`): `isCanvasSafeRoute` now decode + normalises before gating, so the gate and `safePathUnderRoot` decode symmetrically. Confirmed closed by 35+ encoding payloads.
- **WebRTC exfil** (`connect-src` doesn't cover it; CSP `webrtc 'block'` is unimplemented in 2026 browsers): best-effort `RTCPeerConnection`/`webkitRTCPeerConnection`/`RTCDataChannel` lockout in `templates/_shell.html`, plus the CSP directive for when browsers enforce it.
- **Annotation-SVG XSS**: `sanitizeAnnotationSvg` rewritten from a denylist to an allowlist (element allowlist + dangerous-content removal + attribute denylist), closing `<svg:script>` / entity / `<style>` / CSS-`url()` bypasses.

## Consequences

- **Solo users** get a sandboxed canvas by default — more secure, no behavior change beyond isolation. `=0` restores the legacy same-origin path.
- **Linked users** still see nothing sync until they hand-opt-in a canvas; the loud zero-syncable surface (9.1-D) explains why.
- **Tracked residuals** (revisit before ever making `.tsx` sync default-on): WebRTC/self-nav metadata exfil; collab WS slug not slug-authorized (loopback + metadata only); the canvas-origin safe-API exposing collab reads (the trifecta data leg, retained because @mention/pins need it). None is reachable without an explicit per-canvas sync opt-in.
- The F1 re-audit report is gitignored under `.ai/logs/security-reviews/`; this DDR is its committed summary.
