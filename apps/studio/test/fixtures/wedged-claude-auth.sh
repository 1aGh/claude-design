#!/bin/sh
# Test fixture for issue #107 (defender M2 / attacker F3) — a `claude` stand-in
# that reproduces the wedge shape: it exits immediately, but leaves a background
# descendant holding fd 1 (stdout). `proc.kill()` signals only the direct child,
# so the pipe never reaches EOF and a read that waits for EOF hangs forever.
# `readBounded` must give up on its own deadline instead.
if [ "$1" = "auth" ] && [ "$2" = "status" ]; then
  sleep 120 &
  exit 0
fi
exit 1
