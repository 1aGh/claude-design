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
- **`SameSite=Strict`** — see the correction below.

`Secure` defaults **on**, and comes off only for a deployment that has
positively declared itself plaintext (`HUB_INSECURE_HTTP=1`, or an
`http://` canvas origin — the local harness, where a `Secure` cookie is
silently never stored and the whole lane would revert to the 401s above).

### Correction, same day: `SameSite` was the wrong instrument

This shipped as `SameSite=Lax`, on the reasoning that "a genuinely foreign page
gets nothing." Two independent security passes killed it within hours, and both
found the same thing, so it is written down rather than quietly edited:

- **`Lax` IS sent on a cross-site top-level GET navigation** — which is exactly
  the request class this origin serves. Any page anywhere could `window.open` a
  canvas-origin URL and the capability rode along.
- **"Same site" is computed at the REGISTRABLE DOMAIN.** On a multi-tenant
  `*.<zone>` platform, every tenant's canvas origin, every tenant's shell, the
  control plane and the marketing site are all same-site with one another.
  `SameSite` never expressed the tenant boundary the cell architecture exists to
  enforce — it is coarser than the origin.

The attribute is now `Strict`, which costs nothing (the legitimate flow is an
iframe inside a top-level document on the project's own shell origin, which is
same-site) and removes the drive-by-navigation leg.

**What `Strict` does not fix, and what actually holds the boundary.** Neither
value protects against script executing on a *sibling* `*.<zone>` origin. The
isolation that holds is the cookie's HOST scope plus the route allowlist plus
the per-tenant signing secret — not the `SameSite` attribute. Three consequences
were tracked here rather than in a ticket; two are now closed:

1. **Both collab WebSocket lanes check `Origin` — FIXED.** A WS handshake is
   exempt from the same-origin policy and carries cookies, so an ambient
   credential turned an unguessable-URL channel into one reachable from any
   same-site script: `wss://canvas-<victim>.<zone>/_ws/collab/<slug>` would
   have handed over the room's whole Y.Doc, plus writes to the annotation and
   comment lanes at the victim's role. `handleCanvasUpgrade` now admits only
   the project's own canvas and shell origins; a request with no `Origin` (a
   non-browser client) must present an explicit `?t=`, because a URL token is
   proof of intent in a way an ambient cookie is not.

   The **shell-origin `/_ws` twin closed the same way, one commit later**, and
   it was the worse of the two: that socket is upgraded at `realm: 'main'`,
   which the DDR-122 origin gate leaves ungated, so it reaches the body lanes —
   a canvas's source, its CSS, its meta — at the victim's real role, and its
   credential is the browser session cookie rather than a fifteen-minute
   capability. `handleUpgrade` now admits **only the project's own shell**: not
   another tenant's, and not the project's OWN canvas origin, which is the
   origin that exists to run untrusted code and therefore the likely place the
   attacker is standing. There is no `?t=` on this lane, so a missing `Origin`
   has no way to prove intent and is refused outright; a deployment that never
   declared `HUB_PUBLIC_URL` falls back to comparing the request's own `Host`,
   which a browser sets from the URL it dials and an attacker's page therefore
   cannot make agree.
2. **A stored `.svg` on the canvas origin is a scripting document — FIXED.**
   Static canvas-origin responses carried `nosniff` but no CSP; only the shell
   HTML got one, so a top-level navigation to a stored SVG executed script on
   that origin. They are now served `default-src 'none'; sandbox`, which costs
   the legitimate uses nothing (the policy never applies to an `<img>`, a CSS
   `url()` or a `<use>` target). This was the step that gave an attacker a
   *same-site* foothold in the first place — the cheapest of the three links to
   break, and with 1 closed the chain is broken at both ends.
3. **Capability fixation — open, integrity only.** The mint checks that the
   token is valid, not *whose* it is, so a link with someone else's `?t=`
   overwrites a victim's cookie and their subsequent requests are attributed to
   the link's author. No privilege gain; the fix is to bind the capability to
   the shell session.

None of the three is created by this decision; all are made cheaper to exploit
by it, which is reason enough to name them here rather than in a ticket. What
remains is 3 — and it is the one that grants nothing.

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

- **The browser sign-out is a POST.** It calls `removeToken` — a server-side
  revocation, not a cookie clear — so as a `GET` anchor it was a state-mutating
  navigation any page could force on a signed-in member. Found in the same
  review, on code added by this change.

## How this was found

By running the cell against a real project and reading the network log, not by
reading the code. Fifty-one failures on one canvas before, one after — a sponsor
SVG the project genuinely does not contain. Every one of these four faults was
invisible to the test suite, to `tauri dev`, and to a screenshot.

And then the `SameSite` correction above was found by an adversarial pass, not by
running it — the `Lax` cookie *worked* in every test and every browser session.
Both methods were necessary and neither would have found the other's bug: one
answers "does it do the thing", the other "what else does it now permit".
