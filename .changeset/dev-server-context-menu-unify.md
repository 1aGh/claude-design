---
"@1agh/maude": patch
---

Dev-server floating chrome: unify menubar / statusbar / tool-palette / annotations toolbar onto the `mb-dropdown` brand stamp and block the native context menu over canvas surfaces.

- Right-click on canvas / iframe / floating chrome now always opens `.dc-context-menu` instead of the browser's native menu (which was leaking on top of, or instead of, our menu).
- Inputs, textareas, and `contentEditable` elements keep the native context menu so copy / paste still works.
- Visual: floating chrome surfaces share the same SKU-stamped dropdown skin (`annotations-context-toolbar`, `annotations-layer`, `canvas-lib`, `context-menu`, `tool-palette`, `inspect.ts`, `server.mjs`).
