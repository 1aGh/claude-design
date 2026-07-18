#!/usr/bin/env bash
# curl-local.sh — loopback-only curl. Thin shim over _curl-local.mjs; reached
# via `maude design curl-local` (DDR-062), never a raw bin path. See
# _curl-local.mjs for the full security rationale (DDR-185).
#
# Usage:
#   curl-local.sh <curl-args...>
#
# Resolves every http(s) target among the given curl args and refuses to run
# curl at all unless EVERY resolved address is loopback (127.0.0.0/8 or ::1).
# Exit: curl's own exit code · 2 usage · 3 non-loopback target rejected · 1 other.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if ! command -v curl >/dev/null 2>&1; then
  echo "curl-local.sh: curl is required." >&2
  exit 1
fi

# Prefer node (always present with a maude install); fall back to bun in a dev
# tree that has bun but a shimmed node. The module is pure Node ESM — no .ts.
if command -v node >/dev/null 2>&1; then
  exec node "$SCRIPT_DIR/_curl-local.mjs" "$@"
elif command -v bun >/dev/null 2>&1; then
  exec bun run "$SCRIPT_DIR/_curl-local.mjs" "$@"
else
  echo "curl-local.sh: node (or bun) is required." >&2
  exit 1
fi
