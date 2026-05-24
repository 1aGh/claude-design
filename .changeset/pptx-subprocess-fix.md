---
"@1agh/maude": patch
---

Fix: `bun build --compile` of the dev-server standalone binary failed for all 7 platforms in v0.17.0 because `exporters/pptx.ts` did `await import('playwright')` directly. Bun's compile is greedy and pulled in `chromium-bidi/lib/cjs/bidiMapper/BidiMapper` + `cdp/CdpConnection`, which it can't resolve at compile time.

The other five exporters (png/pdf/svg/html/canva) already avoid this by spawning `bin/_*-playwright.mjs` as a `node` subprocess. PPTX was the anomaly: it ran a one-shot `chromium.launch()` inline to enumerate `[data-dc-screen]` IDs for canvas-as-separate merge.

Fix: extract the enumeration into `bin/_enumerate-artboards-playwright.mjs` (new shim that prints one ID per line on stdout) and spawn it via `Bun.spawn(['node', ...])`. Matches the existing subprocess pattern, keeps playwright + chromium-bidi out of the compiled binary graph.

Locally verified: `bun run build.ts --release` succeeds (162ms compile, 293 modules), 334/334 dev-server tests pass, biome clean.
