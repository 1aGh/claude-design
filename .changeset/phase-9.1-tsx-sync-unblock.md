---
"@1agh/maude": minor
---

Phase 9.1 — unblock linked-mode sync for the TSX-only canvas format, safely (DDR-060).

**The gap being fixed:** linked-mode sync (Phase 9) only ever admitted `.html` canvases,
but `.tsx` has been the only canvas format since Phase 3.6 — so for every real project,
sync was a silent no-op (`maude design status` looked healthy while syncing nothing). This
phase makes `.tsx` syncable without re-opening the audit's CRITICAL **F1** (hub-pushed JSX →
RCE/exfil).

**Canvas-origin containment (T2 / 9.1-A, now ON by default — opt out with
`MAUDE_CANVAS_ORIGIN_SPLIT=0`):** canvas iframes are served from a segregated origin under a
strict CSP + route-allowlist + iframe sandbox, so a hostile canvas can't reach `/_api/export`,
`/_config`, repo files, cloud IMDS, or the LAN. In solo mode this purely sandboxes your own
canvas code (a security improvement, zero functional regression). An F1 adversarial re-audit
found and this release closes three residuals: a `%2f`-encoded path-traversal that leaked repo
source (decode-then-gate fix), a missing WebRTC exfil control (best-effort `RTCPeerConnection`
lockout in the canvas shell + `webrtc` CSP directive for when browsers enforce it), and an
annotation-SVG sanitizer hardened from a denylist to an allowlist. F1 drops from CRITICAL to
MEDIUM — the remaining WebRTC/self-navigation exfil applies only to a canvas you *opt into
syncing*, and the reachable data is collab metadata, not repo files.

**Per-canvas `.tsx` sync opt-in (T3 / 9.1-B):** a `.tsx` body syncs only when BOTH the
sandbox is active (`MAUDE_CANVAS_ORIGIN_SPLIT=1`) AND its `.meta.json` sidecar declares
`"syncable": true` — coupled deliberately (the opt-in is inert without the sandbox) and
hand-set only (not settable by a remote hub or a canvas). `.html` canvases sync as before.
Default behavior is unchanged: nothing syncs until you opt in.

**Untrusted-context marking (T4.5 / F3):** every synced canvas is flagged as untrusted
Claude-context — `.design/_untrusted/INDEX.json` + a managed `# maude:sync-untrusted` block in
`.claudeignore` list the synced body/comments/annotations so an injected instruction string
can't steer a `/design:edit`. Rewritten each `serve`, cleared when nothing syncs.

**Docs (T5):** the linked-mode CLI banner + `/docs/hub/linking` now describe the HTML-by-
default / TSX-by-opt-in model and the untrusted-context markers.

Solo (unlinked) projects now get the protective canvas sandbox by default (no behavior change
beyond stronger isolation of their own canvas code; `MAUDE_CANVAS_ORIGIN_SPLIT=0` restores the
legacy same-origin path). Actually *syncing* a `.tsx` from a hub still requires the explicit
per-canvas `syncable` opt-in — that surface is unchanged.
