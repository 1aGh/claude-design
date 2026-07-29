# Cloud Phase 20 — Self-administration

> The dashboard as CONTROL plane — the part of "browser studio" that never
> conflicted with anything. Same banned-vocabulary plain language as the invite
> path; the audit log is customer-visible (DDR-193 §4 — "you can see that we
> looked" is the control).

## Tasks

- [ ] T1 — project dashboard: members (invite/remove — removal revokes live
  sessions per Phase 13 T5), rename, share toggle (Phase 18), mirror settings
  (Phase 19, owner-only).
- [ ] T2 — billing: Stripe-hosted portal link, plan/status straight from the
  reconciler's view of the world (never a second source of truth).
- [ ] T3 — **export anytime**: one click → the cell produces the full bundle
  (git bundle + assets manifest) → signed download. The same machinery the
  suspend/purge lifecycle already requires (`exported` state).
- [ ] T4 — delete project: drives the lifecycle machine (`stepToward('purged')`)
  — purge remains reachable only through exported; the UI cannot bypass what
  the machine forbids.
- [ ] T5 — customer-visible audit log page over `audit_log` (append-only,
  operator entries require a reason — already in schema).
- [ ] T6 — tests: revocation-on-removal, export-before-delete enforced end to
  end, copy lint, audit page renders operator break-glass entries.

## Acceptance criteria

- [ ] A customer can run their whole relationship — members, billing, export,
  deletion — with no email to support and no terminal.
