#!/usr/bin/env bash
# Containment invariant — the CI half of DDR-193 §2's "enforced, not asserted".
#
#   > No tenant-authored TSX is ever evaluated by vendor-operated compute.
#
# The boot-assert (apps/studio/workspace-mode.ts) catches a cell that would
# START with a forbidden surface reachable. This catches the change that would
# make that possible, at review time, where it is cheap.
#
# Two checks:
#   1. The forbidden-surface vocabulary in workspace-mode.ts has not silently
#      shrunk. Deleting an entry is how this invariant would actually be lost —
#      not by someone arguing against it, but by a refactor quietly dropping a
#      line while every test stays green.
#   2. The cell image does not ship a browser automation dependency. A cell that
#      HAS Playwright is one import() away from rendering tenant content, so the
#      cheapest place to hold the line is the dependency list.
#
# Exits non-zero with an explanation. Never "fixes" anything.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

MODULE="apps/studio/workspace-mode.ts"
fail=0

if [ ! -f "$MODULE" ]; then
  echo "FAIL: $MODULE is missing — the containment boot-assert is gone (DDR-193 §2)." >&2
  exit 1
fi

# ---- 1. the vocabulary must still name every forbidden surface --------------
REQUIRED_PREFIXES=(
  "/_api/export"
  "/_api/photo-edit"
  "/_api/generate"
  "/_canvas-shell"
  "/_canvas-runtime"
  "/_ws/acp"
)
for prefix in "${REQUIRED_PREFIXES[@]}"; do
  if ! grep -qF "'$prefix'" "$MODULE"; then
    echo "FAIL: '$prefix' is no longer in FORBIDDEN_ROUTE_PREFIXES ($MODULE)." >&2
    echo "      A workspace cell must not expose it — see DDR-193 §2." >&2
    echo "      If a feature genuinely needs it, Direction B is its hard prerequisite," >&2
    echo "      not a deletion here." >&2
    fail=1
  fi
done

REQUIRED_MODULES=(playwright playwright-core puppeteer puppeteer-core)
for mod in "${REQUIRED_MODULES[@]}"; do
  if ! grep -qF "'$mod'" "$MODULE"; then
    echo "FAIL: '$mod' is no longer in FORBIDDEN_MODULES ($MODULE)." >&2
    fail=1
  fi
done

# The assert must still be CALLED. A module that defines the rule but is never
# invoked is the most plausible way this rots.
if ! grep -q "assertContainment" apps/studio/server.ts; then
  echo "FAIL: apps/studio/server.ts no longer calls assertContainment()." >&2
  echo "      The boot-assert is defined but never runs." >&2
  fail=1
fi

# ---- 2. no browser automation in the cell's runtime dependencies ------------
# devDependencies are fine — the desktop E2E harness and the screenshot fallback
# legitimately use Playwright on a DEVELOPER's machine. The cell ships runtime
# deps only.
for manifest in package.json apps/studio/package.json apps/hub/package.json; do
  [ -f "$manifest" ] || continue
  hits=$(node -e '
    const fs = require("node:fs");
    const pkg = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const runtime = { ...(pkg.dependencies ?? {}), ...(pkg.optionalDependencies ?? {}) };
    const banned = ["playwright", "playwright-core", "puppeteer", "puppeteer-core"];
    console.log(banned.filter((b) => b in runtime).join(" "));
  ' "$manifest")
  if [ -n "$hits" ]; then
    echo "FAIL: $manifest lists browser automation as a RUNTIME dependency: $hits" >&2
    echo "      A workspace cell that ships a browser is one import() from rendering" >&2
    echo "      tenant-authored TSX (DDR-193 §2). Move it to devDependencies." >&2
    fail=1
  fi
done

# ---- 3. the CELL IMAGE must not be able to render at all ------------------
# A cell that merely *chooses* not to render is one config mistake from
# rendering. A cell with no browser in it cannot, whatever the config says — so
# the image is where the strongest version of this invariant lives.
CELL_DOCKERFILE="infra/cell/Dockerfile"
CELL_ENTRYPOINT="infra/cell/entrypoint.sh"
if [ -f "$CELL_DOCKERFILE" ]; then
  for browser in playwright puppeteer chromium chrome firefox; do
    # Match INSTALL directives only — the file legitimately names these in the
    # comment explaining why they are absent, and in the entrypoint's own check.
    if grep -iE '^\s*(RUN|COPY|ADD).*'"$browser" "$CELL_DOCKERFILE" >/dev/null 2>&1; then
      echo "FAIL: $CELL_DOCKERFILE installs '$browser'." >&2
      echo "      A tenant cell must not be able to render tenant-authored TSX" >&2
      echo "      (DDR-193 §2). Rendering happens on a member's own machine." >&2
      fail=1
    fi
  done

  if [ ! -f "$CELL_ENTRYPOINT" ]; then
    echo "FAIL: $CELL_ENTRYPOINT is missing — the cell's boot-assert is gone." >&2
    fail=1
  else
    # The entrypoint must still CHECK at boot. An image can be hand-modified and
    # a base image can change under us, so the cheap re-check has to survive.
    if ! grep -q 'containment' "$CELL_ENTRYPOINT"; then
      echo "FAIL: $CELL_ENTRYPOINT no longer performs a containment check at boot." >&2
      fail=1
    fi
    # And it must refuse to start on an empty rehydrate. A cell that starts
    # empty looks exactly like a brand-new project, and autosave would commit
    # that emptiness over real work.
    if ! grep -q 'Refusing to start with an empty working set' "$CELL_ENTRYPOINT"; then
      echo "FAIL: $CELL_ENTRYPOINT no longer refuses to start after a failed rehydrate." >&2
      echo "      An empty working set is indistinguishable from a deleted project," >&2
      echo "      and autosave would commit the emptiness over real work." >&2
      fail=1
    fi
  fi
fi

if [ "$fail" -ne 0 ]; then
  echo "" >&2
  echo "containment gate FAILED" >&2
  exit 1
fi

echo "containment gate OK — forbidden surfaces named, asserts wired (studio + cell image), no runtime browser dep"
