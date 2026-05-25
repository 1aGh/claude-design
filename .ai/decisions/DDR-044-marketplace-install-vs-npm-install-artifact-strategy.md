# DDR-044 — Marketplace install vs npm install artifact strategy

**Status:** Accepted — 2026-05-25.
**Supersedes:** none.
**Related:** [DDR-009](DDR-009-bun-runtime-authoritative-for-dev-server.md) (Bun runtime authoritative), [DDR-019](DDR-019-canvas-tsx-format.md) (canvas TSX format — per-iframe runtime bundles), [DDR-020](DDR-020-single-dev-server-runtime-bun.md) (server.ts authoritative), [DDR-025](DDR-025-canvas-lib-single-source-in-dev-server.md) (canvas-lib single source).
**Phase:** Phase 19 — Dev-server first-boot bootstrap fixes.

## Context

The Maude plugin reaches users through **two distinct install pathways** with incompatible visibility rules:

1. **npm install** (`npm i -g @1agh/maude`). Honors `package.json#files` — explicitly listed directories ship with their full contents regardless of `.gitignore`. Verified via `npm pack --dry-run`: `plugins/design/dev-server/dist/{client.bundle.js, styles.css, maude-darwin-x64, …}` are all in the tarball.

2. **Claude Code marketplace install** (`/plugin marketplace add 1aGh/maude`). Performs a `git clone` of the marketplace repo at the tag matching the requested version, into `~/.claude/plugins/cache/maude/`. **A `git clone` respects `.gitignore`** — anything matched is absent from the install. `package.json#files` has zero effect on this pathway because npm is never involved.

The system review at `.ai/logs/system-reviews/maude-dev-server-bootstrap-review.md` (2026-05-25) documented the user-visible consequence: on a fresh marketplace install, `/design:browse` 404s on `/_client/client.bundle.js` and `/_client/styles.css` (gitignored, absent from clone), and `/_canvas-runtime/<pkg>.js` 500s because `node_modules/react` is similarly absent. The `npm pack` smoke that CI runs gave us false confidence — it only validates pathway (1).

Three mechanisms were considered for closing the marketplace gap:

| Mechanism | Pro | Con |
|---|---|---|
| **(a) Commit `client.bundle.js` + `styles.css`** | Marketplace clone works zero-step. ~270 KB churn per build is small relative to repo (~1.7 GB git history already). Mirrors the existing `site/lib/roadmap.json` + `site/lib/stats.json` precedent already documented in CLAUDE.md ("Vercel cannot see the source the artifact was generated from"). | Two more files in every `git diff` after a UI tweak. Per-platform compiled binaries (~70-120 MB each) STAY ignored — they ship via `optionalDependencies` sub-packages per [DDR-009](DDR-009-bun-runtime-authoritative-for-dev-server.md), not via this repo. |
| **(b) Bundle React + ReactDOM into `client.bundle.js`** | Eliminates the `node_modules` dependency at runtime; `/_canvas-runtime/*` could ship pre-built too. | Conflicts with [DDR-019](DDR-019-canvas-tsx-format.md) — per-iframe runtime bundles are intentionally lazy-built and content-keyed per React minor. Pre-bundling would defeat the cache strategy. Doesn't solve the `dist/client.bundle.js` 404 (which is about the shell, not React). |
| **(c) Pure self-heal** (drop both gitignore changes; rely on Task 3's auto-`bun install` + `bun run build.ts`) | Git stays clean. Single mechanism (self-heal) covers all artifacts. | First boot is slow (~20-30s). Requires Bun on PATH at boot time AND write access to the cache install dir. Both are reasonable but neither is guaranteed — strict-Linux users running plugins from `/opt/claude-plugins/cache/` (read-only mount, immutable infra) would hard-fail with no recovery path. |

## Decision

**(a) + Task 3 self-heal as belt-and-braces.** Commit `client.bundle.js` + `styles.css` to git; keep per-platform binaries gitignored. Self-heal in `server.ts` covers `node_modules/` (which we will NOT commit — ~150 MB of transitive deps, hard NO) and serves as the recovery path for anyone whose shell bundle was somehow missing or corrupted.

Concretely, `.gitignore` becomes:

```
plugins/design/dev-server/dist/*
!plugins/design/dev-server/dist/client.bundle.js
!plugins/design/dev-server/dist/styles.css
```

The negation pattern requires `dist/*` (with the glob) rather than `dist/` (which matches the directory and prevents `git` from descending into it to evaluate the negations).

`react` + `react-dom` move from `devDependencies` → `dependencies` in `plugins/design/dev-server/package.json` so the self-heal's `bun install --production` pulls them.

## Decision table

| Concern | Choice | Rationale |
|---|---|---|
| `client.bundle.js` | Committed | Read by every `/design:browse`; zero-cost git diff |
| `styles.css` | Committed | Same |
| `dist/maude-*` per-platform binaries | Gitignored | 70-120 MB each, ship via `optionalDependencies` sub-packages |
| `dist/server-*.js.map` | Gitignored | Debug artifact, regenerable, multi-MB |
| `dist/.compile-entries/*` | Gitignored | Build intermediates |
| `node_modules/` | Gitignored | ~150 MB; self-heal pulls on first boot |
| `bun.lock` | Gitignored (status quo) | Per DDR-009, no Node fallback; lock isn't deterministic across Bun minor versions yet |
| `MAUDE_NO_AUTOBUILD=1` env flag | Honored | Immutable-infra escape hatch — fails fast with remediation message |

## Alternatives rejected

- **(b) Inline-bundle React**: conflicts with DDR-019. Re-reading DDR-019, the per-iframe lazy bundle is the right model — pre-bundling would have a 4× larger client.bundle.js and lock every canvas to a single React minor, breaking the version-skew tolerance DDR-019 was written to provide.
- **(c) Pure self-heal**: rejected as the sole mechanism. Self-heal is excellent for `node_modules/` (large, transitive, regularly stale) but a 270 KB bundle file is too small to justify the first-boot latency penalty AND the read-only-filesystem fail case.
- **Commit `node_modules/` too**: would solve `runtime-bundle.ts` without self-heal but blow up repo size 100×. Easy NO.
- **Ship the whole plugin via npm (no marketplace clone)**: orthogonal — the marketplace mechanism is what Claude Code provides, can't bypass it without convincing users to do `npm i -g` first.
- **Hybrid: commit `styles.css` only, self-heal `client.bundle.js`**: rejected — adds inconsistency to the gitignore rule AND most users see the self-heal on every boot (because `client.bundle.js` changes whenever the UI shell does).

## Consequences

**Positive:**
- Marketplace cache install works on first try. Validation step 6 in the plan becomes a passing scenario.
- Single decision documented; future contributors don't re-litigate "wait, is `dist/` ignored or not?"
- Belt-and-braces — self-heal is still there for users whose `dist/` somehow got nuked.

**Negative:**
- Every UI shell change produces a `client.bundle.js` diff. Reviewers must learn to ignore it (CODEOWNERS hint or eslint marker forthcoming if it becomes a nuisance).
- The build is no longer hermetic with respect to git: forgetting to run `bun run build.ts` before commit ships a stale bundle. Mitigation: pre-commit hook (out of scope here; tracked as follow-up).

**Neutral:**
- Repo size grows ~270 KB per `client.bundle.js` rev × ~weekly cadence = ~14 MB/year of git history bloat. Repo is ~1.7 GB; this is noise.

## Validation

The marketplace-install simulation in Phase 19's plan (Validation step 6) is the canonical smoke for this decision. It must:

1. `git clone --depth 1 . $TMP/maude` (simulates marketplace fetch, honors `.gitignore`)
2. `cd $TMP/maude/plugins/design/dev-server && bun run server.ts --root /tmp/scratch-design-project --port 4498`
3. Self-heal runs `bun install --production` (one-time, pulls `node_modules/react` + `react-dom`)
4. Server starts; `curl -sf /_client/client.bundle.js` returns 200 (committed file, no rebuild needed)
5. `curl -sf /_canvas-runtime/react.js` returns 200 (lazy-built, succeeds because `node_modules/react` is now there)

If step 4 ever fails, this decision needs revisiting. If step 3 fails on a read-only filesystem and the user wants to opt out, `MAUDE_NO_AUTOBUILD=1 bun run server.ts` should exit with the remediation message — verified in `boot-self-heal.test.ts`.
