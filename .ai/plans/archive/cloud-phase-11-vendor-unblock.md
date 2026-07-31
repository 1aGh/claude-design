# Cloud Phase 11 — Vendor unblock: the OWNER checklist

> Debate-resolved arc (2026-07-29, kgai `debate-cloud-selfservice-gap-arc`).
> **This is the only plan that needs a human.** Everything else in phases 12–21
> is agent work; each item below unblocks a specific phase and nothing else.
>
> Status as of 2026-07-29: phases 12 and 13 are DONE and LIVE **without** any of
> this — Workers, cron and D1 turned out to be Free-tier capable. What remains
> blocked is listed per step.

Account: `b5b596efe65abb732777c7171dc18145` (M.dovrtel@gmail.com)
Live control plane: `https://maude-cloud.maude1agh.workers.dev`

---

## Step 1 — Workers Paid · ✅ DONE 2026-07-29

Subscription `Workers Paid` ($5) active. **Verified:** the Containers API now
answers `200` with 0 applications instead of `1000 Unauthorized`. Phase 15 is
unblocked.

## Step 2 — Enable R2 · ✅ DONE 2026-07-29

Subscription `R2 Paid` active at €0 (free allowance). Agent created bucket
**`maude-cloud-assets`** (EEUR). Media, checkpoints and phase-18 snapshots have
a home.

## Step 3 — DNS · ✅ DONE 2026-07-30 (owner flipped the nameservers)

Verified live: `dig NS maude.sh` answers `shane`/`sue.ns.cloudflare.com`, the
zone is Active, `cloud.maude.sh` + `alligators.cloud.maude.sh` +
`view-alligators.cloud.maude.sh` all serve over Worker custom domains with
valid certificates, and the Vercel-served site keeps working through the
grey-cloud CNAMEs. Original working notes preserved below.

<details><summary>pre-switch notes</summary>

## Step 3 (original) — DNS · 🔄 ZONE READY, ONE SWITCH LEFT (yours)

**Agent did (2026-07-29):** created zone `maude.sh` on the account —
id `b27eb712a0031253edf58c0e31c57b7b`, status `pending`. Cloudflare nameservers:

```
shane.ns.cloudflare.com
sue.ns.cloudflare.com
```

Records mirror what Vercel serves today, all **DNS only** (grey cloud), so the
site keeps being served and TLS-terminated by Vercel:

| type | name | content |
| ---- | ---- | ------- |
| CNAME | `maude.sh` | `44c7d73f1f7105b5.vercel-dns-017.com` |
| CNAME | `*` | `cname.vercel-dns-017.com` |
| CNAME | `www` | `cname.vercel-dns-017.com` |
| CAA | `maude.sh` | letsencrypt.org, sectigo.com, pki.goog, **ssl.com** (added) |

**CNAMEs, not A records — and that correction matters.** The first pass copied
the IPs the apex resolved to. But Vercel does not publish A records here: the
apex and the wildcard are **ALIAS** records pointing at Vercel-managed hostnames,
and Vercel rotates the addresses behind them. Hardcoded IPs would have worked
on the day of the migration and broken silently later. Cloudflare flattens a
CNAME at the zone root, so the apex works and Vercel keeps owning its own IPs.

Second correction from the same look: **the wildcard points at a DIFFERENT
target than the apex** (`cname.vercel-dns-017.com` vs `44c7d73f…`, resolving to
different address pools). Copying the apex IPs onto the wildcard — which the
first pass did — would have pointed every subdomain at the wrong Vercel edge.

Both were found by reading the actual Vercel DNS table rather than trusting
`dig`, which only ever shows the resolved result, never the record type.

`ssl.com` was ADDED to CAA because Cloudflare issues Worker custom-domain certs
through it; without it `cloud.maude.sh` could not get a certificate. The three
existing entries are preserved, so Vercel's issuance is unaffected. (A `pending`
zone's nameservers serve a partial CAA set; re-verify after activation.)

Verified against the Cloudflare nameservers **before** the switch: apex, www and
a random subdomain all return Vercel edge addresses, matching Vercel's own
answers.

**YOUR STEP:** at Vercel → Domains → `maude.sh` → nameservers → set the two
Cloudflare ones above. Registration stays with Vercel; only DNS hosting moves.

Then the agent adds `cloud.maude.sh` and per-project subdomains (a more
specific record always beats the wildcard, so nothing collides).

<details><summary>original notes</summary>

`maude.sh` currently uses **Vercel nameservers** (`ns1/ns2.vercel-dns.com`,
registrar Name.com), and the site is served from Vercel. A Cloudflare Worker
custom domain requires the zone to be **on Cloudflare**. Two options:

> **The domain is REGISTERED at Vercel.** That does not block this: registration
> and DNS hosting are separate. In the Vercel dashboard the domain has a
> nameserver setting you can point at Cloudflare while Vercel stays the
> registrar. If Vercel refuses (some registrars lock newly-purchased domains
> for 60 days), Option B costs nothing and can wait.

**Option A — move the zone to Cloudflare (recommended).**
1. Cloudflare dashboard → **Add a site** → `maude.sh` → Free plan.
2. Cloudflare imports the existing records — **verify the Vercel records are
   present** (`maude.sh` A records `64.29.17.65` / `64.29.17.1`, plus any
   `www`/TXT). Set them to **DNS only** (grey cloud) so Vercel keeps serving.
3. At **Name.com**, change nameservers to the two Cloudflare gives you.
4. Wait for "Active" (usually minutes, up to 24 h).

The public site keeps working — only the nameservers move. Then the agent adds
`cloud.maude.sh` and each project's `<project>.cloud.maude.sh` itself.

**Option B — skip it.** Everything works at `maude-cloud.maude1agh.workers.dev`.
Cells would get workers.dev subdomains too. Fine for the alligators pilot,
wrong for a public product.

</details>

</details>

## Step 4 — Google sign-in · ✅ DONE 2026-07-29

Client id `153921296891-ouvhav32…` uploaded as a Worker secret. **Verified live:**
`/auth/google` → 303 to `accounts.google.com` with the right client id, the
right redirect URI, scope `openid email profile`, `code_challenge_method=S256`
and a state value mirrored into an HttpOnly cookie. The signup page shows
"Continue with Google".

Remaining (only when you want people other than yourself to sign in): the
consent screen is in **Testing** mode, so add each tester under *Test users*,
or publish the app (which triggers Google verification — a GA-time step).

<details><summary>original instructions, for reference</summary>

1. https://console.cloud.google.com → create a project (e.g. **Maude Cloud**).
2. **APIs & Services → OAuth consent screen**:
   - User type **External**, then **Create**.
   - App name `Maude`, user support email = yours, developer contact = yours.
   - **Scopes**: add `openid`, `.../auth/userinfo.email`,
     `.../auth/userinfo.profile`. Nothing else — the app asks for no more.
   - **Test users**: add `m.dovrtel@gmail.com` (while the app is unpublished
     only listed users can sign in; publishing needs verification, which is a
     later, GA-time step).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type **Web application**, name `maude-cloud`.
   - **Authorized redirect URIs** — add BOTH (the second only if you did Step 3A):
     ```
     https://maude-cloud.maude1agh.workers.dev/auth/google/callback
     https://cloud.maude.sh/auth/google/callback
     ```
   - Leave "Authorized JavaScript origins" empty — the flow is server-side.
4. Copy the **Client ID** and **Client secret** into
   `apps/cloud/.dev.vars.deploy` (already gitignored, mode 0600):
   ```
   GOOGLE_CLIENT_ID=…apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=…
   ```
   The agent uploads them as Worker secrets and verifies the round trip.

</details>

## Step 5 — Email sending · ✅ KEY RECEIVED 2026-07-29

`RESEND_API_KEY` uploaded as a Worker secret. Sending domain verification is
easier after Step 3; until then Resend can still send from its shared testing
domain, which is enough to prove the invite flow.

<details><summary>original instructions, for reference</summary>

Needed for "invite a teammate with a link" and password recovery. Pick one:

- **Resend** (https://resend.com) — free tier is plenty. Verify a sending
  domain (`maude.sh` — easier after Step 3A) and create an API key.
- Or any SMTP/API provider; the agent adapts.

</details>

## Step 6 — GitHub App · ✅ DONE 2026-07-29

App **`maude-mirror`**, App ID **4425366**, owner `1aGh`. Private key at
`~/.config/maude/maude-mirror.private-key.pem` (mode 0600, moved out of Downloads).

**Verified end to end with a real JWT:**
- `GET /app` → `permissions: {"contents":"write","metadata":"read"}`, `events: []`
  (webhook off — the mirror pushes, never listens), 1 installation.
- Installation **149855203** on `1aGh`, `repository_selection: all`.
- `POST /app/installations/149855203/access_tokens` → **201**, a `ghs_…` token
  that expires in one hour with exactly those two permissions.

Nothing further needed; phase 19 has a working credential path.

<details><summary>original instructions, for reference</summary>

1. https://github.com/settings/apps → **New GitHub App**
   - Name `Maude Mirror`, homepage `https://maude.sh`.
   - **Uncheck** "Active" under Webhook (the mirror pushes; it never listens).
   - **Repository permissions → Contents: Read and write.** Nothing else.
   - "Where can this be installed": **Any account**.
2. Generate a **private key** (.pem download) and note the **App ID**.
</details>

## Step 7 — Stripe · NOTHING TO DO for the pilot

The sandbox account (`acct_1TyGz4BU24eXpQyl`) is authenticated and the full
price catalog exists there. **Test cards work end to end without a live
entity.** A live Stripe entity (company details, bank account, tax) is needed
only to charge a real customer — a GA step, not a pilot one. The code refuses
live mode until its price ids are filled in, deliberately.

---

## Where it stands — 2026-07-29

| Step | State |
| ---- | ----- |
| 1 · Workers Paid | ✅ active — Containers API answers 200 |
| 2 · R2 | ✅ enabled, bucket `maude-cloud-assets` created |
| 3 · DNS | ✅ nameservers flipped 2026-07-30; zone Active, custom domains live |
| 4 · Google | ✅ live and verified |
| 5 · Resend | ✅ key uploaded |
| 6 · GitHub App | ✅ contents:write, installed, token mint verified |
| 7 · Stripe | ✅ nothing to do for the pilot |

**Everything a human had to do is done. Phase closed 2026-07-30.**

## Exit gate

- [x] Workers Paid active — Containers API returns 200
- [x] R2 enabled — bucket `maude-cloud-assets` exists
- [x] `maude.sh` Active on Cloudflare — NS switch done, custom domains serving
- [x] Google credentials live and verified against the deployed Worker
- [x] Resend key uploaded
- [x] GitHub App has Contents:write, one installation, and mints working tokens
- [x] Agent re-probed and recorded the ids here
