# DDR-142 — ACP context pipeline: per-canvas selection memory, frozen-at-send chat context, session bootstrap brief

**Date:** 2026-07-02
**Status:** accepted
**Relates:** DDR-125 (repo-level multi-chat — the single-slot `_active.json` coupling this amends), DDR-115 (runtime-state taxonomy — `_active.json` stays IGNORED per-machine), DDR-054 (canvas DOM untrusted), DDR-140 (attachment reveal-before-send), DDR-007 (`data-dc-element` re-anchor key), DDR-138 (positional `data-cd-id`), rca/issue-canvas-hmr-optimistic-update-consistency (RC5 ai-activity precedent)
**Plan:** `.ai/plans/feature-acp-context-hardening.md` (Core scope; debate provenance inside — BUILDER/SHIPPER/BREAKER relay debate, 2026-07-02)

## Decision 1 — Per-canvas selection memory is ADDITIVE; `selected` stays the active-canvas mirror

`ActiveState` gains `selections: Record<canvasSlug, SelectedValue>`. `setActive()` no longer nulls the selection — it PARKS the outgoing canvas's selection (html-stripped) and RESTORES the incoming canvas's. `setSelected()` writes through to the map; explicit deselect deletes the active entry; `setOpenTabs()` GCs entries for closed canvases. The top-level `selected` remains exactly what it always was — the ACTIVE canvas's selection in the legacy shape — so every existing consumer (prep.sh `SEL_VALID`, `/design:edit` step 3, screenshot/handoff/critic tooling) works unchanged. Never repurpose `selected`; the Phase 4.1 widening precedent applies.

## Decision 2 — Drift gate: positional ids are never trusted across another writer's edit

Every selection is stamped `canvas_mtime` at capture (`enrich()`). Restore-on-switch compares against the current file mtime; a mismatch marks each element `stale: true`. Consumers must re-anchor (`data-dc-element` → selector+index) or degrade to canvas-wide — `data-cd-id` is POSITIONAL (`Bun.hash(component:idx)`), so after a foreign edit it can silently resolve to a DIFFERENT element (the silent-corruption risk that made this gate non-negotiable). Parked non-active entries carry `html: ''` (size cap — locators survive, the 4000-char payload doesn't multiply across canvases).

## Decision 3 — Chat context is FROZEN AT SEND, visible, and locators-only

`buildChatContext` (client/panels/chat-context.js) produces ONE object driving both the composer chip and the fenced `<maude-context>` block the adapter prepends to the outgoing prompt — chip ≡ payload by construction (DDR-140). The block carries locators only (`data-cd-id`, selector, index, tag, text ≤ 120, mtime, stale) — **never `selected.html`**: canvas DOM is untrusted (DDR-054) and the agent auto-approves (F2); it reads the element from disk itself, which is fresher anyway. All interpolated values are sanitized (`<>"`` + controls stripped) so canvas-controlled strings can't break out of the fence. The chip is removable; dismissal re-arms when the context changes. The transcript UI projection strips the fence from user bubbles; **the on-disk jsonl keeps the raw prompt** — it is the audit record.

## Decision 4 — Session bootstrap brief: static, generated, system-role, transcript-audited

Every new ACP session gets a studio-environment brief via `newSession._meta.systemPrompt.append` — verified end-to-end: the SDK's `zNewSessionRequest` declares `_meta` (zod.gen.js:2363) and the installed `claude-agent-acp@0.49.0` spreads the object form over its `claude_code` preset (acp-agent.js `newSession`). Because that contract is adapter-INTERNAL, `test/acp-bootstrap-brief.test.ts` asserts both sides against the installed sources — a dependency bump that drops it fails CI loudly (named fallback: first-turn text block). Brief rules (BREAKER hard vetoes):

- **Static facts only, generated from config** (designRel, project label) — never live state derived from the canvas DOM.
- **Environment orientation only** — no behavioral/git policy that could override the user's own CLAUDE.md (the spawned `claude` already reads it via cwd).
- **Audited:** mirrored into `_chat/<id>.jsonl` as `role:'bootstrap'` on the session's first real turn; UI readers skip the role. Invisible-to-user is UX; invisible-to-audit would be a security regression for an auto-approving agent.

The brief carries the pointer that closes the reported failure at the instruction layer: *"per-message context arrives as `<maude-context>`; do NOT assume `_active.json.selected` matches the message."*

## Rejected

- **Session↔canvas pinning** — contradicts DDR-125's repo-level chats and reshapes the F2 trust boundary. Context is per-message metadata, never a session binding.
- **Frozen outerHTML in the prompt** (BUILDER's variant) — untrusted-content-in-instruction-stream for no benefit.
- **`--append-system-prompt` / env channel** — outside the transcript's reach entirely (unauditable steering).
- **New `/_api/context` endpoints** — disk (`_active.json` + `selections`) is already the DDR-125 interface; pure surface growth.

## Deferred (tracked in the plan's § Deferred)

Disk turn-envelope + `edit.md`/`prep.sh` consuming chat-frozen context (closes the in-turn wrong-canvas hole at the DATA layer); per-chat sticky context pin; selection history; cross-chat editing ledger. Hard boundary: frozen selection data never crosses the hub awareness channel to peers.
