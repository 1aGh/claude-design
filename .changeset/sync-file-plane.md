---
'@1agh/maude': patch
---

Linking a fresh folder to a cloud project can now bring the WHOLE project —
canvases and the design system that makes them render.

Sync's unit was a canvas, so a file only ever travelled if a canvas claimed it
by name. Everything else — the design system's fonts and logos, its stylesheets,
the token files, the docs — had no lane. Linking a brand-new folder to a project
delivered every canvas and none of that, so the canvases arrived visibly broken:
error banners on some, unstyled on the rest, no logos, no fonts.

The fix is one rule instead of a lane per file kind: what's in the folder syncs.
A single shared classifier decides membership positively — images, fonts, video,
stylesheets, docs flow freely; a project's own config and per-machine runtime
state never travel; code files travel only from a project you own. The receiver
re-checks every file against its own project before writing it, so the mechanism
is a manifest and a content hash, never "trust the folder on the other end".

This ships behind a switch (`linkedHub.syncFiles`), off for now while it soaks;
today's asset sync is unchanged when it's off.
