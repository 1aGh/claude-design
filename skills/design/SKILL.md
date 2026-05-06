---
name: design
description: Local Claude-Design clone for Dugmate. Canvas-first workflow — iterates IN PLACE on existing HTML mocks under .ai/design/. Use when the user gives design feedback (add/change/move/remove something), wants to capture, critique, hand off, or rollback. /design:new scaffolds a new canvas file in .ai/design/ui/project/. Talks to a local dev server (auto-started if missing) that tracks the active tab AND the user's currently selected element via injected inspector.
---

# Dugmate Design — orchestrator (canvas-first, with element selection)

You are the orchestrator for Dugmate's local design-iteration workflow. The mental model: **Dugmate has a fixed set of canvas files** in `.ai/design/ui/project/` and `.ai/design/system/project/`. The user opens one in the browser, optionally selects a specific element with Cmd+Click, then says what they want changed. You read state from disk, snapshot, edit in place.

## Hard contract — non-negotiable

1. **Active canvas + (optional) selected element come first.** Before any edit, read `.ai/design/_active.json`. If `active` is null or the dev server is not running, ensure the server is up and ask the user to open something in the browser.
2. **Snapshot before edit.** Every edit copies the current file to `.ai/design/_history/<file-slug>/<NNN>-<timestamp>.bak` before applying changes. Never skip. This is the undo stack.
3. **In-place edit is the only edit mode.** `/design "<feedback>"` mutates the file under `.ai/design/`. There are no immutable iteration files.
4. **Selection narrows scope.** If `_active.json.selected` is set, the edit applies to that element / region only. Reach outside the selection only if the feedback explicitly says so ("…and update the chrome too").
5. **Tokens stay locked.** Every edit must respect `.ai/design/system/project/colors_and_type.css`. No hardcoded colors / fonts / radii. No removing the `<link>` to tokens. No removing `<body class="dugmate" data-theme="dark">`.
6. **Never edit `.ai/design/_server.json`, `.ai/design/_active.json`, or `_history/`.** Those are runtime state owned by the dev server / orchestrator side-effects.

## Server lifecycle — every command starts here

The dev server is the source of truth for "what is the user looking at right now". Each command must, in order:

1. **Check if running.** Read `.ai/design/_server.json`. If it exists, read `pid`, `port`, `url`. Verify with:
   - `kill -0 <pid>` (process alive?)
   - `curl -fs http://localhost:<port>/_health` (responds with `{"app":"design",...}`)
   - If both pass: server is up, use this URL.
   - If either fails: stale info file, treat as not running.
2. **If not running, auto-start.** Spawn in the background:
   ```bash
   nohup node .claude/plugins/design/dev-server/server.mjs \
     > .ai/design/_server.log 2>&1 &
   disown
   ```
   Then poll `_server.json` + `/_health` for up to ~10 seconds. If it doesn't come up, fail with the log path.
3. **Browser** — server auto-opens on its own boot (unless `NO_OPEN=1`). The orchestrator does not open browsers.

**Never start a second instance** if `_server.json` says one is alive on a port that responds to `/_health`.

## Active state schema

```jsonc
// .ai/design/_active.json
{
  "active": ".ai/design/ui/project/Dugmate Mobile.html",
  "open_tabs": [
    ".ai/design/ui/project/Dugmate Studio.html",
    ".ai/design/ui/project/Dugmate Mobile.html"
  ],
  "selected": {
    "file": ".ai/design/ui/project/Dugmate Mobile.html",
    "selector": "body.dugmate > div.iphone-frame > section.card:nth-child(3) > div.row:nth-child(2)",
    "tag": "div",
    "classes": "row playbook-row",
    "text": "Roster row 1",
    "dom_path": ["body.dugmate", "div.iphone-frame", "section.card:nth-child(3)", "div.row:nth-child(2)"],
    "bounds": { "x": 245, "y": 312, "w": 280, "h": 56 },
    "html": "<div class=\"row playbook-row\">…</div>",
    "ts": "2026-05-07T08:14:00.000Z"
  },
  "last_change": "2026-05-07T08:14:00.000Z",
  "session_started": "2026-05-07T07:50:00.000Z"
}
```

`active` = the tab the user clicked last. `selected` = element the user Cmd+Clicked inside the canvas (cleared automatically when the active tab switches; cleared on Esc inside the iframe; persists otherwise).

If `selected.file !== active`, the selection is stale (tab was switched but server didn't yet clear it on its side — race). Treat as canvas-wide.

## Snapshot protocol

Before EVERY mutation:

```bash
file_to_edit = activeState.active                 # e.g. .ai/design/ui/project/Dugmate Mobile.html
slug = slugify(file_to_edit)                      # e.g. ai-design-ui-project-dugmate_mobile
hist = .ai/design/_history/<slug>/
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
   - `<link>` to `colors_and_type.css` still present
   - `<body class="dugmate" data-theme="dark">` still present
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

### `/design:new <name> "<brief>"` — scaffold new canvas file

Creates a brand-new HTML file in `.ai/design/ui/project/<Name>.html` (or `.ai/design/ui/project/components/<Name>.jsx` if the user says component). Generated by `frontend-design` plugin with the Dugmate envelope.

1. Validate `<name>`:
   - For full-screen canvas: title-case with optional spaces (`Match Recap`, `Scout Radar`). File: `<Name>.html` or `<Name> Mobile.html`.
   - For component: PascalCase (`MatchRecap`, `ScoutRadar`). File: `components/<Name>.jsx`.
2. Reject if file already exists. Suggest `<Name> v2`.
3. Generate via `Skill(skill: "frontend-design:frontend-design", args: <envelope>)` with the Dugmate locked-in aesthetic (see Generation envelope).
4. Validate output (link to tokens, `class="dugmate"`, no hardcoded values).
5. Write the file. Print path + "click on it in the browser tree to make it active, then iterate with /design".

Sessions and `.ai/design-sessions/` no longer exist. New surface = new file in `.ai/design/ui/project/`.

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

Use the dev server's URL (`http://localhost:<port>/.ai/design/...`), not `file://` — the server handles relative imports correctly.

If `_active.json.selected` is set and the user passed no `--selector`, default the screenshot selector to the selected element's `selector`. The screenshot will be just the focused element.

### `/design:critic` — UX + DS critique

Spawns the `design-critic` subagent against the active canvas. Subagent reads:
- The canvas file
- Latest screenshot (or captures one first)
- `.ai/design/system/project/colors_and_type.css` + `README.md`
- `.claude/skills/ux-designer/SKILL.md` + `.claude/agents/design-system-guard.md`
- If `selected` is set, includes selector + dom_path so critique can be element-scoped

Output: `_history/<slug>/critique/<NNN>-design-critic.md` (gitignored).

### `/design:handoff [--target apps/web|apps/mobile] [--force]` — production migration

Reads the active canvas. Same conversion logic as before. Default target inferred from filename (`Mobile` → `apps/mobile`, `Studio`/`Desktop` → `apps/web`).

Pre-flight: latest critique should have `blockers == 0`. Override with `--force` only if user explicitly says so.

### `/design:browse` — boot/show server

Idempotent: if already running, prints URL. Otherwise starts. Useful manually; orchestrator calls it implicitly on every command.

## Generation envelope (frontend-design — for `/design:new`)

```
You are generating a NEW canvas file for Dugmate. Dugmate has a fixed, non-negotiable design system.

DO NOT pick fonts, colors, radii, or shadows. Use the tokens defined in:
  .ai/design/system/project/colors_and_type.css

The aesthetic IS Inter (body) + IBM Plex Sans (headings) + JetBrains Mono (numbers/timecodes/IDs)
on a zinc-950 dark surface ladder, accent #00D4E4 (overridable per team).
"Studio-grade pro tool, dark by default" — quiet, dense, keyboard-first.

Reference layouts (read these before generating):
{matched_component path, if any}
{matched_chat path, if any}
{surface kind: mobile / desktop}

Output: a single self-contained HTML file at <target_path>. The file MUST:
1. <link rel="stylesheet" href="../../system/project/colors_and_type.css"> (2-up from .ai/design/ui/project/<file>.html)
2. <body class="dugmate" data-theme="dark">
3. Mount React via the same Babel-standalone + react@18.3.1 + react-dom@18.3.1 UMD pattern used in
   .ai/design/system/project/ui_kits/desktop/index.html
4. NO inline color/font/radius values — use CSS vars (--bg-0..4, --fg-0..3, --accent, --radius-*, --space-*).
5. NO external fonts beyond what colors_and_type.css already imports.
6. NO inline images / icons that aren't sourced from .ai/design/system/project/assets/.

User brief:
{the brief}

Apply ONLY the brief. Do not editorialize the design system.
```

## Cross-skill calls

| Need | How | Notes |
|---|---|---|
| Generate new canvas (for `/design:new`) | `Skill(skill: "frontend-design:frontend-design", args: <envelope>)` | Required for `/design:new`. |
| Slider explorer | `Skill(skill: "playground:playground", args: <envelope>)` | Optional, only when feedback mentions playground/explorer/tweak/slider. |
| Screenshot canvas | `Bash: agent-browser screenshot ...` | Use server URL, not `file://`. |
| Spawn design-critic | `Agent(subagent_type: "design-critic", ...)` | Subagent runs UX + DS review inline (no nested agents). |
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
| Edit produces HTML missing tokens link or `class="dugmate"` | Restore from snapshot, report drift. |
| Edit produces HTML with hardcoded colors / non-token fonts | Restore + report. |

## What NOT to do

- Never start a second server instance.
- Never edit a canvas without snapshotting first.
- Never silently regenerate from scratch when the user gave incremental feedback.
- Never reach outside the selected element when `selected` is set, unless feedback explicitly says so.
- Never commit `_server.json`, `_active.json`, or `_history/` (gitignored — verify).
- Never edit `.ai/design-import/` (read-only historical bundle).
- Never spawn nested subagents from `design-critic` — it runs reviews inline.
- Never resurrect the `.ai/design-sessions/` concept — sessions were retired in favour of canvas-first iteration.
