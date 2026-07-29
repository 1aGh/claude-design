# Maude tenant cell — Cloud Phase 5 Task 2, rebuilt in Cloud Phase 15.
#
# A CELL IS THE SAME SERVER AS THE HUB (DDR-195), so it is now literally the
# same image plus the things that make it a tenant: a boot-time containment
# assertion, R2 rehydrate, and tenant scoping.
#
# It used to be an independent `oven/bun:1-alpine` build with its own frozen
# install. That image had never been built, and could not be: `better-sqlite3`
# is not Bun-compatible (DDR-052 — the reason the hub runtime is Node), so its
# install script failed under Bun and would have failed to LOAD even if it had
# compiled. Deriving from the hub image removes the second dependency tree
# entirely, which also removes the class of bug where a cell and a hub disagree
# about what they are running.
#
#   docker build --build-arg HUB_IMAGE=<hub tag> -f infra/cell/Dockerfile .
#
# CI builds the hub first and passes the tag it just pushed.
ARG HUB_IMAGE=ghcr.io/1agh/maude-hub:latest

FROM ${HUB_IMAGE} AS runtime

USER root

# git: autosave IS git in a cell (DDR-195 §3) — inherited from the hub image
# since Cloud Phase 16, asserted here so a hub image that loses it fails the
# cell build rather than the tenant's history.
RUN command -v git >/dev/null || (echo "cell: the hub image has no git" >&2; exit 1)

# THE CONTAINMENT INVARIANT IS AN IMAGE PROPERTY (DDR-193 §2).
#
# A cell that merely *chooses* not to render tenant TSX is one config mistake
# away from rendering it; a cell with no browser in it cannot, whatever the
# config says. CI enforces the dependency half at review time, the entrypoint
# re-checks at boot so a hand-modified image also fails loud, and this asserts
# it at BUILD time so a bad base image never becomes an artifact.
#
# The names live in the script, not here: the CI gate refuses ANY Dockerfile
# whose RUN/COPY/ADD lines mention a browser and cannot distinguish an install
# from an assertion. Keeping this file free of them means that gate never needs
# an exception — and a guard that had to be loosened once gets loosened again.
COPY infra/cell/assert-containment.sh /tmp/assert-containment.sh
RUN sh /tmp/assert-containment.sh && rm /tmp/assert-containment.sh

COPY infra/cell/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# The working set. Ephemeral by design — durability is replication to R2 plus
# rehydrate-on-boot, which is the same code path as the restore drill and is
# therefore exercised on every single wake rather than once a quarter.
#
# Ownership before VOLUME: post-VOLUME filesystem changes are discarded, and a
# fresh named volume inherits the image's ownership. Getting this wrong for
# /repo crash-looped the hub on `EACCES` during Phase 16.
RUN mkdir -p /data /repo && chown -R node:node /data /repo
VOLUME ["/data", "/repo"]

USER node

ENV NODE_ENV=production \
    DATA_DIR=/data \
    MAUDE_REPO_DIR=/repo \
    PORT=1234 \
    HUB_WORKSPACE_MODE=1 \
    MAUDE_WORKSPACE_MODE=1

EXPOSE 1234

# A cell that cannot answer /health is a cell the router should not send to.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:1234/health > /dev/null 2>&1 || exit 1

ENTRYPOINT ["/usr/bin/tini", "--", "/app/entrypoint.sh"]
