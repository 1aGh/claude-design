# DDR-012: React 19 everywhere — shell and canvases share a single runtime

- **Date:** 2026-05-15
- **Status:** Accepted
- **Tags:** design, dev-server, runtime, react, preact, framework, bundle-size, complexity, perf-budgets, phase-3.4, phase-3.6
- **Related:** [DDR-009](./DDR-009-bun-runtime-authoritative-for-dev-server.md), [`.ai/plans/phase-3.4-architecture-refactor.md`](../plans/phase-3.4-architecture-refactor.md), [`.ai/plans/phase-3.6-canvas-tsx-format.md`](../plans/phase-3.6-canvas-tsx-format.md) (consumer of the shared runtime), `plugins/design/dev-server/client/app.jsx` (currently React 18 UMD), `plugins/design/dev-server/runtime/{design-canvas,tweaks-panel}.jsx` (injected into user canvases), [DDR-016](./DDR-016-runtime-folder-purpose.md) (runtime/ folder audit verdict)

## Context

Phase 3.4 drops `babel-standalone` + UMD React from `index.html` and switches to a `Bun.build`-produced bundle. The framework choice determines bundle size, idle RAM, agent codegen surface, and how Phase 3.6's canvas TSX format integrates with the shell.

Three drafts of this decision were considered during plan iteration (2026-05-12 → 2026-05-15):

1. **Draft A — Preact-only (everywhere).** ~5 KB gz total runtime, ~30–40% lower RAM. The aspirational "lean" option.
2. **Draft B — Hybrid: Preact for shell, React 19 for canvases.** Reasoning: shell is internal chrome where bundle/RAM matter; canvases are user-authored TSX where agent codegen + shadcn/Radix handoff matter. Two `jsxImportSource` configs, two bundle paths, conditional mount API on `meta.runtime`, per-runtime handoff audit, future-phase cognitive tax.
3. **Draft C — React 19 unified (this DDR).** Single npm `react` + `react-dom` tree-shaken by `Bun.build` — one runtime, one mental model, one bundle path. ~25–35 KB gz after tree-shake (shell uses ~30% of React's API surface).

The hybrid (Draft B) was the working assumption when the plan was first drafted. Re-examining it on 2026-05-15 with the question *"what does the dual-runtime actually buy us vs. what does it cost us forever?"* tipped the balance.

## Alternatives considered

### Option A — Preact-only everywhere (`preact` + `preact/compat`)

Shell + canvases both run on Preact, with `preact/compat` aliasing `react`/`react-dom` so npm React libraries link cleanly.

- **Pros:** Smallest bundle (~5 KB gz core, ~10 KB gz with compat) and ~30–40% lower RAM per component tree. Idle RAM target < 50 MB was clean. First-paint < 250 ms was reachable.
- **Cons:**
  - Agent codegen surface is overwhelmingly React 18/19 — Preact-`compat` shims drift quietly (the most-recent `useFormStatus`, `use(...)`, async `Suspense` boundaries arrive on Preact months later, sometimes never).
  - Phase 3.6's canvas TSX format hands off to shadcn / Radix / Headless UI / Tailwind copy-paste registries. All assume native React. `preact/compat` mostly works, but every handoff is a "verify this Radix primitive renders under Preact" pre-flight tax.
  - Canvas authors paste arbitrary React snippets from the open web; compat-shim edge cases (refs forwarded through portals, concurrent Suspense, `use()` for promises) bite at the worst time.
- **Rejected:** the v1 "tip-top" narrative includes agent-fluent codegen + frictionless registry handoff. Preact's compat tax is paid forever; the bundle/RAM win is realized once.

### Option B — Hybrid: Preact for shell + React 19 for canvases

Shell module set declares `jsxImportSource: "preact"`; canvas TSX route declares `jsxImportSource: "react"`. Both bundles ship. A `meta.runtime: "preact" | "react"` field on `.meta.json` selects the mount path.

- **Pros:** Best-of-both on paper — shell stays lean (Preact's 5 KB), canvases get native React for handoff parity. Each surface optimized for its dominant constraint.
- **Cons:**
  - **Two `jsxImportSource` configs.** Two `Bun.build` configs, two bundle paths, two HMR sockets in some draft variants. The build complexity compounds with every later phase (Phase 4 Pixi component, Phase 6 comments overlay — each must declare which runtime it lives under).
  - **Conditional mount API.** `mount.ts` must branch on `meta.runtime` and dispatch to the right framework's mount call (`createRoot(...).render(...)` vs `render(<App />, container)`). Every future canvas type has to declare its runtime.
  - **Per-runtime handoff audit forever.** Adding any shared component requires deciding which runtime owns it; the dual surface never goes away.
  - **Cognitive tax compounds.** Phase 3.5 (visual refresh), 3.6 (TSX format), 4 (Pixi canvas), 5–8 (collab, comments, draw tools) all carry "which runtime?" as an extra dimension of every component decision.
  - The bundle-size win is small in absolute terms: ~20 KB gz delta on the shell (Preact 5 KB vs React 25–35 KB). RAM delta is ~5–10 MB resident. Neither is load-bearing for the v1 narrative once the performance budgets are relaxed (see "Performance budgets" below).
- **Rejected:** the complexity cost is paid every phase for the lifetime of the codebase; the bundle/RAM gain is paid once and rounds away into the ~150 KB Pixi bundle Phase 4 adds.

### Option C — React 19 everywhere (npm `react` + `react-dom`, tree-shaken)

Single npm React runtime shared by shell (`/`) and canvases (`/ui/:slug` in Phase 3.6). `Bun.build` tree-shakes (~25–35 KB gz). One `jsxImportSource`, one mount path (`createRoot(...).render(...)`), one HMR runtime, one mental model.

- **Pros:**
  - One source of truth, one toolchain, one set of edge cases.
  - Agent codegen parity (the entire React 18/19 corpus is in-domain).
  - shadcn / Radix / Headless UI / arbitrary copy-paste from the web work natively in canvases.
  - Tree-shaken bundle (~25–35 KB gz) is acceptable — Phase 4's Pixi runtime adds ~120 KB anyway, so the shell bundle is not the bottleneck on cold start.
  - Phase 3.6's canvas TSX format becomes a thin layer over the same React runtime instead of a parallel ecosystem.
- **Cons:**
  - +20 KB gz on the shell bundle vs. Preact.
  - +5–10 MB idle RAM vs. Preact.
  - Performance budgets relaxed accordingly (see below).
- **Selected.**

## Decision

We pick **Option C — React 19 everywhere** because:

1. **Complexity is paid forever; bundle size is paid once.** The hybrid carries `jsxImportSource` x 2, conditional mount, runtime-tagged metadata, and per-component runtime audit through every later phase. The bundle delta (~20 KB gz) rounds into Pixi's ~150 KB bundle in Phase 4 and disappears at the wall-clock level (first paint < 350 ms vs < 250 ms — both feel native).
2. **Agent codegen + handoff parity dominate.** This is a design tool. Canvas TSX is authored by agents and humans pasting from the React ecosystem. Native React (not `preact/compat`) is the table stakes for that loop being frictionless.
3. **Tree-shaking earns most of Preact's bundle win back.** React 19 + `react-dom/client` minimum-viable surface (shell needs `useState`, `useEffect`, `useRef`, `useMemo`, `useCallback`, `createRoot`, `createElement`, fragments — about 30% of the public API) tree-shakes to ~25–35 KB gz under `Bun.build`. The "150 KB minified" number is the unshaken full library; we never ship that.
4. **One runtime simplifies HMR.** Phase 9's WS-driven HMR + Phase 3.6's `import.meta.hot` both target React Fast Refresh. Two runtimes = two Fast Refresh integrations to keep in sync.
5. **Strategic alignment with the React ecosystem.** shadcn registry, Radix primitives, Vercel AI SDK demos, the Tailwind ecosystem — all assume React. The plugin is downstream of all of them; aligning is cheaper than translating.

## Rejected alternatives — rationale

**Option A (Preact-only)** rejected because the agent-codegen + handoff cost is paid on every component the user creates, forever. The bundle/RAM win is finite (~20 KB gz, ~10 MB resident) and rounds into noise on hardware younger than ~2020. v1's "tip-top" narrative is about *feel* — relaxed by 100 ms in first paint nobody will notice; broken Radix imports everyone will.

**Option B (Hybrid)** rejected because the dual-runtime tax compounds with every phase. The shell-vs-canvas distinction sounds clean today, but Phase 6 (comments) renders in the shell and overlays canvases; Phase 8 (collab cursors) crosses the boundary; Phase 4 (Pixi) renders inside the shell but draws on top of canvases. Every cross-boundary feature pays a "which runtime?" audit cost. One runtime erases the dimension entirely.

## Performance budgets — relaxed in this DDR

The decision to unify on React 19 forces a calibration on Phase 3.4's perf budgets. Numbers updated in the plan:

| Metric | Preact-shell target (Draft B) | React-19-everywhere target (this DDR) | Δ |
| --- | --- | --- | --- |
| Initial client bundle (gz) | < 60 KB | **< 80 KB** | +20 KB |
| Idle RAM (8 h, 1 canvas) | < 50 MB | **< 80 MB** | +30 MB |
| Cold start → first paint | < 250 ms | **< 350 ms** | +100 ms |
| Cold start → HTTP 200 | < 100 ms | **< 100 ms** (unchanged) | 0 |

The HTTP-200 budget is unchanged because it depends only on the Bun-compiled binary's startup, not on the client bundle.

The first-paint budget remains well inside the "feels native" threshold (research benchmarks classify < 500 ms as instant on a warm CPU). The bundle and RAM budgets accommodate React 19's footprint while staying meaningfully below the current babel-standalone baseline (~110 KB gz, ~120 MB idle RAM after 1 h).

## Consequences

**Positive:**

- One `jsxImportSource: "react"` config in `tsconfig.json` and `Bun.build` options. No conditional bundling.
- One mount API (`createRoot(domNode).render(<App />)`) across shell and canvases. No `meta.runtime` field on `.meta.json`.
- One Fast Refresh integration. Phase 9's HMR (shell) and Phase 3.6's `import.meta.hot` (canvases) share React's runtime hot-reload mechanics.
- Agent codegen lands on native React — no compat shim drift, no Preact-specific edge cases.
- shadcn / Radix / Headless UI / Tailwind registry handoffs work without per-primitive verification.
- The shared bundle (~25–35 KB gz) is loaded once at `/` and reused at `/ui/:slug` via the same `<script>` tag — browser cache makes the second load free.

**Negative / trade-offs:**

- +20 KB gz on cold-start payload vs. Preact-only. Mitigation: `Bun.build` tree-shake + gzip; the absolute number stays well under the 80 KB budget.
- +5–10 MB resident RAM per process vs. Preact-only. Mitigation: idle-RAM budget relaxed to 80 MB; `Bun --smol` + `FinalizationRegistry` (Phase 3.4 Task 8) keeps the long-tail growth bounded.
- React 19 ecosystem is younger than React 18 — some niche libraries lag on `use()` / `useFormStatus` / async Suspense. Mitigation: shell + canvases only need the stable React 19 surface; bleeding-edge React features are opt-in per component.

## Revisit when

- **Phase 4 Pixi.js bundle pushes total cold-start payload past 250 KB gz.** That's the point where the shell-bundle 20 KB delta starts mattering. Re-examine whether tree-shaking can be tightened further or whether the shell should split into a lazy-loaded route.
- **React 19 ships a regression that blocks shell or canvas rendering.** Pin to the last known-good React 19 minor; if upstream stalls, evaluate Preact-compat as an emergency fallback (small surface; could land in days).
- **A future framework (React-Compiler-output, Solid-as-React-compat, etc.) demonstrates the bundle/RAM win without the handoff tax.** Re-open the comparison.

## Linked

- **Plan:** [`.ai/plans/phase-3.4-architecture-refactor.md`](../plans/phase-3.4-architecture-refactor.md) — Task 4 (`app.jsx` migration) + Task 14 (this DDR)
- **Phase 3.6:** [`.ai/plans/phase-3.6-canvas-tsx-format.md`](../plans/phase-3.6-canvas-tsx-format.md) — consumer of the shared runtime; no `meta.runtime` field needed
- **DDR-016:** [runtime/ folder audit](./DDR-016-runtime-folder-purpose.md) — `runtime/design-canvas.jsx` + `runtime/tweaks-panel.jsx` migrate from `babel-standalone`-in-browser to the same React 19 runtime as the shell
- **DDR-009:** [Bun runtime authoritative](./DDR-009-bun-runtime-authoritative-for-dev-server.md) — provides the `Bun.build` pipeline this decision depends on
