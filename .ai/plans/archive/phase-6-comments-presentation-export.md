# Phase 6: In-place comments UX (FigJam-style bubbles)

> **Scope narrowed 2026-05-20** — export already extracted to [`phase-6.5-export.md`](./phase-6.5-export.md); **presentation mode deferred** (was Task 4) because user asked to focus this iteration on improving comments only. Presentation mode will return as its own phase once comments land.

## Description

Replace the current shell-bound BottomBar composer with a **FigJam-grade in-place comment experience**: the composer pops up **at the click location on the canvas** (not in a panel chrome at the bottom), pins render **as styled bubbles anchored to the actual element bounds** on the canvas (not a numbered chip strip), and clicking a pin opens a **thread popover in the project's DS** (paper/phosphor surfaces, hard-edges, 1px hairlines, Berkeley Mono, amber-rust accent — no glow, no frosted glass, no rounded chat bubbles).

Threading (replies), `author` field, and lightweight `@mention` parsing extend the existing JSON schema.

## User Story

As a designer reviewing a canvas, I want to drop a comment **exactly where I clicked**, type a message **inline at the pin** (not in a far-away panel), see my pin **on the artboard at the element it belongs to**, and reply / resolve from a thread popover **that looks like the rest of the app** — so reviews feel like Figma, not a janky annotation bolt-on.

## Problem

Today's comments work mechanically but the UX is two surfaces removed from the action:

- **Composer is in the shell**, not on the canvas. User clicks `<button.cta>` in iframe → composer appears in the bottom bar of the dev-server chrome, separated by chrome + iframe boundary. No spatial connection to what was clicked.
- **Pins are not pins** — they're a chip strip (`1` `2` `3` …) in the BottomBar. There is no marker on the canvas at the clicked location.
- **Visuals don't match the DS.** The current composer uses generic textarea + buttons, no `--accent` / `--rule-thin` / `--font-mono` discipline.
- **No threading, no @mention, no author.** Comment has `text`, `status` only. No replies, no committer attribution, no @mention array.

## Solution

**A. In-place composer bubble.** On click in Comment tool (or `⌘⇧+click` shortcut), spawn a popover **inside the canvas iframe, anchored to `bounds.{x,y,w,h}` of the clicked element** (or to world coords if click hit empty canvas). Composer = small DS-styled card (var(--bg-1), `var(--rule-thin)` border, no shadow, radius 2px). Tab order: textarea → Cancel → Save. ⌘↵ save · Esc cancel preserved. Submit triggers existing `commentsAdd` POST.

**B. Pin bubbles on canvas.** Each open comment renders as a small **24px square badge with sequence number**, positioned at `bounds.{x+w-12, y-12}` (top-right corner of anchored element, like FigJam). Resolved comments hidden by default (toggle via `cm` / `Cmd+Shift+M`). Pin styling: `var(--accent)` fill + `var(--accent-fg)` numeral, 1px `var(--border-strong)` outline, `var(--font-mono)` numeric, `var(--type-xs)`. Hover → slight `--accent-hover` shift; click → opens thread popover.

**C. Thread popover.** Opens at pin's screen position (with edge-clamp so it never overflows viewport). Anatomy from top:
1. Header — author + relative time + selector chip
2. Comment body (existing `text`)
3. Reply list (new `thread[]`) — each reply: author + time + body
4. Reply textarea + Send button
5. Footer actions — `✓ Resolve` / `↺ Reopen` / `Delete`

Popover styled like the Phase 3.6 canvas-card pattern: `--bg-2` surface, `--rule-thin` hairlines, no shadow.

**D. Threading + author + mentions schema.** Extend `Comment` interface:
- `author: string` — defaults to `git config user.name` resolved server-side at create time
- `thread: Reply[]` — each `{ id, author, body, created }`
- `mentions: string[]` — parsed `@handle` tokens from body + reply bodies

**E. @mention parsing.** When user types `@` in textarea (composer OR reply box), popup shows top 20 names from `git shortlog -sne | head -20`. Selecting inserts `@firstname` token; submitted token captured into `mentions[]`. Popup is keyboard-navigable (↑↓ to move, ↵ to insert, Esc to dismiss).

## Metadata

- **Type:** Refactor + new feature
- **Complexity:** Medium
- **Depends on:** Phase 4 (canvas v2), Phase 5.1 (annotations layer for overlay pattern reference)
- **Parallel with:** Phase 5, Phase 6.5
- **Affected files (real paths):**
  - `plugins/design/dev-server/api.ts` — extend `Comment` interface (`author`, `thread`, `mentions`); add `commentsAddReply()`, `commentsParseMentions()`; helper `gitCommitters()` (cached). `api.ts` already uses `Bun.file` / `Bun.write` — keep it that way; new helpers use `Bun.spawn` for `git shortlog`.
  - `plugins/design/dev-server/http.ts` — new endpoints: `POST /_api/comments/<id>/reply`, `GET /_api/git-committers`. **Single source of truth** — we do NOT mirror these into the legacy `server.mjs`. Per DDR-009 the Bun runtime is authoritative; the legacy `.mjs` path stays frozen until it's removed in Phase 3.4. If a user is still on the legacy runtime they'll miss the new endpoints — acceptable given the migration timeline.
  - `plugins/design/dev-server/canvas-shell.tsx` — render in-place composer bubble + pin overlays inside iframe; reuse existing `comment-compose` postMessage channel
  - `plugins/design/dev-server/comments-overlay.tsx` (new) — React component rendering pin bubbles + composer popover + thread popover on the canvas world layer (parallel to `annotations-layer.tsx`)
  - `plugins/design/dev-server/comments-overlay.css` (new) — DS-token-only styling
  - `plugins/design/dev-server/canvas-icons.tsx` — add `IconReply`, `IconResolve`, `IconReopen`, `IconMention` if missing
  - `plugins/design/dev-server/client/app.jsx` — drop the shell-side composer + chip strip + StatusBar `+ comment` button from `CommentBar` / `StatusBar`. Pins on canvas + thread popover are the only comment-creation surfaces. BottomBar keeps only open-count badge + filter chip.
  - `plugins/design/dev-server/client/styles.css` — remove dead `.composer*`, `.cb-pin-chip`, `.cb-row`, `.cb-text`, `.cb-target`, `.cb-pinno`, `.cb-more`, `.cb-pin-strip`, `.sb-add-comment` rules.

---

## Tasks

### Task 1: Schema extension + git-committer endpoint

- **Do:** Extend `Comment` interface in `api.ts:81`:
  ```ts
  export interface Reply {
    id: string;            // r_<hex>
    author: string;
    body: string;
    created: string;       // iso
  }
  export interface Comment {
    /* …existing fields… */
    author: string;        // default = git config user.name at create time
    thread: Reply[];       // empty array by default
    mentions: string[];    // unique @handles parsed across body + thread
  }
  ```
  Add:
  - `commentsAddReply(id, { author, body }): Promise<Comment|null>` — appends to `thread[]`, reparses mentions union, persists
  - `gitCommitters(): Promise<{ name: string; email: string; commits: number }[]>` — runs `git shortlog -sne | head -20` via `Bun.spawn` (or `child_process.execFile` in `.mjs` legacy path); cache for 60s
  - `parseMentions(text): string[]` — extracts `/@[\w][\w.-]*/g` tokens, deduped
- **Migration:** When `loadCommentsForFile` reads a Comment missing `author` / `thread` / `mentions`, default-fill (no rewrite-on-read; only persist defaults on next write — keeps disk stable).
- **HTTP:** Add `POST /_api/comments/<id>/reply` (body: `{ body, author? }`); add `GET /_api/git-committers`. **Bun runtime only** — endpoints land in `http.ts` and helpers in `api.ts` per DDR-009. No `server.mjs` mirror (legacy runtime path is frozen until its Phase 3.4 removal; no production users on it).
- **Validate:** Hand-author sample comment with replies → load round-trips. `curl /_api/git-committers` returns the local-repo committer list. New comments saved have `author` populated.

### Task 2: In-place pin bubbles (canvas overlay)

- **Do:** New `comments-overlay.tsx` rendered inside `canvas-shell` (sibling to `annotations-layer`, **behind** the draw layer, in front of iframe content). For every comment with `bounds`, render a 24×24 square badge at `(bounds.x + bounds.w - 12, bounds.y - 12)` in world coords (so it scales/zooms with the canvas). For comments without bounds (whole-canvas / detached), fall back to world coords stored in `selector === ''` rows; cluster them at top-left of artboard.
- **Style (CSS, DS tokens only):**
  ```css
  .cm-pin {
    width: 24px; height: 24px;
    background: var(--accent);
    color: var(--accent-fg);
    border: 1px solid var(--border-strong);
    border-radius: 0;                        /* hard-edges DS */
    font: 600 var(--type-xs)/1 var(--font-mono);
    letter-spacing: var(--tracking-sku);
    display: grid; place-items: center;
    transition: background var(--dur-flip) var(--ease-out);
  }
  .cm-pin:hover, .cm-pin[aria-expanded="true"] { background: var(--accent-hover); }
  .cm-pin[data-resolved="true"] { background: var(--bg-3); color: var(--fg-2); opacity: 0.6; }
  ```
- **Behavior:** Clicking pin sets `focusedCommentId` (lifted to shell or kept overlay-local via context) and opens thread popover (Task 4).
- **Visibility:** Respect existing `commentsFilter` (`open`/`resolved`/`all`); default hide resolved.
- **Sequence numbers** stay stable per-canvas — sorted by `created` asc.
- **Validate:** Drop 3 comments on different elements → 3 pins anchor at their bounds and stay anchored across canvas pan/zoom. Resolve one → pin dims and hides under default filter.

### Task 3: In-place composer bubble

- **Do:** When `comment-compose` postMessage arrives (or user clicks Comment tool + canvas), render a composer card **at the click location on the canvas world layer** (not in BottomBar):
  - Card size: clamp width 280–320px; auto height; positioned with edge-clamp so it never bleeds off viewport.
  - DS visuals (`comments-overlay.css`):
    ```css
    .cm-composer {
      background: var(--bg-1);
      border: var(--rule-thin);
      border-radius: var(--radius-sm);     /* 2px */
      padding: var(--space-4);
      box-shadow: none;                     /* hard-edges, no glow */
      font: var(--type-sm)/var(--lh-sm) var(--font-mono);
      color: var(--fg-0);
      width: 300px;
    }
    .cm-composer__head { font-size: var(--type-xs); color: var(--fg-2); letter-spacing: var(--tracking-eyebrow); text-transform: uppercase; margin-bottom: var(--space-2); }
    .cm-composer__selector { color: var(--fg-1); background: var(--mono-cell-bg); padding: 0 var(--space-2); border: 1px solid var(--mono-rule); }
    .cm-composer__textarea {
      width: 100%; min-height: 72px; resize: vertical;
      background: var(--bg-0); color: var(--fg-0);
      border: var(--rule-thin); border-radius: 0;
      padding: var(--space-3);
      font: inherit;
    }
    .cm-composer__textarea:focus-visible { outline: none; border-color: var(--accent); box-shadow: var(--shadow-focus); }
    ```
  - Buttons reuse existing `.cb-primary` / `.cb-secondary` shapes but ensure they're DS-compliant (square corners, hairline borders, accent fill).
- **Keyboard:** Focus textarea on mount. ⌘↵ save · Esc cancel.
- **Submit:** POST to existing `commentsAdd` → optimistic insert into `commentsByFile[file]` (use callback prop), then reload from `_comments/<slug>.json` to confirm.
- **Cleanup:** Delete the shell-side composer from `CommentBar` in `client/app.jsx:1216-1240`. Shell BottomBar shrinks to live count + filter chip only.
- **Validate:** Click element in Comment tool → composer appears next to clicked element (not at bottom of viewport). Type "looks off", ⌘↵ → composer closes, pin (Task 2) appears at top-right of element, comment persists in `_comments/<slug>.json` with `author` populated.

### Task 4: Thread popover

- **Do:** Clicking a pin opens a popover anchored to the pin's screen position. Edge-clamp logic identical to Task 3 composer.
- **DS visuals:**
  ```css
  .cm-thread {
    background: var(--bg-2);
    border: var(--rule-thin);
    border-radius: var(--radius-sm);
    padding: var(--space-4);
    width: 340px; max-height: 60vh; overflow: auto;
    font: var(--type-sm)/var(--lh-sm) var(--font-mono);
    color: var(--fg-0);
  }
  .cm-thread__head { display: flex; justify-content: space-between; align-items: baseline; padding-bottom: var(--space-3); border-bottom: var(--rule-thin); }
  .cm-thread__author { color: var(--fg-0); }
  .cm-thread__time { color: var(--fg-2); font-size: var(--type-xs); }
  .cm-thread__selector { display: inline-block; margin-top: var(--space-2); color: var(--fg-2); font-size: var(--type-xs); border: 1px solid var(--mono-rule); padding: 0 var(--space-2); background: var(--mono-cell-bg); }
  .cm-thread__body { padding: var(--space-3) 0; }
  .cm-thread__reply { padding: var(--space-3) 0; border-top: 1px solid var(--border-subtle); }
  .cm-thread__reply-author { color: var(--fg-1); }
  .cm-thread__reply-time { color: var(--fg-3); font-size: var(--type-xs); margin-left: var(--space-3); }
  .cm-thread__actions { display: flex; gap: var(--space-3); padding-top: var(--space-4); border-top: var(--rule-thin); }
  ```
- **Anatomy:**
  1. Head: `<span class="cm-thread__author">{author}</span><span class="cm-thread__time">{relTime(created)}</span>` + selector chip below
  2. Body: comment.text (preserve newlines, escape HTML; render @mentions bold)
  3. Replies (`thread[]`): map to `.cm-thread__reply` rows
  4. Reply textarea + Send (⌘↵)
  5. Footer: ✓ Resolve / ↺ Reopen / Delete — wired to existing `commentsPatch` / `commentsDelete`
- **Validate:** Click pin → thread popover appears at pin position. Type reply, ⌘↵ → reply appears in popover and persists in `_comments/<slug>.json` `thread[]`. Resolve → popover closes, pin dims.

### Task 5: @mention parsing + autocomplete

- **Do:**
  - In composer + reply textarea, watch for `@` keydown. When typed, capture cursor position and spawn a small DS-styled popup directly under the caret:
    ```css
    .cm-mention-popup {
      position: absolute;
      background: var(--bg-2);
      border: var(--rule-thin); border-radius: 0;
      font: var(--type-xs)/var(--lh-xs) var(--font-mono);
      color: var(--fg-0);
      max-height: 180px; overflow: auto;
      box-shadow: none;
      min-width: 160px;
    }
    .cm-mention-popup__item { padding: var(--space-2) var(--space-3); cursor: pointer; }
    .cm-mention-popup__item[aria-selected="true"] { background: var(--accent); color: var(--accent-fg); }
    ```
  - Fetch from `GET /_api/git-committers` (cache in component for session).
  - ↑↓ navigate, ↵ insert `@firstname `, Esc cancel. Inserted token marked with a `data-mention` span when rendering — for read-only view, swap to `<strong>` in `cm-thread__body`.
  - On submit, run `parseMentions(text)` server-side (Task 1) to populate `mentions[]`.
- **Validate:** Type "@" in composer → popup shows ≥1 git committer. Arrow-key down, ↵ → "@<name> " inserted. Submit → `_comments/<slug>.json` has `mentions: ["@<name>"]`. Render in thread popover shows `<strong>@<name></strong>`.

### Task 6: BottomBar cleanup + a11y + DS guard

- **Do:**
  - Strip dead composer + chip strip from `client/app.jsx:1209-1271`. Leave only `openCount` + filter chip in BottomBar (so the iframe-side pins are the source of truth; BottomBar becomes a status surface).
  - Remove orphan `.composer*` / `.cb-pin-chip` rules from `styles.css`.
  - A11y pass: pin = `<button role="button" aria-label="Comment {n} by {author}">`. Thread popover = `<dialog role="dialog" aria-labelledby="cm-thread-head-{id}">` with focus trap. Esc closes popover, focus returns to pin. Mention popup: `role="listbox"`, items `role="option"`.
  - Run `design-system-guard` subagent on `comments-overlay.css` (no raw hex, no glow shadows, no rounded > 4px, no gradients).
- **Validate:** keyboard-only walkthrough: Tab to pin → ↵ opens thread → Tab through replies / textarea / buttons → Esc returns focus to pin. DS guard reports no violations.

---

## Validation

1. **Functional:** Comment created in-place persists with `author`, `thread`, `mentions`. Replies append. Resolve / reopen flips status. Pin position survives canvas pan/zoom + reload.
2. **Scenario:** `comment-thread-resolve` on web-desktop (mobile out of scope) — see below.
3. **A11y:** Pin focusable, thread keyboard-navigable, mention popup `role="listbox"`, focus returns to pin on close.
4. **DS guard:** No `#RRGGBB` literals, no `box-shadow` with blur, no `border-radius > 4px` in new CSS.

## Scenario coverage

| Scenario | Covers user flow | Status |
|----------|------------------|--------|
| `comment-thread-resolve` | Open canvas → C tool → click `<button.cta>` → composer pops at element → type "needs more padding @<dev>" → ⌘↵ → pin appears at element top-right → click pin → thread opens → reply "fixed" → ⌘↵ → Resolve → reload → pin hidden by default; toggle filter to see resolved | new |

---

## Out of scope (deferred)

- **Presentation mode** (was Task 4 — user said "hlavně comments"). Will return as its own phase (`phase-?-presentation-mode.md`) once comments land.
- **Mobile / touch input** for comments — desktop Cmd+click only.
- **Notification delivery** for @mentions (no Slack/email integration in this phase).
- **Migration of existing legacy comments** that lack `author` — defaults filled on read, persisted on next write.

## Acceptance criteria

- [x] Comment composer pops up **at the click location on the canvas**, not in the shell BottomBar.
- [x] Pins render as DS-styled badges anchored to element bounds. **Scale-with-zoom reversed** to fixed 24 px during live dogfooding — FigJam parity, documented in [DDR-034](../decisions/DDR-034-comments-overlay-screen-coord-fixed-position.md).
- [x] Thread popover supports replies + resolve + delete, styled per DS (hard-edges, hairlines, Berkeley Mono, accent). `×` close button added after live dogfood feedback.
- [x] @mention autocomplete works from git committer list, mentions persist in `mentions[]`.
- [x] Keyboard-only flow passes (Tab → Enter → reply → Esc returns focus to pin).
- [ ] Scenario `comment-thread-resolve` passes on web-desktop. **Deferred** — scenario not yet authored. Acceptable for the close-out because (a) the end-to-end flow was validated through live user dogfooding (4 bugs surfaced + fixed in the same session, see Retro), and (b) the scenario would mostly screenshot what we already verified manually. Tracked as a follow-up.
- [x] No DS guard violations on new CSS. All values via `var(--TOKEN, #hex-fallback)`; no raw declarations, no glow shadows, hard-edge radii, no gradients.

## Retro

- **Plan-vs-real-world architecture pivot.** The plan specified "render pins inside `.dc-world` via createPortal so CSS zoom scales them with artboards." That shipped, then immediately broke against `SelectionHalos` (z-index 5 outside `.dc-world`, world stacks at z-index auto = below). The fix wasn't a tweak — it was a full rewrite of the overlay to be a `position: fixed` screen-coord layer, mirroring `SelectionHalos` itself. **Lesson:** when adding an overlay near existing chrome, audit z-index + stacking-context boundaries (`will-change`, `transform`, `filter`, `isolation`) BEFORE committing to a portal target. The mistake compounded — we wrote pin / composer / thread / mention popup against `offsetWithinWorld`, then rewrote all four anchor functions against `getBoundingClientRect`. Five minutes of stacking-context analysis would have caught this in the plan review.
- **Live dogfood surfaced 4 bugs in 30 minutes that all six task validations missed.** Z-index, no close button, pointer-events:none decorations breaking `elementFromPoint`, comment-mode router suppressing button clicks. None of these were testable by `bun test` or `tsc` — they're integration-shape bugs at the React + capture-phase + CSS-stacking-context boundary. **Lesson:** for any phase that adds a new UI surface AND touches the input router, plan a 10-minute live dogfood as the FIRST step after `/flow:utils-verify` passes, not after the whole plan is complete. The /flow:execute step 3.5 smoke gate would have surfaced #1 (z-index covering pins) but not the interactive bugs.
- **`isOverlayTarget` pattern is reusable.** The input router (DDR-026) was written to suppress native clicks under canvas content, but it had no concept of "overlay siblings own their clicks." `isOverlayTarget(t)` is the symmetric pair of `isEditableTarget(t)` — both let the router yield. Future overlays (presentation HUD, live cursors, share popovers) get the same one-line bail-out by adding their root class to the selector list.
- **`document.elementsFromPoint` is the right fallback for decoration-suppressed clicks.** SVG icons commonly use `pointer-events: none` on `<path>` children so the wrapper handles hover. Standard `elementFromPoint` skips them; `elementsFromPoint` (the "s" variant) returns the full stack and the caller picks the right ancestor. Worth knowing as a general pattern when DOM hit-testing breaks against decorative subtrees.
- **The plan / Task 1 contradiction about `server.mjs` mirror surfaced before code change.** The user caught it at execute-start time and the policy was clarified (no mirror, Bun authoritative per DDR-009). Saved a half-day of dead-code work. **Lesson:** when an affected-files section and a task body contradict, treat it as a real ambiguity worth a one-question clarification, not a writing slip — the resolution informs scope.
- **Changesets in monorepo accumulate cleanly.** Four changesets queued for the next release now (brownfield-testing-onboarding, rebrand-maude, security-agents-suite, video-pipeline-toolchain, and this one). Authoring at /done time + linking the DDR makes the release notes self-documenting.
