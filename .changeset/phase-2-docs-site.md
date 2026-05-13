---
"@1agh/md-claude": patch
---

Docs site lands at [`site/`](https://github.com/1aGh/md-claude/tree/main/site) (Fumadocs + Next.js + Tailwind v4 + Orama search). Public URL pending Vercel wiring — see [DDR-005](https://github.com/1aGh/md-claude/blob/main/.ai/decisions/DDR-005-docs-site-stack-and-hosting.md).

What's there:

- **Guides** (hand-written): `getting-started`, `cli`, `flow`, `design`, `config`, plus drop-in recipes for Next.js, Expo, and pnpm monorepos.
- **Reference** (auto-generated): one MDX page per `/flow:*` and `/design:*` command (37 today) sourced from plugin frontmatter; one typed `workflows.config.json` schema page sourced from `config.schema.json`. Two generators under `site/scripts/` run as the site's `prebuild` step — adding a new command auto-publishes its page on next deploy.
- **LLM-readable output**: Fumadocs ships `/llms.txt`, `/llms-full.txt`, and raw `/llms.mdx/docs/<slug>` per page out of the box; this release adds a `/robots.txt` with an explicit allow for GPTBot / ClaudeBot / PerplexityBot / Google-Extended.

Infra:

- New private workspace `@md-claude/site` (not part of the npm tarball).
- New `.github/workflows/site-deploy.yml` — builds + lints on every PR / push to `main` touching `site/**`. Deploy step is inert until a maintainer adds `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` repo secrets.
- Root README trimmed 339 → 164 lines — flow + design command deep dives now live on the docs site; README stays focused on quickstart + contributor info.

No change to the published `@1agh/md-claude` package contents — `patch` bump captures the infrastructure improvement without overstating user-facing API change.
