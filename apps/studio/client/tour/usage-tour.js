// usage-tour.js — the evergreen "how the Maude UI works" walkthrough.
//
// Targets stable [data-tour] anchors (redesign-proof — styling classes get
// renamed, these don't) on elements that exist at first load: the sidebar, the
// viewport, the menus, the Inspector, the What's New badge, and Help. The
// Inspector step carries `inspector: true` so the engine opens the panel before
// spotlighting it. Steps whose target is missing are shown centered by the
// overlay, so this stays resilient to chrome changes. Reached from Help →
// "Take the tour" and offered once on first run.

export const USAGE_TOUR = [
  {
    target: "[data-tour='sidebar']",
    title: 'Your canvases live here',
    body: 'Every mock in the project shows up in this tree. Click one to open it in a tab — or use “+ board” to spin up a blank brief-board, no command needed.',
    placement: 'right',
  },
  {
    target: "[data-tour='viewport']",
    title: 'The canvas',
    body: 'Open a canvas, then ⌘-hover to preview the element under your cursor and ⌘-click to select it. Right-click for Copy CSS / Fit / Reset.',
  },
  {
    target: "[data-tour='menus']",
    title: 'Menus & tools',
    body: 'View toggles panels (tree, comments, Inspector); Selection and Tools act on the active canvas. Press ? for every shortcut.',
    placement: 'bottom',
  },
  {
    target: "[data-tour='inspector']",
    inspector: true,
    title: 'The Inspector',
    body: 'Opened from View → Inspector (or press I). Inspect · Layers · CSS — ⌘-click any element and edit its CSS against your design tokens, right here. No AI round-trip.',
    placement: 'left',
  },
  {
    target: "[data-tour='whatsnew']",
    title: 'What’s new',
    body: 'New features land here. Click the ✦ badge any time to catch up on what shipped — some entries come with a guided tour like this one.',
    placement: 'bottom',
  },
  {
    target: "[data-tour='help']",
    title: 'Help is one key away',
    body: 'Press ? for the full keyboard cheat-sheet — and you can restart this tour from the Help menu whenever you like.',
    placement: 'bottom',
  },
];
