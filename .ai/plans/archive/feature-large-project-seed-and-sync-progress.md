# Feature: Large-project seed — stop the amplification loop, and make the seed visible on every surface

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

Seeding a large Maude project into a cloud cell (alligators: **8.8 GB `.design/`, 2 961 ledger rows**) does not work and, worse, does not *say* that it does not work. Two real runs moved **0 files** while sending 269 MB and 347 MB of retry traffic; the user saw one healthy-looking line about the doc lane and nothing else, and `maude design status` reported `docs: 85 synced · 0 pending · 0 rejected` — a true statement about a lane that was fine, next to total silence about the 803 files that never arrived.

This plan does two independent things, in this order:

1. **Kill the amplification loop** that makes a large seed impossible (a Cloudflare-API rate limit, mis-typed as a fault, driving a fail-closed cell restart loop that the client then feeds).
2. **Give the file plane a truthful, bounded progress model** and render it on all three surfaces — CLI, desktop, browser Sync panel.

They are separated deliberately: (2) is worth shipping even if (1) were already perfect, because the same invisibility hid a 95 MB door cap, a 2 GiB/hour write quota, and 484 transport failures behind a status line that read `synced`.

## User Story

As someone linking an existing, large design project to a Maude cloud workspace, I want the seed to actually complete — and while it runs, I want to see how far it has got, what is stuck, and why — so that I can tell "still working" from "silently broken" without opening `wrangler tail`.

## Problem

Verified end-to-end (peer session `alligators-seed` reported it; every claim below re-verified against this tree unless marked otherwise).

### P1 — The cell mints R2 credentials on **every** request, not every start

`apps/cells/cell-do.mjs` `MaudeCell.fetch()` runs for every proxied request and unconditionally calls `fetchTenantConfig()` (`cell-do.mjs:91`) and `fetchTenantS3Credentials()` (`cell-do.mjs:170`) **before** `startAndWaitForPorts()` — which is itself idempotent when the container is already running. There is no "already running ⇒ skip the mint" short-circuit and no cache.

So a file-plane seed doing up to `MAX_REQUESTS_PER_PASS = 200` PUTs per pass drives up to 200 control-plane round trips per pass, each one a `POST /accounts/:id/r2/temp-access-credentials` against the **Cloudflare API**. The account-level limit is guaranteed to trip. Independent confirmation from the peer that the limit is on the account and not in our code: an unrelated `wrangler r2 bucket list` returned `429 Too Many Requests` (Ray `a3548c65ba3f87f2-PRG`) during the run.

> The comment at `cell-do.mjs:166` says credentials are "minted fresh on every container start". That is the intent. The code mints on every *request*.

### P2 — A 429 is flattened into a 502, so nothing downstream can tell "wait" from "broken"

`apps/cloud/r2-creds.mjs:97-99` collapses every non-success into `status: 502`, discarding the upstream status and any `Retry-After`. `apps/cloud/worker.mjs:417` forwards that 502. `apps/cells/cell-config.mjs:283` then does `if (!res.ok) throw new Error(\`HTTP ${res.status}\`)` — discarding the response body that carried `{"error":"temp-credentials mint refused: …"}` — and the catch at `:286` logs only `HTTP 502` and returns `null`.

### P3 — `null` credentials ⇒ fail-closed refusal ⇒ restart hot loop

`cell-do.mjs:171-177`: no creds and no legacy key ⇒ `503 refusing to start empty`. Correct posture (a cold start without storage rehydrates nothing and autosave would commit the emptiness over real work — `cell-config.mjs:268-273`), but with **no backoff and no cooldown**, so the next request re-mints immediately. The peer measured `[cell] alligators started` **30× in 10 s** with `could not mint R2 credentials: HTTP 502` **24×** in the same window.

### P4 — The client feeds the loop

In the same 10 s window: **314 PUTs across only 44 unique paths** (~7× per file); one sponsor logo went up **24×**. The file plane has no per-path failure backoff, so every pass re-attempts the same set at full rate.

### P5 — Transport errors leak verbatim as user-facing reasons

The peer could not find the two largest ledger reason strings anywhere in the source and flagged it as a hole in their analysis. **Resolved here:** they are Bun's own `fetch` errors, confirmed by running it:

```
$ bun -e "try{await fetch('http://127.0.0.1:1/x')}catch(e){console.log(e.message)}"
Unable to connect. Is the computer able to access the url?
```

`file-plane.ts` stores `(err as Error).message` straight into the delivery reason at `:442`, `:514`, `:686`, `:719`, `:755`, `:1270`. So **484 of 803** stuck files (349 + 135) were TCP-level connection failures against the restarting cell, rendered to the user as advice to check their URL for a typo.

### P6 — Two hard ceilings a large project meets that nothing announces

| Ceiling | Where | Effect on alligators |
| --- | --- | --- |
| **95 MB per file** | `apps/hub/src/file-door.mjs:64` | `group-team-photo.png` (164.9 MB) and `rozhovor_kilian.mp4` (465.8 MB) are refused `413` **forever**. No backoff fixes them. |
| **2 GiB per token per hour** | `apps/hub/src/file-door.mjs:78` (`QUOTA_BYTES_PER_WINDOW`) | An 8.8 GB seed needs ≥ 5 hourly windows. Exhaustion answers `507` (`:181`), which the client stores as an anonymous `stuck`. |

And the ceilings **disagree across the boundary**: `apps/studio/sync/file-plane.ts:78` uses `MAX_FILE_BYTES = 512 MB`, `apps/hub/src/journal.mjs:64` uses 512 MB, the door uses 95 MB. The client therefore scans, queues, uploads and times out on bytes the door was always going to refuse.

### P6b — A long seed outlives its own credential, and nothing renews for it

A cloud token is `role: member` with a **12 h TTL**. The arithmetic below (P6c) puts a full alligators seed at **≥ 2 h wall-clock from the quota alone**, so a seed started in the afternoon can cross its own expiry. Three separate defects make that a silent death:

1. **The file plane has no 401 handling.** There is no `401` anywhere in `apps/studio/sync/file-plane.ts`. A 401 from the file door falls through the generic `refusal(res)` path into `failureReason(res)` and is stored as a per-path reason `HTTP 401 — unauthorized`. It **never** reaches `renewCredentialNow()`. Only the doc lane triggers renewal, from `handleAuthFailure` on a WebSocket provider rejection.
2. **`renewalsSinceProgress` is reset only by a doc handshake** — `apps/studio/sync/index.ts:2265` (`handleSynced`) and `:2401` (the repromote path). During a long seed the doc lane is already converged (85/87, no new handshakes), so each pre-expiry renewal increments the counter with nothing to clear it. After `RENEW_MAX_WITHOUT_PROGRESS = 3` (`:158`), `renewCredentialNow()` returns `false` **permanently** while the file plane is actively working. The constant's own comment states the false assumption outright: *"a renewal that fixed the credential clears at least one doc, so >0 useless renewals means the credential was never the cause."* That holds only when the doc lane is the lane with work.
3. **A CLI relink silently drops `expiresAt`, disarming the proactive half.** `cli/lib/hubs-config.mjs` `addHub` (`:96`) *replaces* the stored record and preserves exactly two prior fields — `role` and `codeModulesAllowed` — with the docstring stating it outright: *"Nothing ELSE is preserved."* `expiresAt` is written only by `apps/studio/sync/workspace-signin.ts:194` and `apps/studio/cloud/renew.ts:177`; grepping `cli/` for `expiresAt` returns **nothing at all**, so the CLI neither writes nor carries it. A `maude design link … --adopt` after a workspace sign-in therefore leaves the record without an expiry.
   Consequence: `index.ts:636` sets `tokenExpiresAt = validExpiry(storedRecord?.expiresAt)` → `null`, and `scheduleRenewal()` (`:2019`) returns early on `tokenExpiresAt === null` — **no pre-expiry timer is ever armed.** Its own comment says the designed fallback is fine because *"once the credential actually dies, the invalid-token path below triggers renewal anyway, so the timer is an optimization, not the safety net."* That fallback is the doc lane's `handleAuthFailure`, which defect 1 shows the file plane never reaches.
   The three compose exactly: no proactive timer (expiry lost) **and** no reactive trigger (no 401 handling) **and** a renewal that would have muted itself anyway (defect 2). Reported by `alligators-seed` as an observed change of record shape; root-caused here.
4. What **does** work: `token: () => token` (`index.ts:3396`) reads the mutable binding at call time, so the plane picks up a token that was renewed by someone else. Part of the mechanism is already correct — it is the *trigger*, the *progress definition* and the *expiry* that are missing.

Net effect: a seed that crosses its credential's life turns into 803 rows of `HTTP 401 — unauthorized` with no renewal attempted, and the pre-expiry timer disarmed after three no-op renewals. Reported by peer session `alligators-seed` as an unverified hypothesis; verified here.

### P6c — What the ceilings actually cost this project

Peer arithmetic against the preserved ledger, independently re-derived:

| | |
| --- | --- |
| Undelivered | **803 files / 2 305.9 MB** |
| Quota windows needed (2 GiB/token/hour) | **2** |
| Passes at `MAX_FILES_PER_PASS = 200` | **≥ 5** (before any retry) |
| Terminally refused by the 95 MB door cap | `group-team-photo.png` 164.9 MB · `rozhovor_kilian.mp4` 465.8 MB = **630.7 MB** |

So even with Phase 1 and Phase 2 landed, this seed is **≥ 2 h wall-clock because of the quota alone**, and 630.7 MB never arrives no matter how long anyone waits. That is the test case for Tasks 12, 26 and 27 — and the reason Task 26 must produce a *suggestion*, not just a refusal: a 466 MB source video is legitimate material, not a mistake.

### P7 — The file plane is **absent** from the CLI, and its counters are dead

- `cli/lib/design-link.mjs:460-473` renders `docs:` from `sync.docs` and nothing from `sync.files` or `sync.assets`. A user reading `0 pending` concludes the project is synced while 803 files are missing. **This is the single worst item.**
- `_sync.json` showed `files: {synced: 0, pushed: 0, pulled: 0, conflicts: 0}` for the whole run. Cause: `apps/studio/sync/index.ts:3159-3162` derives the rollup from *per-pass* results — `fileTotals.synced = result.synced + result.pulled.length` — and a pass where nothing converges is legitimately all zeros. The ledger, meanwhile, was correct and current the whole time.
- `updatedAt` in `_sync.json` froze at boot (peer measured 130 s stale against a 0 s-stale ledger). Cause: `apps/studio/sync/status.ts` `payload()` spreads `...snapshot`, whose `updatedAt` is stamped only by `update(next)` from the ConnectionMonitor. `updateFiles()` / `updateAssets()` flush a payload carrying a **stale timestamp about themselves**.
- `result.requestsExhausted` and `result.budgetExhausted` (`file-plane.ts:218`, `:214`) are computed and **never mapped into the status payload** (`index.ts:3196-3213`). So "this pass stopped at its ceiling, there is more to come" is unreportable — precisely the fact a seed needs to convey.
- `FilePlaneStatus` has **no denominator**. `synced`/`pushed`/`pulled` are counters with nothing to divide by, so no surface can render "N of M".

### P8 — The one log line that did fire, fired 47 times

`file-plane.ts:1074` ("`N of M tracked files are gone from this machine — NOT telling the project`") repeated 47× in a 72-line log and buried everything else.

### P9 — The doručenka is unbounded

`file-plane.ts:1473-1479` `doruceka()` returns one entry per ledger row — **2 961 keys for alligators** — and `status.ts` `flush()` re-serializes that whole object into `_sync.json` *and* broadcasts it over WebSocket on **every** status change, including 200 ms-throttled asset-progress emits. Compare `MAX_SYNC_ITEMS = 200` + `itemsTruncated`, the bounding pattern this lane skipped.

### P10 — Release hazard already in the tree

`apps/studio/sync/retry-after.ts` is **untracked** (`git ls-files` → empty) but imported by two tracked, modified files: `asset-push.ts:47` and `file-plane.ts:71`. This is exactly the import-coherence failure CLAUDE.md documents (green locally, fatal in CI, cost two tag moves in v0.51.0). It also explains why the peer's greps did not match the installed 1.0.11 — the working tree carries newer sync work than what is published.

## Solution

Six phases, ordered so each is independently shippable and the earlier ones make the later ones observable.

1. **Land what is already in flight** (P10) — unblock the release gate before touching anything.
2. **Cloud/cells: stop the amplifier** (P1–P3) — honest status propagation, mint only when starting, cache in DO storage, cooldown instead of a hot loop. Fail-closed stays fail-closed.
3. **Client: stop feeding it** (P4–P6) — per-path backoff, backpressure classification, transport-error humanisation, pre-flight against the door's *real* ceilings.
4. **A truthful progress model** (P7–P9) — ledger-derived rollup with a denominator, honest `updatedAt`, bounded doručenka, coalesced flushes.
5. **Render it on all three surfaces** — CLI (`status` + a live line in `serve`), browser Sync panel, desktop native.
6. **Verify against the real 8.8 GB project**, plus a synthetic fixture so this is regression-testable without an 11 GB repo.

Phase 2's riskiest item is the credential cache. It is scoped so that cross-tenant leakage is *structurally* impossible (the cache lives in `this.ctx.storage`, and the DO id is `idFromName(tenantId)` — one store per tenant by construction), with a redundant `tenantId` equality assertion on read and a hard refusal to serve a credential past its own expiry.

## Metadata

- **Type**: Bug Fix + Enhancement (one incident, one capability gap)
- **Complexity**: High
- **App/Package**: `apps/cloud`, `apps/cells`, `apps/studio` (sync + client), `apps/hub`, `cli`, `apps/desktop`
- **Affected Systems**: cloud control plane, cell DO, file plane (Plane B), asset push lane, sync status surface, CLI, desktop shell
- **Dependencies**: none new

---

## Context References

### Must-Read Files

> During `/flow:execute`, read every file listed here **in parallel in a single assistant message**.

- `apps/cells/cell-do.mjs` (lines 75–205) — Why: the per-request mint (P1) and the fail-closed refusal (P3) both live in `fetch()`; line 190-201 already names "bind first and restore behind a restoring page" as the known-missing real fix for cold-start-vs-project-size.
- `apps/cells/cell-config.mjs` (lines 223–295) — Why: `fetchTenantConfig` + `fetchTenantS3Credentials`; the `throw new Error(\`HTTP ${status}\`)` that discards the body (P2), and the comment block explaining why fail-closed is load-bearing.
- `apps/cloud/r2-creds.mjs` (lines 50–110) — Why: the three refusal outcomes; `:99` is the 429→502 flattening.
- `apps/cloud/worker.mjs` (lines 388–420) — Why: the `/internal/cell-r2-credentials` route that forwards the status.
- `apps/hub/src/file-door.mjs` (lines 55–115, 175–220, 330–390, 490–520) — Why: `MAX_FILE_BYTES = 95 MB`, `QUOTA_BYTES_PER_WINDOW`, the 413/507/429 responses and the existing `Retry-After: 60` at `:153`.
- `apps/studio/sync/file-plane.ts` (lines 60–200, 400–520, 1040–1200, 1460–1500) — Why: every cap, the breakers, `reconcile`'s pass loop, `doruceka()`.
- `apps/studio/sync/file-ledger.ts` (whole) — Why: the ledger is the only source that stayed correct; the progress model is derived from it, and per-path backoff state belongs on its rows.
- `apps/studio/sync/status.ts` (whole) — Why: `FilePlaneStatus`, `SyncStatusStore`, `payload()`/`flush()` — the `updatedAt` lie and the unthrottled flush.
- `apps/studio/sync/index.ts` (lines 3140–3260) — Why: `noteFilePlane` — where `requestsExhausted`/`budgetExhausted` are dropped and where the rollup is (wrongly) derived from per-pass results.
- `apps/studio/sync/retry-after.ts` (whole) — Why: already implements `retryAfterMs` / `failureReason` / `isRateLimited`; Phase 3 extends it rather than adding a parallel classifier. **Untracked — see Task 0.**
- `apps/studio/sync/asset-push.ts` (lines 60–130, 380–430) — Why: `AssetPushProgress` is the shape the file plane's progress should rhyme with; `UPLOAD_CONNECTION_HEADERS` documents the keep-alive desync lesson that must not be reintroduced.
- `apps/studio/client/panels/SyncPanel.jsx` (lines 580–800) — Why: the render target; existing `data-testid` vocabulary and the `sp-assets-*` chrome to extend.
- `cli/lib/design-link.mjs` (lines 386–520) — Why: `runStatus` — where the `files:` rollup is missing.
- `apps/desktop/src-tauri/src/notify.rs` — Why: the native notification seam for Phase 5.

### Files to Create

- `apps/studio/sync/seed-progress.ts` — the ledger-derived progress model (`computeSeedProgress(ledger, opts)`), pure and leaf, no imports from `status.ts` (mirrors why `limits.ts` was extracted).
- `apps/studio/sync/transport-error.ts` — classify a caught `fetch` rejection into `{ class: 'unreachable' | 'timeout' | 'aborted' | 'other', text, raw }` so Bun's wording never reaches a user-facing reason.
- `apps/cells/cell-credentials.mjs` — the DO-storage credential cache + single-flight + cooldown, pure and unit-testable (same posture as `cellEnv` being "PURE and exported, because this mapping is where a mistake means one tenant reading another's data").
- `apps/studio/test/sync-seed-progress.test.ts`
- `apps/studio/test/sync-transport-error.test.ts`
- `apps/studio/test/sync-file-plane-backoff.test.ts`
- `apps/cells/cell-credentials.test.mjs`
- `apps/studio/bin/_seed-fixture.mjs` — generate an N-file / M-byte synthetic `.design/` so the large-project path is testable without an 11 GB repo.

### Design canvases

`.design/` has no canvas for the Sync panel. The nearest priors, to lift chrome from rather than invent:

| Canvas | Status | Notes |
| --- | --- | --- |
| `.design/ui/GitPanel.tsx` | — | `SyncPanel.jsx` already borrows its dock chrome (stated in the file header). Progress rows must match it. |
| `.design/ui/Studio.tsx` | — | Tier-0 shell prior: where a status-bar progress affordance belongs. |

### Documentation

- `.ai/archive/decisions/DDR-226-*.md` — Sync v2: the journal file plane, one decision table, the doručenka. **The constraint this plan works inside.**
- DDR-214 (via `kg`) — "a status surface that lies"; why raw counters stay beside any derived panel so a panel is falsifiable.
- DDR-217 — the asset push lane; its progress emit is the throttling precedent.
- DDR-054 — the hub is untrusted to peers; every reason string rendered from a hub response is untrusted text.
- kg: `Sync progress is surfaced per-file through the existing sync:status payload, not a new channel` (`d_5e1dd61fed5779e77e0dbf3c`) — **binding**: progress rides the one `sync:status` payload. Do not add a second bus or a second fetch.

### Patterns to Follow

**Bounding a list that reaches the payload** — the doručenka must adopt what the items list already does:

```ts
// MAX_SYNC_ITEMS = 200, sorted actionable-first so the cap only ever truncates
// the already-aggregated healthy tail; itemsTruncated carries the dropped count.
```

**Additive payload evolution** — every new field on `FilePlaneStatus` is optional and absent on old payloads (the `NoSyncablePayload` discriminator pattern from DDR-102). Old readers must render unchanged.

**A refusal that names a wall, not a fault** — already in `file-plane.ts`:

```ts
/** The hub asked us to slow down (429), so the WHOLE PLANE is held until
 *  `until` — not this file, not this pass. */
rateLimited?: { until: number; retryAfterMs: number; waiting: number };
```

**Loud caps, never silent truncation** — `pull-budget.ts` header: "a silent stop reads as 'sync is broken' with no cause."

---

## Design Decisions

### Progress vocabulary (new, user-facing — keep it in `syncPresentation` terms)

| State | Means | Surface wording |
| --- | --- | --- |
| `scanning` | walking the tree, denominator not final | "Looking through the project…" |
| `seeding` | moving files, `remaining > 0` | "Uploading 1 412 of 2 961" |
| `paused` | backpressure wall (429/503/quota) | "The workspace asked us to slow down — resumes in 42 s" |
| `blocked` | nothing can move without a decision (breaker held, every path refused) | "Nothing is moving — N files need a decision" |
| `converged` | `remaining === 0` | "Everything is up to date" |

### Refusal classes (replaces raw `err.message`)

| Class | Trigger | User text |
| --- | --- | --- |
| `unreachable` | Bun connect/DNS error | "Could not reach the workspace" (raw text kept in console + `detail` only) |
| `too-large` | local pre-flight or door `413` | "Too big for this workspace (164.9 MB — the limit is 95 MB)" |
| `quota` | door `507` | "This project's hourly upload allowance is used up — resumes at HH:MM" |
| `refused` | 4xx that is not the above | status + bounded snippet via existing `failureReason()` |
| `slow-down` | 429, or 503/502 carrying `Retry-After` | whole-plane pause, existing `rateLimited` shape |

### Tokens / chrome

Reuse `sp-assets-*` classes and the `gp-group-*` chrome already in `SyncPanel.jsx`. No new colour tokens: the progress bar uses `--accent` for fill and `--bg-2` for track; `blocked` uses the existing warn treatment `held` rows already use.

### Custom Components Needed

| Component | Reason | Extends |
| --- | --- | --- |
| `<SeedProgressBar>` (inside `SyncPanel.jsx`) | no progress-bar primitive exists in the panel chrome | plain div pair, `gp-group` chrome |

---

## Tasks

Execute in order. Each task is atomic and testable.

### Phase 0 — unblock the tree

#### Task 0: LAND the untracked sync modules

- **Do**: `git add apps/studio/sync/retry-after.ts apps/studio/sync/comment-identity.ts` (and any other untracked module a tracked file imports). Then run `bash scripts/check-import-coherence.sh` and confirm it is green.
- **Gotcha**: NEVER fix this by stripping the import from `file-plane.ts` / `asset-push.ts` — those are shared files another session is editing (CLAUDE.md, import-coherence section). Land the module.
- **Gotcha**: the working tree is dirty with changes that are **not** part of this feature (`apps/desktop/**`, `apps/studio/api.ts`, `.ai/state/STATE.md`, …). Stage specific files, never `git add -A`.
- **Validate**: `bash scripts/check-import-coherence.sh && git ls-files apps/studio/sync/retry-after.ts`

### Phase 1 — cloud + cells: stop the amplifier

#### Task 1: UPDATE `apps/cloud/r2-creds.mjs` — propagate the upstream refusal honestly

- **Do**: at `:97-99`, when the Cloudflare API refuses, return the *upstream* status for retryable classes instead of a blanket 502: `status: res.status === 429 || res.status >= 500 ? res.status : 502`, plus `retryAfterMs` parsed from the upstream `Retry-After` header (default 60 s, clamp 300 s), plus a `retryable: boolean`.
- **Pattern**: mirrors `apps/studio/sync/retry-after.ts` — a 429 is an instruction, not a failure.
- **Gotcha**: keep the `503 'R2 credential minting is not configured'` branch at `:63` distinct. The peer used exactly that 502-vs-503 distinction to prove minting *was* configured; collapsing them destroys a working diagnostic.
- **Validate**: `node --test apps/cloud/r2-creds.test.mjs`

#### Task 2: UPDATE `apps/cloud/worker.mjs` — forward status and `Retry-After`

- **Do**: at `:417`, set a `Retry-After` response header when `minted.retryAfterMs` is present, and return `minted.status` unchanged.
- **Gotcha**: do not leak the Cloudflare error body verbatim to the cell beyond the existing bounded `error` string — a cell log is not an operator console.
- **Validate**: `node --test apps/cloud/worker.test.mjs`

#### Task 3: REFACTOR `apps/cells/cell-config.mjs` — `fetchTenantS3Credentials` returns a verdict, not `null`

- **Do**: replace the `throw new Error(\`HTTP ${res.status}\`)` at `:283` and the catch-all `return null` with a discriminated result: `{ ok: true, credentials } | { ok: false, retryable: boolean, status: number|null, retryAfterMs: number|null, detail: string }`. Read the JSON body's `error` field into `detail` (bounded) so the cell log names *why*, not just a number. Keep a thin `null`-returning wrapper only if a caller outside `cell-do.mjs` needs it — grep first.
- **Gotcha**: the fail-closed contract in the header comment (`:265-273`) stays **exactly** as it is. This task changes only what the cell *knows* about the refusal, never what it does about a genuine absence of storage.
- **Validate**: `node --test apps/cells/cell-config.test.mjs`

#### Task 4: CREATE `apps/cells/cell-credentials.mjs` — cache, single-flight, cooldown

- **Do**: export `resolveTenantCredentials({ tenantId, env, storage, now, fetchImpl })` that:
  1. reads `storage.get('s3Creds')`; serves it only when `stored.tenantId === tenantId` **and** `now < stored.expiresAt - REFRESH_MARGIN_MS`;
  2. otherwise single-flights one `fetchTenantS3Credentials` per DO (an in-memory promise, so concurrent requests coalesce into one mint);
  3. on success, persists `{ tenantId, credentials, expiresAt }` where `expiresAt` is derived from the credential TTL, never longer;
  4. on a **retryable** refusal, records `{ cooldownUntil, retryAfterMs }` in storage and returns `{ ok: false, retryable: true, retryAfterMs }` — and while `now < cooldownUntil`, short-circuits **without touching the control plane at all**. This is the loop-breaker;
  5. on a non-retryable refusal, does not cache anything.
- **Do**: apply full jitter to the cooldown (`random() * base`) so a fleet does not resynchronise its retries.
- **Pattern**: `cellEnv` is "PURE and exported, because this mapping is where a mistake means one tenant reading another's data" — same posture, same reason.
- **Gotcha**: the redundant `tenantId` check is deliberate defence in depth. `idFromName(tenantId)` already makes the store per-tenant; the assertion costs nothing and turns a future routing mistake into a cache miss instead of a cross-tenant credential.
- **Gotcha**: **never cache a failure as a success**, and never extend `expiresAt` past what the mint returned.
- **Validate**: `node --test apps/cells/cell-credentials.test.mjs` — cases: cache hit inside TTL issues zero fetches; expiry-margin forces a re-mint; concurrent callers issue exactly one fetch; a retryable refusal inside the cooldown issues zero fetches; a stored blob with a different `tenantId` is ignored.

#### Task 5: UPDATE `apps/cells/cell-do.mjs` — mint only when the container is not already running

- **Do**: in `fetch()`, before the credential resolution at `:170`, read `const running = this.ctx.container?.running === true` (the same accessor `restart()` uses at `:72`). When `running`, skip credential resolution **and** `fetchTenantConfig` entirely and go straight to `containerFetch(request)` — env applies at container start, so neither value can affect a running container.
- **Do**: when not running, call `resolveTenantCredentials(...)` from Task 4. On `{ ok: false, retryable: true }`, answer `503` with a `Retry-After` header derived from `retryAfterMs` and a body that says the workspace is busy starting, not that it is broken. On `{ ok: false, retryable: false }`, keep today's `refusing to start empty` 503.
- **Do**: apply the same short-circuit to the tunnel-mode branch (`:104-160`), which has the identical per-request mint.
- **Gotcha**: `restart()` destroys the container, so the next request correctly sees `running === false` and re-mints — the operator's "apply it now" path still works.
- **Gotcha**: this is the highest-leverage change in the plan (≈200 CF API calls per pass → ≈1 per cold start). Do not let a cache bug in Task 4 mask a regression here — Task 4 and Task 5 get separate tests.
- **Validate**: `node --test apps/cells/cell-config.test.mjs` plus a new case in `apps/cells/cell-credentials.test.mjs` asserting a running container triggers zero control-plane fetches.

#### Task 6: ADD a fleet-side counter for mint calls

- **Do**: `console.log` one structured line per *actual* mint (`[cell] <tenant> minted storage credentials (ttl <n>s)`) and one per cooldown short-circuit, so `wrangler tail` can distinguish "we asked" from "we were about to ask and did not". Cheap, and the thing whose absence made this a two-session diagnosis.
- **Gotcha**: never log the credential, the URL, or the tenant's paths (`seed-repo.mjs` `safeUrl` posture).
- **Validate**: manual `wrangler tail maude-cells` during the Phase 6 reproduction.

### Phase 2 — client: stop feeding the loop

#### Task 7: CREATE `apps/studio/sync/transport-error.ts`

- **Do**: `classifyTransportError(err: unknown): { class: 'unreachable' | 'timeout' | 'aborted' | 'other'; text: string; raw: string }`. Match Bun's wording (`Unable to connect. Is the computer able to access the url?`, `Was there a typo in the url or port?`) and `AbortError` / `TimeoutError` names. `text` is what a person reads; `raw` is kept for the console only.
- **Gotcha**: match on `name` where possible and treat the message match as a fallback — Bun's strings can change between versions, and a missed match must degrade to `other` with a neutral sentence, never to the raw string.
- **Validate**: `cd apps/studio && bun test test/sync-transport-error.test.ts`

#### Task 8: UPDATE `apps/studio/sync/file-plane.ts` — humanise every stored reason

- **Do**: replace each `reason: (err as Error).message` (`:442`, `:514`, `:686`, `:719`, `:755`, `:1270`) with `classifyTransportError(err).text`, and `log.warn` the `raw` alongside the path.
- **Gotcha**: `failureReason(res)` (from `retry-after.ts`) already handles *response* refusals correctly and is untrusted-safe. This task is only about *thrown* errors.
- **Validate**: `cd apps/studio && bun test test/sync-file-plane.test.ts test/sync-transport-error.test.ts`

#### Task 9: ADD per-path failure backoff to the ledger

- **Do**: extend `LedgerRow` with `attempts?: number` and `nextAttemptAt?: number`. In `file-plane.ts` `reconcile`, skip a path whose `nextAttemptAt` is in the future (and do **not** count it against `MAX_REQUESTS_PER_PASS` — a skipped path costs no request). On failure, `attempts++` and set `nextAttemptAt = now + min(2^attempts * 5s, 10min)` with full jitter. Clear both on success.
- **Gotcha**: the *ledger*, not memory — "restart the app" must not be the bypass (the same reasoning `DELETE_BUDGET_*` is persisted for).
- **Gotcha**: a whole-plane `rateLimited` hold already exists and outranks this; per-path backoff is for the errors that are genuinely about one file.
- **Validate**: `cd apps/studio && bun test test/sync-file-plane-backoff.test.ts` — a path that failed 3× is not re-requested on the next pass; success resets it.

#### Task 10: EXTEND backpressure classification beyond 429

- **Do**: in `retry-after.ts`, add `isBackpressure(res)` — true for `429`, for `503`, and for any `502` **carrying a `Retry-After`**. Use it in `file-plane.ts:416` and in `asset-push.ts` where `isRateLimited` is used today, so a cell answering `503 Retry-After: 10` pauses the whole plane instead of burning 200 requests into a door that is starting up.
- **Gotcha**: keep `isRateLimited` exported and unchanged — it is the narrower predicate and other call sites may depend on the exact 429 meaning.
- **Gotcha**: a bare `502` with no `Retry-After` stays an ordinary failure. Treating every 5xx as backpressure would make a genuinely broken hub look like a busy one.
- **Validate**: `cd apps/studio && bun test test/sync-file-plane.test.ts test/sync-asset-push.test.ts`

#### Task 11: ADD consecutive-transport-failure backpressure

- **Do**: in `file-plane.ts`, count consecutive `unreachable` classifications within a pass. Past a small threshold (5), end the pass with `rateLimited: { until: now + backoff, retryAfterMs: backoff, waiting: <remaining> }` and a distinct reason so the panel can say "could not reach the workspace" rather than "the workspace asked us to slow down".
- **Gotcha**: extend the `rateLimited` shape with an optional `cause: 'hub-asked' | 'unreachable'` rather than inventing a second field — the panel already renders `rateLimited`, and a parallel field would need parallel rendering forever.
- **Validate**: `cd apps/studio && bun test test/sync-file-plane.test.ts`

#### Task 12: FIX the client/door size-ceiling drift + 413 pre-flight

- **Do**: add `GET /api/file-limits` to `apps/hub/src/file-door.mjs` (unauthenticated is fine — it reveals only ceilings) returning `{ maxFileBytes, quotaBytesPerWindow, quotaWindowMs, quotaUsed, quotaResetsAt }`, sourced from the constants at `:64`/`:78` and `quotaFor(match.label)`.
- **Do**: in `file-plane.ts`, fetch it once per boot (cache it; fall back to a shared `HUB_MAX_FILE_BYTES = 95 * 1024 * 1024` constant when the hub is older and 404s), and refuse a local file over the ceiling **before uploading it**, with reason class `too-large` naming both sizes.
- **Gotcha**: `MAX_FILE_BYTES = 512 MB` at `file-plane.ts:78` is the **pull/receive** cap and must stay. This task adds a separate *push* ceiling. Do not conflate them.
- **Gotcha**: a `too-large` path must be a terminal, non-retrying state — otherwise it burns a request slot every pass forever, which is what alligators' two videos did.
- **Validate**: `cd apps/studio && bun test test/sync-file-plane.test.ts` + `node --test apps/hub/src/*file-door*.test.mjs` (create the door test case if absent).

#### Task 13: HANDLE the 507 quota wall as a wall

- **Do**: map a `507` from the door onto a whole-plane hold with `until = quotaResetsAt` (from Task 12's endpoint, or `now + 1h` as a fallback) and reason class `quota`.
- **Gotcha**: a quota wall is not an error and not a rate limit — the answer is "come back next window", so it must not consume the per-path backoff budget or read as `failed`.
- **Validate**: `cd apps/studio && bun test test/sync-file-plane.test.ts`

#### Task 13a: ROUTE a file-plane 401 into credential renewal

- **Do**: add an `onAuthFailure?: (rel: string, status: number) => void` option to `FilePlaneOptions` (`file-plane.ts:232`). Call it when the door answers `401` (or `403` on a credential that used to work). In `apps/studio/sync/index.ts`, wire it to the existing single-flight `renewCredentialNow()` — the same entry point `handleAuthFailure` uses for the doc lane.
- **Do**: on a 401, end the pass rather than firing the remaining request budget at a door that will refuse all of it — the same shape as the `rateLimited` whole-plane hold, with a distinct reason class.
- **Gotcha**: `renewCredentialNow()` is already single-flight with a 60 s floor (`RENEW_MIN_INTERVAL_MS`), so 803 refused paths collapse to one renewal. Do **not** add a second renewal path — reuse it, exactly as the doc lane does.
- **Gotcha**: `token: () => token` already reads the mutable binding at call time, so a renewed token reaches the next pass with no further wiring. Do not snapshot the token anywhere.
- **Validate**: `cd apps/studio && bun test test/sync-file-plane.test.ts` — a scripted door answering `401` once then succeeding triggers exactly one renewal and the next pass proceeds.

#### Task 13b: COUNT file-plane progress as renewal progress

- **Do**: reset `renewalsSinceProgress = 0` (`index.ts:885`) whenever a pass delivers at least one file, alongside the two existing doc-handshake resets at `:2265` and `:2401`.
- **Do**: update the comment on `RENEW_MAX_WITHOUT_PROGRESS` (`:154-158`) — its stated premise ("a renewal that fixed the credential clears at least one doc") is false for a converged doc lane with an active file plane, and the stale comment is what makes the bug invisible on reading.
- **Gotcha**: keep the cap itself. It is the control that stopped a reproduced 2 342 renewals/s storm (F1, 2026-08-10 security review). This task only widens what counts as *progress*; it does not relax the ceiling.
- **Gotcha**: make it fail first — with this task reverted, a fixture where the doc lane is converged and only files move must exhaust the cap and stop renewing.
- **Validate**: `cd apps/studio && bun test test/sync-*.test.ts --timeout 20000`

#### Task 13c: PRESERVE `expiresAt` across a CLI relink when the token is unchanged

- **Do**: in `cli/lib/hubs-config.mjs` `addHub` (`:96`), carry the prior `expiresAt` forward **only when the incoming `token` is byte-identical to the stored one**. A different token makes the old expiry meaningless and it must still be dropped.
- **Do**: extend the docstring's "Nothing ELSE is preserved" paragraph to say why this one is conditional — the field describes the *token*, not the machine, so the discriminator is token identity, not policy.
- **Pattern**: `role` is already carried across a relink with the argument *"this path has no fresher answer — the CLI does not sign in."* The same argument applies verbatim to `expiresAt`; the only difference is that a relink CAN supply a new token, which `role` never is.
- **Gotcha**: do **not** carry it unconditionally. A stale expiry on a genuinely new token arms the renewal timer against the wrong instant — worse than no timer, because `scheduleRenewal` would fire early and burn a `renewalsSinceProgress` slot (defect 2) for nothing.
- **Gotcha**: this restores only the *proactive* half. Tasks 13a/13b remain required — the pre-expiry timer is explicitly documented as "an optimization, not the safety net" (`index.ts:2005-2012`), and the safety net it names is the one the file plane does not reach.
- **Validate**: `node --test cli/commands/design.test.mjs` plus a new case in `cli/lib/hubs-config` coverage: same token ⇒ `expiresAt` survives; different token ⇒ `expiresAt` is gone; absent prior ⇒ unchanged behaviour.

### Phase 3 — a truthful progress model

#### Task 14: CREATE `apps/studio/sync/seed-progress.ts`

- **Do**: export `computeSeedProgress(rows: Record<string, LedgerRow>, opts): SeedProgress` where

```ts
export interface SeedProgress {
  phase: 'scanning' | 'seeding' | 'paused' | 'blocked' | 'converged';
  tracked: number;          // rows in scope — THE DENOMINATOR
  delivered: number;        // rows in a terminal-good state
  remaining: number;        // tracked - delivered
  bytesRemaining: number;
  blocked: { class: 'too-large' | 'quota' | 'unreachable' | 'refused'; count: number }[];
  passCapped?: 'requests' | 'files' | 'bytes';
  etaMs: number | null;     // null until a throughput sample exists — never a guess
  startedAt: number | null;
}
```

- **Do**: keep it a **leaf module** — no imports from `status.ts` or `file-plane.ts`, for the exact reason `limits.ts` documents (an import cycle whose only symptom is a TDZ crash pointing at neither file).
- **Gotcha**: `etaMs` is `null` until at least one real throughput sample exists. The peer's own misreading — a two-second `nettop` sample read as "4 MB/s, wait 10 minutes" when the sustained rate was ~270 kB/s of retry traffic — is exactly the failure a fabricated ETA institutionalises.
- **Validate**: `cd apps/studio && bun test test/sync-seed-progress.test.ts`

#### Task 15: EXTEND `FilePlaneStatus` with the progress model

- **Do**: in `apps/studio/sync/status.ts`, add optional `progress?: SeedProgress` to `FilePlaneStatus`. Keep every existing counter — DDR-214's rule is that a derived panel stays cross-checkable against the raw numbers it is derived from.
- **Gotcha**: additive and optional. Old payload readers (an older CLI reading a newer `_sync.json`) must render exactly as before.
- **Validate**: `cd apps/studio && bunx tsc --noEmit`

#### Task 16: FIX the dead counters and the dropped cap flags

- **Do**: in `apps/studio/sync/index.ts` `noteFilePlane` (`:3158`), derive `progress` from the **ledger** via Task 14 rather than from per-pass results, and map `result.requestsExhausted` / `result.budgetExhausted` into `progress.passCapped`.
- **Do**: keep `fileTotals` as-is beside it (the falsifiable raw half).
- **Gotcha**: this is the fix for "counters read 0 for 20 minutes while 2 961 rows changed underneath". The ledger was right the whole time; nothing read it.
- **Validate**: `cd apps/studio && bun test test/sync-*.test.ts --timeout 20000`

#### Task 17: FIX the `updatedAt` lie

- **Do**: in `status.ts` `payload()`, stamp `updatedAt: now()` at build time. Preserve the ConnectionMonitor's own stamp as a new optional `connectionUpdatedAt` so nothing that depended on the old meaning silently changes meaning.
- **Gotcha**: `_sync.json`'s `updatedAt` is what a person (and `maude design status`) uses to decide whether the file is alive. A 130 s-stale timestamp on a file being rewritten every second is worse than no timestamp.
- **Validate**: `cd apps/studio && bun test test/sync-status*.test.ts` (create if absent)

#### Task 18: BOUND the doručenka

- **Do**: cap `doruceka()` at `MAX_DELIVERY_ROWS = 300`, sorted actionable-first (blocked → pending → delivered), and add `deliveryTruncated: number` to `FilePlaneStatus`.
- **Pattern**: exactly `MAX_SYNC_ITEMS` / `itemsTruncated` from the progress-modal work — same reason, same shape.
- **Gotcha**: sorting actionable-first means the cap only ever drops the healthy tail, so the panel never loses the row a person is looking for.
- **Gotcha**: 2 961 keys × every flush × `_sync.json` write + WS broadcast is a real cost during a seed; the count that matters now comes from `progress.tracked` instead.
- **Validate**: `cd apps/studio && bun test test/sync-file-plane.test.ts`

#### Task 19: COALESCE status flushes

- **Do**: in `createSyncStatusStore`, debounce `flush()` at `STATUS_FLUSH_MS = 200` (matching `asset-push.ts`'s `PROGRESS_INTERVAL_MS`), with a forced immediate flush for conflicts, notices, and any terminal/`converged` transition.
- **Gotcha**: the store's contract says writes are best-effort and never throw into the sync hot path — a debounce must not swallow the final state. Always flush on stop.
- **Validate**: `cd apps/studio && bun test test/sync-status*.test.ts`

#### Task 20: DE-SPAM the delete-breaker warning

- **Do**: at `file-plane.ts:1074`, log once per boot per distinct path-set hash instead of once per pass. The `held` entry already reaches the panel every pass, so the log line is redundant repetition, not the signal.
- **Validate**: `cd apps/studio && bun test test/sync-file-plane.test.ts`

### Phase 4 — surfaces

#### Task 21: UPDATE the CLI — `maude design status` grows a `files:` line

- **Do**: in `cli/lib/design-link.mjs` `runStatus` (after the `docsLine` at `:461`), render `sync.files` — `files: 1 412 of 2 961 delivered · 803 waiting · 43 refused` — plus the pause/blocked reason and the `held` entries. Include it in the `--json` payload unchanged (it already passes `sync` through whole).
- **Do**: when `_sync.json` is missing, stale (`updatedAt` older than ~60 s), or has no `files` block, read the ledger at `.design/_state/file-ledger/*.json` directly and say so. The ledger is the source that stayed correct.
- **Gotcha**: this is the highest-value single change for the reported UX failure — a user read `0 pending` and believed the project was synced while 803 files were missing.
- **Validate**: `node cli/bin/maude.mjs design status` in `/Users/iagh/Maude/alligators`, plus `node --test cli/commands/design.test.mjs`

#### Task 22: ADD `maude design status --watch`

- **Do**: re-read + re-render on an interval (2 s default, `--interval`), single-line in a TTY, appending lines when piped. Exit 0 on `converged`, non-zero on `blocked`.
- **Gotcha**: exiting non-zero on `blocked` makes it usable as a CI/script gate; `paused` is **not** a failure and must keep waiting.
- **Validate**: `node cli/bin/maude.mjs design status --watch` against a live seed.

#### Task 23: ADD a periodic progress line to `maude design serve`

- **Do**: while `progress.phase !== 'converged'`, emit one line every 15 s: `[sync/files] 1 412 / 2 961 delivered · 803 waiting · paused 42s (workspace asked us to slow down)`. Suppress when unchanged.
- **Gotcha**: this is the line whose complete absence made two 14- and 6-minute runs indistinguishable from progress. The doc lane already prints its one-shot summary; the file plane printed nothing at all after boot.
- **Validate**: manual, during Phase 6.

#### Task 24: UPDATE `SyncPanel.jsx` — progress bar, denominator, blocked classes

- **Do**: in the `project files` group (`:649`), render `<SeedProgressBar>` (delivered/tracked), the remaining count, the phase sentence, and `blocked` grouped by class with counts and an expandable path list (reuse `sp-held-paths`).
- **Do**: keep the raw counters visible beneath it (DDR-214 — a panel derived from the same source it displays cannot be cross-checked).
- **Do**: add `data-testid`: `sync-files-progress`, `sync-files-remaining`, `sync-files-phase`, `sync-blocked-<class>`.
- **Gotcha**: render defensively — every new field is optional, and a payload from an older server must degrade to today's rendering, not to a crash. Follow the existing `isCount` validation at `:85`/`:97`.
- **Gotcha**: after editing the client, **rebuild the committed bundle release-minified** (`cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`) and commit `dist/client.bundle.js` + `dist/styles.css`. Check `git status apps/studio/dist/` before **and** after any `bun test` in this tree.
- **Validate**: `cd apps/studio && bun test test/sync-*.test.ts` + a visual check via `/design:smoke`.

#### Task 25: ADD native desktop surfacing

- **Do**: bridge the existing `sync:status` payload to the shell (a Tauri event from the client on phase change only, not on every emit) and render: a dock/taskbar progress indicator while `seeding`, a window-title suffix `— syncing 1 412/2 961`, and one native notification via `apps/desktop/src-tauri/src/notify.rs` on `converged` and on a transition into `blocked`.
- **Gotcha**: notify on **phase transitions**, never per file. A 2 961-file seed must produce two notifications, not 2 961.
- **Gotcha**: DDR-177 — anything runtime-spawned must stay inside the bundle; this adds no new spawned surface, but re-run `apps/desktop/scripts/check-bundle-completeness.mjs <built .app> --smoke` before any release that carries it.
- **Validate**: `pnpm test:e2e:desktop:build && pnpm test:e2e:desktop` (add a scenario asserting the new testids are reachable in the native shell).

### Phase 5 — genuinely large projects

#### Task 26: DECIDE and record the >95 MB policy

- **Do**: record a DDR (`/flow:record-ddr`) choosing between (a) honest terminal refusal with a named reason — shipped by Task 12 — and (b) chunked/multipart upload through the door. Recommendation: ship (a) now, scope (b) as its own increment. A 465 MB video that is silently retried forever is strictly worse than one a person is told about.
- **Do**: whichever is chosen, the refusal must carry a **suggestion**, not just a size. 630.7 MB of alligators' undelivered bytes are these two files, and a 466 MB source video is legitimate material — the message names the options (keep it out of the workspace via `.design/` layout, or downscale) rather than implying a mistake.
- **Validate**: DDR exists and is ingested (`maude kg import`).

#### Task 27: PACE the seed against the hourly quota

- **Do**: using Task 12's `quotaUsed` / `quotaResetsAt`, stop a pass cleanly when the remaining window budget is nearly spent and report `paused` with the reset time, instead of driving into a `507`.
- **Gotcha**: this is a *pacing* change, not a new limit. The door's quota stays authoritative.
- **Validate**: `cd apps/studio && bun test test/sync-file-plane.test.ts`

#### Task 28: NOTE the cell cold-start scope boundary

- **Do**: do **not** attempt "bind first, restore behind a restoring page" here. `apps/cells/cell-do.mjs:190-201` already names it as the real fix for availability-as-a-function-of-project-size, with a 30-minute `portReadyTimeoutMS` standing in for it. Record it as a follow-up plan; this plan's Phase 1 removes the *rate-limit* cause of the restart loop, not the cold-start-duration one.
- **Validate**: follow-up recorded in the plan's Follow-up section + `kg`.

### Phase 6 — verification

#### Task 29: CREATE the synthetic large-project fixture

- **Do**: `apps/studio/bin/_seed-fixture.mjs --files 3000 --bytes 2GB --out <dir>` generating a `.design/` whose shape matches a real project (assets-heavy, a few over-cap files, a canvas layer). Sparse/pseudo-random content so it costs seconds, not minutes.
- **Validate**: `node apps/studio/bin/_seed-fixture.mjs --files 50 --bytes 10MB --out /tmp/x && ls /tmp/x`

#### Task 30: ADD an incident-replay test for this incident

- **Do**: extend `apps/studio/test/sync-incident-replay.test.ts` with a scripted hub that answers `502` (no `Retry-After`), then `429`, then `503 Retry-After: 5`, then succeeds — asserting: the plane pauses rather than burning its request ceiling, no path is attempted more than twice inside the window, and `progress.phase` reads `paused` (not `synced`, not `blocked`).
- **Gotcha**: **make it fail first.** Revert Tasks 9–11 locally and confirm the test goes red before keeping it — a regression test that never saw the bug it guards is documentation, not a test (memory `maude-verify-regression-tests-fail-first`).
- **Validate**: `cd apps/studio && bun test test/sync-incident-replay.test.ts`

#### Task 31: REPRODUCE against the real project

- **Do**: read the preserved evidence FIRST — peer session `alligators-seed` archived the broken state outside `.design/` (so neither the hub nor `_state/` rotation can overwrite it) at `/Users/iagh/Maude/alligators-seed-ledger-2026-09-03/`: `file-ledger/alligators.cloud.maude.sh-17a28ee2.json` (2 961 rows, 803 undelivered), `_sync.json` (with the dead counters), `maude-cells-tail.json` (1.5 MB, 353 events — the 24× mint failure and 30× `cell started` with timestamps) and `maude-cloud-tail.json` (335 KB, 104 events). Several assertions in Tasks 1–5 can be checked against these without reproducing anything.
- **Do**: then, in `/Users/iagh/Maude/alligators` (live ledger still untouched at `.design/_state/file-ledger/alligators.cloud.maude.sh-17a28ee2.json`), run `maude design serve` against `https://alligators.cloud.maude.sh` with `wrangler tail maude-cells` and `wrangler tail maude-cloud` open. Confirm: mint calls per pass drop to ~0 while the container is running; no restart storm; `remaining` decreases monotonically; the two over-cap files land in `blocked/too-large` with their real sizes; `maude design status` and the Sync panel agree with the ledger.
- **Gotcha**: run `apps/studio`'s `bun test` **alone** — sharing the machine with the hub suite fabricates failures (memory `maude-parallel-test-runs-contaminate`).
- **Gotcha**: back up the ledger before the run; it is the only record of the failed state.
- **Validate**: a completed seed, or a documented, *named* reason it stopped.

#### Task 32: TEST both directions

- **Do**: after the desktop seed converges, verify a second machine (or a fresh checkout) pulls the same set, and that a delete and a conflict resolve. Cloud and desktop are not symmetric — one side wins races the other loses (memory `maude-sync-test-both-directions`).
- **Gotcha**: this is the B2 drill STATE.md still records as never run. Doing it here retires that debt.
- **Validate**: both peers converge to the same manifest.

---

## Validation

1. **Lint**: `pnpm lint`
2. **Format**: `pnpm format`
3. **Types**: `cd apps/studio && bunx tsc --noEmit && cd ../.. && bash scripts/check-tsc-coverage.sh`
4. **Tests**: `pnpm test && cd apps/studio && bun test test/sync-*.test.ts --timeout 20000` — run the studio suite **alone**.
5. **Cloud/cells**: `node --test apps/cloud/*.test.mjs apps/cells/*.test.mjs`
6. **Import coherence**: `bash scripts/check-import-coherence.sh` (Task 0's gate; re-run before any tag)
7. **Bundle hygiene**: `git status apps/studio/dist/` clean or intentionally rebuilt release-minified
8. **Desktop**: `pnpm test:e2e:desktop:build && pnpm test:e2e:desktop`; before any release, `apps/desktop/scripts/check-bundle-completeness.mjs <.app> --smoke` and `check-client-boots.mjs <.app>`
9. **Security**: `/flow:validate-security` — Task 4 touches a credential boundary; the `security-auditor` + `ethical-hacker` pass is not optional for it
10. **Manual**: Task 31 (the real 8.8 GB reproduction) and Task 32 (both directions)

---

## Scenario Coverage

| Scenario | Covers | Status |
| --- | --- | --- |
| `sync-seed-progress` | link a large project → progress visible in the panel with a denominator → converged | 🆕 new |
| `sync-seed-blocked` | an over-cap file and an unreachable hub render as named blocked classes, not as `synced` | 🆕 new |
| desktop e2e `sidecar-respawn-canvas-switch` | already present (untracked) — extend with the new `sync-files-*` testids | ✅ existing |

---

## Acceptance Criteria

- [ ] All tasks completed
- [ ] `bash scripts/check-import-coherence.sh` green (Task 0)
- [ ] A running cell issues **zero** credential mints per proxied request (Task 5), verified in `wrangler tail`
- [ ] A `429` from the Cloudflare API reaches the cell as a retryable status with a `Retry-After`, never as a bare `502` (Tasks 1–3)
- [ ] Fail-closed behaviour is unchanged: no storage credentials and no legacy key still means the cell refuses to start (Tasks 3–5)
- [ ] No user-facing reason string contains Bun's `Is the computer able to access the url?` (Tasks 7–8)
- [ ] `maude design status` reports the file plane next to `docs:`, and never reads clean while files are undelivered (Task 21)
- [ ] The Sync panel shows delivered/tracked with a denominator, remaining, phase, and blocked classes (Task 24)
- [ ] `_sync.json` `updatedAt` advances while the plane is working (Task 17)
- [ ] The doručenka payload is bounded with a truncation count (Task 18)
- [ ] A 401 from the file door triggers exactly one credential renewal and the next pass proceeds (Task 13a)
- [ ] A converged doc lane with an active file plane does not exhaust `RENEW_MAX_WITHOUT_PROGRESS` (Task 13b)
- [ ] `maude design link --adopt` with an unchanged token keeps `expiresAt`; with a new token drops it (Task 13c)
- [ ] The incident-replay test **fails** with Tasks 9–11 reverted (Task 30)
- [ ] The real alligators seed either completes or stops with a named, user-visible reason (Task 31)
- [ ] `/flow:validate` passes: static, tests, build, `security-auditor` + `ethical-hacker` 0 blockers above the severity floor
- [ ] DDRs recorded: the credential-cache trust model, the >95 MB policy, the progress model
- [ ] `whats-new-entry` appended (user-visible: sync progress on every surface)
- [ ] `pnpm --filter @maude/site gen:roadmap` re-run and the `site/lib/roadmap.json` diff committed

---

## Follow-up (out of scope, recorded deliberately)

- **Bind-first / restore-behind-a-page cell cold start** — `cell-do.mjs:190-201` names it; availability should stop being a function of project size. Own plan.
- **Chunked/multipart upload through the file door** — needed for genuine >95 MB assets. Own increment, gated on Task 26's DDR.
- **Confirm the CF API bucket semantics** — whether `POST /r2/temp-access-credentials` shares the account-wide request bucket. Cloudflare's docs are not specific; Phase 1 makes the question much less load-bearing but it is worth settling.

---

## Retro

- **The peer session's framing was right and worth taking seriously.** `alligators-seed` opened by correcting the premise — "this is not primarily a large-project bug" — and that correction is what kept the plan from being a scaling exercise. Its report was also wrong in one specific place (it said the mint happened per *wake*; it happened per *request*), which is the ordinary shape of a good handoff: verify the claims, keep the framing.
- **The two things neither of us could grep for were the two that mattered most.** The unidentified reason string was Bun's own `fetch` wording (found by running `bun -e`, not by grepping), and `renewalsSinceProgress` resetting only on a doc handshake was invisible because the constant's comment *asserted* the false premise in prose. Reading a comment as documentation rather than as a claim to check cost real time.
- **Two of my own mistakes, both mechanical, both caught by tests I nearly did not run.** `biome check --write` applies *lint* fixes, not just formatting — it rewrote `function(){}` mocks into arrows and broke three tests. And a first attempt at covering the running-container short-circuit imported `MaudeCell` behind a catch-guard, so it passed by *skipping*. The fix in both cases was to look at the diff/result rather than the exit code.
- **`git stash push --keep-index` as a "quick check" nearly cost the whole session's work.** The pop failed and the index came back empty; recovery was clean only because the stash was intact. There was no reason to stash at all — the question ("would my commit alone be coherent?") was answerable by reading the staged file list.
- **The security review paid for itself several times over.** Three blockers, of which two were regressions this change introduced (`restart()` no longer invalidating credentials; the unmetered route), plus a stale-quota bug that would have silently stopped a client uploading *forever*. All of them were in code I had written carefully and tested. Cross-package + security-sensitive work should not use `--quick` — the guardrail list says so, and this is why.
- **For `/flow:plan` next time:** the plan's acceptance criteria included two items (`Task 31`, `Task 32`) that need a live environment and a second machine. Those are not acceptance criteria, they are a separate verification plan — folding them in meant the plan could never be "done", only "done except". Split environment-dependent verification into its own tracked item.
