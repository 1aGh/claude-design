# DDR-014: Dev-server CSS uses `@layer reset, tokens, layout, shell, components, utilities` with Lightning CSS at build time

- **Date:** 2026-05-15
- **Status:** Accepted
- **Tags:** design, dev-server, css, cascade, layers, lightningcss, oklch, tokens, build-pipeline, phase-3.4
- **Related:** [DDR-009](./DDR-009-bun-runtime-authoritative-for-dev-server.md), [`.ai/plans/phase-3.4-architecture-refactor.md`](../plans/phase-3.4-architecture-refactor.md) (Task 6 — the rewrite this DDR scopes), `plugins/design/dev-server/client/styles.css` (1400 LOC monolith — replaced), `.design/system/project/colors_and_type.css` (DS-owned token source), [`.ai/plans/phase-3.5-dev-server-ui-ux-refresh.md`](../plans/phase-3.5-dev-server-ui-ux-refresh.md) (consumer of the token alias layer)

## Context

`plugins/design/dev-server/client/styles.css` is 1400 LOC, unstructured, hand-rolled cascade. Symptoms:

1. **Implicit cascade.** Specificity wars resolved by source-order luck. Adding a new shell-chrome rule may or may not override an earlier rule depending on selector specificity; debugging requires reading the whole file.
2. **No token boundary.** Color values are spelled out in the file (some as hex, some as OKLCH, some referencing `--*` custom properties from a different file). The DS token source `.design/system/project/colors_and_type.css` is consumed by *some* declarations but not others — drift accumulates.
3. **No fallback strategy.** OKLCH is used directly without sRGB fallbacks. Older Safari (< 15.4) and Firefox-ESR readers see broken colors.
4. **Minification by hand.** No build step → comments and whitespace ship to the client. Roughly 30% of the 1400 LOC is comments + blank lines.
5. **No clear extension path for Phase 3.5.** Phase 3.5 (UI/UX refresh) wants to bring DS tokens into the shell as `--u-*` aliases. Without a layer boundary, the alias declarations would compete with shell rules at the same specificity, leading to load-order bugs.
6. **No path to component-scoped styles.** Future Phase 6 (comments overlay), Phase 8 (collab cursors), Phase 12 (in-canvas editor) all want component-scoped rules that don't leak into the shell. Layer-less CSS makes scope a manual discipline.

The CSS Cascade Level 5 [`@layer` API](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer) (baseline since 2022, supported in all modern browsers) solves cascade explicitness directly: layer order is global per document, and within a layer the usual specificity rules apply. Unlayered rules sit *above* all layered rules, which makes layering a safe additive migration.

Lightning CSS (the Rust-native engine used by Tailwind v4's Oxide) handles `@layer` flattening, OKLCH → sRGB fallback emission, custom-media expansion, and minification at build time. It's a single binary called from `build.ts` (Phase 3.4 Task 3), output is a single minified `dist/styles.css` file. Microsecond rebuild times keep the dev loop fast.

## Alternatives considered

### Option A — Keep flat 1400 LOC, add comments

Annotate the existing file with "section" comments (`/* === RESET === */`, `/* === LAYOUT === */`, …) without restructuring. No `@layer`, no build step.

- **Pros:** Zero migration cost. Existing rules keep working.
- **Cons:** Cascade is still implicit. New rules still cascade by source order. OKLCH still ships without fallbacks. Comments still ship to the client. Phase 3.5's token aliasing still has no contract.
- **Rejected:** the problems are structural, not documentation gaps.

### Option B — CSS Modules via build step

Adopt CSS Modules. Each component imports its `.module.css`; class names are hashed at build time.

- **Pros:** Component-scoped styles automatically (no leakage).
- **Cons:** Forces every shell component to refactor to import its CSS module. Bundling CSS Modules into the IIFE shell bundle adds complexity (or splits styles across many `<style>` tags at runtime). Doesn't address tokens or fallbacks. The shell isn't large enough for the boilerplate to pay off.
- **Rejected:** disproportionate refactor for shell-scale CSS.

### Option C — Tailwind utilities

Adopt Tailwind for utility classes; keep custom CSS for non-utility cases.

- **Pros:** Utility-first ergonomics; tree-shaken via JIT.
- **Cons:** Doubles the styling system (utility classes + remaining custom CSS). Token aliasing is via Tailwind's `theme()` rather than DS-owned `--u-*` variables, which fights with Phase 3.5's plan. Bundle includes the Tailwind runtime config.
- **Rejected:** misaligned with the DS token contract; ergonomics gain doesn't justify the runtime + mental model added.

### Option D — `@layer` cascade + Lightning CSS (this DDR)

Six layers in declared order: `reset, tokens, layout, shell, components, utilities`. Lightning CSS handles flattening, OKLCH fallbacks, minification.

- **Pros:** Cascade is explicit and documented; layer order is the contract. Token boundary is its own layer, sourced from the DS file via `@import` so drift is impossible. Fallbacks are emitted automatically. Minified single-file output. Component-scoped rules go in the `components` layer; future utilities go in the `utilities` layer at the top of the cascade. Phase 3.5's `--u-*` aliases land in the `tokens` layer with a contract.
- **Cons:** Adds a build step (already added for JS in Phase 3.4 Task 3). Lightning CSS becomes a build-time dep.
- **Selected.**

## Decision

We adopt **Option D — `@layer reset, tokens, layout, shell, components, utilities` with Lightning CSS at build time** because:

1. **Cascade explicitness is structural.** Documenting the cascade once in `_index.css`'s `@layer` declaration prevents specificity wars by construction. New rules pick their layer; the layer settles the cascade.
2. **Token boundary maps to a real ownership boundary.** `.design/system/project/colors_and_type.css` is DS-owned. Importing it into the `tokens` layer (and only the `tokens` layer) makes drift impossible — non-token layers can only consume `--*` references, never define them.
3. **Fallbacks ship for free.** Lightning CSS emits OKLCH and sRGB side-by-side; older Safari + Firefox-ESR users see correct colors without us authoring the duplicates.
4. **One build step, one output file.** No CDN. No per-module CSS. The client requests `dist/styles.css`; the browser caches it.
5. **Phase 3.5 + Phase 6/8/12 all land cleanly.** Phase 3.5's `--u-*` aliases go in the `tokens` layer. Phase 6's comments overlay rules go in `components`. Future utility classes go in `utilities` at the top. The cascade absorbs all of them without specificity arguments.

## Layer order — rationale

The order (`reset → tokens → layout → shell → components → utilities`) is fixed; it encodes a precedence semantic:

1. **`reset`** — baseline normalization. Lowest precedence; later layers override freely.
2. **`tokens`** — `--*` custom properties. Defines the design language. No selectors with high specificity here — only `:root` (and rarely `[data-theme]` block scopes). Imports `.design/system/project/colors_and_type.css`.
3. **`layout`** — page-level structure: grid, flexbox containers, the dev-server's "tree pane + tabs + canvas viewport" frame. Decoupled from visual treatment.
4. **`shell`** — chrome surface: the file tree component styling, tabs styling, header styling, theme transitions. Visual identity of the dev-server itself.
5. **`components`** — small reusable units consumed by the shell (buttons, badges, comment cards, tweak panel form controls). Bounded by component, not by route.
6. **`utilities`** — single-purpose helper classes (`.u-truncate`, `.u-sr-only`, etc.). Top of the cascade so a utility class beats any same-specificity component rule when you opt into it.

Unlayered rules (rules outside any `@layer`) cascade *above* all layered rules. We avoid unlayered rules entirely; every declaration belongs to a named layer. A lint pass in CI catches stray unlayered rules.

## File structure

```
plugins/design/dev-server/client/styles/
├── 0-reset.css         # @layer reset { … }
├── 1-tokens.css        # @layer tokens { @import "../../../../system/project/colors_and_type.css"; :root { … } }
├── 2-layout.css        # @layer layout { … }
├── 3-shell.css         # @layer shell { … }
├── 4-components.css    # @layer components { … }
├── 5-utilities.css     # @layer utilities { … }
└── _index.css          # @layer reset, tokens, layout, shell, components, utilities;
                        # @import "./0-reset.css";
                        # @import "./1-tokens.css";
                        # … etc
```

`_index.css` is the single Lightning CSS entrypoint. The leading `@layer reset, tokens, layout, shell, components, utilities;` declaration establishes the cascade order once and globally; the per-file `@layer X { … }` blocks append to those named layers without affecting order.

### Build pipeline

`build.ts` (Phase 3.4 Task 3) calls Lightning CSS:

```ts
import { bundleAsync } from 'lightningcss';
const { code } = await bundleAsync({
  filename: 'client/styles/_index.css',
  minify: env === 'release',
  sourceMap: env === 'dev',
  targets: { chrome: 110, safari: 16, firefox: 110 },
  drafts: { customMedia: true },
});
await Bun.write('dist/styles.css', code);
```

Lightning CSS's `bundleAsync` resolves `@import` chains, flattens identically-named layers (so `@layer components { … }` in `4-components.css` and a future `@layer components { … }` inside a component file both merge cleanly), and emits OKLCH-with-sRGB-fallback pairs.

## Token import contract

`1-tokens.css` imports `.design/system/project/colors_and_type.css` via a relative path:

```css
@layer tokens {
  @import "../../../../system/project/colors_and_type.css";

  :root {
    /* Phase 3.5 lands shell-scoped --u-* aliases here, deriving from DS tokens */
  }
}
```

This binds the dev-server bundle to the DS file path. The contract:

- The DS file path **may change** as part of a DS migration. When it does, `1-tokens.css`'s `@import` updates in the same commit, and a DDR-equivalent note lands in the migration plan.
- The DS file's **token shape** (which `--*` variables it defines) is the DS's contract, not the dev-server's. The dev-server reads them; it doesn't define them.
- If the DS file is missing at build time, Lightning CSS fails the build with a clear error. There is no fallback bundled — missing tokens are an upstream bug, not a graceful-degradation case.

## Rejected alternatives — rationale

**Option A (annotated flat file)** rejected because comments don't enforce cascade. Two months after writing them, new rules still cascade by source order and the comments lie. Layers enforce.

**Option B (CSS Modules)** rejected because the shell isn't large enough to amortize the boilerplate, and the token-aliasing question is unresolved (CSS Modules don't help). The structural problem isn't scope leakage; it's cascade implicitness.

**Option C (Tailwind)** rejected because it doubles the styling system without resolving the token-source-of-truth question, and the JIT runtime is a footprint cost we don't need to pay on the shell.

## Consequences

**Positive:**

- Cascade is explicit. New rules pick a layer; the layer settles precedence.
- Token boundary is enforced — only `tokens` layer defines `--*` vars; everything else consumes.
- OKLCH-with-fallback ships automatically. Older Safari / Firefox-ESR get correct colors.
- Minified single-file `dist/styles.css`. No CDN, no comments shipped.
- Phase 3.5 has a clear place to land `--u-*` aliases (`tokens` layer, alongside the imported DS tokens).
- Phase 6/8/12 component-scoped rules land in `components` layer without specificity wars.
- Build time stays sub-100 ms (Lightning CSS is Rust-native).

**Negative / trade-offs:**

- The build step is required to develop on the shell. Mitigation: `bun --watch run build.ts` provides sub-second rebuild; Phase 3.4 Task 9's HMR (CSS-only path lands first) keeps the page from reloading.
- The DS file path coupling is real — moving the DS source means an `@import` rewrite. Mitigation: a single relative `@import` in `1-tokens.css` is grep-findable.
- Six small files instead of one means six file headers. Mitigation: each layer's purpose is documented in `_index.css`'s comment block; new contributors read that once.
- Unlayered rules cascade above named layers — a stray unlayered rule could quietly win. Mitigation: CI lint pass + reviewer discipline; every declaration belongs to a layer.

## Behavioral rules (for CLAUDE.md follow-up)

This DDR encodes three rules for future shell CSS:

1. **Every declaration lives in a named layer.** No bare top-level rules. If a rule doesn't fit any existing layer, the layer order is wrong — re-examine, don't bypass.
2. **`tokens` is the only layer that defines `--*` variables.** Other layers consume `var(--…)` references; they never declare new ones. Adding a new token = adding to `1-tokens.css` (or to the DS source it imports).
3. **OKLCH is the authoring format.** sRGB fallbacks are emitted by Lightning CSS, never hand-authored. If you find yourself writing `rgb(...)` next to `oklch(...)`, you're working around the build step — fix the build configuration instead.

## Revisit when

- **Lightning CSS upstream regresses or a `@layer` browser bug surfaces.** Pin LCSS version + capture the build log; fall back to no-fallback emission if needed (older-browser users see broken colors temporarily).
- **The DS token file path or shape changes in a non-backward-compatible way.** Update the `@import` + bump a DDR if the contract changes substantively.
- **The cascade hits a real limit on a phase that wants per-component cascade isolation.** That's the signal to look at CSS Modules or Shadow DOM scoping for that subsystem — not to abandon `@layer`.
- **Phase 3.5's `--u-*` aliases collide with DS-owned `--*` vars.** That's a naming-contract problem; resolve in 3.5's plan, not by changing the layer architecture.

## Linked

- **Plan:** [`.ai/plans/phase-3.4-architecture-refactor.md`](../plans/phase-3.4-architecture-refactor.md) — Task 6 (CSS rewrite)
- **Phase 3.5:** [`.ai/plans/phase-3.5-dev-server-ui-ux-refresh.md`](../plans/phase-3.5-dev-server-ui-ux-refresh.md) — lands `--u-*` aliases in the `tokens` layer
- **DDR-009:** [Bun runtime authoritative](./DDR-009-bun-runtime-authoritative-for-dev-server.md) — provides the build pipeline this depends on
- **Code:** `plugins/design/dev-server/client/styles/{0-reset,1-tokens,2-layout,3-shell,4-components,5-utilities,_index}.css` (Phase 3.4 Task 6 creates)
