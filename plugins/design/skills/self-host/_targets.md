# Per-target facts

A workspace is **one stateful container with two volumes** (`/data` and
`/repo`). Almost everything below follows from that.

## Laptop trial

```sh
maude hub workspace-up --local --dev-minio \
  --domain localhost --admin-email you@example.com
```

No domain, no certificate, no account anywhere — and every verification step
still runs against a real workspace. **Testing only:** local mode serves plain
HTTP, so a sign-in password would travel in the clear. Never point a colleague
at one.

## VPS with Docker (Hetzner, DigitalOcean, Vultr, Linode)

The universal path and the cheapest real one. Any $4–6/mo box: install Docker,
take the emitted `docker-compose.yml` + `Caddyfile`, point DNS at it, bring it
up. Caddy handles TLS automatically.

## AWS EC2

Two AWS defaults break a workspace. Both are the first thing an AWS-shaped
instinct reaches for, so name them before they choose.

- **Not Fargate.** Its storage is ephemeral, so `/repo` starts empty on every
  task and the hub refuses to start. Use the EC2 launch type, or run Docker on
  the instance.
- **Not EFS for `/data`.** Yjs persistence is small-write-heavy; SQLite over
  NFS is the wrong shape. Use a **gp3 EBS** volume.

Then:

- `t4g.small` (arm64) is comfortable. **One instance, no autoscaling** — the
  hub is single-process and stateful, so two over one volume is a corrupt
  database rather than double capacity. Deployment `minimumHealthyPercent: 0`.
- EBS with **`DeleteOnTermination=false`**. That flag is the difference between
  replacing an instance and losing a project.
- An **ALB** with an ACM certificate upgrades WebSockets natively, so Caddy is
  optional. Raise the idle timeout well above the default — sync sockets are
  long-lived.
- **DLM snapshots** of the volume as an independent second layer.
- **IMDSv2 required** (`HttpTokens=required`, hop limit 1) — especially if OIDC
  is configured.

Full runbook: <https://maude.sh/docs/hub/aws>.

## Another Docker host (Coolify, a home server, anything)

The image is just a Docker app: `ghcr.io/1agh/maude-hub`. Set `HUB_SECRET` and
`HUB_PUBLIC_URL`, mount `/data` and `/repo`, terminate TLS in front of it.

One caveat worth saying out loud on hand-rolled hosts: **use named volumes or
real mounts for both paths**. A bind mount that silently is not there means an
empty `/repo`, and the hub will refuse to start rather than guess — which is
the right behaviour but confusing if you did not expect it.
