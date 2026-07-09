# DDR-155: Sticky-note author identity — privacy posture, sanitization, and badge color

- **Date:** 2026-07-09
- **Status:** Accepted (implemented — `feature-whiteboard-annotation-improvements.md`)
- **Tags:** annotations, whiteboard, figjam, presence, privacy, collab, sanitization, trust-model
- **Related:** [DDR-151](./DDR-151-whiteboard-ai-toolkit-geometry-manifest-and-element-context.md) (the whiteboard toolkit this extends — `author: 'ai'` provenance already existed on every stroke), [DDR-054](./DDR-054-linked-mode-trust-model-and-task-4-hardening.md) (untrusted-canvas / peer-synced trust model this reuses for foreign author names), [DDR-115](./DDR-115-per-user-camera-split-and-runtime-state-taxonomy.md) (runtime-state taxonomy — confirms `authorName`/`authorId` need no ignore-list entries; they live in the VERSIONED `.annotations.svg`, not a `_*` runtime path). Plan: [`feature-whiteboard-annotation-improvements.md`](../plans/feature-whiteboard-annotation-improvements.md).

## Context

Phase 3 of the whiteboard-annotation-improvements feature adds a human-authored sticky note's author to the persisted stroke, so a badge can show *who* drew it — the natural counterpart to the existing `author: 'ai'` provenance flag (DDR-100/151), which only ever distinguished agent-authored strokes from human ones and carried no identity.

The identity signal already exists at runtime: `use-collab.tsx`'s `useCollab()` exposes `myName` (derived from local `git config user.name`, falling back to an `anonymous-<connId6>` string when unset) and `myConnId` (a session-stable id), both already used to color presence cursors/avatars via `colorForName()`. Stamping a sticky with these was a small, mechanical change — the actual decisions were about what that stamping *means* once committed.

## Decision

### 1. `authorName`/`authorId` are sibling fields, not a widened `author` type

`StrokeBase.author` stays exactly `'ai' | undefined` — unchanged. Two new optional fields, `authorName?: string` and `authorId?: string`, carry the human-authorship signal instead of overloading `author` into a richer union (`{kind:'ai'|'human', name?, id?}`). This is a deliberate least-churn choice: every existing `s.author === 'ai'` equality check across `annotations-model.ts`, `read-annotations.mjs`, and any downstream consumer keeps working byte-for-byte; a stroke is never both, so there's no ambiguity from keeping them separate.

### 2. The `.annotations.svg` file now carries the local git identity — accepted, not hidden

`<designRoot>/<slug>.annotations.svg` is a **versioned, git-committed, peer-synced** file (DDR-115 taxonomy; DDR-054 branch-scoped multiplayer). Stamping `authorName` from `git config user.name` means that name now lands in a file that:

- gets committed to the repo's history (visible to anyone with repo access, indefinitely — a stronger disclosure than the ephemeral presence broadcast, which only ever existed transiently in Yjs Awareness state and the live cursor/avatar UI).
- syncs to every linked peer by default (DDR-079) the moment a human draws a sticky.

**This is accepted, not a bug to route around**, for two reasons: (a) presence already broadcasts the same `git config user.name` to every peer in real time (`use-collab.tsx`), so this doesn't create a NEW disclosure channel — it makes an already-shared signal *persistent* instead of ephemeral, which is arguably the more honest behavior for a collaborative document (a comment thread's author is likewise permanent, not session-scoped); (b) a git repo's own commit history already carries every contributor's configured identity on every commit, so a name inside a versioned file the repo already tracks is not a meaningfully different exposure than the VCS metadata surrounding it.

The one real mitigation this decision doesn't relieve: a user with a *sensitive* `git config user.name` (a legal name they don't want tied to informal whiteboard scribbles, for instance) has no way to opt out short of unsetting or overriding their global git config — an org-wide config change, not a per-project toggle. This repo's presence system already has this exact ceiling (the cursor label carries the same name), so Phase 3 doesn't introduce a new gap — it inherits an existing one. **Follow-up, not blocking:** a per-project or per-canvas "no author stamping" toggle would close this; not built here since presence already establishes the same exposure and no user push has asked for it.

### 3. Unset git identity falls back to `anonymous-<connId6>` — never a blank/omitted stamp

When `git config user.name` is empty, `useCollab()` already resolves `myName` to `anonymous-<connId6>` (a random, per-session, non-identifying string). Sticky stamping reuses this as-is rather than special-casing "skip the stamp when anonymous" — an anonymous author badge (`AN` initials-equivalent via the name label) is strictly more informative than no badge (distinguishing "several different anonymous contributors" from "one has-a-name author"), and keeps the stamping logic a single unconditional path instead of a conditional one.

### 4. Foreign/peer-synced `authorName`/`authorId` are sanitized on READ, matching presence's own hygiene

A peer-authored `.annotations.svg` is untrusted input (DDR-054). `authorName`/`authorId` parsed back off disk go through a `sanitizeAuthorName()` pass — control chars, bidi overrides/isolates, zero-width chars, and the BOM stripped, 64-char cap — mirroring `use-collab.tsx`'s existing `sanitizeName()` code-point ranges exactly, so a malicious peer can't use the author field for a visual-spoofing trick (RTL override, zero-width homoglyph padding) that the presence system already guards against for cursor labels. The sanitizer is **reimplemented**, not imported, in both `annotations-model.ts` (the runtime parser) and `bin/read-annotations.mjs` (the standalone CLI reader) — the CLI is a zero-dependency script that must not import the stateful React collab layer, so a small duplicated pure function is the correct trade-off over a shared import that would pull unrelated machinery into a headless script.

### 5. Badge color is ALWAYS re-derived via `colorForName`, never trusted from a stored/wire value

The author badge's color is computed as `colorForName(stroke.authorName)` at render time — never read from a stored color field (none exists) and never trusted from a wire/peer value. This matches `use-collab.tsx`'s own hard rule for presence colors (`sanitizeForeignState` always re-derives color from the sanitized name, discarding whatever color a peer's wire state claims) and has the side benefit of making a sticky's badge hue match that author's live cursor/avatar color exactly, everywhere, by construction — there is only one function that decides "what color is this name," so it can never drift between surfaces.

### 6. Badge design: a name/nickname label, not an avatar circle+initials — reversed mid-implementation on user feedback

The first implementation rendered a small circle (colored via `colorForName`) with 2-letter initials (`initialsFor()`, reused from `participants-chrome.tsx`) in the sticky's bottom-right corner — matching the existing presence-avatar visual language. Live dogfood feedback reversed this: initials require a legend to decode (whose "1A" is that?), while a full name/nickname reads immediately with no indirection. The badge is now a small right-anchored pill-styled text label (a `foreignObject` + flex box, since a name's rendered pixel width isn't knowable without a DOM measurement, so the box is a fixed generous width with the label right-aligned inside it rather than tightly sized to content). `initialsFor` is no longer imported into `annotations-layer.tsx` as a result.

## Consequences

- A human-drawn sticky's author is now permanent, versioned, and peer-visible — by design, matching what presence already exposes, but now durable instead of ephemeral. No per-project opt-out exists yet; tracked as a non-blocking follow-up.
- `authorId` (the session `connId`) is also persisted and peer-synced. It's a random per-session UUID prefix with no cross-session stability guarantee (a fresh session gets a fresh id) — it identifies "the session that drew this," not a durable user identity, and carries no PII beyond what `authorName` already does.
- Every place that reads `authorName`/`authorId` off a stroke (the runtime layer, the CLI reader, any future consumer) must go through the same sanitize pass — a new consumer that reads the raw parsed field directly would reopen the spoofing gap this DDR closes. `sanitizeAuthorName` is exported from both modules specifically so a new reader has no excuse to skip it.
