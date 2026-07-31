# DDR-204 — One account, one dashboard, two authorities

- **Date:** 2026-07-29
- **Status:** accepted
- **Scope:** `repo:maude`, `dept:dev`
- **Narrows:** [DDR-199](./DDR-199-cells-on-cloudflare-and-the-four-things-deploying-taught-us.md) §6 (the derived per-cell admin password becomes pilot-only)
- **Reuses:** [DDR-201](./DDR-201-mirror-credential-boundary.md) (the ask-don't-hold credential pattern)
- **Raised by:** the owner, 2026-07-29 — "wouldn't it be better to unify it all into one place, billing too?"

## Context

A cell is a hub, and a hub has always had its own users, its own tokens and its
own `/admin` — because a hub was originally a thing one person self-hosted.
Cloud inherited that shape without deciding on it.

The result, verified rather than assumed: `authenticate()` exists **twice**, in
`apps/hub/src/users.mjs` and in `apps/cloud/accounts.mjs`. A customer with
three projects has **four accounts** — one platform account plus three separate
per-cell accounts, each with its own derived password.

That is not a UI annoyance. It is two password stores for one human, and the
per-cell one exists because of where the code came from, not because anyone
chose it.

## Decision

Three things were being conflated. They separate cleanly:

| | before | after |
| --- | --- | --- |
| where you sign in | N+1 places | **one** |
| where you look | each cell's own admin | **one dashboard** |
| who decides | split | **still split** |

**Unify the surface and the identity. Do NOT unify the authority.**

### 1. The control plane is the identity provider

A cell in cloud mode has no user store of its own. It accepts a short-lived,
project-scoped token minted by the control plane after the control plane has
checked that this person has access to this project.

This is the same shape as the mirror credential (DDR-201): the cell **asks**,
it never **holds**. That pattern is already built and tested, which is most of
why this is a small change rather than a rewrite.

### 2. One dashboard, reading through the cell's API

`cloud.maude.sh` shows projects, members, billing and activity. Per-project
detail is fetched from the cell rather than by sending the person to a
different website. The customer never types a second URL and never learns that
a "cell" exists.

### 3. The authority stays split, and this is the part not to concede

The control plane holds billing and identity **for every customer**. A cell
holds the work of **one project**. Merging those is what would make a
compromised cell a path to billing, and a control-plane outage a reason nobody
can reach their own designs.

Concretely: a cell must remain able to serve its project while the control
plane is unreachable. A signed-in session already established keeps working;
only new sign-ins need the control plane.

### 4. The cell keeps its own `/admin`

Not from inertia. Maude ships as a **self-hostable** hub, and that surface is
the whole product for a self-hoster — it cannot disappear. It is also the
break-glass path when the control plane is down.

It simply stops being where a cloud customer goes. Two audiences, one surface,
different front doors.

## What this narrows

**DDR-199 §6's derived per-cell admin password becomes pilot-only.** Deriving
`HUB_SECRET` per cell from one master remains right — that is an *operator*
credential, and the ask-don't-hold property is what makes it safe. But deriving
an *end-user's* initial password per cell was a correct answer to "how does one
person get into one pilot cell" and a wrong answer to "how does a customer sign
in to their projects". Saying so is cheaper than defending it.

## Consequences

- `apps/hub/src/users.mjs` stays for self-hosted hubs and is bypassed in cloud
  mode, rather than being deleted. One code path, two configurations.
- The per-project sign-in the alligators pilot uses today is superseded; the
  pilot credential keeps working until the unified path lands.
- Members become a control-plane concept (they already are — `accounts`), and
  the cell stops being where membership is decided. Removing a member can then
  actually revoke live sessions, which a per-cell user store made awkward.

## Why this was worth stopping for

It was raised as a product question — "wouldn't one place be better" — and the
honest answer required checking whether the duplication was real rather than
reasoning about the design as documented. It was real, and it had already
shipped into the pilot.
