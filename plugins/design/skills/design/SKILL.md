---
name: design:design
description: Local Claude-Design clone — canvas-first design iteration. Iterates IN PLACE on existing HTML mocks under the project's design root (default `.design/`). Use when the user gives design feedback (add/change/move/remove something), wants to capture, critique, hand off, or rollback. `/design:new` scaffolds a new canvas. Talks to a local dev server (auto-started if missing) that tracks the active tab AND the user's currently selected element via injected inspector.
---

# Design — orchestrator (canvas-first, with element selection)

You are the orchestrator for local design-iteration. The mental model: **the project has a fixed set of canvas files** under `<designRoot>/system/...` (design system specimens) and `<designRoot>/ui/...` (project surfaces). The user opens one in the browser, optionally selects a specific element with Cmd+Click, then says what they want changed. You read state from disk, snapshot, edit in place.

**Per-repo config.** All project-specific values come from `<repo>/.design/config.json` (schema at `${CLAUDE_PLUGIN_ROOT}/dev-server/config.schema.json`). Key fields you need:

| Field | What you use it for |
|---|---|
| `designRoot` | Repo-relative root for all canvas/system files. Default `.design`. |
| `rootClass` | Body CSS class (e.g. `dugmate`, `app`). All canvases must keep `<body class="<rootClass>" …>` or whatever the project uses. |
| `themeDefault` | Default `data-theme` value (`dark` or `light`). |
| `tokensCssRel` | Path to design system CSS (relative to `designRoot`). Every canvas links it. |
| `teamAccentDefault` | Optional default `data-team` value (or `null` if the project doesn't use team accents). |
| `handoffTargets[]` | Where `/design:handoff` can migrate canvases. |
| `newCanvasDir` / `newComponentDir` | Where `/design:new` scaffolds new files. |

If `.design/config.json` is missing, the dev server returns sensible defaults; the orchestrator falls back to those — see `/_config` endpoint on the dev server.

## Opt-out scope — palette / aesthetic / full

When a user invokes `/design:new` or `/design` with `--opt-out=<scope>` (or signals an opt-out in plain language — "opt-out design system", "modern color scheme", "different feel"), the orchestrator picks one of three scopes. The scope flows into the auto-critic loop and gets persisted on the canvas's `.meta.json`.

| Scope | What's relaxed (vs. project DS) | Critics that downgrade matching DS-rule blockers → warnings | Critics that stay strict |
|---|---|---|---|
| `palette` *(default)* | Palette only — local namespace overrides colors. Type / radii / icons / aesthetic still enforced. | (none) | all |
| `aesthetic` | Palette + decorative aesthetic — gradients, off-ladder radii, alternate type pairings, decorative SVG/emoji glyphs allowed inside the namespace. | `design-critic`, `graphic-design-critic`, `typography-critic`, `signature-moment-critic` (does *not* penalize accent/gradient choices as "restraint" violations) | `a11y-critic`, `frontend-critic`, `copy-critic`, `motion-critic` (motion duration tokens still apply), `info-architecture-critic`, `brand-critic` |
| `full` | DS treated as advisory. Type / radii / aesthetic up to canvas. | `design-critic`, `graphic-design-critic`, `typography-critic`, `signature-moment-critic`, `info-architecture-critic`, `brand-critic` (only for *DS-rule* findings, not asset integrity), `motion-critic` (DS motion-token rule downgraded; reduced-motion stays strict) | `a11y-critic`, `frontend-critic`, `copy-critic` |

### Validation envelope — kept at every scope

`<link rel="stylesheet" href="<tokensCssRel>">` and `<body class="<rootClass>" data-theme=…>` survive every opt-out. Step-6 validation greps for them and rolls back the snapshot if missing. The opt-out widens the critic *judgement bar*; it does not strip the file's structural envelope.

### A11y is independent of opt-out

WCAG hard-stops (contrast, semantics, focus, motion-respect, touch targets, form labels) apply at every scope. `a11y-critic` and `frontend-critic` do not honor `opt_out_scope` — their blockers stay blockers. Treating a11y as a separate axis is the only safe way to offer broader visual exploration.

### Iter-1 checkpoint when scope > palette

When `opt_out_scope ∈ {aesthetic, full}` is in effect, after the post-write reality-check screenshot but **before spawning iter-1 critics**, surface a one-shot `AskUserQuestion`:

```
Iter 1 ready (opt_out_scope = <scope>). Pick:
  (a) Run the auto-fix loop now — fixes a11y; downgrades DS blockers per scope.
  (b) Show me iter 1, I'll send specific feedback (skip auto-loop this round).
  (c) A11y-only check — skip aspiration + DS, just verify accessibility.
```

This fires only when the user opted into a wider scope. The default `palette` scope keeps the existing contract (auto-loop runs unconditionally). The point is: when the user signaled exploration, give them iter-1 cheaply before the loop reshapes it for compliance.

### Inferring scope from plain language

If the user invokes `/design:new` with brief text containing opt-out signals but no explicit `--opt-out=` flag, the orchestrator may **propose** a scope based on phrasing (vibrant/modern/playful/exploratory → `aesthetic`; product-foreign domain → `aesthetic`; "fully off-system" / "different brand" → `full`), but must **surface a one-shot AskUserQuestion before kicking off the auto-fix loop**:

```
I read your "<opt-out phrase>" as opt_out_scope = <inferred>. Pick:
  (a) palette  — DS aesthetic still enforced (default)
  (b) aesthetic — palette + gradients/radii/type free
  (c) full      — DS advisory only
A11y enforced regardless.
```

If the user is in Auto Mode (AskUserQuestion denied), default to `palette` and flag the assumption explicitly in the print step (`opt_out_scope = palette (auto-picked because Auto Mode; user signaled "<phrase>" — explicit --opt-out=aesthetic|full would have widened)`).

### Persisting scope on the canvas

After the user picks (or in Auto Mode default), write the scope to the canvas's `.meta.json`:

```jsonc
{
  "title": "...",
  "opt_out_scope": "palette" | "aesthetic" | "full",
  ...
}
```

Subsequent `/design:edit` iterations on the same canvas read this field and apply the same scope **automatically** — no re-asking on every edit. To change scope mid-flow: `/design:edit "<feedback>" --opt-out=<new-scope>` overrides for that iteration and persists the new value.

### Propagating scope to critic agents

The orchestrator passes `opt_out_scope: <scope>` in every critic's input envelope. The 4 design-stack critics (`design-critic`, `signature-moment-critic`, `graphic-design-critic`, `typography-critic`) read it and adjust verdict severity. Each verdict's top_blockers MUST be tagged with `category` (one of `a11y | ds | frontend | aspiration | brand | copy | motion | ia | type`). The auto-fix loop filters `category: ds`-tagged blockers per scope before counting them toward the SOLID stop condition. See per-critic specs for downgrade rules.

## Hard contract — non-negotiable

1. **Active canvas + (optional) selected element come first.** Before any edit, read `<designRoot>/_active.json`. If `active` is null or the dev server is not running, ensure the server is up and ask the user to open something in the browser.
2. **Snapshot before edit.** Every edit copies the current file to `<designRoot>/_history/<file-slug>/<NNN>-<timestamp>.bak` before applying changes. Never skip. This is the undo stack.
3. **In-place edit is the only edit mode.** `/design:edit "<feedback>"` mutates the file under `<designRoot>`. There are no immutable iteration files.
4. **Selection narrows scope.** If `_active.json.selected` is set, the edit applies to that element / region only. Reach outside the selection only if the feedback explicitly says so ("…and update the chrome too").
5. **Tokens stay locked.** Every edit must respect the project's tokens CSS (`<designRoot>/<tokensCssRel>`). No hardcoded colors / fonts / radii. No removing the `<link>` to tokens. No removing `<body class="<rootClass>" data-theme="…">`.
6. **Never edit `<designRoot>/_server.json`, `<designRoot>/_active.json`, or `_history/`.** Those are runtime state owned by the dev server / orchestrator side-effects.
7. **Never edit `.design/config.json` without explicit user instruction** — it's the per-repo source of truth.

## Server lifecycle — every command starts here

The dev server is the source of truth for "what is the user looking at right now". Canonical recipe is `${CLAUDE_PLUGIN_ROOT}/dev-server/bin/server-up.sh` — it checks `_server.json`, verifies PID + `/_health`, respawns if stale, polls 10 s, and prints the port on stdout:

```bash
PORT=$(bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/server-up.sh" --root "$REPO_ROOT")
```

Diagnostic goes to stderr (`✓ server alive pid=… port=…` / `→ starting dev server …` / `✗ server start timeout`). The helper passes the user's repo root explicitly — the plugin is installed centrally and serves *any* repo, never assume `__dirname`. **Never start a second instance** by hand; `server-up.sh` is idempotent and the only sanctioned path. Server auto-opens the browser on its own boot (unless `NO_OPEN=1`).

## Active state schema

```jsonc
// <designRoot>/_active.json
{
  "active": "<designRoot>/ui/project/<File>.html",
  "open_tabs": ["<designRoot>/ui/project/<File>.html"],
  "selected": {
    "file": "<designRoot>/ui/project/<File>.html",
    "selector": "body.<rootClass> > div.frame > section.card:nth-child(3) > div.row:nth-child(2)",
    "tag": "div",
    "classes": "row example-row",
    "text": "Row text…",
    "dom_path": ["body.<rootClass>", "div.frame", "section.card:nth-child(3)", "div.row:nth-child(2)"],
    "bounds": { "x": 245, "y": 312, "w": 280, "h": 56 },
    "html": "<div class=\"row example-row\">…</div>",
    "ts": "<iso-ts>"
  },
  "last_change": "<iso-ts>",
  "session_started": "<iso-ts>",
  "active_comments": [ /* mirror of <designRoot>/_comments/<slug>.json for the active file */ ]
}
```

`active` = the tab the user clicked last. `selected` = element the user Cmd+Clicked inside the canvas (cleared automatically when the active tab switches; cleared on Esc inside the iframe; persists otherwise). **`active_comments`** = read-only mirror that the dev server keeps in sync with `<designRoot>/_comments/<slug>.json` for the currently active file — `/design` reads from `_active.json` once and has both selection and comments. Authoritative comment storage remains under `_comments/`; for non-active files, read those files directly.

If `selected.file !== active`, the selection is stale (tab was switched but server didn't yet clear it on its side — race). Treat as canvas-wide.

## Comments — element-pinned annotations

The dev-server UI lets the user drop comments on individual elements (Cmd+Shift+click in canvas, or "+ Comment" in status bar after selecting). Comments persist to `<designRoot>/_comments/<slug>.json` (gitignored, runtime state). They are explicit user feedback that Claude must consume.

**Schema per file:**

```jsonc
[
  {
    "id": "c_<6 hex bytes>",
    "file": "<designRoot>/ui/<Canvas>.html",
    "selector": "body.<rootClass> > main > section.card:nth-child(3) > h2.title",
    "dom_path": ["body.<rootClass>", "main", "section.card:nth-child(3)", "h2.title"],
    "tag": "h2",
    "classes": "title",
    "bounds": { "x": 80, "y": 248, "w": 320, "h": 32 },
    "html_excerpt": "<h2 class=\"title\">Featured</h2>",
    "text": "Make this 24px instead of 32px and right-align",
    "status": "open" | "resolved",
    "created": "<iso-ts>",
    "resolved_at": "<iso-ts> | null"
  }
]
```

**Endpoints (server):**
- `GET /_comments?file=<urlEncoded>` → `{file, comments}`
- `GET /_comments-all` → `{<file>: [comment...], ...}`
- WebSocket inbound from clients: `{type:"comments-add", payload:{...}}`, `{type:"comments-patch", id, patch:{status:"resolved"|"open", text?}}`, `{type:"comments-delete", id}`, `{type:"comments-request", file}`
- WebSocket outbound (broadcast): `{type:"comments", file, comments}` — sent on every change

**Orchestrator behaviour for `/design:edit "<feedback>"`:**

1. **Always read** `<designRoot>/_comments/<slug>.json` for the active canvas before deciding scope.
2. **Empty / generic feedback** (`""`, `"polish"`, `"fix open comments"`, `"address feedback"`) + open comments exist → iterate over each open comment as a separate scoped edit (use comment.selector + dom_path like a normal selection); resolve each after a successful edit.
3. **Specific feedback referencing comments** (`"comment 3"`, `"the typography ones"`) → match by index/keywords, edit those, resolve them.
4. **Feedback unrelated to comments** → execute feedback first, then warn user that N open comments still need attention. Do NOT silently resolve them.
5. After auto-critic loop completes (or `--no-critic`), open comments that were addressed by the loop should be resolved as part of `refresh_docs()` (orchestrator decides which by inspecting diffs vs. comment selectors).

**To resolve a comment without going through the WS server, write the file directly:**

```bash
COMMENTS_FILE="<designRoot>/_comments/<slug>.json"
jq --arg id "$ID" 'map(if .id == $id then .status = "resolved" | .resolved_at = (now | todate) else . end)' \
  "$COMMENTS_FILE" > "$COMMENTS_FILE.tmp" && mv "$COMMENTS_FILE.tmp" "$COMMENTS_FILE"
```

The next client load (`/_comments-all` fetch or WS reconnect) picks up the new state. Pins in the iframe re-render automatically.

**Comments DO NOT persist across rollback.** `/design:rollback` reverts the canvas HTML, but the comments JSON is independent — open comments stay open after a rollback (they're feedback, not file state).

**Comments do not appear in `_active.json`.** They're keyed by file slug, not by active tab. Multiple files can have open comments simultaneously; the sidebar shows a yellow badge with the open-count next to each file with comments.

## Snapshot protocol

Before EVERY mutation:

```bash
file_to_edit = activeState.active
slug = slugify(file_to_edit)
hist = <designRoot>/_history/<slug>/
mkdir -p $hist
N = printf "%03d" $(($(ls $hist 2>/dev/null | wc -l) + 1))
ts = $(date -u +%Y%m%dT%H%M%S)
cp $file_to_edit $hist/$N-$ts.bak
```

Snapshots are gitignored. Don't commit them. If snapshot fails (disk full / permission), refuse to proceed — the user must be able to undo.

## Command routing

### `/design:edit "<feedback>" [--screenshot <path>]` — primary flow

Default. Edits the active canvas inline.

1. Server up + `_active.json` resolved.
2. **If `selected` is non-null AND `selected.file === active`**, build a **scoped prompt** (see "Scoped edit prompt" below). Otherwise build a canvas-wide prompt.
3. If `--screenshot <path>` was passed (or feedback contains a `.png`/`.jpg` path), read it as image input.
4. Read the active canvas file fully.
5. **Snapshot.**
6. Apply edit using the **Edit tool** (preferred — minimal diff). Use Write only if the change spans most of the file.
7. **Validate output:**
   - `<link>` to tokens CSS still present
   - `<body class="<rootClass>" data-theme="…">` still present (rootClass from config)
   - No new hardcoded `#hex` colors, no new `font-family` not using `var(--font-*)`
   - If validation fails, restore from snapshot and report what went wrong.
8. **Confirmation screenshot — always, regardless of `--no-critic`.** See "Post-write reality check" below.
9. **Tell the user.** Print: file edited, line range changed, snapshot id, screenshot path, "reload iframe (Cmd+R inside the canvas tab)".

### Post-write reality check — confirmation screenshot

**Always fires after a successful edit / generate, regardless of `--no-critic`.** This is reality check (does the file render?), not quality check (is it good?). It's cheap, costs one helper call, and is the baseline both critics and rollback compare against.

Single source of truth is `${CLAUDE_PLUGIN_ROOT}/dev-server/bin/screenshot.sh`. It resolves URL from `_server.json` + `_active.json`, polls for canvas mount (Babel/React takes 2–4 s), selects engine (`agent-browser` > `playwright` fallback), and emits diagnostic on stderr.

```bash
HIST="<designRoot>/_history/$SLUG"
OUT="$HIST/$NNN-baseline.png"
bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/screenshot.sh" --full --out "$OUT"
```

Why this step matters:

- **Babel-standalone runtime errors don't surface as HTTP errors** — the file serves 200 even if JSX fails to mount. Without a render check, "wrote 600 lines + 200 OK" is a false positive.
- **Critics already auto-capture if missing**, but `--no-critic` skips the entire loop. Without this step, the user sees no visual confirmation when they explicitly opt out of critique.
- **Rollback diffs need a baseline.** Comparing screenshots across snapshots is only useful if every snapshot has one.

**Lazy-mount + pan-zoom caveat (canvases since commit 7a00561).** `DesignCanvas` has its own pan/zoom viewport and lazy-mounts artboards as they enter view. A single full-page screenshot at default viewport height captures only what's currently positioned in the canvas viewport — typically 1–3 artboards out of 6+. For canvases with > 3 artboards, **per-screen element screenshots are the reliable unit** — use `--all-screens`:

```bash
bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/screenshot.sh" \
  --all-screens --out-dir "$HIST" --timeout 10
```

The helper queries `[data-dc-screen],[data-dc-slot]` in the live DOM, scrolls each artboard into view (defeats `DesignCanvas` pan/zoom lazy-mount), and writes `<NNN>-screen-<id>.png` per artboard. Output paths go to stdout (one per line), engine choice + per-screen status on stderr.

**Why per-screen wins for canvases (retro 2026-05-09).** During the iOS Bikeshare Signup session, full-page snapshots showed only 1 of 6 artboards because DesignCanvas pans/zooms its world independently of document scroll. `[data-dc-screen]` element screenshots captured all 6 cleanly. The `--all-screens` mode is the default for `/design:new`.

Failure handling:
- Helper returns exit code 3 → capture failed (empty PNG, selector miss, or engine error). Surface stderr to the user — don't pretend the baseline exists.
- Mount timeout → warn but don't fail the edit. The file already exists; the user can open it manually. Increase `--timeout` for heavy-JS canvases.
- Both engines unavailable → helper exits 1; surface install hint (`agent-browser` or `playwright`) without rolling back the edit.

Output is gitignored (lives under `_history/`), and is referenced from the iteration's chat.md row as `**Baseline:** {path}`.

### Scoped edit prompt (when `selected` is set)

When the user Cmd+Clicked an element first, narrow your edit:

```
You are editing ONE specific element in <active_path>. The user has the following element selected:

  selector: <selected.selector>
  tag:      <selected.tag>
  classes:  <selected.classes>
  text:     "<selected.text>"
  dom path: <selected.dom_path joined with " > ">
  bounds:   x=<x>, y=<y>, w=<w>, h=<h>
  outerHTML (truncated):
  ```
  <selected.html>
  ```

User feedback:
<feedback>

Apply the change to that element only — match the selector / dom path. Do NOT modify other parts of the file unless the feedback explicitly says so. Preserve token usage, semantics, and the surrounding layout.
```

Use the Edit tool with `old_string` matching a unique substring of the selected element's HTML. If the outerHTML appears multiple times verbatim, fall back to the longer dom-path match (find the parent context that disambiguates).

**Selection screenshot is mandatory** before building the scoped prompt. The selection JSON gives you WHAT (selector + outerHTML + bounds); only a screenshot gives you WHERE-IN-CONTEXT (neighbors, alignment, the visual conversation the element is part of). Call `bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/screenshot.sh" --full --out "<out>"` (plus an `--element <id>` shot when the selector contains `data-dc-element="…"`) and `Read` the PNG into your context BEFORE the Edit tool call. See `/design:edit` step 3.5 for the canonical snippet. Editing from JSON describe alone is *tapping in the dark*; the studio iter-4 sidebar-active-item incident (3 rollback iterations before landing) is the canonical cost of skipping. Reference: `.ai/logs/system-reviews/design-edit-screenshot-habits-review.md`.

### `/design:new <name> "<brief>"` — scaffold new canvas project

Creates a brand-new HTML canvas file in `<designRoot>/<newCanvasDir>/<Name>.html` (or `<newComponentDir>/<Name>.jsx` if the user explicitly says component). Generated via the `frontend-design` Skill (preferred) or the orchestrator's direct authoring (documented fallback) — see "Generation invocation" in Cross-skill calls.

**The new file MUST be a multi-artboard canvas project**, not a single-page wrapper. It uses the `DesignCanvas` + `DCSection` + `DCArtboard` pattern (see existing examples in `<designRoot>/ui/`) so multiple screens live in one panable canvas. A bare single-page wrapper is an anti-pattern unless the user explicitly says so.

1. Validate `<name>`:
   - For canvas project: title-case with optional spaces (`Match Recap`, `Scout Radar`). File: `<Name>.html`.
   - For shared component: PascalCase (`MatchRecap`). File: `<newComponentDir>/<Name>.jsx`.
2. Reject if file already exists. Suggest `<Name> v2`.
3. **Build the envelope** following "Envelope discipline" — creative brief, not wireframe spec. Include the aspiration directives 9–14 verbatim. Reference at least one existing canvas as wrapper pattern.
4. **Generate** via the preferred path; fall back transparently if the Skill is unavailable. Always note which path was taken in the final report.
5. Validate output (link to tokens, correct rootClass, no hardcoded values, includes at least one `DCArtboard`).
6. Write the file.
7. **Post-write reality check** — capture confirmation screenshot (see "Post-write reality check" above). Same guarantees as `/design`: always fires, even with `--no-critic`. For canvases with > 3 artboards, scroll all artboards into view first (see "Lazy-mount caveat") or explicitly state in the report that the snapshot covers only the first ~3.
8. **Auto-critic loop — `/design:new` defaults to `--perfect`** (max 8 iter, target 4.5/5, full panel: signature-moment + design + frontend + a11y). Higher bar than `/design` because new canvases are high-leverage scaffolds. Opt-out flags: `--quick` (signature-moment only, 2 iter), `--no-critic` (skip), `--perfect-iter N` (override iter count). See "Default flow vs. --perfect" table for the full matrix and "Auto-critic loop" for stop conditions.
9. Print path + generation path used + screenshot path + critic mode + verdict + "click on it in the browser tree to make it active, then iterate with /design".

### `/design:rollback [--steps N] [--list]` — undo

Restores the last snapshot of the active canvas. With `--steps N`, restores N back. `--list` prints history without restoring.

1. Read `_active.json.active` → file path.
2. Compute `<slug>` and look in `_history/<slug>/`.
3. List snapshots, sorted descending. Take element [N-1] (default N=1 = most recent).
4. **Snapshot the CURRENT state first** (rollback is itself reversible).
5. Copy chosen snapshot back over the canvas file.
6. Print: which snapshot restored, current snapshot count.

### `/design:screenshot` — capture

Operates on `_active.json`. Output goes to `_history/<slug>/screenshots/<NNN>-<area>.png` (gitignored). Flags: `--screen <id>`, `--element <id>`, `--selector <css>`, `--full` (default), `--all-screens`, `--area <label>`.

All paths funnel through the canonical helper:

```bash
bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/screenshot.sh" --full --out "<out>"
bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/screenshot.sh" --screen <id> --out "<out>"
bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/screenshot.sh" --all-screens --out-dir "<dir>"
```

The helper picks `agent-browser` first, falls back to `npx playwright`, polls for canvas mount, and verifies PNG size > 0 before returning. Inline `agent-browser navigate + screenshot` blocks are deprecated — use the helper everywhere.

If `_active.json.selected` is set and the user passed no flag, default to `--element <id>` when the selected element has `data-dc-element="…"`, otherwise fall through to `--selector "<saved-selector>"`. The screenshot is scoped to the focused element.

### `/design:critic` — review by specialist agents

Spawns one or more `*-critic` subagents against the active canvas. Each subagent reads:

- The canvas file
- Latest screenshot (or captures one first via `/design:screenshot`)
- The project's tokens CSS at `<designRoot>/<tokensCssRel>` and any sibling `README.md`
- The corresponding domain rules skill, if present (e.g. `<project>-a11y-rules`, `<project>-motion-rules`)
- If `selected` is set, includes selector + dom_path so critique can be element-scoped

Each critic emits a JSON verdict block at the bottom of its report — that's the orchestrator-readable signal:

```json
{ "agent": "<name>", "iter": N, "blockers": X, "warnings": Y, "top_blockers": [...], "passed": (X == 0) }
```

**Modes:**
- **No flag** → orchestrator-routed panel (see "Critic panel routing" below). The default.
- **`--agent <name>`** → just that one critic.
- **`--all`** → every critic in parallel (heavy — uses many tool calls).
- **`--panel`** → alias for default.

Output: `<designRoot>/_history/<slug>/critique/<NNN>-<agent>.md` per critic. A `<NNN>-PANEL.md` consolidation is written when 2+ critics ran (top blockers across all critics, who flagged what).

## Critic panel routing — orchestrator decides

When `/design:critic` is invoked without `--agent`, OR when auto-critic fires after `/design` / `/design:new`, the orchestrator picks a panel based on canvas content + feedback intent. Always include `design-critic` and `a11y-critic` (universally critical). Then conditionally add specialists.

### Routing inputs

```bash
# Source intent — last feedback the user gave
FEEDBACK=$(cat .design/_last-feedback.txt 2>/dev/null || echo "")

# Canvas signals — grep the active canvas for surface area
CANVAS=<active>
HAS_ANIM=$(grep -cE "@keyframes|transition[: -]|animation:|prefers-reduced-motion" "$CANVAS")
HAS_FORMS=$(grep -cE "<input|<textarea|<select|<form|<label" "$CANVAS")
HAS_NAV=$(grep -cE "<nav|role=\"navigation\"|breadcrumb|sub-rail|sub-nav" "$CANVAS")
HAS_LOGO=$(grep -cE "logos?/|wordmark|brand-mark" "$CANVAS")
HAS_TYPE_HEAVY=$(grep -cE "<p>|t-body|t-meta|t-title|article|prose" "$CANVAS")  # >5 = type-heavy
HAS_HEAVY_JSX=$(grep -cE "useState|useEffect|useMemo|useCallback|map\\(|\\.filter\\(|key=" "$CANVAS")
HAS_USER_STRINGS=$(grep -cE ">[A-Z][a-zA-Z ]{3,}<|placeholder=|aria-label=|title=" "$CANVAS")  # any user-facing copy
```

### Routing rules

| Critic | Always | Or include when… |
|---|---|---|
| `design-critic` | ✓ | (always — holistic baseline) |
| `a11y-critic` | ✓ | (always — a11y is universal) |
| `signature-moment-critic` |   | **Always for `/design:new`** initial generation. On `/design`: feedback mentions `polish|nicer|elegant|iconic|signature|portfolio|memorable|creative` OR canvas is in `<newCanvasDir>` and `iteration_count < 5`. This is the aspiration axis — measures *presence of greatness*, not absence of badness. |
| `typography-critic` |   | `HAS_TYPE_HEAVY > 5` OR feedback mentions `font|type|leading|measure|tracking|hierarchy` |
| `motion-critic` |   | `HAS_ANIM > 0` OR feedback mentions `animation|transition|motion|prefers-reduced` |
| `brand-critic` |   | `HAS_LOGO > 0` OR feedback mentions `brand|logo|voice|tone|asset|illustration|photography` |
| `copy-critic` |   | `HAS_USER_STRINGS > 0` OR feedback mentions `copy|microcopy|text|label|empty state|error message` |
| `frontend-critic` |   | `HAS_HEAVY_JSX > 10` OR feedback mentions `code|jsx|component|hook|prop|key warning|render` |
| `info-architecture-critic` |   | `HAS_NAV > 0` OR feedback mentions `nav|navigation|hierarchy|menu|breadcrumb|search|filter|sitemap` |
| `graphic-design-critic` |   | feedback mentions `composition|layout|visual|hierarchy|balance|density|rhythm|alignment|spacing` |

If the routing produces just `design-critic + a11y-critic` (minimum panel), that's fine — those two cover most baseline-quality cases. The conditional ones fire when the canvas / feedback genuinely calls for them.

**Why `signature-moment-critic` is its own axis:** the other critics are *correctness* gates. Without an aspiration gate, the auto-fix loop converges on "all checks green" — which is exactly competent stock. `signature-moment-critic` measures composition, brand prominence, mock fidelity, restraint, negative space, and a specificity gate (no Lorem / placeholder content). It's the difference between a canvas that *passes* and one a designer would *screenshot*.

The **selected element** narrows the same routing — if `_active.json.selected` is set, run grep on the selected element's outerHTML instead of the whole canvas. (Targeted critique = targeted panel.)

### Spawning the panel

The orchestrator spawns the picked critics **in parallel** with one message containing N `Agent` tool calls. Each critic writes its own report; the orchestrator parses each JSON verdict, aggregates, and writes `<NNN>-PANEL.md`.

**Every Agent invocation MUST pass `opt_out_scope`** in the prompt — read from the canvas's `<active>.meta.json` `opt_out_scope` field, or override from `--opt-out=<scope>` flag, or default `palette`. Critics that honor the scope (design-stack) will downgrade their DS-rule findings; critics that ignore it (a11y / frontend / copy) emit `"opt_out_applied": "n/a"` for auditability. The auto-fix loop's SOLID stop condition reads each critic's post-downgrade `blockers` count — so honoring scope at critic level naturally flows into the loop's exit logic without separate filter code.

### Panel consolidation report

`<NNN>-PANEL.md` schema:

```markdown
# Critic panel — iter {N}

_{ISO ts} · canvas: `{path}` · critics: design-critic, a11y-critic, ... · total blockers: X · total warnings: Y_

## TL;DR

**Blockers: X** · Warnings: Y · Verdict: pass | fix-and-retry | divergent

{1–2 sentence synthesis across critics.}

## Blockers (sorted by category)

### a11y (3)
1. [a11y-critic L245] {summary}. Fix: {…}.
…

### ds-tokens (2)
1. [design-critic L312] {summary}. Fix: {…}.
…

## Warnings

…

## Per-critic reports

| Critic | Blockers | Warnings | Report |
|---|---|---|---|
| design-critic | 2 | 4 | NNN-design-critic.md |
| a11y-critic | 1 | 0 | NNN-a11y-critic.md |
…

## Verdict

```json
{
  "panel": ["design-critic", "a11y-critic", ...],
  "iter": N,
  "total_blockers": X,
  "total_warnings": Y,
  "by_critic": { "design-critic": { "blockers": 2, "warnings": 4 }, ... },
  "top_blockers_across_panel": [
    { "agent": "a11y-critic", "category": "contrast", "line": 245, "summary": "...", "fix": "..." },
    ...
  ],
  "passed": (X == 0)
}
```
```

## Auto-critic loop — default behavior of /design:edit and /design:new

After every successful edit/generate, the orchestrator runs auto-critic by default. The user can opt out with `--no-critic`, or escalate with `--perfect [N]`.

The default loop is **multi-axis** — it does not exit just on "blockers == 0", because correctness ≠ aspiration. It exits when the canvas is **solid for review**: correctness blockers cleared AND aspiration ≥ threshold AND no further gains in the last round (stable). If those can't be reached, it surfaces with a diagnostic, not silent.

### Stop-condition vocabulary

The loop tracks two quality axes per iteration, both produced by the panel:

- **`correctness_blockers`** — sum of `blockers` across non-aspiration critics (`design-critic`, `a11y-critic`, `typography-critic`, …). Drives correctness gate.
- **`aspiration_score`** — `signature-moment-critic.aspiration_score` (0–5 normalized). Drives aspiration gate. If `signature-moment-critic` is not in the panel, treat aspiration_score as 5 (auto-pass, axis not measured).
- **`specificity`** — `signature-moment-critic.specificity` (`pass | fail`). Hard gate — fail blocks success even if everything else is green.

### Default thresholds

```
SOLID = correctness_blockers == 0
        AND aspiration_score >= 4.0
        AND specificity == "pass"
        AND no_gains_for_1_round   # stable — last fix didn't move scores
```

### Algorithm

```
# Tunable per mode (see "Default flow vs. --perfect" table)
max_iter            = 4 (default flow) | N (--perfect, default 8)
aspiration_target   = 4.0 (default flow) | 4.5 (--perfect)
divergence_tolerance = 1 (default flow) | 2 (--perfect)

prev = { correctness: ∞, aspiration: 0 }
best_snapshot = none
best_score = -∞               # weighted: -correctness + aspiration
diverge_count = 0
no_gains_count = 0

# Always append iteration 0 to chat.md (initial edit / generate)
append_to_chat_md(iter=0, feedback, selected, snapshot_id, edit_summary, critic_verdict=null)

for iter in 1..max_iter:
  # 1. Run critic panel (routing logic above)
  panel = pick_panel(canvas, feedback, selected)   # routing forces signature-moment-critic for /design:new
  spawn panel in parallel
  parse JSON verdicts → aggregate
  write iter NNN-PANEL.md

  correctness = sum_blockers_across(panel except signature-moment-critic)
  aspiration  = signature-moment-critic.aspiration_score (or 5 if not in panel)
  specificity = signature-moment-critic.specificity      (or "pass" if not in panel)

  # 2. Update best-snapshot tracking — composite score
  current_score = -correctness * 10 + aspiration   # correctness dominates aspiration
  if current_score > best_score:
    best_score = current_score
    best_snapshot = current_snapshot_id

  # 3. Track gain delta
  gained = (correctness < prev.correctness) OR (aspiration > prev.aspiration + 0.1)
  if !gained:
    no_gains_count += 1
  else:
    no_gains_count = 0

  # 4. Append this iteration to chat.md
  append_to_chat_md(iter, feedback, selected, snapshot_id, edit_summary, critic_verdict)

  # 5. Exit conditions (in order)
  if correctness == 0 AND aspiration >= aspiration_target AND specificity == "pass" AND no_gains_count >= 1:
    refresh_docs()
    print "✓ solid — correctness clean, aspiration {aspiration}/5, stable"
    exit success

  if correctness == 0 AND specificity == "pass" AND no_gains_count >= 2:
    # Correctness is clean and we're stuck on aspiration — surface diagnostic, don't loop forever
    refresh_docs()
    print "⚠ stable but {aspiration}/5 (target {aspiration_target}) — surfacing for review"
    print "  Lowest axes: {top 2 axes from signature-moment-critic with score < target}"
    exit stable-but-bland

  if iter == max_iter:
    if best_snapshot != current_snapshot:
      restore best_snapshot
      print "↺ restored to best (iter {best_iter}, correctness {best.c}, aspiration {best.a}/5)"
    refresh_docs()
    print "⚠ max iterations reached"
    exit max-reached

  # 6. Divergence — both axes worsening
  diverged = (correctness > prev.correctness) AND (aspiration < prev.aspiration - 0.3)
  if diverged:
    diverge_count += 1
    if diverge_count >= divergence_tolerance:
      restore best_snapshot
      refresh_docs()
      print "✗ divergence: scores worsened {diverge_count}× — restored to best"
      exit divergent
  else:
    diverge_count = 0

  # 7. Auto-fix — craft prompt from top blockers (correctness + aspiration mixed, sorted)
  fix_prompt = build_fix_prompt(
    top_blockers_across_panel,         # combines correctness blockers AND aspiration top_blockers
    max = 3,
    sort_by = "severity"               # severity: a11y > ds-tokens > specificity > signature > restraint > others
  )
  snapshot canvas
  apply edit (Edit tool, scoped to top blocker if line N is set; canvas-wide for aspiration fixes)
  validate (tokens link, rootClass)
  if validation fails:
    restore from snapshot
    refresh_docs()
    exit validation-failed

  prev = { correctness, aspiration }

# refresh_docs() is the function spec'd in "Continuous docs maintenance" below.
# It is wired in at every loop exit point — success, stable-but-bland, max-reached,
# divergent, validation-failed. Even --no-critic (loop skipped entirely) calls
# refresh_docs() once after the single edit.
```

**No exit path skips `refresh_docs()`** — that's what makes the design root self-documenting. The only way it gets stale is if the user invokes `Edit` directly on a canvas file outside `/design:edit`, in which case `/design:setup-docs --full` is the recovery.

### Why "stable-but-bland" exists as an exit

If correctness is clean but aspiration plateaus below target for 2 rounds, the loop stops trying to fix. Iterating on a stuck score burns tokens and risks divergence — and the orchestrator has no creative judgment to break the plateau. The right move is surface the canvas to the user with the lowest axes named, so they can give targeted feedback (e.g. "rework the welcome hero — one big shape + overlap, not card stack"). This converts an autonomous-loop limit into a productive handoff, instead of false success.

### Building the fix prompt

For each of the top 3 blockers (sorted by severity = a11y > ds-tokens > scope-specific):

```
Auto-fix iteration {N}: {agent} flagged {blockers} blockers; addressing top {3}:

1. [{category}] line {N}: {summary}
   Fix: {fix from verdict.}

2. ...

Apply ONLY these fixes. Preserve existing tokens, rootClass, and structure. After each fix, the critic will re-run; do not pre-emptively address other findings.
```

The orchestrator uses Edit tool with old_string scoped to the line range from the verdict.

### Default flow vs. `--perfect` — different defaults per command

Two commands, two defaults. **The defaults differ because the leverage differs**:

- `/design:edit "<feedback>"` is incremental — small edit on existing canvas. Default = solid-for-review (max 4 iter, aspiration 4.0). User can iterate cheaply, so over-investing in any one edit is waste.
- `/design:new` is high-leverage scaffold — sets the canvas trajectory for all future iteration. Default = portfolio-grade (`--perfect`: max 8 iter, aspiration 4.5, full panel). Cheap to do right once; expensive to refactor zpětně.

| Command + flag | max_iter | aspiration_target | Critic panel | Auto-fix | Use case |
|---|---|---|---|---|---|
| `/design:edit` (none) | 4 | 4.0 / 5 | routed panel (signature-moment-critic added when polish/nicer/elegant cues in feedback) | yes | typical incremental edit — solid-for-review |
| `/design:edit --perfect [N]` | N (default 8) | 4.5 / 5 | routed panel including signature-moment-critic | yes | "make this right" — extended polish on existing canvas |
| `/design:edit --perfect --all` | N | 4.5 / 5 | **every critic** | yes | exhaustive polish |
| `/design:edit --no-critic` | 0 | n/a | (skip) | no | quick / dirty edit |
| **`/design:new` (none — DEFAULT = `--perfect`)** | **8** | **4.5 / 5** | **signature-moment + design + frontend + a11y (if interactive)** | **yes** | **standard new canvas — portfolio-grade scaffold** |
| `/design:new --perfect-iter N` | N | 4.5 / 5 | same as default | yes | larger / smaller canvases co potřebují víc / míň iterací |
| `/design:new --perfect --all` | 8 | 4.5 / 5 | **every critic** | yes | exhaustive — portfolio + comprehensive coverage |
| `/design:new --quick` | 2 | 4.0 / 5 | signature-moment-critic only | yes | throwaway exploration / proof-of-concept |
| `/design:new --no-critic` | 0 | n/a | (skip) | no | testing / debug — just verify file generates |

**Distinguishing the modes in one line:**
- **`/design:edit` default** = "is this solid enough that the user can productively review it?" → loop until aspiration ≥ 4 + correctness clean + stable.
- **`/design:new` default (= `--perfect`)** = "is this a scaffold worth iterating from?" → loop until aspiration ≥ 4.5 + correctness clean + stable, OR exit `stable-but-bland` with diagnostic. New canvases get the higher bar by default because they set the trajectory for all future iteration.
- **`--perfect` on `/design:edit`** = "treat this incremental edit like a scaffold — broader knobs, higher target."
- **`--quick` on `/design:new`** = "this is a throwaway exploration, don't burn 40 critic calls." Explicit opt-out from default contract.

All modes share the same exit conditions (`SOLID`, `stable-but-bland`, `max-reached`, `divergent`, `validation-failed`) — different `max_iter` / `aspiration_target` / panel just give the loop different rope before tripping them.

### Per-canvas metadata sidecar

Every canvas project under `<designRoot>/<newCanvasDir>/` has a sibling `<Canvas>.meta.json` (schema: `${CLAUDE_PLUGIN_ROOT}/dev-server/canvas-meta.schema.json`). It captures things that aren't readable from the HTML alone — section/artboard labels, brief, platform, iteration count, tokens used.

**`/design:new`** bootstraps the sidecar from the brief:

```jsonc
{
  "title":    "<Name>",
  "subtitle": "<one-line summary from brief>",
  "brief":    "<full brief>",
  "platform": "desktop|mobile|...",
  "created":  "<ISO>",
  "last_modified": "<ISO>",
  "sections": [
    { "id": "main", "label": "<from brief>", "artboards": [
      { "id": "primary", "label": "<from brief>", "platform": "desktop", "width": 1280, "height": 820 }
    ]}
  ],
  "iteration_count": 0,
  "tokens_used": []
}
```

**`/design:edit`** updates the sidecar after every successful edit:
- `last_modified` ← now
- `iteration_count` ++
- `tokens_used` ← `grep -oE 'var\(--[a-z0-9-]+\)' <canvas> | sort -u`
- If a new `<DCSection>` or `<DCArtboard>` was added/removed/relabeled, sync `sections[]` accordingly. Read the JSX `id` and `title` props.

**Why a sidecar (not embedded in HTML):** the file tree in the dev server browser, the handoff bundle, and `/design:handoff` route mapping all need this metadata without parsing JSX. The sidecar is also human-editable (rename a section by editing one JSON field, no need to touch the canvas).

**Handoff bundle includes the sidecar** at the canvas's path, so consuming agents (production code authors) don't have to parse the canvas just to learn what each artboard is.

### Iteration transcript

Every auto-critic iteration appends to `<designRoot>/_history/<slug>/chat.md` — the project's "intent record" (à la Claude Design's `chats/`). The chat is the canonical record of *why* the canvas evolved the way it did. Format:

```markdown
## Iteration {N} — {ISO ts}

**Feedback:** {user feedback verbatim, or "/design:new <brief>"}

**Selection:** {selected.selector or "canvas-wide"}

**Snapshot:** {NNN-ts.bak}

**Edit summary:** {1-line — e.g. "added presence dot before each .roster-row .name"}

**Critic verdict:** {panel members} · blockers {X} → {X'} · {pass | fix-and-retry | divergent}

**Top blockers:** (if X' > 0)
- [{category}] {summary}

---
```

`chat.md` is **committed** (not gitignored) — it's project documentation, like the canvas itself. The plugin runs in the same repo as the implementation, so the chat is always available to anyone reading the source.

### Continuous docs maintenance

The orchestrator calls **`refresh_docs()`** at every exit of the auto-critic loop (see "Auto-critic loop" algorithm above). This is non-skippable — it's the mechanism that keeps `<designRoot>/` self-documenting.

`refresh_docs()` does **incremental** updates by default (only the canvas that changed):

1. **Update `<Canvas>.meta.json` sidecar** (the per-canvas metadata, schema at `dev-server/canvas-meta.schema.json`):
   - `last_modified` ← now (ISO 8601)
   - `iteration_count` ← count of `## Iteration` headers in `_history/<slug>/chat.md`
   - `tokens_used` ← `grep -oE 'var\(--[a-z0-9-]+\)' <canvas> | sort -u`
   - For `/design:new`: also bootstrap `title`, `subtitle` (one-line of brief), `brief` (full), `platform`, `created`, and `sections[]` with `artboards[]` extracted from generated JSX (`DCSection id="..." title="..."` and `DCArtboard id="..." label="..."`).
2. **Update `<designRoot>/INDEX.md`** — find the row for this canvas, replace it; or append if new. Update top-level statistics block (Canvases, Total artboards, Total iterations).
3. **Update `<designRoot>/README.md` "Last updated" line** — the rest of the README is template + extracted hard rules; no need to regenerate unless project metadata changed.

Both files are **committed** (not gitignored) — they're project documentation, not runtime state.

**`/design:setup-docs --full`** triggers full regeneration (rewrite both files from scratch). Used when:
- Project name / config changed
- New `handoffTargets[]` added
- User wants to "snap back" after manual edits

**Auto-marker safeguard.** Both `README.md` and `INDEX.md` carry an HTML comment marker:

```html
<!-- AUTO-MAINTAINED by /design:setup-docs — do not edit by hand. -->
```

Before overwriting, the orchestrator checks the marker. If `<designRoot>/README.md` exists *without* the marker, it's a user-authored README and the refresh refuses (asks user to rename). This protects user content.

**No exit path skips `refresh_docs()`** in `/design:edit` and `/design:new`:

| Exit reason | refresh_docs called? |
|---|---|
| Critic clean (blockers == 0) | ✓ yes |
| Max iterations reached | ✓ yes |
| Divergent (blockers went up) — restored snapshot | ✓ yes |
| Validation failed — restored snapshot | ✓ yes |
| `--no-critic` (loop skipped) | ✓ yes (once, after the single edit) |
| Server / snapshot infrastructure failure | ✗ no (canvas state unknown — manual `/design:setup-docs --full` required) |

### `/design:handoff [--target <label>] [--force]` — production migration

Reads the active canvas. Migrates to one of `handoffTargets` from config. Default target inferred from filename (e.g. `Mobile` → mobile target, `Desktop`/`Studio` → web target) if filename has a hint; otherwise asks the user.

Pre-flight: latest critique should have `blockers == 0`. Override with `--force` only if user explicitly says so.

If `handoffTargets` is empty in config, refuse with: "No handoff targets configured in `.design/config.json`."

### `/design:browse` — boot/show server

Idempotent: if already running, prints URL. Otherwise starts. Useful manually; orchestrator calls it implicitly on every command.

## Generation envelope (frontend-design — for `/design:new`)

The envelope adapts to per-repo config. Read `.design/config.json` (or call `/_config` endpoint) and inject the right values. **Critical: the envelope is a creative brief, NOT a wireframe spec.** See "Envelope discipline" below before authoring one.

```
You are generating a NEW canvas project for the {CFG.name} repo.

Read the project's design system before generating:
  {designRoot}/{tokensCssRel}        # tokens (colors, type, radii, shadows, motion)
  {designRoot}/system/README.md      # design system rationale, if present
  {designRoot}/ui/                   # existing canvases as reference

DO NOT pick fonts, colors, radii, or shadows. Use the CSS variables defined in the tokens file. Use only fonts the tokens CSS already imports.

Reference layouts (read at least one for the wrapper pattern):
{matched existing canvas paths, picked by similarity}

Output: a single self-contained HTML file at <target_path>. The file MUST:
1. <link rel="stylesheet" href="…/{tokensCssRel}"> (relative path resolved from target file)
2. <body class="{CFG.rootClass}" data-theme="{CFG.themeDefault}"{ data-team="…" if CFG.teamAccentDefault}>
3. Use a multi-artboard canvas wrapper (DesignCanvas + DCSection + DCArtboard) — minimum 1 DCArtboard, but expect to grow.
4. Mount React via the same Babel-standalone + react@18.3.1 + react-dom@18.3.1 UMD pattern used in existing canvases.
5. NO inline color/font/radius values — use CSS vars from the tokens file.
6. NO external fonts beyond what the tokens CSS already imports.
7. NO inline images / icons that aren't sourced from the project's assets folder.
8. DO NOT bundle / reference `design-canvas.jsx` or `tweaks-panel.jsx` — the dev server provides them as a single source of truth at `/_runtime/*` and auto-injects them into every served HTML. `DesignCanvas`, `DCSection`, `DCArtboard`, `DCPostIt`, `TweaksPanel`, and `useTweaks` are available as window globals after babel compiles them.

## Aspiration directives (always include — these drive the signature-moment-critic axes)

9. **One signature compositional moment per artboard.** A memorable visual: oversized hero shape, geometric overlap (e.g. card + circle crossing the edge), bold negative space, photographic anchor, or typographic statement at 40px+. Form-letter "icon + headline + body + button" stacks fail this axis.
10. **Brand mark featured at human scale on at least one screen.** Not a 16px corner mark — a wordmark or lockup ≥ 32px in a hero/anchor position.
11. **Realistic mock fidelity, not placeholder rectangles.** Real iOS keyboards have predictive bars and key labels. Real maps have street geometry. Real charts have axis labels. Gray boxes labeled "img" fail this axis.
12. **Restrained color discipline.** Per artboard: 1 primary fill, accent ≤ 3 instances, ≤ 3 type weights, no more than 2 chromatic surfaces. Loud beats subtle once; subtle beats loud everywhere.
13. **Generous negative space.** Hero elements get ≥ 32 px breathing room from artboard edge. Content density target ≤ 60 % per screen; ≤ 40 % for editorial / hero screens.
14. **Specific content, not placeholders.** Real-feeling names (Maya Chen, Pavel Novák), real phone formats (+420 777 123 456), real prices ("$4 / day"), real station names. NEVER use "Lorem", "John Doe", "555-0199", "$XX", or ALL-CAPS placeholder labels.
15. **Element tagging for stable handles.** Every named region (hero, nav, card, list-row, form-field, CTA) gets `data-dc-element="<kebab-id>"`. The id is role-prefixed and brief-specific — e.g. `cta-get-started`, `card-hero`, `list-row-roster`, `field-email`, `nav-item-profile`. Artboards already get `data-dc-screen="<id>"` from the `DCArtboard` runtime; you only need to tag inner elements. This makes screenshots (`screenshot.sh --element <id>`), critic verdicts ("the `card-hero` block uses three different type weights"), and user comments stable across iterations — no fragile `:nth-child` selectors.

User brief:
{the brief}

Plan the artboards based on the brief — typically 1–6 DCArtboards in 1 DCSection, but follow what the brief asks for. The brief tells you WHAT to build; the aspiration directives above tell you HOW WELL.
```

## Envelope discipline — don't over-prescribe

Generative skills (frontend-design, design-system) produce best work when given **constraints + intent**, not a shopping list. When the orchestrator builds the envelope:

✅ **DO:**
- Set the vibe ("studio-grade onboarding, light theme, breathable, editorial")
- Reference 1–2 existing canvases ("look at `<Mobile.html>` for the bezel pattern, `<Studio.html>` for grid")
- List 2–3 hard requirements (tokens link, body class, artboard count target)
- State the **aspiration directives 9–14 verbatim** — those are non-negotiable quality drivers
- Identify ONE signature moment intent per screen if the brief implies it ("welcome must have a memorable compositional anchor")
- Leave element-level decisions to the generator

❌ **DON'T:**
- Dictate "3 permission cards with location pin in orange and bell icon in blue"
- Pre-decide button counts, exact copy, padding values, specific component compositions
- List every UI primitive that should appear on each screen
- Translate the brief into a wireframe spec — the generator should do that

**Test:** if the envelope reads like a wireframe spec, it's too prescriptive. If it reads like a designer brief to a senior IC, it's right. A good envelope is ~30–50 lines including the boilerplate; an over-prescriptive one is 100+.

**Why this matters:** prescriptive envelopes lock the generator to *exactly what was dictated* — competent stock, no creative leap. The signature-moment-critic axis can't be hit if the envelope already pre-decided every element. Less prompting → more invention.

### Canvas runtime — single source of truth

The DesignCanvas / DCSection / DCArtboard / DCPostIt + TweaksPanel + useTweaks helpers live in **`${CLAUDE_PLUGIN_ROOT}/dev-server/runtime/`** (one file per concern). The dev server:

1. Serves them at `/_runtime/<file>` (e.g. `/_runtime/design-canvas.jsx`).
2. Auto-injects `<script type="text/babel" src="/_runtime/design-canvas.jsx">` (and tweaks-panel) into every HTML served from `<designRoot>/`.
3. Strips any legacy local references (`<script src="design-canvas.jsx">` etc.) on the way out so we don't double-load.

This means **bug fixes / improvements to the canvas runtime land instantly across every canvas** (existing and future), and newly-generated canvases never need to copy the runtime locally. `/design:new` envelopes explicitly forbid bundling these scripts.

If you're authoring a new helper that should be shared across all canvases (e.g. a new `<DCPostIt>` variant), add it to a runtime file and it'll be available globally on next page load.

## Cross-skill calls

| Need | How | Notes |
|---|---|---|
| Generate new canvas (for `/design:new`) | See "Generation invocation" below — try Skill, fall back transparently | Required for `/design:new`. Envelope adapts to repo config. |
| Slider explorer | `Skill(skill: "playground:playground", args: <envelope>)` | Optional, only when feedback mentions playground/explorer/tweak/slider. |
| Screenshot canvas | `Bash: bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/screenshot.sh" --full --out "<out>"` | Helper resolves URL from `_server.json` + `_active.json`. Never call `agent-browser` directly. |
| Spawn specialist critic | `Agent(subagent_type: "design-critic" \| "signature-moment-critic" \| ..., ...)` | Subagents run inline (no nested agents). Critics are exposed as `Agent` types from the design plugin. |
| Server lifecycle | `Bash: curl + nohup` | See "Server lifecycle" section. |

### Generation invocation — Skill with documented fallback

`/design:new` and any other code-generation step that needs creative-design output should try **in this order**:

1. **Preferred** — `Skill(skill: "frontend-design:frontend-design", args: <envelope>)`
   - Creative-design specialist. Project-tone awareness, opinionated layout choices.
2. **Fallback** — direct generation via the orchestrator using Read + Write + Edit tools, with the same envelope as the prompt
   - Use when the Skill is unavailable, errors out, or returns the equivalent of "Skill type not found / Agent type 'frontend-design:frontend-design' not found"
   - The orchestrator authors the HTML directly. Quality may be one generation lower (no specialist invocation tone).
3. **Never silently fall back.** Always note which path was taken in the final report. The user must see whether the canvas was generated by the specialist or the orchestrator-as-author. Example wording in the print step:

   ```
   Generation: frontend-design specialist (preferred path)
   ```
   or
   ```
   Generation: orchestrator-direct (frontend-design Skill unavailable — quality may be 1 generation lower; consider /plugin install frontend-design@claude-plugins-official)
   ```

The signature-moment-critic axes will surface quality differences regardless of generation path, but transparency lets the user decide whether to retry after installing the missing skill.

#### Why call the Skill even when the executing model is the same

Common orchestrator anti-pattern: "the Skill just routes back to me — same model executes, no quality delta. I'll skip it." **This is wrong, and skipping the attempt is a process violation.** Even when the same model ultimately produces the HTML, the Skill provides:

- **Specialist tone scaffolding** — system prompt biased toward creative-design conventions, layout opinionatedness, restraint defaults that bare orchestrator-direct authoring lacks
- **Prior creative exemplars** in the Skill's context window — the model "remembers" what good canvas work looks like
- **Fenced creative scope** — the Skill is allowed to choose layouts, the orchestrator is supposed to be coordinating; calling the Skill puts the right hat on
- **Auditability** — final print "Generation: frontend-design specialist" tells the user the preferred path actually fired, vs. silent fallback

**Rule:** always attempt the Skill first. Predicting "it won't help" before observing is the violation, not the quality delta itself. If the Skill errors, that's a fallback case (documented). If you skipped without trying, the final print would lie about the path taken. Try, observe, fall back transparently if it fails.

## Failure modes

| Symptom | Action |
|---|---|
| `_server.json` exists but `kill -0 <pid>` fails | Stale. Delete `_server.json` and start fresh. |
| `_server.json` exists but `curl /_health` fails | Process alive but server hung. Print PID + log path; ask user. Default: kill, restart. |
| Server starts but `/_health` never responds (10s) | Print log path, fail. |
| `_active.json` missing or `active` is null | Print: "No active canvas. Open a file in the browser at <url>, click into it, then retry." |
| `selected.file !== active` (stale selection) | Treat as canvas-wide; mention the staleness once in the response. |
| Selected element's outerHTML appears multiple times in the file | Use dom_path-based context to disambiguate before Edit. |
| Canvas file unreadable | Fail loud with path. |
| Snapshot fails | Refuse to proceed. |
| Edit produces HTML missing tokens link or correct rootClass | Restore from snapshot, report drift. |
| Edit produces HTML with hardcoded colors / non-token fonts | Restore + report. |
| Edit produces JSX inline-style with bare `var(--x)` (unquoted) | Babel parses `var(--x)` as a JS function call; canvas mounts blank. **Lint before write:** `grep -nE "style=\\{\\{[^}]*: var\\(" "$ACTIVE"` should return zero hits. If it doesn't, restore the snapshot and re-issue the edit with quoted CSS strings (`'var(--x)'`) or literal numbers from the radius/size ladder. Retro 2026-05-09 introduced this bug during an opt-out rewrite. |
| `.design/config.json` missing | Use defaults from server `/_config`; warn user once that they're using defaults. |

## What NOT to do

- Never start a second server instance.
- Never edit a canvas without snapshotting first.
- Never silently regenerate from scratch when the user gave incremental feedback.
- Never reach outside the selected element when `selected` is set, unless feedback explicitly says so.
- Never commit `_server.json`, `_active.json`, or `_history/` (gitignored — verify).
- Never spawn nested subagents from a critic — critics run reviews inline.
- **Never scaffold a single-page HTML canvas via `/design:new`** — always use the multi-artboard `DesignCanvas` pattern. Single screens live as a `DCArtboard` inside an existing project canvas (use `/design:edit "<add a new artboard for X>"` on the active canvas, not `/design:new`).
