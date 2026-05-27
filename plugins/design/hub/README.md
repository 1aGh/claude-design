# @maude/hub

Self-hostable Yjs sync hub for Maude cross-machine canvas collaboration.

> **Status — Phase 9 Task 1 skeleton (2026-05-27).** Boots; persists Y.Doc
> state via SQLite; authenticates against `HUB_SECRET`. Admin UI (Task 2.5),
> deploy templates (Task 7), and the bidirectional file-sync agent
> (Task 4) land in subsequent slices.

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

The hub listens on `$PORT` (default `1234`) and persists state to
`$DATA_DIR/hub.db` (default `./data/hub.db`).

## Environment

| Var | Default | Notes |
| --- | --- | --- |
| `PORT` | `1234` | Listen port. TLS terminates upstream (Caddy / Fly auto-cert / ALB). |
| `DATA_DIR` | `./data` | SQLite + future state dir. Mounted as a volume in Docker / Fly. |
| `HUB_SECRET` | _(unset)_ | Shared bearer token. **Unset = permissive dev mode** — accepts any token, logs a warning. Required for any non-loopback deploy. |
| `HUB_INSECURE_HTTP` | _(unset)_ | If `1`, logs the listen URL as `http://` instead of `ws://` — TLS is still terminated upstream; this only affects log copy. |

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
