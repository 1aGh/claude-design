---
"@1agh/maude": minor
---

Phase 9 Task 4 — bidirectional file sync agent for the linked-hub story (THE hard part).

When `.design/config.json` declares a `linkedHub` and `~/.config/maude/hubs.json` has a matching token, `maude design serve` now mirrors each canvas's Y.Doc (held by a `@hocuspocus/provider` client talking to the hub) with the on-disk `.html` / `_comments/<slug>.json` / `.annotations.svg` files. Edits from peers land on disk so Claude Code's `Read` / `Edit` / `Write` see them; local file writes propagate up through the hub to other peers — both directions immune to echo loops via SHA-256 fingerprinting + atomic `.tmp` → rename writes.

Solo mode (no `linkedHub`) is bit-for-bit unchanged.

New modules under `plugins/design/dev-server/sync/`: `echo-guard.ts` (1500 ms TTL hash queue), `atomic-write.ts` (POSIX rename + Windows EBUSY retry), `codec.ts` (Y.Text ↔ HTML body with minimal-diff ops; Y.Array ↔ comments JSON; Y.Map.svg ↔ annotations.svg), `fs-mirror.ts` (250 ms quiet-window file reader), `agent.ts` (per-canvas orchestrator with 800 ms Y.Doc → disk debounce matching DDR-051; cold-start reconcile with hub-wins default + `adopt` one-shot push-local-up), `hubs-config.ts` (Bun-side token reader), `index.ts` (`createSyncRuntime(ctx)` wiring — dynamic `@hocuspocus/provider` import so unlinked installs don't pay the cost).

75 new tests including a 100-event stress scenario proving doc + disk + peer convergence under `< 200` doc transitions (no echo amplification). Real-hub WSS integration tests deferred to Task 11's stress matrix.
