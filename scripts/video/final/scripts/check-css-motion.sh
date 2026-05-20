#!/usr/bin/env bash
# Forbid CSS transition/animation in inline style objects under src/.
#
# Why: Remotion renders deterministically frame-by-frame — CSS @keyframes and
# transition: properties don't tick. They look fine in Studio (which uses
# browser playback) but produce broken / missing frames when `remotion render`
# captures stills. The official Remotion best-practices skill explicitly warns
# against this.
#
# Triggers on any of:
#   transition:
#   transitionProperty:
#   transitionDuration:
#   animation:
#   animationName:
#   animationDuration:
# inside src/**/*.tsx files.
#
# Exit 0 = clean. Exit 1 = found violation(s).

set -euo pipefail

cd "$(dirname "$0")/.."

PATTERN='\b(transition|transitionProperty|transitionDuration|transitionTimingFunction|transitionDelay|animation|animationName|animationDuration|animationTimingFunction|animationDelay|animationIterationCount|animationDirection|animationFillMode|animationPlayState)\s*:'

if grep -rnE "$PATTERN" src/ 2>/dev/null; then
  echo ""
  echo "ERROR: forbidden CSS motion property in Remotion source."
  echo "       Use Remotion's interpolate() + useCurrentFrame() instead."
  echo "       Or for declarative chained animations, lib/animated/Animated."
  exit 1
fi

echo "ok: no CSS transition/animation in src/"
