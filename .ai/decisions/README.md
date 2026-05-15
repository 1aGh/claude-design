# Design Decision Records

Permanent log of architectural and product decisions for md-claude. Each DDR is a standalone markdown file following the template in `plugins/flow/commands/record-ddr.md` (installed as `/flow:record-ddr`).

## Index

> Append-only. Newest at the top.

<!-- DDRs go here, format:
- [DDR-NNN: Title](DDR-NNN-title.md) — YYYY-MM-DD, tags
-->

- [DDR-011: Re-skin fumadocs via `--color-fd-*` overrides; do NOT fork](DDR-011-mdcc-skin-of-fumadocs-vs-fork.md) — 2026-05-15, site/docs/fumadocs/design-system/theming/css-tokens/upgrade-burden
- [DDR-010: `design-system-keeper` agent — read-only DS-fidelity audit between generation and the critic panel](DDR-010-design-system-keeper-agent.md) — 2026-05-15, design/agents/quality-gate/pattern-priors
- [DDR-009: Bun runtime authoritative for `plugins/design/dev-server/` (no Node fallback)](DDR-009-bun-runtime-authoritative-for-dev-server.md) — 2026-05-15, design/dev-server/runtime/bun/distribution/perf/lock-in/npm/ci/phase-3.4
- [DDR-008: `plugins/design/dev-server/bin/` is the canonical home for shared bash helpers](DDR-008-dev-server-bin-canonical-helper-home.md) — 2026-05-15, design/dev-server/bash/helpers/dry/ci/npm-distribution
- [DDR-007: Stable element-id schema — paired `data-dc-screen` + `data-dc-element` attributes on canvas content](DDR-007-stable-element-id-schema-data-dc-attrs.md) — 2026-05-15, design/runtime/inspector/screenshots/critics/comments/schema
- [DDR-006: Plugin commands/skills/agents declare `name: <plugin>:<slug>` in frontmatter](DDR-006-plugin-namespace-in-name-frontmatter.md) — 2026-05-13, flow/design/plugin-design/slash-commands/naming/deprecation
- [DDR-005: Docs site stack and hosting — Fumadocs + Vercel](DDR-005-docs-site-stack-and-hosting.md) — 2026-05-13, infra/docs/fumadocs/vercel
- [DDR-004: Flow commands use `<group>-<verb>` prefix; subdirectory namespacing is not viable](DDR-004-flow-command-naming-prefix-convention.md) — 2026-05-13, flow/naming/plugin-design/slash-commands/ux/deprecation
- [DDR-003: `/flow:release` walks a user-authored runbook instead of dispatching on provider](DDR-003-release-runbook-vs-provider-dispatch.md) — 2026-05-12, flow/release/changelog/design-pattern
- [DDR-002: Release flow via Changesets, with a wrapper preserving plugin parity](DDR-002-changesets-release-flow.md) — 2026-05-12, infra/release/changesets
- [DDR-001: Monorepo with a single npm publisher](DDR-001-monorepo-single-publisher.md) — 2026-05-12, infra/monorepo/packaging

## Rules

- **Numbering:** zero-padded, three digits, sequential (DDR-001, DDR-002, …).
- **Status:** `Accepted` once committed. `Proposed` only inside an open PR. `Superseded by DDR-NNN` when replaced.
- **We never delete.** Superseded DDRs stay — they're the trail of how we got here.
- **Cross-link:** the plan, the commit, and the new code that implements the decision should all link the DDR.

How to create one: `/flow:record-ddr <title>`. How to find related ones: read this index, or `grep -l <tag> .ai/decisions/*.md`.
