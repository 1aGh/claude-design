#!/usr/bin/env bash
# Stop the playground smoke peers (and optionally the hub container).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$HERE/.smoke-pids"

if [ -f "$PID_FILE" ]; then
  echo "→ stopping smoke peers ($(cat "$PID_FILE")) …"
  # shellcheck disable=SC2046
  kill $(cat "$PID_FILE") 2>/dev/null || true
  rm -f "$PID_FILE"
  echo "✓ peers stopped"
else
  echo "no running peers (no .smoke-pids)"
fi

if [ "${1:-}" = "--all" ]; then
  echo "→ tearing down the hub container …"
  docker compose -f "$HERE/docker-compose.playground.yml" down
  echo "✓ hub stopped (volume hub-playground-data kept; add -v to drop it)"
else
  echo "  (hub container left running — ./stop.sh --all to stop it too)"
fi
