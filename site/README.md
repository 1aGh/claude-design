# `@md-claude/site` — Documentation site

Public documentation for the `mdcc` CLI and the `flow` + `design` plugins. Built with [Fumadocs](https://fumadocs.dev) + Next.js 16 (App Router) + Tailwind v4 + Orama (client-side search).

## Run locally

From the **repo root** (pnpm workspace):

```bash
pnpm install                          # install root + site deps in one pass
pnpm --filter @md-claude/site dev     # → http://localhost:3000
# shortcut:
pnpm dev:site
```

The site is not part of the published npm package — it deploys separately (Vercel, see Phase 2 Task 6).

## Layout

```
site/
├── app/                          # Next.js App Router
│   ├── (home)/                   # marketing / landing
│   ├── docs/[[...slug]]/         # docs pages
│   ├── api/search/route.ts       # Orama search endpoint
│   ├── llms.txt/                 # llms.txt route handler
│   ├── llms.mdx/docs/[[...slug]] # raw MDX for LLM consumption
│   └── og/docs/[...slug]/        # OG image generation
├── content/docs/                 # the actual MDX pages
├── lib/
│   ├── shared.ts                 # appName, route constants, gitConfig
│   ├── source.ts                 # Fumadocs `loader()` wiring
│   └── layout.shared.tsx         # shared nav/footer
├── components/mdx.tsx            # MDX component overrides
├── source.config.ts              # Fumadocs MDX config + Zod schemas
└── next.config.mjs               # `withMDX()` wrap
```

## Authoring

- Add or edit MDX under `content/docs/`.
- Frontmatter: `title`, `description` required. Optional `full: true` for full-width pages.
- Folder + `meta.json` controls sidebar order — see [Fumadocs Source API](https://fumadocs.dev/docs/headless/source-api).
- Re-run `pnpm --filter @md-claude/site dev` (or just let Next.js hot-reload).

## Search

Client-side via Orama. New MDX files are picked up on next build — no manual indexing.

## Deploy

Target: **Vercel** (production branch `main`, preview deploys on every PR touching `site/**`). See [DDR-005](../.ai/decisions/DDR-005-docs-site-stack-and-hosting.md) for the why.

The deploy workflow lives at `.github/workflows/site-deploy.yml`. It's **inert** until a maintainer wires three repo secrets:

```text
VERCEL_TOKEN       — https://vercel.com/account/tokens
VERCEL_ORG_ID      — `vercel link` writes it to .vercel/project.json
VERCEL_PROJECT_ID  — same source
```

### One-time maintainer setup

```bash
# In the site/ directory of a fresh clone:
cd site
pnpm dlx vercel@latest link        # interactive — pick the org + project
cat .vercel/project.json           # copy orgId + projectId

# Then in https://vercel.com/account/tokens, mint a token, name it
# "github-actions-md-claude". Add all three values as repo secrets at
# https://github.com/1aGh/md-claude/settings/secrets/actions
```

After that, every push to `main` that touches `site/**` (or the plugin command sources the docs site auto-generates from) deploys to production; every PR gets a preview comment with the URL.

