# DDR-136 — Setup-DS moodboard persisted as a commentable UI canvas

**Status:** Accepted — 2026-07-01. **Note (2026-07-03):** [DDR-147](DDR-147-moodboard-first-discovery-default-directions.md) moved the moodboard before refinement (Stage 3) and made ~`moodboard.variants` seed-composed tiles the interactive default (main-agent, no web); the persistence, one-canvas composition, and return-a-body mechanics recorded here are unchanged and now apply to the default tiles as well as the escalated variants.
**Amends:** [DDR-080](DDR-080-moodboard-direction-gate.md) — the *throwaway-canvas* aspect only; the direction-gate mechanics stand.
**Related:** [DDR-080](DDR-080-moodboard-direction-gate.md) (moodboard direction gate — this DDR keeps its two-gate model and "never under `system/<ds>/`" invariant, and lifts only its throwaway-ness), [DDR-115](DDR-115-per-user-camera-split-and-runtime-state-taxonomy.md) (runtime-state taxonomy — the moodboard now lands under **versioned** `ui/`, not a throwaway `_*` runtime dir, so no three-list change was needed). Instruments: `plugins/design/skills/design-system/_bootstrap.md`, `plugins/design/commands/setup-ds.md`.

## Context

DDR-080 introduced the Stage-4 moodboard as a **throwaway** canvas under `<designRoot>/_moodboard/<ds>-moodboard.tsx` — assembled from the discovery + research payload, screenshotted, gated on a feeling call, then **discarded** (only an optional PNG retained under `_history/`). In variant mode, 2–3 blind parallel sub-agents each wrote a throwaway tile file (`<ds>-variant-A/B/C.tsx`).

The moodboard is the **single richest artefact of the direction decision** — proposed palette (OKLCH), type pairing, the signature-treatment hero in context, a voice sample, and the full research provenance (anchor name + `why_relevant` + source link + query). Yet once the gate closed, the user could not **revisit** it or **annotate** it. Discarding it threw away exactly the thing a user would want to come back to when they say "líbí se mi barvy odsud, ale layout odtamtud" a week later. User request: persist it as a real UI canvas so they can return and comment.

## Decision

1. **Write the moodboard as a persistent, versioned UI canvas** at `<designRoot>/ui/<ds>-moodboard.tsx` instead of the throwaway `_moodboard/`. It is a normal `ui/*.tsx` canvas: it appears in `/design:browse` + the canvas list, **survives the bootstrap**, and **comments attach to it** like any canvas.
2. **Variant mode composes into ONE canvas.** The 2–3 blind parallel sub-agents no longer each write a throwaway tile file — they **return a self-contained artboard body** (a single root `<div>` with everything inline: inline styles, inline SVG, `<img>`; no `import` / `const` / `function` / top-level identifiers). The main agent **composes the survivors into 2–3 `<DCArtboard>`s side by side in that one canvas** (`DesignCanvas` auto-flows them), so the directions sit next to each other for **per-artboard compare + comment**. The inline-only output contract prevents identifier collisions when the tiles are concatenated into one file.
3. **The one DDR-080 invariant still holds:** the moodboard is **never written under `system/<ds>/`** (`ui/` is not the design system). Only the throwaway-ness is lifted.

## Why this is DDR-worthy

It reverses a **deliberate, documented choice** in DDR-080 ("throwaway, never committed") for the most load-bearing design-plugin flow, and it changes two structural things: **where a generated artefact lands** (per-user runtime → versioned `ui/`) and **how the variant fan-out returns its output** (write-a-file → return-a-body + main-agent compose into one canvas). Both are the kind of governed pivot a future reader must be able to find the rationale for.

## Consequences

- **Moodboard is committable + revisitable + commentable.** In variant mode the non-picked directions **stay** in the canvas as reference — the user can compare and comment on the alternatives too, not just the winner.
- **No runtime-taxonomy (DDR-115) change.** The persistent canvas lands under already-versioned `ui/`; the variant path no longer writes staging files, so the throwaway `_moodboard/` directory is simply **retired from this flow** — no addition to the three ignore lists (`.gitignore` / `gitignore-block.mjs` / `service.ts`) was required. (`_moodboard/` was never in those lists anyway — a latent gap that is now moot rather than fixed.)
- **Self-contained by construction.** Because the main agent inlines each returned artboard body, `ui/<ds>-moodboard.tsx` has **no cross-file dependency on staging** — it survives regardless of what else is on disk. This is why return-a-body beat write-a-tile-then-import (an import from a throwaway dir into a versioned canvas would break the canvas the moment the staging was cleaned).
- **Enters `/design:browse` + batch smoke.** As a `ui/*.tsx` canvas it is now captured by `/design:smoke` and shows in the browser tree. It renders through the same transpile path already validated in DDR-080's live dogfood (external `<img>` degrades to labeled scraps via `onError`), so this is acceptable.
- **Direction-contract role unchanged.** On lock, Batch A still consumes the approved palette / type / treatment **verbatim**, and the Batch-A hero-preview drift gate still drift-checks the real tokens against it. Persisting the canvas does not change what flows forward.
- **Divergence mechanics unchanged.** Variant sub-agents are still blind, parallel, distinct-seeded (reject seeds sharing ≥ 2 anchors or < 40° apart in hue), and each still self-harvests its own imagery. Only the **output form** (return vs write) and the **composition target** (one canvas) changed.

## Files changed

- `plugins/design/skills/design-system/_bootstrap.md` — Stage 4: write location `_moodboard/` → `ui/<ds>-moodboard.tsx`; variant sub-agent output contract (return self-contained artboard body); reconcile → compose 2–3 `<DCArtboard>`s side by side; screenshot URL; outcomes table + closing invariant reworded for persistence.
- `plugins/design/commands/setup-ds.md` — step 3.5 pointer reworded (persistent canvas, revisitable + commentable, variants side by side).
- `.ai/archive/decisions/DDR-080-moodboard-direction-gate.md` — amendment banner pointing here.

## What this DDR does not change

- The **two-gate model** — Stage-4 moodboard *direction* gate + Batch-A hero-preview *token-fidelity* drift gate — is untouched.
- The **"never under `system/<ds>/`"** invariant — held.
- The **collage craft rules** (chaotic hand-assembled pinboard, jitter, torn edges, provenance density) — unchanged; only the file's home and the variant composition changed.
- The **`--no-discovery` skip** + **`--quick` auto-proceed-but-still-ask** + autonomous bypass-log discipline — unchanged.
- Token NAMES / the canonical token contract — the moodboard still never writes tokens.
