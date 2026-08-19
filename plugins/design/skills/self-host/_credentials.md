# Credential inventory

What each one is, where it comes from, what it can do, where it ends up, and
how to rotate it. **Never print a secret back into the conversation.**

Everything except the OIDC client secret is generated or chosen at setup time;
nothing here requires an account with us.

| Credential | Where it comes from | What it can do | Where it lands | Rotating it |
| --- | --- | --- | --- | --- |
| `HUB_SECRET` | generated (`openssl rand -hex 32`) | **The operator credential.** Full admin API, and a wildcard peer token. | `.env`, mode 0600 | `maude hub workspace-up` again reuses it deliberately; to change it, edit `.env` and restart — every existing peer token stops working. Rotate when someone leaves. |
| Admin email + password | you choose | the first account that can sign in | `.env` (seeds the account on first boot only) | change it in People; the `.env` value is never re-read once an account exists |
| ACME email | you choose | Let's Encrypt expiry notices | `.env`, the Caddyfile | edit and restart |
| S3 access key + secret | your cloud provider (IAM user for AWS, API token for R2) | **The real blast radius.** Read/write/delete on the bucket. | `.env`, mode 0600 | issue a new pair, update `.env`, restart. Scope it to one bucket — see the policy in [On AWS](https://maude.sh/docs/hub/aws). |
| OIDC client id | your identity provider | not secret; identifies the app | `.env` | — |
| OIDC client secret | your identity provider | completes the code exchange as this app | `.env`, mode 0600 | rotate at the provider, update `.env`, restart |
| Peer tokens | minted in the console | sync as one peer | hashed at rest; the raw value is shown once | `maude hub token rotate` |
| Invite links | minted in the console | redeemed **once**, then expire | hashed at rest | revoke in People |

## What the hub stores versus holds

- **Stored, hashed:** peer tokens and invite links (HMAC-SHA256), account
  passwords (scrypt). A copy of the database yields no usable credential.
- **Held in memory from the environment:** `HUB_SECRET`, the S3 pair, the OIDC
  client secret. They live in `.env` at mode 0600 on the host — treat that file
  as the thing worth protecting.
- **Never stored at all:** the OIDC code verifier, and any token minted by the
  identity provider beyond the moment it is verified.

## If you only harden one thing

The S3 pair. Least-privilege it to a single bucket, and put **no lifecycle rule
on the `assets/` prefix** — an expired object is a permanently broken canvas
with no recovery path.
