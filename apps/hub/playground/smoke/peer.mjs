// Studio Hub playground — a single "smoke repo" peer.
//
// Stands in for a design project synced to the hub: connects one Yjs document
// (a "canvas") to the hub over WebSocket with a real hub-wide token, then makes
// periodic edits so the document persists to SQLite (its size grows in the
// Canvases browser) and the connection shows up under Peers + Activity.
//
// Reuses apps/hub/node_modules — run it from anywhere under apps/hub (Node walks
// parent dirs for node_modules), e.g. via playground/run-smoke.sh.
//
// Config via env:
//   HUB_WS_URL   ws://localhost:1234   hub WebSocket URL
//   HUB_TOKEN    <mau_…>               a hub-wide token value (run-smoke.sh mints it)
//   CANVAS       alpha-home            the document name (per-canvas slug)
//   PEER_USER    alice                 display label (cosmetic)
//   EDIT_EVERY   4000                  ms between edits (0 = connect only)

import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';

const HUB_WS_URL = process.env.HUB_WS_URL ?? 'ws://localhost:1234';
const HUB_TOKEN = process.env.HUB_TOKEN ?? '';
const CANVAS = process.env.CANVAS ?? 'alpha-home';
const PEER_USER = process.env.PEER_USER ?? 'peer';
const EDIT_EVERY = Number.parseInt(process.env.EDIT_EVERY ?? '4000', 10);

const tag = `[${PEER_USER}→${CANVAS}]`;
const doc = new Y.Doc();

const provider = new HocuspocusProvider({
  url: HUB_WS_URL,
  name: CANVAS,
  token: HUB_TOKEN,
  document: doc,
  onAuthenticationFailed: ({ reason }) => {
    console.error(`${tag} auth FAILED: ${reason}. Is HUB_TOKEN a valid hub-wide token?`);
    process.exit(1);
  },
  onAuthenticated: () => console.log(`${tag} authenticated`),
  onConnect: () => console.log(`${tag} connected to ${HUB_WS_URL}`),
  onDisconnect: () => console.log(`${tag} disconnected`),
});

// Seed some content so the document has a real on-disk blob.
const text = doc.getText('content');
let edits = 0;
text.insert(0, `# ${CANVAS}\nedited live by ${PEER_USER}\n`);

if (EDIT_EVERY > 0) {
  setInterval(() => {
    edits += 1;
    text.insert(
      text.length,
      `line ${edits} from ${PEER_USER} @ ${new Date().toISOString().slice(11, 19)}\n`
    );
  }, EDIT_EVERY);
}

const shutdown = () => {
  console.log(`${tag} shutting down`);
  try {
    provider.destroy();
  } catch {
    /* ignore */
  }
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
