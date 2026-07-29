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

- [ ] A — client-side eval: esbuild-wasm in the visitor's browser reproducing the
  dev-server's Bun.build semantics (virtual `@maude/canvas-lib`, committed
  runtime bundles, motion externals, splitting:false hoisting). BUILDER's own
  top_risk is the drift between the two pipelines — measure it on the real
  canvas corpus, not a fixture.
- [ ] B — Direction B: the structured, non-executable synced unit DDR-193 names
  as the prerequisite. Estimate honestly what subset of canvas expressiveness
  survives it.
- [ ] C — threat model (BREAKER's non-negotiables priced): separate registered
  domain, per-project origin isolation, credential blast-radius, the XSS class,
  and who is on call for it.

## Output

A DDR choosing: client-eval editing / Direction B / decline again — with the
losing paths' costs recorded so the request (which WILL recur, DDR-193 §5) meets
a priced answer instead of a re-litigation.
