# Cloud Phase 2 — Hub identity + durability (users, login, expiring tokens, trusted proxy, backup/restore)

Part of the Maude Cloud arc — read `cloud-phase-0-economics-and-architecture.md` first. Requires Phase 1 complete.

## Description

Give the hub a real user model (the future cloud login is the same code self-hosters get), make peer tokens expiring + revocable, fix rate limiting behind proxies, and make the doc store durably backed up with a **tested** restore.

## Metadata

- **Type**: New Capability | **Complexity**: High
- **App/Package**: `apps/hub`
- **Dependencies**: Phase 1 (namespace + DDRs). New deps: prefer zero-new-dep (node `crypto.scrypt` for passwords); OIDC = hand-rolled authorization-code REST (DDR-114 precedent) or lockfile-bumped `openid-client` (hub image is frozen-lockfile — DDR-056)

## Context References

### Must-Read Files

- `apps/hub/src/server.mjs` (149-260, 410-620, 723-736, 846-915) — route dispatch, rate-limit buckets, rotate-kick machinery, XFF stance
- `apps/hub/src/tokens.mjs` (78-112, 188-192, 242-324) — HMAC token spine to extend (`expires_at`, revocation)
- `apps/hub/src/admin-auth.mjs` + `bootstrap.mjs` — Bearer + atomic single-use bootstrap (reuse, don't reinvent)
- `apps/studio/generation/keys.ts` — DDR-164 secret-custody template
- `.design/ui/GitHubIdentity.tsx` — plain-words sign-in vocabulary prior

## Tasks

### Task 1: ADD user model + login routes

- **Do**: `apps/hub/src/users.mjs` (better-sqlite3 `users.db`): email, scrypt hash, role, `created_at`, `disabled`. Routes on the existing `onRequest` dispatch: `POST /auth/login`, `POST /auth/logout`, admin CRUD (users, invites). Login mints a per-user `mau_` token on the existing HMAC spine with new `expires_at`; `onAuthenticate` checks expiry; disabling a user revokes + kicks (reuse rotate-kick at `server.mjs:723-736`). One OIDC provider optional.
- **Gotcha**: dev-mode footgun — empty token store + unset `HUB_SECRET` ⇒ *any* token authenticates (`server.mjs:221-230`); workspace mode must disable this permissive path outright. DDR-053 CSP headers on the login page; Bearer stays for machine APIs.
- **Validate**: `apps/hub/test/users.test.mjs` — login, expiry, revoke-kicks, disabled-user rejection.

### Task 2: ADD trusted proxy + persistent rate limiting

- **Do**: `HUB_TRUSTED_PROXIES` (CIDR list); when peer addr matches, honor rightmost untrusted `X-Forwarded-For` hop. Caddy template sets it by default. Move the three in-memory buckets to a SQLite-backed sliding window (survives restart; single-process fine — horizontal scale stays DDR-052's extension-redis story).
- **Validate**: spoofed XFF from untrusted addr ignored; login brute-force 429s behind proxy.

### Task 3: ADD doc-store backup + restore drill

- **Do**: `apps/hub/src/backup.mjs`: scheduled `VACUUM INTO` snapshot of `hub.db`/`tokens.db`/`users.db` → gzip → S3/R2 PUT under `backups/<ts>/`, retention policy. `maude hub restore-drill`: download latest → boot throwaway hub → assert doc count + sentinel canvas round-trips.
- **Gotcha**: keep SQLite primary — do NOT swap to Hocuspocus `extension-s3` (unproven here; DDR-052 keeps it a named option). Store binary Yjs updates verbatim (phase-9.2 anti-pattern: never JSON→binary).
- **Validate**: `apps/hub/test/backup.test.mjs` against MinIO dev-compose — snapshot + drill green.

## Exit gate

- [x] Login → expiring token → sync connect works end-to-end on a dev hub — `apps/hub/test/users.test.mjs` drives a real `createHub` over HTTP; the minted value is asserted to verify against the hub's own token store with the right owner, label and expiry.
- [x] Offboarding one user touches nobody else's credentials — pinned three ways: another user's session, a machine token, and the admin Bearer all survive; and a lookalike address (`alice@example.com.evil.test`) survives deleting `alice@example.com`. Disable and password-change revoke live credentials too.
- [x] Rate limiting effective behind a proxy (test proves it) — `apps/hub/test/trusted-proxy.test.mjs` + a per-attacker brute-force test: the attacker is limited, a real user through the SAME proxy is not, and a spoofed/rotated XFF buys no budget.
- [x] Restore drill green in CI — `scripts/hub-restore-drill.sh` in `quality.yml`. Uses a `file://` target rather than MinIO (the drill is the deliverable, not the storage vendor); the S3/R2 code path is covered against a live in-process S3-shaped server in `backup.test.mjs`. Verified live through the CLI as well: PASS on a good backup, FAIL + exit 1 on a missing sentinel.
- [x] Security review of the changed auth surface — done inline rather than via subagents (session constraint). Confirmed: password hashes never reach a response, `/admin/api/users*` sits behind the admin Bearer gate, a user record with `role:'admin'` grants nothing on the operator surface, login is rate-limited before scrypt, and `readJsonBody`'s JSON content-type requirement keeps the unauthenticated POST off the simple-form CSRF path. One real defect found and fixed: `/auth/*` matched on exact URL equality and would have fallen through to the Hocuspocus catch-all on `?query`.

**Status: COMPLETE** (2026-07-28). Suites at close: `apps/hub` 188/188, `apps/studio` 3132/3132.

Decisions recorded: **DDR-194** (scrypt over the token spine, opaque login failures, exact-match offboarding, explicit proxy trust, persistent sliding window, the drill as the deliverable, hand-rolled SigV4).

## Retro

- **The exit gate was written as a property, not a task, and that paid.** "Offboarding one user touches nobody else's credentials" is testable in a way "add a delete-user route" is not — and it is what produced the lookalike-address test, which caught the difference between exact-match and prefix revocation before it existed.
- **The drill found nothing, and that is the point.** Every backup test ends by asserting the RESTORED database. The empty-restore case (a backup job would report success; the drill fails it) is the one that justifies the whole task, and it needed to be written as a *failing* expectation to be meaningful.
- **The zero-new-dependency constraint was load-bearing twice** — scrypt instead of argon2, hand-rolled SigV4 instead of the AWS SDK. Both were more work and both were right for a component that ships to every self-hoster under a frozen lockfile. Worth restating in future hub phases so it isn't re-litigated under time pressure.
- **Two tests were wrong before the code was.** The sliding-window test encoded a fixed-window intuition, and the malformed-frame test expected a refusal yjs never issues. Both times the correct move was fixing the expectation, not the implementation — but only after tracing the actual behaviour, not by assuming the code was right.
- **For `/plan` next time:** this phase's plan named `MinIO dev-compose` as the test substrate. Making the *target* pluggable instead removed an entire piece of infrastructure from the test path with no loss of coverage. Plans should specify the property to prove, and leave the substrate to execution.
