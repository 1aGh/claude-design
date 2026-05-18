# Phase 3.6: Canvas format — `.tsx` over single-file HTML (`data-cd-id` ready)

> **Position in the roadmap.** Sits between Phase 3.4 (Bun-runtime dev-server refactor) and Phase 4 (Pixi canvas v2 rendering engine). Depends hard on 3.4 — without `Bun.Transpiler` + `Bun.serve` routes the proposed pipeline doesn't exist. Unblocks Phase 12 (in-canvas CSS editor + layers panel) by making source-↔-DOM identity a build-time invariant rather than a runtime guess. Lays foundations Phase 10 (Yjs structured CRDT) was previously expected to invent.
>
> **Source of architectural research:** three rounds of WebFetch deep research run 2026-05-15 — round 1 (generic AI-canvas formats), round 2 (Bun-native constraints), round 3 (phase-12 layers/inspector + AST modify tooling). Full reports archived in `_history/` per task 0.

## Description

Replace the current canvas format — single-file HTML with inline `<style>` (~50 KB hand-rolled CSS) + `<script type="text/babel">` JSX + React 18 UMD + Babel-standalone UMD, reference canvas weighing **74 KB / 1838 LOC** — with **`.tsx` files** transpiled server-side by Bun and mounted into a shared `_shell.html` harness. Concretely:

- One canvas = one `.tsx` file (default-export **React 19** component — single runtime, see "Runtime choice" decision). No per-canvas HTML, no per-canvas `<style>` block. Existing `_tokens.css` + `_components.css` stay as-is — they're the DS, not boilerplate.
- Dev-server transpiles TSX on GET via `Bun.Transpiler({ loader: "tsx", jsxImportSource: "react" })`, ETag'd from `Bun.hash(source)`, in-memory cached.
- A two-pass transform injects a stable `data-cd-id` attribute on every JSX element + writes a sidecar `_locator.json` that maps each ID to `(canvas, line, col, jsxPath, componentName)`. `oxc-parser` produces the AST in ~1–3 ms per 80 KB; `magic-string` does the byte-range inserts. This makes element identity a build-time invariant — phase-12 inspector reads the map, doesn't introspect React internals.
- HMR uses Bun 1.3's `import.meta.hot` (Vite-compatible) plus React Fast Refresh, served over `/_bun_hmr`. The dev-server's own inspector WebSocket carries selection / inspector-edit events on its existing channel.
- A Bun macro pre-wraps each canvas in a `<DCArtboard>`/`<DesignCanvas>` envelope before transpile, so authored TSX stays free of boilerplate (mirrors current `/design:new` envelope).
- `/design:handoff` emits a `<Slug>.registry.json` sidecar per shadcn's `registry-item.json` schema (resolved `dependencies` + `registryDependencies` + the canvas TSX as `files[0].content`). Production target runs `bunx shadcn add file://./<Slug>.registry.json`.
- Tailwind stays **opt-in per DS** (added in `<Slug>.meta.json.css_mode: "tailwind" | "modules" | "inline"`). MDCC-DSN/01 (industrial-catalogue, bespoke `.btn / .tile / .sku / .seg`) keeps `css_mode: "inline"` — Tailwind compiled by `bun-plugin-tailwind` is the path for any future DS that opts in. **No mass migration of bespoke CSS to utilities.**
- Existing canvases (`Docs Site.html`, `Canvas Viewport.html`, every `system/project/preview/*.html`) migrated via a one-shot codemod task — keyword-driven HTML-to-TSX rewrite using the same oxc + magic-string toolchain.
- **AI-handoff polish baked in from day one** (Task 12): every canvas gets a generated JSDoc header block (DS, opt-out scope, artboards, brief, history pointer — projected from `.meta.json`); `/design:handoff` *strips* `data-cd-id` from the registry-item's `content` field (it's dev-time scaffolding, not production code); `/design:handoff` also *bundles the actually-used subset of `_components.css` and `colors_and_type.css`* into the registry-item's `files[]` array via className-occurrence AST scan, so a target Next.js project that runs `bunx shadcn add` gets a self-contained drop, not a "copy these CSS files manually" footnote. **Cold-read by a future Claude session is a first-class requirement, not an afterthought.**

**Out of scope:**
- The actual phase-12 layers panel + inspector UI — this phase only ships the *format* + the `_locator.json` contract that phase-12 reads. No UI work.
- Phase-10 Yjs CRDT integration — this phase delivers range-based edits (a precondition) but does not wire Yjs.
- Motion library packaging — works natively under React 19 (single runtime, per DDR-012). No escape hatch, no per-canvas opt-in.
- `/design:critic` script changes — critics already read screenshots, not source code; format-change is transparent to them.

## User Story

As Claude editing `.design/ui/Docs Site.html` for the third time in a session, I want the canvas to be a clean `.tsx` file with stable per-element IDs and no Babel-in-string escaping, so that my `/design:edit "swap the hero copy"` invocation reads ~28 KB instead of 74 KB, edits land via a single AST-aware `magic-string.overwrite()` instead of a full-file rewrite, and the user's inspector selection stays anchored across the edit.

## Problem

| Symptom | Current cause | Impact |
| --- | --- | --- |
| Canvas file weighs 74 KB / 1838 LOC for a 4-artboard surface | Inline `<style>` (50 KB) + Babel-standalone (110 KB CDN parsed in-browser per page load) + React 18 UMD globals + JSX-in-`<script type="text/babel">` string | Every `/design:edit` reads ~74 KB. Even a trivial copy edit triggers ~300–500 k token round-trip if context includes screenshot + `_history` siblings. |
| Babel transpiles JSX in-browser per page load (~1.5–2 s cold) | `<script src="https://unpkg.com/@babel/standalone/babel.min.js">` + `<script type="text/babel">` | Slow cold-start, ~40–60 MB extra heap for the Babel AST that's never freed. Lab traces show Babel idle-RSS retained across canvas switches. |
| Element identity is **runtime DOM**, not **source** | Inspector overlay reads `event.target` to compute a CSS selector path, then sends `{path}` over WS. CSS-selector paths break on any sibling insert. | Phase-12 inspector "I selected this card, change its padding" doesn't survive a Claude edit that inserts an unrelated sibling above. Selection-jumps every iteration. Reported repeatedly during meta-design of `Canvas Viewport.html`. |
| No way to express "modify only this element's className" — every edit is a full-file rewrite | JSX lives inside a `<script type="text/babel">` string with HTML-escaped quotes; no AST tool can safely parse it. Claude has to read the whole file, regenerate the whole file. | High token cost on tiny edits; high regression rate (Claude reformats unrelated parts of the canvas in passing); `_history/` snapshots balloon. |
| Handoff to production code is "manually rewrite" | Canvas is HTML+Babel-React, target is Vite/Next.js + npm React. No transformer. `handoffTargets: []` in `.design/config.json` reflects this. | `/design:handoff` is shipped-but-disabled. The marketing copy ("kvalitní vstup pro production-ready handoff") is aspirational. |
| Motion limited to CSS transitions only | No way to load `motion/react` without a bundler; Babel-standalone doesn't resolve npm specifiers. | Canvases lack the motion vocabulary production apps use. Aesthetic critics flag "static feel" repeatedly (see `_history/_system/` critic reports). |
| `/design:edit` cost regresses with canvas size linearly | Every edit reads + writes the whole file. | Large canvases (10+ artboards) hit context budget ceilings. User-reported "too expensive to iterate at this size." |

## Solution

Four-piece refactor. Each piece is one task block below.

**A. Canvas format = `.tsx` + shared `_shell.html` + injected `data-cd-id`.** New canvas authoring shape (`/design:new` and `/design:edit` both honor it). Shared boot HTML lives once at `<designRoot>/_shell.html`, never per-canvas. Canvas `.tsx` is a default-export **React 19 FC** (single runtime — see "Runtime choice" decision). The Bun dev-server's TSX route runs a **two-pass transform**: (1) `oxc-parser` parse + `magic-string` byte-range insert of `data-cd-id="<8-char-base32>"` on every JSX element where `id = base32(blake3(componentName + ":" + preOrderIndex)).slice(0, 8)`; (2) `Bun.Transpiler.transformSync()` for JSX→JS lowering with `jsxImportSource: "react"`. Output is `text/javascript`, ETag'd from `Bun.hash(post-pass-1 source)`, in-memory cached per `(canvasPath, mtime)`. The same pass emits `_locator.json` (one entry per ID) atomically with the transpile result.

**B. Inspector contract upgrade.** Inspector overlay (already injected into iframe by `inspect.ts` per Phase 3.4) reads `element.dataset.cdId` instead of computing a CSS selector. Selection events sent over the WS carry `{ id, canvas }` only; the dev-server resolves to source location via `_locator.json` lookup. `_active.json.selected` schema migrates from `{ selector, path }` to `{ id, canvas }` — version-stamped (`v: 2`) with backwards-compat read for v1 selectors during the grace period.

**C. Handoff via `<Slug>.registry.json` sidecar.** `/design:handoff` generates a sidecar conforming to [shadcn registry-item.json schema](https://ui.shadcn.com/schema/registry-item.json) — `name = slug`, `type = "registry:block"`, `files[0] = { path: "components/<slug>.tsx", content: <tsx source>, type: "registry:component" }`, `dependencies = ["react", "react-dom", "lucide-react", ...]` resolved from canvas's actual imports, `registryDependencies` from canvas's `@/components/ui/*` imports. Target project consumes via `bunx shadcn add file://./<Slug>.registry.json`. `.design/config.json.handoffTargets` no longer empty — registry path is the universal target. Zero runtime-translation needed: the canvas was authored under React 19, target project runs React 19.

**D. One-shot HTML → TSX codemod.** Migrate every existing canvas (`ui/Docs Site.html`, `ui/Canvas Viewport.html`, every `system/project/preview/*.html`) in one pass. Codemod extracts the `<script type="text/babel">` body, strips the inline `<style>` block (preserved as `<Slug>.module.css` *only if* `meta.css_mode === "modules"`; the MDCC-DSN/01 default mode is `"inline"`, in which case the inline styles get extracted to the bespoke `_components.css` only when no equivalent class already exists — otherwise dropped), rewrites `React.useState` → `import { useState } from "react"`, drops the React UMD + Babel script tags, writes `<Slug>.tsx` and `<Slug>.meta.json` next to it. Old `.html` moves to `_history/_migration-2026-05-15/`.

## Metadata

- **GitHub Issue**: (none yet — internal architecture phase)
- **Type**: Refactor (high impact — affects every canvas, every `/design:*` command)
- **Complexity**: High
- **App/Package**: `plugins/design` (dev-server, commands, skill)
- **Affected Systems**:
  - dev-server (`plugins/design/dev-server/`) — new TSX route, two-pass transform, `_locator.json` writer
  - design plugin commands (`plugins/design/commands/{new,edit,handoff,rollback,setup-docs,screenshot}.md`) — all reference `.html` paths; all migrate to `.tsx`
  - design plugin skills (`plugins/design/skills/design/SKILL.md`, `plugins/design/skills/design-system/SKILL.md`) — envelope examples, screenshot helper paths
  - `dev-server/bin/screenshot.sh` — already URL-driven, no change needed beyond path arg
  - `dev-server/bin/slug.sh` — unchanged
  - inspector overlay (in `inspect.ts` per Phase 3.4) — selector mechanism replaced by `data-cd-id` lookup
  - every canvas in `.design/` — migrated by codemod (Task 8)
  - `.design/config.json` — new field `handoffTargets[0] = { label: "shadcn registry", path: "registry:item" }`; deprecated `tokensCssRel` stays for backward compat reading; `newCanvasDir` semantics unchanged but extension flips from `.html` → `.tsx`
- **Dependencies**:
  - **Hard-blocks-on Phase 3.4** (Bun-runtime dev-server). This phase ships TSX route handler that uses `Bun.Transpiler` + `Bun.serve` `routes` + Bun.hash + Bun.write. No Node fallback. **Do not start until 3.4 lands `dist/mdcc-<platform>` binaries.**
  - New build-time deps in `plugins/design/dev-server/package.json`: `oxc-parser ^0.30`, `magic-string ^0.30`, `blake3-wasm ^2.1` (or `Bun.hash` with documented seed — see Task 1 decision). All NAPI / pure-JS; all run under Bun.
  - New runtime deps for canvases: `react ^19`, `react-dom ^19` (pre-bundled via `Bun.build` into `/_canvas-runtime/react.bundle.js`, served by the dev-server route; shared with shell per DDR-012 React-19-everywhere). No Preact dep anywhere in the dev-server.
  - Optional per-DS: `bun-plugin-tailwind ^0.1` (only when DS opts into Tailwind utilities — MDCC-DSN/01 does NOT).
- **Blocks**: Phase 12 (in-canvas CSS editor + layers panel — needs `_locator.json` to exist), Phase 10 (Yjs structured CRDT — needs range-based edit pipe to exist).
- **Does NOT block**: Phase 3.5 (shell UI refresh, independent), Phase 4 (Pixi canvas, independent — renders the file tree, not the canvases themselves), Phase 5–9 (build on hardened shell).

## Performance budgets (acceptance gates)

| Metric | Target | Measurement | Notes |
| --- | --- | --- | --- |
| Per-canvas TSX file size (typical 4-artboard) | **< 35 KB** raw, **< 10 KB** gzip | `du -sh` on migrated `Docs Site.tsx` after codemod | vs 74 KB / 18 KB gzip current |
| Two-pass transform cost (parse + ID inject + Bun.Transpiler) | **< 8 ms** p50, < 20 ms p99 | bench harness over 100 GETs against `Docs Site.tsx` | oxc-parser ~1–3 ms for 80 KB; Bun.Transpiler comparable |
| Cold canvas load (server cache cold → first paint) | **< 250 ms** | `performance.timeOrigin` + first-paint marker | vs current ~1.5–2 s (Babel-standalone parse) |
| Warm canvas reload (HMR patch, no full reload) | **< 100 ms** click-to-paint | `import.meta.hot` `bun:afterUpdate` timestamp | New capability — current setup has no HMR, full reload only |
| `/design:edit` token cost on a trivial edit (1 element className change) | **< 30 % of current** | manual measurement: `/design:edit "swap accent color on hero badge"` on `Docs Site.tsx` vs `.html` | ~50 % file-size + AST-aware edit path |
| `_locator.json` size for typical canvas | **< 8 KB** | `du` after first GET | ~150 elements × ~50 bytes/entry |
| Inspector selection survival rate across a Claude edit that inserts a sibling above the selected node | **100 %** | scripted test: select node, run `/design:edit`, verify selection persists | New invariant; current selector-based path is ~0 % |
| Codemod runtime over all existing canvases (~12 files, ~250 KB total HTML) | **< 30 s** end-to-end | `time bun run scripts/migrate-canvases.ts` | One-shot, run once |

If any of these regress in a later phase, the offending change is reverted before merge.

## Context References

### Must-read files

- `plugins/design/commands/new.md` — current `/design:new` flow; envelope discipline; step-by-step lifecycle. Lines 60–280 are the lifecycle; lines 280–410 are the auto-critic loop (unchanged by this phase). **Read first** — the new flow grafts onto the same step structure with the file-extension flip + two-pass transform.
- `plugins/design/commands/edit.md` (248 LOC) — `/design:edit` step list; in-place edit semantics; `_history/<slug>/` snapshot rules. The AST-aware edit path lives here.
- `plugins/design/commands/handoff.md` — currently a stub since `handoffTargets: []`. This phase fills it in.
- `plugins/design/dev-server/server.mjs` (the pre-3.4 version) — current selector-based inspector protocol. **After 3.4 lands**, read `plugins/design/dev-server/inspect.ts` instead (the migrated module).
- `plugins/design/dev-server/canvas-meta.schema.json` — current `.meta.json` schema. Extend with `css_mode`, `data-cd-id-version`. **No `runtime` field** — React 19 is universal per DDR-012.
- `plugins/design/dev-server/config.schema.json` (lines 30–80) — `tokensCssRel`, `rootClass`, `newCanvasDir` defaults. New fields for `handoffTargets` registry path.
- `plugins/design/dev-server/bin/screenshot.sh` — URL-driven, takes the canvas URL. After format flip, server URL = `http://host:port/?canvas=<slug>` not `file://`. No script change.
- `plugins/design/dev-server/bin/slug.sh` — normalize `<active-relative-path>` to kebab slug. Already extension-agnostic.
- `.design/ui/Docs Site.html` (1838 LOC) — reference canvas. Use as the codemod's primary fixture. Migrated output lives at `.design/ui/Docs Site.tsx` per Task 8.
- `.design/ui/Docs Site.meta.json` — current sidecar shape. Migrated shape adds `css_mode: "inline"` for MDCC-DSN/01.
- `.design/system/project/colors_and_type.css` — DS tokens. Unchanged. Loaded by `_shell.html` via `<link rel="stylesheet">`.
- `.design/system/project/preview/_components.css` — DS shared anatomy (`.btn`, `.tile`, `.sku`, `.seg`). Unchanged. Loaded by `_shell.html`.
- `.ai/plans/phase-3.4-architecture-refactor.md` — the foundation this phase rides on. Read sections "Solution" + "Files to Create" + "Research Summary → Bun runtime authority".
- `.ai/plans/phase-12-in-canvas-css-and-layers.md` — what this phase enables. Read "Solution" + "Why deferred" to confirm the contract.
- `.ai/plans/phase-10-structured-crdt-html-coediting.md` — what this phase preconditions. Read "Solution" lines on stable element identity (`data-cd-id`) — this phase ships the *source-anchored* version of that idea, ahead of Y.XmlFragment.

### Files to create

- `plugins/design/dev-server/canvas-pipeline.ts` (new — ~250 LOC) — the two-pass transform. Exports `transpileCanvas(absPath: string): Promise<{ js: string; locator: LocatorMap; etag: string }>`. Internally: read source via `Bun.file(absPath).text()`, parse with `oxc-parser`, visit JSX elements in pre-order, compute IDs via `(componentName, idx) → base32(blake3(...))`, insert `data-cd-id` via `magic-string` byte-range, hand the transformed source to `Bun.Transpiler.transformSync({ loader: "tsx", tsconfig: <inline> })`, return the JS + locator + ETag (`Bun.hash(transformedSource).toString(16)`).
- `plugins/design/dev-server/locator.ts` (new — ~80 LOC) — `LocatorMap` type (`Record<string, { canvas: string; line: number; col: number; jsxPath: string[]; componentName: string }>`) + on-disk writer (`writeLocator(canvas: string, map: LocatorMap)` → atomic write to `<designRoot>/_locator.json` under a per-canvas key).
- `plugins/design/dev-server/canvas-edit.ts` (new — ~150 LOC) — AST-aware edit helpers consumed by `/design:edit` when feedback names a specific element. Exports `editAttribute(canvas: string, id: string, attr: string, value: string): Promise<void>` (className change, inline style insert, style-prop value swap). Uses the same `oxc-parser` + `magic-string` pair as the pipeline.
- `plugins/design/dev-server/handoff.ts` (new — ~100 LOC) — emits `<Slug>.registry.json`. Reads canvas TSX, walks imports via `Bun.Transpiler.scanImports()`, resolves npm deps vs `@/components/ui/*` shadcn deps, writes the file.
- `plugins/design/templates/_shell.html` (new — ~30 LOC) — shared boot harness. Loads `<link rel="stylesheet" href="/tokens.css">` + `<link rel="stylesheet" href="/_components.css">` + Bun's HMR client + a `<script type="module">` that imports `/_canvas-runtime/react.bundle.js` (single React 19 bundle, cached) + `/ui/${slug}.tsx?canvas=${slug}` + mounts via `createRoot(root).render(<Canvas />)`. Used by `/design:new` to write the `_shell.html` into `<designRoot>/` on first canvas creation (one-shot, idempotent).
- `plugins/design/templates/canvas.tsx.template` (new) — `/design:new` scaffold target. Replaces the current `<!doctype html>` HTML scaffold. Contains envelope-driven JSX skeleton + a one-line comment header.
- `scripts/migrate-canvases.ts` (new, repo-root — ~250 LOC) — Task 8 codemod. Reads every `.design/**/*.html`, extracts the JSX from `<script type="text/babel">`, extracts the `<style>` block, writes paired `.tsx` + `.meta.json` + (optionally) `.module.css` files. Old `.html` files move to `_history/_migration-2026-05-15/`. Dry-run mode + per-file diff output.
- `.ai/decisions/DDR-017-canvas-tsx-format.md` — records the decision + the three research rounds + Tailwind-opt-in (not default) choice + motion-Preact escape hatch.

### Documentation (external — opened during research)

- [Bun.Transpiler](https://bun.com/docs/api/transpiler) — `transformSync`, `scan`, `scanImports`, `tsconfig` option, JSX runtime selection.
- [Bun.serve routes + websocket](https://bun.com/docs/api/http) — route handlers, `Bun.file()` static serving, websocket lifecycle.
- [Bun bundler HMR](https://bun.sh/docs/bundler/hmr) — `import.meta.hot`, `bun:beforeUpdate` / `bun:afterUpdate`, `/_bun_hmr` WS endpoint.
- [Bun JSX](https://bun.com/docs/runtime/jsx) — `jsx: "react-jsx"` + `jsxImportSource: "preact"` setup.
- [Preact getting started — Vite/Bun aliasing](https://preactjs.com/guide/v10/getting-started) — `react → preact/compat` paths.
- [oxc-parser](https://www.npmjs.com/package/oxc-parser) + [oxc benchmarks](https://oxc.rs/docs/guide/benchmarks) — sub-millisecond parse for canvas-size TSX.
- [magic-string](https://github.com/Rich-Harris/magic-string) — byte-range edits + sourcemaps, used in production by Rollup/Vite.
- [shadcn registry-item.json schema](https://ui.shadcn.com/schema/registry-item.json) + [shadcn CLI](https://ui.shadcn.com/docs/cli) — handoff format target.
- [LocatorJS](https://www.locatorjs.com/) + [react-dev-inspector compiler plugin](https://react-dev-inspector.zthxxx.me/docs/compiler-plugin) — prior art for `data-*` ID injection at compile time.
- [Lovable Visual Edits](https://lovable.dev/blog/visual-edits) — closest commercial reference for the inspector-edit pattern this phase enables.
- [Motion #1369 — Framer Motion 5 + Preact compat](https://github.com/motiondivision/motion/issues/1369) — open upstream; gates the motion runtime decision.

### Patterns to follow

The two-pass transform is the most novel piece. Reference implementation pattern:

```ts
// plugins/design/dev-server/canvas-pipeline.ts (sketch)
import { parseSync } from 'oxc-parser';
import MagicString from 'magic-string';
import { Transpiler, file, hash } from 'bun';
import { blake3 } from 'blake3-wasm';

const tsx = new Transpiler({
  loader: 'tsx',
  tsconfig: JSON.stringify({
    compilerOptions: { jsx: 'react-jsx', jsxImportSource: 'preact' },
  }),
});

export async function transpileCanvas(absPath: string) {
  const source = await file(absPath).text();
  const ast = parseSync(absPath, source).program;
  const s = new MagicString(source);
  const locator: LocatorMap = {};
  let componentName = '';
  let idx = 0;

  walk(ast, {
    enterFunctionDeclaration(node) { componentName = node.id?.name ?? ''; idx = 0; },
    enterJSXElement(node) {
      const id = base32(blake3(`${componentName}:${idx}`)).slice(0, 8);
      const insertAt = node.openingElement.name.end;
      s.appendLeft(insertAt, ` data-cd-id="${id}"`);
      locator[id] = {
        canvas: absPath,
        line: node.loc.start.line,
        col: node.loc.start.column,
        jsxPath: jsxPathFor(node),         // ["DocsSite", "section", 0, "h1"]
        componentName,
      };
      idx++;
    },
  });

  const withIds = s.toString();
  const js = tsx.transformSync(withIds);
  const etag = hash(withIds).toString(16);
  return { js, locator, etag };
}
```

(Walker shape is illustrative — pick an oxc-compatible visitor library or hand-roll a recursive descent in Task 1.)

The same `oxc-parser` + `magic-string` pair powers AST-aware inspector edits (`canvas-edit.ts`) and the migration codemod (`scripts/migrate-canvases.ts`). One toolchain, three call sites — keeps the cognitive load low.

---

## Design Decisions

### CSS write-back format: **Tailwind className editing default; inline `style={{}}` fallback for arbitrary values; `.module.css` opt-in per canvas**

| Mode | When | Trade-off |
| --- | --- | --- |
| `css_mode: "inline"` (default for MDCC-DSN/01) | Bespoke DS with custom `.btn / .tile / .sku / .seg` classes. Canvas TSX uses `className="btn btn--ghost"` literals. Inspector writes className edits via `magic-string.overwrite(className.value range, newValue)`. Arbitrary single-property values land as `style={{ padding: 14 }}`. | Round-trips cleanly through `/design:edit` natural-language prompts. Mature AST-edit path. Inline-style escape hatch is the universal fallback. |
| `css_mode: "tailwind"` (opt-in per DS) | DS opts into Tailwind utilities. Canvas TSX uses `className="px-4 py-2 bg-bg-0"`. `bun-plugin-tailwind` compiles per save. Inspector writes className edits the same way; arbitrary values land as `p-[14px]`. | Best AI-codegen target (Tailwind dominates training data). Worst hand-readability. Inspector path identical to inline mode. |
| `css_mode: "modules"` (opt-in per canvas) | Canvas declares `<Slug>.module.css` sibling file. TSX imports `import s from "./Hero.module.css"` and writes `className={s.heroSection}`. Inspector writes class-rule edits to the `.module.css` file. | Production-canonical CSS-Modules. Two files per canvas (more friction for `_history/` snapshots). Reserve for canvases that legitimately want a sidecar stylesheet. |

**Rationale** (memory ref `feedback-design-token-discipline` + `feedback-design-pattern-lift-first`): MDCC-DSN/01 invested in bespoke class names that carry role conventions (`.sku` framing semantics, `.tile` mood-board grid). Migrating to Tailwind utilities would erase that semantic layer — Lovable-style atomic CSS doesn't have a `.sku` concept, just `border-1 px-2 text-[10px] uppercase tracking-wider text-amber-600` per occurrence. Plan keeps the bespoke layer as the default; Tailwind is reserved for future DSs that explicitly want it.

### Inline `<style>` extraction policy

Existing canvases have ~50 KB inline `<style>` blocks scoped to the artboard root via `.ab .xyz { ... }`. The codemod (Task 8) treats inline styles like this:

1. **Rule has a 1:1 equivalent class in `_components.css`** → drop. The class already exists; the canvas reused boilerplate.
2. **Rule is canvas-specific (only used in this file)** → preserved as `<Slug>.module.css` sidecar, canvas TSX imports it. `meta.css_mode = "modules"` for this canvas.
3. **Rule is canvas-specific BUT applied to a single element** → inlined as JSX `style={{}}` on that element. No sidecar.

The codemod prints a per-canvas diff so the choice can be reviewed and overridden before the migration commit.

### Runtime choice: **React 19 everywhere — shell + canvases unified (DDR-012)**

> **Pivoted 2026-05-15** through three drafts: (1) "Preact for shell, undecided canvas" → (2) "Preact shell, React 19 canvas with per-canvas opt-in" → (3) **"React 19 everywhere; drop Preact entirely."** Each pivot was driven by evidence:
>
> - The Preact-for-shell win (bundle, idle RAM) is real but the **absolute numbers don't justify the complexity** of running two runtimes side-by-side. Real-world bundle delta after `Bun.build` tree-shake: ~25-35 KB gz extra for React. Idle-RAM delta: ~20-30 MB. Both are comfortable inside the relaxed "tip-top" v1 narrative budgets (see Phase 3.4 budget table — relaxed 2026-05-15).
> - Two runtimes = two `jsxImportSource` configs + two bundle paths + conditional mount API + per-canvas runtime field + per-runtime handoff audit + every future Phase (4 Pixi, 8 collab, 12 in-canvas editor) carrying that complexity. Cognitive load compounds.
> - shadcn / Radix handoff parity, agent training-data alignment, motion library native support, React 19 features (`use()`, `<form action>`, `useActionState`, async transitions) — all the canvas-side arguments — now also apply to **any future shell extraction**. If a shell component ever gets lifted into a canvas or a downstream project, React-throughout means zero translation.
> - Claude Code itself uses React (Ink renders React tree to terminal). Anthropic engineers chose React over Preact for the parent product. We follow.

**All canvases AND the shell run under React 19.** No `meta.runtime` field, no per-canvas runtime switching, no compat shim. `Bun.Transpiler({ loader: "tsx", jsxImportSource: "react" })` — single config. `Bun.build` produces one shared React 19 runtime bundle (`/_canvas-runtime/react.bundle.js`, ~25-35 KB gz post tree-shake) shared by shell + every canvas in the session. Mount via `createRoot(root).render(<Canvas />)`. Handoff dependencies always `["react", "react-dom", ...]`. **DDR-012 records the unification + supersedes Phase 3.4's earlier Preact-shell draft.** The canvas TSX format itself is recorded separately in DDR-017.

### Handoff target: **shadcn registry-item.json sidecar**

| Decision | Rationale |
| --- | --- |
| Use shadcn's `registry-item.json` schema verbatim | Industry-standard. Bolt/v0/Lovable converged here. Target consumer runs `bunx shadcn add file://./<Slug>.registry.json` regardless of framework (Next.js, Vite, Astro, Remix, Bun). |
| One sidecar per canvas, written by `/design:handoff` | Mirrors `<Slug>.meta.json` pattern. Lives next to the TSX in `.design/ui/`. Versioned with the canvas. |
| Resolve dependencies from `Bun.Transpiler.scanImports()` | No manual mapping. npm specifiers → `dependencies`; `@/components/ui/*` specifiers → `registryDependencies`. |
| `.design/config.json.handoffTargets[0] = { label: "shadcn registry", path: "registry:item" }` | Single entry — registry path is universal. Multi-target users can add more entries (e.g. `vite-react`) but the default is registry-only. |

---

## Tasks

Execute in order. Each is atomic + testable.

### Task 0 — ARCHIVE research + ADD DDR-017

- **Do**: Save all three research-round reports verbatim to `_history/_system/canvas-format-research-2026-05-15/{round-1-generic.md, round-2-bun-native.md, round-3-phase-12.md}`. Write `.ai/decisions/DDR-017-canvas-tsx-format.md` per `.ai/decisions/template.md`: context (status quo pain points), decision (TSX + two-pass transform + shadcn registry handoff), alternatives considered (Tailwind-everywhere, v0-mode CDN, multi-file project), consequences (Phase 3.4 hard-block, motion-Preact gap, bespoke CSS preserved).
- **Validate**: DDR opens cleanly + cross-links to this plan.

### Task 1 — CREATE `canvas-pipeline.ts` (two-pass transform)

- **Do**: Implement `transpileCanvas()` per the pattern in "Patterns to follow" above. Pick an oxc-compatible JSX visitor — `oxc-parser` returns an ESTree-compatible AST; either hand-roll a recursive descent walker or pull in `estree-walker`. Decide blake3 source: `blake3-wasm` (NAPI) vs `Bun.hash` with a documented seed scheme. Prefer `blake3-wasm` if the size cost is < 100 KB; otherwise `Bun.hash(seed)` is fine (collision risk for 8-char IDs at canvas scale is < 1 in 2^32; acceptable).
- **Pattern**: Same shape as Phase 3.4 module split — keep `canvas-pipeline.ts` pure (no side effects except return value), tested via `bun:test`. File writes happen in the caller (route handler).
- **Gotcha**: oxc's JSX visitor enters elements during *parse* — make sure you visit on the AST *after* parse, not via a parser-side hook (those don't exist in `oxc-parser`'s public API). Use `parseSync().program` and walk it yourself.
- **Validate**: `bun test plugins/design/dev-server/test/canvas-pipeline.test.ts` — covers (a) ID determinism (same source twice → same locator map), (b) ID stability under whitespace-only edits, (c) ID changes under sibling-insert (acceptable; just verify the contract is documented), (d) Bun.Transpiler output is valid JS (no parse errors).

### Task 2 — CREATE `locator.ts` (LocatorMap writer)

- **Do**: Define `LocatorMap` type. Implement `writeLocator(canvas: string, map: LocatorMap)` that atomically writes/updates `<designRoot>/_locator.json` under the canvas's slug key. Atomic = write to `_locator.json.tmp`, fsync, rename. Reader is `readLocator(canvas: string): LocatorMap | null`.
- **Pattern**: Mirror `_active.json` writer pattern from `inspect.ts` (Phase 3.4). Same serialization style (2-space JSON, sorted keys for deterministic diffs).
- **Gotcha**: Multiple canvases share one `_locator.json`. Reads must lock-or-snapshot; concurrent writers from parallel transpile routes will corrupt. Use a Mutex per `_locator.json` path (Bun's `Promise`-based mutex is fine; no need for OS-level lock).
- **Validate**: `bun test ... locator.test.ts` — roundtrip, atomic-write, concurrent-write safety, slug-key isolation.

### Task 3 — UPDATE `plugins/design/dev-server/server.ts` + `http.ts` with TSX route

- **Do**: Add a `/ui/:slug` route that resolves the canvas TSX path from the slug, calls `transpileCanvas()`, returns `{ status: 200, headers: { 'Content-Type': 'text/javascript', 'ETag': result.etag, 'Cache-Control': 'no-cache' }, body: result.js }`. ETag-aware: if `If-None-Match` matches, return 304. Update `_locator.json` synchronously (write before returning the response). Add `/` route serving `_shell.html` via `Bun.file()`.
- **Pattern**: Same route shape as Phase 3.4's `http.ts` — `Response`-returning async function, no Express-like middleware.
- **Gotcha**: URL-decode the slug carefully (canvases have spaces: `Docs%20Site` → `Docs Site.tsx`). Reject path-traversal: reject slugs containing `..` or starting with `/` or `\\`.
- **Validate**: `bun test ... http.test.ts` — GET `/ui/Docs%20Site` returns 200 with `text/javascript`; second GET with `If-None-Match: <etag>` returns 304; bad slug returns 404; path-traversal attempt returns 400.

### Task 4 — UPDATE inspector overlay to send `data-cd-id` (was: CSS selector)

- **Do**: In `inspect.ts`'s injected inspector script (the part that runs in the iframe), replace the existing selector-computation on Cmd+Click with `event.target.closest('[data-cd-id]')?.dataset.cdId`. WS message shape changes from `{ selector, path }` to `{ id, canvas }`. Server-side `_active.json` writer bumps `selected.v` to 2 and writes the new shape; readers in `/design:edit` step 2.5 (selection scope detection) accept both v1 + v2 during a 1-release grace window.
- **Pattern**: Inspector script lives in `inspect.ts` as a template literal (per Phase 3.4 split). Edit the template literal; tests run the script through a JSDOM-equivalent and assert the WS payload.
- **Gotcha**: Iframe walks the DOM to find `data-cd-id`. Some clicks land on text nodes — use `closest()`, not `event.target` directly. Some clicks land on the `<DCArtboard>` chrome (no `data-cd-id`) — return null, suppress the WS message.
- **Validate**: Manual smoke: open a migrated canvas, Cmd+Click an element, observe `_active.json.selected.id` set + `_active.json.selected.v === 2`.

### Task 5 — UPDATE `/design:edit` to use AST-aware edit path when feedback names an element

- **Do**: In `plugins/design/commands/edit.md`, add Step 3a (after the existing pre-flight): if `_active.json.selected.id` is set AND the feedback mentions a specific element by name/role (heuristic: feedback contains words "this", "the X", or matches a `<Tag>` import from the canvas), prefer calling `canvas-edit.ts.editAttribute()` over a full-file Write. The bash helper is `dev-server/bin/canvas-edit.sh <canvas> <id> <attr> <value>` — wraps the TS module. Falls back to full-file Write when the change is structural (insert / delete elements). Update the step-3 file-modification rule to allow either pathway.
- **Pattern**: `/design:edit` already has scope-detection logic (selection vs full-file). Extend it; don't duplicate.
- **Gotcha**: AST edits don't reformat. If user feedback is "tighten the spacing throughout" that's a full-file edit. Don't try to AST-edit it.
- **Validate**: Manual: `/design:edit "change accent border on the selected hero badge"` after selecting an element. Verify token cost < 30 % of pre-phase baseline + verify edit lands at the right element + verify `_history/` snapshot is a single-element diff.

### Task 6 — CREATE `templates/_shell.html` + `templates/canvas.tsx.template` + UPDATE `/design:new`

- **Do**: Write `_shell.html` per the dataflow diagram in DDR-017. Update `/design:new` step 8 ("Write target file") to write `<Slug>.tsx` (not `.html`) + ensure `<designRoot>/_shell.html` exists (idempotent write on first canvas in a project). Update step 7 ("Validate output") for the new target: `default export` present, `import` statements present, no `<!doctype` (that's `_shell.html`'s job). Update the envelope (step 5b) to generate TSX-shaped output, not HTML.
- **Pattern**: Frontend-design skill already accepts framework hint — pass `target: "tsx-react"` in the envelope. Validate the generated TSX parses via `oxc-parser` before writing (one extra pre-flight check in step 8).
- **Gotcha**: Existing `_active.json.selected.v=1` writes-from-canvas (from before this phase) may be in flight. Step 4 of `/design:new` clears `_active` for the new canvas.
- **Validate**: `/design:new "Test Canvas" "Single hero with CTA — basic smoke test"` writes `.design/ui/Test Canvas.tsx` + `.design/ui/Test Canvas.meta.json` + `.design/_shell.html` (if missing) + opens in browser via screenshot helper.

### Task 7 — CREATE `handoff.ts` + UPDATE `/design:handoff`

- **Do**: Implement `emitRegistryItem(canvas: string): Promise<RegistryItem>` per the [registry-item.json schema](https://ui.shadcn.com/schema/registry-item.json). Walk imports via `Bun.Transpiler.scanImports()`, classify as `dependencies` (npm specifier — `react` + `react-dom` always present; promoted to declared deps) vs `registryDependencies` (`@/components/ui/*` resolves to shadcn primitive name). `files[0] = { path: "components/<slug>.tsx", content: <strippedTsx>, type: "registry:component" }` where `<strippedTsx>` = canvas source with the `data-cd-id` attributes AST-removed (those are dev-time inspector scaffolding; production has no business with them — same `oxc-parser` + `magic-string` pair used to inject them). Populate `description` from `.meta.json.subtitle` (one-line). Wire `/design:handoff` step list to call this + print the resulting `<Slug>.registry.json` path + a copyable `bunx shadcn add file://<path>` command. **CSS bundling is Task 12's job, not this task's** — Task 7 ships the structural skeleton; Task 12 fills in `cssVars` + bundled-CSS `files[]` entries.
- **Pattern**: Schema reference: pull the JSON schema down (Task 0's research artifacts include the URL); validate the emitted file against it before writing.
- **Gotcha**: `cssVars` block stays empty in this task — Task 12 fills it. If you ship the registry-item without Task 12, the consumer still gets the `<slug>.tsx` file cleanly; the bespoke className references will just fail to style until the user copies the CSS manually. That's an acceptable interim state — but Task 12 closes the gap.
- **Validate**: `bunx shadcn add file:///tmp/test-canvas.registry.json` in a scratch Next.js + shadcn project lands the canvas as `components/test-canvas.tsx`, dependencies install cleanly, **no `data-cd-id` attributes survive into the dropped file** (grep the result).

### Task 8 — CREATE `scripts/migrate-canvases.ts` + RUN it once

- **Do**: Implement the codemod per "Inline `<style>` extraction policy" above. Use `oxc-parser` to parse the extracted `<script type="text/babel">` body. Use `magic-string` for any in-place text edits (React.useState → import). Use `cheerio` (or vanilla regex — only one tag matters) to extract the `<style>` block. Emit per-file dry-run diff to stdout. Move source `.html` files to `_history/_migration-2026-05-15/<original-relative-path>` after successful TSX write. Run once on `.design/ui/*.html` + every `.design/system/project/preview/*.html`.
- **Pattern**: Same `oxc-parser` + `magic-string` pair as Tasks 1, 5. One toolchain.
- **Gotcha**: A few preview specimens (`logo.html`, signature moments) embed SVG inline + assume artboard-shell styling that lives in `_layout.css`. Audit those manually after migration — they may need `meta.css_mode = "modules"` or partial inline-style.
- **Validate**: After codemod, open `<designRoot>` in the dev-server. All canvases render. No console errors. `_history/` carries the originals. The reference `Docs Site.tsx` is < 35 KB raw.

### Task 9 — UPDATE `plugins/design/commands/*` + skills for `.tsx` paths

- **Do**: Sweep `plugins/design/commands/*.md` + `plugins/design/skills/*/SKILL.md` for hardcoded `.html` occurrences. Replace with `.tsx` where the reference is to canvas files. Keep `.html` references where they target `_shell.html` (one specific file). Update `dev-server/bin/screenshot.sh` `--screen <id>` / `--element <id>` resolution to look up `data-cd-id` first, fall back to CSS selector (transitional grace window).
- **Pattern**: Use `grep -rn '\.html'` to enumerate; review case-by-case.
- **Gotcha**: `system/<ds>/preview/*.html` specimens (color ladders, type scales — non-canvas previews) STAY as `.html`. They're not canvases — they're DS specimens. Codemod skips them. Only files under canvas dirs migrate.
- **Validate**: `grep -rn '\.html' plugins/design/commands plugins/design/skills` — only the expected `_shell.html` + system-specimen references remain.

### Task 10 — UPDATE `.design/config.json.handoffTargets` + canvas-meta.schema.json

- **Do**: Add `handoffTargets: [{ label: "shadcn registry", path: "registry:item", platform: "web" }]` to `.design/config.json`. Extend `canvas-meta.schema.json` with `css_mode` (enum: `"inline" | "tailwind" | "modules"`), `data-cd-id-version` (integer, current = 1 — for future ID-scheme migrations). **No `runtime` field** — React 19 is universal per DDR-012. Update `config.schema.json` to document the registry-item handoff target.
- **Pattern**: JSON Schema additions — `default` per field, `description` per field. Both schemas live under `plugins/design/dev-server/`.
- **Gotcha**: Existing `.design/ui/*.meta.json` files (post-Task 8 migration) need `css_mode: "inline"` retro-injected. Migration script (Task 8) writes it.
- **Validate**: `bun run mdcc config get handoffTargets` returns the registry target. AJV-validate a sample meta.json against the new schema.

### Task 11 — ADD bun:test smoke tests + RUN `/design:edit` regression

- **Do**: Add `bun:test` cases covering: (a) `canvas-pipeline.transpileCanvas()` over the migrated `Docs Site.tsx`, asserting locator map cardinality matches the pre-codemod canvas's element count (within tolerance), (b) `canvas-edit.editAttribute()` round-trip on a className change, (c) `handoff.emitRegistryItem()` validation against the schema, (d) `_shell.html` renders empty without canvases. Then run an end-to-end manual: `/design:edit "shorten the hero copy on the marketing landing"` on the migrated `Docs Site.tsx`. Capture before/after token cost + screenshot diff.
- **Pattern**: Tests live under `plugins/design/dev-server/test/`. Manual regression captured in `.ai/state/HANDOFF.md` for the next session.
- **Gotcha**: First HMR after edit may show a flash — verify it's < 100 ms per the budget; if not, route fix into a separate ticket (do not regress this plan's gate on it).
- **Validate**: All tests green. Manual regression shows token cost < 30 % of pre-phase baseline (the "30 KB / 1 element edit" budget).

### Task 12 — ADD AI-handoff polish (canvas header generator + CSS bundling in registry-item)

> **Why this task exists.** Plan author (Claude) cold-read the post-3.6 canvas format end-to-end and flagged three gaps that would make a future Claude session pay unnecessary tokens to understand what a `.tsx` canvas is and how to use it. Cold-read by a future Claude is one of this phase's headline goals — it deserves a dedicated task, not "we'll do it later." The three gaps + their fixes follow.

**12a — Canvas JSDoc header generator** (~80 LOC in `plugins/design/dev-server/canvas-header.ts`):

- **Do**: When `/design:new` or `/design:edit` writes a canvas, regenerate a JSDoc block at the top of the `.tsx` file from `.meta.json`. Shape:

  ```tsx
  /**
   * @canvas      Docs Site — marketplace landing + standalone docs
   * @ds          project (MDCC-DSN/01 — industrial-catalogue · Berkeley mono · 1px hairlines)
   * @platform    desktop
   * @opt_out     palette
   * @artboards   landing | docs-index | docs-article | cmd-k
   * @brief       udelej navrh docs site — fumadocs re-skin + landing
   * @stack       React 19 · TSX · Bun-transpile · css_mode=inline
   * @history     .design/_history/docs-site/
   * @handoff     bunx shadcn add file://./Docs\ Site.registry.json
   */
  ```

  Block is generated, not hand-edited. `.meta.json` stays the source of truth; the JSDoc is a projection. `/design:edit` step 1 (read canvas) re-syncs the block when the meta sidecar changed.

- **Pattern**: Idempotent string-replace of the leading comment block via `magic-string` — if the file's first non-empty token is `/**`, overwrite to end of block-comment; else `prepend()`. Never touches the JSX or imports.
- **Gotcha**: Codemod (Task 8) must generate the JSDoc for every migrated canvas in the same pass — don't ship migration without it; that's exactly the "every canvas a cold-context handoff" case this task fixes.
- **Validate**: `cat .design/ui/Docs\ Site.tsx | head -15` — JSDoc present, contents match `Docs Site.meta.json`. Touch `.meta.json`, trigger HMR, header re-syncs.

**12b — `_components.css` bundling into registry-item** (extends `handoff.ts` from Task 7):

- **Do**: After the canvas TSX is stripped of `data-cd-id`, AST-scan it for every `className` literal. Collect the union of class names (`["btn", "btn--ghost", "tile", "sku", "seg", ...]`). Open `_components.css`, parse via `lightningcss` (already a dep per Phase 3.4), keep only rules whose selector touches one of the collected class names — *plus* the rules they reference via `var(--*)` (transitively). Emit the result as `files[1] = { path: "styles/<slug>.css", content: <subset>, type: "registry:style" }`. Then walk `colors_and_type.css` for every `var(--name)` reference in the subset + the canvas TSX `style={{}}` blocks; emit only the touched tokens as `cssVars.theme` + (for non-color tokens) as raw CSS in a second `registry:style` file. Result: target Next.js project after `bunx shadcn add` has `components/<slug>.tsx` + `styles/<slug>.css` + tokens grafted into `app/globals.css` — self-contained, no manual copy.
- **Pattern**: Use `lightningcss`'s visitor API (per Phase 3.4's CSS pipeline) to filter rules; reuse the dep, don't pull a separate CSS parser. The className-occurrence AST scan is one more `oxc-parser` visit in the same toolchain we already use.
- **Gotcha**: Pseudo-class rules (`.btn:hover`, `.btn:focus-visible`) must travel with their base rule. Don't filter by exact selector match — filter by base-selector-contains-known-class. Same for descendant selectors (`.tile .sku`).
- **Validate**: `bunx shadcn add file://./Docs\ Site.registry.json` in a scratch Next.js project produces a `components/docs-site.tsx` that renders correctly without further CSS work. Diff the bundled CSS against `_components.css` source — only used rules present, byte size < 8 KB per canvas typical.

**12c — Auto-load `_components.css` reference into edit context** (~30 LOC patch to `/design:edit`):

- **Do**: When `/design:edit` reads a canvas with `css_mode: "inline"` (the MDCC-DSN/01 default), also Read the project's `_components.css` and `colors_and_type.css` *before* dispatching to frontend-design. The CSS files load into model context so I don't blind-edit `<button className="btn btn--ghost">` not knowing what `.btn` looks like. Cost: ~6 KB CSS context per edit; saves the ~30 KB "Claude re-grep'd `_components.css` mid-edit" round-trip.
- **Pattern**: Add Step 1.5 to `plugins/design/commands/edit.md`. For `css_mode: "tailwind"` canvases, skip (Tailwind utilities self-describe). For `css_mode: "modules"`, load the canvas's `<Slug>.module.css` instead of `_components.css`.
- **Gotcha**: Don't load CSS files into context for unrelated edits — only when the feedback names a styled element OR `_active.json.selected.id` is set OR feedback contains style verbs ("color", "spacing", "padding", "border", etc.). Use a simple heuristic in the bash pre-flight; if unsure, load — cost is bounded.
- **Validate**: Token-cost regression test: `/design:edit "change the ghost button accent on the cmd-k row to red"`. Compare context size with and without Step 1.5 loading. Without: model re-reads `_components.css` mid-task (visible in tool trace) or guesses wrong classes. With: edit lands first-pass.

**12d — `.meta.json` schema additions for AI-readme**:

- **Do**: Extend `canvas-meta.schema.json` with optional `ai_context` field: `{ pinned_decisions: string[], known_quirks: string[], why_this_exists: string }`. Populated manually (or via a `/design:annotate` future helper, NOT in this phase) when a canvas accumulates decisions worth pinning ("we tried gradient hero — rejected because phosphor-dark theme clashed"). JSDoc header (12a) projects `why_this_exists` as a `@notes` block when present.
- **Pattern**: Same JSON-Schema extension pattern as Task 10.
- **Gotcha**: This is opt-in metadata, not auto-generated. The point is a place to put hard-won context that would otherwise get lost. Don't auto-fill; that defeats the purpose.
- **Validate**: AJV-validate sample meta with + without `ai_context`. JSDoc header (12a) handles missing field gracefully.

---

## Validation

Run these commands to confirm zero regressions:

1. **Types**: `bun run tsc --noEmit -p plugins/design/dev-server` (plugin's own tsconfig from Phase 3.4).
2. **Tests**: `bun test plugins/design/dev-server/test/`.
3. **Build**: `bun run plugins/design/dev-server/build.ts` (per Phase 3.4 — produces `dist/mdcc-<platform>`).
4. **Manual canvas roundtrip**: `mdcc design serve` in this repo. Open `_shell.html` route. Click each canvas in the tree. All render. Cmd+Click an element — `_active.json.selected.id` populates.
5. **`/design:new` smoke**: `/design:new "Smoke Test" "Single hero with CTA — verify TSX path works"`. Inspect `.design/ui/Smoke Test.tsx` exists, < 10 KB, parses, renders.
6. **`/design:edit` regression**: `/design:edit "change the hero accent color to amber"` on `Docs Site.tsx`. Verify edit lands as a single-element className change (not full-file rewrite); verify `_history/docs-site/<ISO>/` snapshot is a small diff.
7. **`/design:handoff` smoke**: `/design:handoff` on `Docs Site.tsx` emits `.design/ui/Docs Site.registry.json`. Open the file — schema-valid (`registry:block`, `files[0].type: registry:component`, `dependencies` present).
8. **`design-system-guard` subagent** (per existing flow): runs against the migrated canvases. 0 blockers expected (DS unchanged; canvas chrome unchanged).
9. **`a11y-auditor` subagent**: live axe-core on `_shell.html` + sample canvas route. 0 blockers (a11y is independent of format; Phase 3.4's a11y baseline carries forward).

---

## Risk register

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| `bun-plugin-tailwind` 0.1.x is unstable mid-canvas | Med (v0.1.x is young) | MDCC-DSN/01 defaults to `css_mode: "inline"` — plugin path doesn't run. Tailwind-mode canvases (future DS opt-in) carry the risk; flag explicitly in DDR-017. |
| Motion library + Radix portals — Preact-compat edge cases | **N/A (resolved)** | DDR-012 chose React 19 everywhere. Motion + Radix run natively. The risk is closed. |
| `data-cd-id` renumbers on sibling insert → selection jumps mid-edit | High (it's the design) | Documented in DDR-017. Phase-12 inspector resolves selections via `(componentName, jsxPath)` fallback when ID is stale. Phase-10 Yjs binding adds Awareness layer that survives content-level conflicts. **This phase ships the foundation, not the recovery layer.** |
| Codemod produces broken TSX for one of the existing canvases (e.g. `Canvas Viewport.html` with heavy React.useState usage) | Med (Canvas Viewport is the most complex existing canvas) | Codemod dry-run mode + per-canvas opt-out flag. Migration commits canvas-by-canvas; broken outputs roll back independently. Manual touch-up budgeted (~1 day for the two heavy canvases). |
| oxc-parser API breaking change between versions | Low (mature; npm v0.30+) | Pin exact version in `package.json`. Renovate-bot PRs reviewed manually. |
| Bun.Transpiler.transformSync output diverges from `@babel/preset-react` for an obscure JSX edge case | Low (Bun is esbuild-compatible) | Tests at Task 11 cover the migrated canvas roster. Edge cases caught + escalated to a Bun upstream issue if found. |
| `_locator.json` corruption under concurrent transpiles | Low (mutex per file) | Atomic-write pattern + Mutex in Task 2. Test in Task 2 covers it. |
| Existing users' `.design/` corpora break on upgrade | High if no codemod | Codemod (Task 8) runs once per project. Migration guide + the `_history/_migration-2026-05-15/` backup directory let users diff + roll back. |
| Phase 3.4 slips → this phase blocked | High dependency | This plan does not start until 3.4 lands `dist/mdcc-<platform>`. No work-in-parallel that pre-commits API decisions. |
| ~~Preact-for-canvases creates a handoff runtime mismatch~~ | **N/A (resolved by DDR-012)** | This risk row drove the runtime decision through three drafts. End state: React 19 everywhere; canvases and target React projects share the same runtime semantics. Inversion failure mode no longer exists. Row preserved as historical context — the analysis that resolved this risk shaped the plan. |

---

## Scenario Coverage (UI tasks — required)

This phase is dev-server-internal architecture; the user-facing surface is "canvases keep working in the dev-server". One new scenario:

| Scenario | Covers | Status |
|----------|--------|--------|
| `canvas-format-tsx` | Open dev-server → click `Docs Site.tsx` in tree → canvas renders → Cmd+Click hero badge → `_active.json.selected.id` populates → run `/design:edit "change hero accent to amber"` → screenshot the result | 🆕 new — single platform (web-desktop), the dev-server is web-only |

Skip the 5-platform matrix — dev-server has no mobile/native surface.

---

## Acceptance Criteria

- [ ] All 12 tasks completed (Task 12 ships AI-handoff polish — JSDoc header, `data-cd-id` strip, CSS bundling, edit-context CSS auto-load)
- [ ] `/flow:utils-verify` passes after each task (Edit-Verify Loop, max 3 iterations)
- [ ] `/flow:validate` passes overall:
  - [ ] Types (`bun tsc --noEmit` on `plugins/design/dev-server`)
  - [ ] Tests (`bun test plugins/design/dev-server/test/`)
  - [ ] Build (`bun run plugins/design/dev-server/build.ts` produces a binary)
  - [ ] `canvas-format-tsx` scenario passes (single-platform, see above)
  - [ ] `design-system-guard` subagent: 0 blockers against migrated canvases
  - [ ] `a11y-auditor` subagent: 0 blockers (a11y baseline from Phase 3.4 carried forward)
- [ ] Performance budgets met (per the gates table above)
- [ ] DDR-017 written + cross-linked
- [ ] All existing canvases migrated; originals preserved under `_history/_migration-2026-05-15/`
- [ ] `/design:handoff` emits valid `<Slug>.registry.json` for at least one canvas; `bunx shadcn add` round-trips into a scratch project **with self-contained CSS** (no manual copy step required) **and no `data-cd-id` attrs in the dropped file**
- [ ] Every migrated canvas has a generated JSDoc header projecting `.meta.json` — verify `head -15` on each `.design/ui/*.tsx`
- [ ] `/design:edit` Step 1.5 auto-loads `_components.css` for `css_mode: "inline"` canvases when feedback names a styled element; visible in `.ai/state/HANDOFF.md` regression trace
- [ ] No remaining `\.html` references in `plugins/design/commands/*.md` outside of `_shell.html` + system-specimen targets
- [ ] No DDR-worthy decision left unrecorded

---

## Retro (closed 2026-05-18)

**What worked:**

- The "one toolchain, three call sites" discipline (oxc-parser + magic-string in canvas-pipeline, canvas-edit, codemod, handoff) paid off — every new file slotted into the existing mental model. Net surface added: ~1000 LOC across 4 modules + 4 test files; net cognitive load: one toolchain.
- Splitting the phase across 3 sessions (foundation → runtime slice → closing slice) prevented context exhaustion. Each session's STATE.md handoff was specific enough that the next picked up cleanly.
- `bun:test` against the actually-migrated repo canvases (`phase-3.6-smoke.test.ts`) caught real regressions earlier than synthetic fixtures would have. Worth carrying to 3.6.1.
- Idempotent JSDoc header injection (Task 12a `applyHeaderToSource`) generalised cleanly from "codemod baked it in" to "any future tool can re-sync from meta" — one less codepath to maintain.

**What didn't:**

- **Acceptance criteria missed runtime rendering**. Plan gated on "transpile + build cleanly" but not "render without console errors." The codemod produced files that satisfied all 12 listed criteria yet white-paged at runtime because frame primitives (`DesignCanvas`/`DCSection`/`DCArtboard`) were never defined in TSX-land. The original HTML canvases got them as babel-runtime window globals; the codemod copied JSX verbatim without inlining definitions. Caught by user on first open. Mitigation now lives in Phase 3.6.1 (canvas-lib + virtual-module resolution + handoff inlining).
- **DDR-017 → DDR-019 numbering drift**. Plan called for DDR-017; foundation slice committed it as DDR-019 because 017/018 were already taken. Both numbers float around in plan + STATE.md prose. Lesson: pick the DDR number **after** scanning `.ai/decisions/`, not in the plan template.
- **Performance budgets were aspirational, not measured**. The plan's "Performance budgets" table listed gates (cold load < 250 ms, transform < 8 ms p50, HMR < 100 ms, token cost < 30 %) but Task 11 only ran the build harness, not wall-clock sampling. None of the gates were actually verified this phase. Carries to 3.6.1's explicit HMR gate (< 200 ms p50, measured).
- **Smoke TSX.tsx got orphaned**. It was a foundation-slice runtime mount fixture; nobody upgraded it to use the canvas envelope when that contract solidified. Plan said "safe to keep or delete" — that's the kind of language that ages into "neither maintained nor deleted." 3.6.1 rewrites it as a proper canvas.
- **DS specimens skip-list was the wrong call**. Plan Task 9 explicitly kept `system/<ds>/preview/*.html` as static HTML on the reasoning that "they don't iterate." User flagged immediately that they SHOULD iterate (Cmd+Click + `/design:edit`). The plan-time decision under-weighted the plug-and-play UX. Reversed in 3.6.1.

**What to change in `/plan` / `/execute` next time:**

- **Acceptance criteria must include a runtime gate**, not just static checks. For UI work: "the migrated artifact renders with 0 console errors" is now the minimum bar. Add to `/plan` template.
- **DDR numbering**: `/plan` should pre-scan `.ai/decisions/` and assign the next free number into the plan template, not let it drift.
- **Performance budgets**: if the plan lists a gate, the plan must list the measurement command. "Targets without instrumentation" → either drop the target or schedule the instrumentation as a task.
- **Skip-lists with weak rationale are tech debt**. When the plan says "X stays in old format because Y", the "Y" must be a hard reason (security, scope, blocking dependency). "Doesn't iterate" was a soft reason that the user immediately contradicted.

**Successor phase:** `.ai/plans/phase-3.6.1-canvas-envelope-and-ds-specimens.md` — canvas-lib + virtual module + handoff inlining + HMR + DS specimens to TSX.
