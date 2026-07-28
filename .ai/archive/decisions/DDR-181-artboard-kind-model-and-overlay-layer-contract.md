# DDR-181: Artboard kind model (JSX-prop-authoritative) + overlay-layer contract

**Status:** Accepted
**Date:** 2026-07-16
**Tags:** canvas-lib, artboard, print, web, video, snapping, ux

## Context

There was no artboard-level "what IS this" concept: video artboards were detected purely structurally (`subtreeHasVideoComp` — does the subtree contain a `<VideoComp>`), and the informal `meta.kind` field lived only at the canvas level, outside the schema. There was no place to draw non-exported guide chrome — the only existing overlays were the activity ring and drag snap-guides — so any print bleed/margin marks or web breakpoint bands would either have had to live inside the exported artboard content (wrong: they'd get screenshotted/exported) or invent a new ad-hoc layer per feature. There was also no layout-guide concept at all (no columns/rows/grid), so nothing to snap against beyond sibling edges and a fixed pixel grid.

This is the foundation plan in a 4-plan family — `feature-2-print-artboards` and `feature-3-web-artboards` both need a `kind` to key off of and a shared overlay mount point for their own kind-specific chrome (bleed/trim/margin/marks for print; a breakpoint band for web). Getting the primitive contracts right here avoids each downstream plan reinventing its own overlay layer or prop shape.

## Alternatives considered

- **`kind` as a canvas-level `meta.json` field** (promoting the existing informal `meta.kind`) — pros: no JSX change, matches where `title`/`sections` already live; cons: violates DDR-027 (artboard size is JSX-authoritative — no meta PATCH lane for artboard-scoped state), and a canvas legitimately mixes kinds (a print + digital pair on one moodboard canvas), so canvas-level scoping is the wrong granularity.
- **`kind` as a JSX prop on `DCArtboard`** — pros: DDR-027-consistent, per-artboard granularity, round-trips through the existing AST attr-edit lane with zero new persistence machinery; cons: requires a new AST writer (mitigated — it mirrors the existing `fixed`/`background`/`layout` writers almost exactly).
- **Guide-visibility as a versioned JSX prop** (e.g. `guidesVisible={true}`) — pros: simplest to implement; cons: pollutes the versioned source with per-user chrome state, and a git diff would show noise every time someone toggles a guide, which is exactly the churn DDR-115 already fixed for the camera (viewport).
- **Guide-visibility in `.meta.json`** — cons: same DDR-115 problem — it's per-user runtime state, not shared document state; would need a new "when is a meta field runtime vs shared" carve-out.
- **Guide-visibility in `_canvas-state/<slug>.view.json`** (the existing per-machine camera file) — pros: already gitignored, already has a GET-merge/PATCH-split contract (DDR-115) to extend, no new runtime-state-taxonomy entry needed (`_canvas-state/` is already in the ignored list in all three places — `apps/studio/git/service.ts`, `cli/lib/gitignore-block.mjs`, `.gitignore`). Picked.

## Decision

We pick the **JSX-prop model for `kind` + a shared `_canvas-state/<slug>.view.json` `overlays` lane for guide visibility**, because:

- `kind` as a JSX prop keeps DDR-027's "artboard state is JSX-authoritative" invariant intact and gives each artboard independent kind, not each canvas.
- An explicit `kind` prop always supersedes the structural `subtreeHasVideoComp` fallback — existing unmigrated video canvases keep working with zero required edits (Design Decision 1 in the plan).
- `ArtboardGuidesOverlay` mounts as a world-coordinate sibling of `DCArtboard`'s own `<article>` — the same pattern `ArtboardActivityOverlay` already established — which structurally guarantees it never lands inside `.dc-artboard`'s `contain:paint`/`content-visibility` GPU-freeze/cull subtree, so guides are never culled with off-screen content and never accidentally exported/screenshotted.
- Guide *definitions* (the `guides` prop: columns/rows/grid, Figma vocabulary) are versioned design intent — they belong in JSX, synced like any other authored prop. Guide *visibility* is a per-user viewing preference — it belongs in the existing runtime-state file, defaulting to **hidden** when the key is absent so an old `view.json` (predating this feature) never suddenly paints guides nobody asked to see.
- The `guides` object prop is written as **replace-whole-prop**, not a deep merge, at the AST layer — object-prop editing via AST is already the hard part of this feature; scoping it to "stringify and overwrite the whole `{{...}}` span" keeps the writer simple and correct. A caller that wants to preserve one key while changing another reads the current value back first (same as every other JSX-prop editor in this codebase) and sends the full merged object.
- Snapping (`use-snap-guides.tsx` for artboard drag, `annotations-snap.ts` for annotation drag) gained a pure `GuideLineCandidate` input that both engines merge into their existing sibling/candidate pool at equal footing (nearest-within-tolerance wins across ALL sources), plus a `SnapIntent` (`'layout'` default vs `'pixel'`) that gates whether siblings/guides participate at all. This is pure math, fully unit-tested; **wiring the live assembly of world-space guide lines from all visible artboards into the drag hooks, and a UI toggle for the intent preset, was deliberately deferred** — the plumbing (resolving every artboard's `guides` prop + its own rect into world-space lines, keyed by the current tool state) is a meaningfully separate, UI-state-heavy task from the snap-math primitive itself, and the primitive is what downstream plans and the drag hooks actually need to exist first.
- Kind switching (context-menu submenu + Inspector picker) reuses the exact `setArtboardStyle`/`setArtboardHug` id-prop-addressing pattern in `canvas-edit.ts`, with two new artboard-scoped writers (`setArtboardKind`, `setArtboardGuides`) and two new main-origin-only API routes. The Inspector's kind picker was implemented directly in `app.jsx` rather than first designed in a `Studio.tsx` canvas per the project's usual DDR-104 process — a deliberate scope trim for this session, using the existing `<select>`-with-options chrome pattern (matching the adjacent size-preset picker) rather than inventing new visual language.

## Consequences

**Positive:**
- Every existing canvas with no `kind` prop renders byte-identically (acceptance criterion, verified via `bun test`) — this is a strictly additive change.
- `feature-2-print-artboards` and `feature-3-web-artboards` have a stable `kind` union, an overlay mount point + registry (`registerKindOverlay`), and a guide-definition shape to build directly on, without re-deriving any of this.
- No DDR-115 runtime-state-taxonomy change was needed — `overlays` rides the already-ignored `_canvas-state/*.view.json` file.

**Negative / trade-offs:**
- The snap-guide-candidate primitive (T7) is unused in production until a follow-up wires the live artboard→world-line assembly and an intent-preset UI control. It is fully tested in isolation but provides no user-visible behavior change yet.
- The Inspector kind picker skipped the Studio.tsx-first design step DDR-104 normally requires for net-new Inspector knob UI — it reuses an existing control pattern (the size-preset `<select>`), so the risk is low, but it hasn't been through the signature-moment/design critic loop the way a from-scratch control would.
- `kind` and `guides` add two more props to `DCArtboard`'s already-large surface; `design-system-keeper.md` was updated to recognize both so they aren't flagged as unrecognized/reinvented attributes, and to treat cross-kind structural divergence (e.g. a print artboard's bleed chrome vs a digital prior's card shape) as expected rather than pattern-reinvention.

## Revisit when

- `feature-2-print-artboards` or `feature-3-web-artboards` need a guide-definition shape this plan didn't anticipate (e.g. a print-specific bleed unit that doesn't fit the generic columns/rows/grid vocabulary) — extend `GuideDefinitions`, don't fork it.
- The deferred T7 live-wiring (world-space guide-line assembly + intent-preset UI) is picked up — at that point, re-verify the "nearest wins across all sources" snap-math behavior still feels right once real guide lines are actually visible and snappable in the live canvas, not just in unit tests.
- A third consumer needs per-user, per-canvas visibility state beyond `overlays.guides` — the flat `OverlayVisibility` bag was designed for this (arbitrary boolean keys), but if it grows unwieldy, reconsider a namespaced shape.

## Linked
- Plan: `.ai/plans/feature-1-artboard-kinds-foundation.md`
- PRD: —
- Supersedes: —
