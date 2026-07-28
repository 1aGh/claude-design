# DDR-020: Single dev-server runtime — `server.ts` (Bun) authoritative, `server.mjs` sunset

- **Date:** 2026-05-19
- **Status:** Accepted
- **Tags:** design, dev-server, bun, server.mjs, server.ts, sunset, runtime, phase-3.6
- **Related:** [DDR-009](./DDR-009-bun-runtime-authoritative-for-dev-server.md) (Bun authoritative), [DDR-013](./DDR-013-server-modular-split-typescript.md) (modular split), [DDR-015](./DDR-015-per-platform-binary-distribution.md) (per-platform binaries), [DDR-019](./DDR-019-canvas-tsx-format.md) (TSX canvas pipeline), [`.ai/logs/system-reviews/phase-3.6.1-canvas-envelope-and-ds-specimens-review.md`](../logs/system-reviews/phase-3.6.1-canvas-envelope-and-ds-specimens-review.md) — divergence B7 surfaced this concretely.

## Context

The dev-server has had two parallel runtimes since Phase 3.4 landed Bun:

| File | LOC | Runtime | TSX pipeline |
| --- | --- | --- | --- |
| `plugins/design/dev-server/server.mjs` | 1288 | `node:http` | ❌ |
| `plugins/design/dev-server/server.ts` | 131 + modular split (api.ts, http.ts, canvas-build.ts, …) | `Bun.serve` | ✅ |

`server.ts` is the authoritative implementation per [DDR-009](./DDR-009-bun-runtime-authoritative-for-dev-server.md); `server.mjs` is the pre-migration legacy. They coexist because `bin/server-up.sh` falls back to `node server.mjs` when `bun` isn't on `$PATH`.

Phase 3.6.1 retro divergence **B7** documented the cost: `server.mjs` serves `*.tsx` as `text/plain`, so every TSX canvas renders blank under the Node fallback. The fallback **hides** the missing TSX pipeline — a user with Node-only installs gets a working server that silently produces a broken UI surface. We patched `server-up.sh` to prefer Bun + warn loudly on fallback (`server-up.sh:56`), but the fallback path itself is still there, and `server.mjs` still ships in the npm package.

Three forces converge:

1. **Per-platform binary distribution** ([DDR-015](./DDR-015-per-platform-binary-distribution.md)) — the npm package ships pre-compiled Bun binaries via `optionalDependencies`. Node-only installs are not a supported configuration. The Node fallback is a fiction: it works for Phase-3.5-and-earlier canvases but is broken for Phase 3.6+.
2. **Maintenance tax** — every dev-server feature (HMR broadcast, canvas-build CSS injection, canvas-lib resolver, TSX inspector wiring) lands in `server.ts`. `server.mjs` is frozen at the pre-Phase-3.6 shape but still gets pulled into version bumps, `files:` manifests, and `bin/` scripts. ~1300 LOC of legacy code that nobody is updating but everybody steps around.
3. **Phase 3.6.1 documentation regression** — divergence B7 was caught only because the user opened a TSX canvas manually post-`/validate`. STATE.md flagged the fallback as "carry-over, worth a Phase 3.6.2 or DDR" — this DDR closes that loop.

## Decision

**`server.ts` is the only supported dev-server runtime.** `server.mjs` is sunset in two phases:

### Phase A — immediate (this DDR + Phase 3.6.2)

- `bin/server-up.sh` stops auto-falling back to `server.mjs`. If `bun` is not on `$PATH`, exit with a hard error pointing at the install link.
- `bin/server-up.sh` no longer needs the `RUNTIME=node` branch; remove it.
- Add `bin/server-up.sh:--allow-legacy` opt-in flag for users who explicitly want to boot `server.mjs` (debug-only; emits "you are running an unsupported runtime" on stderr).
- `package.json:files` keeps `server.mjs` shipping for one release cycle — the npm-installed `mdcc` CLI must keep working for users mid-upgrade who haven't installed the Bun binary yet. The CLI's `mdcc design serve` already calls `server-up.sh`, so they'll hit the hard error and the install hint, not a broken fallback.

### Phase B — next release (one minor version after Phase A ships)

- Delete `server.mjs` entirely.
- Remove `server.mjs` from `package.json:files`.
- Remove the `--allow-legacy` flag from `server-up.sh`.
- Remove the `if [ "$RUNTIME" = "bun" ]` / `else node` branches throughout `bin/`.

This phasing ensures users who upgrade across the boundary get a clear error in Phase A before the file disappears in Phase B.

## Alternatives considered

### A — Convert `server.mjs` into a thin `bun server.ts` exec wrapper

Keep the file as a one-line shim so anything that hard-codes `node server.mjs` keeps working.

- **Pros:** Smallest blast radius. External shell scripts (CI, custom user setups) that invoke `server.mjs` directly stay green.
- **Cons:** No external consumers exist — `server.mjs` is invoked only from `bin/server-up.sh` (which already prefers Bun) and from the back-compat `claude-design-server` bin alias. Both can move to `bun server.ts` directly. The wrapper is dead weight.

### B — Keep both, but write a TSX pipeline into `server.mjs`

Backport canvas-build + canvas-lib resolver + ID injection to Node so the fallback works.

- **Pros:** True dual-runtime support; Node-only installs become first-class.
- **Cons:** Doubles every dev-server change going forward. DDR-009 already committed to Bun as authoritative. DDR-015 ships Bun binaries. This contradicts both prior decisions for the benefit of a configuration nobody is targeting.

### C — Delete `server.mjs` immediately

Skip the phased sunset; rip the file out in one commit.

- **Pros:** Cleanest end state.
- **Cons:** Users on the prior npm release who upgrade past this commit and don't have Bun installed lose the fallback they were relying on with no transitional error. Phased A→B gives them one release of "loud failure with install hint" before the file disappears.

## Consequences

**Positive:**

- One runtime, one mental model. Dev-server changes land in one place. Onboarding cost drops.
- Phase 3.6.1 B7-class regressions (silently broken TSX pipeline under fallback runtime) become structurally impossible — there's no fallback to silently break.
- ~1300 LOC of legacy code leaves the repo. `package.json:files` shrinks. `bin/server-up.sh` becomes ~30 LOC shorter.
- `bun:test` is the only test runtime ([DDR-009](./DDR-009-bun-runtime-authoritative-for-dev-server.md)). `node --test` was already not used; no test migration needed.

**Negative / trade-offs:**

- Hard requirement on Bun installation for any user running the dev-server. The npm package's per-platform Bun binaries ([DDR-015](./DDR-015-per-platform-binary-distribution.md)) ship this dependency for the supported platforms; manual installs (`bun.sh/install`) are the documented fallback elsewhere.
- One release cycle of "hard error instead of fallback" — users mid-upgrade who haven't installed Bun see the error before they see the install hint. Mitigated by the install-link message in `server-up.sh`.

**Closed risks:**

- ~~"Two parallel runtimes will keep producing B7-class bugs"~~ — closed by deleting one of them.
- ~~"`server.mjs` is the back-compat path for the `claude-design-server` bin alias"~~ — alias points at the script that calls `server-up.sh`; `server-up.sh` chooses the runtime. No direct `server.mjs` reference.

## Compatibility notes

- **Phase A → B transition window:** Users running `mdcc design serve` between Phase A and Phase B without Bun installed see `✗ bun not on $PATH — install via https://bun.sh/install` instead of the silent Node fallback. Document this in the next release notes.
- **CI workflows** under `.github/workflows/` — none invoke `server.mjs` directly. No CI change needed.
- **`mdcc` CLI** (`cli/commands/design.mjs`) — already routes through `server-up.sh`. No CLI change needed beyond the helper edit.
- **`claude-design-server` bin alias** in `package.json` — points at `cli/bin/mdcc.mjs design serve`, which routes through `server-up.sh`. No alias change needed.

## Research source

In-session retro `.ai/logs/system-reviews/phase-3.6.1-canvas-envelope-and-ds-specimens-review.md` (Theme 2 + divergence B7). Phase 3.4 plan + DDR-009 are the upstream commitment this DDR finishes the migration off of.
