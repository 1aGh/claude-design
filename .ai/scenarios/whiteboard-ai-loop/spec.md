# whiteboard-ai-loop

**Persona:** Claude, acting as a designer's collaborator on the whiteboard — reads a sketch with element-level context, then authors a labelled plan back onto the same board without hand-computing a single coordinate.

**Canvases under test:** any UI canvas with ≥2 artboards and real `data-cd-id` elements. Piloted against `.design/ui/OnboardingTour.tsx` (5 artboards, 76 elements after the geometry-manifest walk).

**Feature under test:** `feature-whiteboard-ai-toolkit` — the geometry manifest (`window.__maudeCanvasRects()` / `maude design canvas-rects`), element-aware `read-annotations --rects`, and `annotate --pin`/`--near`/`--board` (template engine). This is a **CLI + headless-browser** capability, not an interactive UI feature — there is no new on-screen control; the "UI" being verified is the pre-existing rendered annotation layer (`.dc-annot-svg`) receiving programmatically-authored strokes through the same serializer/sanitizer the interactive pen/sticky tools already use.

**Hypothesis:**
- `canvas-rects` returns finite world-coordinate rects for every artboard and every meaningful element (leaf `[data-cd-id]` nodes, interactive tags, or role=button/tabindex), scoped+indexed selectors that resolve uniquely.
- `read-annotations --rects` resolves `element: {cdId, tag, text, ...}` for a note whose bbox overlaps a real element, upgrades the W3C `target.selector` from `AnnotationIdSelector` to `CssSelector`, and correctly returns `element: null` for a note that doesn't overlap anything (e.g. one just placed *beside* an element via `--pin`, which is deliberately non-overlapping).
- `annotate --pin <cdId>` places a sticky beside the resolved element with a default pointer arrow; `--board <preset>` lays out a multi-section template (e.g. a 3-column retro) as a single batched write.
- Every AI-authored stroke renders identically to a human-drawn one (same serializer) and is visible in a full-canvas screenshot with no layout corruption of the pre-existing artboards.

## Platform matrix

| Platform | Viewport | Required |
| --- | --- | --- |
| web-desktop | fit-all zoom (design canvas is desktop-first) | ✓ |

Native iOS/Android + web-mobile intentionally **skipped** — per the plan's own "Scenario Coverage (UI-adjacent)" section: the design dev-server + annotation authoring is a desktop tool with no native/mobile-responsive counterpart (same rationale already established by `canvas-annotations-figjam`). This is not a partial-parity gap; there is no mobile/native surface to cover.

## Preconditions

- A **freshly rebuilt local binary** reflecting current source — `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release --target=bun-darwin-arm64`, then run `dist/maude-darwin-arm64 --root <repo>` directly. **Do not** use a globally npm-installed `maude` for this scenario while the feature is uncommitted/unreleased — it will silently run the OLD binary (no `canvas-rects` verb, no `__maudeCanvasRects` hook) and every step below will fail in a way that looks like a missing dependency, not a code bug.
- Target canvas has no pre-existing `<slug>.annotations.svg` (or the scenario accepts additive strokes on top of it).
- `<designRoot>/<slug>.annotations.svg` is scratch output of this scenario — gitignored per DDR-115, but if the target repo is dogfooding itself (this repo), delete the file after the run so a pilot doesn't leave scratch board content in the tree.

## Steps

1. **Geometry manifest.** `maude design canvas-rects "<rel-path>" --root "$REPO"` (or `apps/studio/bin/canvas-rects.sh` directly against the local build). Assert: `.artboards` has ≥2 entries, all `x,y,w,h` finite; `.elements` has ≥1 entry with non-null `cdId`; `elementsTruncated` is `false` (or documented if the fixture is large enough to hit the 400-element cap).
2. **Baseline read.** `read-annotations "<rel-path>" --rects <manifest>` on a canvas with no annotations yet → `[]`.
3. **Element-aware pin.** `annotate --pin <cdId> --ops <sticky op>` on a known small element. Screenshot (`step-2-pinned-note`). Assert the sticky + pointer arrow render, positioned beside (not on top of) the target element.
4. **Element-aware read (overlap case).** Author a second sticky whose explicit `x/y/w/h` bbox *does* overlap a different known element (simulating a human circling something and writing a note there) — `annotate --ops` with explicit geometry, no `--pin`. Then `read-annotations --rects` and assert the returned `element.cdId`/`tag`/`text` match the target, and `target.selector.type === "CssSelector"` (upgraded from `AnnotationIdSelector`).
5. **Template authoring.** `annotate --near <artboardId> --board <retro-preset.json>` (3-column retro: "What went well" / "What to improve" / "Action items", 2 pre-seeded cards). Assert the `created` count matches sections+cards. Screenshot (`step-3-retro-board`).
6. **Full-canvas reality check.** `screenshot --full` at fit-all zoom. Read the PNG: confirm no artboard content is obscured/corrupted, all authored strokes are visible, text is legible.
7. **Enumerate rendered strokes.** `agent-browser eval` a `document.querySelectorAll('[data-tool]')` walk → assert the tool/text list matches exactly what was authored (no dropped or duplicated strokes).
8. **Cleanup.** Delete the scratch `.annotations.svg` (dogfooding repo only — a real user's project keeps it).

## Acceptance

- All 8 steps pass on web-desktop.
- No console errors in the dev-server log during any step.
- `element: null` only occurs for genuinely non-overlapping notes (step 3's pinned sticky) — never for a note that visually sits on an element (step 4).
- Screenshot shows every authored stroke rendered, non-overlapping with itself, readable.

## Known finding (not a blocker — see report follow-ups)

`--near`/`--board` placement is **absolute relative to the target artboard's world position** and does not check whether an adjacent artboard already occupies that space in a tightly-packed default grid. In the piloted run, a retro board placed `--near "infographic"` (the leftmost artboard) visually overlapped the top edge of the *next* artboard ("save") because the default grid packs artboards with a fixed small gutter. Cosmetic only (the board is still fully legible and every stroke is individually correct) but worth a follow-up: either widen the default gutter when annotations are expected, or have `--near`/`--board` probe the manifest for the nearest genuinely-empty world region.
