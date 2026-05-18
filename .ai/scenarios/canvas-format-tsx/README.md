# canvas-format-tsx

Phase 3.6 acceptance scenario — verifies the TSX-canvas pipeline end-to-end through the dev-server's browser UI.

**Persona:** Claude (or human designer) editing canvases in the md-claude design plugin's dev-server.
**Plan:** `.ai/plans/phase-3.6-canvas-tsx-format.md` — "Scenario Coverage" table calls for this single-platform smoke.
**Hypothesis:** A migrated `.tsx` canvas (1) renders correctly through the `_canvas-shell.html` mount harness, (2) the inspector overlay populates `_active.json.selected` with `v=2` + `id` when an element is Cmd+Clicked, and (3) the AST-aware edit path (`/design:edit` Step 3a → `canvas-edit.ts`) lands a single-element className/style change without touching surrounding bytes.

## Platform matrix

| Platform | Viewport | Required | Rationale |
| --- | --- | --- | --- |
| web-desktop | 1440×900 | ✓ | Dev-server is web-only — only ergonomic on desktop. |
| web-mobile | 375×812 | N/A | Dev-server UI does not target mobile viewports. |
| ios-phone | N/A | N/A | No native shell. |
| android-phone | N/A | N/A | No native shell. |
| tablet | N/A | N/A | Out of scope. |

Skip is intentional and recorded in the plan's "Scenario Coverage (UI tasks — required)" table. Do **not** flag `scenario-runner` `parity_ok != true` against the missing platforms.

## Scenarios

- `tsx-canvas-render-and-edit/` — open dev-server → click `Docs Site.tsx` in tree → canvas mounts via `_canvas-shell.html` → Cmd+Click a hero badge → `_active.json.selected.id` populates with v=2 → `/design:edit "change hero accent to amber"` → AST fast-path lands → screenshot delta.

## How to run

```sh
/flow:scenario canvas-format-tsx
/flow:scenario canvas-format-tsx/tsx-canvas-render-and-edit
```

Reports land in `<scenario>/<YYYY-MM-DD-HHMM>/report.md`.

## Notes

- This scenario assumes the migrated `Docs Site.tsx` (Phase 3.6 Task 8) exists at `.design/ui/Docs Site.tsx`. If a fresh checkout hasn't run the codemod, the runner exits with `SKIPPED: codemod not run` rather than `FAIL`.
- The HMR + perf-budget gates from the plan's "Performance budgets" table are out of scope for this scenario — they belong in `test/perf-harness.ts`, not a UI scenario.
