#!/usr/bin/env bash
# Wraps `pnpm changeset version` so EVERY versioned manifest moves in lockstep:
# package.json, both plugin manifests, AND the 7 packages/md-claude-*/package.json
# sub-packages (plus the optionalDependencies pins in root package.json that
# point at them — see DDR-015 / Phase 3.4 per-platform binary distribution).
#
# Flow:
#   1. `pnpm changeset version` — consumes pending .changeset/*.md files, bumps
#      package.json, regenerates CHANGELOG.md.
#   2. Reads the new version from package.json.
#   3. Calls scripts/bump-version.sh "$NEW" to propagate to every other
#      manifest (idempotent re-write of package.json + plugin manifests +
#      7 sub-packages + 7 optionalDependencies pins).
#   4. bump-version.sh ends by running scripts/check-version-parity.sh as the
#      safety net.
#
# Invoked from `pnpm run changeset:version` (see package.json scripts) and
# from the release runbook.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
PKG_PATH="$ROOT/package.json"

OLD=$(node -p "require('$PKG_PATH').version")

# 1. Let changesets bump package.json + write CHANGELOG.md.
pnpm changeset version

NEW=$(node -p "require('$PKG_PATH').version")

if [ "$OLD" = "$NEW" ]; then
  echo "no version change (no consumable changesets); manifests untouched"
  exit 0
fi

echo "$OLD → $NEW (changesets) — propagating to plugin manifests + sub-packages"

# 2. Propagate to plugin manifests + 7 packages/md-claude-*/package.json + pins.
"$ROOT/scripts/bump-version.sh" "$NEW"
