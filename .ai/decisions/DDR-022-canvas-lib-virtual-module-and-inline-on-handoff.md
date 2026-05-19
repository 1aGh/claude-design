# DDR-022: `@mdcc/canvas-lib` is a project-owned virtual module, inlined per-canvas on handoff

- **Date:** 2026-05-19
- **Status:** Accepted — **partially superseded by [DDR-025](./DDR-025-canvas-lib-single-source-in-dev-server.md) (2026-05-19)**
- **Tags:** design, dev-server, canvas-lib, virtual-module, handoff, registry-item, phase-3.6.1
- **Related:** [DDR-019](./DDR-019-canvas-tsx-format.md), [DDR-021](./DDR-021-design-smoke-gate-for-infra-and-bulk-ui-work.md), [DDR-025](./DDR-025-canvas-lib-single-source-in-dev-server.md), [`.ai/plans/phase-3.6.1-canvas-envelope-and-ds-specimens.md`](../plans/phase-3.6.1-canvas-envelope-and-ds-specimens.md), [`.ai/logs/system-reviews/phase-3.6.1-canvas-envelope-and-ds-specimens-review.md`](../logs/system-reviews/phase-3.6.1-canvas-envelope-and-ds-specimens-review.md)

> **Status update (2026-05-19):** Partially superseded by [DDR-025](./DDR-025-canvas-lib-single-source-in-dev-server.md). The "project-owned source under `<designRoot>/_lib/`" assertion is reversed — canvas-lib now ships with the dev-server install at `plugins/design/dev-server/canvas-lib.tsx` (single source, no per-project scaffold). The "virtual specifier at author time + inlined source at handoff time" two-state model remains in force; only the *physical home* of the canonical source changed.

## Context

Phase 3.6 ([DDR-019](./DDR-019-canvas-tsx-format.md)) flipped canvases from HTML to TSX and required the codemod to inline frame primitives (`DesignCanvas` / `DCSection` / `DCArtboard`) per canvas — the rule was "no ambient `import { DesignCanvas } from '@/design-runtime'`" because `/design:handoff` ships one `.tsx` file via shadcn registry-item and an ambient dep would break the drop.

That worked for 3 canvases. With Phase 3.6.1 adding ~38 DS specimens to the TSX surface, "inline per canvas" projects to **~50 copies** of the same primitive set + helpers. Any future change to the primitive API requires a sweep over 50 files. Reading the diff to verify a change is correct becomes intractable.

Three concrete pressures forced the rethink:

1. **Helper surface needs to grow.** Specimens want shared `SpecimenHeader` / `TokenChip` / `ColorSwatch` / `useTokens()` etc. Without a shared library, every specimen reinvents them — the existing `.html` set already shows the visual drift this causes.
2. **Phase 3.6 codemod produced runtime-broken output.** It copied JSX referencing `<DesignCanvas>` but never injected the function definitions — the white-page repro that triggered Phase 3.6.1. The fix wasn't "inject more reliably"; it was "share the source so there's one place to look".
3. **Handoff is still the load-bearing constraint.** Any sharing scheme that breaks "one self-contained `.tsx` drops via shadcn registry" reverts every Phase 3.6 design choice.

The challenge: keep the *authoring* surface DRY (one library, many imports) **while** the *handoff* output stays self-contained (no `@mdcc/canvas-lib` reference in the dropped file).

## Decision

**Two-state model — virtual import at author time, inlined source at handoff time.**

1. **`<designRoot>/_lib/canvas-lib.tsx`** is project-owned source — a regular `.tsx` file living next to canvases under the design root. Not an npm package. Not versioned externally. Scaffolded into the design root on first DS bootstrap (`/design:setup-ds` writes it from `plugins/design/templates/canvas-lib.tsx.template` if missing).
2. **Canvases and specimens import from the magic specifier `@mdcc/canvas-lib`** — `import { DesignCanvas, ColorSwatch } from "@mdcc/canvas-lib"`. The specifier is **resolved virtually** by a `Bun.build` plugin (`canvas-lib-resolver.ts`) that rewrites `@mdcc/canvas-lib` → `<designRoot>/_lib/canvas-lib.tsx` before bundling. The browser-loaded canvas module includes the bundled library code; no extra runtime fetch.
3. **`/design:handoff` inlines used exports.** `canvas-lib-inline.ts` parses `<designRoot>/_lib/canvas-lib.tsx` via `oxc-parser`, builds an `export-name → { source, deps[] }` map, BFS-resolves transitive helper references (e.g. `ColorSwatch` pulls `TokenChip` along), strips the `@mdcc/canvas-lib` import line, and appends resolved bodies after the canvas's default export. The emitted `files[0].content` has **zero `@mdcc/canvas-lib` references** — verified by grep at the end of every handoff.
4. **Updates propagate via re-import, not codemod.** Change `canvas-lib.tsx` once → every canvas re-bundles against the new version on next HMR cycle. Authors never edit a 50-file diff.
5. **`/design:edit` Step 1.5 pre-loads `canvas-lib.tsx`** into orchestrator context for every `.tsx` canvas (regardless of `css_mode`). The library IS the authoring vocabulary; cold-editing without seeing the available helpers is a known foot-gun.

The library ships **opt-in helpers**, not a framework — the frame envelope (`DesignCanvas` / `DCSection` / `DCArtboard` / `DCPostIt`) is always imported; helpers (`SpecimenHeader`, `ColorSwatch`, `useTokens`, etc.) only land in canvases that explicitly import them. Tree-shaken by `Bun.build` at the per-canvas level; inlined per-canvas at handoff time. Smoke TSX's emitted registry-item is ~3 KB; a specimen with 4 helpers is ~8 KB.

## Alternatives considered

### A — Keep "inline per canvas" — copy primitives + helpers into every `.tsx`

Phase 3.6's original choice, extended to helpers.

- **Pros:** Zero runtime indirection. Handoff is trivially self-contained (already inline). No virtual-module machinery.
- **Cons:** ~50 copies × growing helper surface. Visual drift between specimens that should agree. Codemod sweeps for any primitive change. Already proven brittle by Phase 3.6's white-page repro (codemod was supposed to inject primitives, didn't).

### B — Real npm package `@mdcc/canvas-lib` shipped via the marketplace

Publish the library as an external dep. Canvases import it like any other module.

- **Pros:** Clean import contract. Versioning. Tree-shakeable.
- **Cons:** Breaks the handoff drop. shadcn registry-item ships ONE file; depending on `@mdcc/canvas-lib` means downstream consumers `npm install` it — friction the registry mechanism exists to avoid. Also: every project pinning a version drifts from the template; we lose the "Edit canvas-lib once → every canvas updates" property because consumer apps are pinned to a published version.

### C — Window globals injected by `_canvas-shell.html`

What the legacy `.html` canvases did via babel-runtime. Make `DesignCanvas` etc. live on `window.__canvas_lib__`.

- **Pros:** Zero per-canvas import noise.
- **Cons:** TypeScript can't type window globals well. Handoff drop breaks (consumers don't have the shell). Loses the per-canvas tree-shake. This is what Phase 3.6 was trying to escape; reverting is non-starter.

### D — Single-source template + codemod-managed mirror per canvas

Keep "inline" as the canvas-on-disk shape, but use a codemod (run on every primitive change) to sync mirrors from a canonical template.

- **Pros:** Handoff stays self-contained (already inline). Authors get one file to read per canvas.
- **Cons:** Codemod becomes load-bearing infra. Hand-edits to a primitive's mirror become silent regressions when next codemod run overwrites them. Mirror divergence has no compile-time signal. Phase 3.6 already showed how brittle the "codemod must reach every canvas" assumption is.

### E — Vite-style `?inline` import suffix

Use `import lib from "@mdcc/canvas-lib?inline"` to opt into inlining per import statement.

- **Pros:** Per-canvas opt-in/out.
- **Cons:** Surface complexity. The choice is uniform across the project (handoff always inlines); making it per-import-statement is configuration without a use-case.

## Consequences

**Positive:**

- **Single source of truth.** Edit `<designRoot>/_lib/canvas-lib.tsx`; every canvas re-bundles against the new version on next HMR cycle. No codemod sweep.
- **Helper surface can grow safely.** Adding `<TokenChip>` to the library doesn't bloat canvases that don't import it (`Bun.build` tree-shakes per canvas). Specimens converge on shared shapes; visual drift drops.
- **Handoff stays self-contained.** Per-canvas inlining at registry-emit time preserves the shadcn drop contract from DDR-019. Zero `@mdcc/canvas-lib` references in `files[0].content` — guaranteed by `canvas-lib-inline.ts` + verified by grep in 14 dedicated tests.
- **Authoring vocabulary becomes visible.** `/design:edit` pre-loads the library so the orchestrator sees what helpers exist before suggesting "make a stamp" or "render token chips". Eliminates a known foot-gun of cold-edit reinvention.
- **Library code participates in the data-cd-id pipeline.** Primitives get IDs like any JSX; Cmd+Click into the library's own surface (e.g. selecting an `DCArtboard` label strip) works the same as selecting a canvas element. Inspector + AST-edit are uniform across user-authored JSX and library JSX.

**Negative / trade-offs:**

- **Two-state mental model.** Authors write `import { DesignCanvas } from "@mdcc/canvas-lib"`; what ends up on disk after handoff is `function DesignCanvas() { ... }` appended after `export default`. The transformation is invisible at author time. Mitigated by: (1) `inlineUsedExports` is pure / tested, (2) the handoff CLI verifies zero `@mdcc/canvas-lib` references on every emit, (3) DDR + README explain the model.
- **Virtual specifier is non-standard.** `@mdcc/canvas-lib` resolves nowhere without the dev-server plugin. Reading a canvas in a stock TypeScript editor with no Bun config shows an "unresolved import" red squiggle. Acceptable: canvases are designed to run through the dev-server. The README + tsconfig comment direct users to the Bun.build resolver.
- **Library changes invalidate every canvas's bundle cache.** A keystroke in `canvas-lib.tsx` triggers a hard HMR reload across all open iframes (the Phase 3.6.1 HMR-broadcast `mode: "hard"` branch). Acceptable: shared-source semantics demand it; cold-rebuild is < 200 ms with `Bun.build` warm.
- **Library IDs churn under `data-cd-id` injection.** Every keystroke in `canvas-lib.tsx` re-IDs every primitive node. Tests cannot pin library-internal IDs (documented in the plan's Task 1 gotcha). Mitigated by: tests target canvas-user-authored JSX, not library JSX.
- **Handoff sidecar size grows linearly with helper usage.** A canvas importing 4 helpers + their transitive deps adds ~3 KB to `files[0].content`. Soft warning at 30 KB; user can audit + opt out of helpers per canvas. No hard limit.

**Closed risks:**

- ~~"Codemod sweeps every primitive change to N canvases"~~ — closed by single-source library.
- ~~"Helpers reinvented per specimen → visual drift"~~ — closed by shared canvas-lib surface.
- ~~"Cold-edit reinvents existing helpers"~~ — closed by `/design:edit` Step 1.5 pre-load.
- ~~"Handoff ships ambient dep"~~ — closed by `inlineUsedExports` + grep gate.

## Compatibility notes

- **Pre-3.6.1 canvases** without the `@mdcc/canvas-lib` import line keep working — the resolver is a no-op when the specifier isn't imported. No forced migration; canvases adopt the library when authors reach for it.
- **Projects without `<designRoot>/_lib/canvas-lib.tsx`** that import `@mdcc/canvas-lib` fail loud at the top level (`canvas-build.ts` pre-flight checks the file's existence and surfaces the missing-lib error before `Bun.build` swallows it in a generic "Bundle failed"). Help line points at `/design:setup-ds`.
- **Downstream projects using the design plugin** get `<designRoot>/_lib/canvas-lib.tsx` for free on first `/design:setup-ds`. Updating the library template ships via `mdcc` releases; existing project copies aren't force-overwritten (template hash check planned for Phase 3.7 if drift becomes an issue).
- **`/design:handoff` consumers** see no change — the registry-item drop is still self-contained. The fact that primitive functions are inlined-from-library vs inlined-by-codemod is invisible to the consumer.

## Research source

- Phase 3.6.1 plan ([`.ai/plans/phase-3.6.1-canvas-envelope-and-ds-specimens.md`](../plans/phase-3.6.1-canvas-envelope-and-ds-specimens.md)) — Solution sections A–F + Design Decisions table.
- Phase 3.6.1 retro ([`.ai/logs/system-reviews/phase-3.6.1-canvas-envelope-and-ds-specimens-review.md`](../logs/system-reviews/phase-3.6.1-canvas-envelope-and-ds-specimens-review.md)) — divergence G1 + G2 contextualize the pattern's shipping condition.
- Phase 3.6 close-out (DDR-019) — the "no ambient deps" constraint this DDR preserves at handoff time while breaking at author time.
