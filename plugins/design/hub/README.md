# @maude/hub

Self-hostable Yjs sync hub for Maude cross-machine canvas collaboration.

> **⚠ Linked mode is an experimental v1.1 preview.** Hub-pushed content is
> written to a peer's `.design/` files as untrusted input (treat it like
> `git pull` from a stranger). **Only link to hubs you operate or fully
> trust.** See [DDR-054](../../../.ai/decisions/DDR-054-linked-mode-trust-model-and-task-4-hardening.md)
> for the trust model and the four architectural items that must land before
> linked mode is supported for general use.

> **Status — Phase 9 (2026-05-28).** Boots; persists Y.Doc state via SQLite;
> authenticates against a SQLite token store (HMAC-SHA256 at rest, Task 6) with
> `HUB_SECRET` as a fallback. Admin UI (Task 2.5) + peer pairing (Task 3) +
> bidirectional file-sync agent (Task 4) + awareness over WSS (Task 5) shipped.
> Deploy templates (Task 7) land in a subsequent slice.

See `.ai/plans/phase-9-self-hosted-hub-file-sync.md` for the full plan,
`.ai/decisions/DDR-052-hocuspocus-over-partykit-for-hub.md` for the
framework choice, and `.ai/docs/research-collab.md` for the design analysis.

## Run locally

```sh
# From repo root, install workspace deps once:
pnpm install --filter @maude/hub

# Plain Node, no bundle (fastest iteration):
node plugins/design/hub/src/server.mjs

# Watch mode:
pnpm --filter @maude/hub dev

# Bundled (matches the published binary path):
pnpm --filter @maude/hub build
node plugins/design/hub/dist/hub.bundle.mjs
```

The hub listens on `$PORT` (default `1234`), persists Y.Doc state to
`$DATA_DIR/hub.db`, and stores tokens in `$DATA_DIR/tokens.db` (HMAC-SHA256 —
the raw token value is never written to disk).

## Environment

| Var | Default | Notes |
| --- | --- | --- |
| `PORT` | `1234` | Listen port. TLS terminates upstream (Caddy / Fly auto-cert / ALB). |
| `DATA_DIR` | `./data` | `hub.db` (Y.Doc state) + `tokens.db` (HMAC token store) + `admin.json` / `bootstrap.json`. Mount as a volume in Docker / Fly. |
| `HUB_SECRET` | _(unset)_ | Escape-hatch bearer token. The token store is primary; `HUB_SECRET` is a fallback for headless setups. **Store empty AND `HUB_SECRET` unset = permissive dev mode** (accepts any token, warns). |
| `HUB_PUBLIC_URL` | `https://localhost:$PORT` | Base URL printed in admin / bootstrap logs and embedded in invite commands. Must be `https://` for any non-loopback host (see transport hardening). |
| `HUB_INSECURE_HTTP` | _(unset)_ | If `1`, allows the hub to boot with a plaintext `http://` `HUB_PUBLIC_URL` to a non-loopback host. **Local testing only.** |
| `HUB_ADMIN_RATE_LIMIT` | _(on)_ | `off` disables the per-IP admin-API rate limiter (dev only). |

## Transport hardening (Task 6)

- **TLS is mandatory for public hubs.** The hub serves plaintext HTTP/WS and
  expects TLS to terminate at the proxy in front of it. It **refuses to boot**
  when `HUB_PUBLIC_URL` is `http://` to a non-loopback host unless
  `HUB_INSECURE_HTTP=1` is set. Terminate TLS with one of:
  - **Fly.io** — automatic certificate (set `HUB_PUBLIC_URL=https://<app>.fly.dev`).
  - **Docker / VPS** — Caddy with an `acme_email` for auto Let's Encrypt (Task 7 ships the `Caddyfile`).
  - **Cloudflare Tunnel** — terminates TLS upstream; point `HUB_PUBLIC_URL` at the public hostname.
  - **Tailscale Funnel** — same pattern for tailnet-fronted hubs.
- **Tokens are hashed at rest.** `tokens.db` stores `hmac_sha256(token, hubKey)`;
  a leaked store does not yield replayable credentials.
- **Per-token connection rate limit.** Each token is capped at 100 authentication
  attempts per 60s window — a leaked token can't drive a reconnection / replay flood.
- **Scope-bound tokens.** A token authorizes only its own `documentName` prefix
  unless minted with `scope: '*'` (DDR-053 §3).

## Connect a peer

```js
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';

const doc = new Y.Doc();
const provider = new HocuspocusProvider({
  url: 'ws://localhost:1234',
  name: 'projects/<projectId>/canvases/<canvasSlug>',
  token: process.env.HUB_SECRET ?? 'dev',
  document: doc,
});
```

`name` is the Hocuspocus `documentName` — a single hub multiplexes many
canvases per project. Phase 9 Task 4 builds the file-sync agent that wraps
this provider for `.design/*.html` mirroring.

## Acceptance (Phase 9 Task 1)

- `node dist/hub.bundle.mjs` boots on `localhost:1234`. ✅
- Two `@hocuspocus/provider` clients connect to the same `documentName`,
  mutate a shared `Y.Text`, and converge.
- SQLite at `$DATA_DIR/hub.db` persists state across a restart.
