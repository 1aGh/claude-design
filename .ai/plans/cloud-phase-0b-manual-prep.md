# Cloud Phase 0b — Manual prep checklist (do this BEFORE `/flow:execute` on any phase)

Everything a human must do by hand — accounts, logins, tokens, tooling, MCP wiring — so the phase executions run smoothly and agent-driven. Companion to `cloud-phase-0-economics-and-architecture.md`. **Not executable by an agent** (browser signups, payment details, OAuth consent, legal identity).

Rule of thumb: agents get **scoped API tokens, never account passwords**, and every secret goes into a 0600 file or a platform secret store — never into the repo, never into a plan file, never pasted into chat.

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

## Step 1 — Cloudflare account (Phases 5, 7 — the big one)

1. **Sign up / sign in** at <https://dash.cloudflare.com> with the account that should *own the business* (use `michal@…` you'll keep long-term, ideally a shared/ops address, not a personal alias — you cannot easily transfer ownership later).
2. **Enable Workers Paid ($5/mo)** — Workers → Plans. Required for: Durable Objects, Containers, Queues, and D1 beyond free limits.
3. **Add the domain** `maude.sh` to Cloudflare (Websites → Add a site) **or**, if you want to keep the apex DNS where it is, delegate just the subdomain: create a zone for `cloud.maude.sh` and point `NS` records at Cloudflare from your current DNS. The arc only needs `*.cloud.maude.sh`.
   - Keep the apex `maude.sh` (docs site on Vercel) untouched until the optional Phase-10 migration.
4. **Create an R2 bucket** — R2 → Create bucket → name `maude-cloud` (or `maude-tenants`), location hint **EU**. Note: R2 has zero egress fees; leave lifecycle rules OFF (the `assets/` prefix must never expire — Phase 3 relies on it).
5. **Create an R2 API token** — R2 → Manage API tokens → *Object Read & Write*, scoped **to that bucket only**. Save `Access Key ID`, `Secret Access Key`, and the S3 endpoint `https://<accountid>.r2.cloudflarestorage.com`.
6. **Create a Cloudflare API token for automation** — My Profile → API Tokens → Create Token → *Custom token* with:
   - `Account · Workers Scripts · Edit`
   - `Account · Workers R2 Storage · Edit`
   - `Account · D1 · Edit`
   - `Account · Cloudflare Containers · Edit` (name may differ — pick the Containers/Sandboxes permission)
   - `Zone · DNS · Edit` (limited to the `cloud.maude.sh` zone)
   - Save the token; note your **Account ID** (dashboard right sidebar).
7. **`wrangler login`** in the terminal (OAuth in the browser) — that covers interactive work; the API token above is for CI/control-plane automation.

**Where the secrets go:** create `~/.config/maude/cloud.env` with mode 0600 (the DDR-164 custody shape; the phase code reads it, it never enters the repo):

```sh
mkdir -p ~/.config/maude && touch ~/.config/maude/cloud.env && chmod 600 ~/.config/maude/cloud.env
# contents:
# CLOUDFLARE_ACCOUNT_ID=...
# CLOUDFLARE_API_TOKEN=...
# R2_ACCESS_KEY_ID=...
# R2_SECRET_ACCESS_KEY=...
# R2_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
# R2_BUCKET=maude-cloud
```

---

## Step 2 — MCP servers (this is the "drive it via MCP" part)

Cloudflare runs **official remote MCP servers** with OAuth sign-in — no tokens pasted into config. Add the three that matter for this arc (project-scoped, so they live with the repo):

```sh
cd ~/git/claude-design
claude mcp add --transport http --scope project cf-bindings   https://bindings.mcp.cloudflare.com/mcp
claude mcp add --transport http --scope project cf-docs       https://docs.mcp.cloudflare.com/mcp
claude mcp add --transport http --scope project cf-observability https://observability.mcp.cloudflare.com/mcp
# then in a Claude Code session: /mcp  → authenticate each (browser OAuth consent)
```

- **cf-bindings** — create/read D1, R2, KV, Workers resources while building (Phases 5, 7)
- **cf-docs** — authoritative, current Cloudflare docs in-context; important because Containers GA is recent and my training data may lag
- **cf-observability** — logs/analytics when debugging a cell or the reconciler (Phases 5, 9)

Optional later: `https://graphql.mcp.cloudflare.com/mcp` (cost/usage roll-up for the Phase-9 health board), `https://builds.mcp.cloudflare.com/mcp`.

**Stripe MCP** — add at Phase 8, not now, and **in test mode first**:

```sh
claude mcp add --transport http --scope project stripe https://mcp.stripe.com   # OAuth
# or local: npx -y @stripe/mcp --tools=all --api-key=rk_test_…  (restricted key)
```

Use a **restricted key** (`rk_…`), read-only scopes to start, add write scopes only where a phase needs them. Never give an agent your live secret key (`sk_live_…`).

**Already configured on this machine:** `context7` (library docs) ✅, `productivity-stack` ✅. Nothing to change there.

**Optional plugin:** `/plugin marketplace add cloudflare/skills` — Cloudflare's own Claude Code skills; low cost, adds platform-specific guidance.

---

## Step 3 — GitHub (Phase 10, but the App can be registered early)

1. Decide the **owner org** for the Maude GitHub App — your `1aGh` account or a dedicated `maude` org. A dedicated org is cleaner for a commercial product (transferable, separate from personal repos).
2. Register the App: GitHub → Settings → Developer settings → GitHub Apps → New. Permissions: `Contents: Read & write`, `Metadata: Read`. Where can it be installed: **Any account**. Save the App ID + generate a private key (`.pem`) — store outside the repo, 0600.
3. `gh auth status` — already signed in on this machine ✅ (note: the `1aGh` account is the one with repo permissions, per the merge-mechanics memory).

---

## Step 4 — Stripe (Phase 8; account creation can happen now, it takes days to verify)

1. Create the account at <https://dashboard.stripe.com/register> under the **legal entity that will invoice** (your IČO / company). Verification (identity + bank) can take a few days — start early even though the phase is far out.
2. Enable **Stripe Tax** (Settings → Tax) and set the origin address; EU VAT + reverse-charge for CZ B2B depends on it.
3. Enable the **Customer Portal** (Settings → Billing → Customer portal) — no billing UI to build.
4. Keys: use **restricted keys** for automation; the live secret key stays in the control-plane secret store (Worker secret), never on your laptop's shell history.
5. Optional but recommended for the Czech invoice question: check with your accountant whether Stripe invoices satisfy your bookkeeping, or whether you need Fakturoid/iDoklad reconciliation. This is a **Phase-8 decision input**, not code.

---

## Step 5 — E-mail sending (Phase 6–7)

1. Create a **Resend** account (<https://resend.com>) — free tier covers the pilot.
2. Verify the sending domain (`maude.sh` or `mail.maude.sh`) — add the DKIM/SPF records; if the zone is already on Cloudflare (Step 1.3) this is two clicks.
3. Create an API key, save to `~/.config/maude/cloud.env` as `RESEND_API_KEY=…`.

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

## Readiness gate — you can start `execute` when:

- [ ] `wrangler --version` works and `wrangler whoami` shows your account
- [ ] `~/.config/maude/cloud.env` exists, mode 0600, with account ID + API token + R2 credentials
- [ ] `cloud.maude.sh` resolves through Cloudflare (zone active)
- [ ] R2 bucket exists (EU hint, no lifecycle rules)
- [ ] `cf-bindings`, `cf-docs`, `cf-observability` MCP servers authenticated (`/mcp` shows them connected)
- [ ] Alligators repo pushed + separately backed up
- [ ] Stripe account created (verification can still be pending — only Phase 8 needs it live)

Phases 1–4 need **none** of the cloud accounts — they're local/self-host work. If you want to start today, Steps 0 + 7 are enough to begin `cloud-phase-1-safety-gates.md`; do Steps 1–2 before Phase 5.
