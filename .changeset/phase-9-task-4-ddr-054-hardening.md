---
"@1agh/maude": minor
---

Phase 9 Task 4 hardening pass — addresses chained-finding audit on the bidirectional file sync agent (DDR-054).

`/flow:done` review-only on the Task 4 ship surfaced 1 CRITICAL + 4 HIGH chained findings (defender saw 0 blockers in-isolation; attacker promoted by composing with pre-existing dev-server behavior). DDR-054 pins the linked-mode trust model: the hub is a semi-trusted writer with the same disk privilege as the local user. Four architectural items remain DOCUMENTED RISKS until Tasks 5/6/8 land; this hardening commit ships the 8 quick wins.

Fixes:
- CI environment gate in `createSyncRuntime` (`CI` / `GITHUB_ACTIONS`) — closes future-CI supply-chain side-door (override via `MAUDE_SYNC_IN_CI=1`).
- Refuse `.tsx` canvases in sync discovery — closes worst lane of hostile-hub RCE (Bun.Transpiler turning hub-pushed JSX into JS).
- Symlink-safe atomic write: `openSync(tmp, 'wx', 0o600)` + 128-bit random suffix — closes shared-tenant tmp-symlink race.
- Hard size caps in codec (`4 MB` HTML, `1 MB` comments, `1 MB` SVG) — closes single-canvas memory-exhaustion DoS.
- Scheme allowlist via new `checkUrlScheme()` — refuses `http://` / `ws://` to non-loopback hosts (closes cleartext-token-over-MITM).
- Path-containment guards in `fs-mirror.notify` (rejects `..` + absolute) + `fire` (resolved-path-under-rootDir check) — defensive against future refactors that might pipe untrusted paths into the bus.
- `JSON.parse` reviver stripping `__proto__` / `constructor` / `prototype` keys in agent's comments-from-disk parser — closes cross-machine prototype-pollution surface.
- `0600` mode warn-once on `~/.config/maude/hubs.json` read (POSIX only) — nudges users back to owner-only token storage if a permissions drift happens.
- Auto-clear `linkedHub.adopt: true` after first successful adopt-reconcile + writes `lastAdoptedAt` attestation — closes "re-running serve re-pushes local state" loop.

102/102 sync tests (+27 net new); 632/632 full dev-server suite green; biome lint clean. Deferred items (hub-trust prompt, adopt manifest, CSP+iframe sandbox, `.claudeignore` strategy, collab-room↔sync-agent file ownership) mapped to natural-home tasks in DDR-054 §3.
