# Feature: Split per-user camera out of versioned canvas meta + reconcile the runtime-state taxonomy

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports — most of the machinery already exists; this is a surgical split + a three-file reconciliation.

## Description

A canvas's `.meta.json` today mixes two fundamentally different kinds of state in one tracked file:

- **Shared document** — `title`, `subtitle`, `brief`, `platform`, `sections`/`artboards`, `layout.artboards` positions, `css_mode`. Real content; belongs in git; syncs over the hub.
- **Per-user camera** — `viewport` (pan/zoom of the infinite board) and `last_modified`. Personal "where am I looking"; changes on **every mouse pan/zoom**.

`/_api/canvas-meta` PATCH (`api.ts:690-734`) rewrites the whole `.meta.json` and stamps `last_modified` on **every** viewport settle, so the file churns constantly → it shows up in the Changes panel and would be committed on every mouse move. The sync layer already knows this is wrong (`sync/codec.ts:220` lists `viewport`/`last_modified` in `META_LOCAL_KEYS` and never sends them over the hub) — but the **disk/git layer never finished the split**. This plan finishes it.

It also reconciles the three places that independently decide "what is per-machine runtime vs. real content" — they have drifted apart (repo `.gitignore`, the `maude init` template `cli/lib/gitignore-block.mjs`, and the `isMaudeRuntimeState` panel backstop in `git/service.ts:141`) — so the Changes panel shows **only** real commit-worthy changes: artboard/layout edits, annotations, comments, specimens, design-system files.

This is the prerequisite for the previously-discussed sidecar grouping in `GitPanel.jsx` (DDR-112 commit-time auto-stage already ships): once the camera stops churning meta, the dirty set is genuinely clean and grouping becomes pure cosmetics.

## User Story

As a (currently sole) Maude user, I want panning/zooming a canvas to **not** create a git change, while artboard moves, layout, annotations, comments, specimens and design-system edits **do** show up as real changes to save — so the Changes panel reflects my actual work, not my mouse movements.

## Problem

1. `api.ts:716-731` — viewport-only PATCH writes the entire `.meta.json` **and** stamps `last_modified`, so pan/zoom dirties a tracked file.
2. The split exists logically in sync (`META_LOCAL_KEYS`) but not physically on disk: viewport/last_modified live in the same tracked file as shared content.
3. Three runtime-state allow/deny lists have drifted (see the taxonomy table below), so what's hidden from the panel, what git ignores, and what `maude init` scaffolds disagree — e.g. **annotations and comments are gitignored in this repo** (`.gitignore:17,71-72`) even though `git/service.ts:141` claims they're versionable and the user wants them committable.

## Solution

**Invisible-to-client split — GET merges, PATCH splits.** The canvas shell loads meta client-side via `GET /_api/canvas-meta?file=` (confirmed: `serveCanvasShell` at `http.ts:1261-1271` only injects the inspector; it does **not** inject `window.__canvas_meta__` — the `_shell.html` template fetches the meta route itself). So we keep the client and the `/_api/canvas-meta` route shape identical and change only what the server reads/writes behind it:

- **PATCH** — `layout` → `.meta.json` (versioned); `viewport` → a gitignored per-machine view file; stamp `last_modified` into meta **only when a shared key (`layout`) actually changes**, never on a viewport-only patch.
- **GET** — load `.meta.json`, strip any stale inline `viewport`/`last_modified`, merge the view file's `viewport` back in, return the combined object. The shell's `window.__canvas_meta__` still has `viewport`, so restore-on-reload keeps working with **zero client change**.

The per-machine view file lives in the already-gitignored `_canvas-state/` dir as `_canvas-state/<slug>.view.json` `{ viewport: { x, y, zoom } }`. This reuses the existing per-machine bucket, the delete-sweep, and the export exclusion, and avoids the **name collision** with the legacy `/_canvas-state` POST which writes a *different* `viewport: {x,y,scale}` shape (`api.ts:1218-1231`) — we use a **separate file**, not the legacy `_canvas-state/<slug>.json`.

Then reconcile the three taxonomy lists to one canonical set (below), and (per the user) flip annotations + comments back to **versioned**.

## Metadata

- **Type**: Refactor + Bug Fix (schema split) + repo hygiene
- **Complexity**: Medium
- **App/Package**: `apps/studio` (dev-server) + `cli/` (gitignore template) + repo `.gitignore`
- **Affected Systems**: `/_api/canvas-meta` GET/PATCH; canvas delete-sweep; `isMaudeRuntimeState`; `maude init` gitignore template; repo `.gitignore`; tests
- **Dependencies**: none new. DDR-027 (layout positions-only), DDR-054/DDR-056 (canvas-origin trust + gitignore strategy), DDR-112 (sidecar commit-time staging) are the relevant priors.
- **No backward-compat / migration code** (per user: single user, no other consumers). One-time repo housekeeping commit strips the now-orphaned keys from already-committed metas.

---

## Context References

### Must-Read Files

> Read these in parallel in a single message during `/flow:execute`.

- `apps/studio/api.ts:649-734` — `canvasMetaPath` / `loadCanvasMeta` / `patchCanvasMeta`. The core split site. Note the existing `viewport` validation (finite x/y, zoom clamped 0.1–4) — preserve it for the view file.
- `apps/studio/api.ts:618-638` + `:1218-1231` — `canvasStatePath` / `loadCanvasState` / `saveCanvasState`. The **legacy** per-machine store with `viewport:{x,y,scale}` — DO NOT overload; the new view file is separate. Reuse `paths.canvasStateDir` + `fileSlug()` for the path shape only.
- `apps/studio/api.ts:996-1048` — canvas delete → `_trash` sweep. Add the new `.view.json` to the bundle (mirrors the `.meta.json` / `_canvas-state__<slug>.json` lines at `:1024,1031`).
- `apps/studio/api.ts:920-930` — canvas create stamps `last_modified` (one-time, fine to keep; verify it doesn't also seed an inline `viewport`).
- `apps/studio/http.ts:616-640` — `/_api/canvas-meta` GET/PATCH route (no shape change; it just forwards to api).
- `apps/studio/http.ts:1261-1271` — `serveCanvasShell` (confirms meta is NOT server-injected → client-side fetch → split is invisible to client).
- `apps/studio/git/service.ts:141-147` — `isMaudeRuntimeState` (the panel backstop to extend).
- `apps/studio/canvas-lib.tsx:448-552` — `readCanvasMeta` / `readCanvasMetaFile` / `patchCanvasMeta` + the self-echo stamp (`__maude_last_meta_self_write_at`, `:505-518,544`). **Read-only for this plan** — the client doesn't change, but confirm the assumptions hold.
- `apps/studio/sync/codec.ts:205-296` — `META_LOCAL_KEYS` + `sharedMetaCanonical`/`mergeSharedMetaIntoLocal`. Confirms the on-disk meta becomes clean for sync too; keep `META_LOCAL_KEYS` as belt-and-suspenders (no change).
- `cli/lib/gitignore-block.mjs:24-44` — `buildBlock` (the `maude init` template to reconcile).
- repo `.gitignore:8-28,71-72` — the hand-maintained block (no `# maude:begin/end` markers) to reconcile.
- `apps/studio/git/watch.ts` — confirm the canvas-reload watcher ignores `_canvas-state/` so view-file writes never trigger a reload (search its ignore set).
- `apps/studio/exporters/scope.ts` — confirms `_canvas-state` is already excluded from exports (no change expected; verify the new file is covered).

### Files to Create

- `.ai/archive/decisions/DDR-NNN-per-user-camera-split-and-runtime-state-taxonomy.md` — records: (1) GET-merge / PATCH-split contract, (2) `_canvas-state/<slug>.view.json` as the per-machine camera lane (revises the Phase-4 "meta holds viewport" decision), (3) the single canonical runtime-state taxonomy, (4) the annotations/comments → versioned decision. (DDR number: next free in `.ai/archive/decisions/`.)
- `apps/studio/<designRoot>/_canvas-state/<slug>.view.json` — runtime, created at first viewport settle (not committed).

### Documentation

- `CLAUDE.md` → "Dev server runtime contract" + "Canvas-origin routes live in TWO allowlists" — the `/_api/canvas-meta` route stays canvas-origin-reachable and its shape is unchanged, so the dual-allowlist invariant is untouched (no new route).

### Patterns to Follow

- **Path containment** (`api.ts:654-666` `canvasMetaPath`): refuse `..`, require under `repoRoot`, ext gate. Mirror for the view-file path resolution.
- **Viewport validation** (`api.ts:720-728`): finite x/y, `zoom = clamp(0.1, 4)`. Reuse verbatim for the view file.
- **Slug → path** (`api.ts` `canvasStatePath` = `path.join(paths.canvasStateDir, \`${fileSlug(file)}.json\`)`): the view file is `path.join(paths.canvasStateDir, \`${fileSlug(file)}.view.json\`)`.

---

## Design Decisions

### Where per-user camera lives

| Option | Verdict |
| ------ | ------- |
| Reuse legacy `_canvas-state/<slug>.json` `viewport` key | ❌ collides — legacy shape is `{x,y,scale}` (clamp 0.05–8), camera is `{x,y,zoom}` (clamp 0.1–4); two writers would clobber. |
| New sibling `<name>.view.json` next to the canvas | ⚠️ works, but needs a new `*.view.json` gitignore glob in content dirs + clutters `ui/`. |
| **New file in the already-ignored bucket: `_canvas-state/<slug>.view.json`** | ✅ **chosen** — `_canvas-state/` is already gitignored (repo `.gitignore:18`), already swept on delete, already export-excluded; no new gitignore glob; no collision. |

### The `last_modified` rule (kills churn, keeps signal)

- Viewport-only PATCH → **never** touches `.meta.json` (no `last_modified` bump). ← removes the mouse-move churn.
- Layout PATCH → writes `.meta.json` **and** bumps `last_modified`. ← a real shared change (artboard moved) the user wants committable.
- Create (`api.ts:920-930`) keeps its one-time `last_modified`. Keep `last_modified` in `META_LOCAL_KEYS` (sync unchanged).

### Canonical runtime-state taxonomy (the reconciliation target)

> **VERSIONED** = real content, shows in Changes panel, committable. **IGNORED** = per-machine/per-user runtime, hidden everywhere.

| Path (under `<designRoot>`) | Decision | repo `.gitignore` today | `gitignore-block.mjs` today | `isMaudeRuntimeState` today | Action |
| --- | --- | --- | --- | --- | --- |
| `<name>.tsx`, `<name>.meta.json` | VERSIONED | tracked | n/a | not hidden | meta: drop viewport/last_modified churn (Tasks 1-3) |
| `<name>.annotations.svg` | **VERSIONED** | **ignored (71-72)** | not listed (versioned) | not hidden | **un-ignore in repo** (Task 7a) |
| `_comments/<slug>.json` | **IGNORED** (hub-sync only) | ignored (17) ✓ | **not listed** → add | **not hidden** → add | keep repo-ignored; add to template + backstop, hide from panel |
| `system/<ds>/**` (specimens, tokens, previews) | VERSIONED | tracked | n/a | not hidden | none |
| `config.json` | VERSIONED | tracked | n/a | not hidden | none |
| `_canvas-state/<slug>.view.json` (NEW) | IGNORED | covered by `_canvas-state/` (18) | add | **add** | Tasks 1, 6, 7 |
| `_canvas-state/` (legacy) | IGNORED | ignored (18) | listed | **not hidden** → add | Task 6 |
| `_state/` | IGNORED | ignored (27) | listed | **not hidden** → add | Task 6 |
| `_chat/` | IGNORED | **not listed** → add | listed | **not hidden** → add | Tasks 6, 7 |
| `_history/`, `_trash/`, `_draw/` | IGNORED | ignored (15,16) / `_draw` not listed → add | listed | hidden | Task 7 (repo `_draw`) |
| `_smoke/` | IGNORED | **not listed** → add | **not listed** → add | hidden | Tasks 6, 7 |
| `_server.json/.log/.lock`, `_active.json`, `_sync.json`, `_preflight.json` | IGNORED | json's ignored; `.lock`/`_preflight` **not** → add | partial → align | hidden | Task 7 |
| `_locator.json`, `_export-history.json`, `_untrusted/` | IGNORED | ignored (14,19,20) | **not listed** → add | **not hidden** → add | Tasks 6, 7 |

### Annotations → versioned; Comments → hub-sync only (RESOLVED)

User decision:
- **Annotations** (`<name>.annotations.svg`) → **versioned**. They're durable visual markup with no other transport; today they're gitignored (`.gitignore:71-72`) and therefore can't be committed — flip to versioned (Task 7a). They appear in the Changes panel and travel via git.
- **Comments** (`_comments/<slug>.json`) → **NOT versioned** — they already live-sync over the hub CRDT (DDR-102), so versioning them in git would duplicate the transport and invite merge friction. Keep them gitignored (repo `.gitignore:17` is already correct — no change), add `_comments/` to the `maude init` template + the `isMaudeRuntimeState` backstop so they're consistently treated as hub-only runtime and never surface in the Changes panel.

Consequence for `git/service.ts:141`'s doc-comment: it currently claims **both** `_comments` and annotations are "deliberately NOT excluded." After this change the rule **diverges** — annotations are versioned (not hidden), comments are hub-only (hidden). Update the comment to say exactly that and point at the DDR.

### Components / tokens

No UI components. The downstream `GitPanel.jsx` sidecar grouping is a **separate** follow-up (DDR-112 already auto-stages sidecars at commit); this plan only cleans the dirty set.

---

## Tasks

Execute in order. Each task is atomic and testable. `cd apps/studio` for all `bun` commands.

### Task 1: ADD per-machine view-store helpers (`api.ts`)

- **Do**: Add `canvasViewPath(file)` → `path.join(paths.canvasStateDir, \`${fileSlug(file)}.view.json\`)` (containment via the same guard family as `canvasMetaPath`). Add `loadCanvasView(file): Promise<{viewport?}|null>` and `saveCanvasView(file, viewport)` that validates `viewport` with the existing finite-x/y + `clamp(0.1,4)` zoom rule and writes `{ viewport }` (pretty JSON). Best-effort (mkdir the dir if absent — `paths.canvasStateDir`).
- **Pattern**: `canvasStatePath`/`loadCanvasState` (`api.ts:618-638`); viewport validation `api.ts:720-728`.
- **Gotcha**: NOT the legacy `_canvas-state/<slug>.json` — distinct `.view.json` file to avoid the `scale` vs `zoom` clobber.
- **Validate**: `bun test canvas-meta` (after Task 9 adds cases); `bun tsc --noEmit`.

### Task 2: SPLIT the meta PATCH (`api.ts` `patchCanvasMeta`)

- **Do**: Route `patch.viewport` → `saveCanvasView` (do **not** write it into `.meta.json`). Keep `patch.layout` → `.meta.json`. Stamp `next.last_modified` **only when `patch.layout` is present**; a viewport-only patch must leave `.meta.json` byte-unchanged (return the unchanged meta merged with the new viewport so the client still gets a coherent object). If neither layout nor viewport present, no-op.
- **Pattern**: existing whitelist block `api.ts:707-732`.
- **Gotcha**: A viewport-only patch on a canvas that has no `.meta.json` yet must still succeed (write only the view file) — don't 404. Reconsider the `http.ts:636` "Not found or rejected" → return the merged object instead.
- **Validate**: `bun test canvas-meta`.

### Task 3: MERGE on the meta GET (`api.ts` `loadCanvasMeta`)

- **Do**: After parsing `.meta.json`, delete any stale inline `viewport`/`last_modified` from the object, then overlay `loadCanvasView(file)?.viewport` if present. Return the combined object. Net effect: the shell's `window.__canvas_meta__` keeps `{...sharedMeta, viewport}` transparently; the client is unchanged.
- **Pattern**: `loadCanvasMeta` `api.ts:669-681`.
- **Gotcha**: GET must stay fast (it's per-canvas-load) — one extra small file read is fine; swallow view-file read errors → no viewport key.
- **Validate**: `bun test canvas-meta`.

### Task 4: ADD the view file to the delete-sweep (`api.ts`)

- **Do**: In the `_trash` bundle (`api.ts:1021-1034`), `moveIfExists(canvasViewPath(...), \`_canvas-state__${slug}.view.json\`)` alongside the existing `.meta.json` / `_canvas-state__<slug>.json` / `_comments__<slug>.json` lines.
- **Validate**: `bun test` (delete-related suite if present); manual: delete a canvas → view file lands in `_trash`.

### Task 5: EXTEND `isMaudeRuntimeState` (`git/service.ts:141`)

- **Do**: Extend the regex set so the panel backstop hides the full per-machine set: add `_canvas-state`, `_state`, `_chat`, `_comments`, `_untrusted` (dir prefixes), and `_locator.json`, `_export-history.json`, `_server.log` (file names). Keep `*.annotations.svg` **NOT** hidden (versioned content). `_comments` IS now hidden (hub-sync only — user decision).
- **Pattern**: the two existing regexes `git/service.ts:142-146`.
- **Gotcha**: this is the backstop for repos lacking the gitignore block; the repo's real `.gitignore` (Task 7) is the primary mechanism. Update the doc-comment that currently claims `_comments`/annotations are "deliberately not excluded" — the rule now diverges (annotations versioned, comments hub-only); point at the canonical taxonomy / DDR.
- **Validate**: `bun test git` — extend the `isMaudeRuntimeState` test (`test/git-api.test.ts:101-120`).

### Task 6: RECONCILE the `maude init` template (`cli/lib/gitignore-block.mjs`)

- **Do**: Align `buildBlock` to the canonical IGNORED set: add `_smoke/`, `_preflight.json`, `_server.lock`, `_locator.json`, `_export-history.json`, `_untrusted/`, `_comments/` (hub-sync only — user decision), and `_canvas-state/<...>.view.json` is covered by the existing `_canvas-state/`. Ensure `*.annotations.svg` is **absent** (versioned). Keep markers idempotent.
- **Pattern**: existing `lines` array `gitignore-block.mjs:27-43`.
- **Validate**: `node cli/bin/maude.mjs` dry-run if a relevant subcommand exists; or unit if `n-block`/`gitignore-block` has a test.

### Task 7: RECONCILE the repo `.gitignore`

- **Do**: (a) **Un-ignore annotations only** (`.gitignore:71-72`) — comments (`:17`) **stay ignored** (hub-sync only, user decision). (b) Add the IGNORED gaps: `_chat/`, `_draw/`, `_smoke/`, `_server.lock`, `_preflight.json`. (c) Confirm `_canvas-state/` (`:18`) already covers the new `.view.json`. Leave a comment pointing at the DDR as the single source of truth.
- **Gotcha**: un-ignoring annotations will surface any already-on-disk `*.annotations.svg` as **untracked** in the next `git status` — expected; they become committable. Verify none contain secrets before the first commit.
- **Validate**: `git status --porcelain .design` shows only real content (no `_canvas-state`, no `*.view.json`, no `_comments`, no `_server*`); `git check-ignore .design/_canvas-state/x.view.json` → ignored; `git check-ignore .design/_comments/x.json` → ignored; `git check-ignore .design/ui/X.annotations.svg` → NOT ignored.

### Task 8: VERIFY the fs-watch + self-echo assumptions

- **Do**: Confirm `git/watch.ts` (and the canvas-reload watcher) ignore `_canvas-state/` so view writes never broadcast a reload. Confirm the meta self-echo guard (`canvas-lib.tsx:505-518`) is still coherent now that viewport patches don't write meta (it should simply fire less; no code change expected). Document any finding.
- **Validate**: live (Task 10) — pan/zoom rapidly, confirm no canvas reload + no `.meta.json` change.

### Task 9: TESTS

- **Do**: In `test/canvas-meta-api.test.ts`: (1) PATCH `{viewport}` leaves `.meta.json` **byte-unchanged** and creates `_canvas-state/<slug>.view.json` — the keystone churn-killer assertion; (2) GET merges the view file's viewport into the returned meta; (3) PATCH `{layout}` writes meta **and** bumps `last_modified`; (4) GET strips a stale inline viewport from a legacy meta. In `test/git-api.test.ts`: extend `isMaudeRuntimeState` cases (Task 5) — `_canvas-state`/`_state`/`_chat`/`_comments`/`_locator.json` hidden; `*.annotations.svg` NOT hidden. (Note: the existing case at `test/git-api.test.ts:112-119` asserts `_comments` NOT hidden — flip it.)
- **Validate**: `bun test` green.

### Task 10: ONE-TIME repo housekeeping (not a migration)

- **Do**: Strip the now-orphaned `viewport` + `last_modified` keys from the already-committed `.design/**/*.meta.json` in THIS repo (one `jq`/script pass, excluding `_history/`), so the dirty set is genuinely clean going forward. This is repo hygiene, not backward-compat code.
- **Gotcha**: this produces a sizable but one-time meta diff — commit it on its own ("chore: strip per-user camera from committed canvas metas").
- **Validate**: after the pass + a server boot + a few pans, `git status .design` shows no meta churn.

### Task 11: DDR + STATE (+ confirm no bundle rebuild)

- **Do**: Write the DDR (Files to Create). Update `.ai/state/STATE.md` History + run `pnpm --filter @maude/site gen:roadmap` if a plan/STATE change warrants it (per CLAUDE.md). **Confirm no client bundle rebuild is needed** — `client/` is untouched (the split is server-side); if `git diff --stat` shows any `client/**` change, rebuild `--release` per CLAUDE.md and commit `dist/`.
- **Validate**: `git diff --stat` shows no `apps/studio/client/**`; STATE reflects reality.

---

## Validation

1. **Lint/format**: `cd apps/studio && bunx biome check .`
2. **Types**: `cd apps/studio && bun tsc --noEmit` (DDR-026 baseline unchanged).
3. **Tests**: `cd apps/studio && bun test` — full dev-server suite green incl. the new canvas-meta split cases + `isMaudeRuntimeState` alignment + `canvas-origin-gate` (route shape unchanged, still passes).
4. **Git hygiene**: `git check-ignore` matrix from Task 7; `git status --porcelain .design` after rapid pan/zoom = empty.
5. **Live (agent-browser)**: open a canvas → pan/zoom repeatedly → `.meta.json` unchanged on disk, `_canvas-state/<slug>.view.json` updates, no canvas reload; reload the page → camera restored; move an artboard → `.meta.json` + `last_modified` change (shows in panel).
6. **Manual (user dogfood — native WKWebView ceiling)**: same flow in the desktop app; confirm Changes panel lists only real content (meta on layout-edit, annotations, comments, specimens, DS), never camera.

> No 5-platform `scenario-runner` — desktop dev-tool surface, no native mobile/tablet variant (consistent with prior dev-server History-row plans; agent-browser substitutes).

---

## Out of Scope (explicit)

- **`GitPanel.jsx` sidecar grouping / collapsed "supporting files"** — the downstream cosmetic follow-up (DDR-112 already auto-stages at commit). This plan only produces a clean dirty set.
- **Backward-compat reads of inline viewport** — none (single user); GET defensively strips stale keys, Task 10 cleans the repo, done.
- **Legacy `/_canvas-state` `{sections, viewport:{x,y,scale}}` store** — left as-is; flag for a *separate* dead-code check (is the FigJam-v3 path still live?), not touched here.
- **Changing hub/CRDT sync of meta** — `META_LOCAL_KEYS` stays; the on-disk meta merely becomes clean for it.

---

## Acceptance Criteria

- [ ] Pan/zoom never changes `.meta.json`; camera persists to `_canvas-state/<slug>.view.json` (gitignored) and restores on reload.
- [ ] Artboard/layout move writes `.meta.json` + bumps `last_modified` and shows in the Changes panel.
- [ ] `GET /_api/canvas-meta` returns shared meta with viewport merged from the view file; `PATCH` shape unchanged; route stays canvas-origin-reachable (dual-allowlist untouched).
- [ ] One canonical runtime-state taxonomy: `isMaudeRuntimeState`, `gitignore-block.mjs`, and repo `.gitignore` agree.
- [ ] Annotations are versioned (un-ignored, show in panel); comments stay hub-sync-only (gitignored + hidden from panel).
- [ ] Delete-sweep moves the view file to `_trash`.
- [ ] Tests + tsc + biome green; new churn-killer + taxonomy tests added.
- [ ] Repo metas cleaned (one-time housekeeping commit); `git status .design` clean after pan/zoom.
- [ ] DDR recorded; STATE updated; no client bundle change (or rebuilt if any `client/**` touched).
- [ ] agent-browser scenario green; interactive desktop dogfood handed to user.

---

## Open Questions / Confirms

1. ~~Annotations + comments → versioned?~~ **RESOLVED**: annotations versioned, comments hub-only (gitignored).
2. **`_locator.json` / `_export-history.json`** — treat as IGNORED (regenerable index). Confirm (currently ignored in repo; the plan keeps them ignored + adds them to the backstop/template).
3. **View-file name** — `_canvas-state/<slug>.view.json` (chosen). OK, or prefer a dedicated `_view/<slug>.json` dir?

---

## Retro

- **The split was as surgical as predicted.** The sync layer already modeled the boundary (`META_LOCAL_KEYS`); only the disk/git layer needed finishing. Reusing the existing `canvasMetaPath` containment guard + viewport validation kept the diff small and the keystone "meta byte-unchanged on viewport PATCH" test made the churn-killer property explicit. Pattern-first paid off.
- **Test-boot churned `dist/` — the known hazard, caught by a hash snapshot.** The full `bun test` run regenerated unminified dev bundles into `apps/studio/dist/`; a pre-stage hash check caught it and I restored to HEAD before committing. Reinforces the `feedback_work_in_worktree_not_main` memory — snapshot `dist/` hashes before any full-suite run or server boot, restore after. The agent-browser visual check used the **compiled binary** (serves from its own root) precisely to avoid this.
- **The downstream GitPanel grouping hinged on a subtlety the plan glossed.** DDR-112's "same-stem sidecar" `expandSidecars` only catches `.meta.json` (same-stem) — but annotations are **slug-named at the design root**, NOT same-stem siblings, so they aren't auto-staged with the canvas. The honest fix was to slug-match annotations client-side AND let the unit checkbox send all members, so the visual grouping == what commits. Extracting the pure grouping logic to a testable module (`git-grouping.js`) caught the `Pricing` vs `Pricing v3` cross-attach edge before it shipped. Next time: when a plan calls a follow-up "pure cosmetics," verify the sidecar relationship it assumes actually holds.
- **Concurrent commits on the shared `native-app` branch — verified, no clobber.** Two phase-28/29 commits landed mid-session (`7a1e326`, `207980d`); one even touched a file I edited (`git/service.ts`). Verified my edit's base blob matched the concurrent commit's output blob before trusting the clean commit. On a shared single checkout, always check the base, and stage only your own files (the stray `Smoke TSX.tsx` + `_smoke-github.ts` were correctly left unstaged).
- **Security review found a real MEDIUM the plan's threat model missed.** The new untrusted-origin write lane (`saveCanvasView`) shipped without the existence/count caps its siblings have (asset budget, annotation 1 MB gate) → arbitrary-slug file/inode DoS; fixed in the same `/done` pass. **Process note:** the two review agents wrote to the same report path and one clobbered the other's append — when fanning out report-writing agents, give each a distinct output path. **Plan-time lesson:** any NEW untrusted-origin write should be diffed against the existing write-surface caps during planning, not discovered at `/done`.
