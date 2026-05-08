---
name: design
description: Local Claude-Design clone — canvas-first design iteration. Iterates IN PLACE on existing HTML mocks under the project's design root (default `.design/`). Use when the user gives design feedback (add/change/move/remove something), wants to capture, critique, hand off, or rollback. `/design:new` scaffolds a new canvas. Talks to a local dev server (auto-started if missing) that tracks the active tab AND the user's currently selected element via injected inspector.
---

# Design — orchestrator (canvas-first, with element selection)

You are the orchestrator for local design-iteration. The mental model: **the project has a fixed set of canvas files** under `<designRoot>/system/...` (design system specimens) and `<designRoot>/ui/...` (project surfaces). The user opens one in the browser, optionally selects a specific element with Cmd+Click, then says what they want changed. You read state from disk, snapshot, edit in place.

**Per-repo config.** All project-specific values come from `<repo>/.design/config.json` (schema at `.claude/plugins/design/dev-server/config.schema.json`). Key fields you need:

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

## Hard contract — non-negotiable

1. **Active canvas + (optional) selected element come first.** Before any edit, read `<designRoot>/_active.json`. If `active` is null or the dev server is not running, ensure the server is up and ask the user to open something in the browser.
2. **Snapshot before edit.** Every edit copies the current file to `<designRoot>/_history/<file-slug>/<NNN>-<timestamp>.bak` before applying changes. Never skip. This is the undo stack.
3. **In-place edit is the only edit mode.** `/design "<feedback>"` mutates the file under `<designRoot>`. There are no immutable iteration files.
4. **Selection narrows scope.** If `_active.json.selected` is set, the edit applies to that element / region only. Reach outside the selection only if the feedback explicitly says so ("…and update the chrome too").
5. **Tokens stay locked.** Every edit must respect the project's tokens CSS (`<designRoot>/<tokensCssRel>`). No hardcoded colors / fonts / radii. No removing the `<link>` to tokens. No removing `<body class="<rootClass>" data-theme="…">`.
6. **Never edit `<designRoot>/_server.json`, `<designRoot>/_active.json`, or `_history/`.** Those are runtime state owned by the dev server / orchestrator side-effects.
7. **Never edit `.design/config.json` without explicit user instruction** — it's the per-repo source of truth.

## Server lifecycle — every command starts here

The dev server is the source of truth for "what is the user looking at right now". Each command must, in order:

1. **Check if running.** Read `<designRoot>/_server.json`. If it exists, read `pid`, `port`, `url`. Verify with:
   - `kill -0 <pid>` (process alive?)
   - `curl -fs http://localhost:<port>/_health` (responds with `{"app":"design",…}`)
   - If both pass: server is up, use this URL.
   - If either fails: stale info file, treat as not running.
2. **If not running, auto-start.** Spawn in the background:
   ```bash
   nohup node .claude/plugins/design/dev-server/server.mjs \
     > <designRoot>/_server.log 2>&1 &
   disown
   ```
   Then poll `_server.json` + `/_health` for up to ~10 seconds. If it doesn't come up, fail with the log path.
3. **Browser** — server auto-opens on its own boot (unless `NO_OPEN=1`). The orchestrator does not open browsers.

**Never start a second instance** if `_server.json` says one is alive on a port that responds to `/_health`.

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

**Orchestrator behaviour for `/design "<feedback>"`:**

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

### `/design "<feedback>" [--screenshot <path>]` — primary flow

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
8. **Tell the user.** Print: file edited, line range changed, snapshot id, "reload iframe (Cmd+R inside the canvas tab)".

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

### `/design:new <name> "<brief>"` — scaffold new canvas project

Creates a brand-new HTML canvas file in `<designRoot>/<newCanvasDir>/<Name>.html` (or `<newComponentDir>/<Name>.jsx` if the user explicitly says component). Generated via the `frontend-design` plugin, scoped to the project's design system.

**The new file MUST be a multi-artboard canvas project**, not a single-page wrapper. It uses the `DesignCanvas` + `DCSection` + `DCArtboard` pattern (see existing examples in `<designRoot>/ui/`) so multiple screens live in one panable canvas. A bare single-page wrapper is an anti-pattern unless the user explicitly says so.

1. Validate `<name>`:
   - For canvas project: title-case with optional spaces (`Match Recap`, `Scout Radar`). File: `<Name>.html`.
   - For shared component: PascalCase (`MatchRecap`). File: `<newComponentDir>/<Name>.jsx`.
2. Reject if file already exists. Suggest `<Name> v2`.
3. Generate via `Skill(skill: "frontend-design:frontend-design", args: <envelope>)` — see "Generation envelope" below.
4. Validate output (link to tokens, correct rootClass, no hardcoded values, includes at least one `DCArtboard`).
5. Write the file. Print path + "click on it in the browser tree to make it active, then iterate with /design".

### `/design:rollback [--steps N] [--list]` — undo

Restores the last snapshot of the active canvas. With `--steps N`, restores N back. `--list` prints history without restoring.

1. Read `_active.json.active` → file path.
2. Compute `<slug>` and look in `_history/<slug>/`.
3. List snapshots, sorted descending. Take element [N-1] (default N=1 = most recent).
4. **Snapshot the CURRENT state first** (rollback is itself reversible).
5. Copy chosen snapshot back over the canvas file.
6. Print: which snapshot restored, current snapshot count.

### `/design:screenshot [--area <name>] [--selector <css>]` — capture

Operates on `_active.json`. Default `area = "full"`. Output goes to `_history/<slug>/screenshots/<NNN>-<area>.png` (gitignored).

```bash
agent-browser screenshot "<server_url>/<active_path>" --output "<out>" [--selector "<css>"]
```

Use the dev server's URL (`http://localhost:<port>/<designRoot>/...`), not `file://` — the server handles relative imports correctly.

If `_active.json.selected` is set and the user passed no `--selector`, default the screenshot selector to the selected element's `selector`. The screenshot will be just the focused element.

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
| `typography-critic` |   | `HAS_TYPE_HEAVY > 5` OR feedback mentions `font|type|leading|measure|tracking|hierarchy` |
| `motion-critic` |   | `HAS_ANIM > 0` OR feedback mentions `animation|transition|motion|prefers-reduced` |
| `brand-critic` |   | `HAS_LOGO > 0` OR feedback mentions `brand|logo|voice|tone|asset|illustration|photography` |
| `copy-critic` |   | `HAS_USER_STRINGS > 0` OR feedback mentions `copy|microcopy|text|label|empty state|error message` |
| `frontend-critic` |   | `HAS_HEAVY_JSX > 10` OR feedback mentions `code|jsx|component|hook|prop|key warning|render` |
| `info-architecture-critic` |   | `HAS_NAV > 0` OR feedback mentions `nav|navigation|hierarchy|menu|breadcrumb|search|filter|sitemap` |
| `graphic-design-critic` |   | feedback mentions `composition|layout|visual|hierarchy|balance|density|rhythm|alignment|spacing` |

If the routing produces just `design-critic + a11y-critic` (minimum panel), that's fine — those two cover most baseline-quality cases. The conditional ones fire when the canvas / feedback genuinely calls for them.

The **selected element** narrows the same routing — if `_active.json.selected` is set, run grep on the selected element's outerHTML instead of the whole canvas. (Targeted critique = targeted panel.)

### Spawning the panel

The orchestrator spawns the picked critics **in parallel** with one message containing N `Agent` tool calls. Each critic writes its own report; the orchestrator parses each JSON verdict, aggregates, and writes `<NNN>-PANEL.md`.

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

## Auto-critic loop — default behavior of /design and /design:new

After every successful edit/generate, the orchestrator runs auto-critic by default. The user can opt out with `--no-critic`, or escalate with `--perfect [N]`.

### Algorithm

```
max_iter = 2 (default flow) | N (--perfect, default 5)
prev_blockers = ∞
best_snapshot = none
best_blockers = ∞

# Always append iteration 0 to chat.md (initial edit / generate)
append_to_chat_md(iter=0, feedback, selected, snapshot_id, edit_summary, critic_verdict=null)

for iter in 1..max_iter:
  # 1. Run critic panel (routing logic above)
  panel = pick_panel(canvas, feedback, selected)
  spawn panel in parallel
  parse JSON verdicts → aggregate → total_blockers
  write iter NNN-PANEL.md

  # 2. Update best-snapshot tracking
  if total_blockers < best_blockers:
    best_blockers = total_blockers
    best_snapshot = current_snapshot_id (NNN-ts.bak)

  # 3. Append this iteration to chat.md
  append_to_chat_md(iter, feedback, selected, snapshot_id, edit_summary, critic_verdict)

  # 4. Exit conditions (in order)
  if total_blockers == 0:
    refresh_docs()                  # see "Continuous docs maintenance" — required
    print "✓ panel clean"
    exit success

  if iter == max_iter:
    print "⚠ max iterations reached, {best_blockers} blockers remain"
    if best_snapshot != current:
      restore best_snapshot
      print "↺ restored to best (iter {best_iter}, {best_blockers} blockers)"
    refresh_docs()                  # always refresh, even on imperfect exit
    exit max-reached

  # 5. Divergence check — stop-loss
  if total_blockers > prev_blockers:
    print "✗ divergence: blockers went {prev_blockers} → {total_blockers}; stopping"
    restore best_snapshot
    refresh_docs()
    exit divergent

  # 6. Auto-fix — craft prompt from top blockers
  fix_prompt = build_fix_prompt(top_blockers_across_panel, max=3)
  snapshot canvas
  apply edit (Edit tool, scoped to top blocker if line N is set)
  validate (tokens link, rootClass)
  if validation fails:
    restore from snapshot
    refresh_docs()
    exit validation-failed

  prev_blockers = total_blockers

# refresh_docs() is the function spec'd in "Continuous docs maintenance" below.
# It is wired in at every loop exit point — success, max-reached, divergent, validation-failed.
# Even --no-critic (loop skipped entirely) calls refresh_docs() once after the single edit.
```

**No exit path skips `refresh_docs()`** — that's what makes the design root self-documenting. The only way it gets stale is if the user invokes `Edit` directly on a canvas file outside `/design`, in which case `/design:docs --full` is the recovery.

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

### Default flow vs. `--perfect`

| Flag | max_iter | Critic panel | Auto-fix | Use case |
|---|---|---|---|---|
| (none) | 2 | routed panel | yes | every /design and /design:new — baseline quality gate |
| `--no-critic` | 0 | (skip) | no | quick / dirty edit |
| `--perfect [N]` | N (default 5) | routed panel | yes | "make this right" — N iterations of edit→panel→fix |
| `--perfect --all` | N | every critic | yes | exhaustive polish |

### Per-canvas metadata sidecar

Every canvas project under `<designRoot>/<newCanvasDir>/` has a sibling `<Canvas>.meta.json` (schema: `.claude/plugins/design/dev-server/canvas-meta.schema.json`). It captures things that aren't readable from the HTML alone — section/artboard labels, brief, platform, iteration count, tokens used.

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

**`/design`** updates the sidecar after every successful edit:
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

**`/design:docs --full`** triggers full regeneration (rewrite both files from scratch). Used when:
- Project name / config changed
- New `handoffTargets[]` added
- User wants to "snap back" after manual edits

**Auto-marker safeguard.** Both `README.md` and `INDEX.md` carry an HTML comment marker:

```html
<!-- AUTO-MAINTAINED by /design:docs — do not edit by hand. -->
```

Before overwriting, the orchestrator checks the marker. If `<designRoot>/README.md` exists *without* the marker, it's a user-authored README and the refresh refuses (asks user to rename). This protects user content.

**No exit path skips `refresh_docs()`** in `/design` and `/design:new`:

| Exit reason | refresh_docs called? |
|---|---|
| Critic clean (blockers == 0) | ✓ yes |
| Max iterations reached | ✓ yes |
| Divergent (blockers went up) — restored snapshot | ✓ yes |
| Validation failed — restored snapshot | ✓ yes |
| `--no-critic` (loop skipped) | ✓ yes (once, after the single edit) |
| Server / snapshot infrastructure failure | ✗ no (canvas state unknown — manual `/design:docs --full` required) |

### `/design:handoff [--target <label>] [--force]` — production migration

Reads the active canvas. Migrates to one of `handoffTargets` from config. Default target inferred from filename (e.g. `Mobile` → mobile target, `Desktop`/`Studio` → web target) if filename has a hint; otherwise asks the user.

Pre-flight: latest critique should have `blockers == 0`. Override with `--force` only if user explicitly says so.

If `handoffTargets` is empty in config, refuse with: "No handoff targets configured in `.design/config.json`."

### `/design:browse` — boot/show server

Idempotent: if already running, prints URL. Otherwise starts. Useful manually; orchestrator calls it implicitly on every command.

## Generation envelope (frontend-design — for `/design:new`)

The envelope adapts to per-repo config. Read `.design/config.json` (or call `/_config` endpoint) and inject the right values:

```
You are generating a NEW canvas project for the {CFG.name} repo.

Read the project's design system before generating:
  {designRoot}/{tokensCssRel}        # tokens (colors, type, radii, shadows, motion)
  {designRoot}/system/README.md      # design system rationale, if present
  {designRoot}/ui/                   # existing canvases as reference

DO NOT pick fonts, colors, radii, or shadows. Use the CSS variables defined in the tokens file. Use only fonts the tokens CSS already imports.

Reference layouts (read these before generating):
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

User brief:
{the brief}

Apply ONLY the brief. Do not editorialize the design system.
```

### Canvas runtime — single source of truth

The DesignCanvas / DCSection / DCArtboard / DCPostIt + TweaksPanel + useTweaks helpers live in **`.claude/plugins/design/dev-server/runtime/`** (one file per concern). The dev server:

1. Serves them at `/_runtime/<file>` (e.g. `/_runtime/design-canvas.jsx`).
2. Auto-injects `<script type="text/babel" src="/_runtime/design-canvas.jsx">` (and tweaks-panel) into every HTML served from `<designRoot>/`.
3. Strips any legacy local references (`<script src="design-canvas.jsx">` etc.) on the way out so we don't double-load.

This means **bug fixes / improvements to the canvas runtime land instantly across every canvas** (existing and future), and newly-generated canvases never need to copy the runtime locally. `/design:new` envelopes explicitly forbid bundling these scripts.

If you're authoring a new helper that should be shared across all canvases (e.g. a new `<DCPostIt>` variant), add it to a runtime file and it'll be available globally on next page load.

## Cross-skill calls

| Need | How | Notes |
|---|---|---|
| Generate new canvas (for `/design:new`) | `Skill(skill: "frontend-design:frontend-design", args: <envelope>)` | Required for `/design:new`. Envelope adapts to repo config. |
| Slider explorer | `Skill(skill: "playground:playground", args: <envelope>)` | Optional, only when feedback mentions playground/explorer/tweak/slider. |
| Screenshot canvas | `Bash: agent-browser screenshot ...` | Use server URL, not `file://`. |
| Spawn specialist critic | `Agent(subagent_type: "design-critic" \| "graphic-critic" \| ..., ...)` | Subagents run inline (no nested agents). |
| Server lifecycle | `Bash: curl + nohup` | See "Server lifecycle" section. |

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
| `.design/config.json` missing | Use defaults from server `/_config`; warn user once that they're using defaults. |

## What NOT to do

- Never start a second server instance.
- Never edit a canvas without snapshotting first.
- Never silently regenerate from scratch when the user gave incremental feedback.
- Never reach outside the selected element when `selected` is set, unless feedback explicitly says so.
- Never commit `_server.json`, `_active.json`, or `_history/` (gitignored — verify).
- Never spawn nested subagents from a critic — critics run reviews inline.
- **Never scaffold a single-page HTML canvas via `/design:new`** — always use the multi-artboard `DesignCanvas` pattern. Single screens live as a `DCArtboard` inside an existing project canvas (use `/design "<add a new artboard for X>"` on the active canvas, not `/design:new`).
