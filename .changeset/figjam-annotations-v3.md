---
"@1agh/maude": minor
---

Canvas annotations — FigJam-parity v3 + bidirectional AI loop (DDR-100)

The strokes layer grows from "draw and move" to a full diagramming surface, and becomes machine-readable/writable for AI tooling.

- **Multi-select that works** — marquee/hull drag moves the whole selection (root-cause fix: a stale ref broke every `contains()` path since Phase 5.1), ⌘G/⌘⇧G groups (Excalidraw tag-array model), ⌘D + Alt-drag duplicate, OS-clipboard copy/paste, z-order `[` `]`, align/distribute cluster, edge/center snapping with smart guides.
- **Shapes, properly** — rotation via corner hover zones (relative to grab, magnetic cardinals, Shift 15°), n/e/s/w edge resize, dimension-match quotas against neighbours with a live W×H label, anchored text in every closed shape (rect/ellipse/diamond/triangle), a toolbar shape-kind switcher that converts in place (id-preserving — text + binds follow), screen-constant selection chrome offset, one undo record per gesture, and anchor-fixed resize on rotated objects.
- **Connectors** — connection dots on selected shapes draw bound arrows; non-pinned ends auto re-route to face the target; bound curves exit perpendicular to the host side (cubic exit-normals) with sleeker heads. Legacy unbound arrows stay byte-identical.
- **Section tool** (⇧S) — named region frames that carry their content when dragged.
- **AI loop** — `maude design annotate` writes sticky/text/shape/arrow/section ops or whole auto-laid-out flow diagrams (`--flow`) through the live server; `read-annotations` v2 returns z/groups/author/binds + `--graph` nodes/edges with W3C-style artboard anchoring. AI-authored strokes carry `data-author="ai"`.
- Right-click selects + opens an annotation context menu (single menu — the shell canvas menu yields); section/sticky/shape editors share the edit-mode text toolbar.
