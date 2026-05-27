---
name: design:smoke
category: validate
description: Batch screenshot every UI canvas (`<designRoot>/ui/*.tsx`) + every preview specimen (`<designRoot>/system/*/preview/*.tsx`); flag blank iframes + visible error overlays. Exit non-zero on any failure. Catches the "build green ≠ user-visible green" class of regression that bypasses per-canvas hooks. See DDR-021.
argument-hint: "[--include-system 0|1] [--timeout <secs>] [--out-dir <dir>]"
---

# /design:smoke — batch render check across every canvas

Wraps `${CLAUDE_PLUGIN_ROOT}/dev-server/bin/smoke.sh`. Single source of truth lives in the helper; this command exists so you can invoke smoke as a slash, and so `/flow:execute` can call it as a phase-end gate.

## When to invoke

**Manually:** any time you want a quick "did I break the iframe?" pass — typically after a dev-server refactor, a bulk migration, or a runtime library change. ~30 s for a project with ~40 canvases.

**Automatic via `/flow:execute` (DDR-021):** the executor runs this at phase-end when the diff matches any of:

- `plugins/design/dev-server/**` modified
- `<designRoot>/_lib/**` modified
- `plugins/design/templates/canvas*.tsx.template` modified
- ≥ 3 `*.tsx` files mutated under `<designRoot>/` outside a `/design:edit` invocation (bulk migration shape)

Per-canvas hooks (`/design:edit` step 7, `/design:new` step 9, `/design:setup-ds` step 9) already cover single-target work. `/design:smoke` covers the work shapes that bypass them.

## Postup

1. **Server lifecycle** — `PORT=$(bash "${CLAUDE_PLUGIN_ROOT}/dev-server/bin/server-up.sh")`.
1a. **Runtime-bundle health** — `bash "${CLAUDE_PLUGIN_ROOT}/dev-server/bin/runtime-health.sh" --port "$PORT" --restart --quiet`. Smoke's whole purpose is "did I break the iframe?" — a stale dev-server serving a defective `/_canvas-runtime/*.js` will produce blanket `ERROR` rows across every canvas with the same `ReferenceError` (and no source change explains it). Probing the runtime bundles first separates "I broke a canvas" from "the server is broken". System-review 2026-05-27 (D-1).
2. **Run smoke** — `bash "${CLAUDE_PLUGIN_ROOT}/dev-server/bin/smoke.sh" [$ARGUMENTS]`.
3. **Read every PNG.** When the report has > 5 canvases, **Read each PNG into the conversation, not a sample.** This is the rule from Phase 3.6.1 retro learning #4 — the agent screenshotted 38 specimens, sampled 3, called it good; user opened `colors-accent` and triple-chrome was pre-attentive in 2 s. Some visual regressions are catchable by human glance and miss-able by sampling. Don't skip.
4. **If exit ≠ 0:**
   - List every failed canvas with its status (`BLANK` / `ERROR`) and detail.
   - Open the failing PNGs (Read them into context).
   - Open the offending canvas source(s) (Read the `.tsx` files).
   - Identify root cause (broken import, undefined ref, dropped CSS, blank mount). Do NOT mark phase complete.
5. **If exit == 0:** print the markdown report path + summary. Note success in the calling context (commit message, phase close-out, etc.).

## Output layout

Helper writes to `<designRoot>/_history/_smoke/<timestamp>/`:

- `<slug>.png` — one screenshot per canvas
- `report.tsv` — tab-separated status/file/screenshot/detail (machine-parseable)
- `report.md` — human-readable table; links every PNG

Path is gitignored under the existing `_history/` pattern.

## Status semantics

| Status | Meaning |
|---|---|
| `OK` | Canvas mounted (any of `[data-dc-screen]` / `[data-dc-slot]` / `[data-cd-id]` present, OR body has text), no visible error overlay, PNG > 2 KB. |
| `BLANK` | No DC markers and body text empty after `--timeout` seconds. OR PNG < 2 KB. Likely a runtime error broke the React mount before any output. |
| `ERROR` | A visible error overlay was detected (react-error-overlay, body text starting with `Error:`/`SyntaxError:`/`ReferenceError:`). Canvas partially mounted but the page is showing an error. |

The helper exits `0` if everything is `OK`, `3` if any canvas is `BLANK` or `ERROR`.

## Flags

| Flag | Default | Notes |
|---|---|---|
| `--include-system 0\|1` | `1` | Set `0` to skip `system/*/preview/*.tsx` and only smoke `ui/*.tsx`. Faster when iterating only user canvases. |
| `--timeout <secs>` | `8` | Per-canvas mount poll budget. Bump up for heavy canvases or slow machines. |
| `--out-dir <dir>` | `<designRoot>/_history/_smoke/<timestamp>/` | Override output location (used by `/flow:execute` to land reports in a phase-scoped folder). |
| `--engine auto\|agent-browser\|playwright` | `auto` | Forced fallback. Playwright loses the error-overlay probe (coarser verdict). |

## Príklady

```sh
/design:smoke
/design:smoke --include-system 0
/design:smoke --timeout 12 --out-dir .design/_history/_smoke/post-canvas-lib-refactor
```

## Failure modes

- **Server not up** → helper exits 1; run `/design:browse` or any `/design:edit/new` first to boot the server, then re-run.
- **No canvases** (`ui/` and `system/` empty) → helper exits 1 with "no canvases found".
- **`agent-browser` skill unavailable** → helper auto-fallback to playwright. Error-overlay probe is lost; status decision becomes "PNG > 2 KB → OK". Acceptable degraded mode; install agent-browser for full coverage.
- **Smoke reports `BLANK` for a canvas you know renders fine in browser** → bump `--timeout`. Heavy canvases with lazy-mount can miss the 8 s window.

## Co `/design:smoke` NEdělá

- Nemění `_active.json` (smoke iterates URLs directly; doesn't touch the user's selection).
- Nedělá kvalitativní hodnocení — žádný critic, žádná aesthetic skóre. Pure render check.
- Neumí per-artboard breakdown — to je `/design:screenshot --all-screens` na konkrétním canvasu. Smoke je full-page per file.
- Neukládá do `_history/<slug>/screenshots/` (= per-canvas snapshot dir for `/design:edit`). Smoke jde do `_history/_smoke/<timestamp>/` aby nezašumovala canvas-level historii.

## Co se cvičí touto smyčkou

Phase 3.6 + 3.6.1 retra opakovaně dokumentovaly stejnou pattern: build green + tests green + scope "infra change, not UI change" → silně rozbité canvasy odhalené až user-driven exploration. `/design:smoke` je strukturální gate, který tu pattern přerušuje na phase-end, ne v post-validate triage. Viz `.ai/decisions/DDR-021-design-smoke-gate-for-infra-and-bulk-ui-work.md`.
