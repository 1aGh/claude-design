---
"@1agh/maude": minor
---

`fix(dev-server)`: marketplace-cache install boots cleanly on first try

Before this release, the documented happy-path — `/plugin marketplace add 1aGh/maude` → `/design:setup-ds project` → `/design:browse` — failed with a 404 on `/_client/client.bundle.js` and a 500 on `/_canvas-runtime/*` on a fresh machine. The marketplace install mechanism does a `git clone` (honors `.gitignore`), so `dist/` and `node_modules/` arrived empty even though `npm pack` shipped them. Three independent packaging gaps stacked into one broken first boot.

Seven coordinated fixes ship together (per [DDR-044](.ai/decisions/DDR-044-marketplace-install-vs-npm-install-artifact-strategy.md)):

- **Commit `dist/client.bundle.js` + `dist/styles.css` to git** (~270 KB) so marketplace clones get them out of the box. Per-platform binaries (~70–120 MB each) stay gitignored — they ship via `optionalDependencies` sub-packages per DDR-015.
- **`bun run build.ts` no longer ENOENT-crashes outside the monorepo.** The brittle `../../../package.json` read at `build.ts:73-74` now resolves `plugins/design/.claude-plugin/plugin.json` (always present in both npm and marketplace installs) with a try/catch fallback to `version: 'dev'`.
- **Boot-time self-heal in `server.ts`.** On startup, if `dist/client.bundle.js` or `node_modules/react/package.json` is missing, the server auto-runs `bun install --production` + `bun run build.ts` before writing `_server.json`. New `MAUDE_NO_AUTOBUILD=1` env flag opts out for read-only-filesystem deployments (server exits 1 with a remediation message instead). React, react-dom, lightningcss, magic-string, and oxc-parser moved from `devDependencies` → `dependencies` so `--production` pulls them. Extracted to a standalone `boot-self-heal.ts` module with full test coverage.
- **`runtime-bundle.ts` translates Bun-cache-corruption errors** (EISDIR/ENOENT on `~/.bun/install/cache/<pkg>@<version>/…`) into a one-line remediation: `Run \`bun pm cache rm <pkg>\` then reload the page.` New exported `bunCacheRemediation()` helper covers subpath specifiers (`react/jsx-runtime` → `bun pm cache rm react`).
- **`screenshot.sh` rejects `file://*.tsx`** with exit 2 and a hint pointing at `--port` — the dev-server's `_canvas-shell.html?canvas=<rel>` route is the only way to render TSX (browsers can't compile JSX). The bootstrap skill's "Visual sanity" step has been rewritten to require the dev-server first (the HTML-era `file://` recipe silently no-op'd on TSX scaffolds).
- **AskUserQuestion fallback documented in `SKILL.md` + `setup-ds.md`.** Stages 0 + 3 now declare a numbered-prose fallback for when the tool is unavailable (don't-ask mode, permission denial). Copy-pasteable templates included. Stage 1 is already prose-only by design.
- **Single-DS name-convention tension resolved.** New `name_source: "user" | "default"` field on `vision-brief.json`. `setup-ds` warns if `<name>` matches the repo basename (`/design:edit` auto-detection works best with the literal `project` for single-DS) but honors the user's choice either way. The completeness-critic's C2 dirname check now reads `name_source` — user-supplied names never trigger the divergence flag. Legacy briefs predating this release default to `"user"` (no false positives).

No breaking changes. Existing installs continue working with their committed `dist/` artifacts; the self-heal only fires on the gap scenarios. Source-of-record retro at `.ai/logs/system-reviews/maude-dev-server-bootstrap-review.md` (2026-05-25).
