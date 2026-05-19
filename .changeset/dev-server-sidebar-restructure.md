---
"@1agh/md-claude": minor
---

**Design plugin — dev-server sidebar restructure: sidecar nesting, per-DS folders, section toggles.**

- **VS Code-style sidecar grouping.** `.tsx` canvases are the primary tree rows; `.meta.json` / `.css` / `.registry.json` siblings collapse under a disclosure chevron. Multi-extension match keeps `Foo.meta.json` correctly grouped with `Foo.tsx`. Canvas extensions are stripped in row labels, menubar status, and comments-panel group headers.
- **Per-DS folders inside DESIGN SYSTEM section.** Every entry in `cfg.designSystems` renders as its own folder (`project`, `beta`, …) regardless of single- vs. multi-DS. Folder name opens SystemView for that DS; chevron toggles disclosure. Server emits `dsFolders[]` on the DS group so the client knows which dirs are DS roots.
- **Every section is expandable.** `PROJECT`, `DESIGN SYSTEM`, `UI CANVASES`, and `RUNTIME` headers are all unified `section-toggle` buttons. Per-section open/collapsed state persists in one `mdcc-sections-expanded` localStorage key. Defaults: working sections (Project, UI canvases) open; meta sections (DS, Runtime) collapsed.
- **View › Show hidden files (`H` shortcut).** Off by default — hides sidecars, the RUNTIME section, orphan project files, and DS-level docs (`README.md`, `SKILL.md`, `colors_and_type.css`). On reveals everything plus per-canvas chevrons for sidecar disclosure.
- **DS pill counts DSes** (`pillFromDsCount`), replacing the hardcoded `MDCC-DSN/01` SKU stamp from the CV-08 mock. Multi-DS configs show `2`, `3`, ….
- **Server `stripPrefix` redesign.** Flattens `.design/` for PROJECT/RUNTIME and `.design/<group.path>/` for canvas groups. DS folders surface as top-level dirs instead of the redundant `system/project` chain.
- Removed the "Design system view" entry from the View dropdown — redundant with per-DS folder click + existing `S` shortcut.
- Sidebar open/closed state now persisted (`mdcc-sidebar-open`).
