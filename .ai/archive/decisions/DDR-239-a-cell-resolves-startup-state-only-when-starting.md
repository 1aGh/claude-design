# DDR-239 — A cell resolves start-up state only when it is actually starting

**Date:** 2026-09-03
**Status:** accepted
**Scope:** `apps/cells/cell-do.mjs`, `apps/cells/cell-config.mjs`, `apps/cells/cell-credentials.mjs`, `apps/cloud/r2-creds.mjs`
**Relates to:** DDR-196 (cell env mapping is pure and reviewable), Cloud Phase 25 A-1 (per-tenant R2 credentials)

## Context

`MaudeCell.fetch()` runs for **every proxied request**. It resolved the tenant's
config and minted the tenant's R2 credentials unconditionally, *before* calling
`startAndWaitForPorts()` — which is itself idempotent when the container is
already running. Its own comment claimed the mint happened "on every container
start"; the code did it per request.

A file-plane pass issues up to `MAX_FILES_PER_PASS` (200) PUTs. One pass
therefore drove up to 200 control-plane round trips and 200
`POST /accounts/:id/r2/temp-access-credentials` calls against the **Cloudflare
account API**. On 2026-09-03 that tripped an account-level rate limit —
independently confirmed by an unrelated `wrangler r2 bucket list` answering
`429` during the run.

The failure then compounded, because every layer flattened the signal:

1. `r2-creds.mjs` collapsed **every** non-success into `502`, discarding the
   upstream status and any `Retry-After`.
2. `fetchTenantS3Credentials` threw away the response body (`HTTP ${status}`)
   and returned `null`.
3. `null` meant fail-closed: `503 refusing to start empty` — correct posture,
   but with no backoff, so the next request minted again.

Measured: **30 container starts in 10 seconds**, 314 PUTs across 44 unique
paths, and an 8.8 GB project that moved **zero** files across two runs while
sending 616 MB of retry traffic. The user saw none of it; the 429s and 502s
were visible only through `wrangler tail`.

## Decision

**1. A running container needs neither its config nor fresh credentials.**
Both are applied at container START (`startOptions.envVars` *replaces* the
image environment and nothing re-reads it), so `fetch()` short-circuits a
running container straight to the proxy. The decision is the pure, exported
`needsStartupState(container)` in `cell-config.mjs` — *only* the literal
`running === true` counts, so an unknown shape falls to the safe side and
starts.

> It lives in `cell-config.mjs` because `cell-do.mjs` imports
> `@cloudflare/containers`, which does not resolve under plain Node. That split
> is why the mapping is testable at all (DDR-196), and it is why this predicate
> is testable. A first attempt to test the wiring through `MaudeCell` directly
> passed by *skipping* behind a catch-guarded import — worse than no test.

**2. A retryable refusal keeps its status.** `isRetryableStatus()` forwards
`429` and `5xx` with a parsed, clamped `retryAfterMs`. Everything else stays
`502`: forwarding a `403` would tell the *cell* it is forbidden when the
*control plane's* parent token is what is wrong, and the route already spends
401/403 on the cell's own credential. The `503 not configured` branch stays
distinct — that distinction is a working diagnostic and is how this
investigation proved minting *was* configured.

**3. Credentials are cached, single-flighted and cooled down**
(`cell-credentials.mjs`): served from DO storage for their TTL less a refresh
margin, one mint per cold cell however many requests race, and a retryable
refusal opens a jittered cooldown during which the control plane is **not
contacted at all**. That last clause is the loop-breaker.

**Fail-closed is unchanged.** A cell that genuinely cannot obtain storage still
refuses to start — a cold start without storage rehydrates nothing, comes up
empty, and autosave then commits that emptiness over real work. What changed is
how *often* we ask and what we can *say* about the answer: a retryable wall now
answers `503 Retry-After` and reads as "this workspace is busy starting", while
a genuine absence keeps the original wording.

## Alternatives considered

**Cache in module scope keyed by tenant.** Rejected: a map shared by every DO
instance in the isolate is exactly the cross-tenant coupling the DO boundary
exists to prevent. The cache lives in `this.ctx.storage`, and because the DO id
is `idFromName(tenantId)` there is one store per tenant by construction — the
redundant `tenantId` assertion on read is kept anyway, so a future routing
mistake becomes a cache miss rather than a leaked credential.

**Raise the mint TTL.** Does not help: the problem was frequency, not lifetime.

**Client-side backoff alone.** Necessary (it shipped alongside) but not
sufficient — it treats the symptom while the server keeps amplifying.

## Consequences

- Credential mints drop from ~200 per pass to ~1 per cold start.
- The restart storm has no fuel: inside a cooldown the cell makes no upstream
  call at all.
- One structured log line per *actual* mint (with TTL) and one per cooldown
  short-circuit — the absence of exactly this made the diagnosis take two
  sessions, because "we mint once per start" could not be distinguished from
  "we mint once per request" without reading the source.
- **Not addressed:** availability is still a function of project size on a cold
  start. `cell-do.mjs` names the real fix — bind first, restore behind a
  "restoring" page — and stands in for it with a 30-minute
  `portReadyTimeoutMS`. Own plan.
