---
"@1agh/maude": patch
---

Bump `motion` 11.18.2 → 12.40.0 (dev-server canvas animation runtime) and regenerate the committed `dist/runtime/*.js` bundles on the trusted macOS profile. The release-minified `motion.js` / `motion_react.js` ship current; the same regen also refreshes the `react`/`react-dom`/`yjs` runtime bundles to match the post-#31 lockfile (19.2.7 / 13.6.31), which the patch-and-minor sweep had left stale. No public API or canvas-lib surface change — `motion`, `AnimatePresence`, `useReducedMotion` are the only motion APIs consumed and are unchanged in v12. Validated via `check-runtime-bundles` floors, `runtime-health`, and a 45/45 `design smoke` render pass.
