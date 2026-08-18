#!/bin/sh
# Maude tenant cell entrypoint — Cloud Phase 5 Task 2/3.
#
# Order matters and is the whole design:
#
#   1. ASSERT CONTAINMENT before anything starts. A cell that boots and only
#      then discovers it shipped a browser has already been reachable.
#   2. REHYDRATE from R2. Container disk is ephemeral and the platform can
#      migrate an instance at any time, so this is the normal path, not
#      recovery. It is the same code as the restore drill, which means the
#      restore path is exercised on every wake instead of once a quarter.
#   3. START, and flush cleanly on SIGTERM.
#
# Fails loud, never partial: a cell that starts without its data would look
# like an empty project, and an empty project is indistinguishable from a
# deleted one to the person looking at it.
set -eu

log() { echo "[cell] $*"; }
die() { echo "[cell] FATAL: $*" >&2; exit 1; }

# ---------------------------------------------------------------- 1. contain
#
# The image should not contain a browser at all (see Dockerfile + the CI gate),
# but an image can be hand-modified and a base image can change under us. This
# is the cheap, unavoidable re-check.
for forbidden in playwright playwright-core puppeteer puppeteer-core; do
  if [ -d "/app/node_modules/$forbidden" ]; then
    die "containment: /app/node_modules/$forbidden is present.
      A cell must never be able to render tenant-authored TSX (DDR-193 §2).
      Refusing to start — a cell that CAN render is one import() from doing it."
  fi
done
for bin in chromium chromium-browser google-chrome firefox; do
  if command -v "$bin" >/dev/null 2>&1; then
    die "containment: a browser ($bin) is on PATH inside this cell (DDR-193 §2)."
  fi
done
log "containment ok — no browser, no renderer"

# NB: no apostrophe in the :? message — inside ${VAR:?word} the word is subject
# to expansion, and a lone quote there is a parse error the shell reports as an
# unexpected EOF hundreds of lines later.
if [ -z "${MAUDE_TENANT_ID:-}" ]; then
  die "MAUDE_TENANT_ID is required — it scopes this cell to its own R2 prefix"
fi
case "$MAUDE_TENANT_ID" in
  # The tenant id becomes an R2 key prefix. A traversal or wildcard here would
  # let one cell read or overwrite another tenant's data — the single worst
  # failure this system can have.
  *[!a-z0-9-]* | "" | -* | *- )
    die "MAUDE_TENANT_ID must be lowercase alphanumeric with inner hyphens (got: $MAUDE_TENANT_ID)" ;;
esac
PREFIX="tenants/${MAUDE_TENANT_ID}"
REPO_DIR="${MAUDE_REPO_DIR:-/repo}"
# EXPORTED, not just passed to rehydrate. The server takes the scheduled
# backups, so a prefix visible only to the restore half means every cell writes
# its generations to the same unscoped keys — each tenant's backup silently
# overwriting the last, and a later rehydrate restoring one tenant's cell from
# another tenant's documents. That is the single worst failure this system can
# have, and it was one missing `export` away the whole time.
export MAUDE_BACKUP_PREFIX="$PREFIX"
# Media is scoped the same way, and for a sharper reason: since Cloud Phase 15
# an asset key can be a design system's own authored path (graphics/camo-bg.png)
# rather than a content hash. Two tenants both have one of those, and an
# unscoped namespace means the second cell to boot overwrites the first one's
# brand. Content-addressed keys were collision-proof by construction; named
# ones are not.
export MAUDE_TENANT_PREFIX="$PREFIX"
log "tenant ${MAUDE_TENANT_ID} — R2 prefix ${PREFIX}"

# -------------------------------------------------------------- 2. rehydrate
if [ -n "${MAUDE_S3_BUCKET:-}" ]; then
  # THE WARM/COLD TEST USED TO LIVE HERE, and it was `[ -f /data/hub.db ]`.
  # That holds for a cell, which has one volume. A workspace has TWO, and
  # `/data` intact with `/repo` lost satisfies it — so rehydrate was skipped,
  # boot continued, and `seedRepo` cloned over a checkout that had merely gone
  # missing. Green boot, silent history loss (Phase 0 F4).
  #
  # The decision now lives in `rehydrate.mjs`, which both this entrypoint and
  # the self-hosted Docker one call unconditionally. One table, two callers,
  # and no second spelling of "is this a cold start" to drift against.
  log "resolving boot state against ${MAUDE_S3_BUCKET}/${PREFIX}"
  if ! node /app/dist/rehydrate.mjs --data /data --repo "$REPO_DIR"; then
    # A cell that starts empty after a failed rehydrate looks EXACTLY like a
    # brand-new project to the person opening it, and the autosave agent would
    # then happily commit that emptiness over their work. Refusing is the only
    # safe answer.
    die "rehydrate failed. Refusing to start with an empty working set —
    an empty project is indistinguishable from a deleted one, and autosave
    would commit the emptiness over real work."
  fi
else
  log "no object storage configured — local-only cell (development)"
fi

# ------------------------------------------------------------------ 3. serve
#
# tini forwards SIGTERM here. The hub owns its own signal handling (Cloud Phase
# 16 — stopOnSignals:false) and flushes the pending autosave commit before it
# destroys the server, which is what makes a platform-initiated
# migration lossless rather than merely usually-lossless.
# Defaulted so the script is runnable (and its guards testable) outside the
# image, where the Dockerfile ENV is not in scope.
PORT="${PORT:-1234}"
# ---------------------------------------------------- 3a. outbound ingress
#
# With MAUDE_TUNNEL_TOKEN set, requests reach this cell through a named
# Cloudflare Tunnel the control plane provisioned — the cell dials OUT, so
# the platform's DO→port link is not on the user-facing path. The tunnel is
# supervision-light on purpose: if cloudflared dies the hub keeps running,
# and the router's health probe (over the tunnel) is what notices.
if [ -n "${MAUDE_TUNNEL_TOKEN:-}" ]; then
  log "starting cloudflared tunnel (outbound ingress)"
  (while :; do
     cloudflared tunnel --no-autoupdate run --token "$MAUDE_TUNNEL_TOKEN" 2>&1 | sed 's/^/[tunnel] /'
     echo "[cell] cloudflared exited; restarting in 3s"
     sleep 3
   done) &
fi

log "starting hub on :${PORT}"
exec node /app/dist/hub.bundle.mjs
