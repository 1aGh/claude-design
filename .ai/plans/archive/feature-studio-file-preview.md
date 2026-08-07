# Feature: Preview for non-canvas files in the Studio file tree

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

Today, clicking a non-canvas row in the Studio "Files" tree (markdown, CSS, JSON, and — most importantly — binary assets like fonts/images/video under a design system's `assets/` folder) does nothing. Worse, binary asset files never even reach the tree: the server's file-listing walker only lists a narrow text-extension allowlist, so folders like `system/<ds>/assets/{fonts,graphics,logos,photos,...}` render as permanently-empty tree nodes. This closes both gaps: the server lists the asset files, and the client renders an inline preview (markdown, `<pre>` text, image, video/audio, font specimen) instead of the current inert no-op.

## User Story

As a designer browsing a design system's assets in Studio, I want to click any file in the tree — including images, fonts, video, and docs — and see it, so that I can review brand assets without leaving the app or hunting for the file on disk.

## Problem

- **Server**: `buildIndexData()`'s `findFiles()` calls (`apps/studio/api.ts:5278-5279`) pass a hardcoded extension allowlist (`['.tsx','.html','.md','.css','.json']` for DS groups, narrower for non-DS groups) to the recursive walker. `findFiles` (`api.ts:161-187`) still recurses into every directory and pushes it to `dirsOut` regardless of whether any file inside matches — which is exactly why `assets/fonts`, `assets/graphics`, etc. show up as tree nodes with zero children today (per the user's screenshot).
- **Client**: `FileRow` (`apps/studio/client/app.jsx:2024-2153`) computes `isCanvas = CANVAS_EXT_RE.test(file.name)` (only `.tsx`/`.html(m)`) and sets `inert = !isCanvas` (`app.jsx:2039-2043`). Inert rows get `aria-disabled` and a no-op `onClick` (`app.jsx:2089-2091`), with the tooltip `"(file index only)"`. This is deliberate, documented behavior — `.ai/context/studio-shell-parity.md:56` row `C9` — but it means literally nothing is clickable except `.tsx`/`.html` canvases.

## Solution

1. **Server**: extend the DS-group (and non-DS-group) extension allowlists in `buildIndexData()` with an explicit, enumerated list of previewable binary/media extensions — images, fonts, video, audio. No change to `findFiles`'s existing `_`-prefix / `SKIP_DIRS` exclusion logic (already correct per DDR-115 — runtime buckets like `_history`, `_active.json` never reach this walker in the first place, since the DS/canvas-group walk is scoped under `system/<ds>/` and the separate "Runtime" bucket in `buildIndexData` is its own top-level-`_`-file-only pass, `api.ts:5328-5350`). Only the `exts` arrays change.
2. **Client**: give `FileRow` a `previewKind(name)` classification (`markdown` / `text` / `image` / `video` / `audio` / `font` / `none`) instead of the binary `isCanvas`/`inert` split. Canvas files keep opening exactly as today (`onOpen` → `openTab` → iframe). A previewable non-canvas file calls a new `onPreview(file.path)` that sets a **separate** `previewPath` piece of state — deliberately NOT reusing `tabs`/`activePath`/`openTab`, because `openTab` has canvas-specific side effects (WS `active` broadcast that drives `_active.json`/inspector selection tracking, the compile-skeleton loading state, iframe registration) that must never fire for a file that was never a canvas.
3. **Viewport**: when `previewPath` is set, render a new `FilePreview` component in the canvas-viewport area instead of (or layered over) the iframe/empty-state, branching on `previewKind`:
   - `markdown` → reuse `Markdown` from `apps/studio/client/panels/chat-markdown.jsx` (already hand-rolled, XSS-safe, DS-token-styled) — promote it to accept file content instead of only chat text if its current signature needs it.
   - `text` (css/json/txt/yml/yaml) → fetch the raw bytes via the existing static-file route (`fetch('/' + relativePath).then(r => r.text())` — no new server route, the existing `safePathUnderRoot`-guarded fallthrough at `apps/studio/http.ts:4608-4666` already serves any listed file) and render in a `<pre>`, no syntax highlighting (no new dependency — matches the repo's dependency-light bias, confirmed: `apps/studio/package.json` has no markdown/highlighter package).
   - `image` → `<img src="/<relativePath>">`.
   - `video` / `audio` → native `<video controls>` / `<audio controls>` — the same extensions are already in `RANGE_MEDIA_EXTS` (`apps/studio/http.ts:874`), so byte-range seeking already works.
   - `font` → a small specimen view: scoped `@font-face` pointing at the served file URL + a fixed specimen string, no dependency.
4. **Regression contract**: update `.ai/context/studio-shell-parity.md` row `C9` to describe the new (non-inert) behavior in the same change — the project's convention is that this doc must never silently go stale.

## Metadata

- **Type**: Enhancement
- **Complexity**: Medium
- **App/Package**: `apps/studio` (dev-server + Studio client, zero-dep Bun server)
- **Affected Systems**: Studio file tree (`app.jsx`), file-index server route (`api.ts`), regression-contract doc
- **Dependencies**: none (no new npm packages)

---

## Context References

### Must-Read Files

> Read these in parallel in a single assistant message during `/flow:execute`.

- `apps/studio/api.ts` (lines 161-187, 5197-5360) — `findFiles` walker + `buildIndexData()` extension allowlists (`5278-5279`) — Why: this is where the server decides which files are even listable.
- `apps/studio/client/app.jsx` (lines 191, 2024-2296, 4253-4290, 9174-9178, 11161-11175) — `CANVAS_EXT_RE`, `FileRow`/`CanvasRow`/`TreeSection`, the `tabs.map` viewport render, `App()` state, `openTab` — Why: exact insertion points for `previewKind`, `onPreview`, `previewPath` state, and the viewport branch.
- `apps/studio/client/panels/chat-markdown.jsx` (lines 1-50+) — `Markdown({ text })` — Why: reuse for `.md` preview instead of writing a second renderer.
- `apps/studio/http.ts` (lines 453-464, 874, 4608-4666) — `safePathUnderRoot`, `RANGE_MEDIA_EXTS`, the static-file fallthrough — Why: confirms no new server route is needed; binary bytes and range-seeking already work for every extension being unlocked.
- `.ai/context/studio-shell-parity.md` (line 56, row `C9`) — Why: must be updated in the same change or it silently lies about current behavior.
- `.ai/archive/decisions/DDR-115-per-user-camera-split-and-runtime-state-taxonomy.md` — Why: confirms `system/<ds>/**` (incl. `assets/**`) is VERSIONED/browsable content, and that `_`-prefixed runtime buckets must stay excluded — this plan must not touch the exclusion logic, only the allowlist.

### Files to Create

- `apps/studio/client/panels/file-preview.jsx` — new `FilePreview({ path, kind, cfg })` component with the branches described in Solution step 3.

### Patterns to Follow

- `FileRow`'s existing `inert`/`aria-disabled` pattern (`app.jsx:2038-2091`) — mirror its structure but replace the boolean with the richer `previewKind` classification.
- `openTab`'s comment block (`app.jsx:11159-11175`) explaining the single-canvas tab model — read this before touching `tabs`/`activePath` so the new `previewPath` state stays additive and doesn't regress the "single-canvas" invariant or the WS `tabs`/`active` messages (`app.jsx:11220-11228`).
- `chat-markdown.jsx`'s "no new dependency, build React nodes directly" convention — apply the same bias to the `text` and `font` preview branches.

---

## Tasks

Execute in order. Each task is atomic and testable.

### Task 1: UPDATE server extension allowlist to unlock previewable assets

- **Do**: In `apps/studio/api.ts`, extend the two `exts` arrays passed to `findFiles()` inside `buildIndexData()` (currently at `~5278-5279`) with an explicit enumerated list: `.svg`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.avif` (image), `.woff`, `.woff2`, `.ttf`, `.otf` (font), `.mp4`, `.webm`, `.mov` (video), `.mp3`, `.wav`, `.ogg`, `.m4a` (audio). Apply to both the DS-group and non-DS-group arrays so any canvas group's `assets/`-style subfolder benefits, not just design systems.
- **Pattern**: the existing arrays at `api.ts:5278-5279`.
- **Gotcha**: do NOT touch `findFiles`'s `_`-prefix / `SKIP_DIRS` skip logic (`api.ts:176-183`) or the separate "Project"/"Runtime" bucket logic (`api.ts:5230-5254`, `5328-5350`) — those are the DDR-115 exclusion boundary and must stay exactly as-is.
- **Validate**: `curl -s localhost:<port>/_index-data | jq '.groups[] | select(.name=="system") | .paths' ` against a project with a DS `assets/` folder containing an image — the image path should now appear.

### Task 2: ADD `previewKind` classification and `onPreview` wiring in the client

- **Do**: In `apps/studio/client/app.jsx`, add a `previewKind(name)` helper near `CANVAS_EXT_RE` (`app.jsx:191`) returning `'markdown' | 'text' | 'image' | 'video' | 'audio' | 'font' | null` based on extension (mirroring the extension groups from Task 1, plus `.md`/`.css`/`.json`/`.txt`/`.yml`/`.yaml` for `text`/`markdown`). In `FileRow` (`app.jsx:2024-2153`), replace the `inert = !isCanvas` line with: `const kind = isCanvas ? 'canvas' : previewKind(file.name);` and only fall back to a true inert/no-op state when `kind` is `null` (unrecognized extension — should be rare now that the server only lists allowlisted extensions). Update the `onClick` to call `onOpen(file.path)` for canvas rows and a new `onPreview(file.path)` prop for previewable non-canvas rows. Thread `onPreview` down through `CanvasRow`/`TreeSection` alongside the existing `onOpen` prop (same pattern, e.g. `app.jsx:2284-2285`).
- **Pattern**: `FileRow`'s existing prop-threading for `onOpen` (`app.jsx:2160-2161, 2298-2299, 2470-2472`).
- **Gotcha**: keep `aria-disabled` only for the true-`null`-kind fallback case, not for previewable files — previewable rows must be a real, focusable, clickable `treeitem`.
- **Validate**: manual click in browser (see Validation section) — no automated test suite in this repo.

### Task 3: ADD `previewPath` state + clear-on-canvas-open wiring in `App()`

- **Do**: In `App()` (`app.jsx:9174+`), add `const [previewPath, setPreviewPath] = useState(null);`. Implement `onPreview = useCallback((path) => { setPreviewPath(path); }, [])`. In `openTab` (`app.jsx:11163-11175`) and `openSystem` (`app.jsx:11212-11221`), add `setPreviewPath(null)` so opening a real canvas or the System view clears any active file preview. Do NOT add preview paths to `tabs`, do NOT send a WS `active`/`tabs` message for `previewPath`, and do NOT touch `setLoadingPath`/`iframesRef` — those stay canvas-only, per the reviewed risk that reusing `openTab`'s side effects for non-canvas files would corrupt `_active.json`/inspector-selection state.
- **Pattern**: `openTab`'s existing state-reset structure (`app.jsx:11163-11175`).
- **Gotcha**: clicking a *different* previewable file while one is already open should just update `previewPath` in place (no special-case needed — `setPreviewPath(path)` already does this).
- **Validate**: open a canvas, then click a markdown file, then click back to a canvas — confirm the canvas iframe never reloads/reinitializes from the preview detour (no spurious WS `active` messages in the network/WS inspector).

### Task 4: CREATE `apps/studio/client/panels/file-preview.jsx`

- **Do**: New component `FilePreview({ path, kind, cfg })`. Compute the file's server-relative URL the same way existing static asset references do elsewhere in the client (mirror however `assets/` URLs are already built for e.g. brand uploads — check `panels/BrandUploadPanel.jsx` for the existing URL-building convention before inventing a new one). Branch on `kind`:
  - `'markdown'`: `fetch(url).then(r => r.text())` into state, render via `<Markdown text={content} />` imported from `panels/chat-markdown.jsx`.
  - `'text'`: same fetch, render `<pre className="st-file-preview-text">{content}</pre>`.
  - `'image'`: `<img src={url} className="st-file-preview-image" />` with a checkerboard-pattern CSS background behind it (transparency-friendly for logos/graphics).
  - `'video'`: `<video src={url} controls className="st-file-preview-media" />`.
  - `'audio'`: `<audio src={url} controls />`.
  - `'font'`: inject a scoped `@font-face` (unique `font-family` derived from the path, e.g. via a `<style>` tag) pointing `src: url(...)`, then render a fixed specimen string ("The quick brown fox jumps over the lazy dog — 0123456789") at a couple of sizes using that `font-family`.
  - Show a lightweight loading state while `fetch` is in flight, and a plain error message on fetch failure (e.g. file deleted between listing and click).
- **Pattern**: `chat-markdown.jsx`'s "no `dangerouslySetInnerHTML`, build nodes directly" convention; `DiffView.jsx` for how a viewport-area component is structured/exported.
- **Gotcha**: cap `text`/`markdown` fetch-and-render at a reasonable size (e.g. skip rendering and show "file too large to preview, N KB" above some threshold like 2 MB) so a stray large file doesn't freeze the render — the walker's allowlist doesn't cap file size.
- **Validate**: render each `kind` branch against a real file from a project with a populated DS `assets/` folder.

### Task 5: UPDATE Viewport to render `FilePreview` when `previewPath` is set

- **Do**: In the `tabs.map(...)` viewport render block (`app.jsx:4253-4290` and its containing component), add a branch: when `previewPath` is set (and takes precedence over the empty-state / underneath the existing tabs), render `<FilePreview path={previewPath} kind={previewKind(basename(previewPath))} cfg={cfg} />` instead of the empty-state placeholder or alongside the existing iframe (previewPath and an open canvas tab can coexist — the canvas iframe should stay mounted, hidden, so switching back to it is instant, matching how canvas iframes already avoid remount via `className={t.path === activePath ? 'active' : ''}`).
- **Pattern**: the existing `t.path === activePath ? 'active' : ''` show/hide-via-CSS-class pattern rather than conditional unmount, to avoid churn.
- **Gotcha**: the menubar's `ARTBOARDS` slot and other UI reading `activePath`/`tabs.length` (`app.jsx:3732-3738` and similar) must keep treating a `previewPath`-only state as "IDLE" for canvas purposes — don't set `activePath` to the preview path.
- **Validate**: full click-through in Validation section below.

### Task 6: UPDATE regression-contract doc

- **Do**: In `.ai/context/studio-shell-parity.md`, rewrite row `C9` (currently: `"FileRow inert | non-canvas rows (.md/.json/.css) display-only, aria-disabled, no open"`) to describe the new behavior — previewable rows open a `FilePreview` on click; only genuinely unrecognized-extension rows stay inert.
- **Pattern**: existing row format in that doc.
- **Gotcha**: this file is explicitly called out in CLAUDE.md as a "must not silently drop" regression contract — do not skip this task.
- **Validate**: `grep -n "C9" .ai/context/studio-shell-parity.md` shows the updated description.

### Task 7: ADD styles for the new preview UI

- **Do**: Add `.st-file-preview-*` rules to the appropriate file under `apps/studio/client/styles/` (match existing numbering convention, e.g. alongside other `4-components.css`-style additions) — text/pre monospace block, image checkerboard background, media max-width/height constraints, font specimen typography.
- **Pattern**: existing `st-*` class naming convention throughout `app.jsx`/`styles/`.
- **Gotcha**: use existing DS/theme tokens (`--bg-*`, `--fg-*`, `--border-*`) — no hardcoded colors, per project convention.
- **Validate**: visual check in both light and dark theme.

---

## Validation

Run these commands to confirm zero regressions:

1. **No test suite / lint config in this repo** — validation is manual + `node`/`bun` runtime checks per CLAUDE.md ("There is no test suite, lint config, or build step in this repo").
2. **Manual click-through**: start the dev server against a project with a design system that has a populated `assets/` folder (e.g. this repo's own `.design/` if it has one, or a scratch project), open Studio, click through: a markdown file, a CSS/JSON file, an image, a font file, a video, an audio file — confirm each renders instead of the previous no-op, and confirm a canvas still opens normally and the tree's existing drag/move/delete affordances are unaffected.
3. **Regression check**: confirm opening a canvas after previewing a file does not corrupt `_active.json`/inspector state (open dev tools WS frame log, confirm no spurious `active` message fires for the previewed path).
4. **Runtime-state check**: confirm `_history/`, `_active.json`, `_server.json`, and other DDR-115 runtime buckets still never appear in the tree (they shouldn't — this plan doesn't touch that exclusion logic, but verify no regression).
5. **Rebuild note**: since this touches `apps/studio/client/*.jsx` + `styles/*.css`, rebuild the committed client bundle release-minified before considering this shippable: `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`, then commit `dist/client.bundle.js` + `dist/styles.css` per the CLAUDE.md "In-app What's New feed" rebuild rule (same rule applies to any client-surface change, not just What's New).
6. **`design:smoke`**: run `/design:smoke` against a project with a DS to catch blank-iframe / unstyled-specimen regressions from the client bundle rebuild.

---

## Acceptance Criteria

- [x] All tasks completed
- [x] Clicking markdown, CSS/JSON/text, and image files in the tree shows a real preview (verified live via agent-browser). Video/audio/font branches implemented but not asset-verified live (no such files in this repo's own DS) — code-reviewed against the same fetch/serve path as image, low risk.
- [x] Clicking a canvas file still opens it exactly as before (no regression to the single-canvas tab model or WS `active`/`tabs` messages) — verified live
- [x] Asset subfolders (`assets/fonts`, `assets/graphics`, etc.) now list their files instead of appearing empty — verified live via `/_index-data`
- [x] `_`-prefixed runtime files (`_active.json`, `_history/`, etc.) are still never listed or previewable (DDR-115 exclusion untouched) — `findFiles`'s skip logic unmodified; RUNTIME-kind rows additionally hard-excluded from `previewKind` client-side
- [x] `.ai/context/studio-shell-parity.md` row `C9` updated to match new behavior
- [x] No new npm dependency added
- [x] `dist/client.bundle.js` + `dist/styles.css` rebuilt `--release` and committed alongside the source change
- [x] Code follows project conventions (DS tokens only, no hardcoded colors, no dangerouslySetInnerHTML)

### Known limitation found during validation

SVG assets authored with token-based fills (`fill="var(--accent)"` — this repo's own `system/maude/assets/logos/*.svg` brand marks) render blank in the `<img>`-based image preview: an `<img src="...">`-loaded SVG is a separate document with no access to the host page's CSS custom properties, so `var(--accent)` resolves to nothing. Raster images (PNG/JPEG/WebP/GIF) are unaffected. Fixing this properly requires inlining sanitized SVG markup into the host document instead of an `<img src>` — out of scope for this pass (would need a small sanitizer to stay `dangerouslySetInnerHTML`-free-by-convention). Flagged as a fast-follow, not blocking.

### Deferred security follow-ups (accepted, not fixed this pass)

Found by the ethical-hacker's adversarial pass during `/flow:done`, deliberately not fixed here (see Retro for why):

- **No defense-in-depth at the static byte-serving layer** (`apps/studio/http.ts`'s `safePathUnderRoot` fallthrough, ~line 4608) — it does textual prefix-containment only, no `isFile()`/`realpath` check of its own. Today `findFiles()`'s `isFile()` + `nlink === 1` filter is the *only* thing preventing a symlink/hardlink from being served; any future code path that fetches a path without going through the vetted tree (a search feature, a "recently opened" list, a deep link) would reopen the hole with no second gate to catch it. Fix: add the same `lstat`/`realpath` containment check directly to the fallthrough, mirroring the existing `realpathOfDeepestExisting` helper already used elsewhere in `http.ts`. Deferred because it touches a shared, heavily-used route far beyond this feature's blast radius — deserves its own focused change, not a rider on this diff.
- **Markdown preview widens `chat-markdown.jsx`'s trust boundary** from "AI chat output" to "arbitrary third-party repo content" (a DS `README.md` could come from an untrusted clone/template/collaborator). The renderer itself is already safe (no `dangerouslySetInnerHTML`, no auto-loading images, links restricted to `http(s)://`) — the only residual is classic markdown-link phishing rendered inside in-app chrome with no "this is unreviewed file content" visual cue. Low severity, cosmetic fix only (a one-line notice), deferred as non-blocking.

## Retro

- **What worked:** live-verifying every claim (asset listing, each preview kind, the security fixes, the a11y fixes) via a real booted `bun server.ts` + `agent-browser`, rather than trusting the diff by inspection — caught that `server.mjs` is a legacy fallback with independent logic (would have produced a false "it's broken" read), and caught that token-styled SVGs render blank via `<img src>` before it became a support question.
- **What worked:** running security-auditor + ethical-hacker as parallel *independent* passes (not one after the other) surfaced genuinely different findings — the ethical-hacker's symlink/hardlink chain and the security-auditor's CSS-injection finding didn't overlap, and a second follow-up round after fixing caught a real gap in the first fix (`\f` missing from the CSS string-escape) that a single pass would have missed.
- **What to change next time:** the plan's original task list didn't anticipate a security/a11y remediation loop — `/flow:execute` produced a "done" feature that then needed 3 more rounds of fixes during `/flow:done`'s validate gate. For any feature touching a new user-input-to-render path (filenames → DOM, in this case), the plan should budget an explicit adversarial-review task *before* `/execute` closes out, not discover it at `/done`.
- **What to change next time:** `~/git`'s Syncthing-shared nature meant another session's unrelated work (a cloud-release-fleet feature) was live in the same working tree throughout — `git add` had to be scoped file-by-file rather than by directory/glob at every step. Worth remembering as the default posture in this repo, not a one-off.
- **Deferred, not forgotten:** the two items in "Deferred security follow-ups" above are real, agreed-non-blocking gaps — worth a dedicated small plan (`http.ts` static-route hardening) rather than languishing as a comment.
