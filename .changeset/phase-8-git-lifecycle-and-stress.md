---
'@1agh/maude': minor
---

**Phase 8 — Tasks 7 + 8: git-lifecycle reconciliation + multi-tab stress harness.** Builds on `acac75d`. Phase 8 now ships complete (all 9 tasks across 4 commits).

**Task 7 — git-lifecycle reconciliation (no-data-loss invariant).** New `collab/git-lifecycle.ts` watches `.git/HEAD` via `fs.watch` with a 250 ms debounce. On detected change (`git checkout`, `git pull` mid-session), the watcher SYNCHRONOUSLY calls `registry.flushAll()` to write every dirty Y.Doc → its JSON projection BEFORE broadcasting a `git-lifecycle` bus event. `ws.ts` relays the event to inspector clients; `client/app.jsx` forwards via postMessage to every open iframe AND renders a blue "Repo state changed — reload to sync?" pill with Reload + Dismiss buttons. Reload click → `location.reload()` → Y.Doc re-seeds from the (now branch-current) JSON. This implements DDR-051 §3's no-data-loss invariant: in-flight edits sitting in the 800 ms debounce window are flushed to disk BEFORE the user's reload choice, so an unlucky checkout can never silently discard work. Silent no-op when run outside a git repo (scratch projects, templated bootstraps).

**Task 8 — multi-tab stress harness.** New `test/collab-stress.test.ts` — two in-memory peers attached to one Room, 30 Hz cursor-shaped Awareness updates for `STRESS_MS` (default 10 s; CI-configurable via `$MAUDE_STRESS_MS` env). Measures RSS growth via `process.memoryUsage().rss` + Y.Doc state size via `Y.encodeStateAsUpdate(doc).byteLength`. Pass thresholds: RSS Δ < 20 MB, Y.Doc Δ < 100 KB. Observed in local 5 s run: 294 updates / 1.7 MB RSS Δ / 0 bytes Y.Doc Δ (Awareness is ephemeral by design — never persisted in the doc, so Y.Doc growth stays at exactly zero in the pure cursor case). Drops cleanly: both peers disconnect → `room.size() === 0`.

**Verification.** 530/530 bun tests green (+4 net: 3 git-lifecycle + 1 stress). `bun tsc --noEmit` clean modulo `api.ts(889)` + `runtime-bundle.ts(322)` pre-existing baseline (CLAUDE.md). `/design:smoke` 42/42 ✓ OK on port 4456.

**Phase 8 commit stack on `main`:**

```
acac75d  feat(collab): phase 8 tasks 4–6 — AI banner, annotations, participant chrome
b0cf7be  feat(collab): phase 8 tasks 2–3 — cursor awareness + comments as Y.Array
9efd1b7  feat(collab): phase 8 tasks 0–1 — Yjs runtime + loopback-only collab WS
```

(This commit adds Tasks 7+8 on top.)

**What ships, end-to-end.** Two browser tabs on the same machine, same canvas, now see: each other's cursors (Task 2), comment add/patch/delete/reply propagation (Task 3), AI banner during `/design:edit` (Task 4), draw annotation strokes (Task 5), participant avatars + follow mode (Task 6), branch-switch reload prompt (Task 7). All over loopback `/_ws/collab/:slug`; cross-machine collab stays a Phase 9 hub-deploy story per DDR-047. JSON snapshots in `.design/_comments/` + `.design/<slug>.annotations.svg` stay canonical (DDR-051) so PRs remain legible and cold-clone users get the same state without a synthetic seed step.

**Still ahead (out of Phase 8 scope).** The 5 collab scenarios — `collab-multitab-cursors`, `collab-comment-sync`, `collab-follow-mode`, `collab-ai-banner`, `collab-branch-switch` — authored via `/scenario new` against `agent-browser`'s two-context harness; these belong in the `/flow:done` step that follows this commit. Phase 9 (cross-machine hub deploy) starts after Phase 8 retro.

See `.ai/decisions/DDR-051-collab-persistence-json-snapshot-at-quiescence.md`, `.ai/decisions/DDR-047-collab-scope-cut-no-lan-mode-hub-admin-ui.md`, and `.ai/plans/phase-8-live-collaboration-yjs-lan.md`.
