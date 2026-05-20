#!/usr/bin/env bash
# server-up.sh — ensure the scratch dev-server is running for the demo video.
#
# Used by Phase 15.5 capture tasks (real /design:new + /design:edit recordings).
# Idempotent: if a server is already up on $PORT serving $ROOT, prints the port
# and exits 0 without respawning.
#
# Usage:
#   bash scripts/video/final/lib/server-up.sh [--root <path>] [--port N]
#
# Defaults:
#   --root  /tmp/scratch-maude-demo-$(date +%Y%m%d)
#   --port  4400
#
# Output: prints the port on stdout (matches dev-server/bin/server-up.sh).
# Exit:   0 = ready / 1 = boot timeout / 2 = bad args / 3 = scratch root missing.

set -euo pipefail

ROOT=""
PORT="4400"
TIMEOUT=20
REPO="$(cd "$(dirname "$0")/../../../.." && pwd)"

while [ $# -gt 0 ]; do
  case "$1" in
    --root)    ROOT="$2"; shift 2 ;;
    --port)    PORT="$2"; shift 2 ;;
    --timeout) TIMEOUT="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,18p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *) echo "server-up.sh: bad arg '$1'" >&2; exit 2 ;;
  esac
done

if [ -z "$ROOT" ]; then
  ROOT="/tmp/scratch-maude-demo-$(date +%Y%m%d)"
fi

if [ ! -d "$ROOT/.design" ]; then
  echo "server-up.sh: $ROOT has no .design/ — run Task 3 bootstrap first" >&2
  exit 3
fi

# If already up on this port (project name matches scratch), reuse it.
if curl -sf "http://localhost:${PORT}/_health" >/dev/null 2>&1; then
  CUR_PROJECT=$(curl -sf "http://localhost:${PORT}/_health" | jq -r '.project // empty' 2>/dev/null || true)
  WANT_PROJECT=$(jq -r '.name // empty' "$ROOT/.design/config.json" 2>/dev/null || true)
  if [ -n "$CUR_PROJECT" ] && [ -n "$WANT_PROJECT" ] && [ "$CUR_PROJECT" = "$WANT_PROJECT" ]; then
    echo "$PORT"
    exit 0
  fi
  echo "server-up.sh: port $PORT busy serving '$CUR_PROJECT' (wanted '$WANT_PROJECT'); pick a different --port" >&2
  exit 1
fi

# Spawn bun + server.ts. Stdout/err captured for inspection.
SERVER_TS="$REPO/plugins/design/dev-server/server.ts"
if [ ! -f "$SERVER_TS" ]; then
  echo "server-up.sh: server.ts not found at $SERVER_TS" >&2
  exit 1
fi

LOG="$ROOT/.design/_video-server.log"
( cd "$REPO" && nohup bun "$SERVER_TS" --root "$ROOT" --port "$PORT" >"$LOG" 2>&1 & ) </dev/null

# Poll /_health up to $TIMEOUT seconds.
for i in $(seq 1 "$TIMEOUT"); do
  if curl -sf "http://localhost:${PORT}/_health" >/dev/null 2>&1; then
    echo "$PORT"
    exit 0
  fi
  sleep 1
done

echo "server-up.sh: timed out waiting for http://localhost:${PORT}/_health (see $LOG)" >&2
tail -30 "$LOG" >&2 2>/dev/null || true
exit 1
