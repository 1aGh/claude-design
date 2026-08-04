# DDR-210 — The canvas carries its own capability, and the session carries a role rather than a bit

- **Date:** 2026-08-04
- **Status:** Accepted
- **Area:** cloud / cell / canvas-origin / session / role
- **Tags:** cloud, cell, canvas, capability, cookie, role, session, DDR-054, DDR-209, DDR-115
- **Plan:** [`cloud-phase-27-one-studio-three-shells.md`](../../plans/cloud-phase-27-one-studio-three-shells.md) — post-landing corrections
- **Amends:** DDR-054 (the canvas origin is cookieless), DDR-209 A′2 (the capability lives in the URL)
- **Extends:** DDR-209 (per-project canvas origin), DDR-115 (runtime-state taxonomy)

## The situation this decides

Phase 27 landed and the owner opened his project in a browser. The studio
rendered. Everything that makes it a *design* did not: every photograph, club
logo, sponsor mark and font came back `401`, the design system's component
stylesheet came back `403`, the menubar said **VIEW ONLY** to the project's
owner, and the console carried two `404`s on every boot.

Four faults, and three of them share a shape: **a rule that was right about the
case it was written for, and silently wrong about a case nobody had run yet.**

## 1. The capability could not survive a URL the shell did not write

DDR-054 segregates the rendered canvas into its own origin, and DDR-209 A′2
followed the consequence: a separate origin sends no cookie, so the shell hands
the iframe an explicit, short-lived, read-only capability in the URL
(`?t=<render token>`).

That reasoning is complete for the URLs **the shell builds** — the iframe, the
built module, the tokens and components CSS. It is silently false for the URLs
it does not. Canvas code is the *tenant's own source*, and the tenant's own
source says:

```jsx
<img src="/.design/system/alligators/assets/logos/mark-green.svg" />
```

That request leaves the browser with no query string, because nothing in its
path passes through code we wrote. On one canvas, that was **51 of 51** assets.

### What was rejected

**Rewrite the tenant's source to append the token.** This is the option that
looks like it preserves the invariant, and it cannot be built. It means parsing
and rewriting arbitrary JSX `src`/`href`, CSS `url()`, inline styles, and
`<style>` blocks — and then it still fails on anything computed at runtime,
which is not a corner case in a design tool.

**Make the canvas origin's static lane public.** Correct on ergonomics and
wrong on everything else: the assets *are* the tenant's work.

**Serve assets from the shell origin instead.** Re-merges the two origins for
exactly the content DDR-054 segregates.

### The decision

The shell **document** — and only the shell document — plants the same signed
capability as a cookie on the canvas origin:

```
maude_canvas=<render token>; Path=/; HttpOnly; SameSite=Lax; Max-Age=1800[; Secure]
```

A request presents the capability in the query string **or** in that cookie.

**Why this is not the cookie DDR-054 refused.** That objection was about the
*shell's session cookie* being scoped wide enough to reach the canvas origin —
the untrusted origin borrowing the trusted one's identity. This is the opposite
direction and a different credential:

- **It is host-scoped to `canvas-<project>.<zone>`**, an origin that exists per
  project as of DDR-209 and serves one read-only allowlist. It is never sent to
  the shell, to another tenant, or to the control plane. On the *shared*
  `canvas.<zone>` host this decision would not have been available, which is the
  second time the per-project origin has paid for itself.
- **It IS the render token** — same HMAC, same fifteen-minute signed expiry,
  same read-only grant. Nothing new is authorised. The signature carries its own
  expiry, so a stale cookie fails verification exactly when a stale URL would;
  the cookie's `Max-Age` is longer only so a refresh, not a truncation, is what
  ends a session.
- **`HttpOnly`**, so the untrusted canvas cannot read and exfiltrate its own
  capability.
- **`SameSite=Lax` is sufficient, not a compromise.** The shell and the canvas
  origin share a registrable domain, so the iframe's subresource requests are
  same-site and carry it; a genuinely foreign page's are not and do not.
  `frame-ancestors` already refuses to be framed from anywhere else.

`Secure` is set whenever the deployment's canvas origin is `https://`. The local
harness runs plain `http://localhost`, where a `Secure` cookie is silently never
stored — which would have reverted the whole lane to the 401s above, invisibly.

## 2. The runtime-state guard rejected versioned design-system files

The canvas-origin allowlist rejected an underscore-prefixed segment **anywhere**
in a designRoot-relative path. The taxonomy it exists to reject (DDR-115) lives
entirely in the **first** segment — `_history/`, `_canvas-state/`, `_state/`,
`_chat/`, `_comments/`, `_untrusted/`, `_trash/`, `_draw/`, `_smoke/`,
`_server.json`, `_active.json` — and a first-segment test rejects all of it,
including everything nested underneath.

Testing every segment additionally rejected `system/<ds>/preview/_components.css`
— versioned, shipped, and named by the shell itself in the iframe URL. Every
canvas in every project rendered without its component styles. Narrowed to the
first segment, which is the honest statement of the rule.

## 3. The session stored a bit where it should have stored a role

The browser session stored `read_only`: a one-bit projection of a three-value
role, **computed once, at mint**. Two costs, and the first one shipped.

**A fixed function does not re-compute a bit already on a token.** The
translation that produced it was wrong for one release; the cookie lives twelve
hours, `/data` is a volume that survives every deploy, and the studio offered no
sign-out. So the owner stayed VIEW ONLY across three deploys of the fix, with
nothing on screen naming the account the verdict was about.

**`owner` and `member` were the same session.** Both are write-capable, so both
projected to `read_only = 0`, and the cell rebuilt every writer as `member`. No
browser session could hold `invite`, `delete` or `mirror`.

### The decision

The token stores the vouched **project role**; the capability is re-derived from
the role matrix on every request. And **a browser session with no stored role is
refused, not guessed at** — the two available guesses are a silent escalation
(`member` from `read_only = 0`) and the bug itself (`viewer` from
`read_only = 1`). A refusal costs one sign-in and self-heals through the door on
the next navigation.

Two affordances follow, because a capability the user cannot see or change is a
capability they cannot act on: the cloud menubar now names the signed-in account
and offers **Sign out**, and the VIEW ONLY tooltip names the account it is about.

## 4. "Not known yet" is a state, and collapsing it costs a 404 per boot

The client's cloud flag was `undefined` until `/_config` answered, and every
consumer treated falsy as "not the cloud". The sign-in bar and the export queue
each mounted for one frame and fired the one request a cell refuses by design.

The flag is now explicitly tri-state — `undefined` unknown, `null` desktop,
object cloud. The re-break is worth naming: the call sites were fixed to pass
the value raw, and the components still declared `cloud = null` as a **default
parameter**, which fires on `undefined`. The state was restored at the boundary
and destroyed one layer further in, invisibly. A test now bans the default.

## Consequences

- A canvas asset is reachable on the canvas origin with no query string, for as
  long as a valid capability cookie is present. The route set, the read-only
  posture and the token's lifetime are unchanged.
- `tokens` gains a `role` column, additively. Existing rows read `NULL`;
  machine-to-machine tokens legitimately have no project role, and only
  *browser sessions* treat `NULL` as a refusal.
- Anyone holding a browser session minted before this signs in once more.
- The local data-plane stand-in (`apps/cells/dev-edge.mjs`) forwards WebSocket
  upgrades. It did not, so the studio's status bar sat on "reconnecting" — a
  harness artefact that reads exactly like a product bug, on the one surface the
  harness exists to tell the truth about.

## How this was found

By running the cell against a real project and reading the network log, not by
reading the code. Fifty-one failures on one canvas before, one after — a sponsor
SVG the project genuinely does not contain. Every one of these four faults was
invisible to the test suite, to `tauri dev`, and to a screenshot.
