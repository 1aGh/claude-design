---
"@1agh/maude": patch
---

Changes panel: panning/zooming a canvas no longer creates a change, and changes are now grouped by canvas (DDR-115).

- **Pan/zoom is no longer a "change."** A canvas's camera (pan/zoom) was stored in its versioned `.meta.json` and rewritten on every mouse move, so it churned the Changes panel and would commit on every pan. The camera now lives in a per-machine, gitignored file — the Changes panel reflects your actual work (artboard moves, layout, annotations, specimens, design-system edits), not your mouse.
- **Changes are grouped by canvas.** Instead of a flat M/A/D/U list, each canvas shows as one entry with its supporting files (Layout & settings, Annotations) collapsed underneath, under a Canvases / Other files split. One checkbox saves a canvas and its supporting files as a unit.
- **Annotations are now versioned** (they travel with the project and show in the Changes panel); comments stay live-synced over the hub.
- One canonical runtime-state taxonomy: what's hidden from the Changes panel, what git ignores, and what `maude init` scaffolds now agree.

Security (`/flow:done` review): the untrusted-origin canvas-meta write lanes are now gated on the canvas existing (no arbitrary-slug file minting).
