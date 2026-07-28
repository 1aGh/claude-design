# DDR-018: Tree groups via `kind` discriminator — server scans PROJECT root + RUNTIME gitignored alongside canvases

- **Date:** 2026-05-17
- **Status:** Accepted
- **Tags:** design, dev-server, sidebar, server, file-tree, phase-3.5
- **Related:** [`.ai/plans/phase-3.5-dev-server-ui-ux-refresh.md`](../plans/phase-3.5-dev-server-ui-ux-refresh.md), [DDR-017](./DDR-017-dev-server-shell-menubar-single-canvas.md) (the sidebar / menubar refactor that surfaced this gap), `plugins/design/dev-server/api.ts:buildIndexData`, `plugins/design/dev-server/client/app.jsx:Sidebar` (SECTION_META + sectionMetaFor)

## Context

The CV-08 mock's file tree has four sections — `PROJECT`, `DESIGN SYSTEM ·` (with `MDCC-DSN/01` pill), `UI CANVASES`, `RUNTIME · GITIGNORED`. The dev-server's `_index-data` endpoint historically only listed HTML files under the configured `canvasGroups` (`Design system` + `UI kit`). PROJECT root files (`README.md`, `INDEX.md`, `config.json`) and RUNTIME state (`_active.json`, `_server.json`, `_history/`, `_comments/`) were absent — so the sidebar showed two sections instead of four, and the chrome read as "incomplete tree" against the mock.

Two orthogonal questions:

1. **Where do PROJECT/RUNTIME files come from?** They're not in any `canvasGroups` config entry; they're structural under `.design/` itself.
2. **Are non-HTML files openable?** No — clicking `README.md` shouldn't mount it as an iframe canvas. But it should appear in the tree as a navigational anchor.

## Decision

Synthesize PROJECT and RUNTIME groups server-side in `buildIndexData`, mark each group with a new `kind` discriminator, and have the client render per-kind styling and click behavior.

### Schema

`_index-data` group shape gains `kind: 'project' | 'canvas' | 'runtime'`:

```ts
groups: [
  { label: 'Project',       kind: 'project', paths: ['.design/config.json', ...], stripPrefix: '' },
  { label: 'Design system', kind: 'canvas',  paths: [...],                        stripPrefix: '.design/' },
  { label: 'UI kit',        kind: 'canvas',  paths: [...],                        stripPrefix: '.design/' },
  { label: 'Runtime',       kind: 'runtime', paths: ['.design/_active.json', ...], stripPrefix: '' },
]
```

### Server-side rules

- **PROJECT scan** — top-level entries of `.design/` matching `.md|.json|.txt|.yml|.yaml|.css` (excluding `_`-prefixed and `.`-prefixed). Synthesized first so it appears at the top of the tree.
- **Canvas groups** — unchanged from prior contract; `findHtmlFiles` still does the HTML walk. **Exception:** if `g.label === 'Design system'` OR `g.path` starts with `system`, scan with `['.html', '.md', '.css', '.json']` via `findFiles` instead — the mock's DS section shows `README.md`, `SKILL.md`, `colors_and_type.css` alongside preview HTMLs.
- **RUNTIME scan** — `_`-prefixed entries at `.design/` root (files and dirs). Always inert client-side.
- **`stripPrefix` ladder** — PROJECT and RUNTIME use `''` (keep `.design/` so the tree renders `▾ .design` as the parent dir wrapper, matching the mock); canvas groups use `.design/` (so `▾ system` or `▾ ui` shows up as the dir wrapper).

### Client-side rules

- `SECTION_META[kind]` maps `project / ds / canvas / runtime` to display title + pill source (`'MDCC-DSN/01'` for DS, count for canvas/runtime, none for project).
- `FileRow` checks `/\.html?$/i.test(file.name)` — non-HTML rows render with `aria-disabled="true"` + no-op click + `title="(file index only)"`.
- Runtime kind adds `.tp-row.muted` class (fg-3 ink ladder) to visually demote gitignored entries.
- Inside `<Tree>`, files at a level render **before** subdirs (mock convention) — lets `system/project/README.md` show above `system/project/preview/…`.

## Consequences

### Good

- Tree structurally matches CV-08 — four sections with SKU pills, expandable depths, files-first ordering inside dirs.
- New `kind` field is opt-in; existing client code that ignores it still works.
- DS-only extension to non-HTML scan is scoped narrowly — no risk of `.md` files appearing in `UI kit` tree (rare, but possible if a user drops a README into their `.design/ui/`).
- RUNTIME section makes hidden state discoverable (`_active.json` is real, ungitignored-but-gitignored — useful for designers to know it exists). Muted treatment signals "look, don't touch via UI".

### Trade-offs

- Server walks `.design/` twice (once for PROJECT, once for RUNTIME). The walks are tiny — 20-ish entries at root — but if a future repo dumps thousands of files there, it could matter. Defer optimization until measured.
- The `'Design system'` label test in the canvas-group loop is fragile — relies on the project's `canvasGroups[].label` field. If a project renames it, the non-HTML scan won't kick in. Acceptable for now (the `project` design system is the convention in md-claude itself); if other projects diverge, promote `extensions: string[]` to `canvasGroups` config.

### Subtle data-shape choice

`SECTION_META.ds` (the design-system pill) hardcodes `'MDCC-DSN/01'`. That's the dev-server's own DS code; for downstream projects it should come from `.design/config.json` or `_index-data`. Recorded as a TODO: read the DS code from project config and pass through `_index-data`. Until then the pill is correct for this repo and obviously wrong for any other — visible inaccuracy that's its own forcing function.

## Alternatives considered

- **Client-side synthesis of PROJECT/RUNTIME.** Tempting (no server change) — but the client doesn't know what files exist under `.design/`; would need a new `_fs-data` endpoint anyway. Server-side is the same work in the right place.
- **One unified `groups[]` with no discriminator** — client infers `runtime` from label prefix `_` or path. Rejected — string sniffing is brittle; explicit `kind` is two extra characters per group.
- **Drop PROJECT/RUNTIME entirely; trim the mock to two sections.** Rejected by the user — the four-section structure is part of CV-08's information-architecture spine, not decoration.

## Migration notes

- Existing downstream projects that consume `_index-data` ignore unknown fields; adding `kind` is non-breaking.
- The `SECTION_META.ds` hardcoded DS code is the obvious next-fix when md-claude's dev-server is used outside of this repo.
- If Phase 4+ adds `_history/<slug>/` browseability (currently a flat dir entry under RUNTIME), the runtime walk extends — same shape, more rows.
