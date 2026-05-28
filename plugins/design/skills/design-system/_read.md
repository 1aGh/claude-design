# design-system — READ flow

> Loaded in READ mode (the default — `/design:edit`, `/design:new` iterating on an existing canvas). The router (`SKILL.md`) points here so READ-mode turns do not pull the ~900-line BOOTSTRAP flow into context. The Animation tooling contract lives in the router (`SKILL.md`) because both flows share it.

## Read flow (canvas iteration)

When you're generating, reviewing, or migrating UI:

1. **Resolve `designRoot`** from `<repo>/.design/config.json` (or fall back to `.design`).
2. **Look up the canvas's declared DS.** Read `<canvas>.meta.json.designSystem` to know which DS to load. Fall back to `config.json.defaultDesignSystem` if no canvas meta. Fall back to `system/project/` if neither is set (single-DS layout).
3. **Read the tokens CSS** at `<designRoot>/<resolvedDsPath>/colors_and_type.css` (or the path declared in `config.json.tokensCssRel` for single-DS layouts). These are the only legal colors / fonts / radii / shadows.
4. **Read the DS README** at `<designRoot>/<resolvedDsPath>/README.md` — it contains the project-specific aesthetic, hard-stop rules, and rationale that override anything generic you'd otherwise default to.
5. **Read the DS SKILL.md** at `<designRoot>/<resolvedDsPath>/SKILL.md` — terse load-bearing summary the agent should treat as authoritative for hard rules + voice.
6. **Browse specimens** at `<designRoot>/<resolvedDsPath>/preview/` — concrete examples of legal swatches, typography pairings, density ladders, component compositions.
7. **Reference UI kits** at `<designRoot>/<resolvedDsPath>/preview/ui_kits-{desktop,mobile}-{index,showcase}.tsx` (when present) — `index` is the catalog/launcher, `showcase` is the full product mock with theme/accent switching. These flatten into the `preview/` dir at scaffold time; the source convention in the inspiration library is `platform-<platform>/ui_kits-<platform>-*.html`.

### Multi-DS lookup pattern

When `config.json.designSystems[]` has more than one entry:

- Each canvas's `.meta.json.designSystem` field names which DS that canvas was built against (kebab-case slug, matches `designSystems[].name`).
- The skill loads **only that DS**, not all of them. Tokens and rules don't blend across DSes — a marketing canvas built against `marketing` DS uses marketing tokens, period.
- Subagents (`design-critic`, `design-system-completeness-critic`, etc.) scope to the same DS by reading the canvas's meta first.
- If `.meta.json.designSystem` is missing on a canvas in a multi-DS project, treat it as a warning (canvas drift) and fall back to `defaultDesignSystem` while flagging the gap.

### What you must never do (READ flow)

- **Never invent tokens.** If a color, font, radius, or shadow isn't in the tokens CSS, ask the user before adding it.
- **Never mix tokens between DSes.** A canvas's DS is single-valued; don't blend.
- **Never silently restyle a canvas to a different aesthetic** — token-family violation is a hard-stop the design-stack critics flag as a blocker.

