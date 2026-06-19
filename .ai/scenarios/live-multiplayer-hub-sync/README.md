# Scenario — live-multiplayer-hub-sync

**Covers:** phase-30 branch-scoped live multiplayer + the underlying Phase 8/9 hub-sync, verified **cross-machine through a real Docker hub**.

## User flow

Two people (two repos = two "machines") collaborate on the same draft through a self-hosted hub:

1. Build + run the Maude hub Docker image locally.
2. Two repos, each with the same canvas (`SyncTest`, slug `ui-synctest`) + the maude DS, both `linkedHub` → `ws://localhost:1234`.
3. Two **source** dev-servers (phase-30 code), one per repo, both linked.
4. Verify, cross-hub: live TSX edit sync (both directions); mutual presence (peers see each other); soft editing-presence (an agent edit on one side shows the "is editing" badge on the other); same-machine `canvas-list-update` tree refresh.

## Persona

A non-technical collaborator + a teammate, on the same shared draft (DDR-120 model).

## Fixtures

- `maude-hub:phase30-test` Docker image (built from `apps/hub`).
- `/tmp/mp-repo-a`, `/tmp/mp-repo-b` — two git repos, maude DS + `SyncTest.tsx`, `linkedHub` config.
- `~/.config/maude/hubs.json` test entry for `ws://localhost:1234` (hub runs in dev mode — accepts any token).

## Expected end state

- Edit on A's `SyncTest.tsx` lands on B's disk within ~1–4 s, and vice-versa.
- B's canvas shows A's peer + an agent "is editing" avatar (peer-hued ring + ✎) when A's agent edits.
- Creating a canvas on A refreshes A's tree without reload.

## How it was run (2026-06-19)

This was run **ad-hoc** (not via saved per-platform runners) during `/flow:scenario` — see `report-2026-06-19.md`. The web surface (agent-browser, two tabs over two source servers + Docker hub) was verified comprehensively. The **native** surface (computer-use) is the documented dogfood ceiling — the native app bundles the identical `apps/studio` source (DDR-106), so the verified phase-30 code IS what native runs; existing `.app` builds predate phase-30.

> **Follow-up to productionize:** save idempotent per-platform runners (`runners/web-desktop.sh` etc.) that boot the hub + two servers + drive the two-tab flow, so this becomes a repeatable 5-platform scenario. Today it's a documented manual run + report.
