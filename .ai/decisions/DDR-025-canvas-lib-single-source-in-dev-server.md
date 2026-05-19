# DDR-025: canvas-lib + perf-lab live in dev-server (single source), `.design/` carries only user-authored content

- **Date:** 2026-05-19
- **Status:** Accepted
- **Tags:** design, dev-server, canvas-lib, virtual-module, handoff, project-layout, drift, phase-4.0.5
- **Related:** [DDR-022](./DDR-022-canvas-lib-virtual-module-and-inline-on-handoff.md) (amends), [DDR-020](./DDR-020-single-dev-server-runtime-bun.md), [DDR-024](./DDR-024-phase-4-canvas-engine-driver-choice.md), [`.ai/plans/phase-4.0.5-canvas-lib-single-source.md`](../plans/phase-4.0.5-canvas-lib-single-source.md), [`.ai/plans/phase-4.1-figjam-canvas-interactions.md`](../plans/phase-4.1-figjam-canvas-interactions.md) (blocked until 4.0.5 lands)

## Context

DDR-022 (2026-05-19, hours before this DDR) decided that `@mdcc/canvas-lib` is a **project-owned** virtual module, scaffolded from `plugins/design/templates/canvas-lib.tsx.template` into `<designRoot>/_lib/canvas-lib.tsx` on first `/design:setup-ds` run. The resolver in `canvas-lib-resolver.ts` then maps the specifier to that project-local file, the handoff inliner reads from the same file, and HMR watches it for changes.

The motivation was solid (single source per project, helpers can grow, handoff stays self-contained). But the moment we tried to plan Phase 4.1 (FigJam-grade canvas interactions — bigger surface, new modules, new exports) the same architecture started to bite:

1. **Project-local copies always drift from the source-of-truth template.** Today the bootstrap step says "copy verbatim from `templates/canvas-lib.tsx.template`, idempotent across re-bootstraps." Idempotent means *if the file already exists, skip*. So every plugin upgrade leaves stale project copies that never get the new canvas-lib. The release-flow doesn't ship updates to a project's `_lib/canvas-lib.tsx`. Authors who edit canvas-lib in this repo are essentially editing the dogfood instance and have to manually re-copy to the template — friction the user has already complained about.
2. **"`.design/` should be user content only" is the actual mental model.** The user (in the Phase 4.1 framing session 2026-05-19) explicitly: "*nechápu proč `.design` má `_lab` a `_lib`, vždyť to by se všechno mělo tahat z dev-serveru. Dev-server má sloužit jako wrapper pro design co se vygeneruje, nic víc. `.design` vůbec nemá obsahovat žádnou canvas a dev-server funkcionalitu.*" The current `.design/_lib/canvas-lib.tsx` + `.design/_lab/perf-100-artboards.tsx` violate this — they're dev-server tooling living in user-content space.
3. **Phase 4.1's scope amplifies the drift cost.** 4.1 adds new modules (input-router, tool-mode, selection-set, context-menu) the router consumes. If we follow DDR-022's "scaffold into project" pattern these new files also drift — and any future router behavior change requires sweeping every downstream project. The fix isn't "more files in `_lib/`"; it's "stop materializing dev-server source into projects."
4. **The handoff drop contract works perfectly fine if the canvas-lib source lives in dev-server.** DDR-022 cited handoff self-containment as a constraint — but `canvas-lib-inline.ts` only needs to *read* the source. It doesn't care whether the file lives at `<designRoot>/_lib/canvas-lib.tsx` or `<devServerRoot>/canvas-lib.tsx`. Same for HMR — `http.ts` watches a path; the path can be inside the dev-server install instead of inside the project.
5. **The "project-owned override" use case never materialized.** DDR-022 implied projects could edit their `_lib/canvas-lib.tsx` to customize behavior. In practice no downstream project has done this; the file is treated as read-only "infrastructure" the user shouldn't touch. The override capability adds drift cost for zero realized benefit.

The architectural pressure is one-directional: **drift cost is monotonically increasing as the canvas-lib surface grows.** Phase 4.1 is the first phase where the cost crossed the "fix now or fix later, much more expensively" threshold.

## Decision

**The dev-server is the single canonical home for canvas-lib and any other "engine" / "tooling" surface (perf-lab fixtures, future input-router, tool-mode store, etc.). `.design/` contains only user-authored content: canvases, design-system tokens / components / specimens, meta sidecars, runtime state files written by the dev-server.**

Concretely:

1. **canvas-lib.tsx relocates** from `plugins/design/templates/canvas-lib.tsx.template` (template) + `<designRoot>/_lib/canvas-lib.tsx` (project copy) to **`plugins/design/dev-server/canvas-lib.tsx`** (single source, lives next to other dev-server modules). The template version is deleted. The project copy in this repo's `.design/_lib/` is deleted.
2. **`canvas-lib-resolver.ts`** is rewired: `canvasLibPath()` returns the dev-server-internal path (`path.join(__dirname, 'canvas-lib.tsx')` or equivalent), not `<designRoot>/_lib/canvas-lib.tsx`. The `Bun.build` resolver maps `@mdcc/canvas-lib` → dev-server path. Identical Bun.build semantics; just a different source location.
3. **Pre-flight check** in `canvas-build.ts` becomes a sanity check on the dev-server install (the file ships with dev-server, so missing-file = corrupt install, not a project-setup miss). The "/design:setup-ds to scaffold" hint is removed.
4. **`canvas-lib-inline.ts`** (handoff inliner) reads from the dev-server path. The handoff drop is unchanged from the consumer's perspective — they still receive a self-contained registry-item with the canvas-lib exports AST-inlined.
5. **HMR file-watcher** in `http.ts` watches the dev-server path. Editing `plugins/design/dev-server/canvas-lib.tsx` triggers hard-reload of every open iframe in the current dev session.
6. **`/design:setup-ds` no longer scaffolds `_lib/canvas-lib.tsx`.** The `design-system` skill's Round-0 Batch-A step 0 is removed. New projects don't get a `_lib/` directory at all.
7. **`mdcc init`** likewise does not emit `_lib/`. The skeleton under `plugins/flow/templates/ai-skeleton/` already has nothing to do with canvas-lib — no change there. The `cli/commands/init.mjs` design-side scaffolding (if any reaches into the `.design/` layout) is checked and trimmed.
8. **`.design/_lab/perf-100-artboards.tsx`** (Phase 4 T6 perf fixture) relocates to `plugins/design/dev-server/examples/perf-100-artboards.tsx` (or similar). It's a dev-server perf fixture, not user content; treating it as user content was an architectural slip.
9. **`/design:edit` Step 1.5** still pre-loads canvas-lib source into orchestrator context — just reading from the dev-server path now. The user-facing behavior (orchestrator sees the helper surface before editing) is preserved.
10. **`<designRoot>/_lib/` and `<designRoot>/_lab/` are deprecated path conventions.** A one-cycle migration guard in `canvas-build.ts` warns when a project still has a `_lib/canvas-lib.tsx` (instructs the user to delete it; the dev-server canvas-lib is now authoritative).

The two-state mental model from DDR-022 is preserved: **virtual import at author time** (canvases write `import { DesignCanvas } from "@mdcc/canvas-lib"`), **inlined source at handoff time** (registry-item drop has no `@mdcc/canvas-lib` reference). Only the *physical location* of the canonical canvas-lib source changes.

## Alternatives considered

### A — Keep DDR-022's project-scaffolded canvas-lib + add a template-hash drift detector

Detect when a project's `_lib/canvas-lib.tsx` diverges from the current template hash, warn on dev-server boot, ship an `mdcc canvas-lib sync` command.

- **Pros:** Preserves the override capability (theoretical).
- **Cons:** Adds infrastructure (hash store, drift detector, sync command, conflict resolution UX for the hypothetical "user edited their copy" case) to address a problem that wouldn't exist if we stopped materializing the file. Pure drift-management overhead.

### B — Real npm package `@mdcc/canvas-lib` (still rejected per DDR-022)

Same reasoning as DDR-022 alternative B. External versioning + handoff drop friction. Re-rejected; not viable.

### C — Project-scaffolded canvas-lib + force-overwrite on every `mdcc` upgrade

Treat the project copy as derived state, force-overwrite on every dev-server boot if `mdcc` version is newer.

- **Pros:** No drift.
- **Cons:** Then why materialize at all? The file is already derived; just keep it in one place. This is dev-server-source-of-truth in disguise with extra steps and a surprise-overwrite UX risk.

### D — Bundle canvas-lib into the canvas pipeline as a String (no on-disk file)

Embed the canvas-lib source as a string constant in `canvas-build.ts`; never write it to disk.

- **Pros:** Zero filesystem coupling. Resolver is trivial (returns the string).
- **Cons:** Hostile to debugging (no jump-to-definition in IDE, no quick read-the-source workflow during plugin development). The dev-server is also developed *in* this repo — putting canvas-lib in a string makes editing it during plugin work miserable. The file-on-disk dev experience is worth the trivial filesystem dep.

### E — Status quo (DDR-022 unchanged), accept Phase 4.1's added drift

Continue scaffolding into projects. Add input-router etc. as more `_lib/` files.

- **Pros:** No refactor today.
- **Cons:** Drift cost compounds. Phase 4.1 alone adds 4–5 new files to the materialized surface; phase 5 (draw tools) adds more; phase 4.2 (artboard drag) adds more. Every plugin upgrade leaves staler project copies. Architecturally we lose the "user content vs dev-server tooling" boundary just as we're starting to need it for real.

## Consequences

**Positive:**

- **Zero drift between dev-server and project surfaces.** The canvas-lib source lives in one place; editing it instantly propagates to every project's iframes on next HMR. Plugin upgrades automatically deliver canvas-lib updates without any project-side migration.
- **`.design/` becomes a pure content directory.** Inspectable, gitignorable per-project policy (some projects gitignore `.design/`, some commit it), reasoned-about cleanly. No "is this engine code or my design content?" ambiguity.
- **Phase 4.1+ adds zero materialized files.** Input-router, tool-mode store, selection-set, context-menu — all live in `plugins/design/dev-server/runtime/` (DDR-016: runtime folder = strip-on-handoff). No new project-local files; no new drift sources.
- **`/design:setup-ds` shrinks.** Round-0 Batch-A step 0 vanishes. The skill becomes simpler to maintain and faster to bootstrap (no canvas-lib file copy at all).
- **Handoff self-containment guarantee unchanged.** `canvas-lib-inline.ts` reads from a different path but produces identical output. The 14 inline tests still pass; the per-canvas tree-shake still works; the registry-item drop is still zero-`@mdcc/canvas-lib`.
- **Clearer mental model for new contributors.** "User content under `.design/`, engine under `plugins/design/dev-server/`" is one sentence. The DDR-022 "project-owned virtual module" was three sentences and still confusing.

**Negative / trade-offs:**

- **One-time migration.** Phase 4.0.5 does the relocation + cleanup. Cost: ~1 day of work, mostly path swaps + test fixture updates + design-system/SKILL.md edits + deleting Round-0 step 0. Cheap relative to the per-phase drift cost we'd otherwise pay forever.
- **DDR-022 partially superseded.** The "project-owned" framing is wrong. Updated section: "*See DDR-025: canvas-lib lives in dev-server, not in `<designRoot>/_lib/`. The 'inline on handoff' and 'virtual specifier at author time' parts of DDR-022 remain in force; the 'project-owned source' part is reversed.*" Added as a header note on DDR-022 itself.
- **Loss of per-project canvas-lib override.** Theoretical capability; nobody used it. If a downstream project genuinely needs custom canvas-lib helpers, the path is: contribute them upstream to dev-server (matches the open-source contribution model) or wrap them in their own project-local module that imports `@mdcc/canvas-lib` and re-exports an augmented surface. Acceptable.
- **Existing downstream projects with `_lib/canvas-lib.tsx`** need a deprecation cycle. The 4.0.5 plan ships a `canvas-build.ts` warning that logs "delete `<designRoot>/_lib/canvas-lib.tsx` — canvas-lib now ships with dev-server" on boot for one minor version. After that, the file is silently ignored.
- **`_lab/` semantics shift.** This repo's `.design/_lab/perf-100-artboards.tsx` was Phase 4 T6's perf fixture. Strictly it's dev-server tooling (we used it to stress-test the renderer), not a user-authored design. Moving it to `plugins/design/dev-server/examples/perf-100-artboards.tsx` is correct but does break any docs / scenario refs to the old path. The 4.0.5 plan sweeps those.

**Closed risks:**

- ~~"Project copies drift from template on plugin upgrade"~~ — closed by single-source.
- ~~"`/design:setup-ds` Round-0 step 0 idempotence quirk leaves stale copies"~~ — closed by removing the step.
- ~~"Phase 4.1+ adds N new materialized files per phase"~~ — closed by keeping engine modules in dev-server runtime.
- ~~"`.design/` boundary between user content and engine is unclear"~~ — closed by removing engine code from `.design/`.

## Compatibility notes

- **Pre-4.0.5 projects** keep working through one minor version. `canvas-lib-resolver.ts` prefers the dev-server path; if no dev-server-bundled canvas-lib exists (impossible in practice — it ships with the install), falls back to `<designRoot>/_lib/canvas-lib.tsx` and logs a deprecation warning. After the deprecation cycle, the fallback is removed.
- **`<designRoot>/_lib/canvas-lib.tsx`** in existing projects is left in place by 4.0.5 (deletion is the user's call). The dev-server logs a one-line "*ignoring legacy `_lib/canvas-lib.tsx` — canvas-lib now ships with dev-server; you can delete this file*" on boot.
- **`<designRoot>/_lab/`** in existing projects is untouched. The 4.0.5 cleanup only removes *this repo's* `_lab/` (it's our dogfood; we own it). Downstream projects that have their own `_lab/` for design experiments keep them — they were never required to put fixtures there in the first place.
- **`/design:handoff` consumers** see no change. The registry-item drop is byte-identical to before (same exports inlined, same self-containment guarantee).
- **`/design:edit`** sees no behavioral change. Step 1.5 pre-loads canvas-lib from the new path; orchestrator context is identical.
- **DDR-022 status** updated to "Accepted, partially superseded by DDR-025" with the specific reversal noted in DDR-022's header.

## Research source

- Phase 4.1 framing session 2026-05-19 — user's architectural pushback on `_lib`/`_lab` drift, recorded verbatim above.
- DDR-022 — the prior decision that this DDR partially reverses. Read alongside; DDR-022's "two-state model" survives, only the "project-owned" assertion is overturned.
- DDR-016 (runtime folder = strip-on-handoff) — the boundary this DDR re-establishes for canvas-lib (canvas-lib is *not* strip-on-handoff; it's inline-on-handoff — different category, both legitimately dev-server-owned).
- DDR-020 (single dev-server runtime, Bun-authoritative) — same single-source philosophy applied to a different surface.
- `plugins/design/dev-server/canvas-lib-resolver.ts` + `canvas-lib-inline.ts` (current implementations) — what the path swap concretely touches.
- `plugins/design/skills/design-system/SKILL.md` line 348 (Round-0 Batch-A step 0) — the bootstrap step that goes away.
