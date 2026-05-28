---
"@1agh/maude": patch
---

Design dev-server — fix multi-DS file-tree selection and per-DS preview.

In a project with more than one design system, clicking any DS folder in the file tree highlighted *every* DS folder (because `DsFolderRow` keyed its active state on a single shared `SYSTEM_TAB` constant), and `openSystem` ignored the clicked DS name so the System view always showed whichever DS was already loaded. Each DS folder now highlights independently (matched against the loaded `systemData.ds.name`) and clicking a folder loads that specific DS's tokens + previews. Also fixes a related leak in `canvasUrl`: a `system/<ds>/preview/` specimen now renders with *its own* DS's `tokensCssRel` instead of always falling back to `designSystems[0]`, so beta previews no longer render with alpha's tokens.
