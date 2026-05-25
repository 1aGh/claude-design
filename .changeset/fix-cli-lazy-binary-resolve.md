---
'@1agh/maude': patch
---

**fix(cli): make `maude design serve` work when postinstall was skipped**

`runServe` now resolves the platform binary lazily when the side-channel file
(`cli/.platform-binary-path`) is absent — looks up the sibling `@1agh/maude-<slug>` package via filesystem + `require.resolve`, then caches the result.
Postinstall becomes an optimization, not a correctness requirement, so global
installs under Bun (no postinstall by default), `npm --ignore-scripts`, pnpm
strict-scripts, and Docker layer rebuilds work the same as a vanilla
`npm i -g @1agh/maude`.

When no binary is available **and** we're not in a local source checkout
(`packages/maude-darwin-arm64/` marker), the dispatcher hard-fails with an
actionable hint (clean reinstall recipe + `npm rebuild` alternative) instead of
falling through to `bun run server.ts` and crashing on missing `magic-string`
or `oxc-parser` native bindings — those `node_modules` are not in the
published tarball.

In a local dev tree the source fallback is preserved, but a pre-flight check
verifies `magic-string` and `oxc-parser` are resolvable first and surfaces a
`pnpm install` hint instead of a cryptic stack trace if they're not (catches
the npm optional-deps native-binding bug, npm#4828).

Adds `MAUDE_FORCE_SOURCE=1` env override so maintainers hacking on
`plugins/design/dev-server/` can skip the binary and run from source.
