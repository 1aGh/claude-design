# On-call: the cell renders now

> Cloud Phase 25 A3. Written **before** the origin existed, because DDR-206's
> unpriceable line was on-call for a code-execution host, and a runbook written
> after the first incident is a runbook that was not there for it.
>
> Read the first two sections now. They are what you need at 03:00.

## The one thing to know

**A cell builds a tenant's canvas; the viewer's browser runs it.** The build is
a bundler pass — parse, transform, write a string. It does not evaluate the
canvas, and no browser exists in the cell image (three assertions hold that:
`scripts/check-containment.sh` at review, `infra/cell/assert-containment.sh` at
image build, `infra/cell/entrypoint.sh` at boot).

So the surface you are on call for is: **our compute parses source a customer
wrote, in that customer's own container, for members of that project.**

## Stop it now

Rendering is paused per tenant, two ways. Both leave the project itself
working — sync, git, backups, mirror and the desktop app are untouched.

```sh
# 1. INSTANT, no restart, from a shell on the cell's volume:
touch /repo/.render-off          # or the volume's parent: /.render-off

# 2. Operator, needs a restart (survives a volume wipe):
#    set MAUDE_RENDER_DISABLED=1 on the cell and restart it
curl -X POST https://<project>.cloud.maude.sh/_cell/restart \
  -H "authorization: Bearer $(derived cell secret)"
```

The member sees: *"Rendering is paused for this project while we look into
something. Your work is safe and nothing has been changed. Maude Desktop still
opens it normally."* — which is true, and is the whole reason the switch is
per-tenant.

To undo: delete the file (or unset the variable and restart).

**Fleet-wide?** There is deliberately no single switch. Pausing everybody
because of one project is a decision, not a reflex — do it by looping the
per-tenant switch, and say so in the incident channel.

## What is monitored

| Signal | Where | What it means |
| --- | --- | --- |
| `failures`, `timeouts`, `memoryKills` | `GET /api/studio/stats` (per cell, session-authenticated) | The ceilings are firing. A few is a bad canvas; a spike on one tenant is a pathological import graph or an attempt. |
| `cacheHitRatio` | same | Below ~0.7 in steady use means the cache key is churning — cost scales with views again (A1b). |
| `p95Ms` | same | The corpus builds at p95 ≈ 70 ms. Sustained seconds means something is wrong with the sandbox, not with the canvas. |
| container CPU / memory | Cloudflare Containers dashboard | The ceilings bound ONE build; many concurrent builds still cost. |
| `/health` | per cell | Unchanged — the door being paused does not make a cell unhealthy. |

There is no alerting integration yet. **This is a two-person team and the
honest statement is that discovery is: a customer tells us, or the weekly look
at the board does.** If that changes, it changes here first.

## Pages a human when

- A cell is unhealthy AND its build counters are climbing → pause rendering for
  that tenant, then look.
- Any evidence of a build reading outside its design root (the allowlist is
  supposed to make this impossible — a report of it is a **stop everything**).
- R2 credentials appearing anywhere they should not: they are per-tenant,
  prefix-scoped and TTL-bounded (A-1), so the blast radius is one project for
  hours — but rotate the parent key and re-mint anyway.

## If you think a canvas is malicious

1. Pause rendering for that tenant (above).
2. Take a copy of the canvas source from the cell's checkout — it is a file,
   nothing has to be reproduced.
3. Confirm what the sandbox actually allowed: the build ran with an EMPTY
   environment, an import allowlist confined to the design root, a wall-clock
   deadline and an RSS ceiling. Anything it reached that is not a project file
   is a bug in `apps/studio/canvas-build.ts` → `importAllowlist`, and it is the
   most serious bug class this system has.
4. The tenant's storage credentials are temporary and scoped to
   `tenants/<id>/`; rotate the PARENT key (`R2_PARENT_ACCESS_KEY_ID` +
   `R2_CREDS_TOKEN` on the control plane) if you believe any credential leaked.
   Existing temporary credentials cannot be revoked individually — they expire
   (12 h), which is exactly why the TTL is short.
5. Render tokens (A4) are stateless HMACs, 15 minutes, read-only, and reach no
   mutating route. Rotating `CELL_SECRET_MASTER` invalidates every one of them
   fleet-wide — a big hammer, and it also kicks every session.

## What this does NOT cover

- **Anonymous visitors.** There are none: a build runs only for an
  authenticated member of that project. If that ever changes, this runbook is
  insufficient and DDR-206's original refusal is back on the table.
- **The agent.** `claude` does not run on our infrastructure and will not
  (DDR-123). If you find a process spawning it in a cell, that is an incident.
- **Alerting.** See above. Named rather than implied.

## After an incident

Write it up in `.ai/archive/logs/rca/`, and — if the sandbox's bounds were the
thing that failed — amend `scripts/check-containment.sh` so the same shape
cannot come back quietly. A guard added after the fact is the only one that
was ever proven necessary.
