# DDR-240 — Seed progress is derived from the ledger, and an ETA is null until it is earned

**Date:** 2026-09-03
**Status:** accepted
**Scope:** `apps/studio/sync/seed-progress.ts`, `status.ts`, `index.ts`, `cli/lib/design-link.mjs`, `SyncPanel.jsx`
**Relates to:** DDR-226 (sync v2, the doručenka), DDR-214 (a status surface that lies), DDR-217 (asset-push progress)

## Context

Two runs against an 8.8 GB project moved zero files in 14 and 6 minutes. From
every surface a person can see, they were indistinguishable from two runs that
were working:

- `_sync.json` reported `files: {synced: 0, pushed: 0, pulled: 0}` for the whole
  run, while 2 961 ledger rows changed underneath it.
- `updatedAt` on that file froze at boot — measured **130 s stale** against a
  ledger current to within a second, on a file being rewritten continuously.
- `maude design status` rendered `docs:` and nothing else, so a healthy doc lane
  (85/87 synced, **0 pending**) read as a finished project while 803 files had
  never arrived.
- `requestsExhausted` / `budgetExhausted` were computed by every pass and
  mapped nowhere, so "this pass stopped at its ceiling, there is more coming"
  was unsayable.
- Nothing had a **denominator**. `synced`, `pushed`, `pulled` are numerators;
  "1 412" reads the same whether it is a quarter done or finished.

The counters were not buggy. They were **mis-sourced**: derived from per-pass
results, and a pass that converges nothing is legitimately all zeros.

## Decision

**1. Progress is folded from the LEDGER, not from pass results.**
`computeSeedProgress(rows, …)` returns `{phase, tracked, delivered, remaining,
bytesRemaining, blocked[], passCapped, etaMs, startedAt}`. The ledger is the
source that stayed correct through the entire incident; the passes are a
sampling of it.

**2. The raw counters stay beside it.** DDR-214's rule applied literally: a
panel derived from the same source it displays cannot be cross-checked, so
`synced`/`pushed`/`pulled` remain visible in the panel and the CLI as the thing
to disagree with.

**3. `etaMs` is `null` until a real sample of DELIVERED bytes exists.**
This is the load-bearing restraint. During the investigation a two-second
`nettop` sample read as "4 MB/s, about ten minutes left" and was reported to a
person as such; the sustained rate was ~270 kB/s of pure retry traffic and the
true answer was "never". An ETA computed over bytes **sent** would have been
confidently wrong in exactly the situation where being wrong costs most. So:
no sample ⇒ no number, a zero-delivery sample ⇒ no number, an absurd result ⇒
no number.

**4. Every payload that reaches a person is bounded.** The doručenka was one
entry per ledger row (2 961 keys) re-serialised to disk *and* broadcast to every
tab on every emit, including 200 ms asset-progress ticks. It is now capped at
300 rows **sorted actionable-first**, so the cap only ever truncates the healthy
tail, with `deliveryTruncated` carrying the count — the same shape
`items`/`itemsTruncated` already used and this lane had skipped.

**5. `updatedAt` means "when this payload was built".** It was spread from the
ConnectionMonitor snapshot, so the file and asset lanes published a stale stamp
*about themselves*. The monitor's own stamp survives as `connectionUpdatedAt`.

**6. Phases are named for what a person should do**, not for internal state:
`scanning` / `seeding` / `paused` / `blocked` / `converged`. `paused` and
`blocked` are deliberately different words — one resolves itself, the other
needs a decision — and `maude design status --watch` exits 0 on converged and
1 on blocked while `paused` keeps waiting, so it is usable as a script gate
without failing on an ordinary wall.

## Alternatives considered

**Fix the per-pass counters in place.** Cheaper, and it fixes nothing: a pass
that converges nothing still reports zeros truthfully. The mistake was the
source, not the arithmetic.

**A second status channel for progress.** Rejected — binding prior from
feature-sync-progress-modal: progress rides the ONE `sync:status` payload, not a
second fetch or a sibling bus.

**Show an ETA from bytes sent.** This is what a human observer did, in this
incident, and got wrong by two orders of magnitude. Codifying it would make the
tool confidently misleading precisely when things are broken.

## Consequences

- All three surfaces now say the same thing from the same source. Verified
  against the real broken state: `2158 of 2961 delivered · 803 waiting`.
- Status writes are coalesced at 200 ms, with immediate flushes for conflicts,
  notices, connection-state changes, and converged/blocked transitions.
- A new terminal `refused` delivery state (DDR-238) is what makes `blocked`
  distinguishable from `remaining` at all.
- The CLI reads the ledger directly when `_sync.json` is missing or stale,
  because the file freezing is the failure that was observed and a surface
  that trusts it alone is one restart from lying again.
