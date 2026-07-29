---
"@1agh/maude": patch
---

Fix the macOS desktop build, which has produced no installer since v0.48.0.

Three separate faults in the kgai bundling path, all introduced with it:

- The engine and `libkuzu` were code-signed **before** `tauri build`, but the
  Developer ID only enters a keychain **inside** `tauri build` — so `codesign`
  had nothing to look up and failed the leg outright. Signing now happens
  against a short-lived keychain the build stands up and tears down itself.
- The kgai download called `api.github.com` unauthenticated, where the quota is
  60 requests/hour shared across every job on the runner's IP. It passed or
  failed by luck; it now authenticates, and no longer walks the plugin tree once
  per architecture.
- `tauri build` re-ran the kgai sync a third time and overwrote the universal,
  signed engine with a thin, ad-hoc-signed one — which notarization would have
  rejected, and which could not have run on an Intel Mac at all.

No change to the shipped app's behaviour; this restores the macOS `.dmg`.
