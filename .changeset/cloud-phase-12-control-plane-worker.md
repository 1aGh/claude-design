---
"@1agh/maude": minor
---

**Maude Cloud control plane is live.** The tested decision layers (reconciler, billing lifecycle, webhook handling) now run as a deployed Cloudflare Worker with a real D1 database behind them — `/health`, a Stripe webhook endpoint that verifies signatures and never trusts an event's payload (it only names a project to re-derive), and an hourly reconcile sweep so a missed webhook costs at most an hour, never correctness. Deployed on the Free tier a phase ahead of schedule; the custom domain follows with the DNS zone.
