# DDR-206 — Browser editing: decline again, with the path priced

- **Date:** 2026-07-30
- **Status:** accepted
- **Area:** cloud / containment (DDR-192, DDR-193, DDR-197, DDR-200)
- **Source:** Cloud Phase 21 spike (timeboxed, throwaway code; measurements below are from the real corpus, not fixtures)

## Decision

Maude Cloud **declines browser editing again** — the share view (DDR-200)
remains the whole browser surface. The decision is now **priced, not
re-litigated**: the technical path exists and measured cheap; what has not
changed is the operational half of BREAKER's position, and that half is the
binding constraint for a two-person vendor with anonymous signup.

## What the spike measured (so the next request meets numbers)

**A — client-side eval drift (BUILDER's own top risk).** esbuild with the
dev-server's exact canvas config (virtual `@maude/canvas-lib`, RUNTIME_PACKAGES
externals, `splitting:false`, NODE_ENV=production, CSS-as-asset) over the real
corpus — 142 canvases across alligators (67) and maude (69, +6 nested):

- **136/136 attempted canvases build under both pipelines** — zero canvases
  that Bun.build accepts and esbuild refuses, zero the other way.
- JS-content drift where both inline the same things: **median 0.6%, max 5.6%**
  (the CSS-extraction shape differs by config, not capability — both emit CSS
  as a separate asset the wrapper inlines).
- BUILDER's drift risk is therefore **real but small and testable**: a CI job
  that builds the corpus both ways and diffs would hold the two pipelines
  together. esbuild-wasm adds ~10 MB of wasm and a slower cold build in the
  visitor's browser; resolution semantics are the same engine.

**B — Direction B (structured, non-executable synced unit).** Census of the
same 142 canvases: **100% use arbitrary JS** (functions, `.map`, expressions),
34% React hooks, 33% event handlers, 54% compose sibling components via
relative imports, 9% import npm packages (remotion for reels). A
non-executable format preserves approximately **none** of the existing corpus
— it is not a subset of what canvases are, it is a different product.
Direction B is **rejected as the editing path** (it remains interesting only
as an interchange/export format).

**C — the threat model, priced.** Browser editing means tenant-authored TSX
*evaluating in visitors' browsers* on a vendor-served origin. The
non-negotiables and their price tags:

| Requirement | Price |
| --- | --- |
| Separate registered domain (not a subdomain of maude.sh — cookie + PSL isolation) | ~$10/yr + zone setup; the share view already proved the pattern |
| Per-project origin isolation (`<project>.view-domain`) | wildcard DNS + cert, exists today for cells |
| No credentials on the eval origin (anonymous read; comments post cross-origin) | rules out signed-in editing UX — "editing" collapses to "propose a change", which needs the full identity lane on ANOTHER origin |
| XSS class accepted as designed behavior on that origin | strict CSP, no cookies, no storage — same posture DDR-200 shipped |
| Who is on call | **unpriceable at current headcount** — this is the line item that decides |

The first four line items are affordable. The fifth is the one BREAKER named:
"the compromise path is one incident and unrecoverable" — an anonymous-signup
code-execution host operated by two people has no on-call story, and no
amount of build-pipeline parity changes that.

## Why decline, when A came back green

The gate for this phase (owner re-confirmation, paying tenants) was
overridden by the owner's explicit instruction to run the spike; the spike
ran. But the DECISION criteria in DDR-193 §4 are unchanged: vendor-origin
evaluation of tenant code is a liability the current operation cannot absorb,
and the demand signal (zero paying tenants at decision time) does not yet pay
for absorbing it. What the spike changes is the SHAPE of the next
conversation: when the request recurs, the answer is no longer "we believe
it's dangerous" but "the build is a solved 136/136, the corpus census says
Direction B is dead, and the open cost is an on-call + incident-response
capability we either have hired for or have not."

## Re-open conditions (all three, not any one)

1. Paying tenants asking for browser editing (the DDR-193 §5 pressure, real).
2. An on-call/incident story that covers a code-execution origin (a third
   operator, or a managed isolation vendor).
3. The corpus-parity CI job (A) green for a full release cycle.

## Rejected alternatives

- **Client-eval editing now** — build parity measured (136/136, ≤5.6% drift),
  rejected on the operational line item above.
- **Direction B as the editing path** — rejected on the census: 100% of real
  canvases use what it would remove.
- **Cell-served rendering** (vendor compute evaluating tenant TSX) — rejected
  unchanged since DDR-192 §4/DDR-197; strictly worse than client-eval on
  blast radius.
