#!/usr/bin/env bash
# import-tokens.sh — token-file import (W3C design-tokens / Style-Dictionary
# JSON / raw CSS custom properties -> the DS CSS-variable contract). Thin
# shim over _import-tokens.mjs; reached via `maude design import-tokens`
# (DDR-062), never a raw bin path. See _import-tokens.mjs + DDR-172 for the
# full mapping contract + security rationale. Requires bun — _import-tokens.mjs
# imports the `.ts` palette/paths modules directly, same constraint as
# import-asset.sh.
#
# All args are forwarded quoted ("$@") — never unquoted or eval-expanded
# (DDR-172 Decision 8 wrapper-hygiene requirement; the charset/shape
# validation itself happens in _import-tokens.mjs, not here).
#
# Usage:
#   import-tokens.sh <token-file> --root <repo> [--design-root .design]
#                    [--ds <name> | --new-ds <name>] [--theme <name>]
#                    [--force-insert] [--json]
#
# Exit: 0 ok · 1 other · 2 usage · 3 validation/mapping reject ·
#       4 read/parse error · 5 unsupported format · 6 write/containment error.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

case "$1" in
  --help|-h) sed -n '2,16p' "$0" | sed 's/^# \?//'; exit 0 ;;
esac

if ! command -v bun >/dev/null 2>&1; then
  echo "import-tokens.sh: bun is required (hard dependency — see plugins/design/dependencies.json)." >&2
  echo "  Install: curl -fsSL https://bun.sh/install | bash" >&2
  exit 1
fi

exec bun run "$SCRIPT_DIR/_import-tokens.mjs" "$@"
