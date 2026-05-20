# DDR-023: No HTML→JSX codemod layer — specimens are bare TSX written by hand or sub-agents

- **Date:** 2026-05-19
- **Status:** Accepted
- **Tags:** design, codemod, specimens, scope-correction, phase-3.6.1
- **Related:** [DDR-019](./DDR-019-canvas-tsx-format.md), [DDR-022](./DDR-022-canvas-lib-virtual-module-and-inline-on-handoff.md), [`.ai/plans/phase-3.6.1-canvas-envelope-and-ds-specimens.md`](../plans/phase-3.6.1-canvas-envelope-and-ds-specimens.md), [`.ai/logs/system-reviews/phase-3.6.1-canvas-envelope-and-ds-specimens-review.md`](../logs/system-reviews/phase-3.6.1-canvas-envelope-and-ds-specimens-review.md)

## Context

The Phase 3.6.1 plan committed `html-to-jsx.ts` (~170 LOC regex-driven rewriter) + extended `scripts/migrate-canvases.ts` with a `--target specimens` mode + 26 dedicated tests. Plan rationale: "specimens were left as `.html` after Phase 3.6 — the plug-and-play promise (inspector select + `/design:edit` work on specimens) is broken; codemod converts them in bulk."

Tasks 4–6 of the plan landed the rewriter. Task 6 reported "37/38 auto-migrated, 1 hand-migrated, 26 tests green." Plan acceptance criteria all checked off.

When the user opened the migrated specimens in the dev-server, three classes of visual regression surfaced:

1. **`htmlFor=` bleeding into prose.** The attribute-rename regex matched the word "for" in plain text content. Sentences like "a library for the marketplace" rewrote to "a library htmlFor the marketplace." Same risk class hit `readonly`, `disabled`, `checked`, `selected`, `hidden` — every boolean attribute name.
2. **Triple chrome above specimen content.** The codemod wrapped converted bodies in `<DesignCanvas><DCSection><DCArtboard>` whose label strips rendered ABOVE the original `<header class="specimen-hd">`. Three header rows where the original HTML had one.
3. **Sibling CSS dropped at build time.** `buildCanvasModule()` returned `outputs[0]` only; the bundled `.css` asset (per specimen) was discarded. Specimens with bespoke CSS rendered as unstyled text.

The user's direction was explicit and short: **"zadny html-to-jsx ... uplne zbytecna vrstva navic"** (no html-to-jsx, completely unnecessary layer). Specimens should be authored as native TSX directly — by hand for the existing 38, by sub-agents during DS bootstrap going forward.

We hand-fixed the 38 migrated specimens via a one-shot Bun script (deleted after run), then deleted `html-to-jsx.ts`, `migrate-canvases.ts`, and 26 tests. Tests dropped 149 → 123 (still ahead of the Phase 3.6 baseline of 95).

## Decision

**No transition codemod between HTML specimens and TSX specimens.** Specimens are bare TSX from authoring through delivery. The migration of the existing 38 specimens was a one-shot manual operation. No future specimen flows through a regex rewriter.

The contract:

1. **Specimens have a fixed shape.** Bare `<><header className="specimen-hd">...</header><main className="specimen">...</main></>` — no `@maude/canvas-lib` envelope ([DDR-022](./DDR-022-canvas-lib-virtual-module-and-inline-on-handoff.md)). The envelope is for UI mocks (`Docs Site.tsx`, `Canvas Viewport.tsx`); specimens are flowing reference pages.
2. **DS bootstrap writes specimens directly.** `plugins/design/skills/design-system/SKILL.md` Round 3 dispatches sub-agents whose prompts include the bare-TSX shape verbatim. Sub-agents produce TSX, not HTML; no codemod intermediate.
3. **The existing 38 specimens were migrated once, in-session, by an ad-hoc script that the session deleted after running.** The `_history/_migration-2026-05-15/` archive holds the originals; no live codemod refers to them.
4. **`ds-specimen.tsx.template`** scaffolds the bare-TSX shape (no codemod). It's a template, not a rewriter — read, fill placeholders, write.
5. **`scripts/migrate-canvases.ts`** is gone. So is `html-to-jsx.ts`, `test/html-to-jsx.test.ts`, `test/migrate-specimens.test.ts`.

## Alternatives considered

### A — Keep the codemod, fix the regex bugs

The plan's stance. Patch the boolean-attribute renames to skip prose context. Strip the triple-chrome wrapping.

- **Pros:** Bulk migration stays automated; future HTML specimens (none currently planned) still convert.
- **Cons:** No future HTML specimens are planned. The codemod's only consumer was the 2026-05-15 one-shot migration. Maintaining a regex-based rewriter as "permanent infra" for a job that will never run again is dead-weight code with shipping bugs (we have evidence — the bugs landed before they were caught). Test coverage cost (26 tests) buys nothing future.

### B — Replace the regex with an AST-based rewriter

Use `parse5` + a real HTML AST, traverse, emit JSX through `magic-string`. Reliable conversion semantics — no prose-bleed risk.

- **Pros:** Correct by construction.
- **Cons:** Heavier dep (`parse5` ~250 KB). Still solving a problem that has no future invocations. The investment in correctness has zero ROI when the codemod's only consumer is the deleted one-shot migration.

### C — Keep the codemod under `scripts/` (not part of dev-server runtime)

Demote it to "scratch tooling" — not tested, not shipped, but kept around in case someone needs HTML→TSX conversion later.

- **Pros:** Optionality.
- **Cons:** Untested scratch tooling is worse than no tooling — a future user finds it, runs it, hits the same bugs we caught. Better to have nothing than something that lies.

### D — Two-stage scaffold: HTML draft → codemod → TSX final, as the authoring loop

Authors write HTML, codemod converts to TSX, dev-server serves TSX.

- **Pros:** HTML is faster to scaffold than TSX (no JSX-attribute renames to remember).
- **Cons:** Authoring loop now goes through a regex layer that has shipped bugs. Sub-agents would have to produce HTML they're not running, then trust the codemod. TSX is what the dev-server and `/design:edit` understand natively — adding HTML as an intermediate makes every operation indirect. The `class=` → `className=` cost is one-time per specimen; the codemod-debugging cost is recurring forever.

## Consequences

**Positive:**

- **Less code to maintain.** 4 modules + 26 tests + ~600 LOC of complexity removed. Tests dropped 149 → 123 — every removed test was infrastructure for the deleted codemod.
- **No regex-based syntactic rewriter to mistrust.** The Phase 3.6.1 incident showed regex rewrites can match prose by accident. Removing the layer removes the risk class.
- **Sub-agents produce TSX directly.** Fewer cognitive hops in the authoring loop. The SKILL.md sub-agent prompt now describes the final on-disk shape; the agent writes that shape; the dev-server reads that shape. No transformation in the middle to debug.
- **Specimens have one canonical shape.** Without the codemod's envelope-wrapping, specimens converge on the `specimen-hd` / `<main class="specimen">` skeleton inherited from the original HTML — visually consistent with DS conventions without any tooling enforcing it.
- **One-shot migrations are honest about their lifetime.** The 2026-05-15 conversion ran once, wrote 38 files, and the script deleted itself. No "permanent infra" pretense around what was always a one-time job.

**Negative / trade-offs:**

- **Hand-fixing 38 specimens cost ~2 hours of session time** (after the visual regression was caught). Acceptable: the time spent debugging the codemod's regex bugs would have been worse, and the one-shot ad-hoc script bulk-applied most fixes.
- **Future HTML→TSX conversions (if any) start from zero.** No reusable infrastructure. Acceptable: no such conversion is planned; if one materializes, write a fresh one-shot script tailored to that specific input shape rather than maintaining a general-purpose rewriter.
- **Sub-agent prompts must spell out the bare-TSX shape exactly.** Drift between SKILL.md prompt + actual output requires manual `_components.css` review. Mitigated by [DDR-021](./DDR-021-design-smoke-gate-for-infra-and-bulk-ui-work.md) — `/design:smoke` catches per-canvas render regressions including specimens generated by sub-agents.

**Closed risks:**

- ~~"Regex rewrites match prose by accident"~~ — closed by removing the regex layer.
- ~~"Codemod ships with hidden bugs surfaced only when user opens migrated files"~~ — closed by removing the codemod; sub-agent output is verified per-specimen by `/design:smoke`.
- ~~"Transition codemod becomes forever-debt"~~ — closed by deletion + DDR.

**Lesson generalized:**

Transition codemods that don't get deleted are forever-debt. A plan that introduces a codemod should commit upfront to one of two shapes: (1) one-shot script that the session deletes after running, or (2) permanent contract with type-safe AST (not regex) + tests that cover the full input grammar. The 3.6.1 plan straddled both — wrote "v1 of this feature" while the actual invocation was one-shot. The straddle is the failure mode; pick a shape before writing the code.

## Compatibility notes

- **Existing `.html` specimens** are archived under `.design/_history/_migration-2026-05-15/system/<ds>/preview/`. Not deleted; not served. Reference only.
- **Future HTML specimens from any source** — there is no automated path. Write the TSX directly, or write a one-shot conversion script tailored to that specific batch.
- **Downstream projects using the design plugin** see no change — `mdcc init` + `/design:setup-ds` produce TSX specimens. The codemod was internal to this repo's migration; never shipped via the plugin.
- **`plugins/design/dev-server/`** has fewer dependencies — no `html-to-jsx.ts` referenced by `migrate-canvases.ts` referenced by tests. The pipeline is shorter and easier to read.

## Research source

- Phase 3.6.1 retro ([`.ai/logs/system-reviews/phase-3.6.1-canvas-envelope-and-ds-specimens-review.md`](../logs/system-reviews/phase-3.6.1-canvas-envelope-and-ds-specimens-review.md)) divergence **G1** ("Dropped html-to-jsx codemod + migrate-canvases.ts entirely (user-driven)") — captures the user direction + lesson verbatim.
- STATE.md "Phase 3.6.1 visual-regression repair" section (2026-05-18) — concrete failure modes (`htmlFor` in prose, triple-chrome, dropped CSS) that motivated the cut.
- Phase 3.6.1 plan ([`.ai/plans/phase-3.6.1-canvas-envelope-and-ds-specimens.md`](../plans/phase-3.6.1-canvas-envelope-and-ds-specimens.md)) Tasks 4–6 + "HTML→JSX rewrite scope" design-decisions row — the originally-shipped codemod that's now deleted.
