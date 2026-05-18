# DDR-019: Canvas format — `.tsx` files transpiled by Bun, with auto-injected `data-cd-id` and shared `_shell.html`

- **Date:** 2026-05-18
- **Status:** Accepted
- **Tags:** design, dev-server, canvas, tsx, oxc, magic-string, bun-transpiler, data-cd-id, handoff, shadcn, phase-3.6
- **Related:** [DDR-007](./DDR-007-stable-element-id-schema-data-dc-attrs.md) (author-emitted `data-dc-element`), [DDR-009](./DDR-009-bun-runtime-authoritative-for-dev-server.md), [DDR-012](./DDR-012-react-19-unified-runtime.md), [DDR-013](./DDR-013-server-modular-split-typescript.md), [DDR-016](./DDR-016-runtime-folder-purpose.md), [`.ai/plans/phase-3.6-canvas-tsx-format.md`](../plans/phase-3.6-canvas-tsx-format.md), [`.ai/plans/phase-10-structured-crdt-html-coediting.md`](../plans/phase-10-structured-crdt-html-coediting.md), [`.ai/plans/phase-12-in-canvas-css-and-layers.md`](../plans/phase-12-in-canvas-css-and-layers.md)
- **Note:** The Phase 3.6 plan refers to this decision as "DDR-017". DDR-017 + DDR-018 were claimed by Phase 3.5 (`dev-server-shell-menubar-single-canvas`, `tree-groups-via-kind-discriminator`) before this phase started; this DDR takes the next free number. References in the plan body are to be read as "this DDR".

## Context

Canvas authoring pre-Phase-3.6 is a single `.html` file per canvas — typically ~70 KB / ~1800 LOC for a 4-artboard surface — composed of:

- inline `<style>` block (~50 KB of hand-rolled CSS scoped under the artboard root)
- React 18 UMD `<script>`s loaded from a CDN
- `<script type="text/babel">` block containing JSX that `@babel/standalone` transpiles in-browser at every page load
- one inspector-targetable handle: the runtime-emitted `data-dc-slot=` (artboard) plus, where the author bothers, `data-dc-element=` per [DDR-007](./DDR-007-stable-element-id-schema-data-dc-attrs.md)

The shape produces six concrete pains:

1. **Babel-in-browser is slow and heavy.** ~1.5–2 s cold parse for a typical canvas; ~40–60 MB heap that the AST tooling never releases. Visible across every canvas switch.
2. **`/design:edit` reads + rewrites the whole file.** A one-class change on a hero badge still costs the full 70 KB read and a full-file Write — there is no AST tool that can parse JSX inside an HTML `<script type="text/babel">` string safely.
3. **Element identity is runtime DOM, not source.** Inspector overlay computes a CSS selector path on Cmd+Click; the path invalidates the moment a sibling is inserted above the selected node. DDR-007's `data-dc-element` covers *author-named* regions only — most inner elements never get a handle.
4. **Handoff to production is "manually rewrite".** `.design/config.json.handoffTargets: []` reflects this — there's no transformer from Babel-React-HTML to Vite/Next.js + npm React.
5. **No npm specifiers.** `motion/react`, `lucide-react`, shadcn primitives all require a bundler. Canvases are limited to what you can hand-write or load via UMD.
6. **Cold-read cost compounds across iterations.** Every `/design:edit` round-trip ships ~70 KB into context; over 8–10 iterations the conversation balloons.

Phase 3.4 (Bun-runtime dev-server) and Phase 3.5 (shell UI refresh) are landed. We now have `Bun.serve`, `Bun.Transpiler`, `Bun.hash`, and per-platform binary distribution. The cost of moving canvases to a real bundler pipeline is finally low.

This DDR records the format change. It does **not** record the inspector-edit pipeline, the codemod, or the handoff sidecar — those are downstream tasks in the same plan and stand or fall together as one architectural commitment.

## Decision

**One canvas = one `.tsx` file** (default-exporting a React 19 functional component), mounted into a shared `<designRoot>/_shell.html` harness. The dev-server transpiles TSX on GET; the dev-server injects a per-element identity attribute; the dev-server writes a sidecar map from attribute → source location. Concretely:

### Format

- Canvas file: `<designRoot>/ui/<Title>.tsx`. Default export = `function <PascalCaseTitle>() { return <DCArtboard>…</DCArtboard>; }`. No `<!doctype>`, no inline `<style>`, no UMD `<script>` tags — those concerns move to `_shell.html` (shared) and `_components.css` / `colors_and_type.css` (DS).
- Sidecar: `<Title>.meta.json` (existing, with new `css_mode` field — see "CSS mode" below).
- Runtime: React 19 everywhere, per [DDR-012](./DDR-012-react-19-unified-runtime.md). One `jsxImportSource: "react"` config; one shared runtime bundle served at `/_canvas-runtime/react.bundle.js`.

### Two-pass transform

`GET /ui/<slug>` runs:

1. **Pass 1 — ID injection.** Parse the source with `oxc-parser` (TSX loader). Walk the AST in pre-order; on every `JSXElement`'s `openingElement` insert ` data-cd-id="<id>"` via `magic-string.appendLeft(openingElement.name.end, …)`. `id = base32(Bun.hash(componentName + ":" + preOrderIndex)).slice(0, 8)`. Emit `_locator.json` mapping `id → { canvas, line, col, jsxPath, componentName }` alongside the transformed source.
2. **Pass 2 — JSX→JS.** Hand the post-pass-1 source to `Bun.Transpiler({ loader: "tsx", jsxImportSource: "react" }).transformSync(...)`. Result is `text/javascript`; ETag = `Bun.hash(post-pass-1 source).toString(16)`; in-memory cached per `(canvasPath, mtime)`.

The two-pass shape — parse-and-inject *before* lowering — is the design choice that makes element identity a **build-time invariant**. The JS that lands in the browser already carries the IDs; the inspector reads `event.target.closest('[data-cd-id]').dataset.cdId`; no runtime trick needed.

### Coexistence with DDR-007

`data-cd-id` (this DDR) and `data-dc-element` / `data-dc-screen` (DDR-007) solve **different** problems and coexist:

| Attribute | Scope | Generator | Purpose |
| --- | --- | --- | --- |
| `data-dc-screen` (DDR-007) | Artboard root only | `DCArtboard` runtime | Stable artboard handle. CLI affordance: `screenshot.sh --screen <id>`. Authored kebab IDs, persisted across format flips. |
| `data-dc-element` (DDR-007) | Named regions (heroes, CTAs, list rows) — author-emitted | Author intent during `frontend-design` scaffold (envelope directive 15) | Stable comment / inspector / screenshot handle for **semantically named** regions. Kebab IDs, human-readable. |
| `data-cd-id` (this DDR) | **Every** `JSXElement` | `canvas-pipeline.ts` (transpile-time) | Universal AST-anchored handle for `/design:edit` element-scoped edits + Phase-12 inspector. Opaque 8-char IDs, dense, not author-typed. |

The inspector preference order becomes:

1. `[data-dc-element="<id>"]` — author intent first (sparsest, most semantic)
2. `[data-dc-screen="<id>"]` — artboard handle
3. `[data-cd-id="<id>"]` — universal fallback (dense; survives Cmd+Click anywhere)
4. `#id` / classes / `:nth-child` — legacy fallback for pre-Phase-3.6 canvases

`data-cd-id` does **not** replace `data-dc-element`. Authors who want a semantic, hand-typed handle on a hero or CTA still emit `data-dc-element="hero-cta"`. The transpiler adds `data-cd-id="<hash>"` independently. Both attributes ride together on the same DOM node.

### Identity stability — design constraint, not a bug

`data-cd-id` is computed from `(componentName, preOrderIndex)`. **Inserting a sibling above a selected element renumbers every following element's `id`.** This is the explicit design choice — the ID is an *AST position fingerprint*, not a stable element identity. Two consequences:

- Phase-12 inspector resolves selections via `(componentName, jsxPath)` fallback when the cached ID is stale (the locator map carries `jsxPath`; even after renumber, the same `(componentName, jsxPath)` resolves to the new ID).
- Phase-10 Yjs CRDT binding adds the awareness layer that survives content-level conflicts. This DDR ships the *foundation*, not the recovery layer.

The intent is documented; the trade-off is recorded; the recovery work is gated to later phases. For an author-stable handle, use DDR-007's `data-dc-element`.

### CSS mode — per-canvas, defaults to bespoke

`.meta.json` gains `css_mode: "inline" | "tailwind" | "modules"`. MDCC-DSN/01 (industrial-catalogue with bespoke `.btn / .tile / .sku / .seg` classes) defaults to `"inline"` — the bespoke layer carries role semantics that don't survive translation to Tailwind utilities. Tailwind is reserved for future DSs that explicitly opt in (compiled via `bun-plugin-tailwind`). Modules are reserved for canvases that legitimately need a `.module.css` sidecar.

**No mass migration of `.btn` → utilities.** The codemod (Task 8) writes `css_mode: "inline"` for every migrated canvas.

### Handoff format

`/design:handoff` emits a `<Slug>.registry.json` sidecar conforming to [shadcn's `registry-item.json` schema](https://ui.shadcn.com/schema/registry-item.json). Consumer runs `bunx shadcn add file://./<Slug>.registry.json` — framework-agnostic (Next.js, Vite, Astro, Remix all consume the schema). Dependencies resolved via `Bun.Transpiler.scanImports()`; `data-cd-id` attributes stripped from `files[0].content` (dev-time scaffolding, not production code); used CSS rules bundled into `files[]` via className-occurrence scan (Task 12).

### Tooling

One toolchain, three call sites:

- `canvas-pipeline.ts` — the transpile (this DDR)
- `canvas-edit.ts` — AST-aware in-place element edits for `/design:edit` (later task)
- `scripts/migrate-canvases.ts` — one-shot HTML → TSX codemod (later task)

All three use `oxc-parser` (parse) + `magic-string` (byte-range insert/overwrite). One mental model.

## Alternatives considered

### A — Keep the HTML format, replace Babel with esbuild-standalone

Drop `@babel/standalone` UMD, ship a tiny esbuild bundle that transpiles the embedded JSX faster. Bypasses Bun entirely.

- **Pros:** Smallest diff. Existing canvases unchanged.
- **Cons:** Doesn't solve identity (still runtime DOM selectors), doesn't unlock npm specifiers, doesn't enable AST-aware `/design:edit`, doesn't unblock handoff. Half-measure that buys nothing structural.

### B — Multi-file canvas (`<Slug>/index.tsx` + `<Slug>/styles.module.css` + `<Slug>/meta.json`)

Per-canvas directory with separated concerns.

- **Pros:** "Production-like" file layout.
- **Cons:** Every canvas becomes a directory; `_history/` snapshot ergonomics worsen (every rollback is a multi-file diff); `/design:new` complexity doubles; tree UI in the shell needs a "canvas-directory" affordance separate from the "canvas-file" affordance. Two formats running side-by-side during migration. Not worth the structure tax for the v1 surface.

### C — Tailwind-everywhere

Migrate all bespoke CSS to Tailwind utilities; canvases use only utility classes.

- **Pros:** Best AI codegen target (Tailwind dominates training data); zero "what does `.sku` mean" cold-read for new contributors.
- **Cons:** Erases MDCC-DSN/01's bespoke semantic layer (`.sku` framing, `.tile` mood-board grid, `.seg` hairline segmented controls). The DS *is* that layer — translating to atomic utilities removes the very thing the DS contributes. Memory `feedback-design-token-discipline` + `feedback-design-pattern-lift-first` block this.

### D — Source-anchored identity via React Fiber introspection

Skip `data-cd-id` injection; let the inspector read `__reactFiber$…` keys from the DOM node and walk to the source location.

- **Pros:** No DOM pollution; no two-pass transform.
- **Cons:** Brittle (React-internal API; renames between versions); doesn't work for `/design:edit`'s server-side bash helpers (they don't have a React runtime to introspect); requires inspector code that imports React internals, which `_shell.html` doesn't currently load. The whole point of the two-pass transform is to make element identity *not depend on the runtime*.

### E — Babel + JSX-source plugin (`@babel/plugin-transform-react-jsx-source`)

Use Babel's built-in `__source` prop to map JSX to source locations. Established prior art.

- **Pros:** Mature; LocatorJS / react-dev-inspector use this.
- **Cons:** Per-element prop bloat (`__source={{ fileName, lineNumber, columnNumber }}`); ships filename + line into the browser bundle (privacy / repo-path leakage); identity is `(file, line, col)` which invalidates on whitespace re-indentation as well as sibling insertion. The hash-of-(componentName, idx) chosen here is stable across whitespace edits.

## Consequences

**Positive:**

- `/design:edit` reads ~28 KB instead of 70 KB for a typical canvas (per the perf budget in the plan). Element-scoped edits cost a `magic-string.overwrite()` at one byte range, not a full-file rewrite.
- Phase 12 (in-canvas CSS editor + layers panel) has a build-time invariant to read instead of a runtime guess. `_locator.json` is the contract.
- Phase 10 (Yjs CRDT) has a stable-enough range-based edit primitive to build awareness on top of.
- Cold canvas load drops from ~1.5–2 s (Babel-standalone parse) to < 250 ms (Bun.Transpiler + cached output).
- `/design:handoff` becomes a real feature for the first time. shadcn registry adoption means Next.js / Vite / Remix / Astro consumers all share one consumer command.
- npm specifiers (`motion/react`, `lucide-react`, shadcn primitives) work in canvases. Closes the "static feel" gap critics keep flagging.

**Negative / trade-offs:**

- Hard-block on Phase 3.4 + 3.5 — this DDR's whole pipeline depends on `Bun.Transpiler` + `Bun.serve` routes. Both landed before this DDR was written, so the constraint is satisfied; recorded for future maintainers.
- Sibling-insert renumbers `data-cd-id` — documented above. Phase-12 inspector must resolve via `(componentName, jsxPath)` fallback when the cached ID misses.
- Codemod risk — the one-shot HTML → TSX rewrite ships in Task 8 of the same plan. Per-canvas dry-run + opt-out flag + `_history/_migration-…/` backup directory mitigate.
- Two attribute schemes coexist (`data-dc-element` + `data-cd-id`) — explained in "Coexistence with DDR-007" above. Authors should keep using `data-dc-element` for semantic handles; the transpiler adds `data-cd-id` for universal coverage. Both serve different downstream tools.
- `oxc-parser` + `magic-string` add ~3–4 MB to the dev-server's `node_modules`. Acceptable — neither is shipped to end users via the standalone binary (Bun bundles only what's imported by `server.ts`). Both are mature; oxc-parser is the parser used by oxlint / oxc.

**Closed risks (worth recording):**

- ~~Preact-for-canvases handoff mismatch~~ — closed by [DDR-012](./DDR-012-react-19-unified-runtime.md). React 19 universal.
- ~~Motion-library runtime gap~~ — closed by the same. Motion runs natively under React 19.

## Compatibility notes

- **Existing canvases** (`.design/ui/*.html`, `.design/system/project/preview/*.html`) migrate via the codemod (Task 8). System specimens (color ladders, type scales — under `system/<ds>/preview/`) do **not** migrate; they're DS reference material, not canvases. The codemod's path filter excludes them.
- **`.design/config.json.handoffTargets`** gains `[{ label: "shadcn registry", path: "registry:item", platform: "web" }]`. Existing empty default stays valid for projects that haven't opted in.
- **`canvas-meta.schema.json`** extends with `css_mode` (default `"inline"`) and `data-cd-id-version` (current `1`, reserved for future ID-scheme migrations). Existing meta files without these fields stay valid; readers fill defaults.
- **`_active.json.selected`** schema migrates to `{ id, canvas, v: 2 }` from the v1 selector path. Readers in `/design:edit` accept both during a 1-release grace window.
- **Pre-Phase-3.6 canvases** under the same `.design/` (during partial migration) still serve via the existing inject-HTML fall-through in `http.ts`. The TSX route only fires for `*.tsx` slugs.

## Research source

Plan body (`.ai/plans/phase-3.6-canvas-tsx-format.md`) cites three rounds of WebFetch research run 2026-05-15 — generic AI-canvas formats, Bun-native constraints, Phase-12 layers/inspector + AST modify tooling. The plan text is the canonical archive of those findings (no separate `_history/_system/canvas-format-research-…/` directory was created at plan-write time); references to the underlying docs are linked from the plan's "Documentation (external)" section.
