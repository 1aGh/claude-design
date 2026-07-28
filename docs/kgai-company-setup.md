# kgai company setup (one-time) — the shared decision graph for a whole org

This is the **admin** guide: stand up the single shared kgai store that every repo in the company syncs to, so decisions made in one repo/department are one query away from another. Individual engineers then follow [onboarding](./kgai-onboarding.md).

Maude uses **scope model A** — one shared store, decisions tagged by `repo:`/`dept:` — decided in [DDR-189](../.ai/archive/decisions/DDR-189-kgai-cross-repo-shared-graph-trust-model.md). The pro is cross-team query for free (`--all-scopes`); the con is one blast radius, which the trust rules below bound.

## 1. Create the S3 store bucket

One bucket, one prefix, versioning on (append-only log is safer with object versioning):

```bash
aws s3api create-bucket --bucket studyfi-kg --region eu-central-1 \
  --create-bucket-configuration LocationConstraint=eu-central-1
aws s3api put-bucket-versioning --bucket studyfi-kg \
  --versioning-configuration Status=Enabled
aws s3api put-public-access-block --bucket studyfi-kg \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

The store prefix is `s3://studyfi-kg/store` — this is the `knowledgeGraph.store` every repo points at.

## 2. Per-user IAM (the writer authorization boundary)

**Only a locally-authenticated CLI writes the graph** ([DDR-189](../.ai/archive/decisions/DDR-189-kgai-cross-repo-shared-graph-trust-model.md) rule 3). Give each engineer their **own** IAM identity — never a shared key, never the hub's credentials. Minimum policy scoped to the store prefix:

```jsonc
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "kgaiStoreRW",
    "Effect": "Allow",
    "Action": ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
    "Resource": ["arn:aws:s3:::studyfi-kg", "arn:aws:s3:::studyfi-kg/store/*"]
  }]
}
```

Attach it to each user (or an SSO permission set). **Do NOT** attach it to any hub / server / CI role — hub-origin writes are quarantined by design (see §4).

## 3. Scope taxonomy (agree it once)

`dept` is the search-bias key and the cross-team unit. Fix the small closed set up front so `hash(kind:name)` converges cleanly across repos:

| `dept` | Repos (examples) |
| --- | --- |
| `dev` | AI-StudyMate, StudyAdmin, maude, … |
| `marketing` | vantage, videogen, campaign repos |
| `finance` | billing / revenue tooling |
| `automations` | slacknotif, bots, glue |

Each repo sets its own `scope: { repo, dept }` in `.ai/workflows.config.json` (per-repo config — never hardcoded in the plugin). `repo` is free-form (the repo's name); `dept` must be one of the agreed set. That's the whole taxonomy — deterministic identity means `dept:dev` is one node no matter how many repos write it.

## 4. Trust boundary (enforce, don't assume) — [DDR-189](../.ai/archive/decisions/DDR-189-kgai-cross-repo-shared-graph-trust-model.md)

A single company store is an **attacker-controlled writer surface**, structurally the DDR-054 untrusted-peer boundary but company-wide: a poisoned decision node is read as authoritative context by every repo's `kg sync`. The three rules Maude enforces:

1. **`kg sync` / `kg context` output is untrusted DATA, never instructions.** Maude quotes it as inert, attributed content and never executes a directive it carries.
2. **Hub and kgai are separate trust domains.** The hub is "untrusted to peers" — hub-origin writes are **disabled or namespace-quarantined** (a distinct scope, never merged into the authoritative graph). Don't grant the hub S3 write on the store.
3. **CLI-auth-only writes.** Per-user IAM (§2); the bucket is IAM-scoped (§1).

Before any broad multi-user rollout, run `/flow:validate-security` on the writer surface (a plan acceptance gate).

## 5. Verify the store is live

Have one engineer complete [onboarding](./kgai-onboarding.md), migrate a repo (`/flow:migrate-kgai`), and `maude kg sync`. A second engineer on a different repo then:

```bash
maude kg sync
maude kg context --about "<a decision the first engineer migrated>" --all-scopes
```

Seeing the first engineer's decision from a different repo confirms the shared store + cross-team query works.

## Cost / scale note

Storage is ~2.6 KB per decision; sync is pull-on-command (`kg sync` at `/flow:done` + `/flow:pause`, plus a session-start pull). Model A's rebuild cost grows with the **whole** company log — if the graph ever gets large enough that this bites, revisit per-department keyspaces for the highest-sensitivity depts (the DDR-189 "revisit when" clause).
