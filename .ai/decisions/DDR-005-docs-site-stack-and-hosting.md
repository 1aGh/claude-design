# DDR-005: Docs site stack — Fumadocs + Vercel; accept Fumadocs DS defaults

- **Date:** 2026-05-13
- **Status:** Accepted
- **Tags:** docs, frontend, infra, hosting, design-system
- **Related:** `.ai/plans/phase-2-docs-site-fumadocs.md`, `site/`, `.github/workflows/site-deploy.yml`

## Context

Phase 2 stands up a public documentation site for md-claude. The plan flagged three open decisions:

1. **Docs framework.** All current docs live in one giant `README.md` + a couple of `docs/*.md` files. We need a real site with nav, search, per-command pages, and a renderable config-schema reference.
2. **Hosting.** Vercel vs. Cloudflare Pages vs. GitHub Pages.
3. **Design system.** Custom DS for the docs site vs. accept the framework's defaults.

The docs site is **adjacent to** the npm package, not part of it. It must not slow down `pnpm install` for contributors fixing plugin code (which is most contributors most of the time), and it must not block npm releases.

## Options considered

### Docs framework

- **Fumadocs (chosen).** Next.js-based, MDX-first, ships search (Orama), `llms.txt`, `llms-full.txt`, OG image generation, and per-page raw-MDX routes (`/llms.mdx/docs/<slug>`) **out of the box**. Component story is React + Tailwind v4. Output is fully crawlable static HTML for everything that can be static-generated.
- **Nextra.** Mature, also Next.js. But search story is heavier (FlexSearch / Algolia) and LLM-friendliness (`llms.txt`) requires custom routes.
- **VitePress.** Lightest. Vue-based — out of stack (this repo is JS/MJS + React in `site/`).
- **Docusaurus.** Heavy React app; opinions don't match (versioned-docs-first; we don't version docs).
- **Just GitHub Pages with a markdown theme.** Cheapest. No search, no schema rendering, no per-command auto-gen story.

Fumadocs wins on:

- AI-readable output is a **product requirement** (the README says docs are crawlable by LLM tools).
- Build is fast (Turbopack via Next 16).
- Auto-generated `/llms.txt` aligns with our auto-gen command-reference + schema-reference strategy.
- Tailwind v4 + React 19 — same stack we'd reach for in any new web project.

### Hosting

- **Vercel (chosen).** Native Next.js support (zero config), free tier easily covers a docs site, GitHub integration auto-detects `site/` on push to `main`. We already point to `docs.md-claude.dev` in code — Vercel manages DNS + TLS automatically once the domain is added.
- **Cloudflare Pages.** Cheaper at scale and we already trust Cloudflare for DNS. But Next.js App Router requires `@cloudflare/next-on-pages` adapter, which adds friction and lags Next.js releases by 1–2 minor versions. We'd hit edges fast with Next 16.
- **GitHub Pages.** Free, but Next.js App Router on GitHub Pages requires `output: 'export'`, which kills server routes — and we use them (`/api/search`, `/llms.txt` route handler, `/og/docs/*` image generation). Static-only Fumadocs is possible but defeats the point.

Vercel wins on:

- **Zero friction** (the docs site is not a place we want to spend infrastructure time).
- **Cost.** Free tier is fine; Vercel's Hobby plan covers a public docs site indefinitely.
- **First-class Next.js features** — server routes for search + OG + llms.txt all just work.

### Design system

- **Accept Fumadocs defaults (chosen).** The default theme is clean, dark/light is wired, typography is tasteful out of the box. Customizing would burn time on bikeshedding and add maintenance cost (track Fumadocs upstream changes).
- **Custom DS matching the marketing site.** No marketing site exists. Premature.
- **Adopt one of `.design/system/` tokens.** The dogfooded design system is sparse and aimed at app UI, not documentation typography.

Defaults win on: time-to-launch, low maintenance, and "boring docs are good docs" — readers want signal density, not a brand statement.

## Decision

1. **Framework: Fumadocs.** Next.js 16 App Router, Tailwind v4, Orama search.
2. **Hosting: Vercel.** Production branch `main`, preview deploys on every PR touching `site/**`.
3. **Design system: Fumadocs defaults**, no custom tokens. Revisit only if a real marketing brand exists and the docs site has to align with it.

## Consequences

- `site/` adds Next.js + React 19 + ~280 transitive deps to the pnpm workspace. We mitigated this by:
  - Making `site` a **private workspace** (`"private": true`) — not part of the npm tarball; contributors fixing plugin code can ignore it.
  - Allowing `esbuild` + `sharp` build scripts via `pnpm-workspace.yaml` `allowBuilds`. Documented why in inline comments.
- **No deploy until someone with maintainer access connects Vercel.** The `site-deploy.yml` workflow is wired but inert without `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` repo secrets. See `site/README.md` and the deploy workflow comments for setup steps.
- DNS: domain `md-claude.dev` is **not yet registered** as of 2026-05-13. Until it is, Vercel will serve at `<project>-1agh.vercel.app`. Update `next.config.mjs` + `app/layout.tsx` `metadataBase` after DNS lands.
- If Vercel ever becomes a constraint (cost, vendor lock-in, regional restrictions), the escape hatch is to switch the deploy workflow target only — the Fumadocs site itself is just Next.js and ports to any Node 20+ host.

## When to revisit

- If a marketing site lands and brand consistency becomes required → revisit "Fumadocs defaults" decision.
- If Vercel free-tier limits are exceeded (10 GB bandwidth, 1000 deploys/month) → revisit hosting.
- If Fumadocs makes a major-version breaking change that's costly to follow → revisit framework (Nextra has matured by then).
