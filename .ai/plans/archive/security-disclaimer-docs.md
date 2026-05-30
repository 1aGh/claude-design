---
name: security-disclaimer-docs
status: implemented
created: 2026-05-29
---

# Feature: User-facing security disclaimer in the docs

## Description

Add a **user-facing "Is maude safe?" page** to the docs site that explains the threat model honestly: what runs where, what's trusted vs untrusted, and the mechanisms that make each mode safe. Audience = someone evaluating whether to install/run maude. Distinct from the existing `SECURITY.md` (vulnerability *reporting* policy) and from `hub/linking.mdx` (linked-mode operational detail) — this page is the "why is this safe, and what are the limits" overview, cross-linking both.

**User story:** As someone deciding whether to adopt maude, I want a clear, honest account of what it can and can't touch, so I can trust it with my repo without reading the source.

## Honesty constraint (load-bearing)

This is a **security disclaimer, not marketing**. It MUST be accurate, not reassuring-by-omission. Specifically:
- Solo mode is genuinely local + low-risk — say so plainly.
- Linked mode has a **documented trust model with bounded, disclosed residuals** (F1 is MEDIUM, not LOW; a WebRTC/self-nav collab-metadata exfil lane remains for *opted-in synced* canvases). State these, don't hide them.
- Never write "100% safe" / "unhackable". The credibility of a security page is its candor about limits.

## Metadata

- **Type**: Documentation
- **Complexity**: Low (new MDX page + nav entry + 2 cross-link pointers; no code, no deps)
- **App/Package**: `site/` (docs) + root `README.md`
- **Affected Systems**: docs site (fumadocs), README
- **Dependencies**: none

## Context References

- `SECURITY.md` — vuln-reporting policy; the new page links to it, does NOT duplicate it.
- `site/content/docs/hub/linking.mdx` (the "What syncs: HTML by default, TSX by opt-in" + "Synced files are untrusted context" sections) — linked-mode detail to link into, not restate.
- `site/content/docs/meta.json` — fumadocs nav; new page must be registered here.
- `site/content/docs/getting-started.mdx` (trailing `<Cards>`) — pattern for a card link to the new page.
- DDRs to cite (source-of-truth for each claim):
  - [DDR-054] linked-mode trust model (trust gate, token hashing, CI-gate, size caps).
  - [DDR-063] canvas-origin split default-on / `.tsx` sync opt-in / **F1 accepted at MEDIUM** (cite the residual honestly).
  - [DDR-060] TSX sync unblock context.
  - [DDR-056] linked-mode gitignore + the frozen hub image (`--frozen-lockfile`) supply-chain note.
  - [DDR-062] plugins reach executable logic only through the on-PATH `maude` CLI (→ "plugins are prompts, not shipped binaries").
- `plugins/flow/skills/security-rules/SKILL.md` — the AI-era threat hard-stops (trifecta, prompt injection) the project audits against.

## Content outline (what the page must cover)

1. **TL;DR** — solo mode is fully local and low-risk; linked (multiplayer) mode is opt-in and uses an explicit trust model with disclosed limits.
2. **What runs on your machine** — the CLI + zero-dep dev-server run locally, resolve *your* repo root, and don't phone home (no telemetry). Plugin commands/skills/agents are **markdown prompts**, not shipped executables; the only executable logic is the open-source `maude` CLI + dev-server (DDR-062).
3. **Solo mode (default)** — no network trust surface. The canvas sandbox (CSP + iframe sandbox + route-allowlist) is on by default and isolates even your *own* canvas code (DDR-063); opt out with `MAUDE_CANVAS_ORIGIN_SPLIT=0`.
4. **Linked / hub mode (opt-in)** — the trust boundary (DDR-054): hub-pushed content is treated as untrusted input; a trust gate guards non-loopback hubs; tokens are hashed at rest; a CI-gate blocks PR-driven silent linking; size caps + schema guards on synced data.
5. **Canvas containment + the F1 residual** — what the sandbox closes (repo-file read, `/_api/export`, config, cloud IMDS, LAN, cross-origin fetch/WS) and what it does **not** fully close (WebRTC/self-navigation can still leak *collab metadata* — names/emails/comments — from a canvas you explicitly opted into syncing). F1: CRITICAL → MEDIUM.
6. **`.tsx` sync is doubly opt-in** — requires the sandbox active AND a per-canvas `"syncable": true`; hand-set only, never settable by a remote hub.
7. **Untrusted-context handling (AI safety)** — synced files are flagged (`.design/_untrusted/INDEX.json` + a managed `.claudeignore` block) so an injected instruction can't steer `/design:edit`. Project audits against the trifecta/prompt-injection hard-stops (`security-rules`).
8. **Supply chain** — the hub release image installs frozen (`--frozen-lockfile`, DDR-056); runtime bundles are committed + size-gated.
9. **What you control** — opt out of the sandbox, never link to untrusted hubs, the per-canvas sync opt-in, where synced/untrusted files live.
10. **Reporting** — link to `SECURITY.md`.

## Tasks

### Task 1: CREATE `site/content/docs/security.mdx`
- **Do**: Author the page per the Content outline + Honesty constraint. Use fumadocs MDX (frontmatter `title` + `description`; `<Cards>`/`<Card>` for the cross-links as in `getting-started.mdx`). Cite DDRs via GitHub blob URLs (mirror the `hub/linking.mdx` citation style). Cross-link `hub/linking` (linked-mode detail) + `SECURITY.md` (reporting).
- **Gotcha**: Don't restate `hub/linking.mdx` — link to it. Keep claims traceable to a DDR; no invented guarantees.
- **Validate**: `pnpm --filter @maude/site build` compiles the MDX; page renders.

### Task 2: UPDATE `site/content/docs/meta.json`
- **Do**: Register `"security"` in the nav `pages` — under the `---Learn---` group (e.g. after `"hub"`), so it sits with the conceptual docs.
- **Validate**: page appears in the docs sidebar after build.

### Task 3: ADD a short Security section to `README.md`
- **Do**: A 2–4 line "Security" section: solo = local, linked = opt-in trust model, link to `/docs/security` + the existing `SECURITY.md` reporting line. Keep it terse — the docs page is the full account.
- **Gotcha**: README line 10 already links `SECURITY.md`; don't duplicate the reporting policy — point to the new overview.
- **Validate**: links resolve.

## Validation

1. **Build**: `pnpm --filter @maude/site build` — MDX compiles, no broken internal links.
2. **Docs freshness**: `/flow:maintain-docs` — no stale/contradictory security claims across docs (esp. vs `hub/linking.mdx` and `SECURITY.md`).
3. **Accuracy review**: re-read against DDR-054 + DDR-063 — every safety claim maps to a DDR; the F1-MEDIUM residual and the WebRTC/self-nav limit are stated, not omitted.
4. **Manual**: no "100% safe"/absolute-guarantee phrasing; solo-vs-linked distinction is unambiguous.

## Acceptance Criteria

- [x] `security.mdx` created, registered in nav, builds clean. _(193/193 pages; `docs/security` route prerendered, 118 KB.)_
- [x] README has a brief Security section linking the docs page + `SECURITY.md`.
- [x] Every claim is DDR-traceable; residuals (F1 MEDIUM, WebRTC/self-nav metadata leak for opted-in sync) are disclosed. _(Re-verified vs DDR-053/054/056/060/062/063 + DDR-064 (newer). Two plan-outline corrections applied: token "hashed at rest" is the **hub** store only (HMAC-SHA256, `tokens.mjs`, DDR-053 Task 6) — the **client** token stays plaintext-0600, kept distinct in the page; the frozen-lockfile hub image is cited to DDR-054 "untrusted-to-peers" + the release rule, not DDR-056 (which is gitignore). `.claudeignore` context-exclusion is disclosed as pending Claude Code honoring it.)_
- [x] No contradiction with `hub/linking.mdx` or `SECURITY.md`; no overclaiming. _(Cross-doc facts consistent; reporting policy linked not duplicated; only "100% safe"/"unhackable" occurrence is the honesty negation.)_
- [x] `/flow:maintain-docs` — ran tree-wide (user-requested). Surfaced systemic stale HTML→TSX canvas-format framing the original plan didn't scope; fixed across `hub/linking` (heading + 8 spots), `hub/index`, `recipes/expo`, `README`, `CLAUDE.md`. 0 dead links, all nav pages resolve.

## Retro

- **Accuracy-first paid off.** Cross-checking every claim against the cited DDRs *before* authoring (the whole point of a security-disclaimer page) caught two attribution errors the plan outline carried: "tokens hashed at rest" is a **hub-only** property (HMAC-SHA256, DDR-053 Task 6) — the client token stays plaintext-0600; and the frozen-lockfile image traces to DDR-054 "untrusted-to-peers", not DDR-056 (gitignore). Plus one honesty nuance (`.claudeignore` exclusion pends Claude Code support). For a "disclaimer not marketing" page, verification *is* the work.
- **`/flow:maintain-docs` earned its place in the loop.** The user's instinct ("TSX is default, HTML is gone — check the DDRs") was right and exposed systemic drift (`.design/*.html`, "HTML by default", "HTML/JSX mocks") that the TSX-only migration (Phase 3.6 / DDR-060, 2026-05-18) left across the docs months ago. A docs-freshness sweep should be default on any plan that touches user-facing claims, not an afterthought.
- **Verify newer DDRs since plan-creation.** DDR-064 (`MAUDE_SHARED_DOC`, default OFF) postdated this plan's citation list; checking it confirmed shared-doc must NOT be described as live. Next time: make "scan DDRs created *after* the plan date" an explicit pre-step for any DDR-citing doc.
- **Shared-tree coordination cost.** Executed on a heavily-concurrent `main` (21 uncommitted entries from another workstream incl. `roadmap.json`/`stats.json`). Had to scope every commit to own files and defer roadmap regen + STATE Status to the concurrent owner. The plan assumed a clean tree; for side-tracks, budget the scoping overhead.
- **Docs-only `/flow:done` is an awkward fit.** The 5-platform scenario, a11y audit, and security defender/attacker fan-out are all N/A for MDX prose (the repo has no runnable app; there's no code/auth/input surface in a doc page). A lightweight "docs-track" close-out variant would avoid the explicit-skip dance.
