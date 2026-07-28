# DDR-170: `TokenPopover` anchoring — re-anchor on scroll/resize + a measure-and-cancel rect-diff pass, not transformed-ancestor hunting

**Status:** Accepted — 2026-07-14
**Extends:** feature-inspector-controls-redesign (Phase 1, Task 6 — the CSS panel's variables popover mis-position fix, `apps/studio/client/app.jsx` `TokenPopover`, `place()` at ~line 4597).

## Context

`TokenPopover` renders as a `position: fixed` element portalled to `document.body`, positioned from a one-shot `getBoundingClientRect()` snapshot of its trigger button. The pre-Phase-1 bug: `position: fixed` resolves against the nearest ancestor that establishes a new containing block (a `transform`/`filter`/`will-change` on any element between `document.body` and the popover — e.g. the studio right-panel's own mount-in transform), not necessarily the viewport. A one-shot snapshot doesn't track that ancestor moving (scroll, layout change), so the popover would drift from its trigger — the prior workaround was to dismiss the popover on scroll rather than fix the anchor.

Finding the *exact* transformed ancestor and subtracting its offset would work, but requires walking the DOM chain and re-deriving it every time a new call site changes the panel's structure — fragile, and the kind of thing that silently breaks the next time a wrapper gains a `transform` for an unrelated reason (e.g. a future animation).

## Decision

Two complementary mechanisms, both already implemented at `apps/studio/client/app.jsx` inside `TokenPopover`'s effect (~lines 4592-4657), neither of which needs to know *which* ancestor is responsible:

1. **Re-anchor, don't dismiss.** `place()` (the viewport-relative position calculator from the trigger's `getBoundingClientRect()`) re-runs on `window resize` and on any `scroll` event (capture phase, so it catches scrolling in any ancestor container, not just the window) — replacing the old dismiss-on-scroll behavior. This alone fixes the common case (the popover tracks its trigger through ordinary scrolling).
2. **Measure-and-cancel rect-diff compensation.** A second effect measures where the popover **actually landed** (`popRef.current.getBoundingClientRect()`) versus where `place()` **intended** it (the `pos` state, computed in viewport coordinates), and cancels the delta (`dx = pos.left - r.left`, `dy = pos.top - r.top`) by adjusting `pos` accordingly. This is correct regardless of *why* the discrepancy exists — a transformed ancestor, a `will-change` boundary, or any future CSS change that alters the fixed containing block — because it operates on the observed rendering outcome, not on identifying the cause. It converges in at most one correction: once the delta is compensated, the measured rect matches the intended one and the effect becomes a no-op (guarded by a `0.5px` threshold to avoid infinite re-triggering on sub-pixel rounding).

**Rejected alternative:** walking the ancestor chain to find the specific transformed element and subtracting its offset directly. Rejected because it's brittle to structural changes elsewhere in the shell (any future wrapper gaining a `transform` for an unrelated reason — e.g. a panel-entry animation — would silently reintroduce the bug, requiring someone to remember to update the ancestor-walk logic). The measure-and-cancel approach is self-correcting by construction and needs no maintenance when the shell's DOM structure changes.

## Consequences

- The popover now tracks its trigger correctly at any scroll position or canvas zoom/pan level, verified live during Phase 1's a11y/design-system re-verification pass.
- This pattern (re-anchor + measure-actual-vs-intended-and-cancel) is the reusable fix for any future `position: fixed`-portalled element with the same containing-block ambiguity — reach for this before a new ancestor-offset-hunting implementation.
- Cost: one extra `getBoundingClientRect()` read per open/reposition cycle (the compensation effect) — negligible relative to the popover's own render cost, not worth optimizing away.
