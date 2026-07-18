#!/usr/bin/env bash
# agent-browser-safe.sh — hardened agent-browser wrapper. Thin shim over
# _agent-browser-safe.mjs; reached via `maude design agent-browser-safe`
# (DDR-062), never a raw bin path. See _agent-browser-safe.mjs for the full
# security rationale (DDR-185 security addendum).
#
# Usage:
#   agent-browser-safe.sh <subcommand> [args...]
#
# Allowed subcommands: open, eval, screenshot, snapshot, get, wait, close.
# Forces --allowed-domains localhost,127.0.0.1 and a non-persistent profile.
# Exit: agent-browser's own exit code · 2 usage/rejected argv · 1 other.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if ! command -v agent-browser >/dev/null 2>&1; then
  echo "agent-browser-safe.sh: agent-browser is required." >&2
  exit 1
fi

# Prefer node (always present with a maude install); fall back to bun in a dev
# tree that has bun but a shimmed node. The module is pure Node ESM — no .ts.
if command -v node >/dev/null 2>&1; then
  exec node "$SCRIPT_DIR/_agent-browser-safe.mjs" "$@"
elif command -v bun >/dev/null 2>&1; then
  exec bun run "$SCRIPT_DIR/_agent-browser-safe.mjs" "$@"
else
  echo "agent-browser-safe.sh: node (or bun) is required." >&2
  exit 1
fi
