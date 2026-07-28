# DDR-194: Hub identity + durability — scrypt over the token spine, explicit proxy trust, and a restore drill that can fail

- **Date:** 2026-07-28
- **Status:** Accepted
- **Tags:** cloud, hub, security, auth, passwords, rate-limiting, proxy, backup, durability, sqlite, s3, r2, dependencies
- **Related:** [DDR-192](./DDR-192-remote-workspace-server-architecture.md) §3 (this implements it), [DDR-193](./DDR-193-maude-cloud-tenant-cells-and-containment-invariant.md) (the cell this hardens), [DDR-053](./DDR-053-hub-admin-auth-architecture.md) (token spine + §6 XFF stance, both amended), [DDR-052](./DDR-052-hocuspocus-over-partykit-for-hub.md) (extension-s3 stays a named option), [DDR-102](./DDR-102-cold-start-divergence-resolution.md) (rate-limit bucket split) · Plan: `.ai/plans/archive/cloud-phase-2-hub-identity-durability.md`

## Context

Cloud Phase 2 gave the hub a user model, expiring peer tokens, proxy-aware rate limiting, and a backed-up document store. Most of it is uncontroversial implementation. Four choices inside it are not obvious from reading the code, would each be plausible to "simplify" in the wrong direction later, and are recorded here.

## Decision

### 1. Passwords use scrypt, NOT the token spine's HMAC

`tokens.mjs` stores `hmac_sha256(rawToken, hubKey)`. It is tempting to reuse that for passwords — same store, same helpers, one primitive. **We do not.**

A peer token is 128 bits of CSPRNG output: brute force is not a threat, so a fast keyed hash is exactly right. A human password is low-entropy, so the *slowness* of the KDF is the security property. Reusing HMAC for passwords is the classic version of this mistake, and it is invisible in review because both columns just look like hex.

`node:crypto.scryptSync` at OWASP parameters (N=2^15, r=8, p=1), self-describing record format `scrypt$N$r$p$salt$hash` so parameters can be raised later without a flag day. Zero new dependencies — the phase's constraint, and the right one for a component every self-hoster runs.

One consequence worth naming: a stored record could name parameters bigger than this process will spend memory on, so `verifyPassword` **refuses** out-of-range parameters instead of obeying them. Otherwise a crafted row turns a login attempt into a memory bomb.

### 2. Login failures are indistinguishable — in body AND in timing

Every failure (`unknown-user`, `bad-password`, `disabled`) returns one identical 401 body. The specific reason goes to the server log only.

More easily missed: an unknown address still pays the **full scrypt cost**, against a fixed dummy record. Without that, response timing is a user-existence oracle even though the bodies match — and "which of our customers has an account here" is exactly what an attacker wants from a hub.

`disabled` is checked **after** the password, so a disabled account cannot be probed for existence with an arbitrary password.

### 3. Offboarding revokes by `owner` as an EXACT match, and disabling revokes live credentials

The phase's exit gate is "offboarding one user touches nobody else's credentials". Two ways to fail it, both closed:

- **Prefix matching.** `revokeTokensForOwner` matches `owner` exactly. A prefix or `LIKE` match would take out `alice@example.com.evil.test` when offboarding `alice@example.com` — and, worse, could be induced deliberately.
- **Flag-only disable.** Disabling a user (and changing a password) revokes existing tokens and kicks live sessions. A disable that only blocks the *next* login is not what an operator disabling an account at 2am means by it — the compromised session keeps working.

Addresses are case-folded on the way in, so an account cannot hide behind capitalization while its lowercase twin is offboarded.

Also closed here: the permissive dev-auth path (empty token store + no `HUB_SECRET` ⇒ **any** token authenticates) is off the moment the hub has any user, or under `HUB_WORKSPACE_MODE=1`. On a scratch hub it is a real convenience; on a hub with accounts it lets an unauthenticated stranger read and write every document. There is deliberately no flag to turn it back on.

### 4. X-Forwarded-For is trusted only from explicitly configured proxies, rightmost-hop-first (amends DDR-053 §6)

DDR-053 §6 ignored XFF entirely. That was correct while there was no way to know which upstream to believe — an attacker sets the header freely, so honouring it blindly makes every per-IP limit meaningless.

But behind Caddy / Fly every request arrives from the proxy, so ignoring XFF collapses all clients into **one bucket**: one attacker's login flood rate-limits every real user, and the attacker's own budget is the whole hub's. Both directions are real failures.

`HUB_TRUSTED_PROXIES` (CIDRs) makes the trust explicit. XFF is read only when the peer address is itself trusted, and then the **rightmost hop that is not one of ours** wins — the header is appended left-to-right, so everything left of our own chain is attacker-supplied. Unparseable entries are dropped with a warning: a typo'd CIDR must never become "trust everything". Empty by default, so a hub that does not opt in keeps DDR-053 §6 behaviour byte-for-byte.

### 5. Rate limiting is a PERSISTENT SLIDING window

The in-memory buckets reset on restart, which made "crash the hub, keep guessing" a free counter reset — and a hub that restarts on deploy did it for the attacker. Backed by SQLite now.

Sliding rather than fixed-window: a fixed window lets an attacker spend the whole budget at 59 s and the whole budget again at 61 s. Refused attempts are counted too — an attempt is an attempt, and not counting them would let a caller idle exactly at the ceiling retrying for free.

Single-process only. Horizontal scale remains DDR-052's `extension-redis` story; this is not a distributed limiter and must not be described as one.

### 6. The backup deliverable is the DRILL, not the backup

A backup nobody has restored is a hypothesis. The failure mode that matters is specific: a database that restores **readable-but-empty** looks exactly like a working one until the day you need it, and a backup job alone reports that as success.

So: `VACUUM INTO` (not `cp` — copying a live SQLite file mid-write yields a torn database that restores as corruption), gzip, upload, and a **manifest written last** so a generation is complete iff its manifest exists (a crashed upload leaves an ignorable partial rather than a directory that looks restorable). Then `maude hub restore-drill` restores the newest generation into a throwaway directory and asserts `integrity_check`, a non-zero document count, and — with `--sentinel` — one named document present with a non-empty payload. It exits non-zero, and runs in CI.

`restoreLatest` refuses to overwrite an existing database unless forced: restoring onto a live data directory is the one operation that can lose more than it recovers.

SQLite stays primary. Hocuspocus `extension-s3` is **not** swapped in (DDR-052 keeps it a named option, unproven here). Yjs updates are stored **verbatim**; the phase-9.2 anti-pattern is round-tripping them through JSON, which loses information the CRDT needs and cannot be undone later.

### 7. The S3 client is hand-rolled SigV4, not `@aws-sdk/client-s3`

~20 MB and several hundred packages to perform four HTTP verbs. The hub image is the ONE component DDR-193 designates "untrusted to peers", and it installs `--frozen-lockfile` precisely so its dependency surface is auditable — every transitive added here lands on every self-hoster's box. SigV4 is a documented hash chain and node already ships the crypto.

Scope is deliberately narrow: PUT / GET / LIST / DELETE, path-style, no multipart, no streaming. Backups are single-shot gzipped snapshots far under the single-PUT limit. **If a future caller needs multipart, that is the moment to reconsider the dependency** — not a reason to grow this file into a partial SDK.

## Alternatives considered

- **bcrypt/argon2 via a dependency.** argon2id is the better KDF. Rejected for now: both are native builds, and the zero-new-dependency constraint on the hub image is worth more here than the margin over scrypt-at-OWASP-parameters. The record format makes migrating later a per-login rehash, not a flag day.
- **Distinct login error messages** ("no such user" / "wrong password"). Rejected — it is a user-existence oracle. Kept in the log where the operator can still debug.
- **Trusting XFF from any peer** (the common framework default). Rejected: it makes per-IP limiting decorative.
- **Fixed-window rate limiting** (simpler, one row per key). Rejected — the boundary double-spend is exactly what a brute-forcer exploits.
- **Hocuspocus `extension-s3` as the store.** Rejected per DDR-052; it would also make the restore path something we do not control.
- **Backup without a drill.** Rejected; see §6. This is the whole point of the phase's exit gate.

## Consequences

**Positive**
- A hub can offboard a person and be *sure* it took effect — including sessions already open.
- Rate limiting behind a reverse proxy actually limits the attacker instead of the population.
- Restores are exercised on every CI run, so "we have backups" is a tested claim rather than a belief.
- The hub's dependency surface did not grow at all in a phase that added users, S3, and persistence.

**Negative / accepted**
- Hand-rolled SigV4 is code we now maintain. Bounded to four verbs and covered against a live S3-shaped server, but it is ours.
- scrypt is a deliberate ~50 ms per login. That is the point, and it means login is not a hot path.
- The persistent limiter is single-process; a future multi-instance hub needs the DDR-052 redis path, not a bigger SQLite.
- `HUB_TRUSTED_PROXIES` is one more thing an operator can get wrong. Mitigated by shipping correct defaults in both deploy templates and by dropping (never widening) bad entries.

## Implementation notes

`apps/hub/src/{users,auth-routes,client-ip,rate-store,backup,s3}.mjs`, `tokens.mjs` (additive `expires_at` + `owner` columns — NULL means exactly the pre-existing behaviour, so a live hub upgrades losing nothing), `cli/commands/hub.mjs` (`backup`, `restore-drill`), `scripts/hub-restore-drill.sh` in `quality.yml`.

Tests: `apps/hub/test/{users,trusted-proxy,backup}.test.mjs` — 188/188 for the package. The drill was also verified **live** through the CLI, not only in-process: a real generation restored PASS with the sentinel at 4 bytes, and re-running against a sentinel absent from the backup returned FAIL with exit 1.
