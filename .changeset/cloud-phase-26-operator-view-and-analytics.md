---
'@1agh/maude': minor
---

Cloud: an operator board, server-side product analytics, and figures for what a project actually costs to run.

**`/operator`** — one signed-in surface showing every project and account, fleet health, the €3/cell model as a ratio rather than an invoice, and MRR as the plane believes it (Stripe stays the authority, and the tile says so). Read-mostly: the only write is a reconcile nudge that requires a reason, and that reason is recorded where the customer can read it. Gated by an `OPERATOR_ACCOUNT_IDS` allowlist that is empty by default, so the surface does not exist until somebody deploys it on.

**Usage events**, emitted server-side into Workers Analytics Engine — never into the control-plane database, whose whole design is that losing it costs a customer nothing. The vocabulary is closed: every event is declared, every property is an enum, and an account id is shape-validated, so an email address has no path into a datapoint. The privacy notice was revised in the same change as the first event, and a test now checks the page against the code in both directions.

**Project size and build figures** — each project counts its own designs and reports the totals hourly, so the cost model finally has real numbers instead of an estimate. Counts and durations only; the counts need the project's own credential, and a project that has not reported renders an em-dash rather than a zero.

Customers also get one thing directly: the project activity page now shows *why* we looked, not only that we did — including the platform-wide reads that touch every project.
