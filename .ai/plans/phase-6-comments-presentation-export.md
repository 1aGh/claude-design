# Phase 6: Comments UX + presentation mode

> **Export extracted 2026-05-19** to [`phase-6.5-export.md`](./phase-6.5-export.md). Export grew its own scope ladder (selection/artboard/canvas/project-raw), added SVG + raw-source ZIP formats, and gained a first-class UI dialog — too big to share a plan with comments + presentation.

## Description

Add Figma-grade collaboration affordances to the canvas: **pin-comments** anchored to specific elements with threading / resolve / @mentions / `.design/_comments/<slug>.json` persistence, and a **presentation mode** that runs canvases full-screen as a slideshow for stakeholder review. Both deliverables share the Phase 4 canvas v2 substrate and can land in parallel with Phases 5, 6.5, and 7.

## User Story

As a designer reviewing a canvas, I want to drop a pin-comment on a button, @mention the dev, and resolve the thread once they fix it so that we don't switch to Slack mid-review. And as a PO, I want presentation mode that walks stakeholders through 6 canvases full-screen so that we don't need a separate Loom recording.

## Problem

- No way to annotate "this button needs more padding" without typing it into Slack outside the canvas tool.
- Stakeholder reviews require a screen-share + driving Cmd+Tab between artboards — distracting and amateur-feeling.

## Solution

**A. Comments UX.** A new comment layer sits in front of the iframe but behind the draw layer. Click "comment mode" in toolbar (or `C` shortcut), click anywhere on the canvas to drop a pin, type a message. Pins anchor to either an element (cssPath + bounds-relative offset) or world coords. Threading via reply box on each pin. Resolve / unresolve toggles visibility. @mention parses git committer list from `.design/_collaborators.json` (added in Phase 8) or falls back to a free-text mention. Persisted as `.design/_comments/<canvas-slug>.json`.

**B. Presentation mode.** `P` shortcut or toolbar button enters full-screen. Arrow keys advance canvas-by-canvas in the order defined by `.design/_presentation.json` (defaults to alphabetical). `Esc` exits. Hide layers / inspector / draw layer; keep comments toggleable (default off). Auto-zoom to fit each artboard.

## Metadata

- **Type:** New Feature
- **Complexity:** Medium
- **Depends on:** Phase 4
- **Parallel with:** Phase 5, Phase 6.5
- **Affected files:**
  - `plugins/design/dev-server/client/panels/CommentsLayer.tsx` (new)
  - `plugins/design/dev-server/client/panels/CommentThread.tsx` (new)
  - `plugins/design/dev-server/client/modes/PresentationMode.tsx` (new)
  - `plugins/design/dev-server/server.mjs` (new endpoints: `GET/PUT /api/comments/<slug>`, `GET/PUT /api/presentation`)
  - `plugins/design/commands/presentation.md` (new — toggles presentation mode)
  - `.design/_comments/.gitkeep` (new — comments dir scaffolded)

---

## Tasks

### Task 1: Comments data model

- **Do:** Define JSON schema for `_comments/<slug>.json`:
  ```json
  {
    "comments": [{
      "id": "uuid", "author": "<git-name>", "createdAt": "<iso>",
      "anchor": { "type": "element" | "world", "cssPath": "...", "offset": [0,0] } | { "x": 0, "y": 0 },
      "body": "...", "mentions": ["@alice"],
      "resolved": false, "thread": [{ "id", "author", "body", "createdAt" }]
    }]
  }
  ```
- **Validate:** Schema validates a hand-authored sample; reading/writing round-trips.

### Task 2: Comments UI layer

- **Do:** Toolbar pencil-pin icon enters comment mode; cursor becomes crosshair; click drops a pin (initially empty). Pin = small circle with avatar / initial. Click pin opens thread panel. Threads support nested replies but only one level (no tree).
- **Pattern:** FigJam's pin model. Keep it minimal.
- **Validate:** Drop a comment, reload, comment still there at the same anchor.

### Task 3: @mention parsing

- **Do:** As user types `@`, popup shows git committer names from `git shortlog -sne | head -20`. Selected mention stored in `mentions[]` array.
- **Validate:** `@` autocompletes; mentions render bold; resolvable to git identity.

### Task 4: Presentation mode

- **Do:** Full-screen `<dialog>` covering viewport; canvas v2 used in "kiosk" config (no panels, no toolbar, just artboard + nav arrows + canvas counter). `.design/_presentation.json` stores order; default alphabetical. Arrow keys advance; `Esc` exits.
- **Validate:** Enter with `P`, advance through 5 canvases, exit cleanly. No layout reflow on enter/exit.

---

## Validation

1. **Functional:** Comments persist + thread + resolve + @mention; presentation mode enter/exit clean.
2. **Cross-platform scenario:** `comment-thread-resolve` on web-desktop (mobile out of scope).
3. **A11y:** Comment thread panel keyboard-navigable; @ autocomplete reachable via Tab.
4. **Design system:** Comment pins use this project's color tokens — not raw `#FF0000`.

## Scenario coverage

| Scenario | Covers user flow | Status |
|----------|------------------|--------|
| `comment-thread-resolve` | Open canvas → comment mode → drop pin → reply → @mention → resolve → reload → resolved comment hidden by default | new |
| `presentation-walkthrough` | Enter present mode → advance 5 canvases via arrow keys → exit → toolbar/panels restored | new |

---

## Acceptance criteria

- [ ] Comments persist, thread, resolve, mention.
- [ ] Presentation mode works keyboard-only.
- [ ] Both scenarios pass.
