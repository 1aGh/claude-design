#!/usr/bin/env bash
# import-figma.sh — Figma / FigJam import (REST door). Thin shim over
# _import-figma.mjs; reached via `maude design import-figma` (DDR-062), never a
# raw bin path. See _import-figma.mjs + DDR-216 for the full architecture +
# security rationale. Requires bun — _import-figma.mjs imports the `.ts`
# annotation model and figma modules directly, same constraint as
# import-tokens.sh.
#
# All args are forwarded quoted ("$@") — never unquoted or eval-expanded. This
# matters more than usual here: a Figma URL is caller-supplied and a node id
# rides in its query string. The charset/shape validation itself happens in
# figma/url.ts, not in this shell (DDR-216 D4); the wrapper's ONLY job is safe
# argv passthrough.
#
# Usage:
#   import-figma.sh --board  <figjam-url> --root <repo> [--design-root .design]
#                   [--slug <name>] [--dry-run] [--json]
#   import-figma.sh --pages  <figma-url>  --root <repo> [--folder <name>] [--editable]
#   import-figma.sh --frames <figma-url>  --root <repo>   (Phase 3)
#   import-figma.sh --tokens <figma-url>  --root <repo>   (Phase 4)
#   import-figma.sh --explode <artboard-id> --canvas <rel-path> --root <repo>
#                   [--confirm-document] [--dry-run] [--json]      (Phase 7)
#
# Needs a Figma personal access token with the `file_content:read` scope, added
# once in Settings.
#
# `--explode` needs NO token — it reads the Figma DESKTOP app's local Dev Mode
# MCP server over loopback (DDR-219 D2) rather than the REST API. It does need
# that app running, in Dev Mode, with the same file as the active tab, on a Dev
# or Full seat. It is not an import route: the artboard must already exist on an
# imported canvas.
#
# Exit: 0 ok · 1 other · 2 usage · 3 validation reject · 4 fetch/parse error ·
#       5 no token configured · 6 write/containment error.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

case "$1" in
  --help|-h) sed -n '2,34p' "$0" | sed 's/^# \?//'; exit 0 ;;
esac

if ! command -v bun >/dev/null 2>&1; then
  echo "import-figma.sh: bun is required (hard dependency — see plugins/design/dependencies.json)." >&2
  echo "  Install: curl -fsSL https://bun.sh/install | bash" >&2
  exit 1
fi

exec bun run "$SCRIPT_DIR/_import-figma.mjs" "$@"
