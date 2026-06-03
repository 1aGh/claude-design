---
"@1agh/maude": patch
---

`/design:setup-ds` Round-2 — scaffold-integrity gates + dev-server boot hardening.

**Boot fix (the user-visible one):** a global `@1agh/maude` install (or a fresh `git worktree`) could no longer boot the design dev-server — `server-up.sh` ran `bun server.ts` from source, but the npm tarball ships `server.ts`/`sync/index.ts` (which import `yjs`) while excluding the dev-server's `package.json`, so the import crashed and the boot degraded to a generic timeout. `server-up.sh` now boots the **compiled platform binary** (which embeds `yjs` + every runtime dep) the same way `maude design serve` does — resolved in `design.mjs` and handed to the helper via `MAUDE_DEV_SERVER_BIN`, with a structural allowlist so a poisoned side-channel/env can only fall back to source, never redirect the spawn. The local dev tree still boots `bun server.ts` from source (no maintainer regression). When source IS the only option and its deps are missing, boot now fails loud with an actionable `bun install` / reinstall hint instead of a silent timeout (DDR-083/DDR-084).

**Scaffold-integrity gates:** the bootstrap now fails loud on silently-broken generated output it previously trusted — 0-byte specimens, a `React.*` with no binding import (ReferenceError at module-eval), a `*/` that closed a CSS comment early, and fabricated contrast-ratio claims. Gates run at reconcile + durably in the completeness-critic, are filename-safe, and the prevention rules ship in the sub-agent CODE HYGIENE block (DDR-082).

The Playwright-missing export error (500 + `npx playwright install` hint, never a 200 + empty body) was already shipped earlier and is unchanged.
