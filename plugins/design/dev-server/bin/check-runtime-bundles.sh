#!/usr/bin/env bash
# check-runtime-bundles.sh — pre-publish guard against shipping defective
# /_canvas-runtime/<slug>.js bundles.
#
# Why: Bun.build's output for `motion` + `motion/react` is environment-sensitive
# (Bun version, OS, transitive dep resolution). v0.22.0 shipped a 13 kB
# motion_react.js where the working bundle is 155 kB+ — the smaller artifact
# parses cleanly + serves HTTP 200 but throws `ReferenceError: AcceleratedAnimation
# is not defined` at module-eval time, breaking every canvas that uses the
# motion lib. CI build was green; the regression slipped because nothing
# asserted bundle SIZE.
#
# This guard reads dist/runtime/.min-sizes.json and asserts each on-disk
# bundle ≥ its declared floor. Run from CI before `npm publish`. Hard-fails
# the publish job → the bad tarball never reaches npm.
#
# Floors are at ~70% of release-minified size (see manifest comment). Any
# minifier improvement that drops a bundle below the floor needs an explicit
# manifest bump + investigation — that's the point.
#
# Usage:
#   check-runtime-bundles.sh [--runtime-dir <path>] [--manifest <path>]
#
# Defaults:
#   --runtime-dir = <plugin>/dev-server/dist/runtime/
#   --manifest    = <runtime-dir>/.min-sizes.json
#
# Exit codes:
#   0 all bundles meet floor
#   1 manifest or runtime dir missing
#   2 bad args
#   3 one or more bundles below floor

set -euo pipefail

RUNTIME_DIR=""
MANIFEST=""

while [ $# -gt 0 ]; do
  case "$1" in
    --runtime-dir) RUNTIME_DIR="$2"; shift 2 ;;
    --manifest)    MANIFEST="$2"; shift 2 ;;
    --help|-h)
      sed -n '2,30p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *)
      echo "check-runtime-bundles.sh: unknown arg '$1' (try --help)" >&2
      exit 2
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -z "$RUNTIME_DIR" ]; then
  RUNTIME_DIR="$SCRIPT_DIR/../dist/runtime"
fi
if [ -z "$MANIFEST" ]; then
  MANIFEST="$RUNTIME_DIR/.min-sizes.json"
fi

if [ ! -d "$RUNTIME_DIR" ]; then
  echo "check-runtime-bundles.sh: runtime dir not found at $RUNTIME_DIR" >&2
  exit 1
fi
if [ ! -f "$MANIFEST" ]; then
  echo "check-runtime-bundles.sh: manifest not found at $MANIFEST" >&2
  exit 1
fi

# Read manifest as <slug> <floor> pairs, one per line. Skip $-prefixed
# metadata keys ($comment etc.). Prefer jq when available; fall back to
# python3 (always present in CI runners + macOS).
read_pairs() {
  if command -v jq >/dev/null 2>&1; then
    jq -r 'to_entries | map(select(.key | startswith("$") | not)) | .[] | "\(.key) \(.value)"' "$MANIFEST"
  else
    python3 -c '
import json, sys
with open("'"$MANIFEST"'") as f:
    data = json.load(f)
for k, v in data.items():
    if k.startswith("$"): continue
    print(k, v)
'
  fi
}

FAIL_COUNT=0
CHECK_COUNT=0
MISSING_COUNT=0

while read -r slug floor; do
  [ -z "$slug" ] && continue
  CHECK_COUNT=$((CHECK_COUNT + 1))
  PATH_JS="$RUNTIME_DIR/$slug"
  if [ ! -f "$PATH_JS" ]; then
    echo "✗ $slug — missing on disk (expected at $PATH_JS)" >&2
    MISSING_COUNT=$((MISSING_COUNT + 1))
    FAIL_COUNT=$((FAIL_COUNT + 1))
    continue
  fi
  SIZE=$(wc -c < "$PATH_JS" | tr -d ' ')
  if [ "$SIZE" -lt "$floor" ]; then
    echo "✗ $slug — $SIZE B < floor $floor B (likely defective bundle)" >&2
    FAIL_COUNT=$((FAIL_COUNT + 1))
  else
    echo "✓ $slug — $SIZE B ≥ floor $floor B"
  fi
done < <(read_pairs)

if [ "$FAIL_COUNT" -eq 0 ]; then
  echo ""
  echo "✓ check-runtime-bundles OK — $CHECK_COUNT bundles, all above floor"
  exit 0
fi

echo "" >&2
echo "✗ check-runtime-bundles FAIL — $FAIL_COUNT/$CHECK_COUNT bundle(s) below floor" >&2
if [ "$MISSING_COUNT" -gt 0 ]; then
  echo "  ($MISSING_COUNT missing from disk — was buildRuntimeBundles() skipped?)" >&2
fi
echo "  Refusing to ship a tarball with defective /_canvas-runtime artifacts." >&2
echo "  Investigate the Bun.build output for the offending package(s) before publishing." >&2
exit 3
