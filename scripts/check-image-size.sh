#!/usr/bin/env bash
# The cost gate — Cloud Phase 27.
#
# WHY A CEILING AND NOT A GRAPH. The cell image was slimmed 679 → 157 MB after
# the platform could not cold-start the large one, and that RCA leaves size as
# an unresolved SUSPECT rather than a solved problem. Phase 27 then put an
# entire second server inside it. A ceiling asserted in CI is how "we measured
# it once" becomes "it cannot quietly drift back", which is the difference
# between a fixed bug and a fixed-for-now one.
#
# The numbers are the amd64 ones, because amd64 is what the platform runs. They
# were measured, not guessed:
#
#   hub    157 MB (pre-phase)  →  165 MB   +8 MB  (+5.1%)
#   cell   195 MB (pre-phase)  →  204 MB   +9 MB  (+4.6%)
#
# Measured with `docker image inspect --format '{{.Size}}'` on a specific image
# id. The `docker images` SIZE column disagreed with it by a factor of four on
# Docker Desktop and is NOT what this gate reads — if you re-measure by hand and
# get a wildly different number, check which one you used before believing it.
#
# The whole studio ships for +8 MB because the compiled `maude-server` REPLACED
# the standalone Bun the image already carried for the build sandbox — one
# artifact doing two jobs instead of two doing one each.
#
# HEADROOM IS DELIBERATELY SMALL. A ceiling with 100 MB of slack is a ceiling
# that never fires. ~15% is enough for ordinary dependency drift and tight
# enough that adding a second runtime, a browser, or a node_modules tree trips
# it in the PR that does it.
#
#   scripts/check-image-size.sh <image-ref> [hub|cell]
#
# Exits non-zero over the ceiling. Never "fixes" anything.
set -euo pipefail

IMAGE="${1:-}"
KIND="${2:-cell}"

if [ -z "$IMAGE" ]; then
  echo "usage: $0 <image-ref> [hub|cell]" >&2
  exit 2
fi

case "$KIND" in
  hub)  CEILING_MB=190 ; MEASURED_MB=165 ;;
  cell) CEILING_MB=235 ; MEASURED_MB=204 ;;
  *) echo "unknown kind '$KIND' (expected hub|cell)" >&2; exit 2 ;;
esac

if ! command -v docker >/dev/null 2>&1; then
  echo "note: docker not on PATH — skipped the image-size gate" >&2
  exit 0
fi

BYTES="$(docker image inspect "$IMAGE" --format '{{.Size}}' 2>/dev/null || true)"
if [ -z "$BYTES" ]; then
  echo "FAIL: cannot inspect '$IMAGE' — is it built?" >&2
  exit 1
fi

MB=$(( BYTES / 1000000 ))
echo "[image-size] $IMAGE ($KIND): ${MB} MB  (measured at phase-27 close: ${MEASURED_MB} MB, ceiling ${CEILING_MB} MB)"

if [ "$MB" -gt "$CEILING_MB" ]; then
  cat >&2 <<EOF

FAIL: $IMAGE is ${MB} MB, over the ${CEILING_MB} MB ceiling for a $KIND image.

  Image size is a SUSPECT in the 2026-08-03 cold-start outage — a 679 MB image
  could not start, a 116 MB one appeared to fix it once and did not reproduce.
  Nobody has closed that RCA, so this ceiling is a hard stop rather than a
  warning.

  Before raising it, check whether the growth is a SECOND copy of something the
  image already has. That is what it was last time: the standalone Bun and the
  compiled server are the same runtime, and noticing that is what let an entire
  studio ship for +8 MB.

  If the growth is genuinely necessary, raise the ceiling in this file IN THE
  SAME COMMIT, with the new measurement written down — not silently, and not
  by deleting the gate.
EOF
  exit 1
fi

echo "[image-size] OK"
