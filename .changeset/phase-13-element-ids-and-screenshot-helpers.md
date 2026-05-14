---
"@1agh/md-claude": minor
---

design plugin: stable element-id schema + canonical screenshot pipeline + shared bash helpers

**New user-visible flags on `/design:screenshot`:**

- `--screen <id>` — capture one artboard by `data-dc-screen` id (or legacy `data-dc-slot`)
- `--element <id>` — capture one named region by `data-dc-element` id
- `--all-screens` — loop over every artboard, write `<NNN>-screen-<id>.png` per artboard
- existing `--full` / `--selector <css>` / `--area <name>` retained

**Stable element-id schema in generated canvases:**

- `DCArtboard` runtime now renders `data-dc-screen="<id>"` alongside the legacy `data-dc-slot` (same value). Backwards-compatible — existing canvases keep working.
- `/design:new` / `/design:edit` envelope directive 15 instructs `frontend-design` to tag named regions (heroes, CTAs, list rows, form fields) with `data-dc-element="<kebab-id>"`. Stable handles for comments, screenshots, and critic verdicts across iterations.
- Inspector (`server.mjs` `cssPath()` / `domPath()`) now prefers `[data-dc-element]` → `[data-dc-screen]` → `#id` → `:nth-child`. Cmd+Click on a tagged element yields a stable selector instead of fragile `:nth-child(3)`.

**Canonical bash helpers under `plugins/design/dev-server/bin/`** (shipped via npm, called from slash commands and critics):

- `screenshot.sh` — wraps `agent-browser` with `npx playwright` fallback; handles URL resolution, mount poll, per-screen loop, engine selection
- `bootstrap-check.sh` — detects `.design/config.json` + DS folders; exit 0/10/11; modes: default / `--json` / `--shell-export`
- `server-up.sh` — server lifecycle (PID + `/_health` check, respawn, 10s poll); stdout = port
- `slug.sh` — single source of truth for `_history/<slug>/` path normalization

**Bug fix:** `signature-moment-critic.md` previously referenced `[data-artboard-id]` — a selector that no runtime ever emitted, silently falling back to `--full` and losing per-artboard discipline. Renamed to `data-dc-screen` (sweep across the plugin).

**Refactor:** inline `agent-browser navigate + screenshot` bash blocks removed from `commands/{screenshot,new,edit,setup-ds}.md`, `skills/design/SKILL.md`, `skills/design-system/SKILL.md`, `agents/design-critic.md`, `agents/signature-moment-critic.md`. All callers now invoke the helper.

See DDR-007 (element-id schema) and DDR-008 (helper home) for the architectural rationale.
