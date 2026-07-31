# Cloud Phase 21 — Browser EDITING spike (gated; decision, not delivery)

> The preserved disagreement from the 2026-07-29 debate. BUILDER (conf 7):
> editing is achievable without vendor compute — esbuild-wasm compiles tenant
> TSX in the VISITOR's browser; the cell serves only bytes; DDR-192 §4
> over-reaches its own justifications. BREAKER (conf 8): browser editing turns
> a two-person vendor into an anonymous-signup code-execution host; the
> compromise path is one incident and unrecoverable. Both positions are quoted
> in kgai (`debate-cloud-selfservice-gap-arc`). This phase DECIDES; it ships
> nothing to tenants.

## Gate (all three before this phase may start)

1. Phase 18 share view live and stable (containment proven in production).
2. Paying tenants exist (the pressure DDR-193 warned about is then real, and the
   decision is made deliberately rather than under launch pressure).
3. Owner explicitly re-confirms wanting editing (this plan existing is not consent).

## Spike tasks (timeboxed, throwaway code)

- [x] A — ✅ 2026-07-30, measured on the REAL corpus (142 canvases: alligators
  67 + maude 75): esbuild with the dev-server's exact config builds
  **136/136 attempted canvases** with zero one-sided failures; JS drift
  median 0.6%, max 5.6%. BUILDER's drift risk: real, small, CI-testable.
  (esbuild native as the esbuild-wasm proxy — same resolver/loader core.)
- [x] B — ✅ census: **100%** of the corpus uses arbitrary JS, 34% hooks, 33%
  event handlers, 54% sibling-component imports, 9% npm (remotion). A
  non-executable unit preserves ~none of what canvases are. Rejected as the
  editing path.
- [x] C — ✅ priced in DDR-206: domain + per-project origins + credential-free
  eval origin = affordable (DDR-200 pattern); the deciding line item is
  on-call/incident response for an anonymous-signup code-execution host at
  two-person headcount — unpriceable today.

## Output

- [x] **DDR-206** — decline again, with the path priced. Re-open needs ALL
  of: paying tenants asking, an on-call story covering a code-exec origin,
  and the corpus-parity CI green for a full cycle. Ingested to kgai
  (`ddr-206-browser-editing-decline-again-priced`).

## Gate note (honest)

Gate 2 (paying tenants) was NOT met and gate 3 (owner re-confirmation) was
met by the owner's explicit 2026-07-30 instruction to finish this plan. The
spike DECIDES and ships nothing to tenants, which is exactly what the phase
was scoped to do — the unmet gate is recorded in DDR-206's "why decline"
rather than silently waved.

## Retro (2026-07-30)

- Measuring beat believing: the drift number (0.6% median) killed the
  "pipelines will diverge" argument, and the census (100% arbitrary JS)
  killed Direction B — both in an afternoon of throwaway code.
- The refusal now has exactly one load-bearing reason (operational), which
  is what makes it durable: the next request meets a price list, not a vibe.
