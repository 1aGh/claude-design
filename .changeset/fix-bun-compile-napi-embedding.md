---
'@1agh/maude': patch
---

**fix(dev-server): work around Bun 1.3.4+ `--compile` NAPI embedding regression**

Every `@1agh/maude-<slug>` binary published since v0.17.0 crashed on startup
with `Cannot find native binding ... oxc-parser/src-js/bindings.js:575`. Root
cause: Bun 1.3.4 introduced a regression in `bun build --compile` that no
longer embeds NAPI-RS platform sub-package bindings (the
`@oxc-parser/binding-<slug>/parser.<slug>.node` asset). Bun 1.3.3 worked;
1.3.4 through 1.3.14 (the version `setup-bun@v2` shipped to CI) all break the
same way. Confirmed via bisect.

The fix is a build-layer workaround that keeps oxc-parser intact (no parser
swap, no perf regression, no edits to `canvas-pipeline.ts` /
`canvas-edit.ts` / `canvas-lib-inline.ts` / `handoff.ts`):

- `build.ts:writeCompileEntry(target)` generates two thin files per `--target`
  under `dist/.compile-entries/` (gitignored): an `init-oxc-<slug>.ts` leaf
  module that embeds the matching platform binding as an asset via
  `with { type: 'file' }` and sets `NAPI_RS_NATIVE_LIBRARY_PATH` from the
  resolved virtual path, then a `server-<slug>.ts` entry that imports the
  init module BEFORE `../../server.ts`.
- NAPI-RS's `bindings.js` honors `NAPI_RS_NATIVE_LIBRARY_PATH` before its
  broken platform-detection switch, so the env-var setup bypasses the
  regression entirely.
- All 7 `@oxc-parser/binding-<slug>` packages are now direct devDependencies
  of `plugins/design/dev-server/` so pnpm symlinks them at workspace level
  (Bun's bundler can't otherwise resolve them — pnpm hides them inside
  oxc-parser's nested node_modules as transitive optionalDependencies).
- New `test/compile-entry.test.ts` (6 tests, 62 expectations) locks the
  generator's contract: per-target file paths, init-before-server import
  order, POSIX path separators, idempotence.

See DDR-042 for the full options matrix (why not babel, why not subprocess,
why not external + ship). Upstream Bun issue filed (draft in
`.ai/dev-logs/upstream-bun-issue-draft.md`) — when fixed upstream, the entry
stub generation can be removed.
