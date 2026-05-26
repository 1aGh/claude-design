---
"@1agh/maude": patch
---

`fix(dev-server)`: auto-increment port on collision + canvas-lib watch in compiled binary

Two unrelated dev-server bugs surfaced from a single `maude design serve` invocation in a second repo on a machine where the dev-server was already running for another project.

**Port collision (blocker).** `resolvePort()` returned 4399 unconditionally when neither `--port` nor `$PORT`/`$MDCC_DEV_PORT` was set, so the second `maude design serve` invocation on the same machine died with `EADDRINUSE`. Each running instance writes its own `_server.json` into its own `<designRoot>/`, so there was no other obstacle to parallel runs — just the hardcoded port. Fix: when the port is implicit, walk 4399 → 4408 retrying on `EADDRINUSE` and log `[port] 4399 busy, using 4400 instead.` on success. Explicit `--port`/`$PORT` stays a hard failure (so users notice their own collisions). `_server.json` records the actual bound port, so `server-up.sh` and the orchestrator pick up the right URL.

**canvas-lib watch ENOENT in compiled binary (cleanup).** Follow-up promised in the v0.18.2 changeset. `canvasLibPath()` joined `import.meta.dir` with `canvas-lib.tsx` — inside `bun --compile` standalone binaries that resolves to the virtual `/$bunfs/root`, so `fs.watch` failed with `ENOENT: ... '/$bunfs/root/canvas-lib.tsx'` at boot. Same DDR-045 bug class as v0.18.1 (`existsSync` against virtual fs) but for `fs.watch`. Fix: route through `DEV_SERVER_ROOT` from `paths.ts`. Side benefit: canvas-lib HMR now actually works in the compiled binary.

Verified by running a second dev-server against a scratch project while another was already listening on 4399 — the second instance bound 4400 cleanly and wrote `port: 4400` into its `_server.json`. No canvas-lib watch warning in the boot log.
