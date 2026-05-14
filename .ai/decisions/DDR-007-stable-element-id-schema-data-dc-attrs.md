# DDR-007: Stable element-id schema — paired `data-dc-screen` + `data-dc-element` attributes on canvas content

- **Date:** 2026-05-15
- **Status:** Accepted
- **Tags:** design, runtime, inspector, screenshots, critics, comments, schema
- **Related:** [DDR-004](./DDR-004-flow-command-naming-prefix-convention.md), `plugins/design/dev-server/runtime/design-canvas.jsx`, `plugins/design/dev-server/server.mjs` (inspector `cssPath`/`domPath`), `plugins/design/dev-server/bin/screenshot.sh`, `plugins/design/skills/design/SKILL.md` (Generation envelope directive 15), [DDR-008](./DDR-008-dev-server-bin-canonical-helper-home.md)

## Context

Before Phase 13, generated canvases had two structural problems for any tool that wanted to **target a specific region**:

1. **Artboards** had `data-dc-slot="<id>"` (rendered by `DCArtboard` runtime). Internal name; not specifically a "screen" handle. Critics referencing `[data-artboard-id="…"]` (in `signature-moment-critic.md`) silently failed because no runtime emitted that attribute — they fell back to `--full` and lost per-artboard discipline.
2. **Inner elements** (heroes, CTAs, list rows, form fields) had no convention. Inspector's `cssPath()` fell through to `:nth-child` selectors. Comments pinned to "the 3rd row" broke the moment the user reordered rows or inserted one. Screenshots requested as "the primary CTA" required user-supplied CSS selectors instead of human-readable IDs.

Three downstream pains:

- **Critics** lost per-region observation: `signature-moment-critic` saw a full-page snapshot instead of N per-screen snapshots; verdicts referenced "first artboard / leftmost panel" instead of named screens.
- **Comments / inspector selection** were fragile across edits — selector `body > main > section:nth-child(3) > div:nth-child(2)` invalidated on every layout change.
- **Helper APIs** (the new `screenshot.sh` in Phase 13) needed a stable handle to expose `--screen <id>` and `--element <id>` flags. Without a documented schema, callers would invent ad-hoc attributes.

Phase 13 also resurfaced an old gotcha: changing the artboard attribute name (`data-dc-slot` → something else) would silently break every existing canvas in the wild — the slot attr is load-bearing for `_active.json` selection state, comments storage, and `_history/<slug>/` rollback diffs.

We considered three schemas:

1. **Paired attributes** — `data-dc-screen="<id>"` on artboards (rendered alongside the legacy `data-dc-slot`); `data-dc-element="<id>"` on named inner regions. Two attribute names, role-specific. The inspector preference order is explicit: `[data-dc-element]` → `[data-dc-screen]` → `[data-dc-slot]` → `#id` → `:nth-child`.
2. **Single prefixed attribute** — `data-dc-id="screen-<id>"` or `data-dc-id="elem-<id>"` on everything. One attribute name; role inferred by prefix string-parse. More compact in source; less explicit when reading the DOM in devtools.
3. **Reuse standard `id=""`** — `id="screen-foo"` / `id="elem-bar"`. No new attribute. Compatible with existing `cssPath()` which already preferred `#id`. Risk: collides with page-level idiomatic `id` use (a11y skip-targets, fragment links).

## Decision

Adopt **option 1** — paired attributes, role-explicit, back-compat preserved:

- **`data-dc-screen="<kebab-id>"`** on every artboard. Emitted by `DCArtboard` runtime (`design-canvas.jsx`) alongside the existing `data-dc-slot="<id>"` (same value, both attrs). `data-dc-slot` is retained for compatibility with pre-Phase-13 canvases and the inspector / comments / rollback paths that grep it.
- **`data-dc-element="<kebab-id>"`** on named inner regions: heroes, cards, list rows, form fields, CTAs, nav items. Role-prefixed kebab IDs: `cta-get-started`, `card-hero`, `list-row-roster`, `field-email`, `nav-item-profile`.
- **Inspector selector preference** (`server.mjs` `cssPath()` + `domPath()`) — break order:
  1. `[data-dc-element="<id>"]`
  2. `[data-dc-screen="<id>"]`
  3. `#id`
  4. classes + `:nth-child`
- **Envelope directive 15** in `skills/design/SKILL.md` tells `frontend-design` to emit `data-dc-element="…"` on every named region during scaffold. Direktiva is verbatim alongside aspiration directives 9–14.
- **Helper API** (`screenshot.sh --screen <id>` / `--element <id>`) maps directly to the attribute selectors. `--all-screens` iterates `[data-dc-screen],[data-dc-slot]` (union) so existing canvases without the new attr still capture.

## Rejected alternatives

**Option 2 (single `data-dc-id` prefix)** rejected because:

- String-parse to recover role is fragile (`elem-screen-foo` is ambiguous).
- devtools inspection requires reading the value, not just attribute presence — slower to scan.
- Helper CLI flag mapping needs `--id <prefix-id>` or two flags that both target the same attr — uglier API.

**Option 3 (reuse `id=""`)** rejected because:

- `id` is already overloaded for page-level a11y (`<label for=…>`, skip-nav targets, fragment scroll).
- A canvas with `<button id="elem-primary-cta">` and a `<label for="email">` mixes concerns; mistakes are silent.
- Critics / comments storing `#id` selectors would break the moment a canvas legitimately needs a fragment target with a colliding name.

## Consequences

**Positive:**

- Comments are stable across edits when `data-dc-element` IDs survive (which they do unless the developer intentionally renames). Inspector selector ends with `[data-dc-element="cta-primary"]`, not `:nth-child(3)`.
- Critics get per-region observation. `signature-moment-critic.md` post-fix references `[data-dc-screen]` correctly (was `[data-artboard-id]` — see Phase 13 plan Task 20 selector sweep).
- Helper CLI is intuitive: `/design:screenshot --element cta-primary` reads like a designer command, not a CSS query.
- Backwards-compatible: existing canvases pre-Phase-13 emit only `data-dc-slot`, helper unions both selectors, so `--all-screens` still loops them.

**Negative / tradeoffs:**

- `frontend-design` generator must remember to emit `data-dc-element` on named regions — adds one constraint to the envelope discipline. Mitigated by envelope directive 15 (verbatim, mandatory).
- Two attribute names per artboard (`data-dc-slot` + `data-dc-screen`) is technically redundant. Living with the redundancy avoids a breaking rename.
- Inner elements need explicit tagging by the generator; un-tagged elements fall back to `:nth-child`. Quality-of-life depends on `frontend-design` adherence — verifiable via `grep -c data-dc-element` on generated canvases.

## Compatibility notes

- **Phase 13 sweep** renamed every `data-artboard-id` reference (signature-moment-critic) to `data-dc-screen`. The old selector never matched any runtime element; the rename is a bug fix, not a breaking change.
- **Future DS** introducing a different attribute convention should override at the DS scaffold level, not the runtime. The runtime contract (`DCArtboard` emits both attrs) is fixed.
- **Renames** of `data-dc-slot` → anything else are explicitly out of scope. The slot attr is load-bearing across comments storage, rollback diffs, and pre-Phase-13 canvases.
