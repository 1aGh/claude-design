---
"@1agh/maude": minor
---

Annotation brief-boards + create-from-browser (Phase 22)

- **Brief boards** — `/design:new --blank "<name>"` creates an annotation-only canvas (`kind: "brief-board"`, zero model cost). Annotate it with sticky notes / text / arrows, then run `/design:new` again to have Claude read the notes **verbatim** and insert matching artboards into the same canvas (ingest mode). Escape hatches: `--from-annotations` / `--fresh`; identical-annotations re-ingest short-circuits.
- **Create + delete canvases from the browser** — a "+ board" control in the dev-server file-tree header (`POST /_api/canvas`, main-origin-only per DDR-054) stamps out a brief board without a slash command and opens it active; a hover trash button on each canvas row soft-deletes it (`DELETE /_api/canvas`) — the whole sidecar set moves to `.design/_trash/` (recoverable), with a confirm prompt and active-tab reset. Both endpoints are gated by path-containment + a non-DS canvas-group allowlist; the design system + config files can't be deleted.
- **`maude design read-annotations`** — a zero-dep headless reader that turns a canvas's `<slug>.annotations.svg` into structured JSON (the ingest brief source).
- Canvas `.meta.json` gains an additive `kind` field (default `"canvas"`). See DDR-085. Ingest treats annotation text as untrusted, data-framed content (indirect-prompt-injection mitigation).
