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
- [x] DDR: hosting choice (Vercel vs Cloudflare Pages vs GitHub Pages). → [DDR-005](../decisions/DDR-005-docs-site-stack-and-hosting.md)
- [x] README de-duplicated; canonical reference lives in docs site. (339 → 164 lines)

**Status:** ✅ implemented (commits `c81da3b` + `b22aa9e`). 5/8 acceptance criteria fully ✓, 1 partial (builds ✓ / deploys deferred until Vercel secrets), 2 deferred for post-deploy smoke (search relevance + recipes end-to-end).

---

## Retro

### What worked

- **Scoping Task 1–2 first, then sweeping 3–7 in one pass.** Stopping for review after the scaffold gave the user a chance to inspect the workspace integration before committing to the auto-gen scripts. The full second sweep was then fast because the bones were trusted.
- **Auto-gen generators paid for themselves immediately.** Writing `build-command-reference.mjs` + `build-schema-reference.mjs` cost ~200 lines of code and removed any "MDX page maintenance" tax forever — every new command surfaces a page automatically, with the source as single source of truth. Hand-writing per-command pages would have been worse on day one and rotted from there.
- **Fumadocs default scaffold did more than the plan asked.** The CLI ships `/llms.txt` + `/llms-full.txt` + `/llms.mdx/docs/*` + `/og/docs/*` + Orama search out of the box — Task 5 ended up being ~30 lines of metadata + a `robots.txt` route, not a custom search backend. Worth ~half a day saved.
- **DDR-005 written *before* deploy attempt.** The decision doc captured why Vercel + Fumadocs defaults are the right call, including the carry-overs (DNS, secrets). When the user later wires Vercel, they read DDR-005 and know what's intentional vs. provisional.

### What didn't

- **`create-fumadocs-app` clack prompts blocked non-interactive scaffolding.** Even with every flag set, the CLI prompts on `og-image` and `ai-chat` regardless of flag presence/value. Piped stdin (`printf '\n\n\n' |`) was ignored. Wasted ~5 minutes before the user did the scaffold manually. Should have asked first.
- **biome ignore patterns were discovered iteratively.** First lint run hit `.next/build/**`, then `.source/**`, then `next-env.d.ts`, then the auto-generated `content/docs/reference/**`. Each turn was an Edit + re-run. Pre-flight: list "build artifact dirs" up-front when integrating any new framework workspace.
- **MDX-as-JSX gotcha cost a build cycle.** `<repo>` and `<scope>` placeholders in command/schema descriptions are valid Markdown text but invalid MDX (parsed as JSX tags). Both generators now HTML-escape `<` on output. Should be in a project rule: "any MDX generator must escape `<` in non-fenced prose."
- **Initial Bash `cd` persistence surprised me.** A `cd site && pnpm types:check` in one turn leaked shell cwd into subsequent turns, so a follow-up `pnpm lint` ran from `site/` and emitted misleading "site treats itself as root" output. Lesson: prefer `pnpm --filter` over `cd` for subdirectory commands, or always `cd /Volumes/.../<root>` explicitly.

### What to change next time

- **For framework scaffolds with interactive CLIs, ask up-front about the manual-vs-CLI choice and let the user do it.** Don't burn turns on stdin tricks.
- **Pre-flight a "lint ignore list" with the framework's standard build artifact dirs** (`.next`, `.source`, `dist`, `out`, `next-env.d.ts`, `.changeset`) before the first lint run.
- **Auto-gen scripts get an explicit "MDX escape pass" by default.** Add to the project rule list (or codify in `.claude/skills/` if this happens again).
- **When operating on `main` with no issue number,** explicitly note in STATE.md that no story/issue exists — `/flow:status`'s "issue detection" picked up nothing and that's fine, but it should be intentional, not silent.

### Carry-overs (separate follow-ups, not Phase 2)

- Design plugin commands lack `category:` frontmatter → all 8 fall under "uncategorized" in the auto-gen reference. Cosmetic fix: 8 one-line edits + maybe a `plugins/design/CATEGORIES.md` mirroring the flow one.
- Recipes (Next.js / Expo / monorepo) are documented but **not end-to-end smoke-tested** against fresh repos. Plan acceptance criterion 4 is technically open. Will close after a manual sanity pass post-deploy.
- Search relevance — Orama is wired but the plan calls for verifying that "changeset", "scenario", "canvas selection" return relevant results. Needs a running prod URL.
- Vercel secrets + DNS — out of scope for this execute; handed off in DDR-005.

