# DDR-004: Flow commands use `<group>-<verb>` prefix; subdirectory namespacing is not viable

- **Date:** 2026-05-13
- **Status:** Accepted
- **Tags:** flow, naming, plugin-design, slash-commands, ux, deprecation
- **Related:** `.ai/plans/archive/phase-13-flow-command-categorization.md`, `plugins/flow/CATEGORIES.md`, `plugins/flow/commands/help.md`, `CLAUDE.md` (§ Flow command naming)

## Context

The flow plugin shipped 26 flat `/flow:*` commands during Phases 1–3. With Phase 3 adding `/flow:release` + `/flow:release-changelog`, the list reached 28 and the lack of structure started biting:

- `/help` listed commands alphabetically; daily verbs mixed with bootstrap, with hygiene, with knowledge capture. No structural signal for a new user.
- Naming was half-applied: `bug-*`, `validate-*`, `maintain-*` already followed a prefix; `onboard`, `ddr`, `retro`, `code-review`, `ai-health`, `execution-report`, `context`, `create-prd`, `map-codebase` did not.
- No authoritative document declared groups; each new command picked its name ad-hoc; categorization drifted.

The intuitive fix is filesystem subdirectories — `plugins/flow/commands/bug/fix.md` → `/flow:bug:fix`. We investigated:

- **Claude Code does not support subdirectory namespacing for slash commands.** [Issue #2422](https://github.com/anthropics/claude-code/issues/2422) was closed as "not planned". [Issue #44678](https://github.com/anthropics/claude-code/issues/44678) is an open feature request (April 2026) with no implementation.
- The plugins reference explicitly states `commands/` is **flat .md files**. Subdirs are interpreted as skill folders (one `SKILL.md` per subdir = one skill named after the subdir), not as group-namespace prefixes.

That left us with two viable options for signalling group membership:

1. **Strict naming convention** (`<group>-<verb>` filename + `category:` frontmatter + docs).
2. Plugin-side filtering UI (custom `/flow:help` aggregator that hides the alphabet noise).

## Decision

Adopt **both**, with the naming convention as load-bearing:

1. **Naming convention.** Every non-daily flow command must be named `<group>-<verb>.md` (kebab-case). Daily commands — verbs called every feature cycle — keep terse names (`plan`, `execute`, `done`, `validate`, `release`, `status`, `pause`, `resume-task`, `scenario`, `quick`, `help`). The `name:` frontmatter field equals the filename without `.md`.
2. **`category:` frontmatter field.** Required on every live command. Value matches the filename prefix and is one of nine canonical groups: `daily`, `utils`, `setup`, `validate`, `bug`, `record`, `maintain`, `review`, `release`. Compat stubs use `category: deprecated`.
3. **Canonical catalog at `plugins/flow/CATEGORIES.md`.** One section per group, member list, rename history footer.
4. **`/flow:help` aggregator.** Reads `category:` frontmatter at run-time and renders the grouped index — no drift between catalog and reality.
5. **Backwards-compatible stubs** under the 11 old filenames. Each stub has `category: deprecated` and a one-line redirect message naming the new slash command.

Prefix-based autocomplete (`/flow:bug-` → `bug-rca` + `bug-fix`) is the working substitute for nested namespacing. Typing `/flow:setup-` narrows to setup-* only, `/flow:record-` to record-* only, etc.

### Acronym rule

**Strict consistency wins over recognized-acronym exception.** DDR is an established acronym in software architecture, so `record-ddr` reads "Record Design Decision Record" — a stutter. We accepted it. Every non-daily command gets a group prefix; no exceptions. The stutter is the cost of zero-exception consistency. Documented in `CATEGORIES.md` footnote.

### Compat-stub removal target

**The 11 deprecated stubs ship for one minor version and are removed in v0.6.0.** That includes:

- `verify.md`, `onboard.md`, `create-prd.md`, `map-codebase.md`, `context.md`, `ddr.md`, `retro.md`, `execution-report.md`, `ai-health.md`, `discover.md`, `code-review.md`

Each stub file carries a `<!-- TODO: remove this stub after v0.6.0 ships -->` comment so the removal sweep is mechanical.

The next minor bump after Phase 13 (currently `0.5.0`) is `0.6.0`. The expected ETA is **mid-to-late 2026**, coinciding with Phase 4 (canvas v2 rendering) shipping. If Phase 4 slips past 2026 Q4, revisit this date in a follow-up DDR rather than letting the stubs linger indefinitely.

## Consequences

**Positive**

- Prefix autocomplete is now meaningful: typing `/flow:bug-` shows only bug-* commands.
- `/flow:help` is a single source of truth; new commands appear automatically via their `category:` field.
- `CATEGORIES.md` is the contract for "where does a new command go?"
- `plugin.json` description no longer has to enumerate every command — it advertises the grouped surface.

**Negative**

- `record-ddr` reads "Record Design Decision Record" stutter (accepted cost; see Acronym rule above).
- 11 compat stubs add file-count noise to `commands/` until v0.6.0.
- Anyone reading old `.ai/plans/` or release notes will see `/flow:onboard` / `/flow:ddr` / etc. and need to mentally remap. The rename-history tables in `CATEGORIES.md` and `/flow:help` mitigate this.

**Future-locked**

- New non-daily commands MUST start with one of the nine group prefixes. If a genuinely new category emerges (e.g. `metrics-*`, `migrate-*`), extending `CATEGORIES.md` requires a new DDR — the catalog is the schema.
- Daily-promotion (no prefix) is reserved for verbs called every feature cycle. Promoting a command into `daily` retroactively (e.g. `maintain-docs` → `docs`) requires a DDR.

## Alternatives considered

- **Subdirectory namespacing** (`commands/bug/fix.md` → `/flow:bug:fix`). Not supported by Claude Code. Rejected on research grounds, not aesthetic.
- **Single colon separator** (`/flow:bug:fix`). Same blocker — the plugin runtime sees `bug:fix` as a single command name; the colon has no special meaning.
- **No prefix, ship `/flow:help` only.** Solves discovery (group via frontmatter) but not autocomplete UX (typing `/flow:` still shows all 28). Rejected — autocomplete is the dominant entry point.
- **Acronym exceptions for `ddr`, `prd`, `rca`.** Tempting but creates a creeping carve-out list. Rejected. The convention is its own enforcement.

## Implementation

Phase 13 (this DDR's parent plan) executed:

- 11 `git mv` renames under `plugins/flow/commands/`.
- `category:` frontmatter added to every live command; `name:` normalized to match filename.
- 11 deprecated stubs authored.
- `/flow:help` aggregator authored.
- `CATEGORIES.md`, `plugins/flow/README.md`, root `README.md`, `CLAUDE.md` updated.
- Full reference sweep across the repo including hidden directories (`.ai/`, `.github/`, `plugins/flow/.claude-plugin/`).

See `.ai/plans/archive/phase-13-flow-command-categorization.md` for the plan + retro.
