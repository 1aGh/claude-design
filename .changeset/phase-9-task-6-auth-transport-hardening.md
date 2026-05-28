---
"@1agh/maude": minor
---

Phase 9 Task 6 — auth + transport hardening (hub-side HMAC token store + per-token
rate limit + WSS boot guard; CLI-side trust gate, adopt manifest, linked-mode banner).

**Hub:** the token store moves from a plaintext `tokens.json` to a SQLite `tokens`
table whose `hash` column holds `hmac_sha256(token, hubKey)` — the raw token value
is never written to disk, so a leaked store yields no replayable credentials. A
pre-Task-6 `tokens.json` is imported once on first open (raw values hashed in) and
renamed aside. `onAuthenticate` now rate-limits each token to 100 authentications
per 60s window (caps reconnection/replay floods on a leaked token), and `createHub`
refuses to boot when `HUB_PUBLIC_URL` is plaintext `http://` to a non-loopback host
unless `HUB_INSECURE_HTTP=1` (TLS terminates upstream — Fly auto-cert / Caddy ACME /
Cloudflare Tunnel / Tailscale Funnel).

**CLI:** `maude design link`/`adopt` against a non-loopback hub now requires explicit
trust (DDR-054 F2) — an interactive `[y/N]` confirmation (or `--yes` non-interactively;
refuses in a non-TTY without `--yes`) that prints the URL/scheme/host warning, then
records the hub **per-machine** (in `~/.config/maude/hubs.json` under `trusted[]`, like
`~/.ssh/known_hosts`) so re-linking doesn't re-prompt. Trust is deliberately NOT a
committable repo file — that would let a malicious PR pre-seed trust and bypass the
gate. `--adopt` prints the manifest of local files it will upload and stores an
`adoptedAt` attestation in `~/.config/maude/hubs.json` (DDR-054 F4). Every non-loopback
link prints the DDR-054 linked-mode preview banner (F3). Loopback hubs are exempt from
all gating — solo/local-dev behavior is unchanged.
