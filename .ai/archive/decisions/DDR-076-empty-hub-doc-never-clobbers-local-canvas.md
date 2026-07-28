## DDR-076 — An empty hub doc never clobbers a non-empty local canvas (cold-start seeds local UP)

- **Status:** Accepted — 2026-06-02
- **Authors:** 1aGh (surfaced during live remote-hub dogfood — a fresh hub emptied all 73 local `.tsx` of a linked project on first connect)
- **Phase:** 9 (linked-mode file sync) — data-loss hardening
- **Supersedes:** —
- **Superseded by:** —
- **Amends:** the `sync/agent.ts` `reconcile()` hub-wins contract introduced in phase-9 task 4 (`c21c7d4`) — adds the empty-doc guard the HTML branch was missing.
- **Related:**
  - [DDR-054](./DDR-054-linked-mode-trust-model-and-task-4-hardening.md) — linked-mode trust model + the bidirectional file-sync agent this hardens.
  - [DDR-060](./DDR-060-tsx-only-format-breaks-html-centric-sync.md) — TSX-only sync; the bodies at risk here.
  - [DDR-064](./DDR-064-single-shared-collab-doc.md) — the shared-doc projection path, whose `migrate-seed` already documents the canonical "never clobber non-empty local with an empty doc value" rule that the agent path now matches.
  - [DDR-072](./DDR-072-project-level-tsx-sync-opt-in.md) — `linkedHub.syncTsx`, which made a non-empty TSX project first reach an empty hub (turning this latent bug into observed loss).
  - RCA: `.ai/logs/rca/issue-sync-cold-start-empty-hub-clobbers-local.md`.

## Context

A user paired a real project (`AI-StudyMate`, 73 TSX canvases) to a freshly stood-up self-hosted hub, opted the project into TSX sync (`linkedHub.syncTsx: true`), and ran `maude design serve`. On first connect **every local canvas was truncated to 0 bytes**. Recovery was possible only because the canvases were committed to git (`HEAD` held 8–61 kB per file).

Root cause is in `sync/agent.ts` → `reconcile()`, the default hub-wins HTML branch:

```js
if (localHtml !== docHtml) {
  if (localHtml !== null && localHtml.trim() !== '') {
    opts.onConflict?.({ slug, kind: 'cold-start-hub-wins' }); // LOG ONLY — does not gate the write
  }
  writer(paths.html, docHtml);   // wrote docHtml even when it was ''
}
```

When the hub holds no state for a slug yet, `docHtml === ''`. The code treated that empty value as authoritative and wrote it to disk, emptying the file. The `cold-start-hub-wins` callback only *logs* (to `_sync.json`); nothing surfaces a blocking warning.

The tell that this was an oversight: **every other type in the same `reconcile()` already guards empty-doc writes** — comments (`docCommentsStr !== ''`), annotations (`docAnnotations !== ''`), meta (`docMeta !== null`), css (`docCss !== null`). The HTML body — the most valuable artifact — was the single branch missing the guard. The shared-doc projection path (DDR-064 `migrate-seed.ts`) even states the rule explicitly: *"hub-wins if the synced doc holds state; adopt local files only when the hub was empty."* The agent path never adopted it.

## Decision

**An empty hub doc is treated as "the hub has no state for this slug yet" (fresh / never-seeded), NOT as an authoritative blank.** It must never overwrite a non-empty local body. Instead the cold-start reconcile **seeds the doc FROM local**, so the body survives on disk AND the hub receives our content:

```js
if (localHtml !== docHtml) {
  if (docHtml === '' && localHtml !== null && localHtml.trim() !== '') {
    applyHtmlToDoc(doc, localHtml, origin); // seed up; never truncate disk
    lastHtml = localHtml;
  } else {
    if (localHtml !== null && localHtml.trim() !== '') {
      opts.onConflict?.({ slug, kind: 'cold-start-hub-wins' });
    }
    writer(paths.html, docHtml); // hub-wins only for a non-empty, genuinely divergent hub body
  }
}
```

This brings the HTML body into line with the four sibling branches and with the projection path's documented invariant.

### Invariants

- **Empty hub ⇒ local wins (seed up).** Never a destructive disk write from an empty doc.
- **Non-empty, divergent hub ⇒ hub-wins, as before** — the existing `cold-start-hub-wins` notification still fires for genuine overwrites of non-empty local content. No behaviour change for the case the conflict callback was designed for.
- **`--adopt` unaffected.** Adopt mode already pushes local up and returns before this branch; it was always safe.

## Consequences

- **Loss eliminated for the common case** (first peer to a fresh hub, a re-provisioned hub, or any slug the hub never received). A fresh hub now gets *seeded* from the first peer rather than destroying it — which is also the desired default behaviour.
- **Acknowledged edge case (non-blocking):** two peers each holding *different* non-empty bodies that simultaneously seed the same empty slug will CRDT-merge (Y.Text interleave), not lose data — strictly better than the old last-writer-empty clobber. A transaction-guarded single-source seed is the long-term answer if the DDR-064 shared-doc flag is turned on for the agent path; out of scope here.
- **Test:** `sync-agent.test.ts` → "empty hub doc does NOT clobber a non-empty local body — seeds local up instead (data-loss guard)". Sync suite stays 182/182.

## Alternatives considered

- **Gate only the conflict notification louder (interactive 3-way prompt).** Rejected — the loss already happened by the time a prompt could show; the write itself must be prevented, not narrated.
- **Refuse to write but also do not seed up.** Rejected — leaves the hub empty forever, so the next peer also can't pull and the project never converges; seeding up is what makes a fresh hub usable.
- **Treat empty hub as authoritative and require `--adopt` to protect.** Rejected — makes silent data loss the default and safety an opt-in flag; inverts the correct priority.
