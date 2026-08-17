// The cell child's file-event wiring — Sync v2 Increment 2 (DDR-226 §4/§6).
//
// Three small pieces, assembled once at boot:
//
//   resolveCellCtl  → do we have a loopback hub and a token? (workspace mode)
//   createCtlProvider → hold the read-only `maude.files` channel open
//   createCtlHealer   → poke ⇒ read the journal ⇒ emit the `fs:any` the
//                       container's watcher owed us
//
// After that, everything is the machinery that already exists: `fs:any` →
// `createHmrBroadcaster` → `canvas-hmr {mode:'asset'|'css'|'module'}` → the
// iframe repoints a broken `<img>` (DDR-224) or swaps a stylesheet. No new UI
// path, no new reload semantics.
//
// GATED ON WORKSPACE MODE, NOT ON CELL PAIRING — the whole point. Pairing is a
// one-tenant pilot allowlist; the watcher gap is on every cell. See the header
// of `ctl-provider.ts` for why the pairing preconditions do not apply to a
// read-only stateless channel.
//
// Locally this never starts: outside a container `fs.watch` fires and a second
// event source would double-reload every canvas on every edit, exactly the
// reason `createContainerWriteBridge` carries the same gate.

import type { Context } from '../context.ts';
import { createCtlHealer } from './ctl-heal.ts';
import { createCtlProvider, resolveCellCtl } from './ctl-provider.ts';

export interface CellFileEvents {
  stop(): void;
  /** Pokes received on the channel. */
  received(): number;
  /** Paths announced onward as `fs:any`. */
  healed(): number;
}

/**
 * Start the hub→child file-event bridge. Returns null when this process is not
 * a cell studio child (which is every desktop, and every local dev server).
 *
 * Never throws: the studio must start whether or not it has a doorbell.
 */
export function startCellFileEvents(
  ctx: Context,
  env: Record<string, string | undefined> = process.env
): CellFileEvents | null {
  const target = resolveCellCtl(env);
  if (!target) return null;

  const healer = createCtlHealer({
    hubUrl: target.url,
    token: target.token,
    // The one side effect: announce a path onto the bus. Nothing here writes a
    // file, and nothing here trusts the hub's row beyond its shape — the
    // canvas layer re-reads the real disk to decide what to do about it.
    emit: (rel) => ctx.bus.emit('fs:any', rel),
  });

  const provider = createCtlProvider({
    url: target.url,
    token: target.token,
    onPoke: (head) => healer.onPoke(head),
  });

  console.log(
    '[sync/ctl] file-event channel attached to this cell’s own hub — hub-process writes now heal open canvases without a reload.'
  );

  return {
    stop() {
      provider.stop();
      healer.stop();
    },
    received: () => provider.received(),
    healed: () => healer.healed(),
  };
}
