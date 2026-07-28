# DDR-042 — oxc-parser kept; `bun --compile` NAPI regression bypassed via `NAPI_RS_NATIVE_LIBRARY_PATH`

**Status:** Accepted — 2026-05-25.
**Supersedes:** none.
**Related:** [DDR-009](DDR-009-bun-runtime-authoritative-for-dev-server.md) (Bun runtime authoritative — preserved; this DDR is a build-layer workaround, not a runtime decision change).

## Context

`@1agh/maude-<slug>` binaries published since v0.17.0 crash on startup with `Cannot find native binding ... oxc-parser/src-js/bindings.js:575`. Initial assumption — that the build pipeline had always been broken or that oxc-parser was structurally incompatible with `bun build --compile` — was wrong.

A 30-minute spike during the bug-fix session traced the root cause to a Bun-side regression:

| Bun version | `bun build --compile` of a 3-line file that imports `parseSync` from `oxc-parser` |
|------------:|:--|
| **1.3.3**   | ✅ binary starts, parses, exits cleanly |
| 1.3.4       | ❌ same source, crash at `bindings.js:575` |
| 1.3.7       | ❌ |
| 1.3.10      | ❌ |
| 1.3.12      | ❌ |
| 1.3.14      | ❌ (the version `oven-sh/setup-bun@v2` shipped to CI when v0.17.0 + v0.17.1 were built) |

NAPI-RS's auto-generated `bindings.js` does dynamic `require()` of the platform sub-package (`require('@oxc-parser/binding-<slug>')`). Bun 1.3.4+'s `--compile` static analysis no longer embeds the matching `.node` asset for that pattern. Static-importing the binding package at the top of the entry (in lieu of the dynamic require) did not help on 1.3.14 — the asset still wasn't bundled.

Reproducer: `/tmp/oxc-spike/spike-baseline.ts`, kept around during the bug-fix session for the upstream Bun report. Three lines:
```ts
import { parseSync } from 'oxc-parser';
const r = parseSync('test.tsx', 'const x = <div/>;', { sourceType: 'module' });
console.log({ errors: r.errors.length, hasProgram: !!r.program });
```

Will be re-staged into the maude repo as `plugins/design/dev-server/test/spike-baseline-bun-compile.ts` if the regression isn't resolved upstream in a quarter — until then the test in `test/compile-entry.test.ts` covers the workaround surface and the spike scratch lives in `.ai/dev-logs/` history.

## Options considered

| # | Approach | Pro | Con | Verdict |
|---|----------|-----|-----|---------|
| 1 | Swap `oxc-parser` → `@babel/parser` (pure JS) | Bundles cleanly; no native bits | 10–30× slower parse; loses oxc/Bun ecosystem alignment; needs walker code touched in 4 files; behavior diffs on TSX edge cases | **Rejected** — sledgehammer for a build-layer bug. |
| 2 | Subprocess pattern (mirror commit `4a0d6ab` for playwright) | Established pattern | Production install has no `node_modules`, so the spawned subprocess can't `require` oxc either — same root problem plus IPC cost per canvas | **Rejected** — doesn't actually solve the prod case. |
| 3 | External oxc + ship `.node` alongside each platform sub-package | Keeps oxc speed | Breaks single-binary contract (DDR-009 spirit); per-platform sub-package needs the .node file shipped separately + loader patched | **Rejected**. |
| 4 | Pin Bun to ≤ 1.3.3 in CI | Trivial diff | Locks the project out of every Bun bug fix + perf improvement since 1.3.3; bug never gets surfaced upstream | **Rejected** — fragile + actively masks the report. |
| 5 | **Set `NAPI_RS_NATIVE_LIBRARY_PATH` from a Bun-embedded asset, before any oxc-parser import** | Keeps oxc-parser; zero changes to canvas-pipeline / canvas-edit / canvas-lib-inline / handoff; builds on a future-proof NAPI-RS contract; works on Bun 1.3.14 verified end-to-end | Requires per-target entry stub generation; 7 small generated files per build | **Accepted**. |

## Decision

Generate two thin files per `--target` from `build.ts`, place them under `plugins/design/dev-server/dist/.compile-entries/` (gitignored), point `bun build --compile` at the generated entry instead of `server.ts`:

```ts
// init-oxc-<slug>.ts
import bindingPath from '@oxc-parser/binding-<oxc-slug>/parser.<oxc-slug>.node' with { type: 'file' };
process.env.NAPI_RS_NATIVE_LIBRARY_PATH = bindingPath;
```

```ts
// server-<slug>.ts (the new entry)
import './init-oxc-<slug>.ts';
import '../../server.ts';
```

`<oxc-slug>` differs from our build-target slug for three targets — Linux needs a libc-kind suffix and Windows a toolchain suffix:

| maude slug          | oxc binding slug         |
|---------------------|--------------------------|
| `darwin-arm64`      | `darwin-arm64`           |
| `darwin-x64`        | `darwin-x64`             |
| `linux-x64`         | `linux-x64-gnu`          |
| `linux-arm64`       | `linux-arm64-gnu`        |
| `linux-x64-musl`    | `linux-x64-musl`         |
| `linux-arm64-musl`  | `linux-arm64-musl`       |
| `win32-x64`         | `win32-x64-msvc`         |

The mapping lives in `build.ts:oxcBindingSlug` and is mirrored (with the same table) in `test/compile-entry.test.ts` so a divergence breaks loudly.

## Why two files, not one

ESM hoists every `import` statement above the module's own top-level code. If env-var assignment lives in the entry's top-level code:

```ts
import bindingPath from 'X.node' with { type: 'file' };
process.env.NAPI_RS_NATIVE_LIBRARY_PATH = bindingPath;  // top-level — runs AFTER imports
import '../../server.ts';                                // ← evaluates first (DFS post-order via server.ts → canvas-pipeline.ts → oxc-parser → bindings.js → CRASH)
```

…oxc-parser evaluates before our env-var setter runs, and we're back where we started. Putting the env-var assignment in a *separate leaf module* (`init-oxc-<slug>.ts`) and importing it BEFORE server.ts is what guarantees the assignment runs first. Confirmed by spike: single-file entry crashes, split-file entry works (Bun 1.3.14).

This was the first wrong cut during execution; the test in `compile-entry.test.ts` explicitly asserts `initIdx < serverIdx` so the regression class is gated.

## Distribution constraint

`@oxc-parser/binding-<slug>` packages are oxc-parser's `optionalDependencies` — pnpm puts them inside `node_modules/.pnpm/oxc-parser@<v>/node_modules/`, not at the workspace level. Bun's bundler can't resolve `@oxc-parser/binding-X/...` from outside oxc-parser's own scope. We add all 7 platform binding packages as **direct devDependencies** of `plugins/design/dev-server/package.json` so pnpm symlinks them at the workspace level. They're already in the lockfile via oxc-parser's optionalDependencies — the direct declaration just creates the visible symlink.

## Consequences

- **Pro**: oxc-parser speed retained; DDR-009 single-binary intent preserved; pipeline files (`canvas-pipeline.ts`, `canvas-edit.ts`, `canvas-lib-inline.ts`, `handoff.ts`) untouched; bun version stays unpinned; works on Bun 1.3.14 verified, host build also clean on 1.3.3.
- **Con**: 7 generated files per build (negligible — gitignored; regenerate ≪ 1 ms); per-target stub is a moving part future maintainers must understand (mitigated by this DDR + the inline comments in `build.ts:writeCompileEntry`); 7 extra `@oxc-parser/binding-*` devDependency lines in `plugins/design/dev-server/package.json`.
- **Vestigial when fixed upstream**: once Bun closes the regression, the entry stub generation can be inlined back into `server.ts` (or deleted entirely). Tracked by the upstream Bun issue (filed as part of the same bug-fix session — see T7 of the plan).

## Verification

- Local builds with Bun 1.3.3 host: produce a 61 MB `dist/maude-darwin-arm64` that starts, returns `{"ok":true}` on `/_health`, and serves canvases end-to-end.
- Local builds with Bun 1.3.14 (forced via `PATH=/tmp/bun-1.3.14/bin:$PATH bun run build.ts`): produce a 61 MB binary that starts, returns `/_health`, banner prints. Without the workaround the binary crashed at `bindings.js:575` within ~50 ms of startup.
- Cross-compile spot check: `bun-linux-x64` / `bun-linux-arm64` / `bun-linux-x64-musl` / `bun-linux-arm64-musl` / `bun-windows-x64` all produce binaries with the correct executable type (`file` reports ELF / PE32+). Per-target stubs validated by `test/compile-entry.test.ts` (6 tests, 62 expectations).
- Full dev-server test suite: 340 / 340 pass.

## References

- Spike log: previously at `.ai/dev-logs/2026-05-25-binary-broken-oxc-parser-followup.md` (deleted as part of T6 in the implementing plan; superseded by this DDR's "Context" section).
- Plan: `.ai/plans/fix-binary-oxc-parser-binding.md` (T1–T9). Will move to `.ai/plans/archive/` on `/done`.
- Implementation commit: forthcoming `fix(dev-server): work around Bun 1.3.4+ --compile NAPI embedding regression`.
- Upstream Bun issue: TODO — filed as part of T7 of the implementing plan, link to be added on file.
