---
"@1agh/maude": minor
---

Phase 6.5 — Canvas export (UI-first, multi-format, scope-aware). One export dialog covers seven formats × four scopes from the canvas UI plus a matching CLI subcommand.

What ships:

- **`/design:export` slash command** and **`maude design export`** CLI subcommand — same flag surface (`--format`, `--scope`, `--out`).
- **In-canvas Export dialog** (`plugins/design/dev-server/export-dialog.tsx`) wired into canvas-shell and the floating chrome.
- **Seven formats**: PNG, PDF, SVG, HTML (self-contained), PPTX, Canva (handoff PPTX + MCP-ready prompt file per [feedback-mcp-prompt-over-oauth-scaffolding](../memory/feedback-mcp-prompt-over-oauth-scaffolding.md)), ZIP bundle.
- **Four scopes**: active artboard, active screen, active canvas, all canvases in current DS.
- **Exporter pipeline** under `plugins/design/dev-server/exporters/` — playwright-driven PNG/PDF/SVG/HTML/PPTX renderers + scope resolver + browser-bundle reuse + history recorder.
- **Server API** `POST /export` on the dev-server (`http.ts` + `api.ts`) with history persisted under `<designRoot>/_history/_exports/`.
- **DDRs**: DDR-038 SVG via foreignObject, DDR-039 PPTX via pptxgenjs (superseded), DDR-040 Canva via PPTX + MCP prompt, DDR-041 v2 mature-libraries world reset.
- **Tests**: 7 bun:test suites under `plugins/design/dev-server/test/exporters/` covering scope resolution, endpoint contract, history, Canva handoff, PPTX render. 334/334 green.

User-visible: new commands, new dev-server dialog, new on-disk artifacts under `_history/_exports/`. No breaking changes to existing canvas / dev-server APIs.
