# DDR-238 — A file the workspace will never accept is refused BY NAME, not retried forever

**Date:** 2026-09-03
**Status:** accepted
**Scope:** `apps/studio/sync/file-plane.ts`, `apps/hub/src/file-door.mjs`
**Relates to:** DDR-226 (sync v2 journal file plane), DDR-214 (a status surface that lies)

## Context

The file door has refused anything over **95 MB** since it shipped
(`file-door.mjs` `MAX_FILE_BYTES`). The client's push side used **512 MB** —
which is the *pull/receive* cap in `file-plane.ts`, a different number for a
different direction that happened to be spelled the same way. Nothing anywhere
reconciled the two.

The consequence in a real project (alligators, 2026-09-03): `group-team-photo.png`
(164.9 MB) and `rozhovor_kilian.mp4` (465.8 MB) were scanned, queued, hashed and
uploaded on **every pass of every boot**, each attempt burning one of the pass's
200 request slots and timing out against a door that was never going to accept
them. Together they are 630.7 MB of a 2 305.9 MB backlog. They landed in the
ledger as an anonymous `stuck`, which is the state the client retries.

A ceiling only one side knows is not a contract. It is a trap.

## Decision

**1. The ceiling becomes discoverable.** The door answers
`GET /api/file-limits` with `{maxFileBytes, quotaBytesPerWindow, quotaWindowMs}`
plus, for an identified token, `{quotaUsed, quotaResetsAt}`. The client asks
once per boot and treats the answer as authoritative. `DEFAULT_HUB_MAX_FILE_BYTES`
(95 MB) remains as the fallback for a hub too old to answer — but only as a
fallback, because a hardcoded mirror of someone else's constant is the same
trap one level down.

**2. An over-cap file is refused locally, before a byte is read**, and lands in
a new terminal delivery state `refused` rather than `stuck`. `refused` is not
retried and does not consume a request slot.

**3. The refusal names both numbers and offers a way forward.** Not
`HTTP 413`, and not a bare limit either:

> Too big for this workspace — 465.8 MB, and the limit is 95.0 MB

A 466 MB source video is legitimate material, not a user error. The message has
to leave the person with something to do (keep it out of the synced tree, or
downscale), which a status code cannot.

## Alternatives considered

**Chunked / multipart upload through the door.** The complete answer, and
rejected *for now* rather than on the merits. It needs a resumable protocol on
both sides, a reassembly buffer with its own quota, and a partial-upload GC —
a feature, not a fix. Scoped as its own increment.

**Raise the door's ceiling.** Cheap and wrong. 95 MB is deliberately below the
platform's own body limit (`file-door.mjs` says so at the constant); raising it
moves the failure from a clean 413 into an edge timeout, which is strictly
harder to diagnose.

**Keep retrying and let it surface as `stuck`.** This was the status quo, and it
is what made two 8.8 GB runs indistinguishable from working ones. A path that
cannot succeed must stop costing a request slot, and a person owed an
explanation must not be given a retry indicator instead.

## Consequences

- Two files in the reference project stop consuming ~2 slots per pass forever.
- `DeliveryState` gains `refused`, distinct from `stuck` — the difference is
  whether retrying is the right answer, which is exactly what the panel and the
  CLI need to say different words about.
- The same wall shape now carries the hourly write quota (`507`), which is also
  "the workspace will not take this right now" but resets on its own.
- **Still open:** genuinely large media has no path into a hub. The refusal is
  honest, not sufficient. See the multipart increment.
