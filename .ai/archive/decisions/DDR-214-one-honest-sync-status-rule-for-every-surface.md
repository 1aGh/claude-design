# DDR-214 — One honest sync-status rule, read by every surface

**Date:** 2026-08-07
**Status:** accepted
**Scope:** `repo:maude` · `dept:dev`
**Supersedes:** nothing. **Extends:** DDR-102 (per-document sync state), DDR-054 (hub content is untrusted).

## Context

A user connected a Maude Cloud project from the desktop app, watched the confirm
dialog close, read one sentence — *"Syncing with alligators — 75 canvases."* —
and then nothing ever happened or ever changed. Their report: *"vyskočí modal,
pak vidím jen syncing canvases, ale reálně se nic nestane."*

The obvious reading is that the modal needed a progress bar. It did not. Four
independent defects meant the signal a progress bar would have rendered was
optimistic by construction, and rendering it faster would only have turned a
static wrong sentence into an animated, more credible wrong one:

1. **The monitor was born `online`** (`connection-state.ts`). From the instant a
   link existed — before a socket, before a token was accepted, before a byte
   moved — every reader of `state` reported success.
2. **`aggregate()` returns `'connected'` on the first match.** One connected
   provider out of seventy-five, with the other seventy-four auth-rejected,
   still read green.
3. **`docs.synced` could only rise.** No path demoted a `connected` document, so
   a hub that died left the last count frozen on screen — the most convincing
   possible lie, because it was true a moment ago.
4. **The status bar referenced `docs` zero times.** It keyed on `state` alone,
   which is hub *reachability*, not whether any document is syncing.

And a fifth, ours, shipped days earlier in `231ead01`: `remoteGap` was computed
before the pull and recorded after it, so it enumerated exactly the documents
that had just arrived. Observed live — `_sync.json` naming two canvases that
were sitting on disk.

Compounding all of it: the connect note was derived from the **attach
response**, which reports an *intention* (`{ syncing: true }` means
`runtime.start()` did not throw and one local canvas qualified), and was
computed once and stored as a rendered string. Its own hover text told the
person to go look at the status bar for the real answer — an admission that the
two surfaces disagreed, and the status bar was wrong in a different way.

## Decision

**One rule, in one pure function, read by every surface that answers "what is
the hub link doing".** `apps/studio/sync/presentation.ts` exports
`syncPresentation(payload, { project })`. The status-bar slot (`app.jsx`) and
the cloud rail's connect note (`CloudBar.jsx`) both call it. Agreement between
them is now structural rather than something two files have to remember.

Alongside it, the pipeline it reads was made honest:

- The monitor is seeded `'connecting'`, not `'online'`. The grace countdown is
  now gated on the *timer* rather than on `state === 'online'`, so a link that
  never reaches a provider still escalates to offline instead of waiting forever.
- A provider that stops being connected **demotes** its document from
  `connected` back to `pending` (provider id is the slug, so the monitor already
  had the mapping). `auth-rejected` is deliberately sticky — the hub gave an
  answer, and losing the socket does not turn it back into "still trying".
- `remoteGap` is renamed to `pulled` — *what arrived this run*, which is both
  true and the fact the Synced state tells the user to act on. Names capped at
  20, `count` carries the true total so the cap can never falsify a number.
- The connect note stores its **inputs**, not its rendered sentence, and derives
  the text on every render from the already-wired `sync:status` payload. No
  polling, no new bus consumer, no new fetch. The transition *Connecting… →
  Syncing 40 of 75 → Synced · 3 came down* is the feedback that was missing.

**Every state names a next action** (or says explicitly that there is none) —
the user's stated requirement. "Refused" says *reconnect, the credential may
have been rotated*; "unreachable" says *nothing to do, it resumes by itself*.

Ordering inside the rule is itself a decision: an unreachable hub outranks every
count (a stale 75/75 over a dead socket is the exact lie being removed), and a
refusal outranks a partially-healthy count (3 of 75 refused still means 3
canvases going nowhere, and only the person can change that).

## Alternatives rejected

**A dedicated "Connect Run" sheet** — a persisted job record with a per-document
ledger and a confirmed round trip. The stronger design, and the right model if
this recurs. Rejected now because it adds a fourth consumer to a payload whose
three existing readers already disagreed; fixing the disagreement is the
prerequisite, not the sheet. Revisit if ≥2 fresh reports arrive after the honest
note ships, or if first-arrival on an empty folder proves to need its own
surface.

**Rendering the existing signal faster** (a spinner, a progress bar on the
modal). Explicitly rejected: it makes a wrong answer more convincing. This is
why the work opened with a falsifier test rather than with UI.

## Consequences

- The status bar now shows `connecting…` briefly on every healthy boot where it
  previously showed `synced` immediately. That is the honest reading, and it is
  the cost of the seed change.
- `pulled` is a **renamed** snapshot field. It was introduced days earlier in
  `231ead01` and has no consumer outside `connection-state.ts` and `index.ts`,
  so no compatibility shim is warranted — but the rename is a payload change and
  `_sync.json` readers should be checked before assuming otherwise.
- The presentation rule is imported into the client bundle, so touching it
  requires a release-minified rebuild of `dist/client.bundle.js`.

## Evidence

- Falsifier: `apps/studio/test/sync-connect-honesty.test.ts` — red before the
  monitor changed, for the two documented reasons.
- Surface rule: `apps/studio/test/sync-presentation.test.ts`.
- The sentence: `apps/studio/test/cloud-connect-note.test.ts`.
- End to end: `apps/desktop/e2e/scenarios/cloud-attach.e2e.ts` cases 7 and 8.
- Plan: `.ai/plans/feature-cloud-connect-honest-status.md`.

## Amendment — the adversarial pass (2026-08-07)

A defender + attacker review of this change found that an honesty module has a
failure mode ordinary features do not: **every defect in it is a lie told
confidently.** Six were fixed before landing, and two are worth stating as
principles rather than as patches.

**Fail closed.** `synced` was the fall-through branch, so any payload shape the
module did not recognise — `docs: {}`, a partial write, a newer producer — took
the *most reassuring* path and rendered "all NaN canvases", green. `/_sync-status`
is `JSON.parse` of a file with no schema. Counts are now validated as three
finite non-negative integers and the unreadable case renders as such. **For this
module the pessimistic branch must be the default; `synced` has to be a positive
assertion.**

**Ordering is a security property.** The offline branch sat above the refused
branch, so a hub could refuse auth on the documents it wanted silenced, drop the
sockets, and have us say "your edits are safe and queued — nothing to do". That
is the exact bug this DDR exists to remove, re-entering one branch up. A
refusal never self-heals, so it outranks everything, including unreachability.

**And the fix's own convenience knob was a supply-chain hole.** `MAUDE_DIST_DIR`
was added so a test would stop clobbering `dist/`. Unguarded, one environment
variable in a release runner sends every artifact to a scratch directory, exits
0, and leaves packaging shipping the previously committed bundles while
`check-runtime-bundles.sh` and `check-client-boots.mjs` validate the stale files
and pass — a silent downgrade with no diff and no red CI. It is now refused
outside a dev build. **A test-only override in a release script needs a guard at
the moment it is written, not later.**

Known and NOT fixed, deliberately: a hub that completes every handshake and then
silently stops acknowledging updates still reads "synced", because the demotion
keys on socket status and a ping keeps a socket alive. The obvious fix — gating
on `lastSyncAt` freshness — is wrong: that timestamp advances on sync *activity*,
so every idle project would start reporting stale. A correct fix needs an
out-of-band liveness round trip. Full triage, including the pre-existing
`aggregate()` first-match and the `admitCanvases` bypass on pulled targets, in
`.ai/logs/security-reviews/feature-cloud-connect-honest-status.md`.
