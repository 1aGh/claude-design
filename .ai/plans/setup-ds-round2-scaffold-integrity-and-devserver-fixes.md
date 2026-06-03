# Feature: setup-ds Round-2 — scaffold-integrity gates + dev-server boot/export hardening

> **Round 2 of the moodboard work** (`setup-ds-moodboard-and-direction-gates`, archived). That plan landed the two visual direction gates and explicitly deferred the items below to "the natural Round 2 once the gates land." This plan picks them up, **minus the one already fixed** (see Context). Two task groups with very different risk: **Group A is markdown / sub-agent-prompt only (safe anytime); Group B touches dev-server code under active WIP and must coordinate / use a separate branch.**

## Description

The moodboard direction gates catch a *disliked direction* before the scaffold. They do **not** catch a scaffold that ran but produced **silently-broken output** — empty files trusted as `written`, a transpile that masks source bugs, contrast ratios asserted-but-wrong — nor do they help when the **dev-server itself won't boot** (the very tool the visual gates depend on). Round 2 closes both: cheap **scaffold-integrity gates** (Group A) and **dev-server boot/export fail-loud hardening** (Group B).

These were surfaced two ways: (1) the original plan's "Out of scope" section catalogued them from the StudyFi-v2 + studio retros; (2) the **live moodboard dogfood (2026-06-02) hit two of them first-hand** — `server-up` crashed on a missing `yjs`, and `/_api/export` returned `200` with an **empty body** because Playwright browsers weren't installed. Both degraded silently to a manual workaround — exactly the failure mode the "fail loud" design forbids.

## User Story

As a **person bootstrapping or browsing a design system**, I want the scaffold to **fail loud when it produced empty / broken / falsely-asserted output**, and the dev-server to **fail loud with a remediation hint when it can't boot or can't export**, so that **I never silently ship a 0-byte specimen, an un-bundled canvas, a wrong "✓ 4.5:1" claim, or discover mid-flow that the mandatory visual gate quietly didn't run.**

## Problem

- **Roster trusts `status: written` but files were 0 B** — both StudyFi v1 and v2-mid-run masked empty files; reconciliation passed.
- **`esbuild --bundle=false` transpile masked two source bugs** the real dev-server bundle caught (parse-clean, fails-at-module-eval — the `AcceleratedAnimation is not defined` class).
- **CSS-comment-hygiene:** a `*/` inside a `/* */` block closed the comment early → "Bundle failed".
- **`React.*` used without an import** → runtime crash the structural critic doesn't see.
- **Contrast-claim drift:** generated `colors_and_type.css` asserted `✓ 4.5:1` ratios that were wrong — a ratio was never actually computed.
- **`server-up` / `visual-sanity` crash on missing `yjs`** (`bun server.ts` requires it at boot via `sync/index.ts`) — the mandatory visual-sanity gate silently degraded to a manual workaround. Hit live 2026-06-02 (global `@1agh/maude` install + a fresh worktree both lacked `yjs`).
- **`/_api/export` returns `200` + empty body** when Playwright browsers aren't installed — no fail-loud, no remediation. Hit live 2026-06-02 (the clean-poster export path silently produced 0 bytes).

## Solution

```
Group A — scaffold-integrity gates (markdown / sub-agent-prompt level; safe anytime)
  reconcile → ★ non-empty-file gate → ★ real-bundle gate → ★ css-comment lint
            → ★ React-import check → ★ contrast-claim discipline → visual sanity → panel

Group B — dev-server boot/export fail-loud (CODE; coordinate w/ Phase-13.x WIP, separate branch)
  server-up/visual-sanity boot → ★ yjs-present preflight (self-heal or fail-loud + hint)
  /_api/export (png/pdf/svg)    → ★ Playwright-browser preflight (fail-loud + `npx playwright install` hint)
```

## Metadata

- **Ticket**: none (internal plugin hardening; dogfooded `.ai/`).
- **Type**: Hardening / bug-fix (two tracks).
- **Complexity**: Group A = Low (markdown + sub-agent prompts). Group B = Medium (dev-server code under active WIP — packaging + adapter preflights).
- **App/Package**: `plugins/design` (Group A: skill `design-system` `_bootstrap.md` + completeness-critic + sub-agent prompts; Group B: `plugins/design/dev-server/` boot + export adapters + packaging).
- **Dependencies**: existing scaffold/reconcile flow (Group A); `bun`, `yjs`, Playwright (`exporters/*.ts`), the boot-self-heal (DDR-044) (Group B).

---

## Context References

### Must-Read Files

- `.ai/plans/archive/setup-ds-moodboard-and-direction-gates.md` — **the originating plan** (its "Out of scope" section is the spec for this one).
- `plugins/design/skills/design-system/_bootstrap.md` — reconciliation rule ("asserts every row is `written`"), Batch-A serial writes, "Accent color heuristic" (contrast claims), visual-sanity helper-exit-code table. Group A gates land around reconcile + Batch A.
- `plugins/design/agents/design-system-completeness-critic.md` — the structural critic that should gain the non-empty / React-import / contrast checks (or they live in reconcile).
- `plugins/design/templates/design-system-inspiration/SUB-AGENT-PROMPTS.md` — the MANDATORY safety blocks; the CSS-comment + React-import + no-empty rules belong here so every slice inherits them.
- `plugins/design/dev-server/bin/server-up.sh` + `runtime-health.sh` + `visual-sanity` — boot path; where the yjs preflight lands.
- `plugins/design/dev-server/sync/index.ts` (~line 451 "adopted local state (hub was empty)") — the boot-time `yjs` import site; **NOTE the live WIP + the DDR-076 guard already here.**
- `plugins/design/dev-server/exporters/{index.ts,png.ts,pdf.ts,svg.ts}` — the Playwright render path that returned empty; add the browser preflight + fail-loud.
- `plugins/design/dev-server/boot-self-heal.ts` + [DDR-044](.ai/decisions/DDR-044-marketplace-install-vs-npm-install-artifact-strategy.md) — the first-launch `bun install --production` that *should* pull `yjs` but didn't on the global install.

### Already done in `main` — do NOT re-implement

- **`maude design serve` truncating local `.tsx` to 0 B on a denied/empty hub sync** (original plan Out-of-scope #2, highest severity) → **fully fixed AND tested in `main`** by [DDR-076](.ai/decisions/DDR-076-empty-hub-doc-never-clobbers-local-canvas.md) + `fc4233b` ("an empty hub doc never clobbers a non-empty local canvas"). The regression test already exists: `plugins/design/dev-server/test/sync-agent.test.ts:205` — *"empty hub doc does NOT clobber a non-empty local body — seeds local up instead (data-loss guard)"*. **Nothing to do** — dropped from Round-2 (was Task B3 in the first draft).
- **TSX sync ON by default + `maude doctor` TSX-sync health** — landed on `main` (`620eff8`, `0d89fd0`, `DDR-079-tsx-sync-default-on`). Unrelated to this plan's scope; listed only so Round-2 doesn't re-touch it.

### Patterns to Follow

- **Helper exit-code → recovery mapping** (`_bootstrap.md` visual-sanity table) — the yjs + Playwright preflights reuse the same "distinct exit code per failure mode + AskUserQuestion, never silently elide" discipline.
- **Fail-loud-not-silent** (the visual-sanity "mandatory, never elided" rule) — Group B's whole point: a boot/export that can't run must say so with a fix hint, never degrade to a manual workaround.
- **Marketplace-vs-npm artifact strategy** (DDR-044 / boot-self-heal) — the yjs fix likely belongs in the self-heal/packaging, not a new runtime dep path.

---

## Tasks

### Group A — scaffold-integrity gates (markdown / sub-agent-prompt; safe to land independently)

#### Task A1: Post-reconcile non-empty file gate
- **Do**: In `_bootstrap.md` reconciliation, after asserting every row is `written`, **stat each written file** and reject any `0 B` (or < a tiny floor, e.g. < 20 B) row as a regression — same severity as a `pending` row. The roster's `loc:` field is a claim; verify it against disk.
- **Validate**: a deliberately-emptied specimen flips reconciliation to fail.

#### Task A2: Real-bundle gate (replace transpile-only check)
- **Do**: Where the flow validates a generated specimen with `esbuild --bundle=false` (transpile-only), switch to a **real bundle** (the dev-server's `canvas-build` path / `runtime-health`) so module-eval errors (`X is not defined`) are caught, not just parse errors. Cross-link the existing `runtime-health.sh` "parse-clean, fails-at-module-eval" rationale.
- **Validate**: a specimen referencing an undefined symbol fails the gate.

#### Task A3: CSS-comment-hygiene + React-import lint (sub-agent prompt + reconcile)
- **Do**: Add to `SUB-AGENT-PROMPTS.md` MANDATORY safety blocks: (a) never write `*/` inside a `/* */` block; (b) any `React.*` usage requires an explicit import. Add a reconcile-time grep that flags both across generated `preview/*.tsx` + CSS.
- **Validate**: a planted `*/`-in-comment and a planted bare `React.useState` both flag.

#### Task A4: Contrast-claim discipline
- **Do**: Forbid asserting a contrast ratio (`✓ 4.5:1`, `AAA`, etc.) in generated `colors_and_type.css` / READMEs **without computing it**. Either compute (WCAG/APCA from the actual token pair) or don't claim. Add a reconcile grep for ratio-claim substrings + a "was it computed?" check.
- **Validate**: a hardcoded wrong `✓ 4.5:1` on a 2.1:1 pair flags.

### Group B — dev-server boot/export fail-loud (CODE — coordinate with Phase-13.x WIP, separate branch)

> **These touch `dev-server/` code that has live WIP on `main` (sync/, exporters/). Do NOT bundle with Group A. Branch separately; confirm with the WIP owner before touching `sync/`.**

#### Task B1: `yjs`-present boot preflight (self-heal or fail-loud + hint)
- **Do**: Make `server-up` / `visual-sanity` boot **not crash raw** on a missing `yjs`. Preferred: the boot-self-heal (DDR-044) ensures `yjs` (+ `y-protocols`, `lib0`) resolve before `bun server.ts` — investigate why the global `@1agh/maude` install + a fresh worktree both lacked it (root-vs-subpackage deps). Fallback: a preflight that exits with a **distinct code + `→ run: bun install` (or the right remediation) hint**, surfaced as the visual-sanity exit-code recovery, never a silent manual workaround.
- **Validate**: boot against an install missing `yjs` → clear remediation, not a stack trace; the mandatory visual gate doesn't silently skip.

#### Task B2: Playwright-browser export preflight (fail-loud + remediation)
- **Do**: In the export adapters (`exporters/{png,pdf,svg}.ts` / `index.ts`), **preflight that a Playwright browser is installed/launchable** before rendering. On miss, return a **non-200 with a clear message** (`export failed: no Playwright browser — run npx playwright install chromium`), never a `200` + empty body. Surface it through `POST /_api/export` + `/design:export`.
- **Validate**: export PNG with no browsers installed → explicit error + hint, not 0 bytes.

---

## Validation

1. **Group A self-consistency**: re-read the reconcile → Batch-A → visual-sanity flow; each new gate has a distinct failure + recovery and routes through the bypass-log when it deviates.
2. **Plugin-cli reachability** (if any plugin markdown gains a bin call): `node cli/lib/plugin-cli-reachability.test.mjs` (DDR-062).
3. **Group B**: `pnpm test:dev-server` (the export + sync + boot tests); `pnpm format` (biome) on any touched `.ts`.
4. **Live dogfood (the real proof)**: `/design:setup-ds <scratch>` with a deliberately-broken slice (0-byte file, undefined symbol, bad contrast claim) → each gate fires; boot with `yjs` removed → remediation hint; export with no Playwright browser → explicit error.
5. **Roadmap regen** (STATE/plans touched): `pnpm --filter @maude/site gen:roadmap`.

## Acceptance Criteria

- [x] Group A: 0-byte file, un-bundleable specimen, `*/`-in-comment, bare `React.*`, and a wrong contrast claim each fail reconciliation/lint — **verified** via fixture test (all 4 fire; balanced/named-import/type-scale cases don't false-positive). A2 real-bundle = the dev-server render gate (visual-sanity/hero-preview), transpile-only explicitly forbidden.
- [x] Group B: missing-`yjs` boot **fails loud with a remediation hint** (exit 3 + `bun install`, never a silent timeout — verified end-to-end); missing-Playwright export already fails loud (`bf84825`, 500 + hint, pw-launch test 5/5) — **B2 verify-only, B1 implemented**
- [x] Group A + Group B are logically independent (different risk) — plan mandated different branches, but per user direction both ship on **one branch** `feat/setup-ds-round2-scaffold-integrity-gates` / one PR; commits `b265ddd` (A) + `ae41423` (B) stay disjoint
- [x] Any decision (e.g. where the contrast computation lives, self-heal vs preflight for yjs) recorded as a DDR — **DDR-082** (Group A, incl. contrast-computation-location decision); **DDR-083** (Group B/B1, preflight-over-self-heal decision)

## Out of scope / notes

- **DDR numbering (resolved):** `main` authoritatively holds **`DDR-079` = `tsx-sync-default-on`** (committed `620eff8` / `0d89fd0`). The moodboard work's `DDR-079` (PR #32) therefore **must renumber to `DDR-080`** (next free on `main`). Round-2's own new DDRs start at **`DDR-081`**.
- **Group B is WIP-adjacent.** `sync/` + `exporters/` are under active Phase-13.x development on `main`; do Group B on a coordinated branch, not on top of the moodboard worktree.
- The originating plan's two visual gates are **done** (`DDR-079`, archived plan); this plan is purely the deferred integrity/robustness layer beneath them.
