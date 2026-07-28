# Cloud Phase 0b — Manual prep checklist (do this BEFORE `/flow:execute` on any phase)

Everything a human must do by hand — accounts, logins, tokens, tooling, MCP wiring — so the phase executions run smoothly and agent-driven. Companion to `cloud-phase-0-economics-and-architecture.md`. **Not executable by an agent** (browser signups, payment details, OAuth consent, legal identity).

Rule of thumb: agents get **scoped API tokens, never account passwords**, and every secret goes into a 0600 file or a platform secret store — never into the repo, never into a plan file, never pasted into chat.

---

## Re-probe — 2026-07-28, late (during the Phase 1–3 execution run)

Re-verified against the live API before starting any vendor-dependent phase. **The audit above still holds — nothing has changed.**

| Surface | Result |
| --- | --- |
| `GET /accounts/<id>/subscriptions` | `200`, **0 subscriptions** → still Free plan |
| `GET /accounts/<id>/containers/applications` | **1000 Unauthorized** — "requires the Workers Paid plan" |
| `GET /accounts/<id>/r2/buckets` | **10042** — "Please enable R2 through the Cloudflare Dashboard" |
| `GET /zones` | `200`, **0 zones** — no domain on this account |
| D1 / Workers scripts | `200`, 0 items — reachable, agent can create |

**Consequence for the arc:** Phases 1–4 are fully executable (they touch `apps/studio`, `apps/hub`, `cli` — no vendor infrastructure). **Phase 5 onward is blocked** on three things an agent cannot do — they need a browser, payment details, and domain control:

1. **Workers Paid plan** (~$5/mo) — unlocks Containers. Blocks Phase 5 and 7.
2. **Enable R2** in the dashboard (ToS + billing acceptance). Blocks the Phase-3 production asset lane and Phase 5.
3. **`cloud.maude.sh` on Cloudflare DNS** — the zone has to exist before any Workers route or cell ingress.

Until those land, the S3/R2 code paths are exercised against MinIO-compatible / in-process S3 servers, which is why they were built target-pluggable in the first place.

---

## Live access audit — 2026-07-28 (probed, not assumed)

MCP plugins installed + OAuth-authorized: **cloudflare** (api / bindings / builds / observability / docs), **stripe**, **vercel**. `gh` CLI signed in (two accounts). What the probes actually returned:

| Surface | State | Verdict |
| --- | --- | --- |
| Cloudflare account | `M.dovrtel@gmail.com's Account` (`b5b596efe65abb732777c7171dc18145`), type `standard`, **0 subscriptions** | ⚠️ **Free plan** |
| Cloudflare Containers | `GET /containers/applications` → **1000 Unauthorized: "requires the Workers Paid plan"** | 🔴 **BLOCKER for Phase 5** |
| R2 | `GET /r2/buckets` → **10042 "Please enable R2 through the Cloudflare Dashboard"** | 🔴 **BLOCKER for Phase 3/5** (dashboard-only, ToS/billing acceptance) |
| workers.dev subdomain | **10007 — never created** (auto-creates on first Workers & Pages dashboard visit) | 🟡 one click |
| D1 / Queues | reachable, 0 items | ✅ agent can create |
| Cloudflare zones | **none** — no domain on this account at all | 🔴 see DNS below |
| DNS `maude.sh` | NS = `ns1/ns2.vercel-dns.com`, registrar **Name.com** | 🟡 `cloud.maude.sh` must be delegated to Cloudflare (registrar or Vercel DNS change) |
| Stripe | connected as **`maude.sh sandbox`** (`acct_1TyGz4BU24eXpQyl`) | 🟡 sandbox — fine for Phase 8 dev, a **real verified live account is still required** before charging |
| Vercel | team **Slant** (`team_W9DettDnXJtrWvpz3GPFQP3P`), project `maude` owns `maude.sh` | ✅ full read/write |
| GitHub | `gh` OK; **active account = `iagh66`**, but `1aGh` is the one with repo permissions (memory `reference_maude_pr_merge_mechanics`) | 🟡 `gh auth switch --user 1aGh` before any PR/merge |
| Side finding | Vercel project `maude` latest deployment `readyState: ERROR`, `live: false` | 🟡 unrelated to this arc — worth a look |

**Honest answer to "will you still need me?": yes, for six things** — every one is a payment authorization, a ToS acceptance, a legal identity, or a human test subject. Nothing else. They are listed as Steps 1a/1b/1c, 3, 4 and 7 below. After those, Phases 1–10 run agent-driven through MCP.

---

## Step 0 — Local tooling (5 min, do now)

Verified on this machine 2026-07-28: `node` v24.13.0 ✅, `bun` 1.3.3 ✅, `pnpm` 11.0.4 ✅, `gh` 2.93.0 ✅, `claude` 2.1.220 ✅. Missing:

```sh
# Cloudflare CLI — used by every data-plane phase (5, 7, 9, 10)
npm i -g wrangler            # then: wrangler --version

# Stripe CLI — needed from Phase 8 (webhook forwarding, test clocks, live-mode checks)
brew install stripe/stripe-cli/stripe
```

Not needed unless the Fly fallback is taken: `flyctl`.

---

## Step 1 — Cloudflare: the three dashboard clicks only you can make (blocks Phase 5)

The MCP connection is live and works — but three things are gated behind payment/ToS acceptance and **cannot** be done via API by anyone, agent or not.

### 1a. Enable Workers Paid — $5/mo *(hard blocker for Containers, Durable Objects, Queues at scale)*
<https://dash.cloudflare.com> → Workers & Pages → **Plans** → Workers Paid. Opening Workers & Pages for the first time also auto-creates the missing `workers.dev` subdomain (Step 1b done for free).

Probe evidence: `GET /accounts/…/containers/applications` → `1000 Unauthorized: … requires the Workers Paid plan`.

### 1b. Enable R2 *(hard blocker for assets + cell durability)*
Dashboard → **R2** → accept the R2 terms (billing consent). No bucket needed — once R2 is enabled I create `maude-cloud` (EU hint, no lifecycle rules) and its scoped API token via MCP.

Probe evidence: `GET /accounts/…/r2/buckets` → `10042 Please enable R2 through the Cloudflare Dashboard`.

### 1c. Delegate `cloud.maude.sh` to Cloudflare *(DNS ownership change)*
`maude.sh` currently uses **Vercel DNS** (`ns1/ns2.vercel-dns.com`), registrar **Name.com**. The apex + docs site stay exactly where they are. Two options — pick one:

- **Preferred (zero risk to the docs site):** in Vercel's DNS for `maude.sh`, add `NS` records for the `cloud` subdomain pointing at the two Cloudflare nameservers you get after adding `cloud.maude.sh` as a zone in Cloudflare (Websites → Add a site → enter `cloud.maude.sh`).
- Alternative: move the whole `maude.sh` zone to Cloudflare (changes NS at Name.com) — only if you also want the Phase-10 docs migration now.

After 1a–1c, everything else on Cloudflare is agent-driven: zones/DNS records, R2 buckets + tokens, D1, Queues, Workers, Containers, secrets. **No API token to create by hand** — the MCP OAuth session covers it; a scoped token gets minted (by me) only when CI needs one.

---

## Step 2 — MCP servers ✅ DONE (2026-07-28)

Installed as **Claude Code plugins** (better than raw `claude mcp add` — they bundle skills too) and OAuth-authorized:

- **cloudflare** plugin → `cloudflare-api` (2 500+ endpoints via `search`/`execute`), `cloudflare-bindings` (D1/R2/KV/Workers CRUD), `cloudflare-builds`, `cloudflare-observability`, `cloudflare-docs` + skills (`wrangler`, `durable-objects`, `workers-best-practices`, `sandbox-sdk`, `agents-sdk`, `cloudflare-email-service`)
- **stripe** plugin → `stripe` MCP (`stripe_api_read`/`write`/`search`, implementation planner) + skills (`stripe-best-practices`, `stripe-projects`, `test-cards`)
- **vercel** plugin → deployments, logs, projects, domains
- Pre-existing: `context7`, `productivity-stack`

All verified live by probe. No further MCP work needed.

**Note on Stripe keys:** the MCP is OAuth-bound to the sandbox account — no key file needed for development. When Phase 8 goes live, the live secret key goes into a **Worker secret** (control plane), never into a local file or shell history; automation uses a **restricted key** (`rk_…`) with only the scopes that phase needs.

---

## Step 3 — GitHub (Phase 10, but the App can be registered early)

1. Decide the **owner org** for the Maude GitHub App — your `1aGh` account or a dedicated `maude` org. A dedicated org is cleaner for a commercial product (transferable, separate from personal repos).
2. Register the App: GitHub → Settings → Developer settings → GitHub Apps → New. Permissions: `Contents: Read & write`, `Metadata: Read`. Where can it be installed: **Any account**. Save the App ID + generate a private key (`.pem`) — store outside the repo, 0600.
3. `gh auth status` — already signed in on this machine ✅. **Active account is `iagh66`; `1aGh` holds the repo permissions** — run `gh auth switch --user 1aGh` before any PR/merge on this repo (memory `reference_maude_pr_merge_mechanics`).

---

## Step 4 — Stripe (Phase 8; a **sandbox** is connected — a live account still needs creating, and verification takes days)

Current state (probed): connected as `maude.sh sandbox` (`acct_1TyGz4BU24eXpQyl`). That's enough for all Phase-8 development and test-clock work — but a sandbox cannot take real money.

1. Create the **live** account at <https://dashboard.stripe.com/register> under the **legal entity that will invoice** (your IČO / company). Verification (identity + bank) can take a few days — start early even though the phase is far out.
2. Enable **Stripe Tax** (Settings → Tax) and set the origin address; EU VAT + reverse-charge for CZ B2B depends on it.
3. Enable the **Customer Portal** (Settings → Billing → Customer portal) — no billing UI to build.
4. Keys: use **restricted keys** for automation; the live secret key stays in the control-plane secret store (Worker secret), never on your laptop's shell history.
5. Optional but recommended for the Czech invoice question: check with your accountant whether Stripe invoices satisfy your bookkeeping, or whether you need Fakturoid/iDoklad reconciliation. This is a **Phase-8 decision input**, not code.

---

## Step 5 — E-mail sending (Phase 6–7)

Only the signup is yours; the DNS records and the key wiring are agent work afterwards.

1. Create a **Resend** account (<https://resend.com>) — free tier covers the pilot — and generate an API key.
2. Hand me the key (or drop it into `~/.config/maude/cloud.env` as `RESEND_API_KEY=…`, mode 0600); I add the DKIM/SPF records to the Cloudflare zone and wire the Worker secret.
3. **Alternative worth evaluating at Phase 6:** Cloudflare's own e-mail sending (the `cloudflare-email-service` skill shipped with the plugin) — one less subprocessor and one less signup. Decide then; Resend is the safe default.

---

## Step 6 — Legal / business (Phase 9 gate — start the paperwork early)

Nothing to install; these are the artifacts the Phase-9 Trust page must reference. Prepare or commission:

- **DPA** (processor terms) — you process customer design data + presence data of invitees
- **Privacy policy** update covering the DDR-054 disclosure (operator can technically see files + presence)
- **Subprocessor list**: Cloudflare, Stripe, Resend (+ Vercel while docs stay there)
- **ToS** for the paid service (incl. suspension/deletion timelines matching the tenant state machine)
- A human lawyer's review before the Trust page publishes — budget for it now, not at launch week.

---

## Step 7 — The pilot repo (Phase 5)

`~/git/alligators` (2.3 GB, 266 MB `.design/assets`) is the tenant-of-one. Before Phase 5:

- Make sure it's committed and pushed to its GitHub remote (a safety net independent of the pilot)
- Take a manual full backup (`tar` or a second clone on another disk) — the first cell migration is the riskiest single operation in the arc
- Identify **one real non-technical Alligators member** willing to be the Phase-6 timed invitee test subject (that's a human gate; it needs a human volunteer)

---

## Readiness gate

**Done ✅** — MCP plugins (cloudflare / stripe / vercel) installed + authorized; Vercel + GitHub access verified; D1 + Queues reachable; Stripe sandbox connected.

**Before Phase 1–4** (local work — no cloud accounts needed):
- [ ] `npm i -g wrangler` (Step 0)
- [ ] Alligators repo pushed + separately backed up (Step 7)

**Before Phase 5** (the cell):
- [ ] **1a** Workers Paid enabled ($5/mo) — *blocker: Containers refuse without it*
- [ ] **1b** R2 enabled in the dashboard — *blocker: R2 API returns 10042 without it*
- [ ] **1c** `cloud.maude.sh` delegated to Cloudflare (NS records from Vercel DNS)
- [ ] Human volunteer identified for the Phase-6 timed invitee test

**Before Phase 8** (money):
- [ ] Live Stripe account created + verified (sandbox is connected already), Stripe Tax + Customer Portal on
- [ ] `brew install stripe/stripe-cli/stripe`

**Before Phase 9–10** (launch):
- [ ] Legal pack drafted + lawyer-reviewed (Step 6)
- [ ] GitHub App registered, owner org decided (Step 3)
- [ ] Resend account + API key (Step 5)

Everything not on these lists — buckets, tokens, DNS records, D1 schemas, Queues, Workers, Containers, secrets, deployments — is agent work through MCP.
