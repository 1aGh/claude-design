---
"@1agh/maude": minor
---

Artboards can now declare what they are — Digital, Print, Web, or Video — from the Inspector's Kind picker or the right-click context menu, and get their own chrome (a small icon + tint in the label strip). Video kind is inferred automatically for existing canvases with a `<VideoComp>`, so nothing needs to be migrated. Also adds a generic layout-guides primitive (columns/rows/grid, Figma-style) with a new `ArtboardGuidesOverlay` render layer and a per-user, per-canvas visibility lane — the guides toolbar and snap-to-guide UI land in a follow-up release. This is the foundation layer for upcoming print- and web-specific artboard tooling.
