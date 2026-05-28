# Contributing to `@maude/hub`

How to run + test the self-hostable Yjs sync hub locally without a Fly account
or a real domain. Two fidelity levels — start with Level 1.

> Real-TLS testing (WSS, Let's Encrypt) is **not** done with local mkcert in
> v1.1. Spin up a throwaway Fly preview deploy instead — see the bottom of this
> doc. Fly gives you a real cert in ~3 minutes for ~$0 if you delete it the
> same day.

## Prerequisites

```sh
# From the repo root, once:
pnpm install --filter @maude/hub
```

The hub is **Node-only** at runtime (Hocuspocus' `crossws` adapter rejects
Bun/Deno and `better-sqlite3` isn't Bun-compatible — see
[DDR-052](../../../.ai/decisions/DDR-052-hocuspocus-over-partykit-for-hub.md)).
Bun is used only as the bundler (`bun run build.ts`).

---

## Level 1 — plain Node (fastest iteration)

No Docker, no bundle. Runs `src/server.mjs` directly.

```sh
# Terminal A — run the hub with an auto-generated dev token + bootstrap link:
node ../../../cli/bin/maude.mjs hub serve --dev --insecure-http
#   → prints a mau_dev_<hex> token + the ready-to-paste connect command
#   → prints the single-use /admin bootstrap link
# (Or: pnpm --filter @maude/hub dev   for node --watch reload on src changes.)

# Terminal B — a peer repo:
cd /tmp/test-project
maude init                       # or: maude design init --no-discovery
echo '<button>test</button>' > .design/ui/screen.html
maude design link http://localhost:1234 --token mau_dev_<hex> --adopt

# Terminal C — a second peer (second clone of the same repo):
cd /tmp/test-project-2
git clone /tmp/test-project .
maude design link http://localhost:1234 --token mau_dev_<hex>

# Now an edit in B or C propagates through the hub to the other.
```

`--dev` is the zero-config onboarding shortcut: it mints the dev token, prints
the connect command, then boots the hub. `--insecure-http` lets the hub serve
over plain `http://localhost` (the production WSS guard refuses non-loopback
HTTP). Dev only — never set it on a public deploy.

Run the test suite:

```sh
pnpm --filter @maude/hub test     # node --test, 90+ cases
```

---

## Level 2 — Docker Compose (closer to production)

Builds the actual production image from the local `Dockerfile`, binds port 1234
straight to the host, no Caddy/TLS. Tests YOUR changes, not the published image.

```sh
cd plugins/design/hub
docker compose -f docker-compose.dev.yml up --build
#   → hub on http://localhost:1234
#   → bootstrap link printed in the logs (docker compose logs)
```

Same linking flow as Level 1 from there.

---

## Common gotchas

- **Docker on macOS volume perf.** The `/data` SQLite volume is slow over the
  macOS bind-mount layer. The dev compose uses a named volume (`hub-dev-data`)
  to avoid the bind-mount penalty — keep it that way.
- **`fs.watch` inside Linux containers.** The sync *agent* (which watches
  `.design/`) runs on the peer, not in the hub container, so container fs.watch
  quirks don't affect the hub. If you're testing the agent inside a container,
  note that `fs.watch` recursive mode is unreliable on some overlay filesystems
  — the agent's chokidar fallback covers this, but native-watch perf differs.
- **WS upgrade behind a reverse proxy.** Caddy upgrades WebSockets transparently
  (`reverse_proxy` does it by default). If you put your own proxy in front, make
  sure it forwards the `Upgrade` / `Connection` headers, or the Yjs connection
  silently falls back to failing reconnects (you'll see the offline banner).
- **`better-sqlite3` rebuild.** If you switch Node major versions, re-run
  `pnpm install --filter @maude/hub` so the native binding recompiles. A stale
  binding throws `NODE_MODULE_VERSION` mismatch on boot.
- **Token store is SQLite now.** Tokens live in `<data>/tokens.db` (HMAC-hashed
  at rest, Task 6), not the old `tokens.json`. Delete the `--data` dir to reset.

---

## Real-TLS testing — Fly preview deploy

For exercising actual WSS + Let's Encrypt (cross-continent latency, cert
renewal, the WSS boot guard), deploy a throwaway hub:

```sh
maude hub deploy fly --name maude-hub-pr-<n>
fly launch --copy-config --no-deploy --name maude-hub-pr-<n>
fly deploy
# ... test against https://maude-hub-pr-<n>.fly.dev ...
fly apps destroy maude-hub-pr-<n>     # $0 if deleted the same day
```

This is the canonical "test WSS" path — local mkcert is deferred to v1.2
because Fly preview deploys give better TLS reality for less setup.

See [`README.md`](./README.md) for the runtime contract and the full env-var
list, and `.ai/plans/phase-9-self-hosted-hub-file-sync.md` for the plan.
