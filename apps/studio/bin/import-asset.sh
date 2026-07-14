#!/usr/bin/env bash
# import-asset.sh — hardened local-file SVG/PDF ingestion. Thin shim over
# _import-asset.mjs; reached via `maude design import-asset` (DDR-062), never
# a raw bin path. See _import-asset.mjs + DDR-167 for the full security
# rationale. Requires bun (not the node/bun fallback fetch-asset.sh uses) —
# _import-asset.mjs imports the `.ts` SVGO engine module directly, same
# constraint as svg-optimize.sh.
#
# Usage:
#   import-asset.sh <local-path> --root <repo> [--design-root .design]
#                   [--kind svg|pdf|raster] [--json]
#
# stdout on success = one reference path per line (e.g. /assets/a44d3d60.svg).
# PDF import is not yet available (DDR-167 addendum) — the verb accepts a
# .pdf input and fails loud naming why, rather than silently rejecting it as
# an unknown flag. `raster` (PNG/JPEG, magic-byte sniffed) content-addresses
# a local image as-is — added for DDR-174/T15's vision-reconstruction source.
#
# Exit: 0 ok · 1 not-yet-available/other · 2 usage · 3 sanitize/validation
#       reject · 4 read/parse error · 5 unsupported media type ·
#       6 write/containment error.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

case "$1" in
  --help|-h) sed -n '2,17p' "$0" | sed 's/^# \?//'; exit 0 ;;
esac

if ! command -v bun >/dev/null 2>&1; then
  echo "import-asset.sh: bun is required (hard dependency — see plugins/design/dependencies.json)." >&2
  echo "  Install: curl -fsSL https://bun.sh/install | bash" >&2
  exit 1
fi

exec bun run "$SCRIPT_DIR/_import-asset.mjs" "$@"
