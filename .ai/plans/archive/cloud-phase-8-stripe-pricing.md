# Cloud Phase 8 — Stripe + pricing (first paying tenants, capped ≤ 3)

Part of the Maude Cloud arc — read `cloud-phase-0-economics-and-architecture.md` first (§2 economics + §3 pricing table are the input). Requires Phase 7.

## Description

Money: Stripe Checkout + hosted Customer Portal + Stripe Tax, the per-project pricing from Phase 0 §3, dunning → suspend → export-before-purge, and the public pricing page that **openly** replaces the "no SaaS tier" promise. Tenant cap ≤ 3 until Phase 9's fleet ops pass.

## Metadata

- **Type**: New Capability | **Complexity**: High
- **App/Package**: `apps/cloud` (billing), `site` (pricing page), Stripe account
- **Dependencies**: Phase 7. Stripe account (CZ entity), Stripe Tax enabled

## Context References

### Must-Read Files

- `.ai/plans/cloud-phase-0-economics-and-architecture.md` §2–3 — cost telemetry from Phase 5 vs estimates; the pricing table to implement (final numbers = owner sign-off at this phase's start)
- `site/content/docs/hub/pricing.mdx` — the self-host table that stays + the sentence being replaced
- Phase-1 umbrella DDR — state machine + export-before-teardown guarantee
- Stripe docs: Checkout, Customer Portal, Tax (VAT-ID capture, reverse-charge), test clocks, webhooks best practice

## Tasks

### Task 1: ADD Stripe products + checkout

- **Do**: Products: `cloud-project` €19/mo (+ annual €190), `storage-50gb` €5/mo add-on, `dedicated` €99/mo (contact-gated OK for v1). Stripe Checkout from the dashboard ("Add payment" on a `pending` project); hosted Customer Portal for card/plan management; **Stripe Tax** with VAT-ID capture (reverse-charge for CZ/EU B2B), CZK/EUR display; 14-day trial **with card**. Owner signs off final numbers before this task merges.
- **Gotcha**: prices in Stripe are the source of truth; `apps/cloud` reads them via API — no hardcoded amounts in two places.
- **Validate**: test-mode checkout → project transitions `pending → active`; portal changes reflected next reconcile.

### Task 2: WIRE billing → lifecycle (reconciler, never webhooks)

- **Do**: Stripe subscription state joins the reconciler's desired-state derivation (webhook = enqueue reconcile only). Dunning → `past_due` (banner in product) → `suspended` (cell stopped, volume + R2 retained 30 d, **export e-mail sent first**) → `purged` (only after export job completed). Payment restored at any pre-purge point → `resume` with identical data.
- **Validate**: Stripe **test clocks** driven through trial-end, lapse, resurrect, and purge-with-export paths; replayed/dropped webhooks converge.

### Task 3: UPDATE public pricing + docs

- **Do**: maude.sh pricing page implementing the Phase-0 §3 table (three columns; self-host column links the untouched cost table); `pricing.mdx` sentence replaced with the honest version; cloud docs section (what's stored where, EU region, export, the DDR-054 operator disclosure linked). Vocabulary gate applies.
- **Validate**: site builds; vocabulary grep green; a Czech accountant can read the invoice (VAT fields present in test invoice).

## Exit gate

- [ ] A real ~€1 live-mode purchase provisions a working cell unattended
- [ ] Test-clock suite green (lapse + resurrect + purge-with-export)
- [ ] Export e-mail provably precedes any teardown (state machine test)
- [ ] Tenant cap ≤ 3 enforced in the provisioner until Phase 9 signs off
- [ ] Pricing page live; "no SaaS tier" sentence coherently replaced

**Status: PARTIAL** (2026-07-29) — the only phase whose vendor is actually available. See **DDR-196**.

Built + tested: the Phase-0 §3 catalog exists as REAL objects in the `maude.sh` Stripe sandbox (Project €19/mo + €190/yr, Dedicated €99/mo, storage €5 per 50 GB block), and `apps/cloud/pricing.{json,mjs}` resolves them. Live mode THROWS for an unconfigured price rather than falling back — a silent fallback is how a real customer is charged nothing, or a test charge lands on a real card. `publicPricing()` carries no ids. Amounts are checked against Stripe rather than trusted, because Stripe prices are immutable and editing the JSON only makes the page lie. 11 tests, verified against the real sandbox objects (zero mismatches).

Not done: live-mode prices (owner sign-off on the numbers first), Checkout + hosted portal + Stripe Tax, dunning/lapse/resurrect with test clocks, the public pricing page. All need the Phase-7 control plane to exist as a deployed thing.
