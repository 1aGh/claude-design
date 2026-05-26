# DDR-048 — Dev-server System view must render user tokens, never shell chrome

**Status:** Accepted — 2026-05-26.
**Supersedes:** none.
**Related:** [DDR-043](DDR-043-bias-free-design-plugin-templates.md) (this extends bias-free templates into the dev-server runtime), [DDR-025](DDR-025-canvas-lib-single-source-in-dev-server.md) (sibling isolation rule), [DDR-009](DDR-009-bun-runtime-authoritative-for-dev-server.md) (Bun-authoritative — see `server.mjs` parity caveat).

## Context

The dev-server "Design system view" (MDCC-DSN/01, opened from the System tab) was supposed to render the user's design-system tokens — what colors, what type ladder, what radii a project ships. In practice it rendered the Maude UI shell's **own** chrome theme.

The bug had three layers:

1. **Wrong document.** `TokenLadder` called `getComputedStyle(document.documentElement)` against the shell root. The shell document has tokens defined by `plugins/design/dev-server/client/styles/1-tokens.css` (the amber-rust "catalog stamp" theme of Maude itself). Those values bled into the user-facing rendering.

2. **Hardcoded name list.** `TOKEN_NAMES = ['--bg-0..4', '--fg-0..3', '--accent*', '--status-*', '--border-*']` and `TYPE_STEPS = ['xs','sm','base','md','lg','xl','2xl','3xl']` were hardcoded constants in the client. Any DS that uses non-canonical names (e.g. StudyFi's `--color-bg`, `--color-primary-bg`, `--accent`, `--fs-base`, `--font-body`) was rendered as an empty list — except the names that happened to overlap with the shell's chrome (e.g. `--accent`), which read shell values.

3. **Single-DS tokens path.** Multi-DS projects declare each DS under `designSystems[]` with its own `path`, but `cfg.tokensCssRel` was a single top-level path. For a project with `designSystems: [{ name: "studyfi", path: "system/studyfi" }]` the server tried `system/colors_and_type.css` (top-level default), which doesn't exist — and silently fell back to empty, after which the client filled the gap with shell tokens.

Concrete failure case (2026-05-26): `/Volumes/D/git/AI-StudyMate/.design` has one DS `studyfi` with hand-written tokens at `system/studyfi/colors_and_type.css` mirroring the production StudyFi web app (periwinkle accent `#9CACFF`, cream surfaces `#fbfaf7`, Inter / Lexend Deca). The System view showed amber-rust `--accent: oklch(56% .17 50)`, cream `--bg-0: oklch(97.5% .008 78)`, Berkeley Mono type rendering — 100% the dev-server shell theme. Specimens (`colors-accent.tsx` etc.) rendered correctly because each specimen iframe loads the user's CSS via `canvas-shell`.

The shell's chrome tokens are not bias against the user — they are Maude's own UI theme and should stay. The bias is the **leak** between two distinct documents (shell ↔ user) that happen to share the canonical `--bg-*/--fg-*/--accent*` naming.

## Decision

**The System view renders user tokens, never shell tokens.** Five coordinated rules:

1. **No `document.documentElement` reads.** `TokenLadder` and `TypeLadder` receive parsed token data as React props. The shell document is irrelevant to user-facing rendering.

2. **No hardcoded name list.** Whatever the user's `colors_and_type.css` declared — names and values — is what shows up. The client groups by parser-assigned `kind` (`color`, `fontsize`, `font`, `radius`, `shadow`, `space`, `weight`, `leading`, `motion`, `other`) and renders every non-empty group in a fixed order.

3. **Render swatches from raw parsed values.** `style={{ background: t.value }}`, not `style={{ background: 'var(' + t.name + ')' }}`. The raw OKLCH / hex / rgb / hsl string from the file is the source of truth — the shell document doesn't need to know that token exists.

4. **Per-DS `tokensCssRel` auto-resolution.** In `normalizeDesignSystems(cfg)` (lives in `context.ts` + mirrored in `server.mjs`), every `designSystems[]` entry without an explicit `tokensCssRel` gets `<entry.path>/colors_and_type.css`. The top-level `cfg.tokensCssRel` stays as the project-wide fallback for legacy single-DS configs that don't declare `designSystems[]` at all.

5. **Per-DS scope on the System endpoint.** `/_system-data?ds=<name>` returns data scoped to one DS — its tokens, its preview gallery, its `rootClass`, its `themeDefault`. Unknown `ds` → 404 (no silent fallback). The client adds a DS picker in the header when `designSystems.length > 1`. The initial unscoped fetch returns the full DS list + a `defaultDesignSystem` so the picker can render without a second probe round-trip.

The token NAME contract from DDR-043 (canonical `--bg-0..4 / --fg-0..3 / --accent*` for scaffolded DSes) **stays unchanged**. The completeness-critic still enforces it for new scaffolds. The System view simply stops *assuming* names exist and renders whatever the file actually contains — so an imported / hand-written DS that uses different naming (StudyFi, brownfield migrations, brand mirrors) gets a correct overview without having to rename.

## Decision table

| Surface | Before | After |
|---|---|---|
| Token swatch source | `var(--name)` resolving against shell `:root` | raw parsed `value` from user's CSS |
| Token name list | hardcoded `TOKEN_NAMES` constant | iterate `data.tokenGroups[kind]` |
| Type ladder source | hardcoded `TYPE_STEPS`, `var(--type-X)`, `var(--lh-X)` | iterate `tokenGroups.fontsize`, pair leading by name suffix |
| Sample font | shell default (Berkeley Mono) | user's first `font`-kind token (prefers `body` / `sans` / `display`) |
| `tokensCssRel` resolution | single top-level path | per-DS entry; auto-derives to `<entry.path>/colors_and_type.css` when missing |
| `/_system-data` scope | always top-level scan | `?ds=<name>` scopes; unknown → 404 |
| Multi-DS overview | one merged view (whichever tokens parsed) | DS picker; per-DS tokens + per-DS preview gallery |
| `1-tokens.css` preamble | "Source of truth: .design/system/project/colors_and_type.css" (misleading) | "SHELL theme for the dev-server UI itself — NOT a user-DS template" |

## Backwards compatibility

- Single-DS legacy configs without `designSystems[]` continue to read tokens from the top-level `cfg.tokensCssRel` exactly as before.
- Existing scaffolded DSes (canonical `--bg-0..4` naming) display identically — the client just reads from parsed data instead of `document.documentElement`, but the resolved values are the same because each DS's `colors_and_type.css` re-declares those tokens.
- Schema gains optional `designSystems[].tokensCssRel`, `rootClass`, `themeDefault`, `themes`, `newCanvasDir`, `newComponentDir` fields (previously the schema rejected them via `additionalProperties: false` even though the TS runtime accepted them — fixing that drift).

## Server runtime parity

Per [DDR-009](DDR-009-bun-runtime-authoritative-for-dev-server.md), the Bun `.ts` entry is authoritative; `server.mjs` is retiring. Both got the same `normalizeDesignSystems` helper and the same `?ds` parsing — keep them in lock-step until Phase 3.4 Task 7 retires the `.mjs` entry, then delete the duplicate helper there.

## Consequences

- Imported / hand-written DSes (production mirrors like StudyFi) get a correct System view without renaming tokens to the canonical contract.
- Multi-DS projects get a working DS picker — no more guessing which tokens the overview is "really" showing.
- The shell's amber-rust chrome no longer leaks into the user-facing canvas overview when the DS uses canonical names (the pre-DDR-048 silent failure mode that masked the bug — values *looked* right because shell + scaffolded DS shared `--accent`, but they were always coming from the shell, not the DS).
- Completeness-critic and the DDR-043 NAME contract are unchanged — scaffolds remain opinionated about token naming; the *rendering* layer is now naming-agnostic.

## References

- Plan: [.ai/plans/dev-server-system-view-bias-free.md](../plans/dev-server-system-view-bias-free.md)
- Reproduced against: `/Volumes/D/git/AI-StudyMate/.design` (`config.json` `designSystems: [{ name: "studyfi", path: "system/studyfi" }]`, custom token naming).
- Files: `plugins/design/dev-server/client/app.jsx` (TokenLadder, TypeLadder, SystemView), `plugins/design/dev-server/api.ts` + `server.mjs` (`buildSystemData` `?ds` scope), `plugins/design/dev-server/context.ts` + `server.mjs` (`normalizeDesignSystems`), `plugins/design/dev-server/http.ts` (`/_system-data` handler), `plugins/design/dev-server/config.schema.json` (schema docs), `plugins/design/dev-server/client/styles/1-tokens.css` (preamble clarification only).
