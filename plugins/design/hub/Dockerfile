# Maude Hub — production image.
#
# Phase 9 Task 7. Build context is the hub package itself (self-contained — no
# monorepo COPY), so `docker build` works from a published checkout OR the
# multi-arch release pipeline:
#
#   docker build -t maude-hub plugins/design/hub
#
# Published as ghcr.io/1agh/maude-hub:vX.Y.Z + :latest on every release tag
# (amd64 + arm64 via buildx). Runtime is Node, NOT Bun: Hocuspocus' crossws
# adapter rejects Bun/Deno and better-sqlite3 is not Bun-compatible
# (DDR-052). Bun is only the bundler in the build stage.

# ---- Stage 1: bundle src/server.mjs → dist/hub.bundle.mjs with Bun ----
FROM oven/bun:1 AS builder
WORKDIR /build
# Frozen install against the COMMITTED bun.lock — the release image must NOT
# re-resolve dependencies at build time (caret ranges + fresh resolution on
# every release tag is a supply-chain hole: a poisoned transitive would land
# in the image every self-hoster pulls). Hocuspocus + Yjs + ws inline into the
# bundle; better-sqlite3 stays external (see build.ts) and is carried into the
# runtime stage from THIS frozen node_modules — no second fresh install.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build.ts --release

# ---- Stage 2: runtime ----
FROM node:20-bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends tini wget \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# Carry the frozen-resolved node_modules from the builder (it holds the
# better-sqlite3 native binding the bundle requires at runtime — the only
# external dep). Copying instead of re-installing means the runtime deps are
# exactly what bun.lock pinned + the builder verified — zero build-time
# resolution, on either stage.
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/dist ./dist
VOLUME ["/data"]
ENV PORT=1234 \
    DATA_DIR=/data \
    NODE_ENV=production
EXPOSE 1234
# /health is an unauthenticated GET (see src/server.mjs onRequest). TLS
# terminates upstream, so the in-container probe stays plain HTTP on loopback.
HEALTHCHECK --interval=30s --timeout=3s --start-period=8s --retries=3 \
  CMD wget -qO- http://localhost:1234/health > /dev/null 2>&1 || exit 1
USER node
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/hub.bundle.mjs"]
