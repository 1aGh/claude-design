# syntax=docker/dockerfile:1.7-labs
# Maude Hub — production image.
#
# Phase 9 Task 7; build context widened to the REPO ROOT in Cloud Phase 16:
#
#   docker build -t maude-hub -f apps/hub/Dockerfile .
#
# The context used to be apps/hub alone, which was tidier. It stopped being
# possible when the hub gained the server-side workspace agent: that agent
# drives the SAME `createAutoCommit` the desktop uses, and a second copy of the
# append-only commit rules is exactly the kind of duplication that ends with a
# server-made commit and a desktop-made commit behaving differently. So the
# bundler stage reaches one file out of apps/studio, and the stage layout below
# mirrors the repo so that relative import resolves identically in both places.
#
# Published as ghcr.io/1agh/maude-hub:vX.Y.Z + :latest on every release tag
# (amd64 + arm64 via buildx). Runtime is Node, NOT Bun: Hocuspocus' crossws
# adapter rejects Bun/Deno and better-sqlite3 is not Bun-compatible
# (DDR-052). Bun is only the bundler in the build stage.
#
# better-sqlite3 is a NATIVE module — its compiled .node binding is locked to a
# specific Node ABI. It CANNOT be built in the Bun stage: prebuild-install bails
# under Bun ("not yet supported in Bun", oven-sh/bun#4290) so it would source-
# compile against Bun's bundled Node (v24, ABI 137), which then fails to load in
# the node:20 runtime (ABI 115). So the native binding is compiled in a dedicated
# node:20 stage from the SAME frozen node_modules — `npm rebuild` recompiles the
# already-pinned source, it does NOT re-resolve the dep tree (the DDR-056 frozen-
# install guarantee holds: versions stay exactly what bun.lock pinned).

# ---- Stage 1: bundle src/server.mjs → dist/hub.bundle.mjs with Bun ----
FROM oven/bun:1 AS bundler
WORKDIR /build
# Frozen install against the COMMITTED bun.lock — the release image must NOT
# re-resolve dependencies at build time (caret ranges + fresh resolution on
# every release tag is a supply-chain hole: a poisoned transitive would land
# in the image every self-hoster pulls). --ignore-scripts skips better-sqlite3's
# postinstall (it would fail under Bun, and the bundler doesn't need the native
# binding — better-sqlite3 is `external` in build.ts). Hocuspocus + Yjs + ws are
# pure JS and inline into the bundle.
# Repo-shaped layout, so `../../studio/sync/autocommit.ts` resolves here exactly
# as it does in a working tree.
WORKDIR /build/apps/hub
COPY apps/hub/package.json apps/hub/bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts
COPY apps/hub ./
# The ONLY file the hub borrows from the studio: the append-only commit engine.
# Bun strips its types at bundle time, so the Node runtime stage never sees TS.
COPY apps/studio/sync/autocommit.ts /build/apps/studio/sync/autocommit.ts
# The mirror argv + push classifier, imported (never re-typed) by the cell's
# mirror lane. Its tests assert the ABSENCE of any force flag — absence being
# exactly what a later edit adds with nothing noticing — so a second copy here
# would be a copy without that guarantee.
COPY apps/cloud/mirror.mjs /build/apps/cloud/mirror.mjs
# Same rule, second file (Cloud Phase 25 D1): the design-sync decision module —
# which folder, which branch, the argv, and the tests that assert their base
# branch is never a push target. Re-typing it here would be re-typing exactly
# the guarantees those tests exist to hold.
COPY apps/cloud/design-sync.mjs /build/apps/cloud/design-sync.mjs
RUN bun run build.ts --release

# ---- Stage 2: compile the native better-sqlite3 binding for the node:20 ABI ----
FROM node:20-bookworm-slim AS native
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /build
# Carry the frozen-resolved node_modules from the bundler, then recompile ONLY
# better-sqlite3 against this stage's Node headers (ABI 115). --build-from-source
# forces node-gyp to compile the vendored, frozen C source instead of downloading
# an opaque prebuilt binary over the network — deterministic + supply-chain-tight.
# `npm rebuild <pkg>` never touches the dependency graph, so versions stay pinned.
COPY --from=bundler /build/apps/hub/node_modules ./node_modules
COPY --from=bundler /build/apps/hub/package.json ./package.json
RUN npm rebuild better-sqlite3 --build-from-source

# ---- Stage 2.5: the canvas build sandbox's own dependencies ----
#
# Cloud Phase 25 A1. The cell BUILDS a tenant's canvas (the viewer's browser
# evaluates it — that is the line DDR-193 §2 draws, and it is unmoved: no
# browser enters this image). The build runs the studio's OWN engine under Bun
# so the artifact is identical to the desktop's, which needs three things here:
# the engine's source, the two npm packages it parses with, and a Bun to run
# them. Nothing from this stage is on the server's own module path — the
# sandbox is a separate process with an empty environment.
FROM oven/bun:1 AS canvas-deps
WORKDIR /canvas
# oxc-parser + magic-string are the identity pass (data-cd-id injection); the
# rest of the engine's imports are the studio's own files, copied below.
# EXACT versions, matching apps/studio/package.json — the sandbox's parser is
# the desktop's parser, or the two produce different `data-cd-id`s and a
# comment anchored in the browser stops resolving in the app.
RUN echo '{"name":"maude-canvas-sandbox","private":true,"dependencies":{"magic-string":"0.30.21","oxc-parser":"0.139.0"}}' > package.json \
  && bun install --no-save

# ---- Stage 3: runtime ----
FROM node:20-bookworm-slim AS runtime
# git is load-bearing since Cloud Phase 16: in a workspace deployment autosave
# IS git (DDR-195 §3), and a hub without it keeps no history at all — which
# would also make "mirror to GitHub" a claim with nothing behind it.
#
# ca-certificates is load-bearing WITH it. Node carries its own CA bundle, so
# every fetch-based feature works without this and the omission looks harmless
# — but git uses the SYSTEM store, so `MAUDE_SEED_REPO` failed every clone with
# "server certificate verification failed. CAfile: none". Found by running the
# image, not by reading it.
RUN apt-get update \
  && apt-get install -y --no-install-recommends tini wget git ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# node_modules comes from the `native` stage (frozen versions + a node:20-ABI
# better-sqlite3 binding); the JS bundle + admin assets come from the bundler.
COPY --from=native /build/node_modules ./node_modules
COPY --from=bundler /build/apps/hub/dist ./dist

# ---- the canvas build sandbox (Cloud Phase 25 A1) ----
#
# A Bun to run the studio's engine with, the engine itself as SOURCE (Bun reads
# TypeScript natively — there is nothing to compile), its two parser deps, the
# workers that drive it, and the pre-built browser runtime bundles the shell's
# importmap points at. Staged under /canvas so the sandbox's file surface is
# one obvious directory rather than scattered through /app.
#
# CONTAINMENT IS UNTOUCHED: no browser enters this image, and the boot-time,
# build-time and CI assertions that say so are unmodified. A bundler is not a
# renderer — the cell parses and transforms; the viewer's browser is what
# evaluates (DDR-193 §2 / Phase 25 A0).
COPY --from=bundler /usr/local/bin/bun /usr/local/bin/bun
COPY --from=canvas-deps /canvas/node_modules /canvas/node_modules
# ONLY the engine's own source. The whole tree was staged here first, and the
# resulting image could not COLD-START on Cloudflare Containers at all: the
# Durable Object reported the container crashed ~13 s before the hub bound its
# port and never re-checked, so a project whose disk had merely been moved
# became permanently unreachable (2026-08-03, three hours down).
#
# What is excluded is everything the sandbox never reads: pre-built bundles
# (dist/runtime is staged separately below), sample media, sticker packs, the
# browser client, tests and e2e. A cell parses canvases; it does not ship the
# studio.
COPY --exclude=dist --exclude=media --exclude=stickers --exclude=test \
     --exclude=e2e --exclude=client --exclude=node_modules \
     apps/studio /canvas/studio
COPY apps/hub/src/canvas/build-worker.ts apps/hub/src/canvas/edit-worker.ts /canvas/workers/
COPY apps/studio/dist/runtime /app/dist/canvas-runtime
# The engine resolves `magic-string` / `oxc-parser` from the nearest
# node_modules; /canvas/studio sits directly under /canvas, so the staged
# modules are on its resolution path without a second install.
ENV MAUDE_BUN_PATH=/usr/local/bin/bun \
    MAUDE_STUDIO_SRC=/canvas/studio \
    MAUDE_CANVAS_WORKERS=/canvas/workers \
    MAUDE_CANVAS_RUNTIME_DIR=/app/dist/canvas-runtime
# The container runs as the unprivileged `node` user, but a fresh named volume
# mounted at /data is initialized from the image's /data ownership. Create it
# node-owned BEFORE declaring VOLUME (post-VOLUME filesystem changes are
# discarded), so the SQLite db + bootstrap.json are writable at runtime.
# Both mount points must exist and be node-owned BEFORE the VOLUME
# declaration — post-VOLUME filesystem changes are discarded, and a fresh named
# volume inherits the image's ownership. Getting this wrong for /repo made the
# first real container crash-loop on `EACCES: mkdir /repo/.design`, because a
# volume Docker creates for an undeclared path lands as root.
RUN mkdir -p /data /repo && chown node:node /data /repo
VOLUME ["/data", "/repo"]
ENV PORT=1234 \
    DATA_DIR=/data \
    MAUDE_REPO_DIR=/repo \
    NODE_ENV=production
EXPOSE 1234
# /health is an unauthenticated GET (see src/server.mjs onRequest). TLS
# terminates upstream, so the in-container probe stays plain HTTP on loopback.
HEALTHCHECK --interval=30s --timeout=3s --start-period=8s --retries=3 \
  CMD wget -qO- http://localhost:1234/health > /dev/null 2>&1 || exit 1
USER node
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/hub.bundle.mjs"]
