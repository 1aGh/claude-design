#!/usr/bin/env bash
# Lint .tape files for the two gotchas documented in tapes/_TEMPLATE.tape:
#   1. Width × Height must be 1280×720 (no 1920×1080).
#   2. Any `Hide` block must contain `Type "clear" Enter` before `Show`.
#
# Skip _TEMPLATE.tape (it's the spec, not a recording).
#
# Exit 0 = clean. Exit 1 = at least one tape violates.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}/../../../.."   # → repo root

VIOLATIONS=0

for tape in scripts/video/tapes/*.tape; do
  name=$(basename "$tape")
  [ "$name" = "_TEMPLATE.tape" ] && continue
  [ -f "$tape" ] || continue

  # Check 1: dimensions
  if grep -qE "^Set\s+Width\s+1920" "$tape" || grep -qE "^Set\s+Height\s+1080" "$tape"; then
    echo "VIOLATION ${tape}: uses 1920×1080. Use 1280×720 (see tapes/_TEMPLATE.tape comment #1)."
    VIOLATIONS=$((VIOLATIONS + 1))
  fi

  # Check 2: Hide block must clear before Show.
  # Walks lines: inside any Hide…Show block, a `Type "clear"` line must appear.
  if grep -q "^Hide" "$tape"; then
    LEAKED=$(awk '
      BEGIN { in_hide = 0; cleared = 0; leaked = 0 }
      /^Hide[[:space:]]*$/ { in_hide = 1; cleared = 0; next }
      in_hide && /Type[[:space:]]+"clear"/ { cleared = 1; next }
      /^Show[[:space:]]*$/ {
        if (in_hide && !cleared) leaked = 1
        in_hide = 0; cleared = 0; next
      }
      END { print leaked }
    ' "$tape")

    if [ "$LEAKED" = "1" ]; then
      echo "VIOLATION ${tape}: Hide block does not clear screen before Show — typed commands will leak (see tapes/_TEMPLATE.tape comment #2)."
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  fi
done

if [ "$VIOLATIONS" -gt 0 ]; then
  echo ""
  echo "found ${VIOLATIONS} tape discipline violation(s). See scripts/video/tapes/_TEMPLATE.tape for the canonical pattern."
  exit 1
fi

TAPE_COUNT=$(find scripts/video/tapes -maxdepth 1 -name "*.tape" -not -name "_TEMPLATE.tape" | wc -l | tr -d ' ')
echo "ok: ${TAPE_COUNT} tape(s) follow the discipline."
