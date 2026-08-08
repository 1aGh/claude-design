# Feature: sync carries the path, so a project arrives whole

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

A canvas syncs. Its **location** does not. The document name is a flattened slug
(`ui/2026/social/summer-camp.tsx` → `ui-2026-social-summer-camp`), and `/` → `-`
is not reversible — so the receiving side cannot know where the file belongs and
writes it flat, or not at all.

This adds the real relative path to the document as sync-internal metadata,
validates it as hostile input on arrival, and uses it on **both** receivers (the
studio's pull-down and the hub's workspace agent). A project you are granted
access to arrives whole, in the shape its author gave it, in both directions.

## User Story

As someone who edits a project on the desktop and opens it in the cloud (or the
reverse, or on a second machine), I want every canvas to appear on the other side
**in the folder I put it in**, so that connecting a project means getting the
project rather than getting most of it plus a mystery.

## Problem

### Observed, on the live fleet (2026-08-07, `alligators` ↔ `alligators.cloud.maude.sh`)

The hub holds **76 documents**; the cell's design root holds **71 `.tsx` files**.
Three canvases the desktop created are on the hub with their full bodies —

| document | on the hub |
| --- | --- |
| `ui-2026-social-summer-camp` | 29 971 B (`html` + `syncMeta`) |
| `ui-2026-social-krpole-v-pohybu` | 21 845 B |
| `ui-alligatorsacko` | 32 620 B |

— and appear nowhere in the cloud's file tree, because the tree lists **files**.
Sync did its job; materialisation did not. The desktop's own log agrees it
succeeded: `76/76 synced`.

### Why — the slug is one-way, and both sides know it

Both receivers derive the path from the slug and both give up the same way:

```ts
// apps/studio/sync/remote-docs.ts:150-190
/** Absolute path the body will be written to, flat under the design root. */
//  reason: a slug is lossy, `ui-card` cannot be un-flattened into `ui/Card.tsx`
const bodyAbs = join(designRoot, `${slug}.tsx`);
```

```js
// apps/hub/src/workspace-agent.mjs:192
const bodyRel = pathIndex.get(slug) ?? defaultBodyPath(slug);   // → `<slug>.tsx`, flat
```

`pathIndex` maps slug → path **for files that already exist**. So a canvas in a
folder the receiver already has (`social/`) lands correctly; a canvas in a folder
it does not have (`2026/social/`) has no entry and falls back to flat.

Each side's comment defers to the other. The studio's says a flat file "is
trivially moved". The hub's says "a desktop peer — which knows the real path —
will move it on its next sync". **Neither is a mechanism**; nothing moves it, and
the two comments together describe a hand-off that does not exist.

### And flat is worse than untidy — it is invisible

The file tree and `scanCanvases` both enumerate `config.canvasGroups`
(`system/`, `ui/`). A file written flat at the **design root** is inside no
group, so it is not listed, not scanned, and not synced onward. The fallback
does not produce a tidy-able file; it produces a file nobody can see.

Whether the cell wrote those three flat files or never wrote them at all is
**not yet established** — `countCanvases()` counts the root recursively and
returns 71, which is short of 76 either way. Task 1 settles it by reproduction
rather than by reading.

### The status the user is shown while this happens

`/_sync-status` and `_sync.json` report `0 synced · 73 rejected` (class
`invalid-token`) on a process whose own log says `76/76 synced`, against a hub
that accepts the credential — verified live: a 20-document burst authenticated
with 0 failures, and the ceiling is 600/min. The rejections are carried over
from a previous session and never cleared: `noteDocState(slug, 'connected')`
fires only in the reconcile branch of the first successful handshake, never on a
later reconnect. Meanwhile the status bar shows **HUB SYNC synced**.

So the counters, the log, and the chrome disagree three ways — on the one screen
a person consults to find out whether their work is safe.

## Solution

**Carry the path in the document, treat it as hostile, and make the fallback
visible.**

1. **`syncMeta.path`** — the design-root-relative path of the body, stamped by
   whoever opens the doc for a real local file. `syncMeta` already exists on
   every document (`bodyEditAt` / `by` / `seededBy`), is already synced, and is
   already excluded from disk, so this adds a field to an existing lane rather
   than a lane.

2. **One validator, shared by both receivers.** A dependency-free module both
   the studio (TS) and the hub (`.mjs`) import — the same trick the hub already
   uses for `autocommit.ts` and `mirror.mjs`, and for the reason its Dockerfile
   states: re-typing a guarantee is re-typing it without its tests. A path that
   fails validation falls back to the flat behaviour; it never throws away the
   canvas.

3. **The fallback lands inside a canvas group**, not at the design root, so an
   un-pathed document from an older peer is still *visible* and still syncs
   onward. This is a fix in its own right and it is what makes step 1 safely
   optional.

4. **The empty-folder case works because of 1–3**, plus a check that a freshly
   linked project has the `canvasGroups` the incoming paths need.

5. **Doc state recovers.** A successful (re)connect clears a stale
   `auth-rejected`, and `_sync.json` stops being read back as truth by a new
   process.

### What is deliberately NOT in scope

- **Moving a canvas is already a new document.** The slug derives from the path,
  so a move changes the identity and the old document lingers on the hub. Real,
  pre-existing, and a different feature (garbage-collecting orphaned documents).
  Do not try to solve it here.
- **Renaming `syncMeta` or changing the document name format.** Document names
  are identity; changing them orphans every existing document in every deployed
  hub.

## Metadata

- **Type**: Bug Fix (1–4) + Enhancement (5)
- **Complexity**: High — two runtimes, a wire-format addition, untrusted input
- **App/Package**: `apps/studio/sync`, `apps/hub/src`
- **Affected Systems**: canvas sync, hub workspace agent, cell materialisation, sync status
- **Dependencies**: none new

---

## Context References

### Must-Read Files

> Read all of these in parallel in one message during `/flow:execute`.

- `apps/studio/sync/remote-docs.ts` (whole file, 192 lines) — Why: `pullTargets` (the flat write), `slugFromDocName` (the charset guard to mirror), and the module header stating the bidirectional-completeness promise this plan finishes.
- `apps/hub/src/workspace-agent.mjs` (~line 192, plus how `pathIndex` is built) — Why: the hub's twin of the same decision; the `??` fallback is the cloud half of the bug.
- `apps/hub/src/workspace-files.mjs` (lines 100-135) — Why: `defaultBodyPath`, and the sibling-derivation comment explaining why `.meta.json`/`.css` are siblings but `.annotations.svg` is keyed by flat slug at the root — the path change must not break that asymmetry.
- `apps/studio/sync/codec.ts` (lines 300-370, plus `META_LOCAL_KEYS` ~226) — Why: where `syncMeta` is stamped and read; the local-keys list that keeps sync-internal fields off disk.
- `apps/studio/canvas-slug.ts` (whole file, 30 lines) — Why: the lossy transform itself; the new field must agree with it (`slug(path)` must equal the doc's slug, or the two disagree about identity).
- `apps/studio/sync/index.ts` (`scanCanvases` ~1273, `walk` ~1337, `admitCanvases` ~1183, `handleAuthFailure` ~644, `scheduleReprobe` ~628, the `noteDocState(...,'connected')` at ~732) — Why: the producer side and all of item 5.
- `apps/studio/sync/connection-state.ts` (lines 85-170) — Why: `noteDocState`, the docs rollup, `rejectedSlugs`, and the `_sync.json` persistence that survives a restart.
- `apps/studio/context.ts` (lines 85-95, 260-280) — Why: default `canvasGroups` and `isContainedRel` — the containment predicate that already exists and should be reused, not re-invented.
- `apps/hub/Dockerfile` (lines 51-62) — Why: the COPY list a new shared module must join, and the comment explaining why shared files are copied rather than re-typed.

### Files to Create

- `apps/studio/sync/canvas-path.ts` — the shared, dependency-free path validator + fallback resolver.
- `apps/studio/test/sync-canvas-path.test.ts` — validator unit tests incl. traversal corpus.
- `apps/hub/test/workspace-path.test.mjs` — the hub receiver honours `syncMeta.path`.
- `apps/studio/test/sync-path-roundtrip.test.ts` — the end-to-end law (see Task 1).

### Patterns to Follow

- **A shared guarantee is copied, not re-typed.** `apps/hub/Dockerfile` copies
  `apps/studio/sync/autocommit.ts`, `git/repo-lock.ts` and `apps/cloud/mirror.mjs`
  into the hub image precisely so the rules travel with their tests. The new
  validator joins that list. Do not write a second validator in `.mjs`.
- **Containment predicates already exist.** `isContainedRel` (`context.ts`) and
  the `resolve`/`startsWith(root + sep)` check at the end of `pullTargets` are
  the house style. Reuse them; a third spelling of "is this inside the root" is
  how one of them drifts.
- **Untrusted input is refused at the edge, in one place.** `slugFromDocName`
  validates the WHOLE document name against an explicit charset rather than
  taking its tail — its comment explains why. `syncMeta.path` is the same class
  of input and gets the same treatment.
- **Absent fields are the normal case.** Every sync field is optional on the
  wire; an older peer omits it and must keep working.

---

## Design Decisions

### Why `syncMeta.path` and not the document name

The document name IS identity. Encoding the path into it would orphan every
document in every deployed hub and break the `pathIndex` warm path for canvases
that currently work. `syncMeta` is already synced, already per-document, already
kept off disk, and already optional — an addition there is invisible to every
peer that does not know about it.

### Why the receiver validates rather than trusts

DDR-054 treats hub-pushed content as untrusted, and `remote-docs.ts` already
accepts the trade: *"a hub can create files in your design root … the one guard
kept is containment: a document NAME can never place a file outside the design
root."* A path is a strictly more dangerous input than a slug, so it gets a
strictly stronger check — and on failure it degrades to today's behaviour rather
than dropping the canvas.

### Rejected: derive the path by searching for a matching file

"Find an existing file whose slug matches" is what `pathIndex` already does, and
it is exactly the case that fails — a canvas the receiver has never seen has no
file to match. It cannot fix the new-folder case by construction.

### Rejected: a project-level slug→path manifest document

One extra document, a second write path, and a new class of conflict (two peers
editing the manifest) to carry information each document already knows about
itself. It also fails the empty-folder case until the manifest arrives, adding
an ordering dependency where there is none today.

### Path validation rules (the contract)

A `syncMeta.path` is **accepted** only if all hold; otherwise fall back:

1. Non-empty string, ≤ 400 chars, no NUL or control characters.
2. Relative — rejects `/…`, `\\…`, and a Windows drive (`C:`).
3. Separator is `/` only; no backslashes (a `\` is a legal filename character on
   POSIX and would smuggle a separator past a naive split).
4. No `.` or `..` component; no empty component (`a//b`); no trailing `/`.
5. Every component matches the canvas charset already enforced elsewhere, plus
   `.` for the extension only in the final component.
6. Ends in `.tsx`.
7. **`canvasSlugFromRel(path, designRel)` equals the document's own slug.** This
   is the load-bearing one: it makes a hostile path self-defeating, because a
   path that points somewhere else no longer addresses this document.
8. Resolves inside the design root (`resolve()` + `startsWith(root + sep)`), and
   inside a declared `canvasGroups[].path`.

Rule 7 is why this is safe. The path is not believed because the sender is
trusted; it is believed because it is checked against a value the receiver
derived independently.

---

## Tasks

Execute in order. Tasks 1–6 are the user-visible fix; 7–8 are the honesty fix.

### Task 1: ADD the falsifier — reproduce both halves, and settle what the cell does

- **Do**: `apps/studio/test/sync-path-roundtrip.test.ts` — a two-peer test over
  a real hub (mirror `apps/hub/test/`'s harness): peer A creates
  `ui/2026/social/summer-camp.tsx`, syncs; peer B starts with an EMPTY design
  root, links, pulls. Assert peer B has the file **at the same relative path**.
  Add a second case asserting a canvas whose folder B already has still lands
  correctly (the regression guard for the `pathIndex` warm path).
- **Also**: settle the open question — does the hub's workspace agent write a
  flat file for an unknown slug, or nothing at all? Assert the observed
  behaviour so the fix has a baseline. `countCanvases()` says 71 against 76
  documents, which is consistent with either.
- **Gotcha**: write it against the CURRENT code and expect it to fail. If the
  empty-root case passes today, the diagnosis is wrong — say so, do not adjust it.
- **Validate**: `cd apps/studio && bun test test/sync-path-roundtrip.test.ts` — red.

### Task 2: ADD `apps/studio/sync/canvas-path.ts` — the shared validator

- **Do**: export `validateCanvasPath({ path, slug, designRel, canvasGroups })
  → { ok: true; rel: string } | { ok: false; reason: string }` implementing all
  8 rules above, and `fallbackCanvasPath(slug, canvasGroups)` for Task 4.
  Dependency-free (no `node:path`, no `node:fs`) so both runtimes and the tests
  can use it — take `join`/`resolve`/`sep` as parameters exactly as `pullTargets`
  already does.
- **Pattern**: `slugFromDocName`'s explicit-charset style; `isContainedRel` in `context.ts`.
- **Gotcha**: rule 7 must call the REAL `canvasSlugFromRel`, not a copy — import
  it. A re-typed slug function that drifts turns the whole check into decoration.
- **Validate**: `apps/studio/test/sync-canvas-path.test.ts` — traversal corpus
  (`../`, `..\\`, absolute, UNC, drive letter, NUL, `a//b`, unicode dot-lookalikes,
  a path whose slug ≠ the document's) all rejected; legitimate nested paths accepted.

### Task 3: ADD the producer — stamp `syncMeta.path`

- **Do**: when the runtime opens a document for a canvas that exists on local
  disk, set `syncMeta.path` to its design-root-relative path. Stamp on open and
  whenever the body is written, in the same transaction as `bodyEditAt`.
- **Gotcha**: `META_LOCAL_KEYS` keeps sync-internal keys off disk — `path` is
  sync-internal and must not leak into `.meta.json`. Check `codec.ts:226`.
- **Gotcha**: do NOT stamp for a document pulled down whose path came from the
  wire and was rejected — that would launder an invalid path into the project.
- **Validate**: `cd apps/studio && bun test test/sync-*.test.ts`.

### Task 4: UPDATE the studio receiver — `pullTargets` honours the path

- **Do**: `pullTargets` takes the per-document `syncMeta.path` (read after the
  doc syncs) and resolves the target through `validateCanvasPath`, creating
  parent directories. On rejection or absence, use `fallbackCanvasPath`.
- **Gotcha**: the listing (`GET /api/documents`) carries names and byte counts
  only — the path lives IN the document, so the target can only be resolved
  after that document has synced. Do not try to resolve it from the listing.
- **Gotcha**: keep the existing one-slug-one-target dedupe, and keep the final
  containment check even for a validated path — belt and braces at a create.
- **Validate**: Task 1's empty-root case passes for the studio direction.

### Task 5: UPDATE the hub receiver — `workspace-agent.mjs` honours the path

- **Do**: replace `pathIndex.get(slug) ?? defaultBodyPath(slug)` with
  `pathIndex.get(slug) ?? validated(syncMeta.path) ?? defaultBodyPath(slug)`,
  importing the Task-2 module. Add it to the `apps/hub/Dockerfile` COPY list
  beside `autocommit.ts`.
- **Gotcha**: `pathIndex` still wins — a file that already exists must not be
  relocated by a remote path, or a peer could move another peer's files.
- **Gotcha**: the `.annotations.svg` sidecar is keyed by flat slug at the design
  root and is NOT a sibling (`workspace-files.mjs` explains why, and that the
  wrong guess got committed to a tenant's mirror). Changing the body path must
  not change that.
- **Validate**: `node --test apps/hub/test/*.test.mjs`; Task 1's cloud direction.

### Task 6: FIX the fallback so an un-pathed document is still visible

- **Do**: `fallbackCanvasPath` places a flat file inside the first declared
  canvas group (e.g. `ui/<slug>.tsx`), never at the design root. Apply on both
  receivers.
- **Why**: the tree and `scanCanvases` enumerate `canvasGroups`; a file at the
  root is in none, so today's fallback is invisible AND does not sync onward.
- **Gotcha**: a project with no groups configured — pick the documented default
  (`context.ts:90`) rather than inventing one.
- **Validate**: a document with no `syncMeta.path` (simulating an older peer)
  lands somewhere the tree lists; assert it appears in the canvas listing.

### Task 7: FIX the empty-folder link so the pulled project is listable

- **Do**: when linking a project whose design root has no `config.json`, ensure
  one exists with `canvasGroups` covering the incoming paths before materialising.
- **Gotcha**: do not overwrite an existing config. Additive only.
- **Validate**: Task 1's peer B (empty root) ends with a listable project — assert
  via the canvas listing, not just the filesystem.

### Task 8: FIX the stale doc state and the status that contradicts it

- **Do**: (a) clear a doc's `auth-rejected` on any successful (re)connect, not
  only in the first-handshake reconcile branch; (b) stop treating a persisted
  `_sync.json` as authoritative for a fresh process — rehydrate presentation
  only, never doc verdicts; (c) make the status-bar label read the same rollup
  as the counters, so "synced" cannot appear over `0 synced · 73 rejected`.
- **Pattern**: the v0.57.0 honest-status work (`sync/presentation.ts`) — same
  rule, a path it did not cover.
- **Gotcha**: do not make a genuine `invalid-token` self-heal into silence —
  a rotated credential must still say so. The bug is a stale verdict surviving a
  successful connect, not the verdict existing.
- **Validate**: `cd apps/studio && bun test test/sync-*.test.ts`; then live —
  `curl localhost:<port>/_sync-status` must agree with the process's own log.

### Task 9: REBUILD the committed client bundle — last, and once

- **Do**: only if Task 8(c) touched `client/`. `git status apps/studio/dist/` →
  `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release` →
  `git status apps/studio/dist/` again.
- **Validate**: bundle in the release size range (~2 MB, not ~14 MB).

---

## Validation

1. **Lint**: `pnpm lint`
2. **Tests**: `cd apps/studio && bun test` (never from the repo root) + `node --test apps/hub/test/*.test.mjs` + `node --test scripts/test/*.test.mjs`
3. **Build**: `pnpm --filter @maude/site build`
4. **Interop matrix** (the one that cannot be skipped):
   - new peer → new hub: nested path survives
   - new peer → OLD hub: falls back, canvas still arrives and is visible
   - OLD peer → new hub: no `syncMeta.path`, falls back, nothing breaks
5. **The real test — a live round trip.** Create a canvas in a new nested folder
   on the desktop, confirm it appears in the cloud at the same path. Then link a
   fresh empty folder and confirm the whole project arrives with its structure.

---

## Scenario Coverage

No new cross-platform UI scenario — the behaviour is filesystem + protocol, and
Task 1's two-peer test is the real coverage. Task 8(c) touches the status-bar
label; the existing `statusbar-version` testid pattern is the precedent if a
future scenario needs to reach it.

---

## Acceptance Criteria

- [ ] All tasks completed
- [ ] Task 1's falsifier is green **because the sync changed**, not because the assertions were softened
- [ ] A canvas in a new nested folder appears on the other side at the **same relative path** — both directions
- [ ] Linking a project into an **empty folder** pulls the whole project down with its directory structure, and it is listable
- [ ] No `syncMeta.path` can create a file outside the design root or outside a canvas group — traversal corpus is green, and rule 7 (path must slug back to this document) is enforced
- [ ] An older peer (no `syncMeta.path`) still syncs, and its canvases land somewhere the tree **lists**
- [ ] `pathIndex` still wins for a file that already exists — a remote path never relocates local work
- [ ] `_sync-status`, the process log, and the status bar agree; a stale `auth-rejected` clears on a successful reconnect, while a genuine one still says so
- [ ] `dist/` diff contains only the intended artifacts, verified before and after
- [ ] DDR recorded: the path travels in-band and is believed only because it slugs back to its own document

---

## Retro

- **The falsifier had to move, and that was the first real finding.** The plan
  asked for `apps/studio/test/sync-path-roundtrip.test.ts`; a real hub needs
  `@hocuspocus/server`, which the studio's independent `bun install` (DDR-009)
  cannot reach. Worth a line in a future plan template: before naming a test's
  location, check which workspace can actually import both sides of the seam.

- **A plan can specify a fix that is subtly wrong, and the code will tell you.**
  Task 6 said the fallback should be `ui/<slug>.tsx`. That re-slugs to
  `ui-<slug>` — a SECOND document with the same bytes and the original orphaned
  on the hub. Prefix-stripping (`ui-legacy` → `ui/legacy.tsx`) was the fix, and
  nothing in the plan hinted at it. The plan's own "moving a canvas is already a
  new document" note was the clue, one section away from the task that violated
  it.

- **The security review was the highest-value step by a distance, and it found
  what the plan's threat model had ruled out by construction.** The plan's
  design section argued rule 7 makes a hostile path self-defeating — true, and
  it survived direct attack. What neither the plan nor the implementation saw is
  that rule 7 governs a path's IDENTITY, never its DESTINATION: a perfectly
  legitimate path can still land on an existing local file, on the served token
  stylesheet, or through a symlink. Three genuine defects, all downstream of a
  guarantee that was itself sound.

- **The guard I wrote first was in the wrong place, twice.** Both times the
  fallback reached the same file the carried path did — because the fallback is
  derived from the slug and the slug from the path. Checking only the carried
  path left the exploit reachable *with nothing on the wire at all*. The lesson
  generalises: when a validated value and its fallback resolve to one place, a
  guard on the validated branch is half a guard.

- **Falsify every guard.** Four of my first six regression tests passed with the
  fix disabled — they proved nothing. Two more only became real after the test
  was strengthened (a post-boot hub edit; a populated `css` lane). Running each
  new test against a deliberately broken build is cheap and it changed the
  verdict on six of eight.

- **`Promise.allSettled(...).then(...)` is not a place to put anything that
  matters.** It bit twice — the config seeding and the untrusted re-mark both
  silently never ran, because `stop()` returns first. A fire-and-forget boot
  handler is fine for a log line and wrong for a security marker.

- **For `/flow:execute` next time:** the "expect it to fail" instruction in Task
  1 is good and should be extended to every regression test a task adds, not
  just the opening falsifier.
