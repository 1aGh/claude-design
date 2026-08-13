---
'@1agh/maude': patch
---

Design-system files open in the cloud file browser again.

Clicking a logo, a font or a photograph in a cloud project showed a broken
image, even though the same files rendered perfectly inside canvases. The cloud
only ever forwarded a fixed list of addresses to the project, and nobody had put
design-system files on it — so the file browser was asking for something the
cloud answered "not found" to without ever looking. It now serves exactly the
files the desktop is allowed to upload: pictures, fonts and media inside an
`assets` folder, read-only, with everything else — canvas source, project
settings, and per-person working state — still invisible.
