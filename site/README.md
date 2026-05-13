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

Vercel (DDR-005 pending). The `site-deploy.yml` workflow ships with Phase 2 Task 6.
