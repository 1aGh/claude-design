# DDR-027: artboard size is JSX-authoritative; `meta.layout.artboards[]` holds positions only

- **Date:** 2026-05-19
- **Status:** Accepted
- **Tags:** design, canvas-lib, phase-4.2, meta-schema, source-of-truth
- **Related:** [DDR-007](./DDR-007-stable-element-id-schema-data-dc-attrs.md) (data-dc-id keys layout entries), [DDR-019](./DDR-019-canvas-tsx-format.md) (canvas TSX format), [DDR-025](./DDR-025-canvas-lib-single-source-in-dev-server.md), [Phase 4](../plans/archive/phase-4-canvas-v2-rendering-engine.md), [Phase 4.2](../plans/phase-4.2-artboard-free-move.md)

## Context

Phase 4 (canvas-v2 infinite canvas) introduced `meta.layout.artboards[]` — a per-canvas sidecar mapping artboard `id` to a `{ x, y, w, h }` rect in world coords. The Phase 4 default-grid synthesizer (`synthDefaultGrid` in `canvas-lib.tsx`) seeded entries from the JSX `width` / `height` props on each `<DCArtboard>`, so the first time a canvas opened it wrote down whatever the JSX said — sizes included.

Phase 4.2 adds drag-to-reposition. The drag controller only ever changes `x` and `y` (sizes are unaffected by a translation), but the existing PATCH writer wrote the entire rect including the pre-recorded `w` and `h`. That's fine until the author edits the JSX:

```tsx
// Before
<DCArtboard id="hero" width={1280} height={820} ...>

// After (author wants a wider hero)
<DCArtboard id="hero" width={1600} height={820} ...>
```

With Phase 4's "meta has w/h" model, the canvas reloads and reads `meta.layout.artboards.hero.w === 1280` (stale snapshot) — the JSX change is silently ignored, and the artboard keeps rendering at the old 1280 size. Authors have to know to either (a) hand-edit the meta or (b) delete the layout entry to re-trigger default-grid synthesis. Both feel like leaky-abstraction tax.

The framing question: **which surface is canonical for artboard size — JSX props, or the meta sidecar?**

## Decision

**JSX `width` and `height` on `<DCArtboard>` are the single source of truth for artboard size. `meta.layout.artboards[]` persists positions (`x`, `y`) only. Writers strip `w`/`h` on PATCH; readers tolerate legacy entries but never let a meta size override a JSX prop or shadow a JSX edit.**

Concretely:

1. **Writer (`patchCanvasMeta` in `canvas-lib.tsx`).** When `patch.layout.artboards` is present, every entry is reduced to `{ id, x, y }` before serialization. Any `w`/`h` keys the caller may have included (e.g. the in-memory `ArtboardRect` type still carries them for layout math) are dropped. The PATCH endpoint round-trips position-only entries to disk.

2. **Schema (`canvas-meta.schema.json`).** `layout.artboards[].items.required` narrows from `["id", "x", "y", "w", "h"]` to `["id", "x", "y"]`. `w` and `h` remain in `properties` but are documented as legacy read-only — Phase 4 default-grid snapshots wrote them; Phase 4.2+ writers strip them.

3. **Reader (`DesignCanvasInner.artboards` `useMemo`).** Always merges meta entries onto the default-grid baseline:
   ```ts
   defaults.map((d) => {
     const m = byId.get(d.id);
     if (!m) return d;
     return {
       id: d.id,
       x: Number.isFinite(m.x) ? m.x : d.x,
       y: Number.isFinite(m.y) ? m.y : d.y,
       w: typeof m.w === "number" && m.w > 0 ? m.w : d.w,
       h: typeof m.h === "number" && m.h > 0 ? m.h : d.h,
     };
   })
   ```
   Defaults carry the JSX-derived `w` / `h`; meta supplies `x` / `y`. Legacy entries that still have `w` / `h` are honored (back-compat) but the next drag overwrites the entry without them. This was an active bug during Phase 4.2 implementation: a partial replace (instead of merge) caused position-only meta entries to render with `w = h = undefined`, producing 0×0 artboards — caught by visual smoke before merge.

4. **In-memory type stays `{ id, x, y, w, h }`.** `ArtboardRect` keeps `w`/`h` because the layout math (`computeFit`, `computeMiniMapGeometry`, snap candidates) needs sizes. Only the persistence boundary is narrowed; the runtime shape is unchanged.

5. **Handoff inliner unchanged.** `/design:handoff` already does not emit the meta sidecar into the registry item; it only reads `title` + `subtitle`. The size question never reaches the inliner. No additional stripping needed there.

## Alternatives considered

### A — Make meta authoritative for size; require an `mdcc canvas-lib sync-sizes` step after JSX edits

Authors edit `width={…}` in JSX, then run a CLI step that re-walks the canvas and overwrites meta sizes. Drag persists everything.

- **Pros:** Single source of truth (meta), no merge logic in the reader.
- **Cons:** Imposes a step authors will forget. The current friction (JSX change ignored on reload) just moves to a different friction (CLI dance). Tooling overhead for a use case (size persistence) that has no real user demand.

### B — Two-way bind: any meta size that doesn't match JSX gets nulled-out + re-synthesized on next open

`DesignCanvas` reads JSX props on mount and, if `meta.w !== JSX.width`, fires a PATCH to zero out the meta size + re-synthesize.

- **Pros:** Keeps the "meta is authoritative" appearance.
- **Cons:** Adds a fire-on-mount PATCH for every canvas, just to maintain the illusion. Race-prone (open two canvases at once, both write). Doesn't change the end-state — JSX is still de-facto authoritative; we just spend extra writes pretending otherwise.

### C — Make meta authoritative AND treat JSX as default-only

`<DCArtboard width={…} height={…}>` becomes a default that meta overrides. Authors who want a layout-driven size hand-edit meta.

- **Pros:** Clean separation — JSX = component shape, meta = layout.
- **Cons:** Hand-editing meta sidecars is a Phase 4 anti-pattern that the entire `/design:edit` flow exists to avoid. Pushing users toward it for routine size changes inverts the workflow.

The accepted decision (JSX-authoritative, meta = positions only) is the cheapest direction: no new CLI, no fire-on-mount writes, no hand-editing meta. The merge logic in the reader is ~6 lines and is unit-test-covered indirectly via the canvas-meta-api round-trip test.

## Consequences

- Authors edit `width` in JSX, reload, and see the change applied at the persisted position. No drift, no CLI step.
- Existing Phase 4 meta files with `w`/`h` keep rendering identically until the next drag, then organically migrate to position-only entries.
- The PATCH wire shape narrows by ~30 bytes per artboard. Negligible on disk; meaningful only as a contract simplification.
- Future work that legitimately needs to persist size — say, drag-to-resize handles — must amend this DDR (or supersede it). The current scope is explicit: positions only.

## Compatibility notes

- **Phase 4 → 4.2 migration is implicit.** Legacy entries with `w`/`h` remain readable; nothing breaks. The next drag overwrites individual entries without `w`/`h`.
- **Schema validation:** `additionalProperties: false` on the artboards-entry sub-schema is preserved; `w` and `h` are still recognized properties (just no longer required). Strict validators continue to pass on legacy entries.
- **Inspector / handoff:** unaffected — neither surface reads meta size.

## Research source

- 2026-05-19 framing conversation (Phase 4.2 plan revision): "artboard `width` / `height` stay JSX-authored. Per the 2026-05-19 decision, `meta.layout` holds positions only — sizes flow from code (single source of truth)."
- Visual smoke during Phase 4.2 implementation surfaced the partial-replace bug; the fix is documented in this DDR's reader contract.
