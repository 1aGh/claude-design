# specimen-render-and-edit

**Persona:** Claude (or human designer) auditing every DS specimen TSX after the Phase 3.6.1 visual-regression repair — confirming the bare-TSX specimen shape boots cleanly through `_canvas-shell.html` and the inspector pipeline lights up.
**Artboards:** every `.design/system/<ds>/preview/*.tsx` under the active design system (`project` by default — 38 files at time of authoring).
**Hypothesis:** the bare-TSX specimen contract (post scope-correction — no `@mdcc/canvas-lib` envelope, just `<header class="specimen-hd">` + `<main class="specimen">`) survives end-to-end:

1. Every specimen loads through `_canvas-shell.html?canvas=<rel>&layout=…&components=…&tokens=…` without throwing.
2. The canvas-build pipeline emits both the JS module + the sibling CSS asset (the post-3.6.1 `buildCanvasModule()` CSS-injector hot-fix).
3. `data-cd-id` injection lands ≥ 1 attribute per specimen so Cmd+Click + `/design:edit` AST fast-path stays available.
4. Zero page-level console errors / runtime exceptions during boot.

## Platform matrix

| Platform | Viewport | Required |
| --- | --- | --- |
| web-desktop | 1440×900 | ✓ |

Native + mobile-web: N/A (dev-server is web-only).

## Preconditions

- Dev-server running on `http://localhost:$PORT` (default `4399`). The runner reads `$DESIGN_PORT` (env) or `.design/_server.json` if present; falls back to `4399`.
- At least one specimen TSX exists under `.design/system/project/preview/*.tsx`. Empty set → `SKIPPED: no specimens`.
- `agent-browser` ≥ 0.27 on PATH.

## Steps

For each `<slug>` in `.design/system/project/preview/*.tsx` (alphabetical):

1. **Boot canvas.** `agent-browser open "http://localhost:$PORT/_canvas-shell.html?canvas=<encoded-slug>&layout=system/project/_layout.css&components=system/project/_components.css&tokens=system/project/colors_and_type.css"`
2. **Wait for paint.** Sleep 1.2 s (cold module fetch + bundle + mount). Long-tail specimens (`iconography`, `logo`, `motion`) may take 2 s; the runner uses 1.5 s default.
3. **Capture console errors.** `agent-browser errors` — count non-empty lines (excluding the trailing summary).
4. **Probe DOM.** `agent-browser eval "JSON.stringify({kids: document.body.children.length, txt: document.body.innerText.length, cdIds: document.querySelectorAll('[data-cd-id]').length})"`.
5. **Screenshot.** `agent-browser screenshot .ai/device/scenario-runs/specimen-render-and-edit/<ts>/<slug>.png`.

Tally per specimen:
- `PASS` — `errors == 0 && cdIds > 0 && txt > 50`.
- `EMPTY` — `errors == 0 && (cdIds == 0 || txt < 50)` (rendered but suspect — could be a content-less placeholder).
- `FAIL` — `errors > 0` (any console error).

## Success criteria

- **≥ 35 / 38** specimens land on `PASS`.
- **0** specimens land on `FAIL`.
- Any `EMPTY` result is enumerated in the report follow-ups (manual review needed — may be a legitimately minimal specimen).

## Counter deltas (parity)

| Counter | Pre | Post | Delta |
| --- | --- | --- | --- |
| specimens probed | 0 | N | +N |
| `PASS` count | 0 | ≥ 35 | ≥ 35 |
| `FAIL` count | 0 | 0 | 0 |

Single-platform scenario — parity is trivially "ok".

## Known limitations

- Visual fidelity is captured (screenshots committed under the run folder) but **not diffed** vs a baseline — first run establishes baselines.
- Specimens that mount lazy / async content (none today) would need a longer wait — bump the 1.5 s sleep per-slug in `runners/web-desktop.sh` if needed.
- `colors-accent` test specifically depends on `_components.css` carrying `.stamp` — if the DS bootstrap stripped it, the specimen still renders but loses its signature treatment.

## Pilot status

✅ **Piloted 2026-05-19.** Single-specimen smoke against `colors-accent.tsx` returned: 0 errors, 4 body children, 2605 chars, 122 `data-cd-id` elements. Runner extends the same probe over the full 38-file set.
