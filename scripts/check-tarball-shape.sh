#!/usr/bin/env bash
# Asserts the published @1agh/maude tarball has the shape we expect:
#   - no workspace `package.json` files leak (would publish a private workspace
#     name like @maude/dev-server)
#   - no `node_modules/` or transitive deps end up in the tarball (the package
#     has zero runtime deps — `pixi.js`, `pdf-lib`, etc. are devDeps inside
#     workspaces and must never ship)
#   - reserved-slot workspaces (`site`, `apps/hub`) are excluded
#     entirely
#
# Run before tagging and in CI on PRs that touch `files` or any workspace.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"

# npm pack --json is the supported machine-readable shape since npm 7.
listing=$(npm pack --dry-run --json 2>/dev/null | node -e '
  const json = require("fs").readFileSync(0, "utf8");
  for (const pkg of JSON.parse(json)) {
    for (const f of pkg.files) console.log(f.path);
  }
')

fail() {
  echo "error: tarball shape violation — $1" >&2
  echo "" >&2
  echo "Full tarball listing:" >&2
  echo "$listing" | sed "s/^/  /" >&2
  exit 1
}

# Workspace package.json files must NOT ship — they declare private packages
# (@maude/dev-server, @maude/hub, @maude/site) that would
# accidentally be exposed at install time.
echo "$listing" | grep -E "^(site|plugins/[^/]+/[^/]+|apps/[^/]+)/package\.json$" >/dev/null \
  && fail "workspace package.json present in tarball" || true

# Reserved-slot workspaces must be entirely absent.
echo "$listing" | grep -E "^(site|apps/hub)/" >/dev/null \
  && fail "reserved workspace dir leaked into tarball" || true

# Transitive deps must never appear.
echo "$listing" | grep -E "^node_modules/" >/dev/null \
  && fail "node_modules/ in tarball" || true

# Workspace lockfile must never ship.
echo "$listing" | grep -E "^pnpm-lock\.yaml$" >/dev/null \
  && fail "pnpm-lock.yaml in tarball" || true

count=$(echo "$listing" | wc -l | tr -d ' ')
echo "tarball shape OK: $count files, zero workspace metadata, zero node_modules"
