#!/bin/sh
# BUILD-TIME containment assertion — DDR-193 §2.
#
# Three places hold this line, deliberately:
#   1. `scripts/check-containment.sh` in CI, at review time, where it is cheap;
#   2. HERE, at image build time, so a bad base image never becomes an artifact;
#   3. `entrypoint.sh` at boot, so a hand-modified image also fails loud.
#
# WHY THIS IS ITS OWN FILE. The cell Dockerfile must not contain the strings
# `playwright` / `puppeteer` / `chromium` at all: the CI gate refuses any
# Dockerfile whose RUN/COPY/ADD lines name a browser, and it cannot tell an
# INSTALL from an ASSERTION. Keeping the assertion here means the gate stays
# maximally strict — it never has to be taught an exception — while the check
# still runs. A guard you had to loosen to keep your build green is a guard
# that will be loosened again.
set -eu

fail=0

for mod in playwright playwright-core puppeteer puppeteer-core; do
  if [ -d "/app/node_modules/$mod" ]; then
    echo "containment: /app/node_modules/$mod is present (DDR-193 §2)." >&2
    fail=1
  fi
done

for bin in chromium chromium-browser google-chrome firefox; do
  if command -v "$bin" >/dev/null 2>&1; then
    echo "containment: a browser ($bin) is on PATH (DDR-193 §2)." >&2
    fail=1
  fi
done

if [ "$fail" -ne 0 ]; then
  echo "A cell must never be able to render tenant-authored TSX." >&2
  echo "Refusing to build — a cell that CAN render is one import() from doing it." >&2
  exit 1
fi

echo "[cell] containment asserted at build time — no renderer in this image"
