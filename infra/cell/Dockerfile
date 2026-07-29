# Maude tenant cell — Cloud Phase 5 Task 2.
#
# One container per project: the hub plus the workspace agent, and NOTHING that
# can render or evaluate tenant-authored TSX (DDR-193 §2). Caddy is gone —
# TLS and routing are the Cloudflare edge now.
#
# THE CONTAINMENT INVARIANT IS AN IMAGE PROPERTY HERE, not just a runtime flag.
# A cell that merely *chooses* not to render is one config mistake away from
# rendering; a cell that has no browser in it cannot, whatever the config says.
# `check-containment.sh` enforces the dependency half in CI, and the entrypoint
# re-checks at boot so a hand-modified image also fails loud.
#
# Frozen install, same reasoning as apps/hub's (DDR-056-adjacent): this is the
# one component DDR-193 designates "untrusted to peers", so a fresh resolve at
# build time would let a poisoned transitive land in every tenant's cell.

FROM oven/bun:1-alpine AS deps
WORKDIR /build

# Hub dependencies, frozen against the committed lockfile.
COPY apps/hub/package.json apps/hub/bun.lock ./apps/hub/
RUN cd apps/hub && bun install --frozen-lockfile --production

FROM oven/bun:1-alpine AS runtime

# git is load-bearing: autosave IS git in a cell (DDR-195 §3).
# ca-certificates for R2/S3 over TLS. tini so SIGTERM reaches the app and the
# SQLite flush on stop actually runs — a container the platform migrates
# mid-write is the NORMAL path here, not an edge case.
RUN apk add --no-cache git ca-certificates tini

# Never root. A cell runs one tenant's data and nothing else needs privilege.
RUN addgroup -g 10001 maude && adduser -D -u 10001 -G maude maude

WORKDIR /app
COPY --from=deps /build/apps/hub/node_modules ./apps/hub/node_modules
COPY apps/hub ./apps/hub
# The ONE file the hub borrows from the studio: the append-only commit engine
# behind the server-side workspace agent (Cloud Phase 16). Same implementation
# the desktop runs, so a server-made commit and a desktop-made commit are
# indistinguishable in the log. The repo-shaped path is what makes the relative
# import in workspace-agent.mjs resolve here exactly as it does in a checkout.
#
# It is TS, and this stage runs Bun, which strips types on import. That is the
# only reason a single source is possible at all — a Node-only cell would need
# a twin, and a twin of the rules that decide what git does is not a twin worth
# having.
COPY apps/studio/sync/autocommit.ts ./apps/studio/sync/autocommit.ts
COPY infra/cell/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# The working set. Ephemeral by design — durability is replication to R2 plus
# rehydrate-on-boot (Phase 5 Task 1), which is the same code path as the
# restore drill and is therefore exercised on every single wake.
RUN mkdir -p /data /repo && chown -R maude:maude /data /repo /app
VOLUME ["/data", "/repo"]

USER maude

ENV NODE_ENV=production \
    DATA_DIR=/data \
    MAUDE_REPO_DIR=/repo \
    PORT=1234 \
    HUB_WORKSPACE_MODE=1 \
    MAUDE_WORKSPACE_MODE=1

EXPOSE 1234

# A cell that cannot answer /health is a cell the DO should not route to.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:1234/health || exit 1

ENTRYPOINT ["/sbin/tini", "--", "/app/entrypoint.sh"]
