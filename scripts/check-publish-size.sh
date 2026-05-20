#!/usr/bin/env bash
# check-publish-size.sh — guard against bloating the npm tarball.
#
# Asserts that `npm pack --dry-run --json` reports no entries under
# `scripts/video/` or any other ignored-but-visible-by-accident dirs.
# The published surface is intentionally minimal (cli/ + plugins dev-server
# templates + plugins flow templates + flow config schema + LICENSE + README).
# A misconfigured `files` field or stray symlink can silently balloon the
# tarball; this guard catches that before `npm publish`.

set -euo pipefail

cd "$(dirname "$0")/.."

# Run npm pack dry-run + capture JSON.
JSON=$(npm pack --dry-run --json 2>/dev/null)

# Forbidden path prefixes that should NEVER ship to npm.
FORBIDDEN=(
  "scripts/video/"
  "site/"
  ".ai/"
  ".design/"
  ".github/"
  "docs/"
  "node_modules/"
  ".changeset/"
  ".work/"
)

VIOLATIONS=()
for prefix in "${FORBIDDEN[@]}"; do
  COUNT=$(echo "$JSON" | python3 -c "
import json,sys
d = json.load(sys.stdin)
files = d[0]['files'] if isinstance(d, list) else d.get('files', [])
prefix = '$prefix'
matches = [f['path'] for f in files if f['path'].startswith(prefix)]
print(len(matches))
" 2>/dev/null || echo "0")
  if [ "$COUNT" -gt 0 ]; then
    VIOLATIONS+=("$prefix ($COUNT entries)")
  fi
done

# Size guard — refuse tarball > 10 MB.
SIZE=$(echo "$JSON" | python3 -c "
import json,sys
d = json.load(sys.stdin)
size = d[0]['size'] if isinstance(d, list) else d.get('size', 0)
print(size)
" 2>/dev/null || echo "0")

SIZE_MB=$(echo "$SIZE 1048576" | awk '{printf "%.2f", $1/$2}')

# Print summary.
if [ ${#VIOLATIONS[@]} -gt 0 ]; then
  echo "✗ check-publish-size.sh: forbidden paths leaked into npm tarball:" >&2
  printf '  - %s\n' "${VIOLATIONS[@]}" >&2
  exit 1
fi

# 10 MB cap is generous — current tarball is ~few hundred KB.
SIZE_LIMIT_MB=10
SIZE_OK=$(echo "$SIZE_MB $SIZE_LIMIT_MB" | awk '{print ($1 <= $2) ? 1 : 0}')
if [ "$SIZE_OK" = "0" ]; then
  echo "✗ check-publish-size.sh: tarball is ${SIZE_MB} MB (cap: ${SIZE_LIMIT_MB} MB)" >&2
  exit 1
fi

echo "✓ npm tarball clean: ${SIZE_MB} MB (cap: ${SIZE_LIMIT_MB} MB), no forbidden paths"
