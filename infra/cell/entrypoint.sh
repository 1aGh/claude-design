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
  if [ -d "/app/apps/hub/node_modules/$forbidden" ]; then
    die "containment: /app/apps/hub/node_modules/$forbidden is present.
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
log "tenant ${MAUDE_TENANT_ID} — R2 prefix ${PREFIX}"

# -------------------------------------------------------------- 2. rehydrate
if [ -n "${MAUDE_S3_BUCKET:-}" ]; then
  if [ -f /data/hub.db ]; then
    log "working set already present — warm start, skipping rehydrate"
  else
    log "cold start — rehydrating from ${MAUDE_S3_BUCKET}/${PREFIX}"
    if ! MAUDE_BACKUP_PREFIX="$PREFIX" \
         bun /app/apps/hub/src/rehydrate.mjs --data /data --repo /repo; then
      # A cell that starts empty after a failed rehydrate looks EXACTLY like a
      # brand-new project to the person opening it, and the autosave agent would
      # then happily commit that emptiness over their work. Refusing is the only
      # safe answer.
      die "rehydrate failed. Refusing to start with an empty working set —
      an empty project is indistinguishable from a deleted one, and autosave
      would commit the emptiness over real work."
    fi
    log "rehydrate complete"
  fi
else
  log "no object storage configured — local-only cell (development)"
fi

# ------------------------------------------------------------------ 3. serve
#
# tini forwards SIGTERM here. The hub flushes SQLite and the autocommit queue on
# shutdown (sync/index.ts stop()), which is what makes a platform-initiated
# migration lossless rather than merely usually-lossless.
# Defaulted so the script is runnable (and its guards testable) outside the
# image, where the Dockerfile ENV is not in scope.
PORT="${PORT:-1234}"
log "starting hub on :${PORT}"
exec bun /app/apps/hub/src/server.mjs
