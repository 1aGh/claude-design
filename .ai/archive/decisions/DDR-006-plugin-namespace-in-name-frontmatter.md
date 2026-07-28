# DDR-006: Plugin commands/skills/agents declare `name: <plugin>:<slug>` in frontmatter; `init` is the lone bare-verb exception

- **Date:** 2026-05-13
- **Status:** **Superseded by [DDR-191](./DDR-191-revert-plugin-name-prefix-claude-code-now-namespaces.md)** (2026-07-28) — the upstream Claude Code bug this DDR worked around was fixed (2.1.216), and baking the prefix into `name:` now doubles it (`/design:design:new`). Kept for history; do not follow the "Decision" section below.
- **Tags:** flow, design, plugin-design, slash-commands, naming, deprecation
- **Related:** [DDR-004](./DDR-004-flow-command-naming-prefix-convention.md), `plugins/flow/CATEGORIES.md`, `plugins/design/CATEGORIES.md`, `plugins/{flow,design}/commands/help.md`, `CLAUDE.md` (§ Flow command naming, § Design system bootstrap), Claude Code [issue #22063](https://github.com/anthropics/claude-code/issues/22063), [issue #43695](https://github.com/anthropics/claude-code/issues/43695)

## Context

DDR-004 established `<group>-<verb>` filename convention for flow commands. We assumed Claude Code would surface plugin commands in autocomplete as `/<plugin>:<command>` automatically — that's how plugin **skills** are documented to behave (Claude Code docs: *"Plugin skills use a `plugin-name:skill-name` namespace, so they cannot conflict with other levels."*).

In practice, plugin **commands** (flat `.md` files under `plugins/<x>/commands/`) did **not** get the namespaced form when `name:` was set in frontmatter. The symptom:

- `plugins/flow/commands/resume.md` with `name: resume` registered as **bare `/resume`** in autocomplete, colliding with Claude Code's built-in `/resume` (resume previous conversation).
- All 33 flow commands and 11 design commands behaved the same way — the `<plugin>:` prefix never appeared.
- The collision was hidden until a flow command happened to share a name with a built-in (`/resume` was the canary).

Root cause is a known Claude Code bug: setting `name:` in plugin command frontmatter strips the plugin namespace prefix during registration. [Issue #22063](https://github.com/anthropics/claude-code/issues/22063) documents it for skills; the same behavior applies to flat commands. The companion feature request [#43695](https://github.com/anthropics/claude-code/issues/43695) ("Plugin skills: option to require namespace-qualified invocation") is open and unresolved.

We considered three workarounds:

1. **Remove `name:` from frontmatter entirely** — Claude Code falls back to the filename. But our `/flow:help` and `/design:help` rendering depends on parsing `name:` to build the grouped index; removing the field would break them or require parallel filename-tracking logic.
2. **Rename colliding commands** (`resume` → `unpause`) — local fix for one collision. Doesn't prevent the next collision and doesn't solve the structural namespacing gap. Discoverability for new commands stays poor.
3. **Promote `name:` to the fully-qualified slash name** (`name: flow:resume` instead of `name: resume`). Empirically tested on `plugins/flow/commands/resume.md` first; after `/plugin marketplace update` + `/reload-plugins`, autocomplete showed `/flow:resume` namespaced as expected, with no collision against the native `/resume`.

Separately, the **`setup-onboard`** command name had been awkward since DDR-004 forced it under `<group>-<verb>` convention. Claude Code ships a built-in `/init` for CLAUDE.md scaffolding; our `/flow:setup-onboard` does the analogous `.ai/` scaffolding. Once namespacing worked, `/flow:init` became unambiguous — same verb, scoped by plugin prefix.

## Decision

Adopt **option 3** — explicit `<plugin>:` prefix in the `name:` frontmatter field for every plugin command, skill, and agent — plus a recognized-bootstrap-verb carve-out for `init`:

1. **`name:` is the fully-qualified slash name.** Every file under `plugins/<plugin>/{commands,skills,agents}/` declares `name: <plugin>:<slug>` (e.g. `flow:resume`, `design:edit`, `flow:a11y-auditor`). The `<plugin>:` prefix is mandatory and load-bearing — without it, Claude Code registers the bare slug and collisions / lost namespace ensue.
2. **`help.md` render templates updated.** `plugins/{flow,design}/commands/help.md` now render `/<name>` directly (the `<plugin>:` prefix is already in `name:`), not `/<plugin>:<name>` (which would double-prefix).
3. **`init` is the lone bare-verb exception to the `<group>-<verb>` filename rule** from DDR-004. The filename `init.md` (not `setup-init.md`) is permitted because:
   - The verb mirrors Claude Code's built-in `/init` semantically — initial project setup. Same name, different scope (built-in writes CLAUDE.md, ours scaffolds plugin workspace). Namespace prefix (`flow:` / `design:`) keeps them unambiguous.
   - `setup-init` would read as "setup setup" — pure stutter with no information gain. Unlike the `record-ddr` stutter accepted in DDR-004 (DDR is an external acronym), `init` is a bare verb that owns the action without prefix help.
   - Documented as the explicit exception in both `CATEGORIES.md` files. All other non-daily commands keep `<group>-<verb>`.
4. **Renames executed:**
   - `plugins/flow/commands/setup-onboard.md` → `plugins/flow/commands/init.md` (`name: flow:init`)
   - `plugins/design/commands/setup-onboard.md` → `plugins/design/commands/init.md` (`name: design:init`)
5. **CATEGORIES.md rename-history rows record the chain.** Flow: `/flow:onboard` → `/flow:setup-onboard` → `/flow:init`. Design: `/design:setup-onboard` → `/design:init`. No backwards-compat stubs — the slash names disappear cleanly because both plugins ship as a single version-pinned bundle (no consumer is mid-migration).

## Consequences

### Positive

- **No more collisions with Claude Code built-ins.** `/flow:resume`, `/flow:init`, `/flow:status` (vs built-in `/status`), and any future overlap stay namespace-isolated.
- **Autocomplete predictability.** Typing `/flow:` narrows to flow plugin only; `/design:` to design plugin only. Built-ins (`/help`, `/clear`, `/init`, `/resume`, …) stay accessible at bare form.
- **`/flow:init` reads as a peer of native `/init`.** New users learn one verb, two scopes — CLAUDE.md scaffolding (`/init`) and `.ai/` scaffolding (`/flow:init`). Same applies to `/design:init` for `.design/`.
- **Future plugin commands can pick "obvious" names** (`/flow:edit`, `/flow:test`) without checking for built-in collisions first. The namespace shields them.

### Negative

- **Every new command/skill/agent in plugins/ MUST include the `<plugin>:` prefix in `name:`.** Forgetting it silently regresses to the bare-slug bug. Add to PR review checklist.
- **One exception (`init`) erodes the zero-exception consistency** that DDR-004 fought for. Mitigation: the exception is documented in both `CATEGORIES.md` files, applies only to the one recognized bootstrap verb, and any future exception requires an explicit DDR update.
- **Depends on a Claude Code behavior that may change.** If the underlying bug ([#22063](https://github.com/anthropics/claude-code/issues/22063)) gets fixed and Claude Code starts namespacing automatically when `name:` is bare, our explicit prefix will either be redundant (best case) or get double-prefixed (worst case, e.g. `/flow:flow:resume`). When the bug closes or [#43695](https://github.com/anthropics/claude-code/issues/43695) ships, audit and possibly revert the explicit prefix.

### Migration impact

- **77 plugin files** had `name:` rewritten: 33 flow commands + 4 flow agents + 15 flow skills + 11 design commands + 11 design agents + 3 design skills.
- **2 file renames** + **2 site/.mdx renames** + **2 meta.json reorders**.
- **All slash-form references** in `README.md`, `CLAUDE.md`, `CONTRIBUTING.md`, both `CATEGORIES.md`, both plugin `help.md`, site Fumadocs pages, CLI scripts, GitHub issue templates updated.
- **`CHANGELOG.md`, `.ai/plans/archive/**`, `.ai/state/STATE.md`** intentionally NOT updated — they record historical state at the time of writing. Updating them would be revisionist.

## Verification

- **Empirical autocomplete check.** After `/plugin marketplace update md-claude` + `/reload-plugins` in a scratch session: typing `/resum` shows native `/resume` + `/flow:resume` as two distinct rows, no collision. Typing `/flow:init` autocompletes to a single entry, distinct from the native `/init`. Typing `/flow:setup-` narrows to the three remaining `setup-*` commands (`setup-prd`, `setup-codebase-map`, `setup-context`) — `init` correctly absent.
- **Grep verification.** Zero unprefixed `name:` lines in `plugins/{flow,design}/{commands,agents,skills}/**/*.md` (excluding template-example bodies). Zero double-prefixes (`flow:flow:`, `design:design:`).

## Open questions / followups

- **Issue [#43695](https://github.com/anthropics/claude-code/issues/43695) watch.** If Claude Code ships `require-namespace: true` frontmatter or auto-namespacing for plugin commands, revisit whether the explicit `<plugin>:` prefix in `name:` is still needed or actively harmful (double-prefix risk).
- **Downstream `make-skill-template` skill body** at `plugins/flow/skills/make-skill-template/SKILL.md:41` still shows `name: <skill-name>` (without plugin prefix) as the scaffold template. That's correct for downstream end-users creating non-plugin skills under their own `.claude/skills/`, but worth noting if someone uses it to scaffold a skill **inside** our plugins — they'd need to manually prepend `<plugin>:`. Consider a separate plugin-scoped template if this becomes a frequent source of bugs.
