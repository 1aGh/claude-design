---
"@1agh/maude": minor
---

Make the video-comp Timeline a genuinely manual, iMovie-simple editor.

The bottom Timeline panel gains direct-manipulation editing on top of the
existing scrub/preview surface — every gesture is a named AST op on the comp
TSX (the single source of truth), addressed by stableId + content-hash with
ripple and undo, and reachable headlessly through the same `/_api/clip-edit`
door that `/design:edit` uses.

- **Manual cut vocabulary** — split, in-point trim, speed, crop, colour grade,
  per-clip audio (mute / volume / detach), and transitions (add / edit / remove
  via the seam chips), each a parametric verb.
- **Three-band iMovie layout** for media cuts (overlay lanes · one storyline ·
  audio), with magnetic drag-reorder and drop-to-new-layer. A purely digital
  comp (every beat a hand-authored JSX scene) keeps the stacked
  row-per-sequence projection with layer expansion.
- **Layers you can rearrange** — drag a clip between the storyline and its own
  overlay layer, and reorder overlay layers vertically (`layer-order` verb;
  document order = paint order).
- **AI placeholder clips** — drop a slate that occupies real timeline space with
  an inline-editable prompt, then resolve it into generated media in place (the
  clip's identity survives).
- **In-place text** — Title overlays and AI-slate prompts are editable directly
  in the artboard (double-click), not through a modal.
- **Frame-anchored comments** — a Timeline comment tool (press `C`, click) pins
  feedback to an exact frame + clip + lane, surfaced as first-class agent
  context via `/_comments`.

Real per-clip visuals (filmstrips for video, the still itself for images,
waveforms for audio) render behind the blocks, and long comps get an
export-tier notice.

Also: debug/`tauri dev` desktop builds no longer auto-update in the background —
the silent updater was replacing a dev build with the released version
mid-dogfood.
