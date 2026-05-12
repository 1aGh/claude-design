# Phase 2: Docs site (Fumadocs)

## Description

Stand up a public documentation site under `site/` using [Fumadocs](https://fumadocs.dev) — a Next.js-based MDX docs framework chosen because its output is AI-readable (clean MDX in repo, indexable via crawlers + LLM tools). The site covers the `mdcc` CLI, every flow + design command, the `.ai/workflows.config.json` + `.design/config.json` schemas with copy-paste examples, and three quickstart recipes (Next.js, Expo, monorepo).

## User Story

As a tech lead evaluating md-claude, I want a docs site with copy-paste config recipes for Next.js / Expo / monorepo so that I can convince two skeptical engineers to install the marketplace without a 30-minute walkthrough.

## Problem

- All current docs live in `README.md` (one giant page) + `docs/INTEGRATIONS.md` + `docs/MIGRATING-DUGMATE.md`. No navigation, no search, no per-command page, no config schema rendering.
- Plugin authors and downstream users need a single canonical reference for `mdcc config set <key>` keys and what each does.

## Solution

Set up `site/` as a separate workspace with Fumadocs. Auto-generate command reference pages from the existing `plugins/*/commands/*.md` frontmatter; render `plugins/flow/.claude-plugin/config.schema.json` as a typed reference. Manually author quickstart pages.

## Metadata

- **Type:** New Feature
- **Complexity:** Medium-High
- **Depends on:** Phase 1 (uses changesets for site versioning + docs CI)
- **Parallel with:** Phase 3
- **Affected files:**
  - `site/` (new workspace — Next.js + Fumadocs)
    - `site/package.json`
    - `site/content/docs/{index,getting-started,cli,flow,design,config,recipes}.mdx`
    - `site/scripts/build-command-reference.mjs` (auto-gen from plugin frontmatter)
    - `site/scripts/build-schema-reference.mjs` (auto-gen from config.schema.json)
  - `pnpm-workspace.yaml` (new — add `site` workspace)
  - `package.json` (root) — `workspaces` field
  - `.github/workflows/site-deploy.yml` (new — deploy to Vercel / Cloudflare Pages)
  - `README.md` (link to docs site)

---

## Tasks

### Task 1: Scaffold Fumadocs workspace

- **Do:** `pnpm dlx create-fumadocs-app site --src-dir=app` (or follow Fumadocs CLI), then add `site` to `pnpm-workspace.yaml`. Configure root `package.json` `workspaces: ["site"]`. Ensure top-level `pnpm i` does **not** install `site` deps by default — use a `pnpm i --filter=site` workflow so contributors fixing plugin code don't pay the Next.js install cost.
- **Pattern:** See `fumadocs/examples/next-mdx` for the canonical layout.
- **Validate:** `pnpm --filter=site dev` boots Next.js on `localhost:3000`.

### Task 2: Author core MDX pages

- **Do:** `getting-started.mdx` (install, first project), `cli.mdx` (every `mdcc` subcommand), `flow.mdx` (every `/flow:*` command grouped by lifecycle), `design.mdx` (every `/design:*` command), `config.mdx` (every `.ai/workflows.config.json` section), `recipes/{nextjs,expo,monorepo}.mdx`.
- **Pattern:** Each command page: short summary, when to use, what it produces, copy-paste invocation, related commands.
- **Validate:** All internal links resolve (link check via Fumadocs's built-in or `lychee`).

### Task 3: Auto-generate command reference

- **Do:** `site/scripts/build-command-reference.mjs` reads every `plugins/{design,flow}/commands/*.md` frontmatter (`name`, `description`, `keywords`, `argument-hint`) and writes one MDX file per command under `site/content/docs/reference/{flow,design}/<name>.mdx`. Runs as a prebuild step.
- **Pattern:** Mirror how `tailwindcss-docs` derives plugin pages from source.
- **Validate:** Adding a new `/flow:foo` command then re-running the script produces a new page automatically.

### Task 4: Render config schema

- **Do:** `site/scripts/build-schema-reference.mjs` reads `plugins/flow/.claude-plugin/config.schema.json` and produces a typed MDX page with every key, type, default, and description (from `description` fields in the schema, which need to be filled where missing).
- **Pattern:** Similar to how `nextra-theme-docs` renders OpenAPI specs.
- **Validate:** Spot-check that adding a key to the schema surfaces in the docs on rebuild.

### Task 5: Search + AI-readable output

- **Do:** Enable Fumadocs's built-in client-side search. Ensure MDX output to `_next/data` is crawlable (no auth wall). Add `llms.txt` pointing to the canonical docs URL — improves discoverability for LLM-based tools.
- **Pattern:** See `llmstxt.org` proposal.
- **Validate:** Confirm `curl https://docs.md-claude.dev/llms.txt` returns a usable index.

### Task 6: Deploy

- **Do:** Vercel project (or Cloudflare Pages — DDR for hosting choice), CNAME `docs.md-claude.dev`. Workflow `site-deploy.yml` builds on push to `main` for `site/**` changes.
- **Pattern:** Vercel's GitHub integration auto-detects Next.js.
- **Validate:** Production URL serves the home page; deep-link to a command reference page works.

### Task 7: Link from README

- **Do:** Add docs site URL to README header. De-duplicate README content that's now in docs (keep README as a "what is this" + quickstart, push reference into docs site).
- **Validate:** Read README; nothing duplicated past the quickstart.

---

## Validation

1. **Static:** `pnpm --filter=site build` succeeds; `pnpm --filter=site exec next lint` clean.
2. **Link check:** Run `lychee site/content/**/*.mdx` — zero broken links.
3. **A11y:** Spawn `a11y-auditor` against deployed site — WCAG 2.1 AA on home + a command reference page.
4. **Design system:** Spawn `design-system-guard` to confirm the site matches whatever DS we declare in `.ai/workflows.config.json` (or, more likely, accept Fumadocs defaults and DDR the decision).

## Scenario coverage

| Scenario | Covers user flow | Status |
|----------|------------------|--------|
| `docs-site-first-visit` | Land on home → click "Getting Started" → copy install command → land on `flow:plan` reference | 🆕 new |

---

## Acceptance criteria

- [ ] `site/` workspace builds and deploys.
- [ ] Every `/flow:*` and `/design:*` command has an auto-generated reference page.
- [ ] Config schema rendered with every key documented (schema descriptions filled in where missing).
- [ ] Three recipes (Next.js, Expo, monorepo) work end-to-end against fresh repos.
- [ ] Search returns relevant results for "changeset", "scenario", "canvas selection".
- [ ] `llms.txt` present and crawlable.
- [ ] DDR: hosting choice (Vercel vs Cloudflare Pages vs GitHub Pages).
- [ ] README de-duplicated; canonical reference lives in docs site.
