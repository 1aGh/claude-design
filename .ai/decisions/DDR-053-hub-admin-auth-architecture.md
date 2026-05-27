# DDR-053 — Hub admin auth architecture (Bearer-only, atomic single-use bootstrap, scope-bound tokens, session-kick on rotate, CSP-hardened admin origin)

- **Status:** Accepted — 2026-05-27
- **Authors:** 1aGh (with security-auditor + ethical-hacker subagent input under /flow:validate of phase-9 Task 2.5)
- **Phase:** 9 (self-hostable hub + file sync)
- **Supersedes:** —
- **Superseded by:** —
- **Related:**
  - [DDR-047](./DDR-047-collab-scope-cut-no-lan-mode-hub-admin-ui.md) — collab scope cut + hub admin UI decision
  - [DDR-052](./DDR-052-hocuspocus-over-partykit-for-hub.md) — Hocuspocus over PartyKit for hub
  - Phase 9 plan §Task 2.5 (admin UI) + §Task 6 (auth + transport hardening — extends this DDR)

## Context

Phase 9 Task 2.5 added an in-hub admin UI: vanilla-JS single-page app at `/admin`, JSON routes at `/admin/api/*`, single-use bootstrap-key flow for first-admin claim. The slice's first `/flow:validate` pass surfaced **three structural issues** that the defender (security-auditor) and attacker (ethical-hacker) subagents independently flagged:

1. **Bootstrap key TOCTOU + indefinite reissuance.** `verifyAndConsume` was read→check→write non-atomic; two concurrent POSTs could both win. `maybeIssueOnBoot` regenerated the key on every restart of an unclaimed hub, keeping a live credential rotating through logs forever.
2. **`?secret=` query-string auth + admin secret in response body + localStorage.** Three independent surfaces leaked the same long-lived credential: URL query strings appear in Referer headers + proxy logs + browser history; the bootstrap POST response leaked the minted secret into TLS-MITM corp proxy archives; `localStorage` made any single XSS in the admin origin a permanent compromise.
3. **`documentName` unconstrained — token leak = full hub compromise → AI trifecta when Task 4 lands.** Tokens authenticated label only; any valid token could subscribe to any document on the hub. Once Phase 9 Task 4 wires bidirectional fs sync, a planted Y.Text becomes prompt-injection on every peer that reads it into `/design:edit` context → trifecta closed (private data + untrusted content + outbound exfil).

The original Task 2.5 spec deferred these to "Task 6 hardens auth" but the validate gate (severity floor: medium) blocked commit. This DDR records the auth architecture decided during the in-slice hardening pass, so Task 6 inherits a fully-specified contract rather than re-debating the same trade-offs.

## Decision

**Adopt Bearer-only admin auth, atomic single-use bootstrap, scope-bound tokens with default `scope = label`, session-kick on rotate, and a CSP-hardened admin origin.** Concretely:

### 1. Admin-channel auth: `Authorization: Bearer <secret>` only.

- `?secret=` query-string auth is **removed** from `verifyAdminAuth`.
- `admin.json` (file-scoped secret minted by bootstrap consume) and `HUB_SECRET` (env override) both authenticate via the same Bearer header.
- The browser client sets the header from `localStorage["maude-hub-secret"]`. The previous "browser convenience" rationale for `?secret=` evaporates — the JS already sets the header.
- All `/admin*` and `/admin/api/*` responses set `Cache-Control: no-store, no-store`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, and `Content-Security-Policy: default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`.

### 2. Bootstrap: atomic single-use, print-once, no reissue.

- `verifyAndConsume` is serialized through a **per-`dataDir` in-process Promise chain** so two concurrent calls cannot both pass the `usedAt === null` check. Writes are atomic (`writeFileSync(path + '.tmp')` → `renameSync` → mark used).
- `maybeIssueOnBoot` no longer regenerates a fresh key after consumption or expiry. After the first issuance is consumed (or expires), subsequent reboots **do not** print a new bootstrap link; instead they print:
  ```
  [hub] Hub unclaimed window closed. Restart with HUB_SECRET=<value> env to set the admin secret.
  ```
- This stops the "indefinite-window unclaimed hub keeps minting credentials into logs" attacker scenario (F1).

### 3. Tokens carry an optional `scope` that gates Yjs subscriptions.

- `addToken({ label, scope?, dev? })`. New tokens default `scope = label` (interpreted as: `documentName` must equal `label` exactly OR start with `label + "/"`).
- Explicit `scope = "*"` mints an unscoped (wildcard) token — required for legacy `/design` canvases that use the canvas-slug as documentName, OR for tokens that should access all docs (admin-on-Yjs). The admin UI's "Generate invite" defaults to label-scoped; an "advanced" checkbox can mint wildcard.
- `onAuthenticate` rejects subscriptions whose `documentName` doesn't satisfy the token's scope (returns the standard Hocuspocus auth failure → WS close).
- Existing pre-DDR tokens (no `scope` field) are grandfathered as wildcard so prior peers don't break on upgrade. Operators rotating their tokens after this DDR ships pick up the default scope automatically.

### 4. Rotation kicks active sessions.

- `POST /admin/api/token/rotate` iterates `peers` Map after writing the new token; force-closes every connection whose `context.user.name === label`. The HTTP response includes `disconnected: <count>`.
- Eliminates the "rotate gives false confidence — attacker dwell time unbounded" failure mode (F5).

### 5. Input validation at the auth boundary.

- `label`: server-side regex `^[A-Za-z0-9 _.\-]{1,64}$` (mirrors the client `pattern=` attribute).
- `documentName`: `^[A-Za-z0-9._/\-]{1,256}$` enforced at `onAuthenticate`. Rejects HTML metacharacters at source, so any future admin-UI renderer regression cannot pivot from XSS to admin-secret exfil (F7).
- `publicUrl`: validated at `createHub` boot as parseable `http(s)` URL with no whitespace/semicolons. Defends against `HUB_PUBLIC_URL=...; rm -rf /;#` operator-error chain (defender #8).
- `readJsonBody`: rejects `__proto__`/`constructor`/`prototype` keys before downstream code touches them (proto-pollution latent guard).
- `readJsonBody`: enforces strict `Content-Type: application/json` on POST + `request.setTimeout(15s)` to defeat slow-POST DoS.
- Log statements that interpolate user-supplied `documentName` / `label` / `user` go through `sanitizeForLog(s)` (strip CR/LF, slice 256) to defeat log forging.

### 6. Per-IP rate limit on `/admin/api/*`.

- In-memory token bucket (5 requests / 60s) keyed on `request.socket.remoteAddress`, applied to `/admin/api/bootstrap` POST and to any `/admin/api/*` response that would emit 401. Limit-hit returns 429 with `Retry-After: 60`.
- Reverse-proxy `X-Forwarded-For` is intentionally **not** trusted in v1.1 (the hub may run without a TLS terminator that sets it correctly). Operators behind Caddy/Cloudflare get accurate per-IP buckets once we add `trustProxy` config in Task 6.

### 7. Bootstrap URL hygiene on the client.

- The admin UI strips `?key=` from `window.location` immediately on render (before any auth network roundtrip), so failed bootstrap POSTs don't leave the key in the address bar / browser history.
- The bootstrap-view shows `window.location.host` + a fingerprint (`sha256(adminSecret).slice(0, 16)` after consume — pulled from a no-auth `/admin/api/identity` endpoint *pre*-consume showing only the hub's `publicUrl` + cert hash) so the operator can confirm they're claiming the hub they intended (defeats F6 phishing-claim).

## Forward-compat with Task 6

Task 6 (auth + transport hardening — see Phase 9 plan §Task 6) extends, doesn't replace, this DDR:

- HMAC-SHA256 token storage (this DDR keeps plaintext-with-0600 — Task 6 swaps storage without changing the API or the scope semantics).
- Per-token rate limit (this DDR's per-IP limit composes additively).
- WSS-mandatory enforcement (`HUB_INSECURE_HTTP=1` opt-out unchanged).
- TLS posture decisions (Caddy `acme_email`, Fly auto-cert, Cloudflare Tunnel TLS termination) are deployment-config decisions and don't touch the in-process auth code.

Task 6 inherits the contract: `verifyToken(rawToken)` returns `{ label, scope } | null`. Storage shape is private; the public function signature + scope semantics stay.

## Alternatives considered

### A. Cookie-based session (HttpOnly + SameSite=Strict)

Rejected for v1.1. Cookies eliminate the XSS-exfil amplifier on the admin secret (#4), but introduce three new costs:

1. CSRF surfaces (need to re-add CSRF token middleware) — Bearer is naturally CSRF-safe.
2. Cross-machine setup friction (curl needs `-b cookie-jar`, CLI scripts get awkward).
3. Same-origin-only — admins running multiple hubs from one browser need separate cookies per origin (already the case for localStorage too, but cookies' eviction model is less predictable).

**Mitigation kept in localStorage path:** CSP `script-src 'self'` (no inline scripts, no third-party CDNs) + `frame-ancestors 'none'` + `connect-src 'self'` blocks the standard XSS-to-fetch-to-attacker-origin chain. Single XSS still loses, but the attacker has to find a Same-Origin script injection vector and an exfil channel within `'self'` — significant escalation cost vs the previous "any extension/proxy reads the localStorage" baseline.

Revisit cookies in Task 6 if real-world XSS reports materialize.

### B. Per-hub WireGuard / Tailscale tunnel for admin access

Rejected. Would eliminate all the network-side auth concerns at once, but tilts deployment cost the wrong way — "deploy a hub" becomes "deploy a hub and a tunnel network and onboard each admin device to the tunnel." That's the friction the in-hub admin UI was created to remove (per DDR-047 and the Phase 9 Task 2.5 plan rationale). Operators who want this layer can already run Caddy / Tailscale Funnel / Cloudflare Tunnel in front — orthogonal to admin auth.

### C. Reissue bootstrap on every restart (status quo before this DDR)

Rejected. Convenient — operators who forgot to claim get a fresh key on next deploy — but the indefinite-rotation-into-logs behavior is exploited by anyone with read access to any log aggregator. Forcing the `HUB_SECRET` env fallback on second boot is a one-line operator inconvenience and a categorical hardening.

### D. Skip Chain B mitigation (per-doc scope) — defer fully to Task 6

Rejected. The slice's `/flow:validate` would still pass if the rest of the hardening landed, since scope-binding is "high severity" not "critical," and Task 6 is the planned home. **But** Task 4 (bidirectional fs sync, the very next slice this plan ships) closes the trifecta. Landing the data shape (`scope` field, `onAuthenticate` enforcement) now means Task 4 can ship without re-opening the security model. Cheaper to add the validator now (it's ~30 lines + tests) than to ship Task 4 with the trifecta open and retrofit in Task 6.

## Consequences

### Positive

- All 12 security-auditor findings + 7 ethical-hacker findings + 2 promoted exploit chains resolved or downgraded.
- Architecture is forward-compatible with Task 6: the contract (Bearer-only, scope-bound, rate-limited, session-kick-on-rotate) doesn't change; only the storage backing does.
- Operator UX preserved: bootstrap link is still the single-click first-run flow. The price is "if you miss the 24h window, restart with HUB_SECRET" — a known-quantity SSH operation, not a new concept.
- Chain B (token leak → trifecta) is structurally closed before Task 4 ships, removing a planning-stage risk.

### Negative

- **Breaking for any pre-DDR test deployments**: tokens without `scope` are grandfathered as wildcard so existing peer connections survive, but new tokens minted via admin UI / CLI default to label-scoped. Operators using arbitrary `documentName` strings (`design-ui-foo`) on a token labeled `alice` will start getting auth failures on Task 4 sync unless they either (a) rotate the token to wildcard, or (b) use documentNames that prefix-match the label. Documented in plan §Migration.
- **`?secret=` removal breaks any operator script that uses it for curl-style testing.** Replacement: `Authorization: Bearer` header. Documented in `cli/commands/hub.mjs` usage + admin README.
- **Bootstrap no-reissue surprises operators who deploy-then-forget.** Mitigated by clear log message + Task 6 doc note. The cost of regeneration was leaking credentials into logs forever; the cost of no-regeneration is one extra deploy command for the "I forgot" case.
- **Per-IP rate limit may false-positive in dev** if a developer iterates fast on a local hub. Tunable via env (`HUB_ADMIN_RATE_LIMIT=off` for dev). Documented in CONTRIBUTING.md.

### Risk mitigation

- Backwards-compat for tokens minted before this DDR: `verifyToken` treats missing `scope` as wildcard. Test: existing tokens.json from a Task 2 hub continues to authenticate any documentName.
- Operator escape hatch: HUB_SECRET env always works as admin secret regardless of admin.json state — recovery path for "I locked myself out of the admin UI."

## Implementation

Shipped in the same slice that records this DDR — see Phase 9 plan §Task 2.5 §Shipped block for file-level breakdown. Test additions cover concurrent bootstrap consume, scope enforcement (wildcard/prefix/mismatch), rotate-kicks-sessions, CSP/XFO headers present, query-string auth rejected, rate limit 429.

## References

- security-auditor report — `.ai/logs/security-reviews/` (or transcript from this slice's `/flow:validate` run, 2026-05-27)
- ethical-hacker report — same transcript
- OWASP Top 10 cited: A3 (race), A6 (CSRF/origin), A7 (auth/session), A8 (authz scope), A11 (log injection)
