# DDR-197: A read-only browser surface — narrowing DDR-192 §4 to what it protects

- **Date:** 2026-07-29
- **Status:** Accepted
- **Tags:** cloud, browser, containment, share-view, security, amendment
- **Related:** [DDR-192](./DDR-192-remote-workspace-server-architecture.md) (**amends §4**), [DDR-193](./DDR-193-maude-cloud-tenant-cells-and-containment-invariant.md) (§2 reaffirmed verbatim), [DDR-123](./DDR-123-acp-chat-uses-users-claude-cli.md) (untouched), DDR-196 · Debate: kgai `debate-cloud-selfservice-gap-arc` (4 seats, 2026-07-29)

## Context

The owner asked for per-project Maude Studio instances hosted in the browser.
DDR-193 §2 predicted the request and prescribed declining it; DDR-192 §4 bans
any editing surface in any browser UI. A four-seat debate examined the conflict
rather than re-litigating it ad hoc.

The finding: DDR-192 §4's ban is **broader than its own two justifications**.
Those justifications are (a) licensing — AI must run on each member's own
subscription, on their own machine (DDR-123), and (b) containment — a browser
editing surface implies the vendor evaluates tenant TSX (DDR-193 §2). Neither
reason reaches a surface that shows a **raster image a member's own machine
rendered** or stores a **comment**, which is content, not code.

Meanwhile the persona the product is staked on — the invited teammate who has
never used git (DDR-193 §5) — currently dead-ends on a phone at "install a
desktop app". All four debate seats, including both that voted to hold the
DDRs unchanged, independently converged on the same near-term shape.

## Decision

**DDR-192 §4 is narrowed to what it actually protects:**

> No **vendor-side evaluation of tenant-authored code**, and no **AI/chat
> surface in any browser UI**. Editing tenant source in a browser remains
> forbidden. A **read-only, non-executable** browser surface is permitted.

Permitted concretely (Phase 18): PNG/JPEG canvas snapshots rendered on a
member's machine and uploaded to R2; comment threads; presence. Served from an
isolated origin with strict CSP; SVG excluded (script/foreignObject); share off
by default; every view stamped with its render time and author.

**DDR-193 §2 (the containment invariant) is reaffirmed verbatim.** The cell
still never renders, builds, or evaluates anything. The vendor stores and
serves bytes it never interprets.

**Browser editing is not decided here.** It gets a gated spike (Phase 21) with
three preconditions: the share view live, paying tenants existing, and the
owner re-confirming. The debate's dissent is preserved there — BUILDER's
client-side-evaluation path (esbuild-wasm in the visitor's browser; the cell
serves only bytes) against BREAKER's position that browser editing makes a
two-person vendor an anonymous-signup code-execution host. Both are quoted in
the graph; the spike's output is a DDR with the losing path's costs priced.

## Alternatives considered

- **Hold DDR-192 §4 verbatim.** Rejected: it forces the phone invitee to zero
  conversion while defending nothing its own rationale defends.
- **Amend all the way to browser editing now.** Rejected: it would overturn a
  week-old accepted decision under product pressure — exactly the failure mode
  DDR-193 §5 anticipates — and the two-pipeline drift risk (esbuild-wasm vs
  Bun.build) is unmeasured.
- **A "sandboxed" vendor-side renderer.** Rejected again on DDR-193 §2's
  original grounds: at this operating scale a sandbox promise is not a control
  a two-person team can stand behind.

## Consequences

- The invitee journey gains its missing browser half without touching the
  invariant that makes "the vendor runs your workspace" an honest sentence.
- The recurring "browser editing" request now meets a priced, scheduled answer
  (Phase 21) instead of a flat decline or a silent cave-in.
- The Trust page can state the sharper claim: *nothing you author is ever
  executed by our compute — including on the share view.* `trust-claims`
  must gain that assertion when Phase 18 ships.
