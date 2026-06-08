# Studio Hub — local playground

A turnkey way to run the hub locally and watch the admin console (`/admin`) fill
with **real** peers, canvases, and activity — without deploying anything.

Two pieces:

1. **`docker-compose.playground.yml`** — runs the hub in Docker with a *fixed*
   `HUB_SECRET` (`studio-hub-dev`), so you have a known login and the whole thing
   is scriptable (the production templates use a one-time bootstrap link instead).
2. **`run-smoke.sh` + `smoke/peer.mjs`** — two stand-in "repos" that connect to
   the hub and edit two canvases live, so Peers / Canvases / Activity populate.

## Run it

```sh
cd apps/hub/playground

# 1. start the hub (builds the image from ../Dockerfile — your local changes)
docker compose -f docker-compose.playground.yml up --build -d

# 2. open the admin and sign in
open http://localhost:1234/admin          # HUB_SECRET = studio-hub-dev

# 3. spin up the two smoke repos (mints a token, launches 2 peers)
./run-smoke.sh
```

Within ~10 seconds the admin shows:

| Surface   | What you'll see |
| --------- | --------------- |
| Overview  | peers **2** · canvases **2** · a token · uptime |
| Peers     | `alice → alpha-home`, `bob → beta-landing` |
| Canvases  | `alpha-home`, `beta-landing` — **sizes grow** as the peers keep editing |
| Activity  | `playground-smoke · invite issued` + the two joins |
| Tokens    | the `playground-smoke` hub-wide token (rotate it → peers get kicked) |
| Settings  | rename the hub, see it reflect in the sidebar; Danger zone rotates the admin secret |

## Stop it

```sh
./stop.sh            # stop the two peers (hub keeps running)
./stop.sh --all      # also stop + remove the hub container (keeps the data volume)
```

## No Docker?

You don't need Docker — run the hub straight from Node and point the smoke script
at it:

```sh
# terminal 1 — the hub
cd apps/hub
HUB_SECRET=studio-hub-dev HUB_INSECURE_HTTP=1 HUB_ADMIN_RATE_LIMIT=off \
  node src/server.mjs

# terminal 2 — the two smoke repos
cd apps/hub/playground && ./run-smoke.sh
```

## Notes

- The smoke peers reuse `apps/hub/node_modules` (they import `@hocuspocus/provider`
  + `yjs`). Run `pnpm install` at the repo root first if you haven't.
- `run-smoke.sh` mints a **real hub-wide token** via `POST /admin/api/token`, so
  the peers authenticate properly and fire `join` activity events (an invalid
  token would still show under Peers but never reach Activity).
- Activity is in-memory + ephemeral — it resets when the hub restarts. That's by
  design (it's a live feed, not a persisted audit log — DDR-097).
- Everything here is **dev-only**: `HUB_INSECURE_HTTP=1` + `HUB_ADMIN_RATE_LIMIT=off`
  + a hard-coded secret. Never use this compose file for a public deploy — use
  `../docker-compose.yml.template` + `../Caddyfile.template` for that.
