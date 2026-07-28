---
name: hub-workspace
category: hub
description: Stand up a self-hosted Maude workspace — a hub that owns the project, commits autosaves, and stores media in object storage — and verify it works before saying it does
argument-hint: "[--dry-run] [--domain HOST] [--config FILE]"
---

# /design:hub-workspace — stand up a self-hosted workspace

Conversational wrapper over **`maude hub workspace-up`** (DDR-062 — plugins reach executable logic through `maude`, never a raw script path). Your job is to gather what the engine needs, run it, and read the result back honestly.

**Self-hosting stays first-class.** This is the same stack Maude Cloud runs; the only difference is who operates it. Never steer someone toward a hosted plan here, and never describe self-hosting as the lesser path.

## What a "workspace" is, in one sentence

A hub that **owns the project**: it holds the authoritative checkout, turns autosave into append-only git commits attributed to whoever made the edit, and keeps heavy media in object storage instead of git. Teammates sign in with an email and password and get the project — no tokens to paste, no git.

That is different from a plain hub (`maude hub deploy`), which relays documents between peers who each own their own copy. If the user just wants two designers on one Mac to collaborate, a plain hub is the smaller, correct answer — say so.

## Step 1 — find out what they have

Ask only what you cannot infer. In plain words, never jargon:

1. **The address people will use** — a hostname they control DNS for, pointed at the box (`design.acme.com`). Not optional: TLS needs it.
2. **An email for certificate notices.**
3. **Who signs in first** — their email, and optionally a password (one is generated if not).
4. **Where media goes** — an S3-compatible bucket (Cloudflare R2, MinIO, AWS S3): endpoint, bucket, key, secret. If they have none yet, say what it buys (media stops bloating every clone) and that they can add it later. `--dev-minio` runs a throwaway MinIO for trying it locally — say plainly that it is for testing, not production.
5. **Start fresh or from an existing project** — a git URL, or nothing.

If the user has this in a file already, `--config <file>.json` takes all of it.

## Step 2 — dry run first, always

```sh
maude hub workspace-up --dry-run --domain <host> --acme-email <email> --admin-email <email> [--s3-endpoint … --s3-bucket … --s3-access-key-id … --s3-secret-access-key …] [--seed-repo <url>]
```

Show the user what it would write and what it would verify. This is the moment a wrong domain or a bucket typo is cheap. Every configuration problem is reported at once, so fix them together rather than one round-trip per mistake.

## Step 3 — run it

Same command without `--dry-run`. It writes `docker-compose.yml`, `Caddyfile`, and `.env` (mode 0600 — it holds two secrets), boots the stack, and then **verifies**: the workspace answers, the operator credential works, the first person can sign in, a canvas survives a round trip, autosave produced a commit, media reaches the bucket and nothing will expire it, and a backup can actually be restored.

**Report the verification honestly.** A step that could not be automated prints as skipped, not passed — if you see one, say it is unverified and needs a hand check. Never summarize a partially-verified run as "done".

If Docker isn't installed, the command writes the files, says nothing was verified, and exits non-zero. Relay that as-is: they have a rendered deployment, not a working one.

## Step 4 — hand over the duties, don't claim ownership

The run ends with a list of what stays theirs: rotating `HUB_SECRET`, scheduling `maude hub restore-drill` (a backup nobody has restored is a hypothesis), pinning the image tag off `latest`, upgrades, the bill, and — if they configured object storage — **never putting a lifecycle/expiry rule on the `assets/` prefix**, because a canvas in git history can reference media no current canvas does.

Read that list back. Do not compress it into "you're all set" — this command scaffolded and verified a deployment once; it does not operate it, and implying otherwise is how someone discovers in six months that nobody was watching the backups.

## Re-running

Re-running **is** the upgrade path. Files are regenerated; secrets already in `.env` are reused. That last part matters: re-minting `HUB_SECRET` would lock out every peer that already has a token, and re-running is exactly what someone does after a failed attempt.

## Notes

- Everything executable lives in `maude hub workspace-up`; this command gathers input and interprets output. Don't reimplement the rendering or the checks here.
- The stack runs with the containment invariant on (`MAUDE_WORKSPACE_MODE=1`): the workspace stores and syncs canvases, and never renders or executes them. If the user asks why they can't export from the server, that is the reason — exports happen on their own machine.
- `maude hub asset-check` afterwards proves every asset reference resolves. Worth mentioning once the bucket is live.
