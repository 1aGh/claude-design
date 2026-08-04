#!/usr/bin/env bash
# Cloud Phase 27 D1 — the secret-bearing surfaces are not IN the cell's binary.
#
# A cell already refuses them three times: the route table is pruned at boot,
# the hub's manifest denies them, and a running cell 404s all of them. That is
# operational containment, and DDR-123's promise — "claude never runs on our
# infrastructure" — is a claim about what is in the image. This is the gate that
# makes the second claim true rather than merely likely.
#
# WHAT IT ASSERTS, AND WHY IT IS A PAIR. For each sentinel: PRESENT in a desktop
# binary, ABSENT from a cloud one. Absence alone proves nothing — a typo in the
# sentinel is absent from every binary ever built, and a gate that cannot go red
# is a gate people learn to ignore. `api.github.com` is the cautionary tale that
# made this rule: it looked like the perfect sentinel and appears in every
# compiled artifact, because Bun's own runtime carries GITHUB_API_DOMAIN.
#
#   scripts/check-cloud-binary.sh                 # build both, compare
#   scripts/check-cloud-binary.sh --no-build      # compare what is already in dist/
#
# Slow by nature (two compiles, ~1 min). Run in the release job, not on push.

set -euo pipefail

STUDIO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../apps/studio" && pwd)"
cd "$STUDIO"

BUILD=1
[ "${1:-}" = "--no-build" ] && BUILD=0

# The host's own target — the point is the elimination, which is
# platform-independent, so building one arch is the honest cost/benefit.
SLUG="$(bun -e 'const p={darwin:"darwin",linux:"linux",win32:"windows"}[process.platform]??process.platform;const a={arm64:"arm64",x64:"x64"}[process.arch]??process.arch;console.log(`${p}-${a}`)')"
DESKTOP="dist/maude-${SLUG}"
CLOUD="dist/maude-cloud-${SLUG}"

if [ "$BUILD" = "1" ]; then
  echo "[cloud-gate] building both variants for ${SLUG} …"
  MAUDE_SKIP_CLIENT_BUILD=1 MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release >/dev/null
  MAUDE_SKIP_CLIENT_BUILD=1 MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release --cloud >/dev/null
fi

for f in "$DESKTOP" "$CLOUD"; do
  [ -f "$f" ] || { echo "[cloud-gate] FAIL: $f does not exist (build it first)" >&2; exit 1; }
done

# Read the sentinel list from the source of truth rather than restating it here.
mapfile -t SENTINELS < <(bun -e '
  const { CLOUD_FORBIDDEN_STRINGS } = await import("./cloud-build.ts");
  for (const s of CLOUD_FORBIDDEN_STRINGS) console.log(s);
')

[ "${#SENTINELS[@]}" -gt 0 ] || { echo "[cloud-gate] FAIL: no sentinels declared" >&2; exit 1; }

fail=0
for s in "${SENTINELS[@]}"; do
  in_desktop=$(grep -ac -- "$s" "$DESKTOP" || true)
  in_cloud=$(grep -ac -- "$s" "$CLOUD" || true)
  if [ "$in_desktop" -eq 0 ]; then
    echo "[cloud-gate] FAIL: '$s' is absent from the DESKTOP binary too — the sentinel is wrong," >&2
    echo "             not the build. A gate that cannot go red is not a gate." >&2
    fail=1
  elif [ "$in_cloud" -ne 0 ]; then
    echo "[cloud-gate] FAIL: '$s' is still in the cloud binary ($in_cloud match(es))." >&2
    echo "             Its module is reachable from a second importer, or it left CLOUD_ELIMINATED." >&2
    fail=1
  else
    echo "[cloud-gate] ok: '$s' — desktop $in_desktop, cloud 0"
  fi
done

# The cloud binary must still BE a studio. An empty file passes every grep.
if ! grep -aq "maude" "$CLOUD"; then
  echo "[cloud-gate] FAIL: the cloud binary does not look like a studio at all" >&2
  fail=1
fi

d_size=$(wc -c < "$DESKTOP")
c_size=$(wc -c < "$CLOUD")
if [ "$c_size" -ge "$d_size" ]; then
  echo "[cloud-gate] FAIL: the cloud binary ($c_size B) is not smaller than the desktop one ($d_size B)." >&2
  echo "             Elimination that removes nothing removed nothing." >&2
  fail=1
else
  echo "[cloud-gate] ok: $((  (d_size - c_size) / 1024 / 1024 )) MB smaller than the desktop binary"
fi

[ "$fail" = "0" ] || exit 1
echo "[cloud-gate] PASS"
