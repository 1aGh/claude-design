#!/usr/bin/env bash
# Wraps `pnpm changeset version` so plugin manifests stay in lockstep with
# package.json.
#
# Flow:
#   1. `pnpm changeset version` — consumes pending .changeset/*.md files, bumps
#      package.json, regenerates CHANGELOG.md.
#   2. Reads the new version from package.json.
#   3. Re-applies it to every plugin manifest by re-using the JSON-rewriting
#      block from scripts/bump-version.sh (calling that script with the explicit
#      X.Y.Z would re-bump package.json — we skip it and patch only plugins).
#   4. Runs scripts/check-version-parity.sh as the safety net.
#
# Invoked from `pnpm version` (see package.json scripts) and from
# .github/workflows/publish.yml.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
PKG_PATH="$ROOT/package.json"
PLUGIN_PATHS=(
  "$ROOT/plugins/design/.claude-plugin/plugin.json"
  "$ROOT/plugins/flow/.claude-plugin/plugin.json"
)

OLD=$(node -p "require('$PKG_PATH').version")

# 1. Let changesets bump package.json + write CHANGELOG.md.
pnpm changeset version

NEW=$(node -p "require('$PKG_PATH').version")

if [ "$OLD" = "$NEW" ]; then
  echo "no version change (no consumable changesets); plugin manifests untouched"
  exit 0
fi

echo "$OLD → $NEW (changesets)"

# 2. Propagate to plugin manifests.
PATHS_JOINED=$(printf "'%s'," "${PLUGIN_PATHS[@]}")
PATHS_JOINED="${PATHS_JOINED%,}"

node -e "
  const fs = require('fs');
  for (const p of [$PATHS_JOINED]) {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    j.version = '$NEW';
    fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
  }
"

# 3. Verify.
"$ROOT/scripts/check-version-parity.sh"
