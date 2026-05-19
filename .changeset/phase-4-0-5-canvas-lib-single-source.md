---
"@1agh/md-claude": patch
---

**Design plugin — Phase 4.0.5: canvas-lib single source in dev-server (DDR-025).**

Internal refactor — zero behavior change for canvas authors (handoff drop is byte-identical), but plugin-author ergonomics + downstream-project filesystem layout shift.

- **canvas-lib relocated.** The shared canvas library (`DesignCanvas`, `DCSection`, `DCArtboard`, `DCPostIt`, specimen helpers, hooks) now lives at `plugins/design/dev-server/canvas-lib.tsx` and ships with the dev-server install. Three prior copies — `plugins/design/templates/canvas-lib.tsx.template`, the dogfood `.design/_lib/canvas-lib.tsx`, and every initialized project's scaffolded `<designRoot>/_lib/canvas-lib.tsx` — collapse to one. Plugin releases now reach end users automatically.
- **Bootstrap drops the canvas-lib scaffold step.** `design-system/SKILL.md` Round-0 Batch-A step 0 deleted. `/design:setup-ds` no longer writes a `_lib/` directory in the project; the virtual specifier `@mdcc/canvas-lib` resolves directly to the dev-server-bundled file at canvas build time.
- **Legacy `<designRoot>/_lib/canvas-lib.tsx` deprecation guard.** Downstream projects with a pre-4.0.5 `_lib/canvas-lib.tsx` get a one-shot warning log per dev-server boot (`[canvas-lib] Legacy … detected …`); the project file is **ignored** and the dev-server-bundled lib is authoritative. After two minor versions the warning becomes silent and the fallback comment is removed.
- **Perf fixture relocated.** `.design/_lab/perf-100-artboards.tsx` → `plugins/design/dev-server/examples/perf-100-artboards.tsx` with sibling `README.md`. The fixture is dev-server tooling, not user content — keeping it in `.design/_lab/` mislabeled the boundary.
- **canvas-lib HMR.** When `plugins/design/dev-server/canvas-lib.tsx` is edited, the http-layer file-watcher clears the canvas bundle cache and emits a synthetic `_lib/canvas-lib.tsx` event so the existing hmr-broadcast classifier emits the same hard-reload message every open iframe was already wired for. No bespoke client-side wiring.
- **DDR-022 partially superseded by DDR-025.** "Two-state model" (virtual specifier at author time, AST-inlined at handoff time) stands; only the *physical home* of the canonical source changed. Header annotation added to DDR-022.

`bun test`: 133/133 (4 tests in `canvas-lib-resolver.test.ts` rewritten to match the new contract — old assertion was `canvasLibPath('/foo/bar') === '/foo/bar/_lib/canvas-lib.tsx'`; new contract is `canvasLibPath()` returns the dev-server-internal path; new legacy-guard test asserts a planted bogus `<designRoot>/_lib/canvas-lib.tsx` is ignored). Handoff drop sha1-identical to pre-relocation baseline.
