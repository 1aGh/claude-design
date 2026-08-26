#!/bin/sh
# Test fixture for issue #107 round-2 defender L6 — a `claude` stand-in that
# prints a perfectly good status document and THEN leaves a descendant holding
# fd 1 (a daemon, an update check, a corporate agent). The pipe never reaches
# EOF, so the read hits its deadline — but the answer is already in the buffer
# and must not be thrown away.
if [ "$1" = "auth" ] && [ "$2" = "status" ]; then
  echo '{"loggedIn":true,"apiProvider":"firstParty","subscriptionType":"max"}'
  sleep 120 &
  exit 0
fi
exit 1
