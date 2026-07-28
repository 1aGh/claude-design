---
name: phase-10-structured-crdt-html-coediting
status: superseded
created: 2026-05-12
superseded: 2026-06-11
superseded_by:
  - DDR-064 (one shared Y.Doc per canvas; body = opaque Y.Text + prefix/suffix codec — REJECTS this plan's Y.XmlFragment structured-CRDT premise)
  - phase-30-native-collab-live-multiplayer (artboard locking / soft single-writer — the chosen conflict mechanism instead of structured body co-edit)
  - phase-13-stable-element-ids-and-canonical-screenshots (stable element identity shipped as TSX `data-cd-id`, not HTML injection)
reason: >-
  Triple-stale. Written against `.design/*.html` (dead format since Phase 3.6),
  premised on Y.XmlFragment structured CRDT (explicitly rejected by DDR-064 in
  favour of opaque Y.Text), and superseded in direction by phase-30's artboard
  locking. Its three substantive pieces either shipped elsewhere in TSX form or
  were deliberately decided against — see the mapping banner below.
---

# Phase 10 (v1.2 work): Structured CRDT HTML co-editing

> **🗄 SUPERSEDED — archived 2026-06-11.** This plan was never re-scoped off `.html` and its core premise is dead. Where each piece actually landed:
>
> | Plan piece | Outcome | Where |
> | --- | --- | --- |
> | **A. Stable element identity** (`data-cd-id` injected into HTML) | ✅ Shipped, but as **TSX `data-cd-id`** (+ artboard-scoping + occurrence-index) | `phase-13-stable-element-ids-and-canonical-screenshots`; `feature-studio-full-functionality-parity`; `apps/studio/dom-selection.ts`, `inspect.ts` |
> | **B. Y.XmlFragment as live representation** (structured CRDT over the DOM tree) | ❌ **Deliberately rejected** — body is opaque `Y.Text` + longest-common-prefix/suffix minimal-diff | **DDR-064** (rejected alternative C); `apps/studio/sync/codec.ts:10` (*"HTML body is treated as opaque Y.Text rather than structured Y.XmlFragment"*) |
> | **C. AI Write→Y-ops diff** (tree-edit-distance) | ✅ Shipped via a different mechanism — whole-file write → projection ingests as a tagged `FILE_IMPORT` minimal diff, never wholesale | **DDR-064**; `apps/studio/sync/projection.ts`. TSX body sync is ON by default (**DDR-079**) |
> | **Concurrent same-region body merge** (the residual) | Direction pivoted to **artboard locking (soft single-writer)** | `phase-30-native-collab-live-multiplayer` |
>
> Phase 12 (in-canvas CSS editor + layers) does **not** depend on this plan — its Phase-10 references were all `if shipped` optionals whose fallback (soft-lock single-writer) is exactly what phase-30 ships. The original (stale) text is preserved below for history.

> **⚠ STALE FORMAT ASSUMPTION — [DDR-060](../decisions/DDR-060-tsx-only-format-breaks-html-centric-sync.md) (2026-05-28):** this plan is written against `.design/*.html` (`data-cd-id` injection into HTML, HTML↔Y.XmlFragment bridge). Phase 3.6 (2026-05-18) made `.tsx` the **only** canvas format — there are no `.html` canvases in real projects. The whole collab branch (Phase 8 → 9 → 10) inherited the `.html` assumption from before the migration. Before this phase is scheduled, its representation layer must be re-scoped onto `.tsx` (or whatever the structured-edit surface is post-migration), and it depends on `phase-9.1-tsx-sync-unblock.md` landing the CSP/sandbox + `.tsx`-sync gate first. Do not start Task 0's fidelity spike against `.html` — it would measure a corpus that no longer exists.

> **Not in v1.0 MVP — and not even v1.1.** Captured as a concrete plan so v1.0 Phase 8 (ambient multiplayer) and v1.1 Phase 9 (hub + file sync) can be designed with the future in mind. Ship target: only if v1.1 surfaces real-world incidents of "two peers garbled the same inspector edit." Decision trigger in PRD § Out-of-scope. Realistic ship target: 6-8 weeks after v1.1 GA if pursued.

## Description

Build on Phase 8's "ambient multiplayer" (Yjs awareness + comments) to add **true real-time HTML co-editing** for designated edit surfaces. Two peers can change a button's padding simultaneously through the inspector panel (Phase 5) and both see the merged result without losing intent. Layers panel drags reorder children deterministically across peers. AI agent (`/design`) emits structured Yjs ops instead of clobber-rewrites, so peers see element-by-element evolution and never lose in-flight edits.

This is the **hardest UX problem in the entire roadmap.** It requires three foundational pieces: stable element identity (`data-cd-id`), HTML ↔ Y.XmlFragment round-trip fidelity, and a Write-tool-output → Y-op diffing engine. The pre-implementation spike (Task 0) decides whether the structured-CRDT model is viable for this codebase's `.design/` corpus, or whether we ship a constrained hybrid.

Research grounding: `.ai/docs/research-collab.md` § Recommended architecture, § AI agent integration models (Approach A + B+).

## User Story

As a designer pairing with a developer on a complex screen, I want to drag a card to reorder it in the layers panel **at the same time** my colleague tweaks its border-radius in the inspector — and have both changes land without either of us losing our work or seeing a flash-rewrite when Claude steps in.

## Problem

- Phase 8 ships ambient multiplayer (cursors, comments) but **no HTML co-editing**. Two peers editing CSS on the same element in the inspector panel (Phase 5) hit naïve LWW today — last save wins, the other's change is silently lost.
- `/design "<feedback>"` clobber-rewrites the entire HTML body. Any in-flight peer edits are obliterated. Even with Phase 8's soft-lock banner, the UX is "stop everything when Claude runs" — not real co-editing.
- Layers-panel drag reorders (Phase 5) face the same race: A drags above sibling, B drags below at the same instant → one ordering wins, the other peer sees a teleport.

## Solution

Three layered pieces (each task block below is one piece):

**A. Stable element identity layer.** Every element in `.design/*.html` gets a `data-cd-id="<8-char-base32>"` attribute auto-injected when the dev server first reads the file. IDs are stable across edits — if a peer adds children to `<div data-cd-id="A">`, the parent's ID is unchanged; new children get fresh IDs. IDs are committed to git as part of the HTML file (visible in diffs, but stable across rewrites).

**B. Y.XmlFragment as live representation.** Per canvas, a Y.XmlFragment models the DOM tree. Round-trip: HTML → parse (htmlparser2) → Y.XmlFragment with `data-cd-id` preserved as the Yjs node identity → render back to HTML on quiescence. Inspector edits, layers reorders, draw-tool changes all become Y.XmlFragment operations (atomic, commutative).

**C. AI tool grammar (Approach B+ → A).** v1.1 ships Approach B+: when `/design "<feedback>"` Write-tool output arrives, the server diffs the new HTML against the current Y.XmlFragment using tree-edit-distance (e.g. `xmldiff` algorithm), produces a sequence of Y ops, and applies them inside a single Y transaction. Peers see element-by-element evolution, not a flash-rewrite. v2.0 elevates to Approach A: Claude is given structured tools (`canvasSetAttribute`, `canvasInsertChild`, `canvasRemoveNode`) and emits Y ops directly — no diffing necessary, intent perfectly preserved.

## Metadata

- **Type:** New Feature (largest, hardest)
- **Complexity:** Very High
- **Depends on:** Phase 4 (canvas v2), Phase 5 (inspector + layers UI), Phase 6 (comment infra), Phase 8 (Yjs runtime), **Phase 9 (hub + bidirectional file sync — structured CRDT runs on hub side, peers see live diff stream)**
- **Parallel with:** —
- **Affected files:**
  - `plugins/design/dev-server/runtime/identity/` (new — `data-cd-id` injection, stability tracking)
  - `plugins/design/dev-server/runtime/yxml-bridge/` (new — HTML ↔ Y.XmlFragment converter)
  - `plugins/design/dev-server/runtime/diff/` (new — tree-edit-distance diff → Y ops)
  - `plugins/design/dev-server/runtime/collab/` (extend — adopt Y.XmlFragment for canvas body, not just comments)
  - `plugins/design/dev-server/client/panels/InspectorPanel.tsx` (rebind to Y.Map under each element's Y.XmlElement attrs)
  - `plugins/design/dev-server/client/panels/LayersPanel.tsx` (rebind drag-reorder to Y.XmlFragment.move)
  - `plugins/design/commands/design.md` (slash command pipes Write output through the diff engine instead of direct file replace)
  - `plugins/design/dev-server/package.json` (add `htmlparser2`, `xmldiff` or hand-rolled equivalent — bundled into `dist/server.bundle.mjs`)
  - `.design/<slug>.html` (now contains `data-cd-id` attributes — one-time migration touches every canvas)
  - `docs/site/content/docs/co-editing.mdx` (new — explains the model, limitations, when to expect divergence)

---

## Tasks

### Task 0: Pre-implementation spike — HTML ↔ Y.XmlFragment round-trip fidelity

- **Do:** **This task is a go/no-go gate for the whole phase.** Build a measurement harness:
  1. For every canvas in this repo's `.design/` corpus + 5 reference projects (TBD), parse HTML → Y.XmlFragment → serialize back → compare byte-equality (after normalizing whitespace per a documented rule).
  2. Record fidelity rate. Threshold: ≥ 95% byte-equal (after whitespace normalization) for the phase to proceed as Model B (structured CRDT throughout).
  3. If 80-95%: ship as **Model C hybrid** — Y.XmlFragment for canonical regions tagged `<section data-cd-edit="structured">`, plain `Y.Text` over raw HTML for everything else.
  4. If < 80%: do not adopt Y.XmlFragment. Re-scope phase to "structured CRDT only for inspector panel ops on tagged regions; layers panel stays single-writer."
- **Pattern:** Same kind of spike Linear used before committing to their sync engine.
- **Validate:** Harness output committed to `.ai/archive/decisions/phase-9-fidelity-spike.md` with the measured percentage and the adopted model. **Phase does not proceed without this DDR.**

### Task 1: Element identity injection

- **Do:** On first read of a canvas, parse HTML, inject `data-cd-id="<8-char-base32>"` on every element that doesn't have one. Use a deterministic seeded RNG so the same canvas produces the same IDs across machines (avoids merge conflicts on first-touch). Write back to disk. Commit-friendly.
- **Pattern:** Same approach Figma uses internally — every node has a stable ID; the diff/CRDT layer keys off it.
- **Validate:** Run on `.design/` corpus; every element has an ID; second run is a no-op (idempotent).

### Task 2: Y.XmlFragment bridge

- **Do:** `runtime/yxml-bridge/`: `htmlToYXml(htmlString) → Y.XmlFragment` and `yXmlToHtml(fragment) → htmlString`. Preserve `data-cd-id` as Y.XmlElement identity. Round-trip must satisfy Task 0's fidelity threshold.
- **Pattern:** Adapt patterns from `y-prosemirror` for the bridging logic, but simpler since we don't have ProseMirror schema constraints.
- **Validate:** Property-based test: random HTML mutation → bridge → round-trip → diff < ε. Run on Task 0's corpus.

### Task 3: Persist Y.XmlFragment alongside Y.Array (comments, annotations)

- **Do:** Extend per-canvas Y.Doc with a new top-level `body: Y.XmlFragment`. Phase 8's Y.Array (comments, annotations) live as siblings. `.ydoc.bin` still binary-persisted; HTML file regenerated on 800ms quiescence from `body` fragment.
- **Validate:** Edit HTML, close browser, reopen → fragment reseeded from `.ydoc.bin` (live state preferred over disk if both present).

### Task 4: Inspector panel rebind

- **Do:** Phase 5's inspector POSTs attribute changes via `/api/edit-css`. v1.1: instead, mutates Y.XmlElement `setAttribute()` on the selected element's Y.XmlFragment node. Server's snapshot-to-disk pipeline (Task 3) handles persistence.
- **Validate:** Two peers edit padding on same element simultaneously → both changes apply (last-write-wins per attribute is fine — single property is atomic), neither edit lost on unrelated attributes.

### Task 5: Layers panel drag rebind

- **Do:** Phase 5's drag reorder mutates DOM order in the iframe directly. v1.1: drag fires `Y.XmlFragment.move(fromIndex, toIndex, parent)` — Yjs handles ordering with fractional indexing under the hood.
- **Validate:** Two peers reorder same level simultaneously → both orderings merge deterministically (CRDT property).

### Task 6: AI Approach B+ — Write-tool → Y ops diff

- **Do:** `/design` slash command today writes the new HTML via the orchestrator's `Edit` / `Write` tool. v1.1: intercept the new HTML; server computes tree-edit-distance against current Y.XmlFragment; emits ops inside a single Y.transact. Peers see element-by-element evolution. Phase 8's "Claude is editing" banner stays as visual cue but is no longer load-bearing for correctness.
- **Pattern:** `xmldiff` algorithm (Cobena et al., 2002) — proven for XML tree diffing. Or hand-roll a simpler version since our trees are bounded.
- **Validate:** `/design "make button red"` produces a sequence of attribute-change ops, not a wholesale fragment replace. Peers see other edits preserved.

### Task 7: Branch switch / pull reconciliation v2

- **Do:** Phase 8's Task 7 reloads the Y.Doc from disk on branch switch. v1.1 enhancement: if the user has unsaved in-Y.Doc changes (Y.Doc state hash ≠ last-known-snapshot hash), prompt to stash to a `.design/_state/<slug>.stash.ydoc.bin` before reload. After branch switch, offer "Apply stashed changes" — replays the stashed ops onto the new disk state.
- **Validate:** Edit, switch branch, get prompt, stash, switch back, replay → original edits restored.

### Task 8: Disconnect & reconnect

- **Do:** Yjs handles disconnect natively (ops queue, replay on reconnect). UX work: connection-status indicator in chrome (green = synced, yellow = reconnecting, red = offline, gray = no peers).
- **Validate:** Disconnect WS mid-session → continue editing locally → reconnect → ops replay → peer sees catch-up.

### Task 9: Performance regression test

- **Do:** Extend Phase 8's stress harness: 5 peers × 5 min × 30Hz cursor + 1Hz inspector edits on a 100-element canvas. Y.Doc GC enabled. Pass criteria: bounded Y.Doc growth (< 5MB after 5 min), no peer divergence.
- **Validate:** Harness output committed to `.ai/reviews/phase-9-perf.md`.

---

## Validation

1. **Static:** Bundle delta ≤ 80KB gz (htmlparser2 ~30KB, diff engine custom ~5KB).
2. **Functional:** All five concurrent-edit scenarios pass.
3. **Round-trip fidelity:** Threshold from Task 0 met on full corpus.
4. **Cross-platform scenario:** `inspector-coedit` web-desktop.
5. **A11y:** Connection status indicator screen-reader announces state changes.
6. **Security:** Same as Phase 8 — no new attack surface, just new ops.

## Scenario coverage

| Scenario | Covers user flow | Status |
|----------|------------------|--------|
| `inspector-coedit-padding` | Two peers edit padding on same element simultaneously → both changes apply, no loss | 🆕 new |
| `layers-coedit-reorder` | Two peers drag siblings simultaneously → deterministic merged order | 🆕 new |
| `ai-incremental-edit` | `/design "..."` while peer is editing → peer's edits preserved, AI changes apply incrementally not wholesale | 🆕 new |
| `branch-switch-stash` | Edit, switch branch, stash, switch back, replay → original edits restored | 🆕 new |
| `disconnect-reconnect` | Peer disconnects mid-edit → continues offline → reconnects → ops replay correctly | 🆕 new |

---

## Acceptance criteria

- [ ] Task 0 fidelity spike DDR committed; model (B / C hybrid / scoped) chosen.
- [ ] Every canvas in `.design/` has stable `data-cd-id` attributes; idempotent re-runs.
- [ ] HTML ↔ Y.XmlFragment round-trip passes property-based test on corpus.
- [ ] Inspector + layers panel rebinding complete; concurrent edit scenarios pass.
- [ ] AI Approach B+ (diff Write output → Y ops) implemented; flash-rewrites eliminated.
- [ ] Branch-switch stash/replay flow works.
- [ ] Disconnect-reconnect ops replay correctly.
- [ ] Stress test passes (5 peers × 5 min, bounded growth).
- [ ] Docs site has co-editing limitations page documenting Model B vs C hybrid.
- [ ] v2.0 follow-on issue filed: "Adopt Approach A — Claude emits Y ops via structured tools."
