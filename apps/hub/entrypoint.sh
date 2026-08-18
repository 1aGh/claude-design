#!/bin/sh
# Self-hosted hub entrypoint — Track A' A1.
#
# WHY THIS FILE EXISTS. The cell has had `infra/cell/entrypoint.sh` since Phase
# 5: it resolves the boot state and only then serves, so a platform-migrated
# instance recovers instead of starting empty. The self-hosted image had no
# entrypoint at all — `CMD ["node","dist/hub.bundle.mjs"]` — so it never asked.
# Lose `/repo` and the next boot cloned MAUDE_SEED_REPO over the loss, came up
# green, and autosave committed on top.
#
# Two boot paths, one of which recovers, was the bug. This is the other half of
# closing it: the same `dist/rehydrate.mjs`, carrying the same decision table,
# called by both.
#
# It is deliberately thin. Every decision — restore, seed, start fresh, or stop
# — belongs to `decideBoot()` in `rehydrate.mjs`, where it is a tested table
# rather than shell. Adding a condition here would recreate exactly the
# divergence this file was written to remove.
set -eu

log() { echo "[hub-entrypoint] $*" >&2; }

DATA_DIR="${DATA_DIR:-/data}"
REPO_DIR="${MAUDE_REPO_DIR:-/repo}"

# No object storage means there is nothing to restore FROM. That is a legitimate
# configuration (a hub whose durability is somebody else's volume snapshots), so
# it starts — it just starts without this safety net, which the console reports.
if [ -n "${MAUDE_S3_BUCKET:-}" ] || [ -n "${MAUDE_BACKUP_TARGET:-}" ]; then
  log "resolving boot state"
  if ! node /app/dist/rehydrate.mjs --data "$DATA_DIR" --repo "$REPO_DIR"; then
    # Starting empty is indistinguishable from a deleted project to the person
    # who opens it, and autosave would commit that emptiness over real work.
    log "refusing to start — see the reason above."
    log "if this is genuinely a fresh deployment, set MAUDE_ALLOW_EMPTY_START=1."
    exit 1
  fi
else
  log "no object storage configured — starting without a restore lane"
fi

exec node /app/dist/hub.bundle.mjs "$@"
