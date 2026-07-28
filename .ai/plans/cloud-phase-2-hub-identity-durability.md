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

- [ ] Login → expiring token → sync connect works end-to-end on a dev hub
- [ ] Offboarding one user touches nobody else's credentials
- [ ] Rate limiting effective behind a proxy (test proves it)
- [ ] Restore drill green in CI (compose + MinIO)
- [ ] `/flow:validate-security` pass (auth surface changed — severity floor medium)
