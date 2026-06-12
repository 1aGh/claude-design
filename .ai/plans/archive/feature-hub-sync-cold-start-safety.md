# Feature: Hub sync cold-start safety + honest status — "link & it just works"

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. **This touches the sync hot path (`apps/studio/sync/*`) — the standing rule applies: inventory + per-feature plan, verify every feature, 100 % no regressions** (memory `feedback_no_break_exhaustive_verify`). The verified-working baseline (live bidirectional sync ~2 s end-to-end) must survive untouched.

## Description

Eliminate the cold-start data-loss class ("who connects first wins, the other peer's work is silently destroyed") and the silent partial-sync failures in linked-hub mode, so the entire user story is: mint token → `maude design link` → it works, bidirectionally, with zero thinking about connection order. Driven by the 2026-06-11 production incident on `test.studyfi.com/hub` (two AI-StudyMate checkouts, one machine).

## User Story

As a designer running Maude on two checkouts/machines linked to the same hub, I want to boot either side in any order and never lose local canvas work — and when the two sides genuinely diverged, I want the system to pick the sensible winner (newest), keep a recoverable snapshot of the loser, and tell me loudly what happened — so that hub sync is something I trust, not something that eats a day of mascot work.

## Problem — four root causes (all evidenced in the incident)

**RC1 — Cold-start hub-wins destroys divergent local work, no backup.**
`apps/studio/sync/agent.ts` `reconcile()` (non-adopt branch, lines ~313–344): when hub doc ≠ local body and both are non-empty, the hub state overwrites disk. `onConflict` fires AFTER the destructive write — a notification, not protection; no `_history/` snapshot is taken. Incident: peer B's 6 kB `ui/maskot.tsx` (a day of work) was overwritten by peer A's stale 2551 B version that had seeded the hub earlier. The only trace was `_sync.json` → `conflicts: [{"slug":"ui-maskot","kind":"cold-start-hub-wins"}]`. The agent.ts comment says it itself: "v1.1 resolution is always hub-wins; the interactive 3-way prompt is deferred" — that deferral is now a proven data-loss footgun.

**RC2 — Same-machine token overwrite → shared rate-limit bucket → permission-denied storm.**
`~/.config/maude/hubs.json` is keyed **per hub URL only**. The user minted two hub-wide tokens (labels `michal`, `michal-2`) and ran `maude design link --token=…` in each checkout — the second link **overwrote** the first token, so BOTH dev servers authenticate as `michal-2`. Each server opens **83 separate WebSockets** (one HocuspocusProvider per canvas, `defaultProviderFactory` in `sync/index.ts`). Hub rate limit (`apps/hub/src/server.mjs:74` `CONN_RATE_LIMIT_MAX = 100` per 60 s, keyed by token **label**, `checkConnRateLimit` :821) → boot burst 83 + 83 = 166 auths/10 s → ~65 of peer B's connections rejected. Hocuspocus retries forever (`maxAttempts: 0`, backoff 1 s→30 s cap) → ~65 providers × retry every ≤30 s ≈ 130+ auths/min sustained → **the bucket stays pinned forever**; rejected canvases never sync.

**RC3 — Status surface lies.**
Boot prints `[sync] linked … 83/83 canvas(es) syncing.` BEFORE any handshake completes (`sync/index.ts` end of `start()`). `ConnectionMonitor` aggregates 83 providers into one bool (ANY connected → `online`), so per-canvas auth rejections are invisible; `_sync.json` showed `state:"online"`, `lastSyncAt:null`, `updatedAt` frozen at boot. `lastSyncAt` is only set on offline→online transitions (`connection-state.ts` `goOnline()`), never on actual sync activity.

**RC4 — Rejection reason lost + misleading hint.**
The hub throws distinct errors (`'rate limit exceeded for this token'` :169 vs `'token not authorized for this documentName'` :159 vs `'invalid token'` :191), but the peer's `onAuthenticationFailed` received the generic `permission-denied` — and the client hint then tells the user to "mint a hub-wide token", which in this incident was a dead end (the tokens WERE hub-wide; the problem was the rate limit). Console spams one 5-line warning per rejected doc per retry.

## Solution

Five pillars, in dependency order:

1. **Sync journal** (`<designRoot>/_state/sync-journal.json`, per-machine, already gitignored via the DDR-056 block's `_state/` line) — records, per slug, the content hash of the last state this machine successfully reconciled disk↔doc. This answers git's "do I have uncommitted changes?" question for sync: hub-wins is allowed to overwrite local **only** when local hash == journal hash (clean fast-forward). Anything else is divergence.
2. **Cold-start conflict protocol** (shared by both sync paths): on divergence, snapshot **both** versions to `_history/<slug>/` via the existing `history.ts` `writeSnapshot()` (reasons `pre-sync-local` / `pre-sync-hub`), then resolve **newest-wins** (doc-side `syncMeta.bodyEditAt` stamp vs local file mtime; unknown/tie → hub-wins as today, but now recoverable), record a rich conflict entry, surface it loudly. `/design:rollback` already restores `_history` snapshots — the recovery story is one command.
3. **WS multiplexing** — one shared `HocuspocusProviderWebsocket` per hub URL instead of 83 sockets (`@hocuspocus/provider` 4.1.0 exports it; README documents the pattern). Kills the boot burst, the rate-limit trip, and the 83× retry storm in one move.
4. **Honest status** — per-slug states (`pending`/`synced`/`auth-rejected`) in the monitor + `_sync.json` + `/_sync-status` + banner + `maude design status`; `lastSyncAt` updated on real sync activity; boot summary printed AFTER handshakes settle ("81/83 synced · 2 auth-rejected (…)").
5. **Hub-side fixes** — propagate distinct rejection reasons to the provider; redesign the rate limit so valid-token auth bursts from legitimate peers can't starve sync (separate invalid-token tightening); reason-specific client hints.

## Metadata

- **Type**: Bug Fix + Enhancement (incident-driven)
- **Complexity**: High
- **App/Package**: `apps/studio` (sync runtime), `apps/hub` (server), `cli` (status/link messaging), studio client (banner)
- **Affected Systems**: sync cold-start reconcile (both paths), provider factory, connection monitor, status store, hub onAuthenticate + rate limiter, `_sync.json` schema (additive), `maude design status`
- **Dependencies**: none new (multiplexing uses the already-installed `@hocuspocus/provider` 4.1.0)

---

## Context References

### Must-Read Files

> During `/flow:execute`, read every file listed here in parallel in a single message.

- `apps/studio/sync/agent.ts` (whole file, esp. `reconcile()` 277–372) — RC1 lives here; the non-adopt branch is replaced by the cold-start decision module. The empty-hub guard (330–343) must be preserved as a case of the new decision table.
- `apps/studio/sync/index.ts` (228–496 `start()`, 809–899 `defaultProviderFactory`) — provider wiring, boot log line, onAuthenticationFailed hint, where multiplexing + per-slug status hooks go.
- `apps/studio/sync/migrate-seed.ts` (whole) — the sharedDoc path's existing safer seed; unify with the new decision module (it already snapshots local before hub-wins, but blindly: no journal, no newest-wins, snapshot to a fixed `pre-shared-doc-migration/` dir).
- `apps/studio/sync/connection-state.ts` (whole) — monitor to extend with per-slug states + `noteSyncActivity()`.
- `apps/studio/sync/status.ts` (whole) — payload shape to extend (additive, backward-compatible: keep all existing fields).
- `apps/studio/sync/codec.ts` (esp. `applyHtmlToDoc` 90–126, `META_LOCAL_KEYS` ~211, size caps 54–58) — add the `syncMeta` Y.Map helpers here; note `last_modified` is in `META_LOCAL_KEYS` (local-only), so newest-wins CANNOT use meta.last_modified from the doc — hence the dedicated `syncMeta` lane.
- `apps/studio/sync/echo-guard.ts` + `apps/studio/sync/atomic-write.ts` — journal writes go through `atomicWrite`; `hashBytes` is the journal's hash fn (single source).
- `apps/studio/history.ts` (`writeSnapshot` 61–79, naming 48–58) — the snapshot API the conflict protocol reuses. Pure Bun lib, not HTTP-coupled.
- `apps/hub/src/server.mjs` (onAuthenticate 149–191, rate-limit constants 70–74, `checkConnRateLimit` 821–830) — RC2/RC4 hub side.
- `apps/hub/src/tokens.mjs` (`matchesScope` 232–246, default-scope logic ~265) — confirm scope semantics untouched.
- `cli/lib/design-link.mjs` (`runLink` 26–109, `runStatus` 206+, gitignore block 154, 294) — status rendering + link messaging.
- `apps/studio/sync/projection.ts` — sharedDoc disk handler; its reconcile must take the same journal recording.
- `apps/studio/test/sync-agent.test.ts`, `test/sync-runtime.test.ts`, `test/sync-status.test.ts`, `test/sync-connection-state.test.ts` — existing patterns to extend (in-memory Y.Doc pairs, injected timers, stub providers).
- `node_modules/@hocuspocus/provider/src/HocuspocusProviderWebsocket.ts` (115–150 retry config) + `src/index.ts` exports — multiplexing API ground truth (read from `apps/studio/node_modules`).

### Files to Create

- `apps/studio/sync/journal.ts` — sync journal (load/get/record/invalidate, atomic + debounced persist).
- `apps/studio/sync/cold-start.ts` — pure decision function + types (the testable core).
- `apps/studio/test/sync-journal.test.ts` — journal unit tests.
- `apps/studio/test/sync-cold-start.test.ts` — the full decision matrix.
- `.ai/decisions/DDR-102-cold-start-divergence-resolution.md` — supersedes the v1.1 "hub-wins always" scoping.

### Documentation

- `@hocuspocus/provider` README (shipped in node_modules) § shared `HocuspocusProviderWebsocket` — Why: the multiplexing pattern, version-exact.
- `.ai/decisions/DDR-054-*.md`, `DDR-056-*.md`, `DDR-064-*.md`, `DDR-079-*.md` — Why: governing constraints (hub untrusted, gitignore strategy, shared-doc convergence, TSX default-on). DDR-102 must cite which clause of which DDR it supersedes (only the cold-start resolution; trust model unchanged).
- `site/content/docs/hub/linking.mdx` — Why: user-facing doc to update with the new conflict/recovery story.

### Patterns to Follow

- Origin-tagged Y transactions (`agent.ts` `origin` object, `origins.ts` `ORIGINS.MIGRATION`) — `syncMeta` stamps must use the agent origin so they don't trigger echo flushes.
- Injected timers/clock for testability (`connection-state.ts` options) — backoff + boot-settle timers must be injectable the same way.
- Additive `_sync.json` evolution (`NoSyncablePayload` discriminator pattern in `sync/index.ts` 741–771) — new fields, never repurposed ones; CLI + banner must tolerate old payloads.
- `hashBytes` from `echo-guard.ts` as the single content-hash function (journal must compare apples to apples with the echo guard).

---

## Design Decisions

No new UI components. The studio surface change is copy/fields inside the existing `SyncBanner` (`apps/studio/client/` — locate via `sync:status` listener; STATE.md history names `<SyncBanner>` in `app.jsx`) and the existing conflict list. Token/Tailwind tables N/A (studio client uses maude DS classes; follow existing `.st-banner` styles — no hardcoded colors).

### Key decisions to record in DDR-102

| Decision | Choice | Rationale |
| --- | --- | --- |
| Divergence detection | Per-machine content-hash journal, not timestamps | Timestamps lie across machines; "did THIS machine sync this exact content" is exact. Journal absent → conservative (treat as potential divergence when sides differ). |
| Conflict default (unattended boot) | Newest-wins (doc `syncMeta.bodyEditAt` vs local file mtime), unknown → hub-wins | Matches user intent in the incident (newer side should win); both sides snapshotted first so even a wrong pick costs one `/design:rollback`. Interactive resolve stays deferred — but now it's a UX nicety, not a data-safety gap. |
| Loser preservation | Dual snapshot (`pre-sync-local` + `pre-sync-hub`) via `history.ts` | Both sides recoverable regardless of winner; `/design:rollback` is the existing recovery UX. Skipped for clean fast-forwards (no history spam on every boot). |
| Comments cold-start | Union-merge by comment `id` instead of hub-wins | Comments carry stable ids; union loses nothing and needs no winner. Annotations/css/meta follow the body winner (visually coupled). |
| Connection model | One `HocuspocusProviderWebsocket` per hub URL, N providers attached | 1 socket instead of 83; boot burst and retry storms collapse; rate limiter sees ~1 auth/boot if auth is per-socket (verify in T7 — if per-document, the hub bucket resize in T9 still covers it). |
| Rate limit redesign | Per-label bucket applies to *failed/invalid* auths aggressively; valid-token auths get a much higher ceiling (default 600/min, env-overridable) | The 100/min bucket was an anti-brute-force control, but it throttled *valid* tokens — brute force is about invalid attempts. |

---

## Tasks

Execute in order. T1–T5 are the data-safety core (shippable alone); T6–T8 the connection/auth layer; T9–T11 status honesty; T12–T14 docs/close-out.

### Task 1: CREATE `sync/journal.ts` (+ tests)

- **Do**: Per-machine journal at `<designRoot>/_state/sync-journal.json`: `{ hubUrl, updatedAt, slugs: { [slug]: { bodyHash, cssHash?, at } } }`. API: `loadJournal(designRoot)`, `journal.get(slug)`, `journal.record(slug, hashes)`, `journal.flush()` (debounced ~1 s, `atomicWrite`), `journal.invalidateIfHubChanged(url)` (relink to a different hub → wipe). Corrupt/unparseable file → treat as absent (never throw into boot). Hash via `hashBytes` from `echo-guard.ts`. Create `_state/` dir on demand (`mkdirSync recursive` — pattern in `migrate-seed.ts` `snapshotLocal`).
- **Pattern**: `atomic-write.ts` usage in `agent.ts`; best-effort try/catch posture of `status.ts` writes.
- **Gotcha**: `_state/` is already in the DDR-056 gitignore block (`cli/lib/gitignore-block.mjs:28`) — no gitignore work needed. Journal is per-hub: store `hubUrl` top-level and invalidate on mismatch.
- **Validate**: `cd apps/studio && bun test test/sync-journal.test.ts`

### Task 2: CREATE `sync/cold-start.ts` — pure decision module (+ matrix tests)

- **Do**: `decideColdStart(input): ColdStartDecision` with `input = { localBody: string|null, docBody: string, journalHash: string|null, localMtimeMs: number|null, docBodyEditAtMs: number|null }` and `decision = { action: 'noop'|'materialize-hub'|'seed-local-up'|'fast-forward-hub'|'conflict', winner?: 'local'|'hub', reason: string }`. Table:
  - local absent/empty + doc non-empty → `materialize-hub` (clean first sync).
  - doc empty + local non-empty → `seed-local-up` (existing DDR-064 guard, now a named case).
  - both empty → `noop`.
  - local == doc → `noop` (+ caller records journal).
  - local ≠ doc, journalHash == hash(local) → `fast-forward-hub` (local fully synced before; hub is just ahead — overwrite WITHOUT snapshot/conflict).
  - local ≠ doc, journalHash ≠ hash(local) or absent → `conflict`, winner = newest (`docBodyEditAtMs` vs `localMtimeMs`; either null or equal → `hub`).
- **Pattern**: pure-function + exhaustive-table style of `codec.ts`; tests mirror `sync-codec.test.ts` table style. Cover the full matrix (local: absent/empty/clean/diverged × doc: empty/same/different × journal: absent/match/stale ⇒ ~18 cases) + both winner directions + null-timestamp fallbacks.
- **Gotcha**: hash comparisons only via `hashBytes` (same normalization as echo guard). Trim-only-whitespace bodies count as empty (mirror the existing `localHtml.trim() !== ''` guard).
- **Validate**: `bun test test/sync-cold-start.test.ts`

### Task 3: ADD `syncMeta` lane to `codec.ts` — doc-side body-edit timestamp

- **Do**: `Y.Map 'syncMeta'` on the doc: `stampBodyEdit(doc, origin, nowMs)` sets `bodyEditAt` (+ `by`: short peer label = `os.hostname()` truncated); `bodyEditAtFromDoc(doc): number|null`. Call `stampBodyEdit` wherever the body is applied INTO the doc from a local source: `agent.applyFromFs` html branch, `agent.reconcile` seed-up branch, `migrate-seed` adopt, projection's file→doc body apply. Same transaction + same origin as the body apply (one update, echo-guard-safe).
- **Pattern**: `applyAnnotationsToDoc`'s Y.Map usage in `codec.ts`.
- **Gotcha**: `META_LOCAL_KEYS` excludes `last_modified` from the meta sync lane — that's WHY this dedicated lane exists; do not piggyback on the meta codec. `syncMeta` is never materialized to disk. Older peers simply don't write it → `bodyEditAtFromDoc` returns null → decision falls back to hub-wins (interop-safe).
- **Validate**: `bun test test/sync-codec.test.ts` (extend with syncMeta round-trip + "older peer doc has no syncMeta" case)

### Task 4: REFACTOR `agent.ts` `reconcile()` to use the decision module + conflict protocol

- **Do**: Replace the non-adopt branch body-resolution with: compute inputs → `decideColdStart` → execute:
  - `materialize-hub`/`fast-forward-hub`: write disk from doc (existing writer+echoGuard path), record journal.
  - `seed-local-up`: existing `applyHtmlToDoc` path + `stampBodyEdit`, record journal.
  - `conflict`: snapshot BOTH (`writeSnapshot(htmlPath, localBytes, 'pre-sync-local')` + `writeSnapshot(htmlPath, docBytes, 'pre-sync-hub')` from `history.ts`), then apply winner (hub → disk write; local → seed up + stamp), record journal, call extended `onConflict({ slug, kind: 'cold-start-diverged', winner, snapshots })`.
  - Comments: replace hub-wins overwrite with id-union merge (union by `id`, doc order first, local-only appended; write merged to BOTH disk and doc). Annotations/css/meta: follow body winner (when local wins body, push local css up instead of overwriting disk; meta merge unchanged).
  - Journal recording added to `writeHtmlIfChanged`/`writeCssIfChanged` (doc→disk flush) and `applyFromFs` body/css branches (disk→doc) — every successful traversal of the disk↔doc boundary checkpoints the journal.
- **Pattern**: existing echo-guard record-before-write discipline; keep `adopt` branch behavior identical.
- **Gotcha**: Keep `SyncConflict.kind` union additive (`'cold-start-hub-wins'` stays for old payload readers; new kind `'cold-start-diverged'` + optional `winner`/`snapshots` fields). The DDR-064 empty-hub guard becomes the `seed-local-up` row — assert in tests it's bit-identical in behavior. `writeSnapshot` is Bun-API (`Bun.write`) — fine, agent.ts already runs under Bun; but verify the compiled-binary path uses `paths.ts`-safe locations only (it writes under designRoot — OK, DDR-045 concerns module-relative paths, not project paths).
- **Validate**: `bun test test/sync-agent.test.ts` (extend: fast-forward, diverged-local-wins, diverged-hub-wins, dual-snapshot side effects, comments union, journal checkpoints) — plus full `bun test` for regressions.

### Task 5: UPDATE `migrate-seed.ts` + `projection.ts` (sharedDoc path) to the same protocol

- **Do**: `migrateSeed` consumes `decideColdStart` for the body (today it's doc-empty→adopt / doc-non-empty→hub-wins): non-empty-vs-non-empty divergence now takes the conflict path (dual snapshot via `history.ts` instead of the bespoke `pre-shared-doc-migration/` copy — keep that dir name as the snapshot `reason` for continuity), newest-wins decides whether to keep doc state or rebuild from local inside the MIGRATION transaction. Projection's reconcile records journal checkpoints like the agent.
- **Pattern**: existing `migrateSeed` transaction discipline (ORIGINS.MIGRATION, delete-then-insert codecs).
- **Gotcha**: The dmonad duplication trap (file header) — the conflict path must still pick ONE source per type inside ONE transaction; newest-wins picks the source, never merges two doc histories. Comments id-union is safe (plain array rebuild from merged JSON, not CRDT-merge).
- **Validate**: `bun test test/shared-doc-migrate.test.ts` (extend with the divergence matrix)

### Task 6: REFACTOR `defaultProviderFactory` → shared `HocuspocusProviderWebsocket` per hub URL

- **Do**: Create one `HocuspocusProviderWebsocket({ url: wsUrl })` per runtime `start()`, pass it to every `HocuspocusProvider({ websocketProvider: socket, name, token, document, … })`. Destroy the socket in `stop()` after providers. Keep the `onStatus` seed-current-status logic (now per-provider attach/detach events — verify which events the provider emits when sharing a socket; fall back to socket-level status fan-out if per-provider 'status' no longer fires).
- **Pattern**: provider README pattern (node_modules); keep `ProviderFactory` injectable shape unchanged so all existing stub-based tests pass untouched.
- **Gotcha**: VERIFY empirically (local hub) whether `onAuthenticate` fires once per socket or once per document under multiplexing — record the answer in DDR-102 (it sizes T9). Awareness: each provider still exposes its own awareness — confirm the Task-5 (Phase 9) hub-awareness bridge still receives updates through a shared socket. v0.29 peers (83 sockets) must keep working against the upgraded hub — nothing hub-side may assume one socket per peer.
- **Validate**: `bun test test/sync-runtime.test.ts` + manual two-peer boot against a local hub (`maude hub serve --dev`): `lsof` shows ONE established WS per peer; 83/83 sync.

### Task 7: ADD auth-failure intelligence client-side (backoff, aggregation, honest hints)

- **Do**: In `defaultProviderFactory.onAuthenticationFailed`: classify reason (`rate limit` / `not authorized` / `invalid token` / generic `permission-denied`), forward `{ slug, reasonClass, raw }` to the runtime. Runtime: mark slug `auth-rejected` in the monitor (T9), aggregate console output into ONE debounced (2 s) warn listing ≤10 slugs + count + ONE reason-specific hint (rate-limit → "boot burst hit the hub rate limit; sync will settle, or raise HUB_CONN_RATE_LIMIT"; scope → the existing mint-wide-token text; invalid → "re-run maude design link"). Permanent classes (scope/invalid): `provider.destroy()` + re-probe timer (5 min, injectable); transient (rate-limit/generic): leave provider's built-in backoff.
- **Pattern**: injectable timers from `connection-state.ts`; the existing single-warn style of `surfaceNoSyncable`.
- **Gotcha**: With multiplexing (T6) rejection may arrive socket-level, not per-provider — classify at whichever layer fires, and make sure a socket-level auth failure marks ALL its providers' slugs rejected, not zero.
- **Validate**: `bun test test/sync-runtime.test.ts` (stub provider emitting auth failures → assert aggregation, destroy-on-permanent, statuses)

### Task 8: UPDATE hub — distinct rejection reasons over the wire + rate-limit redesign (+ tests)

- **Do**: (a) Investigate how Hocuspocus 4.1.0 server propagates `onAuthenticate` throw to the provider's `onAuthenticationFailed` (incident shows the peer got generic `permission-denied`, NOT the hub's message) — make the specific message reach the peer (mechanism per Hocuspocus API: error message / close reason / `Forbidden` payload — whatever v4 supports; if truly impossible, encode class in the close reason and document). (b) Rate limit: split buckets — valid-token auths per label default `HUB_CONN_RATE_LIMIT ?? 600`/min; invalid-token attempts keep 100/min per label AND add per-IP tightening; emit `retry-after` hint in the reason when tripped. (c) `verbose` rate-limit warn includes both bucket states.
- **Pattern**: existing `checkConnRateLimit` + `settings.mjs` env-override conventions; tests in `apps/hub/test/` mirror existing auth tests.
- **Gotcha**: Backwards interop both ways: old peers (v0.29) against new hub — fine (more permissive); new peers against old hub — reason classification must degrade to `generic` (T7 already handles). Hub ships as `ghcr.io/1agh/maude-hub` on `v*` tags — note in the release that hub redeploy is needed to get the limiter fix; peers get safety regardless (T1–T7 are peer-side).
- **Validate**: `cd apps/hub && bun test` (extend rate-limit tests: valid-vs-invalid buckets, 200-auth burst passes with valid token, reason strings)

### Task 9: UPDATE `connection-state.ts` + `status.ts` — per-slug states + real `lastSyncAt`

- **Do**: Monitor: `noteDocState(slug, 'pending'|'connected'|'auth-rejected')` (replaces the bare providerStatuses values), `noteSyncActivity(slug)` → sets `lastSyncAt = now()` (called by agents/projections on every successful flush/apply/reconcile). Snapshot gains `{ docs: { synced: number, pending: number, rejected: number }, rejectedSlugs: string[] (≤20) }`. `status.ts` payload extends additively. Aggregate online/offline logic unchanged.
- **Pattern**: existing injected-clock tests in `sync-connection-state.test.ts`.
- **Gotcha**: `rejectedSlugs` is read by the browser banner — sanitize length (≤20 + count), slugs are already charset-limited (hub regex) but treat as text, not HTML.
- **Validate**: `bun test test/sync-connection-state.test.ts test/sync-status.test.ts`

### Task 10: UPDATE `sync/index.ts` boot sequence — summary after settle

- **Do**: Replace the premature `83/83 syncing` line: keep a short `[sync] linking to <url> (<N> canvases)…` at start, then `Promise.allSettled` over `onceSynced()` with a 15 s injectable timeout → print `[sync] <url>: 81/83 synced · 2 auth-rejected (system-…, system-… — rate limit) · shared-doc:off`. Wire reconcile completions to `noteSyncActivity`. The TSX/DDR-079 banner stays.
- **Pattern**: `surfaceNoSyncable` for the loud-summary style.
- **Gotcha**: `onceSynced` never resolves for auth-rejected providers — the timeout + rejected-set math must not hang boot; the summary fires once, late canvases just update `_sync.json`.
- **Validate**: `bun test test/sync-runtime.test.ts`; manual boot shows the settled summary.

### Task 11: UPDATE surfaces — `maude design status`, studio SyncBanner, link notice

- **Do**: (a) `cli/lib/design-link.mjs` `runStatus`: render docs counts, rejectedSlugs (+reason), conflicts with winner + snapshot timestamps + a `/design:rollback <canvas>` recovery hint; `--json` passthrough. (b) Studio `SyncBanner`: rejected count chip ("2 canvases not syncing — details in maude design status") + conflict toast referencing the snapshot ("Diverged: kept the newer version; the other is in history → ⌘Z panel / /design:rollback"). (c) `runLink`: when `hubs.json` already holds a token for this URL, print "replacing the stored token for this hub (applies to every project linked to it on this machine)".
- **Pattern**: existing `runStatus` rendering; `.st-banner` classes (no hardcoded colors — maude DS tokens only).
- **Gotcha**: Old `_sync.json` without new fields must render fine (optional chaining); CSP `style-src 'self'` in the studio shell — classes only, no inline styles (memory `reference_csp_style_src_drops_inline_styles`).
- **Validate**: `cd cli && node --test` (or existing cli test runner) for status formatting; agent-browser smoke of the banner states (live `_sync.json` mutation).

### Task 12: CREATE DDR-102 — cold-start divergence resolution

- **Do**: Record: journal-gated fast-forward; dual-snapshot conflict protocol; newest-wins default + hub-wins fallback; comments id-union; multiplexed socket; rate-limit philosophy (valid vs invalid); the T6 auth-per-socket finding. Explicitly supersedes the "v1.1 = hub-wins always, 3-way deferred" scoping referenced in `agent.ts` and the Phase 9 plan (DDR-054/064 trust + convergence decisions UNCHANGED). Index it.
- **Validate**: DDR index updated; `agent.ts`/`migrate-seed.ts` header comments point at DDR-102.

### Task 13: UPDATE docs — hub linking page + README

- **Do**: `site/content/docs/hub/linking.mdx`: new section "What happens when both sides have work" (journal, newest-wins, snapshots, rollback recovery, status surfaces); update the rate-limit/token guidance (one token per machine per hub; re-linking replaces it). README hub blurb: one-paragraph safety story. Run `pnpm --filter @maude/site build` parity gates as configured.
- **Gotcha**: command-reference build asserts catalog↔md parity (DDR-101) — touching CLI help strings may require the catalog regen.
- **Validate**: site build green.

### Task 14: ADD incident-replay integration test + manual E2E script

- **Do**: (a) Automated (`apps/studio/test/sync-incident-replay.test.ts`): in-memory hub-doc pair — peer A seeds old body; peer B (divergent newer local + no journal) runs reconcile → assert B's file UNCHANGED on disk loses nothing: winner=local (newer stamp), both snapshots exist, hub doc now carries B's body, conflict entry recorded. Second scenario: B with clean journal → fast-forward, no snapshot. (b) Manual script in the plan/retro: local hub via `maude hub serve --dev`, two temp projects, boot order A→B and B→A, plus a 2×~100-canvas burst with `HUB_CONN_RATE_LIMIT` lowered to prove the limiter redesign (and one run against the OLD limit to reproduce, pre-fix).
- **Validate**: `bun test` full suite green (1394+ existing must stay green); manual script executed once before `/flow:done` with results pasted into the retro.

---

## Validation

Per `.ai/workflows.config.json` → `quality` (this repo: lint / tests / build + parity, tarball, tokens, site-content gates):

1. **Lint**: `pnpm lint` (biome) — clean on touched files.
2. **Tests**: `cd apps/studio && bun test` (1394+ existing + new must be green) · `cd apps/hub && bun test` · cli tests.
3. **Build**: `pnpm build` (MAUDE_SKIP_RUNTIME_BUNDLES rules apply — do NOT commit dev-regenerated `dist/runtime/*`; if client banner changed: rebuild `--release` and commit `dist/client.bundle.js` + `dist/styles.css` per CLAUDE.md).
4. **Smoke**: `maude design smoke` against a `.design` project (87/87+ styled).
5. **Typecheck**: `cd apps/studio && bun tsc --noEmit` — DDR-026 baseline only.
6. **Manual incident replay** (Task 14b) — the actual acceptance: no byte of divergent local work lost in any boot order.
7. Scenario-runner / a11y / design-system-guard: **N/A** (no end-user UI feature; banner copy change is covered by the agent-browser smoke in T11). If `/flow:done` insists, scope the scenario to "open studio with a linked hub, observe banner".

## Scenario Coverage

Cross-platform scenario N/A (dev-server/CLI/hub internals). The validation backbone is the incident-replay test (T14a) + the two-peer manual script (T14b), which IS the user flow that failed.

## Acceptance Criteria

- [ ] Booting two peers with divergent local state, in either order, never loses bytes: loser snapshotted to `_history/<slug>/`, winner = newest, conflict surfaced in `_sync.json` + banner + `maude design status`.
- [ ] Clean catch-up boots (journal match) are silent fast-forwards — no snapshot spam, no conflict noise.
- [ ] DDR-064 empty-hub guard behavior bit-identical (regression-tested).
- [ ] One WS per peer per hub (multiplexed); 2-peer boot of 83-canvas project produces zero auth rejections against a default-config hub.
- [ ] Rejected canvases (forced via scope-limited token) appear in `_sync.json.docs.rejected` + `rejectedSlugs`, with ONE aggregated console warning carrying a reason-correct hint; permanent failures stop retrying.
- [ ] `lastSyncAt` reflects real activity; boot summary prints settled counts.
- [ ] Old peer (v0.29) ↔ new hub and new peer ↔ old hub both still sync (manual interop check).
- [ ] DDR-102 recorded + indexed; `agent.ts` comment updated; docs updated; What's New entry at `/flow:done`.
- [ ] Full suites green: apps/studio bun test, apps/hub bun test, cli tests, biome, site build, smoke.

---

## Execution log — /flow:execute 2026-06-11 (all 14 tasks DONE)

**T1–T14 complete in one session.** Order deviation: T9 executed before T7 (T7's aggregator writes into T9's monitor — dependency-correct). `code-simplifier` polish passes skipped (subagent type not present in this environment's registry); hot-path discipline applied inline instead.

### Key findings (recorded in DDR-102)

- **Auth is per-DOCUMENT under multiplexing** (verified from @hocuspocus 4.1.0 source + live: each provider sends its own Auth message on socket open) — multiplexing alone does NOT fix the rate bucket; the hub-side valid/invalid bucket split is the companion fix.
- **Hocuspocus propagates `error.reason`, NOT `error.message`** (`writePermissionDenied(error.reason ?? 'permission-denied')`) — RC4's root cause; hub now throws `authError(reason)`.
- **With an injected `websocketProvider` the 4.x provider does NOT auto-attach** (`manageSocket=false`) — explicit `provider.attach()` required.
- **Latent bug fixed en route:** `history.ts` `fileSlug` only stripped `.html`, so `.tsx` snapshot dirs (`ui-foo.tsx`) never matched slug.sh (`ui-foo`) — /design:rollback could not find server-written snapshots for TSX canvases. Also `writeSnapshot` same-millisecond ts collision fixed (the dual pre-sync pair needs it).

### Manual E2E (T14b) — executed live, real hub + real multiplexed provider

Script: `/tmp/maude-e2e/` (hub: `node apps/hub/src/server.mjs` w/ real token; driver: bun script running `createSyncRuntime` with the REAL default factory; projects: temp design roots). Results:

1. **Multiplexing:** peer A, 2 canvases → `lsof` shows **1** established WS. Dual 100-canvas peers → 2 sockets total.
2. **Incident replay (A seeds stale → B boots divergent-newer):** winner=local, B's file byte-identical, BOTH versions in `_history/ui-maskot/`, conflict entry w/ snapshots in `_sync.json`, hub doc carries B's body. (First run also demonstrated the hub-newer direction + snapshot-restore recovery.)
3. **A re-boot after B won:** silent fast-forward to B's body — zero conflicts, zero snapshot spam (journal gate).
4. **Rate-limit repro (HUB_CONN_RATE_LIMIT=10, 100 canvases):** 10 synced / 90 rejected, classified `rate-limit`, ONE aggregated warn w/ reason-correct hint, honest settled summary + rejectedSlugs (≤20) in `_sync.json`.
5. **Default hub (600/min), 2×100-canvas simultaneous boot, same token label = 200-auth burst:** 100/100 + 100/100 synced, **zero rejections**.
6. **Banner states (agent-browser, isolated throwaway project, new release bundle):** rejected chip ("2 canvas(es) not syncing — … maude design status") + diverged toast ("Diverged on ui-maskot: kept the local (newer) version — … /design:rollback ui-maskot") both render as `.st-banner--warn` (screenshots `/tmp/maude-e2e/banner-*.png`).

### Verification

- apps/studio `bun test`: **1463/1463** (baseline 1394+, +69 new: journal 12 · cold-start 22 · syncMeta 6 · agent protocol 7 · migrate matrix 5 · multiplexing 3 · auth/summary 2 · monitor 6 · status 3 · incident replay 3) — incl. DDR-064 bit-identical guard test.
- apps/hub `node --test`: **126/126** (+9 new in `auth-reasons.test.mjs` — reason strings pinned over a REAL WS, bucket split, 200-burst).
- CLI `pnpm test`: **163/163** (+3 new — DDR-102 status rendering, old-payload tolerance, token-replacement notice).
- `bun tsc --noEmit`: 3 errors = DDR-026 baseline only (api.ts/runtime-bundle.ts), 0 new.
- biome: 0 findings on touched files (repo-wide baseline 21 pre-existing on HEAD, unchanged).
- Site build: 204 pages green. Smoke (step-3.5 gate, dev-server trigger): **88/88 styled, import-graph clean** — PNG sampling deviation: 6/88 visually read (zero canvas-render-path changes in diff; programmatic styled-gate green), documented per DDR-021.
- dist: `client.bundle.js` rebuilt `--release` (277 KB, SyncBanner); `dist/runtime/*` restored from git (`check-runtime-bundles` ✓); styles.css/comment-mount.js byte-identical to committed.

### Acceptance criteria

- [x] Divergent boots, either order, never lose bytes (E2E #2/#3 + incident-replay test ×3 scenarios).
- [x] Clean catch-up = silent fast-forward (E2E #3 + unit).
- [x] DDR-064 empty-hub guard bit-identical (regression test).
- [x] One WS per peer (E2E #1); 2-peer 100-canvas boot, zero rejections on default hub (E2E #5).
- [x] Rejected canvases in `_sync.json.docs.rejected` + `rejectedSlugs`, ONE aggregated reason-correct warn; permanent failures stop retrying + 5-min re-probe (E2E #4 + unit).
- [x] `lastSyncAt` = real activity; settled boot summary (E2E + unit).
- [x] Interop: old hub → new peer degrades to `generic` class (classifier unit); new hub ↔ old peers — hub never assumed one socket per peer + limiter is strictly more permissive for valid tokens (analytical; binary v0.29 cross-run not feasible in-session — flag for release notes: hub redeploy needed for limiter/reason fixes).
- [x] DDR-102 recorded + indexed; `agent.ts`/`migrate-seed.ts` headers updated; docs (linking.mdx + README) updated; site build green.
- [ ] What's New entry — deferred to /flow:done (per workflow).

---

## Retro

- **Incident-replay test + live E2E was the right validation spine.** A cross-platform scenario was N/A (dev-server/CLI/hub internals), so the acceptance bar became "the exact shape that failed in production, replayed." The in-memory `sync-incident-replay.test.ts` + the real-hub two-peer driver caught the multiplexing socket count, the rate-limit storm, and the winner direction — things a unit test alone couldn't prove. Keep this pattern for infra/runtime features: replay the incident, don't just unit-test the fix.
- **The security panel earned its place.** The defender passed clean, but the attacker found F1 — the snapshot-before-overwrite was best-effort, so a wedged `_history/` re-opened the very data loss the feature closed. The whole DDR-102 promise rested on a `writeSnapshot` that silently returned null. Lesson: when you copy a "best-effort, never throw" idiom (correct for status writes), check whether the operation is actually safety-critical — fail-closed is the opposite default. Worth a generalized rule: *the write that protects against data loss must be fail-closed, never best-effort.*
- **Verified library internals before designing.** Reading the @hocuspocus 4.1.0 source (auth-per-document under multiplexing; `error.reason` not `.message`; no auto-attach with injected socket) turned three would-be runtime surprises into design inputs. The plan's "read node_modules ground truth" instruction paid off — don't infer provider behavior from docs.
- **Latent bug surfaced by the feature, not the feature's fault.** `history.ts fileSlug` only stripped `.html`, so `.tsx` snapshot dirs never matched slug.sh — `/design:rollback` was silently broken for TSX canvases since the format switch. The conflict protocol depended on the dirs matching, which is how it got caught. When a new feature reuses an old helper, sanity-check the helper against the current format reality.
- **Process friction:** the `code-simplifier` subagent type wasn't in this environment's registry and the catch-all `claude` agent died on a transient socket error mid-run (after one safe edit). Net: the polish pass was effectively skipped. For hot-path code that's an acceptable outcome (conservative-by-default), but `/flow:execute`'s simplifier step should degrade gracefully when the agent type is unavailable rather than being attempted-and-failed.
