# DDR-016: `plugins/design/dev-server/runtime/` is the canvas-runtime library home — not meta-design, not shell chrome

- **Date:** 2026-05-15
- **Status:** Accepted
- **Tags:** design, dev-server, runtime, audit, library, bundle, react, phase-3.4
- **Related:** [`.ai/plans/phase-3.4-architecture-refactor.md`](../plans/phase-3.4-architecture-refactor.md) (Task 1 — the audit gate this DDR answers), [DDR-012](./DDR-012-react-19-unified-runtime.md), `plugins/design/dev-server/runtime/design-canvas.jsx` (803 LOC), `plugins/design/dev-server/runtime/tweaks-panel.jsx` (425 LOC), `plugins/design/dev-server/server.mjs:878-895` (HTML injection that wires `<script type="text/babel" src="/_runtime/*.jsx">` into every user canvas page), `plugins/design/dev-server/server.mjs:1209-1210` (`/_runtime/*` route handler)

## Context

Phase 3.4 starts with an audit gate (Task 1): decide what `plugins/design/dev-server/runtime/` is, because the next 15 tasks depend on the verdict. Three hypotheses had been on the table:

- **(a)** Meta-design canvases — mocks of the dev-server UI authored as `.design/ui/` artifacts. Plan referenced commit `5864f71` ("meta-design of dev-server canvas viewport states") as a hint.
- **(b)** Runtime code injected into user canvases — a library the dev-server serves at `/_runtime/*` and references via `<script>` tags in every HTML page in `.design/`.
- **(c)** Mixed.

### Evidence gathered

1. **File contents.** Both files declare React components and helpers (`DesignCanvas`, `DCSection`, `DCArtboard`, `DCPostIt`, `TweaksPanel`, `TweakSection`, `TweakSlider`, `TweakRadio`, `useTweaks`, etc.) at module scope. No `export` statements; everything is hoisted onto `window.*` for the babel-standalone runtime to find. The component prose explicitly describes the *consumer* usage from a user HTML page:

   ```jsx
   // tweaks-panel.jsx (top comment)
   //   const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{ ... }/*EDITMODE-END*/;
   //   function App() {
   //     const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
   //     return <TweaksPanel> ... </TweaksPanel>;
   //   }
   ```

2. **Server wiring.** `server.mjs:878-895` strips any user-authored `<script src="design-canvas.jsx">` / `<script src="tweaks-panel.jsx">` and re-injects them as `<script type="text/babel" src="/_runtime/design-canvas.jsx" data-design-runtime="1">` — the `/_runtime/*` version is authoritative. `server.mjs:1209-1210` is the route handler that serves the raw JSX file content with `application/babel` MIME.

3. **Git origin.** `git log` on `plugins/design/dev-server/runtime/` shows two commits:

   - `b200e59` ("stable element IDs + canonical screenshot pipeline + shared bash helpers") — the introduction commit.
   - `827a38c` ("move plugin into ./plugins/design") — a path move.

   The plan's hypothesis that commit `5864f71` ("meta-design of dev-server canvas viewport states") created them is **wrong**. `5864f71` introduced meta-design mocks under `.design/` at the repo root — a separate path. Confirmed by `git log --all -- plugins/design/dev-server/runtime/`: that path is untouched by `5864f71`.

4. **Consumer references.** `app.jsx` does NOT import or mount these components. The shell's `<Viewport>` simply hosts iframes; user HTML pages running inside those iframes consume the `/_runtime/*.jsx` script tags injected by the server.

5. **Parent-postMessage protocol.** `tweaks-panel.jsx` posts `__edit_mode_available` / `__edit_mode_set_keys` / `__edit_mode_dismissed` and listens for `__activate_edit_mode` / `__deactivate_edit_mode` on `window.parent`. This is the iframe-to-shell protocol — only a script running inside a user canvas iframe would need it.

### Verdict

**Option (b) confirmed.** These are runtime library files injected into every user canvas HTML page, providing a Figma-ish canvas wrapper (`DesignCanvas` + `DCSection` + `DCArtboard` + `DCPostIt`) and a reusable tweaks panel (`TweaksPanel` + form controls) so user HTML prototypes don't re-roll either.

They are NOT:

- Meta-design mocks of the dev-server's own UI. (Those live under `.design/ui/`.)
- Part of the shell chrome (`app.jsx`'s tree / tabs / header). The shell never imports them.
- A panel that runs in the shell's process. They run inside iframe documents, communicating to the shell only via `postMessage`.

## Decision

Keep the `runtime/` folder where it is — `plugins/design/dev-server/runtime/` — and reframe its purpose as the **canvas-runtime library**: a separately-bundled React component set that user canvas HTML pages reference via injected `<script>` tags.

### Distribution shape after Phase 3.4

| Bundle | Path | Loaded at | Consumer |
| --- | --- | --- | --- |
| Shell bundle | `dist/client.bundle.js` | `/` (dev-server root) | `app.jsx` — file tree, tabs, header, comments panel |
| **Canvas-runtime bundle** | `dist/canvas-runtime.bundle.js` | injected into every user HTML in `.design/` (replaces today's `/_runtime/*.jsx` raw-babel script tags) | user canvas HTML files |
| Styles bundle | `dist/styles.css` | `/` | shell |

Both JS bundles share the **same React 19 runtime** (per [DDR-012](./DDR-012-react-19-unified-runtime.md)) — `Bun.build` deduplicates via `external: ['react', 'react-dom']` on the canvas-runtime entry and a single `dist/react-runtime.bundle.js` loaded once before either consumer. (Alternative: inline React 19 into the canvas-runtime bundle if Bun.build's cross-bundle dedup costs more than the ~25–35 KB gz repetition. Pick at build time based on measured cold-start delta.)

### Build pipeline integration

`build.ts` (Phase 3.4 Task 3) grows a second `Bun.build` entrypoint:

```ts
await Bun.build({
  entrypoints: ['runtime/canvas-runtime.entry.tsx'],   // new entry that re-exports + registers globals
  outdir: 'dist',
  target: 'browser',
  format: 'iife',
  minify: true,
  globalName: '__CDRuntime',   // namespaces window-registered components
});
```

A new `runtime/canvas-runtime.entry.tsx` shim does the IIFE → `window.*` registration so existing user HTML pages keep working unchanged:

```tsx
import * as DC from './design-canvas';
import * as TP from './tweaks-panel';
Object.assign(window, DC, TP);  // backward-compatible global hoisting
```

This preserves the consumer contract — user HTML pages still write `<DesignCanvas>`, `<TweaksPanel>` etc. as JSX. The dev-server's HTML injection (server.mjs:885-886) updates to:

```html
<script src="/_runtime/canvas-runtime.bundle.js" data-design-runtime="1"></script>
```

(One bundle tag replacing the two raw-babel tags. `type="text/babel"` is gone — the runtime is pre-built.)

### File naming

Inside `runtime/`, both files are renamed from `.jsx` to `.tsx` as part of Phase 3.4 Task 7 (TypeScript adoption for the dev-server source set). The component APIs do not change.

## Rejected alternatives — rationale

**Option (a) — move to `.design/ui/`.** Rejected because these files are not design artifacts; they are the runtime that design artifacts depend on. Moving them to `.design/ui/` would:

- Break the `/_runtime/*` route in `server.mjs`, which expects them in the plugin tree.
- Break end-user installs: `plugins/design/dev-server/` ships via the npm tarball; `.design/` is per-user and is not shipped with the plugin. Moving them to `.design/ui/` would mean the plugin literally has no canvas-runtime library to inject.
- Confuse the boundary: `.design/ui/` is for surfaces the *design plugin* mocks (the dev-server UI itself), not for code the design plugin *ships*.

**Option (b) original wording — rename to `client/panels/`.** Rejected because "panels" implies they run in the shell process alongside `app.jsx`. They don't — they run inside iframe documents. Putting them in `client/` would mislead future maintainers into thinking the shell mounts them. Keeping them in `runtime/` honors the actual lifecycle (injected into user pages, not shell-mounted).

**Option (c) — split per-file.** Rejected because both files have the same lifecycle (injected globals consumed by user HTML pages via babel-standalone today, by a pre-built bundle tomorrow). A split would create one bin labeled "library" and one labeled "weird edge case", and the second bin would attract every future addition that doesn't quite fit. Better to keep `runtime/` as a coherent library home.

## Consequences

**Positive:**

- Existing user HTML pages keep working with no changes after Phase 3.4 lands (the IIFE bundle registers the same `window.*` globals).
- The library has a clear home with a documented purpose; future contributors won't mistake it for shell code or design artifacts.
- TypeScript adoption (Task 7) catches API drift between the library's exports and user HTML page consumers via the `.d.ts` file `Bun.build` emits alongside the bundle.
- Single React 19 runtime shared with the shell — no Preact/React mix even inside iframes (consistent with DDR-012).

**Negative / trade-offs:**

- The renamed-but-not-moved folder is a slight surprise for someone scanning the file tree expecting `runtime/` to be Node-side runtime code. Mitigation: add a one-line `runtime/README.md` clarifying it's the canvas-runtime library, not server runtime.
- The IIFE → `window.*` registration is a backward-compat hack. The cleaner long-term path is to migrate user HTML pages to ESM imports (`<script type="module">` + explicit `import {DesignCanvas} from '/_runtime/canvas-runtime.bundle.js'`), but that's a Phase 3.6+ migration; the `window.*` shim keeps Phase 3.4 zero-breaking.
- Cross-bundle React dedup adds a build-time decision (shared runtime bundle vs. inlining). Whichever wins must be documented in `build.ts` comments.

## Revisit when

- **User HTML pages migrate to ESM.** Once all canvases use `<script type="module">`, the `window.*` registration shim can be dropped — exports become real ESM exports. Likely Phase 3.6 or later.
- **The canvas-runtime library grows a third file.** If a new module joins (e.g. `runtime/comments-overlay.tsx` for Phase 6), reconfirm the library boundary — is it still "canvas-injected globals" or is it drifting into shell-side concerns?
- **A canvas needs the shell's React tree (not just the runtime library).** That's a structural change to the iframe-vs-shell boundary; revisit whether iframes are still the right hosting model.

## Linked

- **Plan:** [`.ai/plans/phase-3.4-architecture-refactor.md`](../plans/phase-3.4-architecture-refactor.md) — Task 1 (this audit) + Task 3 (build.ts wires the new bundle) + Task 7 (TS rename)
- **DDR-012:** [React 19 everywhere](./DDR-012-react-19-unified-runtime.md) — canvas-runtime shares the shell's React 19
- **DDR-009:** [Bun runtime authoritative](./DDR-009-bun-runtime-authoritative-for-dev-server.md) — provides `Bun.build` pipeline
- **Code:** `plugins/design/dev-server/runtime/{design-canvas,tweaks-panel}.{jsx → tsx}` (Phase 3.4 Task 7 renames)
