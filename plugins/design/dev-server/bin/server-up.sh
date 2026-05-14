#!/usr/bin/env bash
# server-up.sh — ensure the design dev server is running for the given repo.
# Canonical recipe (was inline in `edit.md` step 2, `new.md` step 2, etc.).
#
# Usage:
#   server-up.sh [--root <repo>] [--timeout 10]
#
# Reads / writes:
#   $DESIGN_ROOT/_server.json   (PID + port the running server wrote)
#   $DESIGN_ROOT/_server.log    (stdout/stderr of the spawned server)
#
# Output: prints the port on stdout. Diagnostic lines go to stderr.
# Exit:   0 = server ready / 1 = start timeout / 2 = bad args.

REPO=""
TIMEOUT=10
while [ $# -gt 0 ]; do
  case "$1" in
    --root)    REPO="$2"; shift 2 ;;
    --timeout) TIMEOUT="$2"; shift 2 ;;
    --help|-h)
      sed -n '2,15p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *)
      echo "server-up.sh: unknown arg '$1' (try --help)" >&2
      exit 2
      ;;
  esac
done

# Resolve repo root.
if [ -z "$REPO" ]; then
  REPO="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
fi

# Resolve plugin root (where server.mjs lives).
# Priority: $CLAUDE_PLUGIN_ROOT > $(dirname "$0")/.. (helper lives in dev-server/bin/).
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
SERVER_MJS="$PLUGIN_ROOT/dev-server/server.mjs"
if [ ! -f "$SERVER_MJS" ]; then
  # Fallback: same parent layout but PLUGIN_ROOT is the bin's grandparent (dev-server/).
  SERVER_MJS="$SCRIPT_DIR/../server.mjs"
fi
if [ ! -f "$SERVER_MJS" ]; then
  echo "server-up.sh: server.mjs not found (looked at \$CLAUDE_PLUGIN_ROOT/dev-server/server.mjs and helper-relative path)" >&2
  exit 1
fi

DESIGN_ROOT="$REPO/.design"
STATE="$DESIGN_ROOT/_server.json"

read_port() {
  if command -v jq >/dev/null 2>&1; then
    jq -r .port "$STATE" 2>/dev/null
  else
    # Best-effort grep — jq is in repo deps but be defensive.
    sed -nE 's/.*"port"[[:space:]]*:[[:space:]]*([0-9]+).*/\1/p' "$STATE" 2>/dev/null | head -n1
  fi
}
read_pid() {
  if command -v jq >/dev/null 2>&1; then
    jq -r .pid "$STATE" 2>/dev/null
  else
    sed -nE 's/.*"pid"[[:space:]]*:[[:space:]]*([0-9]+).*/\1/p' "$STATE" 2>/dev/null | head -n1
  fi
}

# Step 1 — check existing.
NEEDS_START=1
if [ -f "$STATE" ]; then
  PID=$(read_pid)
  PORT=$(read_port)
  if [ -n "$PID" ] && [ -n "$PORT" ] \
     && kill -0 "$PID" 2>/dev/null \
     && curl -fs "http://localhost:$PORT/_health" >/dev/null 2>&1; then
    echo "✓ server alive pid=$PID port=$PORT" >&2
    echo "$PORT"
    exit 0
  else
    echo "→ stale _server.json — clearing and respawning" >&2
    rm -f "$STATE"
  fi
fi

# Step 2 — spawn.
mkdir -p "$DESIGN_ROOT"
echo "→ starting dev server: node $SERVER_MJS --root $REPO" >&2
nohup node "$SERVER_MJS" --root "$REPO" > "$DESIGN_ROOT/_server.log" 2>&1 &
disown 2>/dev/null || true

# Step 3 — poll.
i=0
while [ $i -lt "$TIMEOUT" ]; do
  sleep 1
  i=$((i + 1))
  if [ -f "$STATE" ]; then
    PORT=$(read_port)
    if [ -n "$PORT" ] && curl -fs "http://localhost:$PORT/_health" >/dev/null 2>&1; then
      echo "✓ server started port=$PORT after ${i}s" >&2
      echo "$PORT"
      exit 0
    fi
  fi
done

echo "✗ server start timeout after ${TIMEOUT}s; check $DESIGN_ROOT/_server.log" >&2
exit 1
