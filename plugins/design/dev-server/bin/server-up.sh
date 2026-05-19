#!/usr/bin/env bash
# server-up.sh — ensure the design dev server is running for the given repo.
# Canonical recipe (was inline in `edit.md` step 2, `new.md` step 2, etc.).
#
# Usage:
#   server-up.sh [--root <repo>] [--timeout 10] [--allow-legacy]
#
# Reads / writes:
#   $DESIGN_ROOT/_server.json   (PID + port the running server wrote)
#   $DESIGN_ROOT/_server.log    (stdout/stderr of the spawned server)
#
# Runtime selection (DDR-020):
#   - Default: bun + server.ts. Hard-fails when bun is not on $PATH.
#   - --allow-legacy: opt-in fallback to node + server.mjs (debug only;
#     no TSX canvas pipeline, no HMR). Sunset in DDR-020 Phase B.
#
# Output: prints the port on stdout. Diagnostic lines go to stderr.
# Exit:   0 = server ready / 1 = start timeout or missing runtime / 2 = bad args.

REPO=""
TIMEOUT=10
ALLOW_LEGACY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --root)    REPO="$2"; shift 2 ;;
    --timeout) TIMEOUT="$2"; shift 2 ;;
    --allow-legacy) ALLOW_LEGACY=1; shift ;;
    --help|-h)
      sed -n '2,21p' "$0" | sed 's/^# \?//'
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

# Resolve plugin root + pick a server runtime. DDR-020: bun + server.ts is
# authoritative. Legacy node + server.mjs is sunset; available only behind
# --allow-legacy (debug-only — no TSX canvas pipeline, no HMR).
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
SERVER_TS="$PLUGIN_ROOT/dev-server/server.ts"
SERVER_MJS="$PLUGIN_ROOT/dev-server/server.mjs"
if [ ! -f "$SERVER_TS" ]; then SERVER_TS="$SCRIPT_DIR/../server.ts"; fi
if [ ! -f "$SERVER_MJS" ]; then SERVER_MJS="$SCRIPT_DIR/../server.mjs"; fi

RUNTIME=""
RUNTIME_CMD=""
if [ $ALLOW_LEGACY -eq 1 ]; then
  if [ ! -f "$SERVER_MJS" ]; then
    echo "server-up.sh: --allow-legacy requested but server.mjs not found at $SERVER_MJS" >&2
    exit 1
  fi
  RUNTIME="node"
  RUNTIME_CMD="node $SERVER_MJS"
  echo "server-up.sh: WARNING — running legacy server.mjs (no TSX canvas pipeline, no HMR). DDR-020 sunsets this in Phase B." >&2
elif command -v bun >/dev/null 2>&1 && [ -f "$SERVER_TS" ]; then
  RUNTIME="bun"
  RUNTIME_CMD="bun $SERVER_TS"
else
  echo "server-up.sh: bun not on \$PATH — install via https://bun.sh/install" >&2
  echo "server-up.sh: DDR-020 made bun authoritative; the node fallback is opt-in via --allow-legacy (debug only)." >&2
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
echo "→ starting dev server: $RUNTIME_CMD --root $REPO" >&2
if [ "$RUNTIME" = "bun" ]; then
  nohup bun "$SERVER_TS" --root "$REPO" > "$DESIGN_ROOT/_server.log" 2>&1 &
elif [ "$RUNTIME" = "node" ]; then
  nohup node "$SERVER_MJS" --root "$REPO" > "$DESIGN_ROOT/_server.log" 2>&1 &
fi
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
