# DDR-087 — Hand-rolled, zero-dependency guided-tour engine (no driver.js / shepherd.js)

**Status:** Accepted — 2026-06-03.
**Supersedes:** none. **First of its kind:** the first guided-overlay/onboarding primitive in the dev-server client.
**Related:** [DDR-086](DDR-086-in-app-whats-new-feed-architecture.md) (the What's New feed whose entries can carry `tour[]` spotlight steps); the "Runtime bundles are committed and authoritative" CLAUDE.md rule + the v0.22.0 `motion_react.js` regression (the Bun.build environment-sensitivity that argues against new bundled deps); [DDR-012](DDR-012-react-19-unified.md) (the single React the overlay shares).
**Instruments:** `plugins/design/dev-server/client/tour/overlay.tsx`→`.jsx` (`TourOverlay`); `plugins/design/dev-server/client/tour/usage-tour.js` (the evergreen 5-step walkthrough); `data-tour` anchors in `client/app.jsx` + `client/whats-new.jsx`; `client/styles/4-components.css` (`.mdcc-tour*`); `test/tour-overlay.test.tsx`. Plan: `.ai/plans/feature-in-app-whats-new-tour.md` (Phase 3).

## Context

Phase 3 needed a guided tour to power two flows: a per-feature **spotlight** launched from a What's New entry's `tour[]`, and an evergreen **"how Maude works"** walkthrough. The obvious path is a library (`driver.js` ~5 kB, `shepherd.js`, `react-joyride`).

## Decision

**Hand-roll a ~230-line `TourOverlay` with zero runtime dependency.** Rationale:

- The dev-server's contract is **"committed bundle is authoritative — whatever you commit is what ships"** with a documented history of Bun.build output being *environment-sensitive* (v0.22.0 shipped a broken `motion_react.js` because CI regen overwrote the good bundle). Every new bundled dep widens that surface; a self-contained component sidesteps it entirely.
- The needs are modest and fully expressible in-house: a box-shadow "spotlight" cutout around a `getBoundingClientRect()` target, a positioned tooltip card, Back/Next/Skip + step counter, and the a11y contract (`role="dialog"` + `aria-modal`, focus-to-primary + focus-trap + focus-restore, `Esc`/`←`/`→`, `prefers-reduced-motion`). A library would bring its own styling to re-skin against the `--u-*`/`--maude-*` tokens anyway.
- A missing target degrades gracefully (centered card, no spotlight) so a tour never dead-ends on a chrome change — cheaper to guarantee in our own code than to bend a library to.

The same engine drives both tour kinds (spotlight steps from feed data; usage steps from `usage-tour.js`), so there's one code path to maintain and test.

## Consequences

- **Good:** no new dep, no bundle-regression surface, full token-styling control, predictable a11y behavior we own and test (`renderToStaticMarkup` contract test).
- **Cost:** we maintain the positioning/focus logic ourselves; the card placement is a simple below/above heuristic (assumed card height), not a full collision solver — acceptable for short tours, revisit if steps target tightly-packed corners.
- **Reversible:** if tour needs outgrow the hand-rolled engine (complex flows, multi-page, branching), swapping in a library is localized to `tour/overlay.jsx` — the call sites pass plain `{target,title,body}` steps.
