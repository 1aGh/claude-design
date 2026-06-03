---
"@1agh/maude": minor
---

Annotation brief-boards + create-from-browser (Phase 22)

- **Brief boards** — `/design:new --blank "<name>"` creates an annotation-only canvas (`kind: "brief-board"`, zero model cost). Annotate it with sticky notes / text / arrows, then run `/design:new` again to have Claude read the notes **verbatim** and insert matching artboards into the same canvas (ingest mode). Escape hatches: `--from-annotations` / `--fresh`; identical-annotations re-ingest short-circuits.
- **Create a blank board from the browser** — a "+ board" control in the dev-server file tree (`POST /_api/canvas`, main-origin-only per DDR-054) stamps out a brief board without a slash command and opens it active.
- **`maude design read-annotations`** — a zero-dep headless reader that turns a canvas's `<slug>.annotations.svg` into structured JSON (the ingest brief source).
- Canvas `.meta.json` gains an additive `kind` field (default `"canvas"`). See DDR-085. Ingest treats annotation text as untrusted, data-framed content (indirect-prompt-injection mitigation).
