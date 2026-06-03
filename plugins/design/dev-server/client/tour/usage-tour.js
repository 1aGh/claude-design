// usage-tour.js — the evergreen "how the Maude UI works" walkthrough.
//
// Targets stable elements that exist at first load (no canvas open required):
// the sidebar, the empty viewport, the menus, the What's New badge, and Help.
// Steps whose target is missing are shown centered by the overlay, so this is
// resilient to chrome changes. Reached from Help → "Take the tour" and offered
// once on first run.

export const USAGE_TOUR = [
  {
    target: '.sidebar',
    title: 'Your canvases live here',
    body: 'Every mock in the project shows up in this tree. Click one to open it in a tab — or use “+ board” to spin up a blank brief-board, no command needed.',
  },
  {
    target: '.viewport',
    title: 'The canvas',
    body: 'Open a canvas, then ⌘-hover to preview the element under your cursor and ⌘-click to select it. Right-click for Copy CSS / Fit / Reset.',
  },
  {
    target: '.mb-menus',
    title: 'Menus & tools',
    body: 'View toggles panels (tree, comments, annotations); Selection and Tools act on the active canvas. Press ? for every shortcut.',
  },
  {
    target: "[data-tour='whatsnew']",
    title: 'What’s new',
    body: 'New features land here. Click the ✦ badge any time to catch up on what shipped.',
  },
  {
    target: "[data-tour='help']",
    title: 'Help is one key away',
    body: 'Press ? for the full keyboard cheat-sheet — and you can restart this tour from the Help menu whenever you like.',
  },
];
