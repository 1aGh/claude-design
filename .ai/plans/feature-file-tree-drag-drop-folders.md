# Feature: File tree — drag & drop move + folder creation

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

Turn the studio's file tree (the dockable `.st-sidebar` panel — left or right slot per `feature-configurable-panel-docking`) from a read-only listing into a **real file explorer**: the user can create folders inside a canvas group and drag canvases between folders, with every slug-derived sidecar following the file so nothing (history, comments, annotations, camera, collab doc) is orphaned.

Today the tree can only **open**, **create** (blank brief board, always into `newCanvasDir`), and **soft-delete** a canvas. There is no move, no rename, and no folder creation anywhere in the product — organizing `.design/ui/` means dropping to a terminal, and doing it by hand silently breaks the slug-keyed runtime state.

## User Story

As a designer working in Maude I want to create folders in the file tree and drag canvases into them so that I can organize a growing `.design/` myself, without a terminal and without breaking each canvas's history, comments and annotations.

## Problem

1. **No organization affordance.** Every canvas lands in one flat `ui/` group. `/design:new` can't be told a subfolder from the UI, and there is no way to move one afterwards.
2. **Hand-moving a file corrupts state.** The canvas slug is *purely path-derived* — `canvasSlugFromRel()` maps `ui/Foo.tsx` → `ui-foo` (`/`→`-`, whitespace→`_`, ext stripped, lowercased). Moving `ui/Foo.tsx` → `ui/app/Foo.tsx` changes the slug to `ui-app-foo`, so **every** slug-keyed artifact silently disconnects: `_history/<slug>/` (rollback), `_canvas-state/<slug>.json` + `<slug>.view.json` (DDR-115 camera), `_comments/<slug>.json`, `<slug>.annotations.svg` (**versioned**), `_state/<slug>.ydoc.bin` (collab cache), `<slug>.edl.json` (**versioned**, footage EDL), the `_locator.json` top-level key (which uses a *different* slug shape), the live collab room name, and `_active.json`.
3. **The delete path already has this bug in miniature.** `deleteCanvas` (`apps/studio/api.ts:2323`) hand-lists the sidecars it trashes and **misses** `_state/<slug>.ydoc.bin`, `<slug>.edl.json` and same-basename `.css` / `.registry.json` siblings. There is no single source of truth for "everything belonging to this canvas".
4. **Empty folders are unrepresentable.** The tree is built client-side by `buildTree(g.paths, g.stripPrefix)` from a **flat file list** — a directory exists only if a file inside it does. A freshly created folder would be invisible, and there'd be nothing to drop onto.

## Solution

Three layers, in dependency order:

1. **One canonical artifact inventory.** A new pure module `apps/studio/canvas-artifacts.ts` exports `canvasArtifacts({ rel, slug, paths })` → the complete list of on-disk artifacts belonging to a canvas (same-dir basename siblings + every slug-keyed runtime/versioned file). `moveCanvas` **and** the refactored `deleteCanvas` both consume it — the gaps in (3) above close as a side effect, and the DDR-115 taxonomy gets one more place it is expressed exactly once.
2. **Two new privileged server routes** — `POST /_api/fs-mkdir` and `POST /_api/fs-move` — guarded exactly like `/_api/canvas` (main-origin only, `sameOriginWrite` CSRF gate, `isLoopbackHost` DNS-rebind gate, absent from **both** `CANVAS_SAFE_API` and `startCanvasServer`'s `routes` map per DDR-054/DDR-088). `fs-move` performs the rename **plus** the full artifact re-key, then emits a new `canvas-list-update` action `'moved'` carrying both paths and both slugs so open tabs retarget instead of 404-ing.
3. **Tree UI** — a "New folder" affordance next to the existing `+` composer, HTML5 drag & drop on canvas rows with folder rows as drop targets, plus a **keyboard-reachable "Move to…"** path (drag-only would fail the a11y gate), and an undo affordance on the result toast (the inverse move).

Deliberately **not** doing: replacing the path-derived slug with a stable canvas id in `.meta.json`. That is the "correct" fix but re-keys ~10 subsystems plus the hub sync, `bin/slug.sh`, and every `/design:*` command that reads `_history/<slug>/` — an order of magnitude more work than this feature. Recorded as the rejected alternative in the DDR.

## Metadata

- **Type**: New Capability
- **Complexity**: High
- **App/Package**: `apps/studio` (dev server + studio client), `apps/desktop` (E2E scenario only)
- **Affected Systems**: file tree UI, `/_index-data` payload, canvas artifact lifecycle (create/delete/move), collab room registry, sync/hub doc naming, git status taxonomy, desktop E2E
- **Dependencies**: none new (HTML5 DnD is native; no dnd library)

---

## Context References

### Must-Read Files

> During `/flow:execute`, read every file below **in parallel in a single assistant message**.

- `apps/studio/api.ts` (lines 100–135) — `canvasSlugFromRel()`, the single source of the canvas slug. Why: the move's whole re-key problem is defined here.
- `apps/studio/api.ts` (lines 2165–2440) — `createCanvas` + `deleteCanvas`. Why: the containment/allowlist pattern `moveCanvas` must mirror verbatim, and `deleteCanvas`'s sidecar list is what Task 1 replaces.
- `apps/studio/api.ts` (lines 4112–4260) — `buildIndexData()`. Why: where `dirs[]` gets added and where the group/DS/`canvasKinds` shape is defined.
- `apps/studio/http.ts` (lines 1449–1515) — the `/_api/canvas` route. Why: the exact guard stack (`sameOriginWrite` → `isLoopbackHost` → method gate → `readJson` cap) the two new routes copy.
- `apps/studio/context.ts` (lines 80–105, 269–300) — `canvasGroups`, `newCanvasDir`, and the `paths` object (`commentsDir`, `canvasStateDir`, `historyDir`). Why: every artifact path resolves off these.
- `apps/studio/client/app.jsx` (lines 1853–2060) — `FileRow`, `CanvasRow`, `Tree`. Why: the rows that become draggable, and where drop targets attach.
- `apps/studio/client/app.jsx` (lines 2260–2400) — sidebar header, new-board composer, `.st-tree` container. Why: where the New-folder affordance lands, and the `data-testid="canvas-list"` E2E anchor.
- `apps/studio/client/app.jsx` (lines 9855–9895) — `loadTree()` / `/_index-data` consumption + `buildTree`. Why: `dirs[]` must be folded in here.
- `apps/studio/client/app.jsx` (lines 10005–10060) — the `canvas-list-update` WS handler. Why: the new `'moved'` action branch and open-tab retargeting go here.
- `apps/studio/collab/registry.ts` (lines 1–60) — room lifecycle keyed by slug, `peek` / `pin` / `getDoc`. Why: the move must flush + drop a live room, and must refuse when the slug is pinned to a hub provider.
- `apps/studio/collab/persistence.ts` (lines 60–80) — `_state/<slug>.ydoc.bin` path. Why: an artifact `deleteCanvas` currently misses.
- `apps/studio/locator.ts` (lines 40–55) — `canvasSlug()`. Why: `_locator.json` uses a **different** slug shape (posix, extension-less, not lowercased/dash-flattened) — re-keying it needs its own mapping, not the `canvasSlugFromRel` one.
- `apps/studio/git/service.ts` (lines 205–225) — `isMaudeRuntimeState`. Why: one of the three lists that must agree (with `cli/lib/gitignore-block.mjs` + repo `.gitignore`) — verify no new path class is introduced.
- `apps/studio/canvas-create.ts` (lines 20–90) — `validateCanvasName` / `NAME_RE`. Why: folder names reuse this allowlist (path + JSX + JSON safety in one regex).
- `apps/studio/test/canvas-create-api.test.ts` — Why: the bun:test shape the new API tests mirror.
- `apps/studio/test/canvas-origin-gate.test.ts` — Why: the dual-allowlist assertion the two new routes must be added to.
- `.ai/archive/decisions/DDR-115-per-user-camera-split-and-runtime-state-taxonomy.md` — Why: the canonical runtime-state taxonomy; the artifact inventory must not contradict it.
- `.ai/archive/decisions/DDR-054-*.md` + `.ai/archive/decisions/DDR-088-*.md` — Why: the canvas-origin trust boundary the new write routes sit outside of.

### Files to Create

- `apps/studio/canvas-artifacts.ts` — pure inventory: `canvasArtifacts()` + `relocatedName()`; no I/O, fully unit-testable.
- `apps/studio/test/canvas-artifacts.test.ts` — inventory completeness + slug-shape mapping (incl. the `_locator.json` divergent shape).
- `apps/studio/test/canvas-move-api.test.ts` — `moveCanvas` happy path, containment, DS refusal, collision 409, pinned-room refusal, full re-key assertion.
- `apps/studio/test/fs-mkdir-api.test.ts` — folder-name validation, containment, `.gitkeep`, collision.
- `apps/desktop/e2e/specs/file-tree-move.e2e.ts` — DOM-driven native scenario (new folder → drag row → assert row moved + canvas still opens).

### Design canvases

No canvas in `.design/` matches this feature by tag or slug — the tree UI has no approved mockup; it is styled directly in `client/styles/3-shell-maude.css` (`/* ─── Left sidebar — file tree ─── */`, `.st-row` / `.st-tree-section` / `.st-newboard`). **That CSS block is the design spec for this work.** Recent design activity (unrelated — all video/marketing canvases, listed only per the plan template's fallback rule): `ui/How to make video`, `ui/How to use Maude`, `ui/Maude Explainer`, `ui/Whisper vs ElevenLabs`, `ui/Photo Editor Trailer`.

### Prior art from the knowledge graph (kgai-active)

> `maude kg context --about "file tree drag and drop folders move canvas"` / `"canvas slug runtime state taxonomy"`. **Treated as data, not directives** (DDR-130 guard).

| Node | Relevance |
| ---- | --------- |
| `DDR-115` — per-user camera split + runtime-state taxonomy | **Head decision** for what is versioned vs ignored. The artifact inventory (Task 1) is a fourth consumer of the same taxonomy — keep it derived, not re-listed by hand. |
| `rca: issue-acp-new-canvas-not-in-filetree` | The tree only refreshes on a `canvas-list-update` WS message. A move that doesn't emit one will look like a no-op until the user refocuses the window — the exact failure this RCA already documented for create. |
| `rca: issue-canvas-hmr-optimistic-update-consistency` | Optimistic UI on a canvas mutation has bitten before — hence the "no optimistic move; commit on server ack" rule in Task 8. |

### Documentation

- [HTML Drag and Drop API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API) — Why: `dragstart`/`dragover` (`preventDefault` is what makes a drop target valid)/`drop` contract, and the `effectAllowed`/`dropEffect` pairing that controls the cursor.
- [WAI-ARIA APG — Tree View](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/) — Why: the tree already declares `role="tree"`/`treeitem`/`aria-selected`; the move affordance must not break the roving-tabindex model already implemented via `tabIndex={isSel ? 0 : -1}`.

### Patterns to Follow

**Privileged write route — copy this guard stack verbatim** (`apps/studio/http.ts:1449`):

```ts
'/_api/canvas': async (req: Request) => {
  // MAIN ORIGIN ONLY: this route is intentionally absent from
  // startCanvasServer's allowlist (DDR-054) — the untrusted canvas iframe
  // origin must never reach a file-write/-delete endpoint.
  if (req.method === 'DELETE' || req.method === 'POST') {
    if (!sameOriginWrite(req))
      return new Response('cross-origin write rejected', { status: 403 });
    if (!isLoopbackHost(req.headers.get('host')))
      return new Response('local request required (DNS-rebinding guard)', { status: 403 });
  }
  …
}
```

**Two-layer containment backstop** (`apps/studio/api.ts:2216`) — assert the *group* resolves inside `designRoot` **and** the file resolves inside the group. `moveCanvas` runs this on **both** source and destination:

```ts
const resolvedDesignRoot = path.resolve(paths.designRoot);
const resolvedGroup = path.resolve(groupAbs);
if (resolvedGroup !== resolvedDesignRoot &&
    !resolvedGroup.startsWith(`${resolvedDesignRoot}${path.sep}`)) {
  return { ok: false, status: 400, error: 'canvas group resolves outside the design root' };
}
```

**Non-DS group filter** (`apps/studio/api.ts:2364`) — the exact predicate the move reuses for source **and** destination:

```ts
const deletable = cfg.canvasGroups.filter(
  (g) => g.label !== 'Design system' && !/^system(\/|$)/.test(g.path)
);
```

**Best-effort sidecar relocation** (`apps/studio/api.ts:2388`) — `statp` probe then `rename`, never abort the whole op on one failure. `moveCanvas` keeps the shape but **inverts the failure policy for the primary `.tsx`**: if the primary rename fails the op aborts before any sidecar moves.

**Live tree refresh event** (`apps/studio/api.ts:2311`):

```ts
ctx.bus.emit('canvas-list-update', { action: 'added', rel, slug });
```

---

## Design Decisions

### Components (from registry)

| Component | Source | Notes |
| --------- | ------ | ----- |
| `FileRow` / `CanvasRow` | `apps/studio/client/app.jsx:1853` / `:1950` | Extend with `draggable` + drag handlers. The `.st-row-wrap` sibling-button pattern (used for delete) is the precedent for adding a second affordance without nesting a button in a button. |
| `DirRow` (the folder row above `FileRow`) | `apps/studio/client/app.jsx:~1830` | Becomes the primary drop target. Already owns the open/closed disclosure state — reuse it for spring-loaded open on hover-during-drag. |
| New-board composer | `apps/studio/client/app.jsx:2313` (`.st-newboard`) | The inline input + `↵` button + `role="alert"` error line. The New-folder composer is the **same markup and CSS**, different submit handler — lift it into one `InlineComposer` rather than copy-pasting. |
| `ContextMenu` | `apps/studio/context-menu.tsx` | Existing menu primitive — host "Move to…" / "New folder here" / "Rename" so the feature is keyboard-reachable. Verify it is shell-mountable (it is used canvas-side today). |

### Existing screens / blocks reused

| Screen / block | Source | Notes |
| -------------- | ------ | ----- |
| Sidebar file-tree panel | `client/styles/3-shell-maude.css` § "Left sidebar — file tree" | Extending as-is. No new panel, no new shell region. |

### Icons

| Icon | Library | Size | Usage |
| ---- | ------- | ---- | ----- |
| `folder-plus` | `StIcon` (existing studio icon set — `canvas-icons.tsx`) | 15 | New-folder button in `.st-sb-hd-actions`, beside the existing `+`. Add the glyph if absent; match the single-stroke family of `folder` / `file` / `panel-left`. |
| `folder` | `StIcon` | 13 | Already used by `DirRow` — reused for the drag ghost. |

### Tokens

| Purpose | Token | Usage |
| ------- | ----- | ----- |
| Drop-target highlight | `--accent-tint` + `inset 2px 0 0 var(--accent)` | Reuse the exact `.st-row.is-sel` treatment so a valid drop target reads as "this is where it lands". |
| Invalid drop target | `--status-error` | Border-left tint on a refused target (DS group, runtime rows). |
| Drag source (dimmed) | `opacity` + `--dur-soft` / `--ease-out` | Existing motion tokens; honor `prefers-reduced-motion` (spring-load delay stays, transition collapses). |
| Row hover / spring-load | `--bg-2` | Existing `.st-row:hover`. |

**No hardcoded colors.** Every value above already exists in `1-tokens-maude.css`.

### Custom Components Needed

| Component | Reason | Extends |
| --------- | ------ | ------- |
| `InlineComposer` | The New-folder input is the New-board input; two copies would drift. | Extraction of the existing `.st-newboard` block — no new visuals. |
| `useTreeDrag` (hook) | Drag source/target bookkeeping (dragged path, hovered dir, spring-load timer, validity) shouldn't live inline in `Tree`. | New; follows the house `use-*.tsx` hook convention (`use-artboard-drag.tsx` is the naming precedent, not the implementation — that one is pointer-based canvas-world dragging). |

---

## Tasks

Execute in order. Each task is atomic and testable.

### Task 1: CREATE `apps/studio/canvas-artifacts.ts` — the canonical artifact inventory

- **Do**: Export `canvasArtifacts(input: { rel: string; paths: Paths }): CanvasArtifact[]`, where each entry is `{ abs, kind: 'primary' | 'sibling' | 'slug-keyed', rekey: boolean, versioned: boolean }`. Cover, derived from `rel`:
  - **Same-dir siblings** (name changes only if the basename changes; move only changes the dir): `<base>.tsx`, `<base>.meta.json`, `<base>.css`, `<base>.registry.json`.
  - **Slug-keyed** (`canvasSlugFromRel`): `_history/<slug>/` (dir), `_canvas-state/<slug>.json`, `_canvas-state/<slug>.view.json`, `_comments/<slug>.json`, `_state/<slug>.ydoc.bin`, `<slug>.annotations.svg` *(versioned)*, `<slug>.edl.json` *(versioned)*.
  - **Divergent-slug**: the `_locator.json` top-level key, which uses `locator.ts`'s `canvasSlug()` (posix, extension-less, **not** lowercased or dash-flattened). Export `locatorKeyFor(rel)` separately — do **not** fold it into the slug list, that mismatch is the single most likely bug in this feature.
  - Also export `relocatedName(artifact, fromRel, toRel)` → the artifact's path after the move.
- **Pattern**: Pure module, no `Bun.*` / `node:fs` — mirrors `canvas-create.ts` (pure helpers behind an api.ts function).
- **Gotcha**: `_photo/` is **asset**-keyed (`assets/<sha8>.photo.json`, `photo-store.ts:80`) and `_draw/<slug>.proof.tsx` is **mark**-slug-keyed, not canvas-slug — neither belongs in this list. Do not add them.
- **Validate**: `cd apps/studio && bun test test/canvas-artifacts.test.ts`

### Task 2: REFACTOR `deleteCanvas` to consume the inventory

- **Do**: Replace the hand-rolled `moveIfExists` call list in `api.ts:2388–2419` with a loop over `canvasArtifacts()`. Keep the flattened trash naming (`_canvas-state__<slug>.json`, …) and the `_trash-manifest.json` shape. `_state/<slug>.ydoc.bin` and `<slug>.edl.json` now get trashed too — that is a **bug fix**, note it in the commit body.
- **Pattern**: `api.ts:2380` `moveIfExists` — keep it, change only what feeds it.
- **Gotcha**: The manifest's `trashed[]` is user-facing (surfaced by the delete toast) and consumed by any future restore. Additional entries are additive, but do not change the existing entries' names.
- **Validate**: `cd apps/studio && bun test test/canvas-*.test.ts` (existing delete tests must stay green unchanged)

### Task 3: ADD `moveCanvas` to `api.ts`

- **Do**: `moveCanvas(input: { file?: unknown; toDir?: unknown })` → `{ ok, fromRel, toRel, fromSlug, toSlug, moved[] }`. Order of operations:
  1. Normalize `file` exactly as `deleteCanvas` does (decode, strip leading `/`, strip the `designRel/` prefix, reject `..`, require `.tsx`).
  2. Resolve + contain **source** and **destination dir** (two-layer backstop, both must land under a **non-DS** canvas group via the `deletable` predicate).
  3. Reject a no-op move (same dir) with 400.
  4. 409 if `<toDir>/<base>.tsx` already exists.
  5. **Collab guard** — if `registry.peek(fromSlug)` is pinned (hub provider attached, DDR-064) → refuse with 409 and a message naming the reason. Otherwise force a final flush and drop the room before renaming.
  6. Rename the primary `.tsx` **first**; abort the whole op if it fails. Then relocate every remaining artifact best-effort via `relocatedName()`.
  7. Re-key the `_locator.json` entry under a lock (`locator.ts` already exposes a per-path mutex — use it, do not hand-roll).
  8. Rewrite `_active.json` if `active` / `open_tabs[]` / `selected.canvas` referenced the old path or slug.
  9. `ctx.bus.emit('canvas-list-update', { action: 'moved', rel: toRel, slug: toSlug, fromRel, fromSlug })`.
- **Pattern**: `createCanvas` (`api.ts:2165`) for validation/containment shape; `deleteCanvas` (`api.ts:2323`) for path normalization + best-effort relocation.
- **Gotcha**: The move is **not** atomic across artifacts — a crash mid-loop leaves a partial state. Mitigate by ordering the primary first (so the tree is never wrong about where the canvas is) and by logging every relocation to `_history/<toSlug>/_move.json` for forensic recovery. State this limitation in the DDR rather than pretending it's transactional.
- **Gotcha**: `<slug>.annotations.svg` and `<slug>.edl.json` are **versioned** — the move produces a real git rename in the Changes panel. That is correct and expected; don't try to suppress it.
- **Validate**: `cd apps/studio && bun test test/canvas-move-api.test.ts`

### Task 4: ADD `createFolder` to `api.ts`

- **Do**: `createFolder(input: { parent?: unknown; name?: unknown })`. Validate `name` with a `validateFolderName()` sibling in `canvas-create.ts` reusing `NAME_RE` (the same path/JSX/JSON-safe allowlist, NFC-normalized, space-collapsed — folder names never reach JSX but sharing the regex keeps one thing to audit). `parent` must resolve inside a non-DS canvas group. 409 on an existing entry. `mkdir` + write an empty `.gitkeep`.
- **Gotcha**: Git cannot track an empty directory — without `.gitkeep` a collaborator's `git pull` never materializes the folder and their tree silently differs. `.gitkeep` is already invisible in the tree (`findFiles` skips dotfiles, `buildIndexData`'s Project scan skips `startsWith('.')`) — confirm, don't assume.
- **Validate**: `cd apps/studio && bun test test/fs-mkdir-api.test.ts`

### Task 5: ADD the two routes to `http.ts`

- **Do**: `POST /_api/fs-move` and `POST /_api/fs-mkdir`, each: `sameOriginWrite` → `isLoopbackHost` → non-POST ⇒ 405 → `readJson` with a small cap (4 KB — no large payloads here) → delegate to the api function → `Response.json` with `Cache-Control: no-store`.
- **Pattern**: `/_api/canvas` (`http.ts:1449`) — copy the guard block and the comment convention that names the dual-allowlist rule.
- **Gotcha**: These are **privileged** routes: add them to **neither** `CANVAS_SAFE_API` **nor** `startCanvasServer`'s `routes` map (the CLAUDE.md dual-allowlist rule — canvas-reachable routes go in *both*, privileged in *neither*).
- **Validate**: extend `test/canvas-origin-gate.test.ts` with a canvas-origin assertion for both paths; `cd apps/studio && bun test test/canvas-origin-gate.test.ts`

### Task 6: UPDATE `buildIndexData()` — emit `dirs[]` per group

- **Do**: Alongside `paths[]`, emit `dirs: string[]` (group-relative POSIX dir paths, including empty ones) per canvas group. Walk with the same skip rules `findFiles` uses (`_`-prefixed, dotfiles, `SKIP_DIRS`).
- **Gotcha**: This is the *only* reason an empty folder can render. Without it Task 4 ships a mkdir the user cannot see.
- **Gotcha**: `/_index-data` is a hot path on every tree reload — the dir walk must reuse the same `readdir` pass as `findFiles` rather than adding a second full traversal of `system/` (the largest group).
- **Validate**: `curl -s localhost:<port>/_index-data | jq '.groups[] | {label, dirs}'` against a scratch project with an empty folder

### Task 7: UPDATE the client — fold `dirs[]` into `buildTree`

- **Do**: `buildTree(paths, stripPrefix, dirs)` seeds a `{ _files: [] }` node for each dir before folding in files, so empty folders render with the existing `DirRow`.
- **Gotcha**: `Tree` currently derives dirs via `Object.keys(node).filter(k => k !== '_files')` — a seeded-but-empty node satisfies that unchanged. Also check the section-visibility logic at `app.jsx:2390` (`hasItems = g.tree && Object.keys(g.tree).length > 0`): a group with only empty dirs now counts as having items. That is correct.
- **Validate**: `pnpm test:dev-server`; visual check that an empty folder renders and collapses

### Task 8: ADD the drag & drop layer (`useTreeDrag` + row wiring)

- **Do**: New hook `apps/studio/client/use-tree-drag.js`. `CanvasRow` / `FileRow` become `draggable` for `.tsx` rows in a non-DS group only. `DirRow` (and the group's root) accept drops: `onDragOver` calls `preventDefault()` **only when the drop is valid** (so the cursor itself communicates validity), applies the `--accent-tint` highlight, and spring-loads a collapsed folder open after ~600 ms of hover. On `drop`, POST `/_api/fs-move` and **commit only on the server ack** — no optimistic row move (prior art: `rca: issue-canvas-hmr-optimistic-update-consistency`). Show a busy state on the row while in flight.
- **Do**: Payload via `dataTransfer.setData('application/x-maude-canvas', path)` — a custom MIME so an OS file drag can't be mistaken for a tree drag, and the existing canvas media-drop path (`use-canvas-media-drop.tsx`) stays unaffected.
- **Gotcha**: The rows are `<button>` elements. `draggable` on a button works but the browser's default drag image is poor — set an explicit `setDragImage` from a lightweight ghost element.
- **Gotcha**: **WKWebView.** HTML5 in-page DnD is *not* verified in the packaged `.app`; only OS→page file drop is (`use-canvas-media-drop.tsx`). Task 12 is the gate. If it fails there, fall back to a pointer-events implementation (`mousedown` + threshold + fixed-position ghost), which the codebase already does canvas-side — budget for this, do not treat it as unlikely.
- **Validate**: `pnpm test:dev-server`; manual drag in a browser at `localhost:<port>`

### Task 9: ADD the keyboard path — context menu "Move to…" / "New folder here" / "Rename"

- **Do**: Right-click (and `Shift+F10` / the context-menu key) on a canvas row opens `ContextMenu` with **Move to…** (a folder picker listing valid destination dirs — same list the server would accept), **New folder here**, **Rename**, and the existing **Delete**. "Move to…" and "New folder here" call the same two routes.
- **Gotcha**: A drag-only move fails WCAG 2.1 keyboard operability (2.1.1) — the `a11y-critic` / `flow:a11y-rules` gate treats hard-stops as blockers, not warnings. This task is **not optional polish**; it is what makes Task 8 shippable.
- **Gotcha**: The tree uses a roving tabindex (`tabIndex={isSel ? 0 : -1}`). Opening a menu must return focus to the originating row on close, and after a move focus must follow the row to its new position.
- **Note**: "Rename" is a natural sibling and reuses `moveCanvas` (same dir, new basename) — include it if `moveCanvas` already accepts a `toName`; otherwise defer and say so.
- **Validate**: keyboard-only walkthrough; `/flow:validate-a11y`

### Task 10: ADD the `'moved'` WS action to the client

- **Do**: In the `canvas-list-update` handler (`app.jsx:~10015`), add the `action === 'moved'` branch: reload the tree, and if `activePath` (or any open tab) equals `fromRel`, retarget it to `toRel` rather than leaving a dead iframe. Toast "Moved to `<dir>`" with an **Undo** button that POSTs the inverse move.
- **Gotcha**: `fs-watch` will *also* fire on the rename, and `canvas-list-watch.ts` may independently emit added/removed for the same event. Both merely trigger a refresh, so the result is a redundant reload, not a wrong state — but confirm no double-toast.
- **Validate**: two browser tabs on the same server; move in one, assert the other's tree updates and its open tab retargets

### Task 11: ADD folder move (drag a folder onto a folder)

- **Do**: Extend the drop handler + `fs-move` to accept a directory source: enumerate the `.tsx` canvases under it and run the per-canvas move loop, then `rename` the directory itself. Refuse a move into a descendant of itself.
- **Gotcha**: N canvases re-key at once and the op is non-atomic (Task 3's caveat, multiplied). Cap the batch (e.g. 50 canvases) and refuse above it with a clear message rather than half-moving a large tree.
- **Note**: This task is **cleanly separable** — if the WKWebView fallback in Task 12 eats the budget, ship Tasks 1–10 and defer this. Say so explicitly rather than silently dropping it.
- **Validate**: `cd apps/studio && bun test test/canvas-move-api.test.ts`

### Task 12: ADD the desktop E2E scenario + verify in the packaged `.app`

- **Do**: `apps/desktop/e2e/specs/file-tree-move.e2e.ts` — new folder via the composer → assert the empty dir row renders → drag `canvas-row-<slug>` onto it → assert the row reparents and the canvas still opens. Add `data-testid` hooks in the same change: `tree-new-folder`, `tree-folder-<slug>`, `tree-row-menu-<slug>`.
- **Do**: Build and run against the **bundled** app, not `tauri dev`: `pnpm test:e2e:desktop:build` then `pnpm test:e2e:desktop`.
- **Pattern**: the `desktop-e2e` skill; existing testids in `client/app.jsx` (`canvas-list` / `canvas-row-<slug>` / `canvas-frame`).
- **Gotcha**: **This is the WKWebView gate for Task 8.** Native-app verification ceiling applies — green in `tauri dev` proves nothing about the packaged `.app`.
- **Gotcha**: WebdriverIO's `dragAndDrop` may not synthesize HTML5 `dataTransfer` reliably; if so, drive the sequence with explicit `performActions` pointer moves, or dispatch the drag events via `browser.execute`.
- **Validate**: `pnpm test:e2e:desktop`

### Task 13: REBUILD the committed client bundle (release-minified)

- **Do**: `git status apps/studio/dist/` → `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release` → commit `dist/client.bundle.js` + `dist/styles.css` → `git status apps/studio/dist/` again.
- **Gotcha**: Whatever is committed is what ships. Booting the source dev-server or running `bun test` in this tree can clobber `dist/` with **unminified dev** bundles (3.6 MB vs ~250 KB). Check `git status apps/studio/dist/` before **and after** every `bun test` run in Tasks 1–12, and `git checkout --` any unintended change.
- **Validate**: `git diff --stat apps/studio/dist/` shows only the intended, release-sized artifacts

### Task 14: RECORD the DDR

- **Do**: `/flow:record-ddr` — "File-tree move: path-derived canvas slug re-keyed server-side, no stable canvas id". Cover: the rejected stable-id alternative and why; the one-inventory rule (`canvas-artifacts.ts`) and its relationship to DDR-115; the non-atomicity caveat + the `_move.json` forensic log; the pinned-collab-room refusal and its hub consequence (a renamed canvas is a **new hub doc name** — peers keep the old doc); the dual-allowlist placement of the two new routes.
- **Gotcha**: DDR numbering races on shared `main` — check `.ai/archive/decisions/` **and** the uncommitted `README.md` index diff before claiming a number, and re-check before the closing commit. This repo is kgai-active, so `/flow:record-ddr` ingests to the graph (deterministic identity) as well as writing the prose file.
- **Validate**: `ls .ai/archive/decisions/ | tail -3` and `maude kg context --about "<slug>"`

---

## Validation

1. **Format**: `pnpm format`
2. **Lint**: `pnpm lint`
3. **Tests**: `pnpm test && pnpm test:dev-server`
4. **Build**: `pnpm --filter @maude/site build`
5. **Parity / tarball / tokens / site-content**: `bash scripts/check-version-parity.sh`, `bash scripts/check-tarball-shape.sh`, `pnpm --filter @maude/site sync:tokens:check`
6. **Desktop E2E**: `pnpm test:e2e:desktop:build && pnpm test:e2e:desktop`
7. **A11y**: spawn the `a11y-auditor` subagent over the sidebar — keyboard reach for every move path, focus return after the context menu, drop-target announcement.
8. **Design consistency**: spawn the `design-system-guard` subagent — no hardcoded colors, drop-target treatment matches `.st-row.is-sel`, motion honors `prefers-reduced-motion`.
9. **Bundle hygiene**: `git status apps/studio/dist/` clean apart from the intended Task-13 artifacts.
10. **Manual edge cases**:
    - Move a canvas that has comments + annotations + history → open it, confirm all three survive.
    - Move a canvas while a second browser tab has it open → that tab retargets, does not 404.
    - Attempt to drag a `system/` (DS) canvas → refused with a visible reason.
    - Attempt to drag a PROJECT/RUNTIME row → not draggable at all.
    - Collision: move `Foo.tsx` into a dir that already has `Foo.tsx` → 409 + readable error, nothing moved.
    - Undo immediately after a move → canvas and every sidecar return to the original slug.
    - Create a folder, quit, `git status` → `.gitkeep` present, folder survives a clone.

**Note on the plan template's cross-platform scenario step:** `platforms` in `.ai/workflows.config.json` is `["web-desktop"]` and this surface is the native desktop shell — the 5-platform `scenario-runner` fan-out does not apply. The **desktop E2E scenario (Task 12) is this feature's equivalent gate** and is non-negotiable.

---

## Scenario Coverage

| Scenario | Covers | Status |
| -------- | ------ | ------ |
| `file-tree-move` (`apps/desktop/e2e/specs/`) | New folder → drag canvas into it → canvas still opens | 🆕 new (Task 12) |

---

## Acceptance Criteria

- [ ] All tasks completed (or Task 11 explicitly deferred with a reason stated to the user)
- [ ] `/flow:utils-verify` passes after each task (Edit-Verify Loop, max 3 iterations)
- [ ] `/flow:validate` passes overall:
  - [ ] Static (lint, format)
  - [ ] Tests (`pnpm test` + `pnpm test:dev-server`)
  - [ ] Build + parity/tarball/tokens/site-content gates
  - [ ] Desktop E2E green **against the packaged `.app`**
  - [ ] `a11y-auditor`: 0 blockers — every move reachable without a mouse
  - [ ] `design-system-guard`: 0 blockers
- [ ] `apps/studio/dist/` committed release-minified, nothing unminified slipped in
- [ ] DDR recorded (Task 14) — no DDR-worthy decision left unrecorded
- [ ] What's New entry appended via the `whats-new-entry` skill at `/flow:done`
- [ ] No regressions in create/delete: existing `canvas-create-api` + delete tests green **unchanged**
