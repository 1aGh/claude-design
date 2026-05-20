# tsx-canvas-render-and-edit

**Persona:** Claude (or human designer) running `maude design serve` against this repo, opening a migrated TSX canvas, selecting an element with Cmd+Click, then issuing a single-element edit.
**Artboard:** `.design/ui/Docs Site.tsx` → `<DCArtboard id="landing">` hero region.
**Hypothesis:** Phase 3.6's three load-bearing invariants hold end-to-end:
1. TSX canvas mounts through the dev-server's `_canvas-shell.html` harness with React 19 + ReactDOM resolved through the importmap (`/_canvas-runtime/*.js`).
2. Inspector overlay reads `data-cd-id` on Cmd+Click and writes `selected: { id, canvas, v: 2 }` to `_active.json`.
3. `/design:edit` Step 3a (AST fast-path) lands a single-attribute change through `canvas-edit.ts.editAttribute()` — touching only the targeted attribute byte-range, leaving every other element unchanged.

## Platform matrix

| Platform | Viewport | Required |
| --- | --- | --- |
| web-desktop | 1440×900 | ✓ |

Native + mobile-web: N/A (dev-server is web-only). See `../README.md`.

## Preconditions

- `Docs Site.tsx` exists at `.design/ui/Docs Site.tsx` (Phase 3.6 Task 8 codemod has run). If missing → SKIP with reason `codemod not run`.
- `Docs Site.meta.json.css_mode === "inline"` (default after codemod).
- `bun` ≥ 1.3 on PATH (DDR-009).
- No other instance of the dev-server holding the default port (the runner discovers an actual port via `_server.json`).

## Steps

1. **Boot dev-server.**
   - `bash plugins/design/dev-server/bin/server-up.sh --root "$REPO_ROOT"` — returns the listening port on stdout.
   - Capture: `_server.json` contents (PID + port + url).
   - Selector check: `curl -sf "http://localhost:$PORT/_health"` returns 200.

2. **Open the design browser.**
   - Navigate the browser to `http://localhost:$PORT/`.
   - Capture: full-page screenshot of the dev-server shell.
   - Selector check: `Docs Site.tsx` row visible in the tree (`[data-canvas-row*='Docs Site.tsx']`).

3. **Open the canvas.**
   - Click the `Docs Site.tsx` tree row.
   - Wait for iframe `src` to contain `/_canvas-shell.html?canvas=ui%2FDocs%20Site.tsx`.
   - Capture: viewport screenshot.
   - Selector check inside iframe: at least one `[data-cd-id]` attribute present in the DOM (the pipeline's pass-1 injection landed).
   - Counter check: `wc -l .design/_locator.json | jq '.[\"ui/Docs Site\"] | length'` ≥ 100 (Docs Site has ~700 elements).

4. **Cmd+Click an element.**
   - Drive Cmd+Click on the hero-region heading inside the artboard. Use the first `h1` element with a `data-cd-id`.
   - Wait until `_active.json.selected.v === 2`.
   - Capture: inspector overlay screenshot.
   - Selector check: `_active.json.selected.id` matches `^[0-9a-f]{8}$`.
   - Counter check (parity): `_active.json.selected.canvas === "ui/Docs Site"`.

5. **AST-aware edit through `canvas-edit.ts`.**
   - Run: `bash plugins/design/dev-server/bin/canvas-edit.sh ".design/ui/Docs Site.tsx" "<SELECTED_ID>" "className" "<NEW_CLASS_VALUE>"`.
   - Read the CLI output JSON: `{canvas, id, delta}`.
   - Capture: post-edit screenshot of the canvas (HMR may not be wired yet — manual iframe reload is acceptable, document in report).
   - Selector check: only the targeted JSX element's `className` changed in the on-disk TSX (`git diff` shows ≤ 1 line modified inside the targeted opening tag).

## Success criteria

- 0 console errors (network / hydration / a11y) in the canvas iframe.
- `_active.json.selected.v === 2` after step 4.
- `canvas-edit.sh` exits 0 with `delta != 0` after step 5.
- Post-edit `git diff` touches exactly the targeted line range (no whole-file rewrite, no reformatting of surrounding elements).
- `_locator.json["ui/Docs Site"]` ID count between pre-edit and post-edit differs by ≤ 1 (the targeted element retains its ID since no sibling-insertion occurred).

## Counter deltas (parity)

| Counter | Pre | Post | Delta |
| --- | --- | --- | --- |
| `_active.json.selected.v` | 1 (or absent) | 2 | +1 |
| `_locator.json["ui/Docs Site"]` cardinality | N | N | 0 |
| Edited file byte-delta | 0 | `delta` from canvas-edit CLI | matches CLI report |

Single-platform scenario — parity is trivially "ok" (no cross-platform check).

## Known limitations

- HMR is **not yet wired** (carried from runtime slice). The post-edit screenshot in step 5 requires a manual iframe reload. Document the reload step in the report rather than gating on it.
- `Cmd+Click` driving through `agent-browser` may require modifier-key support; if not available, the runner falls back to a synthetic WS message that simulates the inspector payload (documented in `runners/web-desktop.sh`).
- Performance budgets (`< 250 ms` cold canvas load, `< 100 ms` HMR, `< 30 %` token cost) are **separate** from this scenario — they belong in `plugins/design/dev-server/test/perf-harness.ts`. The scenario verifies correctness, not perf.

## Pilot status

🚧 **Not yet piloted.** The scenario spec is committed alongside the Phase 3.6 plan. Pilot via `agent-browser` lands when `/flow:done` runs `/validate` for this branch — that's the first time the dev-server boots in CI/agent context. Until then the runner emits `SKIPPED: not yet piloted` rather than `FAIL`.
