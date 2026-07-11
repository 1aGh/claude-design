# Feature: Fix photo-editor follow-up debt (security + design-system + a11y)

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

`feature-photo-editor` shipped in v0.43.0. At its formal `/flow:done` close-out (2026-07-10) a retroactive security fan-out (defender + attacker), a `design-system-guard` pass, and an `a11y-auditor` pass found real, previously-undiscovered debt — 15 blockers total — which the user explicitly chose to ship-as-is and track as follow-up rather than fix in that session. This plan is that follow-up: fix all of it.

## User Story

As a Studio user (or Claude Code acting headlessly on their behalf), I want the photo editor's headless CLI path to be safe against a crafted `--asset` argument, its Inspector UI to look and behave like every other panel in the shell, and its controls to be fully keyboard/screen-reader operable — so the feature is production-grade, not just functionally working.

## Problem

Full detail lives in the archived plan's follow-up section (`.ai/plans/archive/feature-photo-editor.md` § Known follow-up debt) — this is the authoritative source, not a re-derivation. Summary:

1. **Security** (`apps/studio/bin/photo-bg-remove.sh`, `apps/studio/canvas-lib.tsx`): a chained HIGH-severity exploit — `--asset` validated with a loose glob instead of the strict `assets/<sha8>.<ext>` shape used everywhere else in this feature, spliced unescaped into a generated `.tsx`, combined with a non-symlink-safe harness-file write — lets attacker-controlled JSX land in a real, reviewed canvas file, invisible to `git diff`. Plus: an unvalidated stdout deliverable, a fail-open `--slug` fallback, no concurrency cap, orphaned scratch files, an unchecked `postMessage` handler, and a `connect-src 'self'` vs. third-party-CDN architectural gap (background-removal's model weights fetch from IMG.LY's CDN by default).
2. **Design-system** (`apps/studio/client/photo-knobs.jsx`): bare unstyled native `<input type="range">`/`<checkbox>` instead of the shell's bordered drag-scrub material, a raw Unicode `✦` instead of the plan-specified Lucide icon, several hardcoded values off the token ladder, double padding vs. every other Inspector tab.
3. **A11y**: three unlabeled `<select>`s, two WCAG 1.4.3 contrast failures, an ~1.05:1 (effectively invisible) context-menu focus indicator, generic non-distinguishing color-picker labels, a keyboard-inoperable HSV pad/hue bar, no `aria-busy` on the background-removal busy state, and plain-`<span>` section titles with no heading semantics.

## Solution

Fix each item at its root, reusing established patterns rather than patching symptoms:

- **Security**: mirror the sha8-hex validation (`ASSET_REF_RE`/`SHA_RE`) already enforced client-side, port the symlink-safe atomic-write pattern already shipped in `sync/atomic-write.ts` (DDR-054 §2c), and close the CSP gap with a **narrow, documented `connect-src` exception** for exactly `https://staticimgly.com` (user decision — self-hosting the model weights is a separate, larger follow-up, not folded into this plan).
- **Design-system**: refactor `PhotoKnobs`' `Slider`/buttons/selects to actually reuse the shell's shared material (`.st-cp-numin`/`.st-cp-scrub`-style drag-scrub numeric fields, `.st-btn`, `.st-cp-nsel`) instead of hand-rolled native inputs — this closes several a11y findings as a side effect (focus rings, keyboard operability inherited from the shared primitives), not just the visual ones.
- **A11y**: the remaining, primitive-reuse-independent items (labels, contrast, headings, live-region) get direct, scoped fixes.

## Metadata

- **Type**: Bug Fix (security + design-system + a11y hardening of an already-shipped feature)
- **Complexity**: High (security-sensitive CSP change, touches a shared component used by every Inspector tab, spans 5 files)
- **App/Package**: `apps/studio` (dev server + client + canvas-lib)
- **Affected Systems**: `photo-bg-remove.sh` (headless CLI), `cspForCanvasShell` (canvas-origin CSP), `PhotoPreviewBridge` (canvas-lib.tsx), `PhotoKnobs` (Inspector Photo tab), the shared `ColorPicker` component, `context-menu.tsx` (shared focus-visible style — affects every context menu, not just "Edit Photo…")
- **Dependencies**: none new

---

## Context References

### Must-Read Files

> Read every file below in parallel in a single assistant message during `/flow:execute` — they're independent context loads.

- `.ai/plans/archive/feature-photo-editor.md` § "Known follow-up debt" — the authoritative, itemized source for every finding this plan fixes. Read in full before Task 1.
- `apps/studio/bin/photo-bg-remove.sh` (161 lines, read in full) — `--asset` glob check `:58-61`, unescaped splice into the harness `.tsx` `:104-112`, `--slug` fail-open fallback `:65`, stdout deliverable `:155-160`, no cleanup trap on the harness file (`trap cleanup EXIT` at `:120-121` only closes the agent-browser session, not the `.tsx`).
- `apps/studio/photo-store.ts:41-59` (`SHA_RE`, `assetSha8()`) — the server-side sha8 extraction regex to mirror in bash (`^[0-9a-f]{8,64}$` after stripping `assets/` prefix + extension).
- `apps/studio/canvas-lib.tsx:2380` (`ASSET_REF_RE = /assets\/[0-9a-f]{8}\.[a-z0-9]+/i`), `:2388-2402` (`findPhotoEl`), `:2404-2414` (`extractAssetRef`), `:2484-2504` (`PhotoPreviewBridge`'s `onMsg`, the new `photo-busy` branch at `:2492-2496`) — the client-side validation pattern to extend to the `photo-busy` handler.
- `apps/studio/sync/atomic-write.ts` (104 lines, read in full) — the symlink-safe write pattern (`O_CREAT|O_EXCL`, 128-bit random suffix, atomic rename) to port into `photo-bg-remove.sh`'s bash harness-file write. DDR-054 §2c is the design rationale.
- `apps/studio/http.ts:93-158` (`cspForCanvasShell`, read the full doc comment) — `connect-src 'self'` at `:141`; the comment block above explains why it's locked down — the narrow exception must be added with an equally explicit comment, not silently.
- `apps/studio/context-menu.tsx:219-223` (`.dc-menu-item:hover, .dc-menu-item:focus-visible`) — the ~1.05:1-contrast shared focus style. Fixing this benefits every context menu in the shell, not just "Edit Photo…".
- `apps/studio/client/photo-knobs.jsx` (438 lines, read in full) — the whole file gets touched: `S` style object `:64-116` (off-ladder values), `Slider` `:130-153`, `ColorSwatch` `:164-176`, `Section` `:118-128`, the Remove Background button `:387-432`.
- `apps/studio/client/app.jsx:4717-4773` (`makeScrub`) — the drag-delta algorithm to adapt (NOT call directly — it's keyed to CSS `authored`/`computed`/`optimistic`/`commit`, PhotoKnobs has its own `mutate`/`put`; port the pointer-move delta/threshold/step-modifier logic, drop the CSS-specific unit/sides handling PhotoKnobs doesn't need).
- `apps/studio/client/app.jsx:5002-5040` (`num()`) — the actual bordered `.st-cp-numin.st-cp-scrub` DOM shape (leading icon + input + stepper) to mirror for `PhotoKnobs`' `Slider` replacement.
- `apps/studio/client/app.jsx:4093-4230` (`ColorPicker`, read in full) — `seed`/`onApply` props only, no label; `aria-label="saturation and value"` (`:4169`) and the hue-bar/hex-input equivalents need a `label` prop threaded through to disambiguate Duotone's Shadow vs. Highlight swatches. Also: `dragSV`/`dragHue` (`:4110-4147`) have no keyboard equivalent — add arrow-key stepping.
- `apps/studio/client/styles/3-shell-maude.css:504-506` (`.st-btn`), `:889-893`-ish (`.st-cp-nsel`) — the shared classes `PhotoKnobs` should adopt instead of its own `S.btn`/`S.select`.
- `apps/studio/client/styles/1-tokens-maude.css` — the space/radius/tracking ladder (`--space-*` 2/4/8/12/16/24px, `--radius-*` 3/5/7/10/14px, `--tracking-wide: 0.04em`) the hardcoded `S.*` values must snap to.
- `apps/studio/test/photo-edit-api.test.ts`, `apps/studio/test/canvas-origin-gate.test.ts`, `apps/studio/test/shell-importmap.test.ts` — existing test shapes to mirror for this plan's new regression tests.

### Documentation

- `apps/studio/node_modules/@imgly/background-removal/dist/index.mjs` — grepped directly to confirm the exact CDN hostname (`https://staticimgly.com`) rather than assuming from memory; also confirmed `onnxruntime-web`'s bundled JS references no external hostname (its WASM binaries load relative to itself).
- `.ai/decisions/DDR-054-linked-mode-trust-model-and-task-4-hardening.md` §2c — the symlink-attack precedent + fix this plan ports into a second call site.

### Patterns to Follow

```ts
// sync/atomic-write.ts:46-97 — the Node-side symlink-safe write. Bash equivalent:
// mktemp in the same dir (not /tmp — must be same filesystem for atomic rename),
// `set -C` (noclobber) or `mkdir`-based exclusive create, `mv` to the final path,
// trap-based cleanup of the tmp file on any exit path.
```

```ts
// canvas-lib.tsx:2404-2414 — extractAssetRef: the shape-check pattern to mirror
// for the photo-busy handler's `m.asset` before it's trusted.
function extractAssetRef(el: Element): string | null {
  const tagged = el.getAttribute('data-photo-asset');
  if (tagged && ASSET_REF_RE.test(tagged)) return tagged;
  // ...
}
```

---

## Design Decisions

### Components (from registry)

| Component | Source | Notes |
| --- | --- | --- |
| `.st-cp-numin.st-cp-scrub` bordered drag-scrub field | `apps/studio/client/app.jsx:5002-5040`, `styles/3-shell-maude.css` | Pattern to mirror for `PhotoKnobs`' `Slider` — NOT `makeScrub` called directly (CSS-prop-keyed), the drag-delta algorithm adapted to PhotoKnobs' bounded numeric fields. |
| `.st-btn` | `apps/studio/client/styles/3-shell-maude.css:504-506` | Reused as-is for the Remove Background button, replacing hand-rolled `S.btn`. |
| `.st-cp-nsel` | `apps/studio/client/styles/3-shell-maude.css` | Reused as-is for Pattern Type/Blend + Mask Preset `<select>`s, replacing hand-rolled `S.select`. |
| `StIcon` / `STICONS.sparkle` | `apps/studio/client/app.jsx:281-560` | Reused for the Remove Background button icon, replacing the raw `✦` character. |
| `ColorPicker` | `apps/studio/client/app.jsx:4093` | Extended (not replaced) with an optional `label` prop for aria-label disambiguation. |

No new custom components — every fix in this plan is either a security-hardening patch to existing code or a reuse of an existing shared primitive.

---

## Tasks

Execute in order. Each task is atomic and testable. Stages A-C can be done in any relative order (independent files); Stage D should precede Stage E's Task 17 since both touch `photo-knobs.jsx`'s `ColorSwatch` call sites.

Keywords: CREATE, UPDATE, ADD, REMOVE, REFACTOR, MIRROR

### Stage A — Security hardening: `photo-bg-remove.sh`

#### Task 1: UPDATE `--asset` validation to the strict sha8 shape

- **Do**: Replace the loose `case "$ASSET" in assets/*) ;; esac` glob (`:58-61`) with a strict regex match against `^assets/[0-9a-f]{8,64}\.[a-zA-Z0-9]+$` (mirror `photo-store.ts`'s `SHA_RE` shape, case-insensitive extension). Use bash `[[ "$ASSET" =~ ^assets/[0-9a-f]{8,64}\.[a-zA-Z0-9]+$ ]]` (requires `#!/usr/bin/env bash`, already the shebang) rather than a `case` glob, which cannot express character-class validation.
- **Gotcha**: This closes the root cause of the chained HIGH exploit — do this task before Task 2, since Task 2's symlink-safe write is defense-in-depth, not a substitute.
- **Validate**: manual — `bash apps/studio/bin/photo-bg-remove.sh --asset 'assets/AAAAAAAA.png" }; alert(1); ({ "y.png' --root <repo>` must exit 2 with the validation error, not proceed to generate a harness file.

#### Task 2: UPDATE the harness-file write to be symlink-safe

- **Do**: Replace the bare `{ ... } > "$HARNESS_TSX"` redirect (`:104-112`) with a write-to-random-tmp-then-atomic-rename sequence in the same `_photo/` directory: generate content into `"$HARNESS_TSX.tmp.$$_$RANDOM$RANDOM"` using `set -C` (noclobber) or `mkdir "$HARNESS_TSX.lock.$$"` as the exclusivity guard, then `mv` into place; `trap` cleanup of the tmp file on any exit path (extend the existing `cleanup()`/`trap cleanup EXIT` at `:120-121` rather than adding a second trap).
- **Pattern**: `sync/atomic-write.ts:46-97` — same invariant (never write through a pre-existing path, including a symlink), bash equivalent of `O_CREAT|O_EXCL`.
- **Validate**: manual — pre-create a symlink at the harness path pointing at a decoy file, run the script, confirm it fails loudly (or writes to a fresh random path) rather than following the symlink.

#### Task 3: UPDATE the stdout deliverable to be shape-validated before use

- **Do**: Before `printf '%s\n' "$RESULT"` (`:160`), validate `$RESULT` against the same `^assets/[0-9a-f]{8,64}\.[a-zA-Z0-9]+$` regex from Task 1. On mismatch, treat it identically to the existing empty-result case (`:156`) — `echo` an error to stderr and `exit 4`.
- **Validate**: manual — with a stubbed/mocked harness reporting a malformed `data-photo-bgremove-result`, confirm the script exits 4 instead of printing the bad value.

#### Task 4: UPDATE the `--slug` fallback to hard-fail instead of downgrading

- **Do**: Replace `SLUG=$(bash "$SCRIPT_DIR/slug.sh" "$SLUG" 2>/dev/null || printf '%s' "$SLUG" | tr '[:upper:]' '[:lower:]')` (`:65`) — on `slug.sh` failure, `exit 1` with a clear error instead of falling back to a lowercased-but-unstripped value. Never let a safety subprocess's failure silently downgrade to a less-safe code path.
- **Gotcha**: This repo has a documented history (DDR-045) of sibling-script resolution breaking specifically in packaged/compiled distributions — so this failure mode is realistic, not theoretical.
- **Validate**: manual — temporarily `chmod -x slug.sh`, run the script, confirm it exits 1 rather than proceeding with a traversal-shaped slug.

#### Task 5: ADD cleanup of the harness scratch file after a successful run

- **Do**: On successful completion (after `printf '%s\n' "$RESULT"`), `rm -f "$HARNESS_TSX"` (and its lock/tmp artifacts from Task 2, if any remain). Leave the file in place on error exits (useful for debugging a failed run) — only clean up on the success path.
- **Validate**: manual — run the script successfully, confirm `_photo/<slug>.bgremove.tsx` no longer exists afterward.

#### Task 6: ADD a concurrency guard for headless invocations

- **Do**: A simple `flock`-based (or `mkdir`-based on platforms without `flock`) lock keyed on `$ASSET` (not global — two different assets should still run concurrently) around the agent-browser drive + poll section, so a loop invoking `photo-bg-remove.sh` on the same asset serializes instead of spawning unbounded concurrent browser+WASM processes. On lock-held, either wait (bounded by `$TIMEOUT`) or fail fast with a clear "already running for this asset" message — pick fail-fast for simplicity, document the choice in a comment.
- **Gotcha**: Keep this scoped — a full job queue is out of scope for this follow-up; this is a backstop against a runaway loop, not a scheduler.
- **Validate**: manual — start two concurrent invocations against the same `--asset`, confirm the second one fails fast rather than doubling resource usage.

### Stage B — CSP narrow exception

#### Task 7: UPDATE `cspForCanvasShell`'s `connect-src` with a narrow, documented exception

- **Do**: Change `"connect-src 'self'"` (`http.ts:141`) to `"connect-src 'self' https://staticimgly.com"`. Extend the doc comment above the function (`:93-125`) with a new paragraph explaining exactly why: `@imgly/background-removal`'s model weights (~11-44MB) fetch from IMG.LY's default CDN on first use, and there is no self-hosting mechanism today (that's a separate, larger follow-up — link forward to wherever that gets tracked, e.g. a new STATE.md note or DDR). State explicitly that this is the ONLY documented exception to the `connect-src 'self'` invariant, so a future reviewer doesn't read it as precedent for adding more without the same scrutiny.
- **Gotcha**: Verify the hostname is exactly `https://staticimgly.com` (confirmed via direct grep of the installed package in this plan's research, not assumed) — do not use a wildcard subdomain match.
- **Validate**: `cd apps/studio && bun tsc --noEmit`; add/extend a unit test (Task 22) asserting the exact directive string.

### Stage C — `canvas-lib.tsx` hardening

#### Task 8: UPDATE `PhotoPreviewBridge`'s `photo-busy` handler to require a validated asset

- **Do**: In the `photo-busy` branch (`:2492-2496`), before calling `findPhotoEl(m.asset)`, require `ASSET_REF_RE.test(m.asset)` (reject empty string and any non-conforming value) — mirroring the shape-check `extractAssetRef` already applies elsewhere in this same file. An empty or malformed `asset` should be a no-op, not fall through to `findPhotoEl`'s substring-match fallback (which currently matches every photo element when `asset === ''`).
- **Gotcha**: Do not attempt to add an `event.origin` check to the whole `onMsg` handler in this task — that's shared with the pre-existing `photo-preview` branch and is a bigger architectural change (same-origin canvas iframes make a same-origin check non-trivial to get right) better scoped as its own follow-up if the user wants it. This task closes the concrete, currently-exploitable gap (empty-string asset matching every element) without expanding scope.
- **Validate**: `cd apps/studio && bun test` (extend or add a unit test asserting a malformed/empty `asset` in a `photo-busy` message is a no-op).

### Stage D — `PhotoKnobs` primitive-reuse refactor

#### Task 9: REFACTOR `Slider` to a bordered drag-scrub numeric field

- **Do**: Replace the native `<input type="range">` in `Slider` (`photo-knobs.jsx:130-153`) with a text-style input using the `.st-cp-numin.st-cp-scrub` classes (mirroring `num()`'s DOM shape, `app.jsx:5014-5037`, minus the unit-suffix/token-list machinery PhotoKnobs doesn't need). Implement a `makePhotoScrub(min, max, step, onChange, onCommit)` helper adapted from `makeScrub`'s pointer-move algorithm (`app.jsx:4717-4773`) — same 3px-threshold-before-drag, same shift=×10/alt=×0.1 step modifiers, but clamped to `[min, max]` (PhotoKnobs' fields have real bounds, unlike most CSS props) and calling `onChange`/`onCommit` directly instead of CSS `optimistic`/`commit`. Keep the numeric value directly editable by typing (same as `num()`'s `onBlur` commit path).
- **Pattern**: `app.jsx:5002-5040` (`num()`) for the DOM/class shape; `app.jsx:4717-4773` (`makeScrub`) for the drag algorithm to adapt.
- **Gotcha**: This is the task most likely to need visual iteration — screenshot-compare against the CSS tab's numeric fields after implementing, don't assume the port is pixel-correct on the first pass.
- **Validate**: `maude design screenshot` against a canvas with a selected photo, Photo tab open — visually compare Adjustments sliders against CssKnobs' numeric fields in the CSS tab.

#### Task 10: UPDATE the Remove Background button to use `StIcon` + `.st-btn`

- **Do**: Replace the raw `✦ Remove Background` / `Removing…` text (`:428`, `:408`) with `<StIcon name="sparkle" size={14} />` + label text, and replace the hand-rolled `S.btn` style object with `className="st-btn"` (both the primary "Remove Background" button at `:412-429` and the "redo" button at `:392-409` — `redo` can stay text-only/`S.reset`-styled if it's meant to look secondary, but confirm against the shell's existing secondary-button convention).
- **Validate**: `maude design screenshot` — visually confirm the icon renders and matches the other Inspector tab-action buttons.

#### Task 11: UPDATE hardcoded off-ladder values to the token ladder

- **Do**: In the `S` style object (`:64-116`), fix: `sec.marginBottom: 14` → `12` (or wrap in `var(--space-3)` equivalent inline — confirm whether inline `style` objects in this file can reference CSS custom properties directly, e.g. `marginBottom: 'var(--space-3)'`, which they already do elsewhere in this same object for colors); `row.margin: '5px 0'` → `'var(--space-2) 0'` (4px) or `'var(--space-1) 0'` (8px, pick whichever reads closer to the current 5px); `secHead.letterSpacing: '.06em'` → `'var(--tracking-wide)'` (0.04em, matching `.st-cp-sechd`); `btn.borderRadius: 6` → `'var(--radius-sm)'` (5px, matching `.st-btn`) — moot if Task 10 already replaced this with the `.st-btn` class; `reset.borderRadius: 4` → `'var(--radius-xs)'` (3px) or `'var(--radius-sm)'` (5px).
- **Validate**: `maude design screenshot` + a computed-style spot-check (per the project's own `reference_css_var_alias_scope_trap` convention — verify token overrides with a computed-style probe, not just a screenshot).

#### Task 12: FIX double padding on the Photo tab root

- **Do**: Remove `S.body`'s own `padding: '10px 12px'` (`:65`) — the parent `.st-rp-body` container (shared by every Inspector tab) already applies `padding: var(--space-4)`. Confirm after the change that Photo-tab content sits at the same inset as the CSS/Inspect/Layers tabs.
- **Validate**: `maude design screenshot` — compare the Photo tab's edge insets against the CSS tab at the same panel width.

#### Task 13: REFACTOR `<select>`s to reuse `.st-cp-nsel`

- **Do**: Replace `S.select` usage on the three `<select>` elements (Pattern Type `:344`, Pattern Blend `:352`, Mask Preset `:374`) with `className="st-cp-nsel"`, dropping the hand-rolled inline style object for these three call sites.
- **Validate**: `maude design screenshot` — confirm hover/focus states now match the CSS tab's dropdowns.

### Stage E — A11y fixes

#### Task 14: ADD `aria-label` to the three unlabeled `<select>`s

- **Do**: Add `aria-label="Pattern type"` / `aria-label="Pattern blend"` / `aria-label="Mask preset"` to the same three `<select>`s touched in Task 13 (do this in the same edit as Task 13 since it's the same three lines).
- **Validate**: `cd apps/studio && bun test` if an a11y-shape test exists for this component (see Task 23), else manual screen-reader spot-check.

#### Task 15: FIX contrast on the two `--fg-3` text elements

- **Do**: Bump the asset-path/save-state label (`:277-281`) and the pattern hint "tip: dark + multiply" (`:363`) from `var(--fg-3)` to `var(--fg-2)` (computes to ≈4.85:1 against `--bg-1`, passing WCAG 1.4.3's 4.5:1 floor — marginal, per the a11y-auditor's own note, but sufficient; do not introduce a new token for this alone).
- **Validate**: computed-style contrast check (not just visual) — confirm ≥4.5:1 in both light and dark theme.

#### Task 16: FIX the context-menu focus-visible indicator

- **Do**: In `context-menu.tsx:219-223`, replace `outline: none` with a real visible outline on `:focus-visible` specifically (keep the existing `:hover` background-tint rule as-is; split the combined selector so `:hover` and `:focus-visible` can diverge): `outline: 2px solid var(--accent-9, currentColor); outline-offset: -2px;` (pick the actual accent/focus-ring token this shell uses elsewhere — check `.maude :is(button,...):focus-visible` in `3-shell-maude.css:971` for the established app-wide focus-ring token and reuse it rather than inventing a new value).
- **Gotcha**: This is shared infra — verify the fix doesn't visually clash with any menu that intentionally relies on the current (broken) invisible-focus behavior (unlikely, since invisible focus is never intentional, but screenshot-check a couple of different context menus, not just "Edit Photo…").
- **Validate**: `maude design screenshot` on at least two different context menus (element registry + annotation) with keyboard focus stepped to a middle item — confirm the focus ring is visible in both; computed-style contrast check ≥3:1 (WCAG 1.4.11).

#### Task 17: ADD a `label` prop to `ColorPicker` for distinguishing aria-labels

- **Do**: Add an optional `label` prop to `ColorPicker` (`app.jsx:4093`), threaded into its internal controls' `aria-label`s (e.g. `aria-label={label ? \`${label} saturation and value\` : 'saturation and value'}` at `:4169`, similarly for the hue bar and hex input). Update `photo-knobs.jsx`'s three `ColorSwatch`/`ColorPicker` call sites (Duotone Shadow `:315`, Duotone Highlight `:317`, Pattern color `:362`) to pass `label="Shadow"` / `label="Highlight"` / `label="Pattern color"` through `ColorSwatch` (which itself needs a `label` prop added and threaded to both its native-`<input type="color">` fallback's `aria-label` and the injected `ColorPicker`'s new `label` prop — `photo-knobs.jsx:164-176`).
- **Gotcha**: `ColorPicker` is shared shell infrastructure (used by `CssKnobs` too, not just `PhotoKnobs`) — making `label` optional (default to the current generic strings when absent) keeps every existing call site backward-compatible with zero changes required there.
- **Validate**: `cd apps/studio && bun tsc --noEmit`; manual screen-reader spot-check that Duotone's two swatches now announce distinctly.

#### Task 18: ADD keyboard operability to `ColorPicker`'s SV pad and hue bar

- **Do**: Add `onKeyDown` handlers to the SV pad (`:4165-4179`) and hue bar buttons — arrow keys adjust saturation/value or hue by a small step (e.g. 0.02 for s/v, 2° for hue; Shift for a larger step), calling the same `setHsv`/`onApply` path the pointer-drag handlers use. Mirror the existing keyboard-modifier convention (`makeScrub`'s shift=×10) for the step-multiplier shape, adapted to HSV's 0-1/0-360 ranges.
- **Validate**: manual keyboard-only test — Tab to the SV pad, arrow-key adjust, confirm the swatch color updates; same for the hue bar.

#### Task 19: ADD `aria-busy` + a live-region announcement for background-removal busy state

- **Do**: In `photo-knobs.jsx`, when `bgBusy` is true, add `aria-busy="true"` to the Background section's container (or the specific button) and add a visually-hidden (`sr-only`-equivalent — check whether this shell already has a `.visually-hidden` utility class in `5-utilities.css` before inventing one) live region (`aria-live="polite"`) that announces "Removing background…" on start and "Background removed" / "Background removal failed" on completion.
- **Validate**: manual — confirm via browser devtools accessibility tree that the live region's text changes are exposed; the existing `data-photo-busy` attribute (`inspect.ts`) stays purely visual/unchanged (out of scope — that's the canvas-side pulse, this task is the Inspector-side button state, a different DOM location).

#### Task 20: UPDATE Photo tab section titles to real heading semantics

- **Do**: In `Section` (`photo-knobs.jsx:118-128`), change the plain `<span>{title}</span>` to a heading element (`<h3>` if the shell's CSS doesn't apply unwanted default heading styles that would need overriding — check `CssKnobs`' own `sec()` pattern at `app.jsx` first; if it uses `role="heading" aria-level="3"` on a non-heading element instead, mirror that exact convention rather than diverging).
- **Validate**: manual — confirm heading-navigation (screen reader "H" key equivalent, or `getByRole('heading')` in a test) finds all six Photo-tab sections.

### Stage F — Regression guards

#### Task 21: ADD a regression test for `photo-bg-remove.sh`'s `--asset` validation

- **Do**: A new test (bash-invocation-based, mirroring how existing `.sh` helpers are tested in this repo — check whether any other `bin/*.sh` has a `bun:test` wrapper that shells out and asserts exit codes; if none exists, a small standalone script under `apps/studio/test/` that invokes `photo-bg-remove.sh` with several malformed `--asset` values and asserts exit code 2 is acceptable) covering: path traversal (`assets/../../../etc/passwd`), injection-shaped values (embedded quotes/backticks), and the valid-shape happy path (asserting it proceeds past validation, without needing a real server for a full end-to-end run).
- **Validate**: `cd apps/studio && bun test` (or the direct script invocation if no bun:test wrapper pattern fits).

#### Task 22: ADD a CSP regression test for the `connect-src` exception

- **Do**: Extend or add to the existing CSP test coverage (check for a `csp.test.ts` or similar near `http.ts`'s tests) asserting `cspForCanvasShell(...)`'s output contains exactly `connect-src 'self' https://staticimgly.com` — both that the exception is present (regression guard against it being silently reverted) and that no additional hosts have crept in (regression guard against silent scope creep, per Task 7's Gotcha).
- **Validate**: `cd apps/studio && bun test`

#### Task 23: RE-RUN `design-system-guard` + `a11y-auditor` to confirm 0 blockers

- **Do**: After Stages D/E land, re-run both subagents against the refactored `PhotoKnobs` (same scope as the original close-out session's review) to confirm every blocker they found is actually closed, not just addressed-in-intent. This is the acceptance gate for this plan, not optional polish.
- **Validate**: both subagents report 0 blockers.

#### Task 24: RECORD a DDR addendum for the CSP exception

- **Do**: Via `/flow:record-ddr` (or as a dated addendum to the existing DDR-054, matching this repo's own convention for amending an *Accepted* DDR without rewriting history — see DDR-115's dated-addendum precedent), record the `connect-src` exception as a deliberate, scoped, documented decision: what host, why, and the note that self-hosting was considered and deferred as separate follow-up work. Re-check the next-available DDR number immediately before recording (per the project's own `project_ddr_numbering_races_on_shared_main` convention — a concurrent session may have claimed a number since this plan was written).
- **Validate**: DDR file exists under `.ai/decisions/`, cross-referencing DDR-054.

---

## Validation

Run these commands to confirm zero regressions:

1. **Lint**: `pnpm lint` (or `pnpm biome check --changed`)
2. **Types**: `cd apps/studio && bun tsc --noEmit` (expect only the pre-existing 8-error DDR-026 baseline)
3. **Tests**: `cd apps/studio && bun test`
4. **Build**: `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release` (rebuild release-minified bundles — do NOT leave a dev-mode `bun run build.ts` overwrite in the committed `dist/`, confirm `git diff --stat -- dist/` is clean after)
5. **Cross-platform scenario**: re-run `photo-editor-basic-edit` (existing scenario from the original feature plan) — this project is `platforms: ["web-desktop"]` only, others `skipped`.
6. **Design System Guard**: Task 23 — must show 0 blockers (was 5).
7. **A11y**: Task 23 — must show 0 blockers (was 3).
8. **Security**: re-run `security-auditor` + `ethical-hacker` on this plan's own diff (standard `/flow:done` Step 4 — the process gap that let the original diff ship unreviewed should not repeat here).
9. **Manual**:
   - Attempt the exact injection string from Task 1's validate line against the shipped (pre-fix) behavior first, to confirm you're actually closing the gap, then again after the fix.
   - Keyboard-only pass through the entire Photo tab (Tab through every control, operate each without a mouse).
   - Screen-reader spot-check (VoiceOver or equivalent) of the three previously-unlabeled selects + the two ColorPicker swatches.

## Scenario Coverage (UI tasks — required)

**Existing scenarios covering affected flows:**

| Scenario | Covers | Status |
| --- | --- | --- |
| `photo-editor-basic-edit` | Open Photo tab, adjust a knob, live preview, undo | ✅ existing — re-run after Stage D/E, since this plan changes the Slider's DOM shape |
| `photo-editor-headless-cli` | Headless `photo-adjust`/`photo-bg-remove` CLI | ✅ existing — re-run after Stage A, since this plan changes `--asset` validation and could regress a previously-valid call pattern |

No new scenarios needed — this plan fixes existing surfaces, it doesn't add new user-facing flows.

---

## Acceptance Criteria

- [x] All 24 tasks completed
- [x] `/flow:utils-verify`-equivalent passes after each task (manual tsc/biome/bun test + targeted repro per task, Edit-Verify Loop)
- [x] `/validate` static+test+build gates pass:
  - [x] Static (types, lint, format) — tsc baseline unchanged (12 pre-existing, DDR-026); biome clean
  - [x] Tests (full suite, incl. the 2 new regression tests from Stage F) — 2367 pass / 2 pre-existing flaky fails (unchanged) / 5 skip
  - [x] Build (compiled binary + committed `dist/` bundles rebuilt release-minified)
  - [ ] `scenario-runner`: **deferred to `/flow:done`** — not run as a formal scenario this session (per `/flow:execute`'s own policy of not auto-running the expensive full `/validate`). Equivalent live coverage was obtained instead: `design-system-guard` + `a11y-auditor` both drove the real Photo tab (⌘-click selection, typed/drag/keyboard interaction, screen-reader-tree checks) against a live throwaway server, and the headless CLI path (`photo-bg-remove.sh`) was manually live-tested end-to-end (all 6 Stage-A hardening behaviors + the real exploit string, pre- and post-fix). Recommend `/flow:done` still runs the formal scenario for the record.
  - [x] `design-system-guard` subagent: **0 blockers** (was 5) — re-audited live 2026-07-10, all 5 confirmed fixed, 1 non-blocking hygiene advisory noted
  - [x] `a11y-auditor` subagent: **0 blockers** (was 3, 8 items re-checked total) — re-audited live; caught and required a fix for a real regression (Slider `onCommit` discarding its value) before clearing
- [x] `security-auditor` + `ethical-hacker` fan-out on this plan's own diff: 0 blockers (1 low-severity `$SESSION`-unbound-variable lock-leak bug found independently by both, fixed)
- [x] The chained HIGH exploit from the original close-out is verified closed (Task 1's manual validate line, run against both pre-fix and post-fix code; independently re-verified by `ethical-hacker` with additional bypass attempts)
- [x] The `connect-src` CSP exception is scoped to exactly one host, documented, and DDR-recorded (Task 24 — DDR-161 addendum)
- [x] No new hardcoded off-ladder values introduced while fixing the old ones
- [x] Code follows project conventions, no regressions
