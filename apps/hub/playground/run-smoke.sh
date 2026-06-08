#!/usr/bin/env bash
# Studio Hub playground — spin up two "smoke repos" syncing two canvases.
#
# Mints a hub-wide token via the admin API, then launches two peer processes
# (stand-ins for two design projects) that connect + edit live. Watch the admin
# at http://localhost:1234/admin fill up: Peers (2), Canvases (2, sizes growing),
# Activity (joins + the invite), Overview stats.
#
# Prereqs: the hub is running (docker compose -f docker-compose.playground.yml up
# -d  OR  `node ../src/server.mjs` with HUB_SECRET=studio-hub-dev), and the hub's
# deps are installed (pnpm install at the repo root — the peers reuse
# apps/hub/node_modules).
#
#   ./run-smoke.sh         # start the two peers (foreground log; Ctrl-C stops)
#   ./stop.sh              # or stop them later from another shell
set -euo pipefail

HUB_HTTP="${HUB_HTTP:-http://localhost:1234}"
HUB_WS="${HUB_WS:-ws://localhost:1234}"
HUB_SECRET="${HUB_SECRET:-studio-hub-dev}"

HERE="$(cd "$(dirname "$0")" && pwd)"
PEER="$HERE/smoke/peer.mjs"
PID_FILE="$HERE/.smoke-pids"

echo "→ waiting for hub at $HUB_HTTP/health …"
for i in $(seq 1 30); do
  if curl -fsS "$HUB_HTTP/health" >/dev/null 2>&1; then break; fi
  if [ "$i" = "30" ]; then
    echo "✗ hub not reachable at $HUB_HTTP. Start it first:"
    echo "    docker compose -f docker-compose.playground.yml up --build -d"
    exit 1
  fi
  sleep 1
done
echo "✓ hub is up"

echo "→ minting a hub-wide token via the admin API …"
TOKEN="$(node -e "
fetch('$HUB_HTTP/admin/api/token', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer $HUB_SECRET', 'Content-Type': 'application/json' },
  body: JSON.stringify({ label: 'playground-smoke', scope: '*' }),
}).then(r => r.ok ? r.json() : r.text().then(t => Promise.reject(new Error(r.status + ' ' + t))))
  .then(d => process.stdout.write(d.token || ''))
  .catch(e => { console.error('mint failed:', e.message); process.exit(1); });
")"
if [ -z "$TOKEN" ]; then echo "✗ could not mint a token (is HUB_SECRET correct?)"; exit 1; fi
echo "✓ token minted (${TOKEN:0:12}…)"

# Launch two stand-in "repos", each syncing one canvas.
echo "→ launching 2 smoke peers …"
HUB_WS_URL="$HUB_WS" HUB_TOKEN="$TOKEN" CANVAS="alpha-home"   PEER_USER="alice" EDIT_EVERY=4000 node "$PEER" &
P1=$!
HUB_WS_URL="$HUB_WS" HUB_TOKEN="$TOKEN" CANVAS="beta-landing" PEER_USER="bob"   EDIT_EVERY=6000 node "$PEER" &
P2=$!
echo "$P1 $P2" > "$PID_FILE"

cat <<EOF

──────────────────────────────────────────────────────────────────
  Studio Hub playground is live.

  Admin:   $HUB_HTTP/admin
  Sign in: HUB_SECRET = $HUB_SECRET

  You should see, within ~10s:
    • Peers      → alice@alpha-home, bob@beta-landing
    • Canvases   → alpha-home, beta-landing (sizes grow as they edit)
    • Activity   → invite issued + 2 joins
    • Overview   → peers 2 · tokens · canvases 2

  Stop:  ./stop.sh   (or Ctrl-C here)
──────────────────────────────────────────────────────────────────

EOF

# Keep the peers in the foreground so Ctrl-C cleans them up.
trap 'echo; echo "stopping peers…"; kill $P1 $P2 2>/dev/null || true; rm -f "$PID_FILE"; exit 0' INT TERM
wait
