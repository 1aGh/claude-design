---
'@1agh/md-claude': minor
---

**Phase 3.5 — dev-server shell refresh: shadcn-style menubar + CV-08 tree-panel + Help modal + paper-grid viewport.**

The `mdcc design serve` chrome is rebuilt against the `project` DS (MDCC-DSN/01) mocks in `.design/ui/Canvas Viewport.html`. The action-button header (`tree · active · comments · open`) is replaced by a 30 px top **menubar** (`■ MDCC · File · Edit · View · Selection · Tools · Help · CV-stamp · file · N ARTBOARDS · ZOOM 100% · project SKU`) per CV-01/CV-08 spec — see [DDR-017](../.ai/decisions/DDR-017-dev-server-shell-menubar-single-canvas.md). The tabs row is gone — the dev-server is single-canvas; opening a file in the tree replaces the active one. The left sidebar becomes a four-section CV-08 tree (`PROJECT / DESIGN SYSTEM · / UI CANVASES / RUNTIME · GITIGNORED`) backed by a new `kind` discriminator in `_index-data` — see [DDR-018](../.ai/decisions/DDR-018-tree-groups-via-kind-discriminator.md).

**Visual surfaces (CV-01 / CV-02 static lift)**

- **Paper-grid viewport bg** — 24 px ink hairline grid on `--u-bg-1`; visible in empty state, covered by iframe once a canvas mounts.
- **Wordmark watermark** — `mdcc-design-server` 40 px display + `CANVAS · MD-CLAUDE / v{version} / localhost:{port}` SKU sub-line; mounted in the empty state. Version baked at build time via a new `__MDCC_VERSION__` Bun `define`.
- **Selection halo** — accent 2 px outline + 4 corner ticks around the active iframe when an element is selected (CV-02 lift).

**Menubar + dropdown**

- **View dropdown** (T): `Project Tree (T)`, `Comments Sidebar (⌘⇧M)`, `Design system view (S)` all toggleable; `Layers Panel`, `Inspector`, `Annotations`, `Presentation Mode`, `Zoom In/Out/Fit/Actual Size` rendered with `Phase N` tags (inert until those phases land).
- **Help menu** opens `<HelpModal>` — modal containing the cheatsheet that used to live in the sidebar (Element selection · Tabs & canvas · Slash commands · Opt-out scope · Auto-critic loop · Pin-to-element flow · Comments). Esc / backdrop / × close. Triggered by `?` or `F1` too.
- **State stamp** in `.mb-status`: cv-stamp (`IDLE / CANVAS / SYSTEM`) + file path + `● N ARTBOARDS · ZOOM 100% · MD-CLAUDE`.

**Sidebar (CV-08)**

- New `<Sidebar>` reads `kind`-tagged groups: PROJECT (`▾ .design` root files), DESIGN SYSTEM · (`MDCC-DSN/01` pill, `▾ system/project` with `README.md`, `SKILL.md`, `colors_and_type.css`, `▾ preview` with HTMLs), UI CANVASES (count pill, `▾ ui`), RUNTIME · GITIGNORED (count pill, muted treatment).
- DS section header is **clickable** — opens the system view. (Replaces the dropped promoted "Design system view" row.)
- Files-first ordering inside dirs (mock convention).
- Non-HTML rows are inert (`aria-disabled="true"`, no-op click).

**Keyboard surface**

- `T` toggles sidebar visibility (visibility-hidden, state preserved).
- `S` toggles SYSTEM view.
- `⌘F` focuses search (re-opens sidebar if hidden).
- `⌘⇧M` toggles comments rsidebar.
- `?` / `F1` opens Help modal.
- `Esc` closes modal / composer / focused pin.

**Fixes**

- **Body-grows scrollbar bug** — long selected-element selectors in the statusbar no longer push the grid wider than viewport. Root cause: `.app { grid-template-columns: 320px 1fr }` defaults to `minmax(auto, 1fr)`, so an unbreakable selector string expanded the track. Fix: `minmax(0, 1fr)` + `min-width: 0; overflow: hidden` on `.app` + `.statusbar`.
- **View dropdown clipped** — earlier `.mb { overflow: hidden }` (added to clamp menubar status) clipped the dropdown (`position: absolute; top: 30px`). Removed; right-side clamp stays on `.mb-status` alone.

**Server (`api.ts`)**

- `buildIndexData` synthesizes PROJECT (`.md`/`.json`/`.txt`/`.yml`/`.yaml`/`.css` at `.design/` root) and RUNTIME (`_*` entries at root) groups in addition to the existing canvas groups.
- DS canvas group widens its scan to `['.html', '.md', '.css', '.json']` so `README.md` / `SKILL.md` / `colors_and_type.css` appear alongside preview HTMLs.

No `mdcc` CLI surface change. Phase 4 (Pixi canvas v2) lands on this refreshed shell.
