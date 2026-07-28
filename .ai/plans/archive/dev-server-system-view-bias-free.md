# Feature: Dev-server system view — bias-free token + type rendering

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

The dev-server's "design system view" (MDCC-DSN/01, accessed via the System tab in the sidebar) shows the **Maude UI shell's own chrome tokens** instead of the user's actual design-system tokens. The bug is hardcoded plus dual-document (`TokenLadder` reads from `document.documentElement` of the shell, not the user's CSS), so for any project whose DS doesn't use the canonical `--bg-0..4 / --fg-0..3 / --accent*` naming, the overview is meaningless. Even for projects that DO use the canonical names, the values come from the dev-server's amber-rust catalog stamp, not the user's tokens.

This fix makes the system view bias-free: it renders **whatever tokens the user's `colors_and_type.css` actually declares**, with **whatever names and values** are in that file. The shell chrome stays isolated and never leaks into user-facing rendering.

## User Story

As a designer running `/design:setup-ds` against any project (canonical-named DS OR imported existing DS with custom token names), I want the "design system view" to show **my actual tokens** — names, values, themes — so I can verify what I have, what's missing, and how it renders, without the Maude UI's own brand leaking through.

## Problem

Two layered defects:

1. **Wrong document.** `TokenLadder` in `plugins/design/dev-server/client/app.jsx:1107-1131` calls `getComputedStyle(document.documentElement)`. That is the **dev-server shell's** root, not the user's iframe. The shell document has its own tokens defined by `plugins/design/dev-server/client/styles/1-tokens.css` (the amber-rust "catalog stamp" theme of Maude itself).

2. **Hardcoded name list.** `TOKEN_NAMES` (`app.jsx:1096-1102`) and `TYPE_STEPS` (`app.jsx:1103`) hardcode the canonical naming convention (`--bg-0..4`, `--fg-0..3`, `--accent*`, `--type-xs..3xl`, `--lh-xs..3xl`). Even if the read-from-correct-document fix landed, any DS that uses non-canonical names (e.g. `--color-bg`, `--color-primary-bg`, `--accent-fg-on-cream`, `--fs-base`) would still display nothing or fall back to shell values.

3. **Per-DS tokens path not auto-resolved.** Config schema supports `designSystems[].tokensCssRel`, but when the entry omits it, the server falls back to `cfg.tokensCssRel` (default `system/colors_and_type.css`) — which doesn't match the actual scaffolded location (`system/<dsName>/colors_and_type.css`). For multi-DS projects or projects where the DS is nested under `system/<name>/`, the server reads no tokens at all and the overview is empty (or, currently, displays shell garbage because the client ignores the empty server response).

4. **Single-DS overview only.** `buildSystemData()` reads one tokens file. The schema declares an array `designSystems[]`. Overview rendering does not know which DS is being shown.

Concrete failure observed: `/Volumes/D/git/AI-StudyMate/.design` has DS `studyfi` at `system/studyfi/colors_and_type.css` (custom names: `--color-bg`, `--accent: #9CACFF` periwinkle, `--color-text-primary`, …). The overview shows orange `--accent: oklch(56% .17 50)`, cream `--bg-0`, etc. — those are 100% the dev-server's chrome tokens from `1-tokens.css:46-65`. Specimens render correctly because each specimen iframe imports the user's CSS via `canvas-shell`.

## Solution

Five coordinated changes — together they remove every shell→user bias path in the system view:

1. **Drop hardcoded token name arrays.** `TokenLadder` and `TypeLadder` receive parsed tokens via props (server already returns `data.tokens` + `data.tokenGroups` from the parsed user CSS). No `TOKEN_NAMES`, no `TYPE_STEPS`.

2. **Render swatches from raw parsed values, not `var()`.** `style={{ background: t.value }}` instead of `style={{ background: 'var(' + t.name + ')' }}`. The raw OKLCH / hex / rgb string from the file is the source of truth; the shell document doesn't need to know that token exists. Same for type tokens — use the parsed `value` (e.g. `1rem`) as `fontSize`.

3. **Auto-resolve per-DS `tokensCssRel`.** In `context.ts`, if `designSystems[i].tokensCssRel` is missing, default to `<designSystems[i].path>/colors_and_type.css`. Top-level `cfg.tokensCssRel` becomes a project-wide fallback (kept for backwards compat with single-DS projects that don't declare `designSystems`).

4. **Per-DS overview.** `/_api/system?ds=<name>` returns the data scoped to a single DS. The client adds a DS picker in the system view header when `designSystems.length > 1`. Default DS = `cfg.defaultDesignSystem` (already in schema) or first entry.

5. **Iframe-mounted preview row (Phase 2 — follow-up).** For full fidelity (light/dark toggle, user fonts loaded, true `var()` resolution against the user's CSS), render the token + type ladders inside an iframe that imports the DS's `colors_and_type.css` and any sibling fonts. This is the "specimen as a canvas" treatment — same shell as `Gallery` previews. **Defer to a follow-up unless the inline raw-value rendering proves insufficient** (the parsed value should suffice for swatch colors; the gap is mainly font rendering and computed values via `color-mix` / `relative-color`).

The token NAME contract from DDR-043 (canonical `--bg-0..4` etc. for scaffolded DSes) **stays unchanged** — that's the convention for new scaffolds and what the completeness-critic enforces. The system view simply stops *assuming* names exist and renders whatever the file actually contains.

The dev-server shell chrome (`1-tokens.css`) **stays unchanged** — it is the Maude UI's own theme, not user-facing. Only the comment at the top of that file gets a clarifying edit to call out the isolation.

## Metadata

- **GitHub Issue**: n/a (reported in chat by user, 2026-05-26, against StudyFi DS bootstrap)
- **Type**: Bug Fix + tightening of DDR-043 (bias-free) coverage into the dev-server runtime
- **Complexity**: Medium — multi-file (client `app.jsx`, server `api.ts`, `context.ts`), but bounded scope (system view only; canvases + specimens are unaffected)
- **App/Package**: `plugins/design/dev-server`
- **Affected Systems**: dev-server HTTP `/_api/system` endpoint, client React `SystemView` + `TokenLadder` + `TypeLadder`, config resolver (`context.ts`), config schema docs
- **Dependencies**: none (no new packages; uses already-parsed server data)

---

## Context References

### Must-Read Files

- `plugins/design/dev-server/client/app.jsx` (lines 1094-1190, `TOKEN_NAMES` + `TYPE_STEPS` + `TokenLadder` + `TypeLadder` + `SystemView`) — the rendering layer that needs to be rewritten. Note `SystemView` already receives `data` from `/_api/system` but only uses `previewGallery`, `uiKitsGallery`, `systemDir` — `tokens` and `tokenGroups` are returned by the server and ignored.
- `plugins/design/dev-server/api.ts` (lines 720-870, `tokenKind` + `parseTokens` + `buildSystemData`) — the server-side parser. Already does the right thing: regex `(--[a-z][a-z0-9-]*)\s*:\s*([^;}]+);` returns every CSS custom property regardless of name. `tokenKind` heuristic groups into `color`, `fontsize`, `font`, `radius`, `shadow`, `space`, `weight`, `leading`, `motion`, `other` — reuse as-is.
- `plugins/design/dev-server/context.ts` (lines 16-59, `DesignSystemEntry` + `DEFAULT_CONFIG`) — where per-DS `tokensCssRel` auto-resolution must land.
- `plugins/design/dev-server/client/styles/1-tokens.css` (lines 1-18, the preamble) — comment needs clarifying note "this is the dev-server SHELL theme, not a user DS template" so the next reader doesn't repeat the confusion.
- `plugins/design/dev-server/server.mjs` (lines 988-1052, legacy parallel implementation of `buildSystemData`) — the legacy Node entry. Per CLAUDE.md DDR-009, dev-server is migrating to Bun-authoritative; the `.mjs` file is being phased out. Apply the SAME server-side change here so both runtimes stay in lockstep until `.mjs` is removed. Use `Bun.*` APIs in `.ts`, `node:` in `.mjs`.
- `plugins/design/dev-server/http.ts` (lines 339-352, `/_config` endpoint) — currently exposes `tokensCssRel: ctx.cfg.designSystems?.[0]?.tokensCssRel ?? ctx.cfg.tokensCssRel`. After the per-DS resolution lands in `context.ts`, this falls out naturally because entries will always have `tokensCssRel` populated.
- `plugins/design/dev-server/config.schema.json` (lines 53-200, `tokensCssRel` + `designSystems`) — update the description of `tokensCssRel` to document the auto-resolution default; bump schema version if appropriate.
- `.ai/archive/decisions/DDR-043-bias-free-design-plugin-templates.md` — the source-of-truth principle this fix extends. Reference in the new DDR.
- `.ai/archive/decisions/DDR-025-canvas-lib-single-source-in-dev-server.md` — same isolation philosophy applied to `canvas-lib`. The lesson is the same: dev-server internals must not leak into user content.

### Files to Create

- `.ai/archive/decisions/DDR-047-dev-server-system-view-no-shell-bias.md` — record the isolation invariant (system view reads user tokens only; shell chrome never participates) and the per-DS `tokensCssRel` auto-resolution.

### Files to Change

- `plugins/design/dev-server/client/app.jsx` — rewrite `TokenLadder` + `TypeLadder`, drop `TOKEN_NAMES`/`TYPE_STEPS`, thread `data.tokens`/`data.tokenGroups` from `SystemView`, add DS picker.
- `plugins/design/dev-server/api.ts` — add `ds` query param to `/_api/system` handler; scope `buildSystemData` to a single DS entry.
- `plugins/design/dev-server/context.ts` — per-DS `tokensCssRel` auto-resolution in `createContext` (or a helper called from there).
- `plugins/design/dev-server/server.mjs` — mirror the per-DS resolution + `ds` param (until the Node entry is fully retired).
- `plugins/design/dev-server/http.ts` — update `/_config` to expose `designSystems[]` with resolved per-DS `tokensCssRel` so the client can pass `?tokens=<file>` per DS.
- `plugins/design/dev-server/config.schema.json` — document the auto-resolution rule.
- `plugins/design/dev-server/client/styles/1-tokens.css` — clarifying comment only (no code change).

### Documentation

- DDR-043 — bias-free templates (the parent principle).
- DDR-009 — Bun-authoritative runtime (why both `.ts` and `.mjs` need the fix until Phase 3.4 Task 7).
- DDR-025 — canvas-lib single source (sibling isolation rule).
- CSS custom property cascade behavior — relevant for understanding why raw `value` is the right answer for swatches, not `var()`. Reference: [MDN — Using CSS custom properties (variables)](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties#cascade).

### Patterns to Follow

The server-side parser is already correct and bias-free — mirror its philosophy in the client:

```ts
// api.ts:753 — token names are whatever the user wrote, no assumption.
function parseTokens(css: string) {
  const re = /(--[a-z][a-z0-9-]*)\s*:\s*([^;}]+);/gi;
  // ... returns { name, value, kind } for every property declaration.
}
```

For iframe-mounted gallery rendering (the Phase 2 follow-up), follow the `Gallery` component pattern (`app.jsx:1183-1206`) that already mounts user previews with `canvasUrl(p.path, cfg)`. The same shell can mount a token-ladder specimen.

---

## Design Decisions

> System view is a chrome-rendered overview, not a canvas. No new UI components beyond what already exists in the dev-server shell. Tokens/typography of the shell itself stay as defined in `1-tokens.css`.

### Components (from existing shell)

| Component       | Source                          | Notes                                                     |
| --------------- | ------------------------------- | --------------------------------------------------------- |
| `SystemView`    | `client/app.jsx:1153-1190`      | Wrap with DS picker when `designSystems.length > 1`       |
| `TokenLadder`   | `client/app.jsx:1110-1142`      | Rewrite: accept `tokens` + `tokenGroups` props            |
| `TypeLadder`    | `client/app.jsx:1144-1162`      | Rewrite: accept type-kind tokens + leading-kind tokens    |
| `Gallery`       | `client/app.jsx:1183-1206`      | Reuse for iframe-mounted ladders if Phase 2 lands         |

### Tokens (shell chrome — unchanged)

Shell tokens stay in `client/styles/1-tokens.css`. They are the dev-server UI's own theme and are **not** rendered for the user as DS content. Add a clarifying preamble comment.

### Custom Components Needed

None. All work is inside existing files.

---

## Tasks

Execute in order. Each task is atomic and testable.

### Task 1: ADD per-DS `tokensCssRel` auto-resolution in `context.ts`

- **Do**: In `createContext()` (or a new `normalizeDesignSystems(cfg)` helper called from it), after `loadConfig(repoRoot)`, walk `cfg.designSystems ?? []`. For each entry where `tokensCssRel` is missing, set it to `path.posix.join(entry.path, 'colors_and_type.css')`. Also expose `cfg.tokensCssRel` (top-level) as the project-wide fallback for legacy single-DS configs that don't declare `designSystems`.
- **Pattern**: mirror the path normalization at `context.ts:152-154` (already trims slashes; do the same for per-DS path).
- **Gotcha**: do NOT mutate the original config object in a way that round-trips back to disk. Normalize into a new derived structure (`cfg` is mutable in TS but the data should be treated as read-only). Also: `entry.path` may itself be absolute or contain a leading slash — strip.
- **Validate**: write a `bun:test` unit test in `plugins/design/dev-server/test/context-resolve-tokens.test.ts` covering (a) no `designSystems` → fallback to top-level, (b) entry without `tokensCssRel` → derived from `path`, (c) entry with explicit `tokensCssRel` → unchanged, (d) `designSystems[].path` with leading slash → normalized.

### Task 2: ADD `?ds=<name>` scoping to `buildSystemData` in `api.ts`

- **Do**: Change `buildSystemData()` signature to accept an optional `dsName` parameter. When provided, scope `sysAbs`/`sysRel` to `designSystems[i].path`, read `tokensAbs` from `designSystems[i].tokensCssRel`, and limit `galleryFor()` matches to that DS folder. When omitted, preserve current behavior (top-level scan) for backwards compat.
- **Do (handler)**: In the HTTP handler that calls `buildSystemData`, parse `?ds=<name>` from the URL and pass through. Validate the name exists in `cfg.designSystems`; on miss return 404 with `{ error: "unknown design system" }`.
- **Pattern**: see `api.ts:654` for an existing `designSystems` filter usage as the precedent for safe lookup.
- **Gotcha**: keep response shape stable for the non-`ds` case (`tokens`, `tokenGroups`, `previewGallery`, `uiKitsGallery`, `systemDir`, `tokensPath`); the client falls back gracefully when the server hasn't been redeployed yet. Also: when `dsName` is set, include `ds: { name, path, description }` in the response so the client can render the picker label.
- **Validate**: extend (or add) `plugins/design/dev-server/test/api-system-endpoint.test.ts` — assert (a) unscoped call returns top-level data, (b) `?ds=studyfi` returns tokens parsed from the studyfi path, (c) `?ds=unknown` returns 404.

### Task 3: MIRROR per-DS resolution + `?ds` param in `server.mjs`

- **Do**: Apply the same logic from Task 1 + Task 2 to the legacy Node entry (`server.mjs:988-1052`). Keep it API-compatible with the `.ts` server so user-facing behavior matches whichever runtime is live.
- **Pattern**: the existing `server.mjs:993-1004` already reads `CFG.tokensCssRel`. Wrap in the same per-DS lookup.
- **Gotcha**: per CLAUDE.md DDR-009, `.mjs` is being retired. Don't add new conveniences here — just enough to keep parity until `.mjs` is removed in Phase 3.4 Task 7. Use `node:path` (already imported), not `Bun.*`.
- **Validate**: launch `node plugins/design/dev-server/server.mjs --root /Volumes/D/git/AI-StudyMate` and hit `/_api/system?ds=studyfi` with `curl` — assert the response contains parsed studyfi tokens.

### Task 4: REWRITE `TokenLadder` to consume server-parsed tokens

- **Do**: Drop the `TOKEN_NAMES` constant (lines 1096-1102) and the `readTokens` helper (lines 1104-1108). Rewrite `TokenLadder` to accept `tokens` and `tokenGroups` props. Iterate over `tokenGroups.color` for the surface/ink ladder (rendered with `style={{ background: t.value }}`). Display the token name (`code.sv-tok-name`) and the raw `value` (`span.sv-tok-value`). Show one section per non-empty group, in the order the file declared them (preserve `tokens[]` array order — `parseTokens` already returns insertion order).
- **Do**: Empty state — if `tokens.length === 0`, render `<p>No tokens parsed from <code>{tokensPath}</code>. Does the file exist?</p>`.
- **Pattern**: keep the existing `sv-section`, `sv-tokens-ladder`, `sv-tok-cell` class structure — only the data plumbing changes.
- **Gotcha**: do NOT subscribe to `MutationObserver` on `document.documentElement` (the old `useEffect` pattern) — there is no longer a need to re-read on theme switch, because the value is parsed from file once. If/when Task 6 (Phase 2) iframe-mounts the ladder, theme toggle reactivity returns naturally inside the iframe via the user's CSS `[data-theme]` blocks.
- **Validate**: rebuild `dist/client.bundle.js` (`bun run build.ts` at `plugins/design/dev-server/`), boot the server against AI-StudyMate (`bun plugins/design/dev-server/server.ts --root /Volumes/D/git/AI-StudyMate`), open `http://localhost:<port>` → System tab → assert swatches show periwinkle `--accent: #9CACFF`, cream `--color-primary-bg: #fbfaf7`, etc., NOT the amber-rust shell tokens.

### Task 5: REWRITE `TypeLadder` to consume server-parsed type tokens

- **Do**: Drop the `TYPE_STEPS` constant (line 1103). Rewrite `TypeLadder` to iterate `tokenGroups.fontsize`. For each, render the sample text with `style={{ fontSize: t.value }}`. Match leading by name pattern: for a type token `--type-xs`, look for `--lh-xs` in `tokenGroups.leading`; for `--fs-base`, look for `--lh-base`; if no match found, omit `lineHeight` (let browser default apply). For the font-family used in the sample, read `tokenGroups.font[0]?.value` if present.
- **Pattern**: same section structure as before; only the source changes.
- **Gotcha**: type tokens in the wild use varied prefixes (`--type-*`, `--fs-*`, `--text-*`). The `tokenKind` heuristic in `api.ts:742` already catches all three via `/(font-size|fs|text)/`. Trust the kind; do not add a second prefix filter in the client.
- **Validate**: visual check — for AI-StudyMate, assert the type ladder shows `--fs-xs` (12 px) up through `--fs-2xl` (24 px) in Inter (`--font-body: 'Inter'`), NOT in Berkeley Mono (the shell font).

### Task 6: ADD DS picker in `SystemView` header (multi-DS only)

- **Do**: In `SystemView`, when `cfg.designSystems?.length > 1`, render a `<select>` next to the `sv-sku` label that lists each DS by `name`. On change, refetch `/_api/system?ds=<name>` and update local state. Default selection = `cfg.defaultDesignSystem ?? designSystems[0].name`.
- **Do**: For single-DS projects (and legacy projects without `designSystems`), skip the picker entirely and call `/_api/system` (no query param), preserving current behavior.
- **Pattern**: pure presentational `<select>` styled with existing `sv-*` chrome classes. No router change — the picker holds state in `SystemView` and triggers fetch.
- **Gotcha**: when `designSystems[i].description` is set, show it under the header as a one-line subtitle (small, muted) so the user sees context per-DS. Keep description rendering plain text — no markdown parser, no link expansion.
- **Validate**: requires a multi-DS fixture. Add `plugins/design/dev-server/test/fixtures/multi-ds/.design/config.json` with two DSes (`alpha` + `beta`) and matching `colors_and_type.css` files at each path. Launch the server with `--root` pointing to the fixture and verify the picker switches both the displayed tokens AND the previews gallery.

### Task 7: UPDATE `1-tokens.css` preamble — clarify "shell theme, not user template"

- **Do**: Rewrite the comment block at `client/styles/1-tokens.css:1-18` to explicitly call out: (a) these tokens theme the **dev-server UI shell** (sidebar, status bar, header, comment panel, system-view chrome), (b) they are **not** a template for user design systems, (c) user DS tokens live in `<designRoot>/system/<ds>/colors_and_type.css` and are rendered by `SystemView` from the parsed file, not from this stylesheet. Remove the misleading "Source of truth: .design/system/project/colors_and_type.css (MDCC-DSN/01)" sentence.
- **Pattern**: keep the comment style consistent with neighboring `2-shell.css`, `3-*.css` files.
- **Gotcha**: keep the CSS itself untouched — values stay as-is. Comment-only edit.
- **Validate**: `grep -n "Source of truth" plugins/design/dev-server/client/styles/*.css` returns no false claim. `grep -n "shell theme" client/styles/1-tokens.css` returns the new note.

### Task 8: UPDATE `config.schema.json` — document `tokensCssRel` auto-resolution

- **Do**: Extend the `tokensCssRel` description (`config.schema.json:53`) to read: "Relative path from `designRoot` to the project-wide tokens CSS. Used as fallback when `designSystems` is unset OR an entry's per-DS `tokensCssRel` is missing. Default: `system/colors_and_type.css`." Extend the `designSystems[].tokensCssRel` description (~line 131) to read: "Per-DS tokens CSS path. When omitted, the server resolves it to `<designSystems[i].path>/colors_and_type.css`."
- **Pattern**: existing description style (one full sentence per field).
- **Gotcha**: this is a docs-only change to the schema. No `$id` / version bump needed because the resolved behavior is backwards-compatible (existing configs work identically; previously-broken configs now auto-resolve).
- **Validate**: `bun --print '(await Bun.file("plugins/design/dev-server/config.schema.json").json()).properties.tokensCssRel.description'` prints the new text.

### Task 9: WRITE DDR-047 and link from DDR-043

- **Do**: Create `.ai/archive/decisions/DDR-047-dev-server-system-view-no-shell-bias.md` documenting (a) the isolation invariant: dev-server shell chrome MUST NOT participate in user-facing token rendering; (b) the per-DS `tokensCssRel` auto-resolution rule; (c) why the canonical token-NAME contract from DDR-043 stays — but the system view does not depend on it.
- **Do**: Add a single line under DDR-043's "Related" footer pointing to DDR-047 ("DDR-047 extends bias-free templates into the dev-server runtime").
- **Pattern**: existing DDR style — Status, Context, Decision, Decision table (if useful), Consequences, References.
- **Gotcha**: keep the DDR short (≤ 300 lines). The decision IS small; the value is the invariant and the cross-link.
- **Validate**: `ls .ai/archive/decisions/DDR-047-*.md` exists.

### Task 10: REBUILD client bundle + manual smoke against AI-StudyMate

- **Do**: From `plugins/design/dev-server/`, run `bun run build.ts` to regenerate `dist/client.bundle.js` (this repo's CLAUDE.md notes the bundle is committed; the build step is needed when client source changes). Boot `bun plugins/design/dev-server/server.ts --root /Volumes/D/git/AI-StudyMate`. Open the served URL in a browser, click the System tab, verify:
  - Token swatches show **StudyFi** colors (periwinkle `#9CACFF` accent, cream `#fbfaf7` primary bg, the logo triangle palette), **not** the Maude amber-rust shell theme.
  - Token NAMES shown are StudyFi's (`--color-bg`, `--color-primary-bg`, `--accent`, `--color-text-primary`, `--color-custom-pink`, `--color-logo-blue`, …), **not** the canonical Maude scaffold names.
  - Type ladder shows StudyFi's font sizes (`--fs-xs` 0.75rem through `--fs-2xl` 1.5rem) rendered in Inter / Lexend Deca (per StudyFi `--font-body` / `--font-display`), **not** in Berkeley Mono (the shell font).
  - Light/dark theme toggle (if exposed) updates swatch values if StudyFi's CSS defines them per-theme.
- **Do**: Capture before/after screenshots and attach to the PR (or commit message body).
- **Gotcha**: ensure no leftover `_server.json` from a previous run keeps the old bundle alive — kill the prior PID first (`lsof -i :<port>` per CLAUDE.md).
- **Validate**: subjective + diff. The DDR-047 invariant: zero token names or values from `1-tokens.css` appear in the System tab for the StudyFi DS.

---

## Validation

Run these commands to confirm zero regressions:

1. **Types**: `bun --filter ./plugins/design/dev-server typecheck` (or whatever the actual typecheck script is — repo has no `pnpm`/`npm test` script per CLAUDE.md; reach for direct `bun build.ts --check` or `tsc --noEmit` if a `tsconfig.json` exists in `plugins/design/dev-server`).
2. **Tests**: `bun test plugins/design/dev-server/test/` — must include the new `context-resolve-tokens.test.ts` and `api-system-endpoint.test.ts` from Tasks 1 + 2.
3. **Build client bundle**: `cd plugins/design/dev-server && bun run build.ts` — must succeed and produce a bundle that loads without console errors.
4. **Build CLI**: `node cli/bin/maude.mjs design serve --root /tmp/scratch-with-design` — must boot without regression for the no-`designSystems` legacy single-DS case (tokens fallback to top-level `cfg.tokensCssRel`).
5. **Multi-DS fixture**: launch against `plugins/design/dev-server/test/fixtures/multi-ds/` and verify the DS picker switches both tokens and previews.
6. **AI-StudyMate manual smoke**: Task 10 — the canonical user-reproduced failure case.
7. **Version parity**: `scripts/check-version-parity.sh` — no version bump in this fix (it's a dev-server bug, not a marketplace change), but the script must still pass.

---

## Scenario Coverage (UI tasks — required)

> This is a dev-server chrome change. There is no formal `.ai/scenarios/` runner in this repo (CLAUDE.md: "no test suite, lint config, or build step"). The validation backbone for dev-server UI is direct manual smoke against a real project under `--root`.

**Manual scenario:**

| Scenario | Covers | Status |
|----------|--------|--------|
| `system-view-shows-user-tokens-bias-free` | User opens `/design:browse` (or hits the dev-server URL) on a project with a non-canonical-named DS; clicks System tab; verifies displayed tokens are theirs. Repeat with a canonical-scaffolded DS (e.g. this repo's own `.design/system/project/`). | 🆕 new (manual, documented in Task 10) |
| `system-view-multi-ds-picker` | Multi-DS fixture project — switching the picker changes tokens AND galleries. | 🆕 new (covered by Task 6 fixture + Task 10 smoke) |

No `scenario-runner` invocation — this repo doesn't ship that workflow for dev-server changes.

---

## Acceptance Criteria

- [ ] All 10 tasks completed
- [ ] AI-StudyMate System tab shows periwinkle accent + cream surfaces + StudyFi's actual token names (NOT amber-rust + canonical names)
- [ ] Single-DS legacy projects (no `designSystems` in config) still work unchanged
- [ ] Multi-DS fixture project surfaces a picker that switches both tokens and previews
- [ ] Empty-DS edge case (tokens file missing or unreadable) shows a helpful empty state instead of silently falling back to shell tokens
- [ ] `1-tokens.css` preamble explicitly disclaims being a user-DS template
- [ ] DDR-047 written and linked from DDR-043
- [ ] Schema descriptions updated to document the auto-resolution rule
- [ ] No reference to `TOKEN_NAMES` or `TYPE_STEPS` constants remains in `client/app.jsx`
- [ ] No reference to `document.documentElement` for token reading remains in `client/app.jsx`
- [ ] Client bundle rebuilt and committed (per CLAUDE.md, `client.bundle.js` is in git)
- [ ] Before/after screenshots attached to the PR

---

## Retro

- **What worked.** The plan correctly identified all three layers (wrong document / hardcoded names / single-tokensCssRel) before any code was touched, so the implementation was 10 atomic edits with no rework. Server-side parser was already bias-free (regex over `--[a-z][a-z0-9-]*`) — only the client and the per-DS resolution layer needed work.
- **What didn't.** I assumed DDR-047 was the next free slot; it was already taken by `collab-scope-cut`. Cost: one bulk sed across 9 files. Lesson: always `ls .ai/archive/decisions/ | tail -3` *before* drafting a DDR number into code comments.
- **What didn't, part 2.** The `/_system-data` HTTP path in `server.mjs` uses `reqPath === '/_system-data'` for routing, which silently drops `?ds=...` queries. Took one smoke iteration to catch. The Bun `.ts` entry uses `URL.searchParams` which handles this correctly — the legacy Node entry's flat string matching is a footgun worth retiring with the `.mjs` itself per DDR-009.
- **What to change in `/plan` next time.** The plan listed "Phase 2 — iframe-mounted system view" as a follow-up. After implementation I think the raw-value approach is enough for token + type rendering; iframe mount would only matter if we wanted live `color-mix()` / `relative-color` resolution or font fallback verification. Skipping it didn't hurt — `availableDesignSystems` + DS picker covered the real user need (StudyFi case).
- **What to change in `/execute` next time.** The DDR-021 smoke gate is a powerful integration check — running it after the bundle rebuild caught nothing (good) but the *value* was in the green light it provided across all 42 canvases that the new client code didn't regress per-canvas mounting. Keep this as the default for any `plugins/design/dev-server/**` change.

