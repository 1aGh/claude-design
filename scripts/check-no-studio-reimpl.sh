#!/usr/bin/env bash
# One studio, three shells — the CI half of DDR-209 / Cloud Phase 27 E2.
#
# THE FAILURE THIS EXISTS FOR ALREADY HAPPENED. Cloud Phase 25 B3 shipped
# `apps/hub/src/canvas/studio-page.mjs`: 469 lines re-implementing a studio
# whose real client is 15,073. Nothing was broken, no test went red, and the
# owner found out by opening his own project in a browser and seeing a
# different, poorer application than the one on his desktop.
#
# Nobody decided to do that. It happened the way this always happens — the real
# studio was one route table away, reaching it looked like a week, and a page
# that lists canvases looked like an afternoon. So the guard is not "do not
# reimplement the studio"; it is a build that goes red the moment somebody
# starts to.
#
# Three checks:
#   1. no HTML studio shell under apps/hub/src — a `<!doctype` beside a canvas
#      list is how the last one began;
#   2. no studio ROUTE re-declared in the hub — `/_config`, `/_api/*`,
#      `/_canvas-*` belong to the studio, and a second implementation of one is
#      a second answer to the same question;
#   3. the modules DDR-209 A′3 deleted stay deleted — a revert that restores
#      them, or a new file wearing one of their names, is the same drift again.
#
# Exits non-zero with an explanation. Never "fixes" anything.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

HUB_SRC="apps/hub/src"
fail=0

if [ ! -d "$HUB_SRC" ]; then
  echo "note: $HUB_SRC is absent — nothing to check" >&2
  exit 0
fi

# ---- 1. no studio HTML shell in the hub -------------------------------------
#
# The hub legitimately renders TWO pages, both of which exist because the studio
# cannot serve them: the operator landing (`renderLanding`) and the service page
# for "paused" / "signing in" (`servicePage`). Both live in files named below.
# Anything ELSE emitting a document is a shell, and a shell is an application.
ALLOWED_HTML_FILES=(
  "$HUB_SRC/server.mjs"        # renderLanding — the self-hosted operator signpost
  "$HUB_SRC/studio-door.mjs"   # servicePage  — paused / no-project
  "$HUB_SRC/browser-auth.mjs"  # the sign-in interstitial
  "$HUB_SRC/admin-assets.mjs"  # the admin console's own assets
)
while IFS= read -r file; do
  skip=0
  for allowed in "${ALLOWED_HTML_FILES[@]}"; do
    [ "$file" = "$allowed" ] && skip=1 && break
  done
  [ "$skip" -eq 1 ] && continue
  echo "FAIL: $file emits an HTML document." >&2
  echo "      A page in the hub that is not the landing, the service page or the" >&2
  echo "      admin console is a STUDIO SHELL. The studio serves the studio" >&2
  echo "      (DDR-209 A′2) — proxy to it instead of drawing it again." >&2
  fail=1
done < <(grep -rlEi '<!doctype html' "$HUB_SRC" --include='*.mjs' --include='*.ts' 2>/dev/null || true)

# ---- 2. no studio route re-declared in the hub ------------------------------
#
# These prefixes are the studio's HTTP identity. The hub may PROXY them (the
# route manifest names them as strings, which is the point) — it may not answer
# them. So the check is for a route being HANDLED here, which in this codebase
# means a path literal followed by a handler, not a path literal in a table.
STUDIO_ROUTE_PREFIXES=(
  "/_config"
  "/_canvas-shell"
  "/_canvas-runtime"
  "/_canvas-state"
  "/_index-data"
  "/_system-data"
  "/_comments"
  "/_api/"
)
for prefix in "${STUDIO_ROUTE_PREFIXES[@]}"; do
  # `pathname === '<route>'` / `url === '<route>'` / `startsWith('<route>')` in a
  # file that is NOT the manifest or the proxy = the hub answering for itself.
  hits=$(grep -rnE "(pathname|authPath|url|path)\s*===?\s*'${prefix}" "$HUB_SRC" \
    --include='*.mjs' --include='*.ts' 2>/dev/null \
    | grep -v "$HUB_SRC/studio-manifest.mjs" \
    | grep -v "$HUB_SRC/studio-proxy.mjs" || true)
  if [ -n "$hits" ]; then
    echo "FAIL: the hub answers a studio route itself:" >&2
    echo "$hits" | sed 's/^/  /' >&2
    echo "      '${prefix}…' belongs to apps/studio. The hub's job is to decide WHO" >&2
    echo "      may reach it (studio-manifest.mjs) and forward (studio-proxy.mjs)." >&2
    fail=1
  fi
done

# ---- 3. the deleted reimplementation stays deleted --------------------------
#
# Named individually rather than by directory, because the directory is exactly
# what a well-meaning revert would recreate.
DELETED=(
  "$HUB_SRC/canvas/studio-page.mjs"
  "$HUB_SRC/canvas/shell.mjs"
  "$HUB_SRC/canvas/build.mjs"
  "$HUB_SRC/canvas/build-worker.ts"
  "$HUB_SRC/canvas/edits.mjs"
  "$HUB_SRC/canvas/edit-worker.ts"
  "$HUB_SRC/canvas/comments.mjs"
  "$HUB_SRC/canvas/project.mjs"
  "$HUB_SRC/canvas/routes.mjs"
)
for gone in "${DELETED[@]}"; do
  if [ -e "$gone" ]; then
    echo "FAIL: $gone is back." >&2
    echo "      DDR-209 A′3 deleted it because the studio already owns that route." >&2
    echo "      If it is genuinely needed again, that is a decision with a DDR," >&2
    echo "      not a file." >&2
    fail=1
  fi
done

# ---- 4. one builder ---------------------------------------------------------
#
# A′2's acceptance line: "a canvas is built by one builder". The engine is
# `apps/studio/canvas-build.ts`; the only host allowed to invoke it out of
# process is the studio's own sandbox.
builders=$(grep -rln "buildCanvasModule" apps/hub apps/studio \
  --include='*.mjs' --include='*.ts' 2>/dev/null \
  | grep -v node_modules \
  | grep -vE 'apps/studio/(canvas-build\.ts|canvas-build-sandbox\.ts|canvas-build-worker\.ts|http\.ts|test/)' || true)
if [ -n "$builders" ]; then
  echo "FAIL: a second canvas builder:" >&2
  echo "$builders" | sed 's/^/  /' >&2
  echo "      Two builders in one container is the duplication DDR-209 deleted." >&2
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  echo "" >&2
  echo "studio-reimplementation gate FAILED" >&2
  exit 1
fi

echo "no-studio-reimpl gate OK — one shell, one route owner, one builder"
