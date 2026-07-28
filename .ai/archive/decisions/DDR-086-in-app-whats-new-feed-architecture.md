# DDR-086 — In-app "What's New" feed: single source, package-root resolution, pending→stamped versioning, repo-skill mechanism

**Status:** Accepted — 2026-06-03.
**Supersedes:** none. **First of its kind:** introduces the first in-product update/notification surface in the Maude UI, and the first feed shared between the dev-server runtime and the docs site.
**Related:** [DDR-045](DDR-045-real-disk-path-resolution-for-compiled-dev-server.md) (the `paths.ts` disk-resolution rule the loader obeys); [DDR-054](DDR-054-...) / canvas-origin trust model (the main-origin-only confinement of `/_api/whats-new`); [DDR-085](DDR-085-canvas-kind-and-design-new-ingest-mode.md) F1 (the untrusted-text-into-render concern this feature deliberately does **not** reintroduce); the "Site roadmap regen" CLAUDE.md convention (the precedent the mechanism imitates); [DDR-058](DDR-058-maude-doctor-deps-config-quality.md) (`integrations.*` config shape extended with `whatsNew`).
**Instruments:** `plugins/design/dev-server/whats-new.json` + `whats-new.schema.json` (the feed + contract); `plugins/design/dev-server/whats-new.ts` (loader); `plugins/design/dev-server/http.ts` (`GET /_api/whats-new`); `plugins/design/dev-server/client/whats-new*.{jsx,js}` (badge/toast/panel + seen logic); `.claude/skills/whats-new-entry/SKILL.md` (the repo-internal authoring skill); `plugins/flow/commands/done.md` step 4d + `plugins/flow/.claude-plugin/config.schema.json` `integrations.whatsNew` (the generic opt-in gate); `scripts/stamp-whats-new.mjs` + `scripts/bump-version.sh` (release stamping); `site/scripts/build-whats-new.mjs` + `site/lib/whats-new.json` + `/whats-new` page (the docs-site mirror). Plan: `.ai/plans/feature-in-app-whats-new-tour.md`.

## Context

The Maude UI had zero onboarding/notification scaffolding, and "update the docs on phase done" was a partial, manual roadmap regen — nothing reached the product UI, so shipped features were invisible to anyone who didn't read GitHub releases. The ask: each closed-out phase should not only update the docs site but also surface the feature **in the canvas browser** (a "What's New" notice, optionally a tour).

Four coupled decisions fell out of building it.

## Decision

1. **Single source of truth = `plugins/design/dev-server/whats-new.json`.** The feed ships with the dev-server (already covered by `package.json` `files`), is served at `GET /_api/whats-new`, and is mirrored into the committed `site/lib/whats-new.json` by a prebuild generator. One file, two consumers (UI + site). Rejected: a site-only changelog page (wouldn't reach the UI) and reusing changesets (per-release, consumed by `changeset version`, keyed to npm packages not user features).

2. **The feed describes Maude's OWN product, resolved from the package root — never the served project.** `loadWhatsNew()` reads `DEV_SERVER_ROOT` (via `paths.ts`, DDR-045), so every user of the canvas browser sees Maude's release notes regardless of which repo they're serving. **This resolution root is a load-bearing security control:** a hostile *served project* must not be able to drop its own `whats-new.json` and inject `learnMore`/`tour` content that renders in the privileged main-origin shell (the exact threat DDR-054 addresses for canvases). The route is main-origin only (absent from the canvas-origin allowlist; the untrusted iframe 403s it). A regression test pins the package-root resolution. **Any future "let downstream projects add their own news" feature MUST be its own DDR** — it would convert this boundary into a content-injection lane, leaving only React's URL sanitizer as a guard.

3. **Entries are written pending (`version: null`) at `/flow:done` and stamped at release.** `scripts/bump-version.sh` → `scripts/stamp-whats-new.mjs` rewrites pending entries to the shipped version + date — mirroring how changesets accumulate then `changeset version` resolves them. Stamping at done-time would mis-attribute (package.json still holds the *last* released version), so the version a feature shipped in is only known at release.

4. **The Maude-specific authoring logic lives in a repo-internal skill, not the generic flow plugin.** `.claude/skills/whats-new-entry/` owns the entry shape + append + site-mirror regen; `/flow:done` reaches it via `integrations.whatsNew.skill` — a **generic, opt-in, config-gated** soft-prompt (absent/`enabled:false` → skipped silently). This keeps `plugins/flow/` free of Maude paths (the project-agnostic invariant) while the trigger rides the proven "rule in an always-loaded file" (CLAUDE.md) convention, not a command hook.

**Defense-in-depth (security review):** `learnMore` is constrained to `^https?://` at the schema, the client `<a>` bind, and the site `<a>` bind; `build-whats-new.mjs` validates the feed and fails the build on a malformed entry. React's production `sanitizeURL` already neutralizes a `javascript:` href, but the control is made explicit so it doesn't rely solely on a framework internal.

**Considered but not implemented:** a `MAUDE_NO_WHATSNEW=1` downstream opt-out (plan DDR-E). The feed is benign, dismissible product news and the toast is suppressed after first-acknowledge, so a global kill-switch wasn't justified for v1; revisit if downstream users object.

## Consequences

- **Good:** one curated feed powers both surfaces; shipping a feature + announcing it is one `/flow:done` step; the boundary is tested, not just commented.
- **Cost:** the committed `dist/client.bundle.js` must be rebuilt `--release` after any client change (the documented self-heal-bloat footgun); the site mirror carries a `generated` timestamp that drifts like `roadmap.json` (ungated, regenerated in prebuild).
- **Watch:** the package-root resolution test is the tripwire for decision (2) — do not let a refactor make the feed project-overridable without a new DDR.
