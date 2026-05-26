---
"@1agh/maude": minor
---

`feat(cli)`: notify users when a newer `@1agh/maude` is published

Every `maude` invocation now prints a one-line stderr notice when a newer version is available on npm — covers `maude init`, `maude config`, `maude design serve|init|export`, `maude help`, `maude version`, plus the legacy `mdcc` alias (which already prints its own deprecation warning and now follows it with the update hint when one exists).

**Hot path is sync and never blocks on the network.** The hook in `cli/bin/maude.mjs` reads `~/.cache/maude/update-check.json` (respects `XDG_CACHE_HOME`) and only prints a notice if the cached `latest` is greater than the installed version. A detached child process refreshes the cache from `https://registry.npmjs.org/@1agh/maude/latest` with a 3 s timeout whenever the cache is missing or older than 24 h. The notice therefore appears on the run *after* a new release rolls into cache — same lag pattern as `update-notifier`, and the price of not adding latency to every CLI call.

**Skip conditions** (any one wins): `MAUDE_NO_UPDATE_CHECK=1`, `NO_UPDATE_NOTIFIER=1`, `CI=true`, or stderr is not a TTY (pipes, redirects, CI logs). Zero new dependencies — uses `node:https` via global `fetch` and `node:child_process` for the detached refresh.

Output:

```
  ⚠ maude update available: 0.18.2 → 0.19.0
    Run: npm i -g @1agh/maude@latest   (or pnpm add -g / bun add -g)
```

Verified by priming the cache with a fake newer version (notice fires), by setting `CI=true` / `MAUDE_NO_UPDATE_CHECK=1` (silent), and by running the detached child directly against the npm registry (cache populated with the current published version). Unit tests cover the `cmpSemver` comparator under `cli/lib/update-check.test.mjs`.
