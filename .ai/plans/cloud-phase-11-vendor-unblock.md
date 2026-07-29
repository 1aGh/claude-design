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

## Step 1 — Workers Paid (~$5/mo) · unblocks phases 15, 20

1. https://dash.cloudflare.com → **Workers & Pages** → **Plans**
2. Choose **Workers Paid**, pay.

Unlocks **Containers** (the per-project cell) and **Queues**. Without it the
control plane runs but can never provision a project's cell.

## Step 2 — Enable R2 · unblocks phases 15, 16, 18

1. Dashboard → **R2 Object Storage** → **Enable R2** (accept the ToS; billing
   details required even though the free allowance covers the pilot).

Nothing else — the agent creates the buckets. R2 is where media, checkpoints
and (phase 18) canvas snapshots live.

## Step 3 — DNS for `cloud.maude.sh` · unblocks the pretty URL only

`maude.sh` currently uses **Vercel nameservers** (`ns1/ns2.vercel-dns.com`,
registrar Name.com), and the site is served from Vercel. A Cloudflare Worker
custom domain requires the zone to be **on Cloudflare**. Two options:

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

> Not urgent: phases 12–14, 16, 19 need no domain at all.

## Step 4 — Google sign-in credentials · unblocks the Google door (phase 13)

The code is built and deployed; it answers an honest 503 until these exist.

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

> If you'd rather not paste the secret into a file, run these yourself in
> `apps/cloud/` and tell the agent it's done:
> `wrangler secret put GOOGLE_CLIENT_ID` · `wrangler secret put GOOGLE_CLIENT_SECRET`

## Step 5 — Email sending · unblocks magic-link invites (phase 17)

Needed for "invite a teammate with a link" and password recovery. Pick one:

- **Resend** (https://resend.com) — free tier is plenty. Verify a sending
  domain (`maude.sh` — easier after Step 3A) and create an API key.
- Or any SMTP/API provider; the agent adapts.

Put the key in `apps/cloud/.dev.vars.deploy` as `RESEND_API_KEY=…`.

> Until this exists, invites work only as links you copy by hand.

## Step 6 — GitHub App for mirroring · unblocks phase 19

1. https://github.com/settings/apps → **New GitHub App**
   - Name `Maude Mirror`, homepage `https://maude.sh`.
   - **Uncheck** "Active" under Webhook (the mirror pushes; it never listens).
   - **Repository permissions → Contents: Read and write.** Nothing else.
   - "Where can this be installed": **Any account**.
2. Generate a **private key** (.pem download) and note the **App ID**.
3. Put in `apps/cloud/.dev.vars.deploy`:
   ```
   GITHUB_APP_ID=…
   GITHUB_APP_PRIVATE_KEY_PATH=/absolute/path/to/the.pem
   ```

> The `gh` CLI is already authenticated, so the agent can create test repos
> itself — only the App (which needs a browser) is yours.

## Step 7 — Stripe · NOTHING TO DO for the pilot

The sandbox account (`acct_1TyGz4BU24eXpQyl`) is authenticated and the full
price catalog exists there. **Test cards work end to end without a live
entity.** A live Stripe entity (company details, bank account, tax) is needed
only to charge a real customer — a GA step, not a pilot one. The code refuses
live mode until its price ids are filled in, deliberately.

---

## Order that unblocks the most, fastest

| # | Step | Time | Unblocks |
| - | ---- | ---- | -------- |
| 1 | Workers Paid | 2 min | cells (15), the whole hosted product |
| 2 | Enable R2 | 2 min | media, checkpoints, snapshots (15/16/18) |
| 4 | Google credentials | 10 min | the second sign-in door (13) |
| 3 | Zone → Cloudflare | 10 min + propagation | `cloud.maude.sh` (cosmetic until GA) |
| 5 | Resend | 10 min | magic-link invites (17) |
| 6 | GitHub App | 5 min | mirror (19) |

**Steps 1 and 2 alone unblock the alligators pilot.** Do those two and the
agent can carry phases 14–20 to a working end-to-end product on
`workers.dev` URLs; 3–6 are polish and specific features.

## Exit gate

- [ ] Workers Paid active — a Containers API call stops returning 1000/Unauthorized
- [ ] R2 enabled — bucket creation stops returning 10042
- [ ] (optional) `maude.sh` Active on Cloudflare, Vercel records intact + grey-clouded
- [ ] `apps/cloud/.dev.vars.deploy` carries the Google (and optionally Resend /
      GitHub App) values
- [ ] Tell the agent — it re-probes, records the ids here, and continues
