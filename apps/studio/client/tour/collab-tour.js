// collab-tour.js — the version-control "rychlý kurz" (Phase 29, epic E4).
//
// Teaches the two-layer collab model on the EXISTING tour engine (overlay.jsx) —
// never a fork. Per the teaching-model DDR (this phase REVERSES the "hide the
// duality" recommendation in collab-model-design.md § Part 2): we surface a visible
// three-verb action-cycle and teach the live-vs-async split honestly, because the
// cycle has to match real buttons in the app and pure-hiding is leaky.
//
// Step 1 is a centered, target-less step whose graphic is the two-layer infographic
// (the engine already centers target-less steps; the `render` field is the only
// addition). Steps 2-4 spotlight the real action controls via stable [data-tour]
// anchors (save-local / publish / pull) — `changes: true` opens the Changes panel
// first so the buttons exist. Step 5 points at the live presence layer; step 6 is
// the one honest hard thing, centered.
//
// Vocabulary is the canonical set ONLY (teaching-model table) — no raw git terms:
//   Save changes locally · Publish for everyone · Pull changes · Draft · Shared version.

import CollabModelInfographic from '../panels/CollabModelInfographic.jsx';

export const COLLAB_TOUR = [
  {
    // Centered, no target — the engine renders target-less steps centered, and the
    // `render` field draws the infographic above the copy.
    render: CollabModelInfographic,
    title: 'Working together, in one picture',
    body: 'There are two layers. Up top, being together just happens. Below, your work moves through three simple steps. Let’s walk them.',
  },
  {
    target: "[data-tour='save-local']",
    changes: true,
    title: 'Save changes locally',
    body: 'When something looks right, save it. That keeps a version on your computer you can always come back to — like a checkpoint, just for you.',
    placement: 'left',
  },
  {
    target: "[data-tour='publish']",
    changes: true,
    title: 'Publish for everyone',
    body: 'Ready to share? Publish sends your saved work to the whole team. Think of it as putting your version on the shared shelf.',
    placement: 'left',
  },
  {
    target: "[data-tour='pull']",
    changes: true,
    title: 'Pull changes',
    body: 'When teammates publish, Pull brings their work onto your computer so you’re both looking at the same thing.',
    placement: 'left',
  },
  {
    target: "[data-tour='status']",
    title: 'Being together is automatic',
    body: 'Cursors, who’s here, and comments need no buttons at all. When you’re both in a canvas, you see each other live — that’s the top layer, always on.',
    placement: 'bottom',
  },
  {
    // Centered — the one honest hard thing.
    title: 'The one thing worth knowing',
    body: 'When you’re here together, publishing already covers your teammate — they’ve seen it live, so Publish is just dropping a bookmark. Only when you work apart can two versions drift. If that happens, Maude shows you both and lets you pick — keep mine, keep theirs, or keep both. Never a confusing merge.',
  },
];
