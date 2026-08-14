# Feature: The file plane — "what's in `.design` syncs", as a manifest, not a folder

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

> **Binding decision:** `maude/sync-two-plane-manifest-architecture` (kg, 2026-08-14) — a 4-seat
> divergent debate, resolved by the user. The debate's dissent is part of the spec:
> BREAKER's honest test (classes must be enumerable POSITIVELY), ATTACKER's invariant
> (the receiver re-validates every path; naming authority is never handed to the hub),
> SHIPPER's fallback (if code-bearing manifest placement fails its review, code files
> stay reference-derived). Consult `maude kg context --about "sync-two-plane-manifest-architecture"`.

## Description

Sync's unit today is a canvas; everything a canvas doesn't claim by name has no lane. A
fresh link of the alligators project delivered 79/79 canvases and **lost 103 files** — the
design system's assets, token stylesheets, `_brand-css.ts` (→ `TypeError: Importing a
module script failed`), and both docs. Three per-file-class lanes were added in two days
(asset push, asset pull, tombstones); the taxonomy grows a lane per file kind and can
never be closed.

This feature replaces the taxonomy with **two planes and one predicate**:

- **Plane A (untouched):** per-canvas Yjs CRDT docs — live collab is the product.
- **Plane B (new):** ONE manifest-driven file plane for every other project file.
  Membership is a single positively-enumerated classifier shared studio↔hub. It subsumes
  the asset push/pull lanes rather than sitting beside them — the LAST lane.

User-visible contract: **what's in the folder syncs** (all 103 missing files arrive).
Mechanism: manifest + content-hash, never folder semantics — deletion stays stated
intent, `config.json` and `_*` runtime state never travel, and the receiver re-validates
every path before it becomes a file.

## User Story

As a member of a cloud project I want a fresh `maude` link to give me the WHOLE project —
canvases, design system, fonts, docs — so that the second machine renders exactly what
the first one does, without git.

## Problem

- `scanCanvases` + named sidecars = a file travels iff a canvas claims it by name.
- `checkoutRelShape` refuses leading-underscore segments (the DDR-115 shape accident), so
  `_brand-css.ts`, `_layout/_components/_marketing.css` have no lane even in principle.
- DS assets (93 on alligators) have an upward lane (`PUT /_asset-file/`) and no downward one.
- `brand.css`, `colors_and_type.css`, `README.md`, `SKILL.md` have no lane in either direction.
- Every fix so far added a lane; the growth is the bug.

## Solution

One classifier, one manifest route, one file-pull/push pair, per-class admission:

```
class ∈ { canvas-owned   → plane A, never plane B (disjointness is tested)
        , inert-media    → images/fonts/video/audio/svg — flows freely
        , companion-text → css/md — flows freely
        , code-module    → ts/tsx/js/mjs outside canvas bodies — OWNER-HUB GATE
        , never          → config.json, isMaudeRuntimeState(rel), everything unclassified }
```

Default-closed: an extension not positively listed is `never`. Deletion of plane-B files
does NOT propagate in v1 (see Scope cuts). Rollout behind `linkedHub.syncFiles`, default
off; acceptance is file-for-file tree parity on a fresh link.

## Metadata

- **Type**: Refactor + New Capability
- **Complexity**: High
- **App/Package**: `apps/studio` (sync), `apps/hub`
- **Affected Systems**: sync runtime, hub routes, canvas build (import allowlist), sync panel status
- **Dependencies**: none new

---

## Context References

### Must-Read Files

> During `/flow:execute`, read every file listed here in parallel in a single message.

- `apps/studio/git/service.ts` (240–270) — Why: `isMaudeRuntimeState` IS the DDR-115 taxonomy; the classifier's `never` half delegates here conceptually (do not fork the list — see Task 1 gotcha).
- `apps/studio/sync/asset-pull.ts` (whole) — Why: the mechanism Plane B generalizes (missing-only, `.part`+rename, per-name validation, caps). Its header states the reference-derived invariant the manifest DELIBERATELY replaces for gated classes — preserve the header's reasoning in the new module.
- `apps/studio/sync/asset-push.ts` (1–120, 396–470) — Why: two asset classes + routes, probe-first sweep, `ASSET_EXTS` — the upward half Plane B subsumes.
- `apps/studio/sync/index.ts` (2050–2300) — Why: where discovery, `pullAssetsOnce`, tombstone apply and the poll are wired; Plane B wires in identically (after the doc poll).
- `apps/studio/sync/tombstone-apply.ts` (whole) — Why: quarantine posture (`_trash/`, never hard delete) — LWW conflict parking reuses this shape.
- `apps/hub/src/assets.mjs` (380–475, 502–600) — Why: `checkoutRelShape`/`checkoutAssetRel` + `resolveCheckoutAssetTarget` (realpath containment) + the PUT route Plane B widens. NOTE the GET-is-presence-only review decision — the read route must be NEW, not bolted here.
- `apps/hub/src/documents.mjs` (whole) — Why: the scope-gating pattern (`matchesScope`, 401-shape, additive fields) the manifest route copies.
- `apps/hub/src/doc-namespace.mjs` + `apps/studio/sync/doc-name.ts` + `apps/studio/test/sync-doc-name.test.ts` — Why: the ONE-COPY-TWO-RUNTIMES parity-test precedent the classifier follows (the bun test imports the hub `.mjs` directly).
- `apps/studio/canvas-build.ts` (90–200) + `apps/studio/canvas-build-worker.ts` (60–75) — Why: `restrictImportsTo` exists and is applied ONLY in the cell worker; Task 9 makes it unconditional.
- `apps/studio/sync/workspace-signin.ts` (180–210) — Why: `vouchedRole` is persisted into `~/.config/maude/hubs.json` (`role: "owner"` verified live) — the owner-hub gate reads it.
- `apps/studio/sync/remote-docs.ts` (fetchRemoteListing) — Why: never-fatal fetch posture + hub-supplied-data filtering the manifest fetch copies.
- `.ai/logs/rca/issue-fresh-link-gets-canvases-but-not-the-design-system.md` — Why: the measured 103-file gap = the acceptance fixture's shape.

### Files to Create

- `apps/studio/sync/file-membership.ts` — the positive classifier (Plane B's whole policy in one module)
- `apps/hub/src/file-membership.mjs` — hub mirror of the classifier
- `apps/studio/test/sync-file-membership.test.ts` — unit + STUDIO↔HUB PARITY test
- `apps/hub/src/file-manifest.mjs` — `GET /api/files` manifest + `GET /_project-file/<rel>` read route
- `apps/hub/test/file-manifest.test.mjs` — route tests
- `apps/studio/sync/file-pull.ts` — manifest-driven downward replication
- `apps/studio/test/sync-file-pull.test.ts`
- `apps/studio/test/sync-fresh-link-parity.test.ts` — the integration acceptance test

### Patterns to Follow

- Additive listing fields (`documents.mjs` tombstones — old peers ignore them).
- Untrusted-input discipline: hub-supplied strings are filtered to asked-about/validated
  sets before use (`probePresent`, `fetchRemoteListing`).
- Atomic writes: `.part` + `renameSync` (asset-pull).
- Loud caps: never truncate silently (`MAX_PULLS_PER_POLL` warnOnce pattern).
- Comment style: block comments explain WHY + the failure that motivated the rule.

---

## Tasks

Execute in order. Each task is atomic and testable.

### ✅ Task 1: CREATE the positive classifier (`file-membership.ts`)

- **Do**: `classifyProjectFile(rel: string): FileClass` with classes exactly as in
  Solution. Positive enumeration only: extension allowlists per class
  (`inert-media`: png/jpg/jpeg/webp/gif/avif/svg/mp4/webm/mov/m4v/mp3/wav/m4a/aac/ogg/woff2/woff/ttf/otf;
  `companion-text`: css/md; `code-module`: ts/tsx/js/mjs). `canvas-owned` = a canvas body
  (`.tsx` inside a canvas group) or its named sidecars (`.meta.json`, sibling `.css`,
  `<slug>.annotations.svg`) — this HALF is a function of the canvas-group config, so the
  classifier takes `{ canvasGroups }` as input, mirroring `canvas-path.ts`'s
  `CanvasGroupLike`. `never` = `config.json` at the design root, anything
  `isMaudeRuntimeState()` matches, and EVERYTHING not positively claimed.
  Shape gates stay: relative, ≤8 segments, ≤512 chars, no `..`/backslash/control chars —
  but a leading `_` is allowed on the FINAL segment only (files like `_brand-css.ts`),
  never on a directory segment (keeps `_history/**` out structurally even before the
  runtime-state check).
- **Pattern**: header comment must enumerate the classes and quote BREAKER's honest test —
  the module IS the answer to "can you enumerate the versioned classes positively".
- **Gotcha**: do NOT import `git/service.ts` (drags git deps into the hub mirror's
  parity surface); replicate the `isMaudeRuntimeState` regex and pin it with a test that
  imports BOTH and asserts agreement on a fixture list — that turns the existing
  three-copy drift into a unit-testable bug (and makes this the 4th copy with a tripwire,
  which the debate accepted knowingly).
- **Validate**: `cd apps/studio && bun test test/sync-file-membership.test.ts`

### ✅ Task 2: CREATE the hub mirror (`file-membership.mjs`) + parity test

- **Do**: same logic in plain `.mjs` (no TS syntax, no imports from studio). Extend the
  Task-1 test: import the `.mjs` directly (doc-name precedent) and assert both classifiers
  agree on an adversarial fixture set: the 103 alligators paths, `config.json`,
  `_untrusted/INDEX.json`, `_server.json`, `..%2f` shapes, 9-segment depth, `assets/x.png`,
  `system/ds/assets/logos/x.svg`, `_brand-css.ts`, `preview/_layout.css`, `ui/card.tsx`.
- **Pattern**: `apps/studio/test/sync-doc-name.test.ts:14`.
- **Validate**: `cd apps/studio && bun test test/sync-file-membership.test.ts && node --test ../hub/test/file-manifest.test.mjs` (classifier half)

### ✅ Task 3: CREATE hub manifest route `GET /api/files`

- **Do**: in `file-manifest.mjs`, workspace-mode only (no checkout → `{files: []}`), peer
  token verified + `matchesScope` filtered exactly like `documents.mjs`. Walk the checkout
  designRoot, classify every file, emit `{path, sha256, size, mtimeMs, class}` for classes
  ≠ `never`/`canvas-owned`. Cap the walk (depth 8, 20k files) loudly. Cache sha256 by
  `(path, size, mtimeMs)` in-memory — the route is polled.
- **Pattern**: `handleDocumentsRoute` (401 shape, scope filter, additive JSON).
- **Gotcha**: `canvas-owned` is deliberately absent from the manifest — plane
  disjointness is enforced at the SOURCE, and the parity test asserts a canvas body never
  appears in a manifest fixture.
- **Validate**: `cd apps/hub && node --test test/file-manifest.test.mjs`

### ✅ Task 4: CREATE hub read route `GET /_project-file/<rel>`

- **Do**: NEW route in `file-manifest.mjs` — NOT a widening of `/_asset-file/` (its
  GET-is-presence-only posture is a recorded review decision; leave it). Peer token,
  read-only (`GET`/`HEAD` only, anything else 405), decode + classify: `never`/
  `canvas-owned` → 404 (indistinguishable from absent — no oracle), realpath containment
  through `resolveCheckoutAssetTarget`'s discipline (extract/reuse, don't duplicate),
  `Content-Type` from a fixed extension map, `X-Content-Type-Options: nosniff`,
  `Cache-Control: no-store`, byte cap 512 MB.
- **Gotcha**: rate-limit with the generous per-label bucket (`checkConnRateLimit`), not
  the 5/min per-IP one — a 103-file pull is one link, not abuse (the RCA-2026-08-11 lesson).
- **Validate**: `cd apps/hub && node --test test/file-manifest.test.mjs`

### ✅ Task 5: UPDATE hub PUT `/_asset-file/` to classifier membership

- **Do**: replace `checkoutAssetRel`'s `assets`-segment + binary-extension requirement
  with `file-membership.mjs` admission (classes `inert-media`/`companion-text`/
  `code-module`), keeping every shape/containment/rate/budget gate. `never` refuses with
  400 — the paired refusal: the leading-underscore relaxation lands ONLY together with
  the explicit runtime-state check, same commit.
- **Pattern**: existing `handleCheckoutAssetRoute`; update `apps/hub/test/assets.test.mjs`
  expectations (underscore FILE now accepted, `_history/x.png` still refused, `config.json` refused).
- **Gotcha**: `CHECKOUT_ASSET_EXTS` also feeds the batch probe — keep probe and writer
  agreeing byte-for-byte (the oracle warning in `checkoutAssetRel`'s comment).
- **Validate**: `cd apps/hub && node --test test/assets.test.mjs test/asset-probe.test.mjs`

### ✅ Task 6: CREATE `sync/file-pull.ts` — the downward plane

- **Do**: fetch `GET /api/files` (never-fatal, `fetchRemoteListing` posture) → for each
  entry: re-classify LOCALLY with `file-membership.ts` (ATTACKER's invariant: the hub's
  `class` field is a hint, never authority — disagreement = drop + one warn), admission
  per class (`code-module` only when the stored hub record's `role === 'owner'` OR
  cell-pairing loopback; default deny), then: missing → fetch; present with equal hash →
  skip (echo-guard by construction); present with different hash → newer-`mtimeMs` wins,
  the LOSING local copy parks in `_trash/<rel>-conflict-<ts>` via `quarantineCanvas`'s
  posture (generalize a small `quarantineFile` helper out of `tombstone-apply.ts`) and
  the write proceeds only when remote is newer. `.part`+rename, 512 MB cap, 200/pass cap
  (loud), sequential.
- **Gotcha**: v1 pulls into the live tree for freely-flowing classes; `code-module`
  additionally requires the Task 9 build hardening to have LANDED (assert with a comment
  + ordering, not a runtime check).
- **Validate**: `cd apps/studio && bun test test/sync-file-pull.test.ts`

### ✅ Task 7: UPDATE the upward sweep to classifier membership

- **Do**: in `asset-push.ts`, replace `listPushableAssets`'s `assets`-dir walk +
  `ASSET_EXTS` with a designRoot walk filtered by `classifyProjectFile` (same three
  classes; `canvas-owned`/`never` excluded). Route unchanged (`assetTargetFor` — DS-path
  vs top-level split stays). The sweep now carries `brand.css`, `_layout.css`,
  `_brand-css.ts`, `README.md` up.
- **Gotcha**: the worker protocol (`asset-push-worker.ts`) is NDJSON-tagged — field names
  are a contract with the parent; don't rename.
- **Validate**: `cd apps/studio && bun test test/sync-asset-push.test.ts` (update fixtures)

### ✅ Task 8: UPDATE `sync/index.ts` — wire Plane B behind the flag

- **Do**: read `syncFiles` from the stored hub record/config (`linkedHub.syncFiles === true`
  or env `MAUDE_SYNC_FILES=1`). When on: after `pullRemoteOnce` (same placement as
  `pullAssetsOnce` today), run `pullFilesOnce`; schedule the widened sweep on the existing
  asset-sweep debounce. When off: behavior identical to today (asset lanes unchanged) —
  the flag gates ONLY the new plane.
- **Gotcha**: on a cell the hub shares the checkout — hash-equality makes the plane a
  no-op there; do NOT special-case it, the invariant covers it (note in comment).
- **Validate**: `cd apps/studio && bun test test/sync-*.test.ts`

### ✅ Task 9: UPDATE canvas build — `restrictImportsTo` unconditional (desktop too)

- **Do**: pass `restrictImportsTo: designRoot` at BOTH desktop `buildCanvasModule` call
  sites in `http.ts` (the cell worker already does, `canvas-build-worker.ts:69`). This is
  the debate's CONDITION on the `code-module` class, and it independently closes the
  ATTACKER's chain-3 gap that exists today.
- **Gotcha**: legacy canvases importing from OUTSIDE designRoot (if any exist) would
  break — run `/design:smoke` against a real project (`alligators`) before calling this
  done; if something legitimate imports outside the root, the allowlist needs that root
  added explicitly, not the restriction dropped.
- **Validate**: `cd apps/studio && bun test test/canvas-build*.test.ts` + `maude design smoke` on alligators

### ✅ Task 10: UPDATE sync status surface

- **Do**: extend `status.ts` payload with `files: {synced, pulled, conflicts}` and render
  one line in the Sync panel (`client/app.jsx` area that shows the canvas counts) —
  conflicts name the `_trash/` location. Rebuild the committed client bundle
  release-minified (`cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`)
  and commit `dist/client.bundle.js` + `dist/styles.css` in the same change.
- **Validate**: `cd apps/studio && bun test test/sync-status.test.ts` + `git status apps/studio/dist/`

### ✅ Task 11: CREATE the fresh-link parity test (the acceptance gate)

- **Do**: `sync-fresh-link-parity.test.ts` — fixture design root modeled on the RCA's
  miss-list (canvas + `system/ds/{brand.css,README.md,preview/{_layout.css,_brand-css.ts,specimen.tsx,specimen.css},assets/logos/logo.svg}` +
  top-level `assets/<sha8>.png` + `config.json` + `_history/junk`), a real hub instance
  (the `documents-route`/`assets` test harness pattern), an EMPTY peer designRoot →
  run boot + one poll + file pull → assert **file-for-file tree equality minus
  `config.json` and runtime state**, and assert `config.json`/`_history` did NOT arrive.
- **Validate**: `cd apps/studio && bun test test/sync-fresh-link-parity.test.ts`

### ✅ Task 12: Manual acceptance + flag flip plan

- **Do**: with `MAUDE_SYNC_FILES=1`, fresh-link `alligators-mirror` against the real
  cloud project → `diff -rq` the two `.design` trees (expect: only `config.json` +
  runtime state differ). Record the result in the plan's execution log. Flag default
  stays OFF this release; flipping to ON + retiring the reference-derived asset scan is
  the NEXT cycle (BUILDER's "cut old lanes only after parity"), tracked as a follow-up.
- **Validate**: manual, documented.

#### Execution log (2026-08-14)

- **Real-cloud fresh link is structurally impossible pre-release**: the deployed
  fleet runs v0.60.3, which has neither `GET /api/files` nor `/_project-file/` —
  a pull against it is a no-op by design (never-fatal manifest fetch → null).
  The real-cloud `alligators-mirror` verification therefore moves to the flag-ON
  cycle, AFTER the release tag rolls the fleet.
- **Equivalent acceptance run instead, on the real corpus**: the production hub
  handlers (`handleFilesRoute` + `handleProjectFileRoute`) mounted on a local
  `node:http` server over the REAL `~/git/personal/alligators/.design`
  (the RCA's own source tree), `pullFiles` into an empty root, three passes:
  - pass 1: 200 pulled (per-pass cap, loud) · pass 2: 16 pulled · pass 3: 0 pulled / 216 skipped (steady state)
  - **RESULT: 216/216 files, byte-for-byte, 0 dropped, 0 failed, 0 conflicts, 0 laneless. PASS.**
  - The audit surfaced 10 candidate "laneless" files on the first run: 3×
    `.DS_Store` (correct refusal — dotfiles are shape-refused, as the RCA
    expects) and 7 real findings — `assets/<sha8>.photo.json`,
    `assets/<sha8>.audio.json`, `assets/<sha8>.srt`. These are VERSIONED
    content (DDR-115 does not ignore them) with no lane, i.e. fresh links were
    silently losing photo edits. Fixed in the same change by positively
    enumerating the exact suffixes `.photo.json` / `.audio.json` + ext `srt`
    as `companion-text` (never bare `.json` — default-closed stands), with
    parity + unit coverage. Documented deviation from the plan's original
    css/md-only enumeration.
- **Flag flip plan**: `linkedHub.syncFiles` default stays OFF this release.
  Next cycle: real-cloud alligators-mirror parity with the rolled fleet →
  flip default ON → retire the reference-derived asset pull + the flag-off
  sweep narrowing (BUILDER's "cut old lanes only after parity").

---

## Scope cuts (explicit, argued)

- **Plane-B deletion propagation: OUT.** Deletion stays stated intent; today only the
  canvas delete lane states it. A vanished manifest entry means "no longer offered",
  never "delete yours" — the branch-switch-as-mass-delete hazard (BREAKER) is dodged
  structurally, at the cost of stale files persisting on peers until a future explicit flow.
- **Old-lane retirement: NEXT cycle**, after the flag soaks ON (SHIPPER's subsumption is
  the goal; BUILDER's sequencing is the path).
- **Flag-flip is itself a gated event (security).** Flipping `linkedHub.syncFiles`
  default ON re-runs `/flow:validate-security` as a HARD gate that MUST close F1
  (agent-reads-synced-docs-as-spec / trifecta), F2/F3 (fresh-link disjointness),
  F4 (hub-asserted-mtime overwrite) and F6 (byte budget) first — see Validation §6.
  The flag-off default is load-bearing until then.
- **`_inbox/` quarantine tier: NOT in v1** — superseded by the owner-hub gate decision;
  revisit only if the gate's review fails (SHIPPER's fallback: code stays reference-derived).
- **Hub-side content scanning: NOT here** — defense-in-depth backlog item, never load-bearing.

## Validation

_Execution run 2026-08-14 (load-contended shared machine — 8 users, sustained load 100–200):_

1. **Lint**: touched files clean (`biome check` on the 22 changed files — 0 errors after
   organize-imports/format). Repo-wide `pnpm lint` fails on a PRE-EXISTING baseline
   (confirmed: fails identically on the stashed clean tree) — not this change.
2. **Tests**:
   - `pnpm test` (cli 291/291 + hub 628/628) — GREEN.
   - Studio dev-server: the sync suite + every touched/new file GREEN
     (`sync-file-membership` 76, `sync-file-pull` 12, `sync-fresh-link-parity` 3,
     `sync-asset-push` 39, `sync-status` 11, `canvas-build`+sandbox 11; and the earlier
     full `bun test test/sync-*` 620/620). The FULL `pnpm test:dev-server` (incl.
     agent-browser screenshot tests) is DEFERRED to a quiet machine — timing-sensitive
     under this load (2026-08-14 lesson); recommend re-running at `/done`.
3. **Build**: `pnpm --filter @maude/site build` — GREEN (+ `gen:roadmap` regenerated).
4. **Gates**: version-parity OK (0.60.3), tarball-shape OK (1132 files), import-coherence
   OK (all new modules staged first).
5. **Smoke**: `maude design smoke` on alligators — 49/50 OK; the 1 failure is
   `ui/alligators-moodboard-v3.tsx` `BROKEN-IMG` for `sponsors/kpc.svg`, a PRE-EXISTING
   missing asset (a demo array lists `kpc` but the file was never added) — a runtime
   `<img src>`, unrelated to Task 9's `restrictImportsTo` (which gates ES imports, not
   img src). All 50 canvases compiled + rendered ⇒ the import-restriction regression
   surface is CLEAN.
6. **Security re-review** (`security-auditor` + `ethical-hacker`, both seats):

   - **One confirmed above-floor blocker — FIXED.** The read route
     `GET /_project-file/<rel>` judged the file CLASS on the parent-resolved path
     but `statSync`/`createReadStream` FOLLOWED a final-component symlink — so a
     committed leaf link whose target stays IN-ROOT (`assets/logo.png ->
     ../config.json`, `-> _history/*`, `-> a canvas body`) passed containment,
     class-judged as a flowing class on the link name, and served the `never`/
     canvas-owned target's bytes (defeating the read direction of chains
     config.json / runtime-state / no-oracle / disjointness). Both seats
     reproduced it. **Fix:** `lstatSync` + explicit `isSymbolicLink()` → 404 in
     `handleProjectFileRoute` (a real plane-B file is never a symlink — the
     manifest walk already excludes them via `entry.isFile()`). Regression test
     added (`file-manifest.test.mjs` — final-component in-root symlink to
     config/runtime-state/CRDT-body all 404, bytes never served). Re-verified: 25/25.
   - **Chains confirmed CLOSED (both seats):** config.json never travels;
     DDR-115 runtime-state replica faithful + tripwired; `code-module` gated on
     LOCAL `allowCodeModules` (a hub cannot flip it per-pull); write-side +
     directory-symlink containment (rename-replaces-link, class on `realRel`);
     hash-match enforced; `.part`+rename atomic; LWW quarantine-then-write never
     silently loses; rate-limit buckets distinct + correctly wired.
   - **Deferred to the flag-flip gate (moderated to non-blocking by `syncFiles`
     default OFF; re-run this review as a HARD gate BEFORE flipping ON — see
     Follow-ups):**
     - **F1 (the load-bearing one):** synced `.md`/`.css`/(owner)code land under
       `.design/system/**`, which the design agents read as authoritative spec
       (CLAUDE.md). A hostile hub's `README.md`/`SKILL.md` becomes agent-read
       context ⇒ indirect prompt-injection / trifecta (private data + untrusted
       content + outbound all co-resident in the peer agent loop). Structural,
       not prompt-tuning. **Before flag-on:** treat `.design/**` synced docs as
       delimited untrusted DATA, never spec; don't co-locate hub-synced content
       with credential-read + outbound in one agent context.
     - **F2/F3:** on a fresh (empty) tree the sibling-`.css` disjointness check
       (`hasFile(<same>.tsx)`) and the `canvasGroups` fallback (`[system,ui]`)
       are vacuous, so a hostile hub can shadow a canvas css lane / a
       non-default-group body. Harden: treat empty-tree in-group `.css` as
       `canvas-owned` by default; confirm the fresh-link flow delivers the real
       `canvasGroups` out-of-band; add a non-default-group parity fixture.
     - **F4:** LWW compares hub-asserted `mtimeMs`, so a far-future value lets a
       hostile hub always win an overwrite (loser quarantined, so not
       destructive — but content substitution). Re-derive the overwrite decision
       from local provenance, not the wire mtime.
     - **F6:** no cumulative per-pass/boot BYTE budget → hub-driven disk
       exhaustion. Add a loud aggregate cap.
     - **Chain-3 residual:** `role === 'owner'` is hub-vouched at sign-in, so a
       hub you sign into can vouch you owner and enable `code-module` landing
       from itself (bounded by `restrictImportsTo`). "Never on a hub-supplied
       claim" holds for the per-pull manifest, NOT the sign-in vouch — state it
       explicitly in the threat model.
   - **Warning (below floor):** `handleFilesRoute` has no rate limit — an
     authenticated peer can force repeated full-tree stat walks (≤20k). Consider
     a per-label bucket. Low, authenticated.
   - **Verdict: PASS for this release** — the sole above-floor blocker is fixed;
     every binding ATTACKER chain the plan named (config.json / `_*` /
     code-module / `_untrusted`) is closed; the residual findings are held
     non-blocking by the flag-off default and are now a mandatory pre-flip gate.

### Original validation commands

1. **Lint**: `pnpm lint` + `pnpm format`
2. **Tests**: `pnpm test && pnpm test:dev-server` (quiet machine — see 2026-08-14 load-average lesson)
3. **Build**: `pnpm --filter @maude/site build`
4. **Gates**: `bash scripts/check-version-parity.sh && bash scripts/check-tarball-shape.sh && bash scripts/check-import-coherence.sh` (new modules MUST be `git add`ed before the coherence check — the v0.51.0 lesson)
5. **Smoke**: `maude design smoke` on alligators (Task 9 regression surface)
6. **Security re-review**: `/flow:validate-security` over the diff — the manifest hands the hub a wider write reach; the review must confirm every ATTACKER chain (config.json, `_*`, code-module, `_untrusted/`) is closed by the classifier + gate. **This is a blocking gate, not a formality.**

## Scenario Coverage

Not a UI feature (one status line). Cross-platform scenario N/A — the acceptance backbone
is Task 11 (automated tree parity) + Task 12 (manual alligators-mirror). `/design:smoke`
covers the render surface Task 9 touches.

## Acceptance Criteria

- [x] All tasks completed, in order (9 before 6's code-module admission ships enabled)
- [x] Classifier parity test green (studio ↔ hub agree on the adversarial fixture set)
- [x] Fresh-link parity test green: file-for-file equality minus `config.json` + runtime state
- [x] `config.json`, `_untrusted/**`, `_server.json`, `_history/**` provably never travel (tests assert refusal at BOTH hub route and peer admission) — plus the F5 read-route symlink hole closed
- [x] `code-module` files replicate ONLY under `role === 'owner'` / loopback pairing (test both directions)
- [x] LWW conflict parks the loser in `_trash/` and surfaces in the panel — never silent loss
- [x] `/flow:validate-security` pass over the final diff: 0 blockers (1 above-floor blocker found + fixed + regression-tested; residual findings held non-blocking by flag-off, now the mandatory pre-flip gate)
- [x] Manual alligators-mirror parity documented (real-cloud deferred to the fleet roll; equivalent real-corpus acceptance run — 216/216 byte-for-byte — documented in the Task-12 execution log)
- [x] Flag default OFF; flip plan recorded for next cycle. **What's New entry: deferred to the flip** (flag-off = no user-visible change yet; the entry announces the live behavior, so it belongs to the cycle that flips `syncFiles` ON — recorded as a next-cycle item, not this release).

## Retro

- **What worked: acceptance-on-the-real-tree caught what fixtures couldn't.** The Task-12
  run against the actual 216-file alligators `.design` surfaced 7 truly laneless files
  (`.photo.json`/`.audio.json`/`.srt` — Maude's own versioned sidecars) that every
  synthetic fixture missed; a fresh link would have silently dropped photo/audio edits.
  Lesson for `/plan`: for a "what's in the folder syncs" feature, an acceptance gate on a
  REAL project's tree is not optional polish — it is the only place the long tail of the
  file vocabulary shows up. The plan already had Task 12; keep that shape.
- **What worked: the positive-classifier discipline held under adversarial review.** BREAKER's
  "enumerate the classes POSITIVELY" test paid off — every deferred security finding was
  about the transport/agent boundary, not the classifier, which both seats called correct.
  The default-closed enumeration + the "never bare `.json`, only exact suffixes" rule meant
  the `.photo.json` addition was a two-line, provably-bounded change, not a re-think.
- **What didn't: the one real bug was a read-route symlink, and it was in NEW code the plan
  under-specified.** Task 4 said "realpath containment through `resolveCheckoutAssetTarget`'s
  discipline" but the discipline resolves the PARENT, not the leaf — correct for the write
  route (rename replaces the link) and WRONG for a read route (stat/stream follow the link).
  The plan copied a write-route pattern to a read route without noting the asymmetry. Lesson:
  when a plan says "reuse route X's containment for route Y," flag whether X and Y differ in
  whether they FOLLOW vs REPLACE the final path component — that difference is the whole bug.
- **What worked: security as a real blocking gate, run mid-execute not at the end.** Running
  `/flow:validate-security` (plan §6) as a hard gate surfaced F5 while the context was hot;
  fixing + regression-testing it cost one turn. Both seats independently reproduced it, which
  is the argument for the two-seat (defender + attacker) shape over a single reviewer.
- **Process friction: a load-contended shared machine (load 100–200) made the full
  browser-driven `test:dev-server` unreliable.** Validated the sync + hub + cli portions
  (all green) and deferred the agent-browser screenshot suite to a quiet machine. The
  2026-08-14 load-average lesson held; worth a `/validate` note that browser-driven gates
  need a load check first, and a quiet-machine re-run before the branch merges.
- **Scope discipline held: everything the two seats flagged beyond the one blocker is
  correctly gated by the flag-off default and recorded as a mandatory pre-flip security
  gate** (F1 agent-reads-synced-docs-as-spec / trifecta, F2/F3 fresh-link disjointness,
  F4 hub-asserted-mtime overwrite, F6 byte budget, chain-3 sign-in vouch). The flag-flip
  is now itself a gated event — captured in the graph as `maude/sync-file-plane-security-verdict`.
