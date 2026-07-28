# DDR-032 — Rename `md-claude` → `Maude`

- **Date**: 2026-05-20
- **Status**: accepted
- **Author**: 1aGh (Michal Dovrtěl)
- **Context plan**: `.ai/plans/rename-md-claude-to-maude.md`

## Decision

Rebrand the project from `md-claude` to **Maude**, executed as a single atomic PR with these load-bearing sub-decisions:

1. **CLI primary = `maude`, legacy alias = `mdcc`.** Both bins ship from `cli/bin/`. The `mdcc` shim prints a one-line deprecation warning on stderr and forwards `import('./maude.mjs')`. Drop the shim in v0.17.x.
2. **Internal `mdcc-*` CSS namespace + `site/components/mdcc/` path = KEEP.** Treated as an implementation-detail token namespace, not a brand surface. Reduces churn for contributors and avoids risk of style regressions during the rebrand.
3. **npm cutover = HARD `npm unpublish`** for `@1agh/md-claude` + 7 sub-packages. Eligibility verified: v0.14.0 published 2026-05-20T00:45:23Z, well within npm's 72h policy window (rename executed ~07:55Z, i.e. ~7h after publish). Fallback to `npm deprecate` was prepared but not needed.
4. **Rollout = single atomic PR.** Refactor + version bump + publish in one cycle, not staged. Reasoning: brand cannot live half-renamed; partial state is worse than coordinated cutover.

## Sub-decisions fixed now to prevent forward drift

Future plans (Phase 9 hub, Phase 13 overlay, Phase 15.5 video) carried `md-claude`/`mdcc` strings that would otherwise re-introduce the old brand. Resolved up-front:

| # | Item | Decision |
| --- | --- | --- |
| a | `mch_<hex>` hub token prefix (phase-9) | **Rename to `mau_<hex>`** — user-visible token brand must match. |
| b | `~/.config/mdcc/hubs.json` XDG path (phase-9) | **Keep `mdcc/`** — symmetric with sub-decision 2; reduces churn for existing contributors. |
| c | `ghcr.io/1agh/md-claude-hub` Docker image (phase-9) | **Reserve `ghcr.io/1agh/maude-hub`** — image never published, no migration. |
| d | `mdcc-hub.service.template` systemd unit (phase-9) | **Rename to `maude-hub.service.template`**. |
| e | `--mdcc-activity` CSS var (phase-13) | **Keep** per sub-decision 2. Inline comment in the plan documents the intentional namespace. |
| f | `md-claude.dev` public docs domain (phase-15.5) | **Use `maude.sh`** subdomain under existing personal domain. 301 redirect from `md-claude.dev` only if owned. |

## Pre-flight verification (2026-05-20 ~07:55Z)

```
$ npm view @1agh/md-claude time --json | jq '.["0.14.0"]'
"2026-05-20T00:45:23.810Z"

$ date -u +"%Y-%m-%dT%H:%M:%SZ"
2026-05-20T07:55:43Z

# Delta: ~7h 10m — UNPUBLISH ELIGIBLE (npm policy = 72h).

$ npm view @1agh/maude
npm error 404 Not Found  # name is free

$ gh auth status
✓ Logged in to github.com account 1aGh (token scopes: repo, admin:public_key, …)

$ git remote get-url origin
git@github-1agh.com:1aGh/md-claude.git  # custom SSH host alias, path-only change after rename
```

All three pre-flight gates green → proceed with unpublish strategy and atomic PR.

## Consequences

- Old `@1agh/md-claude*` names become **permanently unrepublishable** after unpublish (npm policy).
- Existing users with `npm i -g @1agh/md-claude` in setup scripts will 404 after unpublish — mitigated by GitHub release notes + README front-page banner + `docs/MIGRATING-MD-CLAUDE-TO-MAUDE.md`.
- Marketplace users (`/plugin marketplace add 1aGh/md-claude`) must re-add as `1aGh/maude`. Documented in the migration guide.
- Historic DDRs and archived plans intentionally retain `md-claude` strings — they are time-stamped records, not living docs.
- `mdcc-*` CSS namespace + `~/.config/mdcc/` XDG path persist indefinitely. Documented in the migration guide so external readers don't see the residual `mdcc` references as a half-finished rename.
- **Canvas-lib virtual specifier renamed:** `@mdcc/canvas-lib` → `@maude/canvas-lib` (resolver filter, inline-import regex, all dev-server source, all canvas TSX files in `.design/`). The first draft of this DDR proposed keeping `@mdcc/canvas-lib` for downstream compatibility, but with zero external users at v0.14.0 and the canvas-lib being the most-visible "you import from us" surface for new canvases, the symmetric `@maude/canvas-lib` won. Anyone upgrading a downstream project from pre-v0.15.0 must run a one-line find-replace on their canvas TSX files (documented in the migration guide).

## Rejected alternatives

- **Staged rollout (deprecate-then-rename across 2-3 releases).** Rejected: brand schizophrenia worse than a single coordinated cutover; npm unpublish window forces decision now anyway.
- **Keep `mdcc` as primary, just rename npm scope.** Rejected: defeats the marketing-identity goal; "Maude" is the brand, the CLI binary must match.
- **Rename `mdcc-*` CSS namespace too.** Rejected: zero user-visible benefit, high regression risk across ~30 component files. Documented as intentional.
